import { Card, sortCards } from './cards';
import { CardCombination } from './types';

export class Combinations {
  /**
   * Detects the valid Tien Len Mien Nam combination type for a given set of cards.
   * Returns CardCombination if valid, or null if not a valid combination.
   */
  public static detect(cards: Card[]): CardCombination | null {
    if (!cards || cards.length === 0) {
      return null;
    }

    const sorted = sortCards(cards);
    const n = sorted.length;

    // 1 card: Single
    if (n === 1) {
      return {
        type: 'single',
        cards: sorted,
        highestCard: sorted[0],
      };
    }

    // 2 cards: Pair
    if (n === 2) {
      if (sorted[0].rankValue === sorted[1].rankValue) {
        return {
          type: 'pair',
          cards: sorted,
          highestCard: sorted[1],
        };
      }
      return null;
    }

    // 3 cards: Triple or Straight (3 cards)
    if (n === 3) {
      if (sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
        return {
          type: 'triple',
          cards: sorted,
          highestCard: sorted[2],
        };
      }

      if (this.isStraight(sorted)) {
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[2],
          length: 3,
        };
      }

      return null;
    }

    // 4 cards: Four of a Kind (Tứ quý) or Straight (4 cards)
    if (n === 4) {
      if (
        sorted[0].rankValue === sorted[1].rankValue &&
        sorted[1].rankValue === sorted[2].rankValue &&
        sorted[2].rankValue === sorted[3].rankValue
      ) {
        return {
          type: 'four_of_a_kind',
          cards: sorted,
          highestCard: sorted[3],
        };
      }

      if (this.isStraight(sorted)) {
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[3],
          length: 4,
        };
      }

      return null;
    }

    // 6 cards: 3 pairs consecutive (3 đôi thông) or Straight (6 cards)
    if (n === 6) {
      if (this.isThreePairsConsecutive(sorted)) {
        return {
          type: 'three_pairs_consecutive',
          cards: sorted,
          highestCard: sorted[5],
        };
      }

      if (this.isStraight(sorted)) {
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[5],
          length: 6,
        };
      }

      return null;
    }

    // 8 cards: 4 pairs consecutive (4 đôi thông) or Straight (8 cards)
    if (n === 8) {
      if (this.isFourPairsConsecutive(sorted)) {
        return {
          type: 'four_pairs_consecutive',
          cards: sorted,
          highestCard: sorted[7],
        };
      }

      if (this.isStraight(sorted)) {
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[7],
          length: 8,
        };
      }

      return null;
    }

    // 5, 7, 9, 10, 11, 12 cards: Only Straight can be valid
    if (n >= 5 && n <= 12) {
      if (this.isStraight(sorted)) {
        return {
          type: 'straight',
          cards: sorted,
          highestCard: sorted[n - 1],
          length: n,
        };
      }
    }

    return null;
  }

  /**
   * Returns human-readable Vietnamese name for a combination.
   */
  public static getCombinationNameVi(combo: CardCombination): string {
    switch (combo.type) {
      case 'single':
        return `Lá ${combo.highestCard.rank}${combo.highestCard.suit === 'heart' ? '♥' : combo.highestCard.suit === 'diamond' ? '♦' : combo.highestCard.suit === 'club' ? '♣' : '♠'}`;
      case 'pair':
        return `Đôi ${combo.highestCard.rank}`;
      case 'triple':
        return `Sám cô ${combo.highestCard.rank}`;
      case 'straight':
        return `Sảnh ${combo.length} lá (tới ${combo.highestCard.rank})`;
      case 'three_pairs_consecutive':
        return `3 Đôi Thông (tới ${combo.highestCard.rank})`;
      case 'four_of_a_kind':
        return `Tứ Quý ${combo.highestCard.rank}`;
      case 'four_pairs_consecutive':
        return `4 Đôi Thông (tới ${combo.highestCard.rank})`;
    }
  }

  public static isStraight(sorted: Card[]): boolean {
    if (sorted.length < 3 || sorted.length > 12) {
      return false;
    }

    if (sorted.some(c => c.rankValue === 15)) {
      return false;
    }

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].rankValue !== sorted[i - 1].rankValue + 1) {
        return false;
      }
    }

    return true;
  }

  public static isThreePairsConsecutive(sorted: Card[]): boolean {
    if (sorted.length !== 6) return false;
    if (sorted.some(c => c.rankValue === 15)) return false;

    const pair1 = sorted[0].rankValue === sorted[1].rankValue;
    const pair2 = sorted[2].rankValue === sorted[3].rankValue;
    const pair3 = sorted[4].rankValue === sorted[5].rankValue;

    if (!pair1 || !pair2 || !pair3) return false;

    const consecutive1 = sorted[2].rankValue === sorted[0].rankValue + 1;
    const consecutive2 = sorted[4].rankValue === sorted[2].rankValue + 1;

    return consecutive1 && consecutive2;
  }

  public static isFourPairsConsecutive(sorted: Card[]): boolean {
    if (sorted.length !== 8) return false;
    if (sorted.some(c => c.rankValue === 15)) return false;

    for (let p = 0; p < 4; p++) {
      if (sorted[p * 2].rankValue !== sorted[p * 2 + 1].rankValue) {
        return false;
      }
      if (p > 0) {
        if (sorted[p * 2].rankValue !== sorted[(p - 1) * 2].rankValue + 1) {
          return false;
        }
      }
    }

    return true;
  }
}
