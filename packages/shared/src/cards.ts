export type Suit = 'spade' | 'club' | 'diamond' | 'heart';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string; // e.g. "3_spade", "10_diamond", "2_heart"
  rank: Rank;
  suit: Suit;
  rankValue: number; // 3 to 15
  suitValue: number; // 0 (spade), 1 (club), 2 (diamond), 3 (heart)
  weight: number;    // rankValue * 4 + suitValue
}

export const SUITS: Suit[] = ['spade', 'club', 'diamond', 'heart'];
export const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spade: '♠',
  club: '♣',
  diamond: '♦',
  heart: '♥',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spade: '#1e293b',
  club: '#1e293b',
  diamond: '#dc2626',
  heart: '#dc2626',
};

export const SUIT_NAMES_VI: Record<Suit, string> = {
  spade: 'Bích',
  club: 'Chuồn',
  diamond: 'Rô',
  heart: 'Cơ',
};

export function getRankValue(rank: Rank): number {
  switch (rank) {
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    case 'A': return 14;
    case '2': return 15;
  }
}

export function getSuitValue(suit: Suit): number {
  switch (suit) {
    case 'spade': return 0;
    case 'club': return 1;
    case 'diamond': return 2;
    case 'heart': return 3;
  }
}

export function createCard(rank: Rank, suit: Suit): Card {
  const rankValue = getRankValue(rank);
  const suitValue = getSuitValue(suit);
  return {
    id: `${rank}_${suit}`,
    rank,
    suit,
    rankValue,
    suitValue,
    weight: rankValue * 4 + suitValue,
  };
}

export function generateStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.weight - b.weight);
}

export function cardCompare(a: Card, b: Card): number {
  return a.weight - b.weight;
}

export function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function getCardDisplayNameVi(card: Card): string {
  const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
  const suitName = SUIT_NAMES_VI[card.suit] || '';
  return `${card.rank} ${suitName} (${card.rank}${suitSymbol})`;
}

