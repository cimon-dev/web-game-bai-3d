import { createCard, Deck, getCardDisplayNameVi } from '@game/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { TienLenRule } from '../src/game/TienLenRule';

describe('TienLenRule Engine Unit Tests', () => {
  let rule: TienLenRule;

  beforeEach(() => {
    rule = new TienLenRule();
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
      { id: 'p3', name: 'Charlie', seatIndex: 2 },
      { id: 'p4', name: 'Dave', seatIndex: 3 },
    ]);
  });

  it('starts game, deals 13 cards to each player, and requires 3♠ on first move', () => {
    const { firstTurnPlayerId } = rule.startGame();
    expect(firstTurnPlayerId).toBeDefined();

    for (const player of rule.players) {
      expect(player.hand).toHaveLength(13);
    }

    const firstPlayer = rule.players.find(p => p.id === firstTurnPlayerId)!;
    expect(firstPlayer.hand.some(c => c.id === '3_spade')).toBe(true);
    expect(rule.firstTurn3SpadeRequired).toBe(true);

    // Trying to play a card that is NOT 3♠ on first move should fail
    const non3SpadeCard = firstPlayer.hand.find(c => c.id !== '3_spade')!;
    const check = rule.canPlay(firstPlayer.id, [non3SpadeCard.id]);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('3 Bích');

    // Playing with 3♠ should succeed
    const validCheck = rule.canPlay(firstPlayer.id, ['3_spade']);
    expect(validCheck.valid).toBe(true);
  });

  it('rejects play if not player turn', () => {
    const { firstTurnPlayerId } = rule.startGame();
    const wrongPlayer = rule.players.find(p => p.id !== firstTurnPlayerId)!;

    const check = rule.canPlay(wrongPlayer.id, [wrongPlayer.hand[0].id]);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('Chưa tới lượt');
  });

  it('handles play, passes, and round reset correctly', () => {
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
    ]);
    rule.startGame();

    // Force deterministic hands for testing trick mechanics
    const p1 = rule.players.find(p => p.id === 'p1')!;
    const p2 = rule.players.find(p => p.id === 'p2')!;

    p1.hand = [createCard('3', 'spade'), createCard('5', 'heart'), createCard('8', 'spade')];
    p2.hand = [createCard('4', 'heart'), createCard('7', 'club'), createCard('9', 'heart')];
    rule.currentTurnPlayerId = 'p1';
    rule.firstTurn3SpadeRequired = false;

    // p1 plays 3♠
    const play1 = rule.playCards('p1', ['3_spade']);
    expect(play1.success).toBe(true);
    expect(rule.tableLastPlay?.combination.highestCard.id).toBe('3_spade');
    expect(rule.currentTurnPlayerId).toBe('p2');

    // p2 passes
    const pass1 = rule.passTurn('p2');
    expect(pass1.success).toBe(true);
    // Since only 2 players and p2 passed, round should reset and p1 gets free turn!
    expect(pass1.roundReset).toBe(true);
    expect(pass1.nextPlayerId).toBe('p1');
    expect(rule.tableLastPlay).toBeNull();
    expect(rule.currentTurnPlayerId).toBe('p1');
  });

  it('ends game and calculates scoreboard when player empties hand', () => {
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
    ]);
    rule.startGame();

    const p1 = rule.players.find(p => p.id === 'p1')!;
    const p2 = rule.players.find(p => p.id === 'p2')!;

    p1.hand = [createCard('A', 'heart')];
    // p2 has 2 cards remaining, including a 2♥ (thối heo đỏ)
    p2.hand = [createCard('5', 'club'), createCard('2', 'heart')];
    p2.playedCardsCount = 2; // not cong

    rule.currentTurnPlayerId = 'p1';
    rule.firstTurn3SpadeRequired = false;

    const play = rule.playCards('p1', ['A_heart']);
    expect(play.success).toBe(true);
    expect(play.isGameOver).toBe(true);
    expect(rule.gamePhase).toBe('game_over');

    const scoreboard = play.scoreboard!;
    expect(scoreboard).toHaveLength(2);

    const winnerEntry = scoreboard.find(s => s.rank === 1)!;
    expect(winnerEntry.playerId).toBe('p1');

    const loserEntry = scoreboard.find(s => s.rank === 2)!;
    expect(loserEntry.playerId).toBe('p2');
    expect(loserEntry.remainingCards).toBe(2);
    expect(loserEntry.penalty.thoiHeoDo).toBe(1);
    // Penalty calculation: 2 cards + 2 (heo đỏ) = 4
    expect(loserEntry.scoreDelta).toBe(-4);
    expect(winnerEntry.scoreDelta).toBe(4);
  });

  it('correctly handles autoPlayTimeout by playing lowest valid card or passing if none valid', () => {
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
    ]);
    rule.startGame();

    const p1 = rule.players.find(p => p.id === 'p1')!;
    const p2 = rule.players.find(p => p.id === 'p2')!;
    p1.hand = [createCard('4', 'spade'), createCard('9', 'heart')];
    p2.hand = [createCard('5', 'club'), createCard('10', 'diamond')];
    rule.currentTurnPlayerId = 'p1';
    rule.firstTurn3SpadeRequired = false;
    rule.tableLastPlay = null; // free turn

    // On lead/free turn, autoPlay plays lowest card (4♠)
    const auto1 = rule.autoPlayTimeout('p1');
    expect(auto1.action).toBe('play');
    expect(auto1.cardIds).toEqual(['4_spade']);
    expect(rule.currentTurnPlayerId).toBe('p2');

    // On following turn for p2, autoPlay automatically passes (per new rule)
    const auto2 = rule.autoPlayTimeout('p2');
    expect(auto2.action).toBe('pass');
    expect(auto2.roundReset).toBe(true);
    expect(rule.currentTurnPlayerId).toBe('p1');
  });

  it('verifies game resets when only 1 player remains in room', () => {
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
    ]);
    rule.startGame();
    expect(rule.gamePhase).toBe('playing');

    // Simulate p2 leaving
    rule.players = rule.players.filter(p => p.id !== 'p2');
    expect(rule.players.length).toBe(1);

    // When <= 1 player remains, rule resets to waiting phase
    if (rule.players.length <= 1) {
      rule.gamePhase = 'waiting';
      rule.tableLastPlay = null;
      rule.currentTurnPlayerId = null;
      for (const p of rule.players) {
        p.hand = [];
      }
    }

    expect(rule.gamePhase).toBe('waiting');
    expect(rule.tableLastPlay).toBeNull();
    expect(rule.players[0].hand).toHaveLength(0);
  });

  it('correctly starts with the smallest card when 3♠ is not dealt (e.g. 2-player match)', () => {
    rule.initPlayers([
      { id: 'p1', name: 'Alice', seatIndex: 0 },
      { id: 'p2', name: 'Bob', seatIndex: 1 },
    ]);
    rule.startGame();

    // Manually assign hands where 3♠ was not dealt to either player
    // p1 has 4♣ (weight 17), 5♦
    // p2 has 4♦ (weight 18), 6♥
    // Smallest card in match is 4♣ (held by p1)
    const p1 = rule.players.find(p => p.id === 'p1')!;
    const p2 = rule.players.find(p => p.id === 'p2')!;
    p1.hand = [createCard('4', 'club'), createCard('5', 'diamond')];
    p2.hand = [createCard('4', 'diamond'), createCard('6', 'heart')];

    const { playerIndex, smallestCard } = Deck.findStartingPlayerAndCard([p1.hand, p2.hand]);
    expect(playerIndex).toBe(0); // p1
    expect(smallestCard.id).toBe('4_club');

    rule.currentTurnPlayerId = p1.id;
    rule.firstTurnRequiredCardId = smallestCard.id;
    rule.firstTurnRequiredCardName = getCardDisplayNameVi(smallestCard);
    rule.firstTurn3SpadeRequired = true;

    // Trying to play 5♦ without 4♣ on first turn should fail
    const invalidCheck = rule.canPlay(p1.id, ['5_diamond']);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.error).toContain('4 Chuồn');

    // Playing 4♣ should succeed
    const validCheck = rule.canPlay(p1.id, ['4_club']);
    expect(validCheck.valid).toBe(true);

    // Auto-play on lead turn should play the smallest card (4♣)
    const autoPlay = rule.autoPlayTimeout(p1.id);
    expect(autoPlay.action).toBe('play');
    expect(autoPlay.cardIds).toEqual(['4_club']);
  });
});
