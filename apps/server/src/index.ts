import { LobbyDO } from './lobby/LobbyDO';
import { RoomDO } from './room/RoomDO';

export { LobbyDO, RoomDO };

export interface Env {
  LOBBY: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
        },
      });
    }

    // Lobby WebSocket / API
    if (url.pathname === '/ws/lobby' || url.pathname === '/api/lobby/ws') {
      const lobbyId = env.LOBBY.idFromName('global-lobby');
      const lobby = env.LOBBY.get(lobbyId);
      return lobby.fetch(request);
    }

    if (url.pathname === '/api/rooms') {
      const lobbyId = env.LOBBY.idFromName('global-lobby');
      const lobby = env.LOBBY.get(lobbyId);
      return lobby.fetch(new Request('http://internal/rooms'));
    }

    // Room WebSocket: /ws/room/:roomId or /api/room/:roomId/ws
    const roomMatch = url.pathname.match(/^\/(?:ws|api)\/room\/([^/]+)(?:\/ws)?$/);
    if (roomMatch) {
      const roomId = roomMatch[1];
      const roomDOId = env.ROOMS.idFromName(roomId);
      const room = env.ROOMS.get(roomDOId);
      return room.fetch(request);
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: '3D Web Card Game Server (Tien Len)',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response('Not Found', {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};
