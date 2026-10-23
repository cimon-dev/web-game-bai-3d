import { ClientMessage, RoomSummary, ServerMessage } from '@game/shared';

export interface Env {
  LOBBY: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
}

export class LobbyDO implements DurableObject {
  private ctx: DurableObjectState;
  private env: Env;
  private rooms: Map<string, RoomSummary> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Cloudflare WebSocket Hibernation API
      this.ctx.acceptWebSocket(server);

      // Send initial room list immediately
      this.sendToWs(server, {
        type: 'LOBBY_ROOM_LIST',
        payload: { rooms: this.getRoomList() },
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP: Update or register room from RoomDO
    if (url.pathname === '/update-room' && request.method === 'POST') {
      const summary: RoomSummary = await request.json();
      this.rooms.set(summary.id, summary);
      this.broadcastRoomList();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // HTTP: Remove closed room
    if (url.pathname === '/remove-room' && request.method === 'POST') {
      const { roomId } = await request.json() as { roomId: string };
      this.rooms.delete(roomId);
      this.broadcastRoomList();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // HTTP: Get rooms list
    if (url.pathname === '/rooms' && request.method === 'GET') {
      return new Response(JSON.stringify({ rooms: this.getRoomList() }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  public async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    try {
      const msg: ClientMessage = JSON.parse(message);

      switch (msg.type) {
        case 'LOBBY_GET_ROOMS': {
          this.sendToWs(ws, {
            type: 'LOBBY_ROOM_LIST',
            payload: { rooms: this.getRoomList() },
          });
          break;
        }

        case 'LOBBY_CREATE_ROOM': {
          const { roomName } = msg.payload;
          // Generate unified 6-character room code & roomId
          const roomCode = this.generateUniqueCode();
          const roomId = roomCode;

          const summary: RoomSummary = {
            id: roomId,
            code: roomCode,
            name: roomName || `Bàn chơi ${roomCode}`,
            playerCount: 0,
            maxPlayers: 4,
            phase: 'waiting',
          };

          this.rooms.set(roomId, summary);

          this.sendToWs(ws, {
            type: 'LOBBY_ROOM_CREATED',
            payload: { roomId, roomCode },
          });

          this.broadcastRoomList();
          break;
        }

        case 'LOBBY_QUICK_JOIN': {
          // Find waiting room with available seats
          let targetRoom: RoomSummary | undefined;
          for (const room of this.rooms.values()) {
            if (room.phase === 'waiting' && room.playerCount < room.maxPlayers) {
              targetRoom = room;
              break;
            }
          }

          if (targetRoom) {
            this.sendToWs(ws, {
              type: 'LOBBY_QUICK_JOIN_RESULT',
              payload: { roomId: targetRoom.id, success: true },
            });
          } else {
            // Automatically create a new room
            const roomCode = this.generateUniqueCode();
            const roomId = roomCode;

            const summary: RoomSummary = {
              id: roomId,
              code: roomCode,
              name: `Bàn nhanh ${roomCode}`,
              playerCount: 0,
              maxPlayers: 4,
              phase: 'waiting',
            };

            this.rooms.set(roomId, summary);
            this.broadcastRoomList();

            this.sendToWs(ws, {
              type: 'LOBBY_QUICK_JOIN_RESULT',
              payload: { roomId, success: true },
            });
          }
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
      console.error('Error in Lobby webSocketMessage:', err);
    }
  }

  public async webSocketClose(ws: WebSocket): Promise<void> {
    // Handled automatically by hibernation
  }

  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars 0, O, 1, I
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private getRoomList(): RoomSummary[] {
    return Array.from(this.rooms.values());
  }

  private broadcastRoomList(): void {
    const sockets = this.ctx.getWebSockets();
    const packet: ServerMessage = {
      type: 'LOBBY_ROOM_LIST',
      payload: { rooms: this.getRoomList() },
    };
    const serialized = JSON.stringify(packet);

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
}
