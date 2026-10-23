import { describe, expect, it } from 'vitest';
import { Deck } from '../src/game/Deck';

describe('Deck Unit Tests', () => {
  it('should create a deck with exactly 52 unique cards', () => {
    const deck = Deck.createShuffledDeck();
    expect(deck).toHaveLength(52);

    const ids = new Set(deck.map(c => c.id));
    expect(ids.size).toBe(52);
  });

  it('should deal 13 cards to each player for 4 players', () => {
    const deck = Deck.createShuffledDeck();
    const hands = Deck.dealHands(deck, 4);

    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(13);
      // check sorted by weight ascending
      for (let i = 1; i < hand.length; i++) {
        expect(hand[i].weight).toBeGreaterThanOrEqual(hand[i - 1].weight);
      }
    }
  });

  it('should correctly identify the player holding 3 of Spades', () => {
    const deck = Deck.createShuffledDeck();
    const hands = Deck.dealHands(deck, 4);

    const startingPlayerIdx = Deck.findStartingPlayer(hands);
    expect(startingPlayerIdx).toBeGreaterThanOrEqual(0);
    expect(startingPlayerIdx).toBeLessThan(4);

    const startingHand = hands[startingPlayerIdx];
    expect(startingHand.some(c => c.id === '3_spade')).toBe(true);
  });
});
