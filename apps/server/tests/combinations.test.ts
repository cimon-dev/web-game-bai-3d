import { createCard } from '@game/shared';
import { describe, expect, it } from 'vitest';
import { Combinations } from '../src/game/Combinations';

describe('Combinations Detection Unit Tests', () => {
  it('detects Single', () => {
    const card = createCard('3', 'spade');
    const combo = Combinations.detect([card]);
    expect(combo).not.toBeNull();
    expect(combo?.type).toBe('single');
    expect(combo?.highestCard.id).toBe('3_spade');
  });

  it('detects Pair', () => {
    const cards = [createCard('5', 'heart'), createCard('5', 'club')];
    const combo = Combinations.detect(cards);
    expect(combo).not.toBeNull();
    expect(combo?.type).toBe('pair');
    expect(combo?.highestCard.id).toBe('5_heart');
  });

  it('rejects 2 non-matching cards', () => {
    const cards = [createCard('5', 'heart'), createCard('6', 'club')];
    expect(Combinations.detect(cards)).toBeNull();
  });

  it('detects Triple', () => {
    const cards = [createCard('7', 'spade'), createCard('7', 'diamond'), createCard('7', 'heart')];
    const combo = Combinations.detect(cards);
    expect(combo).not.toBeNull();
    expect(combo?.type).toBe('triple');
    expect(combo?.highestCard.id).toBe('7_heart');
  });

  it('detects Straights from 3 to 12 cards', () => {
    const straight3 = [createCard('3', 'spade'), createCard('4', 'club'), createCard('5', 'heart')];
    const combo3 = Combinations.detect(straight3);
    expect(combo3?.type).toBe('straight');
    expect(combo3?.length).toBe(3);
    expect(combo3?.highestCard.id).toBe('5_heart');

    const straightEndingInA = [
      createCard('10', 'spade'),
      createCard('J', 'club'),
      createCard('Q', 'diamond'),
      createCard('K', 'heart'),
      createCard('A', 'spade'),
    ];
    const comboA = Combinations.detect(straightEndingInA);
    expect(comboA?.type).toBe('straight');
    expect(comboA?.length).toBe(5);
    expect(comboA?.highestCard.id).toBe('A_spade');
  });

  it('rejects Straights containing 2 (Heo)', () => {
    const straightWith2 = [createCard('K', 'spade'), createCard('A', 'club'), createCard('2', 'heart')];
    expect(Combinations.detect(straightWith2)).toBeNull();
  });

  it('detects Four of a Kind (Tứ quý)', () => {
    const tuQuy = [
      createCard('9', 'spade'),
      createCard('9', 'club'),
      createCard('9', 'diamond'),
      createCard('9', 'heart'),
    ];
    const combo = Combinations.detect(tuQuy);
    expect(combo?.type).toBe('four_of_a_kind');
    expect(combo?.highestCard.rank).toBe('9');
  });

  it('detects 3 pairs consecutive (3 đôi thông)', () => {
    const baDoiThong = [
      createCard('6', 'spade'),
      createCard('6', 'club'),
      createCard('7', 'diamond'),
      createCard('7', 'heart'),
      createCard('8', 'spade'),
      createCard('8', 'heart'),
    ];
    const combo = Combinations.detect(baDoiThong);
    expect(combo?.type).toBe('three_pairs_consecutive');
    expect(combo?.highestCard.id).toBe('8_heart');
  });

  it('rejects 3 non-consecutive pairs as 3 đôi thông', () => {
    const nonConsecutive = [
      createCard('6', 'spade'),
      createCard('6', 'club'),
      createCard('7', 'diamond'),
      createCard('7', 'heart'),
      createCard('9', 'spade'), // skip 8!
      createCard('9', 'heart'),
    ];
    expect(Combinations.detect(nonConsecutive)).toBeNull();
  });

  it('detects 4 pairs consecutive (4 đôi thông)', () => {
    const bonDoiThong = [
      createCard('8', 'spade'),
      createCard('8', 'club'),
      createCard('9', 'diamond'),
      createCard('9', 'heart'),
      createCard('10', 'spade'),
      createCard('10', 'diamond'),
      createCard('J', 'club'),
      createCard('J', 'heart'),
    ];
    const combo = Combinations.detect(bonDoiThong);
    expect(combo?.type).toBe('four_pairs_consecutive');
    expect(combo?.highestCard.id).toBe('J_heart');
  });
});
