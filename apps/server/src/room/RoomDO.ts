import {
  AvatarCustomization,
  Card,
  ClientMessage,
  PlayerPublicInfo,
  RoomFullSnapshot,
  RoomSummary,
  ServerMessage,
} from '@game/shared';
import { TienLenRule } from '../game/TienLenRule';

export interface Env {
  LOBBY: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
}

export class RoomDO implements DurableObject {
  private ctx: DurableObjectState;
  private env: Env;
  private rule: TienLenRule;
  private roomId: string = '';
  private roomCode: string = '';
  private roomName: string = '';
  private turnTimeoutMs: number = 30000; // 30 seconds
  private turnEndTime: number = 0;
  private countdownSeconds: number = 0;
  private countdownTimer: any = null;
  private turnTimeoutTimer: any = null;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
    this.rule = new TienLenRule();
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const pathMatch = url.pathname.match(/\/room\/([^/?]+)/);
      const pathRoomId = pathMatch ? pathMatch[1] : '';

      this.roomId = pathRoomId || url.searchParams.get('roomId') || this.roomId;
      this.roomCode = this.roomId.toUpperCase();
      this.roomName = url.searchParams.get('roomName') || this.roomName || `Bàn chơi ${this.roomCode}`;

      const playerId = url.searchParams.get('playerId') || `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const playerName = url.searchParams.get('playerName') || 'Người chơi';
      const avatarRaw = url.searchParams.get('avatar');
      let avatar: AvatarCustomization | undefined;
      if (avatarRaw) {
        try {
          avatar = JSON.parse(decodeURIComponent(avatarRaw));
        } catch (e) {
          // ignore parsing error
        }
      }

      // Accept WS with tag of playerId
      this.ctx.acceptWebSocket(server, [playerId]);

      // Handle player join / reconnect
      this.handlePlayerConnect(server, playerId, playerName, avatar);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not Found', { status: 404 });
  }

  private handlePlayerConnect(ws: WebSocket, playerId: string, playerName: string, avatar?: AvatarCustomization): void {
    let existingPlayer = this.rule.players.find(p => p.id === playerId);

    if (existingPlayer) {
      // Reconnect scenario
      existingPlayer.isConnected = true;
      existingPlayer.name = playerName || existingPlayer.name;
      if (avatar) existingPlayer.avatar = avatar;
    } else {
      // New player joining
      if (this.rule.players.length >= 4) {
        this.sendToWs(ws, {
          type: 'ERROR',
          payload: { code: 'ROOM_FULL', message: 'Phòng đã đủ 4 người.' },
        });
        ws.close(1008, 'Room full');
        return;
      }

      if (this.rule.gamePhase === 'playing') {
        this.sendToWs(ws, {
          type: 'ERROR',
          payload: { code: 'GAME_IN_PROGRESS', message: 'Ván đấu đang diễn ra.' },
        });
        ws.close(1008, 'Game in progress');
        return;
      }

      // Assign seat index (0..3) with optimal visual layout:
      // 1st player: Seat 0 (bottom)
      // 2nd player: Seat 2 (opposite across table)
      // 3rd player: Seat 1 (right)
      // 4th player: Seat 3 (left)
      const seatPriority = [0, 2, 1, 3];
      const takenSeats = new Set(this.rule.players.map(p => p.seatIndex));
      let availableSeat = 0;
      for (const s of seatPriority) {
        if (!takenSeats.has(s)) {
          availableSeat = s;
          break;
        }
      }

      existingPlayer = {
        id: playerId,
        name: playerName,
        seatIndex: availableSeat,
        hand: [],
        isReady: true, // Default ready as requested
        isConnected: true,
        hasPassed: false,
        playedCardsCount: 0,
        avatar,
      };

      this.rule.players.push(existingPlayer);
    }

    // Send ROOM_JOINED with full snapshot
    const snapshot = this.buildSnapshot(playerId);
    this.sendToWs(ws, {
      type: 'ROOM_JOINED',
      payload: {
        roomId: this.roomId,
        roomCode: this.roomCode,
        playerId,
        seatIndex: existingPlayer.seatIndex,
        snapshot,
      },
    });

    // Broadcast to other players
    this.broadcastExcept(playerId, {
      type: 'ROOM_PLAYER_JOINED',
      payload: {
        player: {
          id: existingPlayer.id,
          name: existingPlayer.name,
          seatIndex: existingPlayer.seatIndex,
          cardCount: existingPlayer.hand.length,
          isReady: existingPlayer.isReady,
          isConnected: existingPlayer.isConnected,
          isTurn: existingPlayer.id === this.rule.currentTurnPlayerId,
          hasPassed: existingPlayer.hasPassed,
          rankPosition: null,
          avatar: existingPlayer.avatar,
        },
      },
    });

    this.notifyLobby();
    this.checkStartCountdown();
  }

  public async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) return;

    try {
      const msg: ClientMessage = JSON.parse(message);

      switch (msg.type) {
        case 'ROOM_READY': {
          const player = this.rule.players.find(p => p.id === playerId);
          if (!player) return;

          player.isReady = msg.payload.ready;
          this.broadcast({
            type: 'ROOM_PLAYER_READY',
            payload: { playerId, isReady: player.isReady },
          });

          // If all ready -> 5s countdown; if someone clicked "Chờ" -> cancel countdown
          this.checkStartCountdown();
          break;
        }

        case 'ROOM_START_GAME': {
          if (
            this.rule.players.length >= 2 &&
            (this.rule.gamePhase === 'waiting' || this.rule.gamePhase === 'game_over')
          ) {
            this.cancelCountdown(false);
            this.startGame();
          }
          break;
        }

        case 'ROOM_KICK_PLAYER': {
          // Only host (players[0]) can kick
          if (this.rule.players.length === 0 || this.rule.players[0].id !== playerId) {
            this.sendToWs(ws, {
              type: 'ERROR',
              payload: { code: 'NOT_HOST', message: 'Chỉ có chủ phòng mới có quyền kick người chơi.' },
            });
            return;
          }

          const targetPlayerId = msg.payload.playerId;
          if (targetPlayerId === playerId) return; // Cannot kick self

          const targetIndex = this.rule.players.findIndex(p => p.id === targetPlayerId);
          if (targetIndex === -1) return;

          // Send notification and close target WS
          this.sendToPlayer(targetPlayerId, {
            type: 'ROOM_KICKED',
            payload: { message: 'Bạn đã bị chủ phòng mời ra khỏi phòng.' },
          });

          const targetSockets = this.ctx.getWebSockets(targetPlayerId);
          for (const s of targetSockets) {
            try {
              s.close(1000, 'Kicked by host');
            } catch (e) {}
          }

          this.rule.players.splice(targetIndex, 1);

          this.broadcast({
            type: 'ROOM_PLAYER_LEFT',
            payload: { playerId: targetPlayerId },
          });

          const connectedAfterKick = this.rule.players.filter(p => p.isConnected);
          if (this.rule.gamePhase === 'playing' && connectedAfterKick.length <= 1) {
            this.abortMatchDueToInsufficientPlayers();
          } else {
            this.checkStartCountdown();
            this.notifyLobby();
          }
          break;
        }

        case 'ROOM_PLAY_CARDS': {
          if (this.turnTimeoutTimer) {
            clearTimeout(this.turnTimeoutTimer);
            this.turnTimeoutTimer = null;
          }
          const res = this.rule.playCards(playerId, msg.payload.cardIds);
          if (!res.success) {
            this.sendToWs(ws, {
              type: 'ERROR',
              payload: { code: 'INVALID_PLAY', message: res.error || 'Nước đi không hợp lệ' },
            });
            return;
          }

          const player = this.rule.players.find(p => p.id === playerId)!;
          player.selectedCardIndices = [];

          // Broadcast cards played
          this.broadcast({
            type: 'CARDS_PLAYED',
            payload: {
              playerId,
              combination: res.combination!,
              remainingCardCount: player.hand.length,
              nextPlayerId: res.nextPlayerId || undefined,
            },
          });

          if (res.isGameOver) {
            await this.ctx.storage.deleteAlarm();
            // Default ready to true for next game
            for (const p of this.rule.players) {
              p.isReady = true;
              p.selectedCardIndices = [];
            }
            this.broadcast({
              type: 'GAME_OVER',
              payload: {
                winnerId: playerId,
                scoreboard: res.scoreboard || [],
              },
            });
            this.checkStartCountdown();
            this.notifyLobby();
          } else {
            // Set next turn and alarm
            this.setupNextTurnAlarm(res.nextPlayerId!);
          }
          break;
        }

        case 'ROOM_SELECT_CARDS': {
          const player = this.rule.players.find(p => p.id === playerId);
          if (!player) return;
          player.selectedCardIndices = msg.payload.indices;
          this.broadcastExcept(playerId, {
            type: 'ROOM_PLAYER_SELECT_CARDS',
            payload: {
              playerId,
              indices: msg.payload.indices,
            },
          });
          break;
        }

        case 'ROOM_SEND_REACTION': {
          this.broadcast({
            type: 'ROOM_PLAYER_REACTION',
            payload: {
              playerId,
              emoji: msg.payload.emoji,
            },
          });
          break;
        }

        case 'ROOM_PASS': {
          if (this.turnTimeoutTimer) {
            clearTimeout(this.turnTimeoutTimer);
            this.turnTimeoutTimer = null;
          }
          const res = this.rule.passTurn(playerId);
          if (!res.success) {
            this.sendToWs(ws, {
              type: 'ERROR',
              payload: { code: 'INVALID_PASS', message: res.error || 'Không thể bỏ lượt' },
            });
            return;
          }

          if (res.roundReset) {
            this.broadcast({
              type: 'ROUND_RESET',
              payload: {
                winnerId: res.nextPlayerId,
                nextPlayerId: res.nextPlayerId,
              },
            });
          } else {
            this.broadcast({
              type: 'TURN_PASSED',
              payload: {
                playerId,
                nextPlayerId: res.nextPlayerId,
              },
            });
          }

          this.setupNextTurnAlarm(res.nextPlayerId);
          break;
        }

        case 'PING': {
          this.sendToWs(ws, {
            type: 'PONG',
            payload: { timestamp: Date.now() },
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error in RoomDO webSocketMessage:', err);
    }
  }

  public async webSocketClose(ws: WebSocket): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) return;

    const player = this.rule.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
      this.rule.players = this.rule.players.filter(p => p.id !== playerId);

      this.broadcast({
        type: 'ROOM_PLAYER_LEFT',
        payload: { playerId },
      });
    }

    // Check if room empty or only 1 player left
    const connectedPlayers = this.rule.players.filter(p => p.isConnected);
    if (connectedPlayers.length === 0) {
      this.cancelCountdown(false);
      this.notifyLobbyRemove();
    } else {
      if (this.rule.gamePhase === 'playing' && connectedPlayers.length <= 1) {
        this.abortMatchDueToInsufficientPlayers();
      } else {
        this.checkStartCountdown();
        this.notifyLobby();
      }
    }
  }

  /**
   * Cloudflare Durable Objects Alarm handler (Turn Timeout)
   */
  public async alarm(): Promise<void> {
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    if (this.rule.gamePhase !== 'playing' || !this.rule.currentTurnPlayerId) {
      return;
    }

    const currentId = this.rule.currentTurnPlayerId;
    const autoRes = this.rule.autoPlayTimeout(currentId);

    if (autoRes.action === 'play') {
      const player = this.rule.players.find(p => p.id === currentId)!;
      this.broadcast({
        type: 'CARDS_PLAYED',
        payload: {
          playerId: currentId,
          combination: this.rule.tableLastPlay!.combination,
          remainingCardCount: player.hand.length,
          nextPlayerId: autoRes.nextPlayerId || undefined,
        },
      });

      if (autoRes.isGameOver) {
        for (const p of this.rule.players) {
          p.isReady = true;
        }
        this.broadcast({
          type: 'GAME_OVER',
          payload: {
            winnerId: currentId,
            scoreboard: autoRes.scoreboard || [],
          },
        });
        this.checkStartCountdown();
        this.notifyLobby();
        return;
      }
    } else {
      if (autoRes.roundReset) {
        this.broadcast({
          type: 'ROUND_RESET',
          payload: {
            winnerId: autoRes.nextPlayerId,
            nextPlayerId: autoRes.nextPlayerId,
          },
        });
      } else {
        this.broadcast({
          type: 'TURN_PASSED',
          payload: {
            playerId: currentId,
            nextPlayerId: autoRes.nextPlayerId,
          },
        });
      }
    }

    this.setupNextTurnAlarm(autoRes.nextPlayerId);
  }

  private startGame(): void {
    this.cancelCountdown(false);
    const { firstTurnPlayerId } = this.rule.startGame();

    // Reset ready state for all players
    for (const player of this.rule.players) {
      player.isReady = false;
      player.selectedCardIndices = [];
    }

    this.broadcast({
      type: 'GAME_STARTED',
      payload: {
        firstPlayerId: firstTurnPlayerId,
        turnTimeoutMs: this.turnTimeoutMs,
      },
    });

    // Send private cards to each player (ANTI-CHEAT)
    for (const player of this.rule.players) {
      this.sendToPlayer(player.id, {
        type: 'HAND_DEALT',
        payload: { cards: player.hand },
      });
    }

    this.setupNextTurnAlarm(firstTurnPlayerId);
    this.notifyLobby();
  }

  private setupNextTurnAlarm(nextPlayerId: string): void {
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }

    this.turnEndTime = Date.now() + this.turnTimeoutMs;
    try {
      this.ctx.storage.setAlarm(this.turnEndTime);
    } catch (e) {}

    // Reliable fallback in-memory timer ensuring timeout executes in all environments (including local wrangler dev)
    this.turnTimeoutTimer = setTimeout(() => {
      this.turnTimeoutTimer = null;
      this.alarm().catch(err => console.error('Turn timeout error:', err));
    }, this.turnTimeoutMs);

    const nextPlayer = this.rule.players.find(p => p.id === nextPlayerId);
    if (!nextPlayer) return;

    this.broadcast({
      type: 'TURN_START',
      payload: {
        playerId: nextPlayerId,
        seatIndex: nextPlayer.seatIndex,
        timeoutMs: this.turnTimeoutMs,
        isFreeTurn: this.rule.tableLastPlay === null,
      },
    });
  }

  private buildSnapshot(playerId: string): RoomFullSnapshot {
    const player = this.rule.players.find(p => p.id === playerId);
    const myCards: Card[] = player ? player.hand : [];

    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      roomName: this.roomName,
      phase: this.rule.gamePhase,
      players: this.rule.getPublicPlayers(),
      myCards,
      currentTurn: this.rule.currentTurnPlayerId
        ? {
            playerId: this.rule.currentTurnPlayerId,
            seatIndex: this.rule.players.find(p => p.id === this.rule.currentTurnPlayerId)?.seatIndex ?? 0,
            timeoutMs: Math.max(0, this.turnEndTime - Date.now()),
            startTime: Date.now(),
            isFreeTurn: this.rule.tableLastPlay === null,
          }
        : null,
      table: {
        lastPlay: this.rule.tableLastPlay,
        roundPlayerPassedIds: Array.from(this.rule.roundPlayerPassedIds),
      },
      firstTurn3SpadeRequired: this.rule.firstTurn3SpadeRequired,
      firstTurnRequiredCardId: this.rule.firstTurnRequiredCardId,
      firstTurnRequiredCardName: this.rule.firstTurnRequiredCardName,
    };
  }

  private sendToPlayer(playerId: string, msg: ServerMessage): void {
    const sockets = this.ctx.getWebSockets(playerId);
    const serialized = JSON.stringify(msg);
    for (const ws of sockets) {
      try {
        ws.send(serialized);
      } catch (err) {
        // Ignored
      }
    }
  }

  private sendToWs(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error('Failed to send to WebSocket:', err);
    }
  }

  private broadcast(msg: ServerMessage): void {
    const sockets = this.ctx.getWebSockets();
    const serialized = JSON.stringify(msg);
    for (const ws of sockets) {
      try {
        ws.send(serialized);
      } catch (err) {
        // Ignored
      }
    }
  }

  private broadcastExcept(excludedPlayerId: string, msg: ServerMessage): void {
    const sockets = this.ctx.getWebSockets();
    const serialized = JSON.stringify(msg);
    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      if (tags[0] === excludedPlayerId) continue;
      try {
        ws.send(serialized);
      } catch (err) {
        // Ignored
      }
    }
  }

  private async notifyLobby(): Promise<void> {
    try {
      const summary: RoomSummary = {
        id: this.roomId,
        code: this.roomCode,
        name: this.roomName,
        playerCount: this.rule.players.length,
        maxPlayers: 4,
        phase: this.rule.gamePhase,
      };

      const lobbyId = this.env.LOBBY.idFromName('global-lobby');
      const lobby = this.env.LOBBY.get(lobbyId);
      await lobby.fetch('http://internal/update-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary),
      });
    } catch (err) {
      // Ignored
    }
  }

  private async notifyLobbyRemove(): Promise<void> {
    try {
      const lobbyId = this.env.LOBBY.idFromName('global-lobby');
      const lobby = this.env.LOBBY.get(lobbyId);
      await lobby.fetch('http://internal/remove-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: this.roomId }),
      });
    } catch (err) {
      // Ignored
    }
  }

  private checkStartCountdown(): void {
    if (this.rule.gamePhase !== 'waiting' && this.rule.gamePhase !== 'game_over') {
      this.cancelCountdown(false);
      return;
    }
    const connectedPlayers = this.rule.players.filter(p => p.isConnected);
    if (connectedPlayers.length >= 2 && connectedPlayers.every(p => p.isReady)) {
      if (this.countdownTimer) return; // already running countdown
      this.countdownSeconds = 5;
      this.broadcast({
        type: 'COUNTDOWN_START',
        payload: { seconds: this.countdownSeconds },
      });

      this.countdownTimer = setInterval(() => {
        this.countdownSeconds--;
        if (this.countdownSeconds > 0) {
          this.broadcast({
            type: 'COUNTDOWN_TICK',
            payload: { secondsRemaining: this.countdownSeconds },
          });
        } else {
          this.cancelCountdown(false);
          const current = this.rule.players.filter(p => p.isConnected);
          if (current.length >= 2 && current.every(p => p.isReady)) {
            this.startGame();
          }
        }
      }, 1000);
    } else {
      this.cancelCountdown(true);
    }
  }

  private cancelCountdown(notify: boolean = true): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.countdownSeconds = 0;
      if (notify) {
        this.broadcast({
          type: 'COUNTDOWN_CANCEL',
          payload: {},
        });
      }
    }
  }

  /**
   * Automatically ends match and resets to initial waiting room when only 1 player remains.
   */
  private abortMatchDueToInsufficientPlayers(): void {
    if (this.turnTimeoutTimer) {
      clearTimeout(this.turnTimeoutTimer);
      this.turnTimeoutTimer = null;
    }
    try {
      this.ctx.storage.deleteAlarm();
    } catch (e) {}
    this.cancelCountdown(false);

    this.rule.gamePhase = 'waiting';
    this.rule.tableLastPlay = null;
    this.rule.roundPlayerPassedIds.clear();
    this.rule.currentTurnPlayerId = null;
    this.rule.firstTurn3SpadeRequired = false;
    this.rule.firstTurnRequiredCardId = null;
    this.rule.firstTurnRequiredCardName = null;

    // Reset remaining player(s) state
    for (const player of this.rule.players) {
      player.hand = [];
      player.hasPassed = false;
      player.isReady = true;
      player.selectedCardIndices = [];
      player.playedCardsCount = 0;
    }

    for (const player of this.rule.players) {
      const snapshot = this.buildSnapshot(player.id);
      this.sendToPlayer(player.id, {
        type: 'MATCH_ABORTED',
        payload: {
          reason: 'Tất cả người chơi khác đã rời bàn. Trận đấu tự động kết thúc, trở về phòng chờ ban đầu.',
          snapshot,
        },
      });
    }

    this.notifyLobby();
  }
}
