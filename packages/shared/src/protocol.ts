import { Card } from './cards';
import {
  AvatarCustomization,
  CardCombination,
  PlayerPublicInfo,
  RoomFullSnapshot,
  RoomSummary,
  ScoreboardEntry,
} from './types';

export type ClientMessageType =
  | 'LOBBY_GET_ROOMS'
  | 'LOBBY_CREATE_ROOM'
  | 'LOBBY_QUICK_JOIN'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'ROOM_READY'
  | 'ROOM_START_GAME'
  | 'ROOM_PLAY_CARDS'
  | 'ROOM_PASS'
  | 'ROOM_SELECT_CARDS'
  | 'ROOM_SEND_REACTION'
  | 'ROOM_KICK_PLAYER'
  | 'ROOM_RECONNECT'
  | 'PING';

export interface BaseClientMessage<T extends ClientMessageType, P = unknown> {
  type: T;
  payload: P;
}

export type ClientMessage =
  | BaseClientMessage<'LOBBY_GET_ROOMS', Record<string, never>>
  | BaseClientMessage<'LOBBY_CREATE_ROOM', { roomName: string; playerName: string; avatar?: AvatarCustomization }>
  | BaseClientMessage<'LOBBY_QUICK_JOIN', { playerName: string; avatar?: AvatarCustomization }>
  | BaseClientMessage<'ROOM_JOIN', { roomId: string; playerName: string; playerId?: string; avatar?: AvatarCustomization }>
  | BaseClientMessage<'ROOM_LEAVE', Record<string, never>>
  | BaseClientMessage<'ROOM_READY', { ready: boolean }>
  | BaseClientMessage<'ROOM_START_GAME', Record<string, never>>
  | BaseClientMessage<'ROOM_PLAY_CARDS', { cardIds: string[] }>
  | BaseClientMessage<'ROOM_PASS', Record<string, never>>
  | BaseClientMessage<'ROOM_SELECT_CARDS', { indices: number[] }>
  | BaseClientMessage<'ROOM_SEND_REACTION', { emoji: string }>
  | BaseClientMessage<'ROOM_KICK_PLAYER', { playerId: string }>
  | BaseClientMessage<'ROOM_RECONNECT', { roomId: string; playerId: string }>
  | BaseClientMessage<'PING', { timestamp: number }>;

export type ServerMessageType =
  | 'LOBBY_ROOM_LIST'
  | 'LOBBY_ROOM_CREATED'
  | 'LOBBY_QUICK_JOIN_RESULT'
  | 'ROOM_JOINED'
  | 'ROOM_PLAYER_JOINED'
  | 'ROOM_PLAYER_LEFT'
  | 'ROOM_PLAYER_READY'
  | 'ROOM_PLAYER_SELECT_CARDS'
  | 'ROOM_PLAYER_REACTION'
  | 'ROOM_KICKED'
  | 'COUNTDOWN_START'
  | 'COUNTDOWN_TICK'
  | 'COUNTDOWN_CANCEL'
  | 'GAME_STARTED'
  | 'HAND_DEALT'
  | 'TURN_START'
  | 'CARDS_PLAYED'
  | 'TURN_PASSED'
  | 'ROUND_RESET'
  | 'GAME_OVER'
  | 'MATCH_ABORTED'
  | 'FULL_SYNC'
  | 'ERROR'
  | 'PONG';

export interface BaseServerMessage<T extends ServerMessageType, P = unknown> {
  type: T;
  payload: P;
}

export type ServerMessage =
  | BaseServerMessage<'LOBBY_ROOM_LIST', { rooms: RoomSummary[] }>
  | BaseServerMessage<'LOBBY_ROOM_CREATED', { roomId: string; roomCode: string }>
  | BaseServerMessage<'LOBBY_QUICK_JOIN_RESULT', { roomId: string | null; success: boolean; message?: string }>
  | BaseServerMessage<'ROOM_JOINED', { roomId: string; roomCode: string; playerId: string; seatIndex: number; snapshot: RoomFullSnapshot }>
  | BaseServerMessage<'ROOM_PLAYER_JOINED', { player: PlayerPublicInfo }>
  | BaseServerMessage<'ROOM_PLAYER_LEFT', { playerId: string }>
  | BaseServerMessage<'ROOM_PLAYER_READY', { playerId: string; isReady: boolean }>
  | BaseServerMessage<'ROOM_PLAYER_SELECT_CARDS', { playerId: string; indices: number[] }>
  | BaseServerMessage<'ROOM_PLAYER_REACTION', { playerId: string; emoji: string }>
  | BaseServerMessage<'ROOM_KICKED', { message: string }>
  | BaseServerMessage<'COUNTDOWN_START', { seconds: number }>
  | BaseServerMessage<'COUNTDOWN_TICK', { secondsRemaining: number }>
  | BaseServerMessage<'COUNTDOWN_CANCEL', Record<string, never>>
  | BaseServerMessage<'GAME_STARTED', { firstPlayerId: string; turnTimeoutMs: number }>
  | BaseServerMessage<'HAND_DEALT', { cards: Card[] }>
  | BaseServerMessage<'TURN_START', { playerId: string; seatIndex: number; timeoutMs: number; isFreeTurn: boolean }>
  | BaseServerMessage<'CARDS_PLAYED', { playerId: string; combination: CardCombination; remainingCardCount: number; nextPlayerId?: string }>
  | BaseServerMessage<'TURN_PASSED', { playerId: string; nextPlayerId: string }>
  | BaseServerMessage<'ROUND_RESET', { winnerId: string; nextPlayerId: string }>
  | BaseServerMessage<'GAME_OVER', { winnerId: string; scoreboard: ScoreboardEntry[] }>
  | BaseServerMessage<'MATCH_ABORTED', { reason: string; snapshot: RoomFullSnapshot }>
  | BaseServerMessage<'FULL_SYNC', { snapshot: RoomFullSnapshot }>
  | BaseServerMessage<'ERROR', { code: string; message: string }>
  | BaseServerMessage<'PONG', { timestamp: number }>;
