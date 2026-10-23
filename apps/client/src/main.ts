import {
  Card,
  CardCombination,
  Combinations,
  Compare,
  RoomFullSnapshot,
  ServerMessage,
  sortCards,
} from '@game/shared';
import { SoundEffects } from './audio/SoundEffects';
import { FPSCamera } from './game3d/camera/FPSCamera';
import { HandManager } from './game3d/cards/HandManager';
import { AvatarManager } from './game3d/avatars/AvatarManager';
import { GameScene } from './game3d/scene/GameScene';
import { NetworkClient } from './network/NetworkClient';
import { UIManager } from './ui/UIManager';

class App {
  private canvas: HTMLCanvasElement;
  private gameScene: GameScene;
  private fpsCamera: FPSCamera;
  private handManager: HandManager;
  private avatarManager: AvatarManager;
  private uiManager: UIManager;
  private network: NetworkClient;
  private sfx: SoundEffects;

  // Local game state
  private myCards: Card[] = [];
  private currentSnapshot: RoomFullSnapshot | null = null;
  private isMyTurn: boolean = false;
  private isFreeTurn: boolean = true;
  private currentTableCombination: CardCombination | null = null;
  private firstTurn3SpadeRequired: boolean = false;
  private firstTurnRequiredCardId: string | null = null;
  private firstTurnRequiredCardName: string | null = null;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.gameScene = new GameScene(this.canvas);
    this.fpsCamera = new FPSCamera(window.innerWidth, window.innerHeight);
    this.handManager = new HandManager(this.gameScene.scene, this.fpsCamera.camera);
    this.avatarManager = new AvatarManager(this.gameScene.scene, this.fpsCamera.camera);
    this.uiManager = new UIManager('ui-root');
    this.network = NetworkClient.getInstance();
    this.sfx = SoundEffects.getInstance();

    this.initEvents();
    this.initNetwork();
    this.startRenderLoop();

    // Show initial Welcome screen
    this.showWelcomeScreen();
  }

  private initEvents(): void {
    const onWindowResize = () => {
      const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      this.gameScene.handleResize(w, h);
      this.fpsCamera.handleResize(w, h);
      this.handManager.updateLayout(true);
    };

    window.addEventListener('resize', onWindowResize);
    window.visualViewport?.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(onWindowResize, 100);
      setTimeout(onWindowResize, 350);
      setTimeout(onWindowResize, 700);
    });

    // When card selection in 3D hand changes, dynamically validate combo and sync to opponent
    this.handManager.onSelectionChanged = (selectedIds) => {
      this.updateActionButtonsState(selectedIds);

      // Real-time broadcast card selection indices to opponent avatar
      const indices = this.myCards
        .map((c, idx) => (selectedIds.includes(c.id) ? idx : -1))
        .filter(idx => idx !== -1);

      this.network.send({
        type: 'ROOM_SELECT_CARDS',
        payload: { indices },
      });
    };

    // Provide current table combination for smart auto-predict selection
    this.handManager.getTargetCombination = () => {
      return !this.isFreeTurn ? this.currentTableCombination : null;
    };

    // User gesture listener to unlock Web Audio
    const unlockAudio = () => {
      this.sfx.resume();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
  }

  private initNetwork(): void {
    this.network.addListener((msg: ServerMessage) => {
      this.handleServerMessage(msg);
    });
  }

  private showWelcomeScreen(): void {
    // Check URL query param ?room=CODE for instant invite link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');

    this.uiManager.showWelcome(this.network.playerName, {
      onNameChange: (name) => {
        this.network.setPlayerName(name);
      },
      onAvatarChanged: (avatar) => {
        this.network.setAvatar(avatar);
      },
      onQuickJoin: () => {
        this.network.send({
          type: 'LOBBY_QUICK_JOIN',
          payload: { playerName: this.network.playerName },
        });
      },
      onJoinByCode: (code) => {
        this.joinRoom(code);
      },
      onCreateRoom: (name) => {
        this.network.send({
          type: 'LOBBY_CREATE_ROOM',
          payload: { roomName: name, playerName: this.network.playerName },
        });
      },
      onJoinRoomId: (roomId) => {
        this.joinRoom(roomId);
      },
    });

    // Connect to Lobby WebSocket
    this.network.connectLobby()
      .then(() => {
        if (roomParam) {
          this.joinRoom(roomParam.trim().toUpperCase());
        }
      })
      .catch((err) => {
        console.warn('Lobby WS offline or connection pending:', err);
      });
  }

  private async joinRoom(roomId: string): Promise<void> {
    try {
      await this.network.connectRoom(roomId);
    } catch (err) {
      this.uiManager.showToast('Không thể kết nối vào bàn chơi.', 'error');
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'LOBBY_ROOM_LIST': {
        this.uiManager.updateRooms(msg.payload.rooms, (id) => this.joinRoom(id));
        break;
      }

      case 'LOBBY_ROOM_CREATED': {
        this.joinRoom(msg.payload.roomId);
        break;
      }

      case 'LOBBY_QUICK_JOIN_RESULT': {
        if (msg.payload.roomId) {
          this.joinRoom(msg.payload.roomId);
        } else {
          this.uiManager.showToast(msg.payload.message || 'Không tìm thấy phòng phù hợp.', 'error');
        }
        break;
      }

      case 'ROOM_JOINED': {
        const { snapshot, roomCode, roomId } = msg.payload;
        this.currentSnapshot = snapshot;
        this.myCards = snapshot.myCards;
        this.firstTurn3SpadeRequired = snapshot.firstTurn3SpadeRequired;
        this.firstTurnRequiredCardId = snapshot.firstTurnRequiredCardId || (snapshot.firstTurn3SpadeRequired ? '3_spade' : null);
        this.firstTurnRequiredCardName = snapshot.firstTurnRequiredCardName || (snapshot.firstTurn3SpadeRequired ? '3 Bích (3♠)' : null);

        this.uiManager.showGameHUD(snapshot.roomName, roomCode, {
          onPlayCards: () => this.handlePlaySelectedCards(),
          onPassTurn: () => {
            this.network.send({ type: 'ROOM_PASS', payload: {} });
          },
          onSortCards: () => {
            this.myCards = sortCards(this.myCards);
            this.handManager.setPlayerCards(this.myCards, true);
          },
          onDeselectCards: () => {
            this.handManager.clearSelection();
          },
          onReadyToggle: (ready) => {
            this.network.send({ type: 'ROOM_READY', payload: { ready } });
          },
          onHostStartGame: () => {
            this.network.send({ type: 'ROOM_START_GAME', payload: {} });
          },
          onLeaveRoom: () => {
            this.network.close();
            this.handManager.clearAll();
            this.avatarManager.clear();
            this.myCards = [];
            this.currentSnapshot = null;
            this.currentTableCombination = null;
            this.uiManager.stopTimer();
            this.uiManager.hideCountdown();
            this.showWelcomeScreen();
          },
          onKickPlayer: (targetId) => {
            this.network.send({ type: 'ROOM_KICK_PLAYER', payload: { playerId: targetId } });
          },
          onSendReaction: (emoji) => {
            this.network.send({ type: 'ROOM_SEND_REACTION', payload: { emoji } });
            this.uiManager.showReactionAt(this.network.playerId, emoji, () => ({ top: '75%', left: '50%' }));
          },
        });

        this.uiManager.setGamePhase(snapshot.phase === 'playing' ? 'playing' : 'waiting');
        this.handManager.setPlayerCards(this.myCards, false);
        this.updateOpponentsUI();

        // Handle reconnect / active game state restoration
        if (snapshot.table?.lastPlay) {
          this.currentTableCombination = snapshot.table.lastPlay.combination;
          this.handManager.showPlayedCards(snapshot.table.lastPlay.combination.cards, false);
        } else {
          this.currentTableCombination = null;
        }

        if (snapshot.currentTurn) {
          this.isMyTurn = snapshot.currentTurn.playerId === this.network.playerId;
          this.isFreeTurn = snapshot.currentTurn.isFreeTurn;
          this.uiManager.startTimer(Math.ceil(snapshot.currentTurn.timeoutMs / 1000));
          if (snapshot.phase === 'playing') {
            const currentTurnPlayer = snapshot.players.find(p => p.id === snapshot.currentTurn?.playerId);
            const turnPlayerName = this.isMyTurn ? 'Bạn' : (currentTurnPlayer?.name || 'Đối thủ');
            this.uiManager.updateTurnIndicator(this.isMyTurn, turnPlayerName, true);
          }
          if (this.isMyTurn) {
            this.uiManager.showToast('Đến lượt bạn đánh!', 'success');
          }
        }

        this.updateHostControls();
        this.uiManager.showToast(`Đã tham gia ${snapshot.roomName}`, 'success');
        break;
      }

      case 'ROOM_PLAYER_JOINED': {
        if (this.currentSnapshot) {
          const exists = this.currentSnapshot.players.some(p => p.id === msg.payload.player.id);
          if (!exists) {
            this.currentSnapshot.players.push(msg.payload.player);
          }
          this.updateOpponentsUI();
          this.updateHostControls();
          this.uiManager.showToast(`${msg.payload.player.name} đã vào bàn.`);
        }
        break;
      }

      case 'ROOM_PLAYER_LEFT': {
        if (this.currentSnapshot) {
          const leftPlayerId = msg.payload.playerId;
          this.currentSnapshot.players = this.currentSnapshot.players.filter(p => p.id !== leftPlayerId);
          this.avatarManager.removeAvatar(leftPlayerId);
          this.updateOpponentsUI();
          this.updateHostControls();
          this.uiManager.showToast('Một người chơi đã rời bàn.');

          // If in playing phase and only 1 player remains -> auto reset to waiting room
          if (this.currentSnapshot.phase === 'playing' && this.currentSnapshot.players.length <= 1) {
            this.resetToWaitingRoom('Tất cả người chơi khác đã rời bàn. Trận đấu kết thúc, trở về phòng chờ.');
          }
        }
        break;
      }

      case 'ROOM_PLAYER_READY': {
        if (this.currentSnapshot) {
          const p = this.currentSnapshot.players.find(pl => pl.id === msg.payload.playerId);
          if (p) {
            p.isReady = msg.payload.isReady;
            this.updateOpponentsUI();
            this.updateHostControls();
          }
        }
        break;
      }

      case 'ROOM_PLAYER_SELECT_CARDS': {
        const avatar = this.avatarManager.getAvatar(msg.payload.playerId);
        if (avatar) {
          avatar.setSelectedCardIndices(msg.payload.indices);
        }
        break;
      }

      case 'ROOM_PLAYER_REACTION': {
        if (msg.payload.playerId !== this.network.playerId) {
          this.uiManager.showReactionAt(
            msg.payload.playerId,
            msg.payload.emoji,
            (id) => this.avatarManager.getHeadScreenPosition(id)
          );
        }
        break;
      }

      case 'ROOM_KICKED': {
        this.uiManager.showToast(msg.payload.message || 'Bạn đã bị chủ phòng mời ra khỏi phòng.', 'error');
        this.network.close();
        this.handManager.clearAll();
        this.avatarManager.clear();
        this.myCards = [];
        this.currentSnapshot = null;
        this.currentTableCombination = null;
        this.uiManager.stopTimer();
        this.uiManager.hideCountdown();
        this.showWelcomeScreen();
        break;
      }

      case 'COUNTDOWN_START': {
        this.uiManager.hideScoreboardModal();
        this.uiManager.showCountdown(msg.payload.seconds);
        break;
      }

      case 'COUNTDOWN_TICK': {
        this.uiManager.hideScoreboardModal();
        this.uiManager.updateCountdown(msg.payload.secondsRemaining);
        break;
      }

      case 'COUNTDOWN_CANCEL': {
        this.uiManager.hideCountdown();
        this.updateHostControls();
        this.uiManager.showToast('Đã dừng đếm ngược vì có người chơi đổi sang Chờ.');
        break;
      }

      case 'GAME_STARTED': {
        this.uiManager.hideScoreboardModal();
        this.uiManager.hideCountdown();
        this.uiManager.setGamePhase('playing');
        this.uiManager.showToast('Ván đấu bắt đầu!', 'success');
        this.sfx.playCardDeal();
        this.currentTableCombination = null;
        this.handManager.clearAllTableCards();

        if (this.currentSnapshot) {
          this.currentSnapshot.phase = 'playing';
          for (const p of this.currentSnapshot.players) {
            p.cardCount = 13;
            p.hasPassed = false;
          }
          this.updateOpponentsUI();
        }
        break;
      }

      case 'HAND_DEALT': {
        this.myCards = msg.payload.cards;
        this.handManager.setPlayerCards(this.myCards, true);
        this.sfx.playCardDeal();
        break;
      }

      case 'TURN_START': {
        const { playerId, timeoutMs, isFreeTurn } = msg.payload;
        this.applyTurnUpdate(playerId, isFreeTurn);
        this.uiManager.startTimer(Math.ceil(timeoutMs / 1000));

        if (this.isMyTurn) {
          this.uiManager.showToast('Đến lượt bạn đánh!', 'success');
        }
        break;
      }

      case 'CARDS_PLAYED': {
        const { playerId, combination, remainingCardCount, nextPlayerId } = msg.payload;
        const isMe = playerId === this.network.playerId;
        this.currentTableCombination = combination;
        this.firstTurn3SpadeRequired = false;
        this.firstTurnRequiredCardId = null;
        this.firstTurnRequiredCardName = null;

        let playerSeat = 0;
        if (this.currentSnapshot) {
          const p = this.currentSnapshot.players.find(pl => pl.id === playerId);
          if (p) playerSeat = p.seatIndex;
        }

        if (isMe) {
          // Remove from local cards
          const playedIds = new Set(combination.cards.map(c => c.id));
          this.myCards = this.myCards.filter(c => !playedIds.has(c.id));
          this.handManager.setPlayerCards(this.myCards, false);
        } else {
          // Trigger avatar arm swing & clear selected card indices
          const avatar = this.avatarManager.getAvatar(playerId);
          if (avatar) {
            avatar.playCardAnimation();
            avatar.setSelectedCardIndices([]);
          }

          // Update opponent card count
          if (this.currentSnapshot) {
            const opponent = this.currentSnapshot.players.find(p => p.id === playerId);
            if (opponent) {
              opponent.cardCount = remainingCardCount;
              this.updateOpponentsUI();
            }
          }
        }

        // Show cards in center table (active trick + discard pile accumulation)
        this.handManager.showPlayedCards(combination.cards, isMe, playerSeat);

        if (nextPlayerId) {
          this.applyTurnUpdate(nextPlayerId, false);
        }
        break;
      }

      case 'TURN_PASSED': {
        const { playerId, nextPlayerId } = msg.payload;
        this.avatarManager.getAvatar(playerId)?.passAnimation();

        if (this.currentSnapshot) {
          const p = this.currentSnapshot.players.find(pl => pl.id === playerId);
          if (p) {
            p.hasPassed = true;
            this.updateOpponentsUI();
            this.uiManager.showToast(`${p.name} đã bỏ lượt.`);
          }
        }

        if (nextPlayerId) {
          this.applyTurnUpdate(nextPlayerId);
        }
        break;
      }

      case 'ROUND_RESET': {
        const { nextPlayerId } = msg.payload;
        this.currentTableCombination = null;
        this.isFreeTurn = true;
        this.handManager.onRoundReset();
        if (this.currentSnapshot) {
          for (const p of this.currentSnapshot.players) {
            p.hasPassed = false;
          }
          this.updateOpponentsUI();
        }
        this.uiManager.showToast('Bắt đầu vòng chơi mới!', 'info');

        if (nextPlayerId) {
          this.applyTurnUpdate(nextPlayerId, true);
        }
        break;
      }

      case 'GAME_OVER': {
        this.uiManager.stopTimer();
        this.uiManager.setGamePhase('finished');
        if (this.currentSnapshot) {
          this.currentSnapshot.phase = 'game_over';
        }
        this.updateHostControls();
        const { winnerId, scoreboard } = msg.payload;
        this.uiManager.showScoreboardModal(
          winnerId,
          this.network.playerId,
          scoreboard,
          () => {
            // Sẵn sàng ván mới
            this.network.send({ type: 'ROOM_READY', payload: { ready: true } });
          },
          () => {
            // Rời bàn về sảnh
            this.network.close();
            this.handManager.clearAll();
            this.avatarManager.clear();
            this.myCards = [];
            this.currentSnapshot = null;
            this.currentTableCombination = null;
            this.uiManager.stopTimer();
            this.uiManager.hideCountdown();
            this.showWelcomeScreen();
          }
        );
        break;
      }

      case 'MATCH_ABORTED': {
        this.resetToWaitingRoom(msg.payload.reason, msg.payload.snapshot);
        break;
      }

      case 'ERROR': {
        this.uiManager.showToast(msg.payload.message, 'error');
        break;
      }
    }
  }

  private handlePlaySelectedCards(): void {
    if (!this.isMyTurn) {
      return;
    }

    let selectedIds = Array.from(this.handManager.selectedCards);
    if (selectedIds.length === 0) {
      // Auto-play smallest valid card if no cards manually selected
      const smallest = Compare.findSmallestPlayable(
        this.myCards,
        this.currentTableCombination,
        this.firstTurnRequiredCardId || this.firstTurn3SpadeRequired
      );
      if (!smallest || smallest.length === 0) {
        this.uiManager.showToast('Không có quân bài nào đè được bài trên bàn!', 'error');
        return;
      }
      selectedIds = smallest.map(c => c.id);
    } else {
      // Validate manually selected cards when player clicks "Đánh Bài"
      const selectedCards = this.myCards.filter(c => selectedIds.includes(c.id));
      const combo = Combinations.detect(selectedCards);

      if (!combo) {
        this.uiManager.showToast('Tổ hợp bài không hợp lệ!', 'error');
        return;
      }

      if (this.firstTurnRequiredCardId) {
        const hasReq = selectedCards.some(c => c.id === this.firstTurnRequiredCardId);
        if (!hasReq) {
          const cardName = this.firstTurnRequiredCardName || 'quân bài nhỏ nhất';
          this.uiManager.showToast(`Lượt đầu tiên bắt buộc phải chứa ${cardName}!`, 'error');
          return;
        }
      } else if (this.firstTurn3SpadeRequired) {
        const has3Spade = selectedCards.some(c => c.id === '3_spade');
        if (!has3Spade) {
          this.uiManager.showToast('Lượt đầu tiên bắt buộc phải chứa 3 Bích (3♠)!', 'error');
          return;
        }
      }

      if (this.currentTableCombination) {
        const canBeat = Compare.canBeat(combo, this.currentTableCombination);
        if (!canBeat) {
          const comboName = Combinations.getCombinationNameVi(combo);
          this.uiManager.showToast(`${comboName} không đè được bài trên bàn!`, 'error');
          return;
        }
      }
    }

    this.network.send({
      type: 'ROOM_PLAY_CARDS',
      payload: { cardIds: selectedIds },
    });
  }

  private updateActionButtonsState(selectedIds: string[]): void {
    const canPass = !this.isFreeTurn;
    this.uiManager.setDeselectVisible(selectedIds.length > 0);
    // When it's player's turn, keep play button clickable so invalid plays trigger the centered notification
    this.uiManager.setTurnControls(this.isMyTurn, canPass, this.isMyTurn);
  }

  private resetToWaitingRoom(reason?: string, newSnapshot?: any): void {
    this.uiManager.stopTimer();
    this.uiManager.hideCountdown();
    this.uiManager.hideScoreboardModal();

    this.currentTableCombination = null;
    this.myCards = [];
    this.isMyTurn = false;
    this.firstTurn3SpadeRequired = false;
    this.firstTurnRequiredCardId = null;
    this.firstTurnRequiredCardName = null;
    this.isFreeTurn = true;

    // Clear all 3D cards from player hand and center table
    this.handManager.clearAll();

    if (newSnapshot) {
      this.currentSnapshot = newSnapshot;
    } else if (this.currentSnapshot) {
      this.currentSnapshot.phase = 'waiting';
      this.currentSnapshot.currentTurn = null;
      this.currentSnapshot.table = { lastPlay: null, roundPlayerPassedIds: [] };
      for (const p of this.currentSnapshot.players) {
        p.cardCount = 0;
        p.hasPassed = false;
        p.isTurn = false;
        p.isReady = true;
      }
    }

    this.uiManager.setGamePhase('waiting');
    this.uiManager.updateComboHint(null, false);
    this.uiManager.setTurnControls(false, false, false);
    this.updateOpponentsUI();
    this.updateHostControls();

    if (reason) {
      this.uiManager.showToast(reason, 'info');
    }
  }

  private applyTurnUpdate(nextPlayerId: string, isFree?: boolean): void {
    this.isMyTurn = nextPlayerId === this.network.playerId;
    if (typeof isFree === 'boolean') {
      this.isFreeTurn = isFree;
    }

    if (this.currentSnapshot) {
      for (const p of this.currentSnapshot.players) {
        p.isTurn = p.id === nextPlayerId;
      }
      this.updateOpponentsUI();
    }

    const currentTurnPlayer = this.currentSnapshot?.players.find(p => p.id === nextPlayerId);
    const turnPlayerName = this.isMyTurn ? 'Bạn' : (currentTurnPlayer?.name || 'Đối thủ');
    this.uiManager.updateTurnIndicator(this.isMyTurn, turnPlayerName, true);
    this.updateActionButtonsState(Array.from(this.handManager.selectedCards));
  }

  private updateHostControls(): void {
    if (!this.currentSnapshot) return;
    const myPlayer = this.currentSnapshot.players.find(p => p.id === this.network.playerId);
    const isHost = Boolean(
      (this.currentSnapshot.players.length > 0 && this.currentSnapshot.players[0].id === this.network.playerId) ||
      (myPlayer && myPlayer.seatIndex === 0)
    );
    const canStart = this.currentSnapshot.players.length >= 2;
    const isWaiting = this.currentSnapshot.phase !== 'playing';
    this.uiManager.setHostControls(Boolean(isHost && isWaiting), canStart);
  }

  private updateOpponentsUI(): void {
    if (!this.currentSnapshot) return;
    const myPlayer = this.currentSnapshot.players.find(p => p.id === this.network.playerId);
    const isHost = Boolean(
      (this.currentSnapshot.players.length > 0 && this.currentSnapshot.players[0].id === this.network.playerId) ||
      (myPlayer && myPlayer.seatIndex === 0)
    );
    const isPlaying = this.currentSnapshot.phase === 'playing';

    // Update 3D cartoon avatars around the table
    this.avatarManager.updatePlayers(this.currentSnapshot.players, this.network.playerId);

    // Update 2D floating nameplates with head projection + host kick capability
    this.uiManager.updateOpponentPlates(
      this.currentSnapshot.players,
      this.network.playerId,
      (playerId) => this.avatarManager.getHeadScreenPosition(playerId),
      Boolean(isHost),
      isPlaying
    );
  }

  private startRenderLoop(): void {
    const render = () => {
      requestAnimationFrame(render);
      this.fpsCamera.update();
      this.gameScene.renderer.render(this.gameScene.scene, this.fpsCamera.camera);

      // Dynamically lock 2D nameplates above 3D avatars' heads as camera moves
      if (this.currentSnapshot) {
        this.uiManager.updatePlatePositions((playerId) => this.avatarManager.getHeadScreenPosition(playerId));
      }
    };
    render();
  }
}

// Start application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
