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

  /**
   * Smart auto-predict: When a player clicks on `clickedCard` to respond to a `target` combination
   * on the table (such as a pair, triple, straight, quad, or chops), automatically find the
   * matching combination in their hand that includes `clickedCard` and can beat the table!
   */
  public static findSmartSuggestion(
    clickedCard: Card,
    hand: Card[],
    target: CardCombination | null
  ): Card[] | null {
    if (!target) return null;

    const otherHandCards = hand.filter(c => c.id !== clickedCard.id);

    // 1. Target is a Pair (Đôi)
    if (target.type === 'pair') {
      const sameRank = otherHandCards.filter(c => c.rankValue === clickedCard.rankValue);
      if (sameRank.length > 0) {
        for (const other of sameRank) {
          const pair = [clickedCard, other];
          const combo = Combinations.detect(pair);
          if (combo && this.canBeat(combo, target)) {
            return pair;
          }
        }
      }

      // Check if target is pair of Heos and clickedCard can be part of Tu Quy
      if (target.highestCard.rankValue === 15) {
        const quadCandidates = hand.filter(c => c.rankValue === clickedCard.rankValue);
        if (quadCandidates.length === 4) {
          const combo = Combinations.detect(quadCandidates);
          if (combo && this.canBeat(combo, target)) {
            return quadCandidates;
          }
        }

        // Four pairs consecutive can also beat pair of 2s
        const fourPairs = this.findConsecutivePairsContaining(clickedCard, hand, 4);
        if (fourPairs) {
          const combo = Combinations.detect(fourPairs);
          if (combo && this.canBeat(combo, target)) {
            return fourPairs;
          }
        }
      }
      return null;
    }

    // 2. Target is a Triple (Bộ ba / Sám cô)
    if (target.type === 'triple') {
      const sameRank = otherHandCards.filter(c => c.rankValue === clickedCard.rankValue);
      if (sameRank.length >= 2) {
        for (let i = 0; i < sameRank.length - 1; i++) {
          for (let j = i + 1; j < sameRank.length; j++) {
            const triple = [clickedCard, sameRank[i], sameRank[j]];
            const combo = Combinations.detect(triple);
            if (combo && this.canBeat(combo, target)) {
              return triple;
            }
          }
        }
      }
      return null;
    }

    // 3. Target is a Straight (Sảnh / Bộ dọc)
    if (target.type === 'straight') {
      const len = target.length || target.cards.length;
      const clickedRank = clickedCard.rankValue;
      if (clickedRank < 3 || clickedRank > 14) return null;

      // Group cards by rank
      const rankGroups = new Map<number, Card[]>();
      for (const c of hand) {
        if (c.rankValue >= 3 && c.rankValue <= 14) {
          if (!rankGroups.has(c.rankValue)) {
            rankGroups.set(c.rankValue, []);
          }
          rankGroups.get(c.rankValue)!.push(c);
        }
      }

      // Check all possible straight spans of length 'len' that contain clickedRank
      const minStart = Math.max(3, clickedRank - (len - 1));
      const maxStart = Math.min(14 - (len - 1), clickedRank);

      for (let start = minStart; start <= maxStart; start++) {
        let hasAll = true;
        for (let r = start; r < start + len; r++) {
          if (!rankGroups.has(r) || rankGroups.get(r)!.length === 0) {
            hasAll = false;
            break;
          }
        }

        if (hasAll) {
          const highestRank = start + len - 1;
          const highestCards = rankGroups.get(highestRank)!;
          for (const topCard of highestCards) {
            const straightCards: Card[] = [];
            for (let r = start; r < start + len; r++) {
              if (r === clickedRank) {
                straightCards.push(clickedCard);
              } else if (r === highestRank) {
                straightCards.push(topCard);
              } else {
                straightCards.push(rankGroups.get(r)![0]);
              }
            }
            const combo = Combinations.detect(straightCards);
            if (combo && this.canBeat(combo, target)) {
              return straightCards;
            }
          }
        }
      }
      return null;
    }

    // 4. Target is Four of a Kind (Tứ quý)
    if (target.type === 'four_of_a_kind') {
      const quadCandidates = hand.filter(c => c.rankValue === clickedCard.rankValue);
      if (quadCandidates.length === 4) {
        const combo = Combinations.detect(quadCandidates);
        if (combo && this.canBeat(combo, target)) {
          return quadCandidates;
        }
      }

      const fourPairs = this.findConsecutivePairsContaining(clickedCard, hand, 4);
      if (fourPairs) {
        const combo = Combinations.detect(fourPairs);
        if (combo && this.canBeat(combo, target)) {
          return fourPairs;
        }
      }
      return null;
    }

    // 5. Target is Single Heo (Tứ quý hoặc 3 đôi thông chặt Heo)
    if (target.type === 'single' && target.highestCard.rankValue === 15) {
      const quadCandidates = hand.filter(c => c.rankValue === clickedCard.rankValue);
      if (quadCandidates.length === 4) {
        const combo = Combinations.detect(quadCandidates);
        if (combo && this.canBeat(combo, target)) {
          return quadCandidates;
        }
      }

      const threePairs = this.findConsecutivePairsContaining(clickedCard, hand, 3);
      if (threePairs) {
        const combo = Combinations.detect(threePairs);
        if (combo && this.canBeat(combo, target)) {
          return threePairs;
        }
      }
    }

    // 6. Target is Three Pairs Consecutive (3 đôi thông)
    if (target.type === 'three_pairs_consecutive') {
      const threePairs = this.findConsecutivePairsContaining(clickedCard, hand, 3);
      if (threePairs) {
        const combo = Combinations.detect(threePairs);
        if (combo && this.canBeat(combo, target)) {
          return threePairs;
        }
      }

      const quadCandidates = hand.filter(c => c.rankValue === clickedCard.rankValue);
      if (quadCandidates.length === 4) {
        const combo = Combinations.detect(quadCandidates);
        if (combo && this.canBeat(combo, target)) {
          return quadCandidates;
        }
      }
    }

    // 7. Target is Four Pairs Consecutive (4 đôi thông)
    if (target.type === 'four_pairs_consecutive') {
      const fourPairs = this.findConsecutivePairsContaining(clickedCard, hand, 4);
      if (fourPairs) {
        const combo = Combinations.detect(fourPairs);
        if (combo && this.canBeat(combo, target)) {
          return fourPairs;
        }
      }
    }

    return null;
  }

  private static findConsecutivePairsContaining(
    clickedCard: Card,
    hand: Card[],
    numPairs: number
  ): Card[] | null {
    const clickedRank = clickedCard.rankValue;
    if (clickedRank < 3 || clickedRank > 14) return null;

    const rankGroups = new Map<number, Card[]>();
    for (const c of hand) {
      if (c.rankValue >= 3 && c.rankValue <= 14) {
        if (!rankGroups.has(c.rankValue)) rankGroups.set(c.rankValue, []);
        rankGroups.get(c.rankValue)!.push(c);
      }
    }

    const minStart = Math.max(3, clickedRank - (numPairs - 1));
    const maxStart = Math.min(14 - (numPairs - 1), clickedRank);

    for (let start = minStart; start <= maxStart; start++) {
      let hasAllPairs = true;
      for (let r = start; r < start + numPairs; r++) {
        if (!rankGroups.has(r) || rankGroups.get(r)!.length < 2) {
          hasAllPairs = false;
          break;
        }
      }

      if (hasAllPairs) {
        const pairCards: Card[] = [];
        for (let r = start; r < start + numPairs; r++) {
          const cardsAtRank = rankGroups.get(r)!;
          if (r === clickedRank) {
            pairCards.push(clickedCard);
            const other = cardsAtRank.find(c => c.id !== clickedCard.id);
            if (other) pairCards.push(other);
          } else {
            pairCards.push(cardsAtRank[0], cardsAtRank[1]);
          }
        }
        if (pairCards.length === numPairs * 2) {
          return pairCards;
        }
      }
    }
    return null;
  }
}
