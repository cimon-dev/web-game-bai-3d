import { Card, generateStandardDeck, sortCards } from './cards';

export class Deck {
  /**
   * Generates a standard 52-card deck and shuffles it using the Fisher-Yates algorithm.
   */
  public static createShuffledDeck(): Card[] {
    const deck = generateStandardDeck();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  /**
   * Deals 13 cards to each player from the deck, sorted by weight.
   * Supports 2 to 4 players.
   */
  public static dealHands(deck: Card[], playerCount: number = 4): Card[][] {
    if (playerCount < 2 || playerCount > 4) {
      throw new Error(`Invalid playerCount: ${playerCount}. Must be between 2 and 4.`);
    }

    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    const cardsPerPlayer = 13;

    for (let i = 0; i < cardsPerPlayer; i++) {
      for (let p = 0; p < playerCount; p++) {
        const card = deck[i * playerCount + p];
        if (card) {
          hands[p].push(card);
        }
      }
    }

    return hands.map(hand => sortCards(hand));
  }

  /**
   * Finds which hand contains the starting card:
   * First priority is 3 of Spades (3♠ - id: "3_spade").
   * If 3♠ was not dealt to any player (e.g. 2 or 3 player games),
   * whoever holds the card with the lowest weight (smallest card) starts!
   */
  public static findStartingPlayerAndCard(hands: Card[][]): { playerIndex: number; smallestCard: Card } {
    // 1. Check if anyone has 3♠
    for (let i = 0; i < hands.length; i++) {
      const spade3 = hands[i].find(c => c.id === '3_spade');
      if (spade3) {
        return { playerIndex: i, smallestCard: spade3 };
      }
    }

    // 2. Fallback: Find the player who holds the smallest card among all players
    let bestPlayerIndex = 0;
    let minCard: Card | null = null;

    for (let i = 0; i < hands.length; i++) {
      if (hands[i].length === 0) continue;
      // hands are already sorted ascending by weight, so hands[i][0] is player's lowest card
      const playerLowest = hands[i][0];
      if (!minCard || playerLowest.weight < minCard.weight) {
        minCard = playerLowest;
        bestPlayerIndex = i;
      }
    }

    return {
      playerIndex: bestPlayerIndex,
      smallestCard: minCard!,
    };
  }

  public static findStartingPlayer(hands: Card[][]): number {
    return this.findStartingPlayerAndCard(hands).playerIndex;
  }
}
