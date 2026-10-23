import { Card } from './cards';

export type CombinationType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'three_pairs_consecutive'
  | 'four_of_a_kind'
  | 'four_pairs_consecutive';

export interface CardCombination {
  type: CombinationType;
  cards: Card[];
  highestCard: Card;
  length?: number; // length of straight (3..12)
}

export type GamePhase = 'waiting' | 'dealing' | 'playing' | 'game_over';

export interface AvatarCustomization {
  gender?: 'male' | 'female';
  hairStyle: 'short' | 'long' | 'cap' | 'beanie' | 'spiky';
  hairColor: string;
  shirtColor: string;
  pantsColor?: string;
  skinColor: string;
  accessory?: 'none' | 'glasses' | 'sunglasses' | 'headphone';
  eyeType?: 'normal' | 'cool' | 'glasses';
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  seatIndex: number;
  cardCount: number;
  isReady: boolean;
  isConnected: boolean;
  isTurn: boolean;
  hasPassed: boolean;
  rankPosition: number | null; // 1 = First, 2 = Second...
  avatar?: AvatarCustomization;
  selectedCardIndices?: number[];
}

export interface TurnInfo {
  playerId: string;
  seatIndex: number;
  timeoutMs: number;
  startTime: number;
  isFreeTurn: boolean; // New trick, can play any valid combo
}

export interface TableState {
  lastPlay: {
    playerId: string;
    combination: CardCombination;
  } | null;
  roundPlayerPassedIds: string[];
}

export interface ScoreboardPenalty {
  thoiHeoDen: number;
  thoiHeoDo: number;
  thoi3DoiThong: number;
  thoiTuQuy: number;
  thoi4DoiThong: number;
  isCong: boolean;
}

export interface ScoreboardEntry {
  playerId: string;
  playerName: string;
  seatIndex: number;
  rank: number;
  remainingCards: number;
  penalty: ScoreboardPenalty;
  scoreDelta: number;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
}

export interface RoomFullSnapshot {
  roomId: string;
  roomCode: string;
  roomName: string;
  phase: GamePhase;
  players: PlayerPublicInfo[];
  myCards: Card[];
  currentTurn: TurnInfo | null;
  table: TableState;
  firstTurn3SpadeRequired: boolean;
  firstTurnRequiredCardId?: string | null;
  firstTurnRequiredCardName?: string | null;
}
