import { Card, sortCards } from './cards';
import { Combinations } from './Combinations';
import { CardCombination } from './types';

export class Compare {
  /**
   * Determines if `current` combination can legally beat/cut `target` combination.
   */
  public static canBeat(current: CardCombination, target: CardCombination): boolean {
    if (!current || !target) {
      return false;
    }

    // 1. Same combination type comparison
    if (current.type === target.type) {
      switch (current.type) {
        case 'single':
        case 'pair':
        case 'triple':
        case 'three_pairs_consecutive':
        case 'four_pairs_consecutive':
          return current.highestCard.weight > target.highestCard.weight;

        case 'straight':
          // Straights must be identical length to beat each other
          if (current.length !== target.length) {
            return false;
          }
          return current.highestCard.weight > target.highestCard.weight;

        case 'four_of_a_kind':
          return current.highestCard.rankValue > target.highestCard.rankValue;
      }
    }

    // 2. Cutting a single Heo (target is Single 2)
    if (target.type === 'single' && target.highestCard.rankValue === 15) {
      if (
        current.type === 'three_pairs_consecutive' ||
        current.type === 'four_of_a_kind' ||
        current.type === 'four_pairs_consecutive'
      ) {
        return true;
      }
    }

    // 3. Cutting a pair of Heos (target is Pair of 2s)
    if (target.type === 'pair' && target.highestCard.rankValue === 15) {
      if (current.type === 'four_of_a_kind' || current.type === 'four_pairs_consecutive') {
        return true;
      }
    }

    // 4. Cutting 3 pairs consecutive (target is 3 đôi thông)
    if (target.type === 'three_pairs_consecutive') {
      if (current.type === 'four_of_a_kind' || current.type === 'four_pairs_consecutive') {
        return true;
      }
    }

    // 5. Cutting Four of a kind (target is Tứ quý)
    if (target.type === 'four_of_a_kind') {
      if (current.type === 'four_pairs_consecutive') {
        return true;
      }
    }

    return false;
  }

  /**
   * Finds the smallest valid combination of cards from `hand` that can beat `target`.
   * If `target` is null (free turn), returns the lowest single card (or containing 3♠ if required).
   * Returns Card[] or null if no combination in hand can beat `target`.
   */
  public static findSmallestPlayable(
    hand: Card[],
    target: CardCombination | null,
    requireCard?: string | boolean | null
  ): Card[] | null {
    if (!hand || hand.length === 0) return null;
    const sorted = sortCards(hand);

    // Free turn: play smallest card (or required opening card if required)
    if (!target) {
      if (typeof requireCard === 'string') {
        const req = sorted.find(c => c.id === requireCard);
        if (req) return [req];
      } else if (requireCard === true) {
        const c3 = sorted.find(c => c.id === '3_spade');
        if (c3) return [c3];
      }
      return [sorted[0]];
    }

    // 1. Target is single card
    if (target.type === 'single') {
      for (const card of sorted) {
        const combo = Combinations.detect([card]);
        if (combo && this.canBeat(combo, target)) {
          return [card];
        }
      }
      // If target is Heo (rank 15), check four of a kind
      if (target.highestCard.rankValue === 15) {
        for (let i = 0; i <= sorted.length - 4; i++) {
          if (
            sorted[i].rankValue === sorted[i + 1].rankValue &&
            sorted[i + 1].rankValue === sorted[i + 2].rankValue &&
            sorted[i + 2].rankValue === sorted[i + 3].rankValue
          ) {
            const quad = [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
            const combo = Combinations.detect(quad);
            if (combo && this.canBeat(combo, target)) return quad;
          }
        }
      }
      return null;
    }

    // 2. Target is pair
    if (target.type === 'pair') {
      for (let i = 0; i <= sorted.length - 2; i++) {
        if (sorted[i].rankValue === sorted[i + 1].rankValue) {
          const pair = [sorted[i], sorted[i + 1]];
          const combo = Combinations.detect(pair);
          if (combo && this.canBeat(combo, target)) {
            return pair;
          }
        }
      }
      // If target is pair of Heos, check tứ quý
      if (target.highestCard.rankValue === 15) {
        for (let i = 0; i <= sorted.length - 4; i++) {
          if (
            sorted[i].rankValue === sorted[i + 1].rankValue &&
            sorted[i + 1].rankValue === sorted[i + 2].rankValue &&
            sorted[i + 2].rankValue === sorted[i + 3].rankValue
          ) {
            const quad = [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
            const combo = Combinations.detect(quad);
            if (combo && this.canBeat(combo, target)) return quad;
          }
        }
      }
      return null;
    }

    // 3. Target is triple
    if (target.type === 'triple') {
      for (let i = 0; i <= sorted.length - 3; i++) {
        if (
          sorted[i].rankValue === sorted[i + 1].rankValue &&
          sorted[i + 1].rankValue === sorted[i + 2].rankValue
        ) {
          const triple = [sorted[i], sorted[i + 1], sorted[i + 2]];
          const combo = Combinations.detect(triple);
          if (combo && this.canBeat(combo, target)) {
            return triple;
          }
        }
      }
      return null;
    }

    // 4. Target is straight
    if (target.type === 'straight') {
      const len = target.length || target.cards.length;
      const nonTwos = sorted.filter(c => c.rankValue < 15);
      const rankGroups = new Map<number, Card[]>();
      for (const c of nonTwos) {
        if (!rankGroups.has(c.rankValue)) rankGroups.set(c.rankValue, []);
        rankGroups.get(c.rankValue)!.push(c);
      }

      for (let startRank = 3; startRank <= 14 - len + 1; startRank++) {
        let hasAll = true;
        for (let r = 0; r < len; r++) {
          if (!rankGroups.has(startRank + r)) {
            hasAll = false;
            break;
          }
        }
        if (hasAll) {
          const straightCards: Card[] = [];
          for (let r = 0; r < len; r++) {
            const cardsAtRank = rankGroups.get(startRank + r)!;
            straightCards.push(cardsAtRank[0]);
          }
          const combo = Combinations.detect(straightCards);
          if (combo && this.canBeat(combo, target)) {
            return straightCards;
          }
        }
      }
      return null;
    }

    // 5. Target is four of a kind
    if (target.type === 'four_of_a_kind') {
      for (let i = 0; i <= sorted.length - 4; i++) {
        if (
          sorted[i].rankValue === sorted[i + 1].rankValue &&
          sorted[i + 1].rankValue === sorted[i + 2].rankValue &&
          sorted[i + 2].rankValue === sorted[i + 3].rankValue
        ) {
          const quad = [sorted[i], sorted[i + 1], sorted[i + 2], sorted[i + 3]];
          const combo = Combinations.detect(quad);
          if (combo && this.canBeat(combo, target)) {
            return quad;
          }
        }
      }
      return null;
    }

    return null;
  }
}
