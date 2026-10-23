import { AvatarCustomization, ClientMessage, ServerMessage } from '@game/shared';

export type MessageHandler = (msg: ServerMessage) => void;

export class NetworkClient {
  private static instance: NetworkClient;
  private ws: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();

  public currentRoomId: string | null = null;
  public playerId: string = '';
  public playerName: string = '';
  public avatar: AvatarCustomization;

  private pingIntervalId: number | null = null;

  private constructor() {
    this.playerId = localStorage.getItem('game_player_id') || `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('game_player_id', this.playerId);

    this.playerName = localStorage.getItem('game_player_name') || `Người chơi ${this.playerId.slice(-4)}`;

    const savedAvatar = localStorage.getItem('game_avatar_custom');
    if (savedAvatar) {
      try {
        this.avatar = JSON.parse(savedAvatar);
      } catch (e) {
        this.avatar = {
          gender: 'male',
          hairStyle: 'cap',
          hairColor: '#451a03',
          shirtColor: '#2563eb',
          pantsColor: '#1e293b',
          skinColor: '#fed7aa',
          accessory: 'none',
        };
      }
    } else {
      this.avatar = {
        gender: 'male',
        hairStyle: 'cap',
        hairColor: '#451a03',
        shirtColor: '#2563eb',
        pantsColor: '#1e293b',
        skinColor: '#fed7aa',
        accessory: 'none',
      };
    }
  }

  public static getInstance(): NetworkClient {
    if (!NetworkClient.instance) {
      NetworkClient.instance = new NetworkClient();
    }
    return NetworkClient.instance;
  }

  public setPlayerName(name: string): void {
    this.playerName = name.trim() || 'Người chơi';
    localStorage.setItem('game_player_name', this.playerName);
  }

  public setAvatar(avatar: AvatarCustomization): void {
    this.avatar = avatar;
    localStorage.setItem('game_avatar_custom', JSON.stringify(avatar));
  }

  private getWsUrl(path: string): string {
    // 1. Check if explicit backend URL configured via environment (e.g. Vercel deployment)
    const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WS_BACKEND_URL;
    if (envUrl) {
      const cleanBase = envUrl.replace(/\/+$/, '');
      return `${cleanBase}${path}`;
    }

    // 2. Default local detection
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running with Vite dev server (port 3000), connect to port 8787 for Cloudflare Worker
    const host = loc.port === '3000' ? `${loc.hostname}:8787` : loc.host;
    return `${protocol}//${host}${path}`;
  }

  public connectLobby(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.close();

      const url = this.getWsUrl('/ws/lobby');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('Lobby WS connection error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.stopPing();
      };
    });
  }

  public connectRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.close();
      this.currentRoomId = roomId;

      const params = new URLSearchParams({
        playerId: this.playerId,
        playerName: this.playerName,
        roomId,
        avatar: JSON.stringify(this.avatar),
      });

      const url = this.getWsUrl(`/ws/room/${roomId}?${params.toString()}`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error('Room WS connection error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.stopPing();
      };
    });
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('Cannot send message, WebSocket is not open:', msg);
    }
  }

  public addListener(handler: MessageHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private handleMessage(data: string): void {
    try {
      const msg: ServerMessage = JSON.parse(data);
      for (const listener of this.listeners) {
        listener(msg);
      }
    } catch (err) {
      console.error('Failed to parse server message:', err);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingIntervalId = window.setInterval(() => {
      this.send({ type: 'PING', payload: { timestamp: Date.now() } });
    }, 15000);
  }

  private stopPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public close(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
