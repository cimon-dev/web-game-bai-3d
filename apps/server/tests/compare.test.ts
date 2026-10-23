import { createCard } from '@game/shared';
import { describe, expect, it } from 'vitest';
import { Combinations } from '../src/game/Combinations';
import { Compare } from '../src/game/Compare';

describe('Compare and Cutting Rules Unit Tests', () => {
  it('Single vs Single: higher weight beats lower weight', () => {
    const card3Spade = Combinations.detect([createCard('3', 'spade')])!;
    const card3Heart = Combinations.detect([createCard('3', 'heart')])!;
    const card4Spade = Combinations.detect([createCard('4', 'spade')])!;

    expect(Compare.canBeat(card3Heart, card3Spade)).toBe(true);
    expect(Compare.canBeat(card3Spade, card3Heart)).toBe(false);
    expect(Compare.canBeat(card4Spade, card3Heart)).toBe(true);
  });

  it('Pair vs Pair: higher pair beats lower pair', () => {
    const pair5 = Combinations.detect([createCard('5', 'spade'), createCard('5', 'heart')])!;
    const pair6 = Combinations.detect([createCard('6', 'club'), createCard('6', 'diamond')])!;

    expect(Compare.canBeat(pair6, pair5)).toBe(true);
    expect(Compare.canBeat(pair5, pair6)).toBe(false);
  });

  it('Straight vs Straight: must be same length, higher top card wins', () => {
    const straight3_5 = Combinations.detect([
      createCard('3', 'spade'),
      createCard('4', 'club'),
      createCard('5', 'heart'),
    ])!;
    const straight4_6 = Combinations.detect([
      createCard('4', 'spade'),
      createCard('5', 'club'),
      createCard('6', 'diamond'),
    ])!;
    const straight4Cards = Combinations.detect([
      createCard('3', 'club'),
      createCard('4', 'diamond'),
      createCard('5', 'spade'),
      createCard('6', 'heart'),
    ])!;

    expect(Compare.canBeat(straight4_6, straight3_5)).toBe(true);
    expect(Compare.canBeat(straight3_5, straight4_6)).toBe(false);
    // Different lengths cannot beat each other
    expect(Compare.canBeat(straight4Cards, straight3_5)).toBe(false);
  });

  it('Cutting 1 Heo (quân 2) with 3 đôi thông, Tứ quý, 4 đôi thông', () => {
    const heoBich = Combinations.detect([createCard('2', 'spade')])!;
    const heoCo = Combinations.detect([createCard('2', 'heart')])!;

    // 2♥ beats 2♠
    expect(Compare.canBeat(heoCo, heoBich)).toBe(true);

    const baDoiThong = Combinations.detect([
      createCard('4', 'spade'),
      createCard('4', 'heart'),
      createCard('5', 'club'),
      createCard('5', 'diamond'),
      createCard('6', 'spade'),
      createCard('6', 'heart'),
    ])!;
    const tuQuy = Combinations.detect([
      createCard('8', 'spade'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('8', 'heart'),
    ])!;
    const bonDoiThong = Combinations.detect([
      createCard('7', 'spade'),
      createCard('7', 'heart'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('9', 'spade'),
      createCard('9', 'heart'),
      createCard('10', 'spade'),
      createCard('10', 'heart'),
    ])!;

    // All can cut 1 Heo
    expect(Compare.canBeat(baDoiThong, heoCo)).toBe(true);
    expect(Compare.canBeat(tuQuy, heoCo)).toBe(true);
    expect(Compare.canBeat(bonDoiThong, heoCo)).toBe(true);
  });

  it('Cutting Đôi Heo with Tứ quý and 4 đôi thông (3 đôi thông cannot cut đôi Heo)', () => {
    const doiHeo = Combinations.detect([createCard('2', 'spade'), createCard('2', 'heart')])!;
    const baDoiThong = Combinations.detect([
      createCard('4', 'spade'),
      createCard('4', 'heart'),
      createCard('5', 'club'),
      createCard('5', 'diamond'),
      createCard('6', 'spade'),
      createCard('6', 'heart'),
    ])!;
    const tuQuy = Combinations.detect([
      createCard('8', 'spade'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('8', 'heart'),
    ])!;
    const bonDoiThong = Combinations.detect([
      createCard('7', 'spade'),
      createCard('7', 'heart'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('9', 'spade'),
      createCard('9', 'heart'),
      createCard('10', 'spade'),
      createCard('10', 'heart'),
    ])!;

    expect(Compare.canBeat(baDoiThong, doiHeo)).toBe(false);
    expect(Compare.canBeat(tuQuy, doiHeo)).toBe(true);
    expect(Compare.canBeat(bonDoiThong, doiHeo)).toBe(true);
  });

  it('Cutting 3 đôi thông with Tứ quý or 4 đôi thông', () => {
    const baDoiThong = Combinations.detect([
      createCard('4', 'spade'),
      createCard('4', 'heart'),
      createCard('5', 'club'),
      createCard('5', 'diamond'),
      createCard('6', 'spade'),
      createCard('6', 'heart'),
    ])!;
    const tuQuy = Combinations.detect([
      createCard('8', 'spade'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('8', 'heart'),
    ])!;
    const bonDoiThong = Combinations.detect([
      createCard('7', 'spade'),
      createCard('7', 'heart'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('9', 'spade'),
      createCard('9', 'heart'),
      createCard('10', 'spade'),
      createCard('10', 'heart'),
    ])!;

    expect(Compare.canBeat(tuQuy, baDoiThong)).toBe(true);
    expect(Compare.canBeat(bonDoiThong, baDoiThong)).toBe(true);
  });

  it('Cutting Tứ quý with 4 đôi thông', () => {
    const tuQuy = Combinations.detect([
      createCard('8', 'spade'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('8', 'heart'),
    ])!;
    const bonDoiThong = Combinations.detect([
      createCard('7', 'spade'),
      createCard('7', 'heart'),
      createCard('8', 'club'),
      createCard('8', 'diamond'),
      createCard('9', 'spade'),
      createCard('9', 'heart'),
      createCard('10', 'spade'),
      createCard('10', 'heart'),
    ])!;

    expect(Compare.canBeat(bonDoiThong, tuQuy)).toBe(true);
  });

  describe('findSmartSuggestion (Auto-predict card combinations)', () => {
    it('Auto-predicts winning pair when clicking a card that pairs up to beat target pair', () => {
      const targetPair = Combinations.detect([
        createCard('6', 'spade'),
        createCard('6', 'club'),
      ])!;

      const card7Spade = createCard('7', 'spade');
      const card7Heart = createCard('7', 'heart');
      const card9Diamond = createCard('9', 'diamond');
      const hand = [card7Spade, card7Heart, card9Diamond];

      // Click 7♠ -> Should suggest [7♠, 7♥]
      const suggestion = Compare.findSmartSuggestion(card7Spade, hand, targetPair);
      expect(suggestion).not.toBeNull();
      expect(suggestion!.length).toBe(2);
      expect(suggestion!.map(c => c.id)).toContain(card7Spade.id);
      expect(suggestion!.map(c => c.id)).toContain(card7Heart.id);
    });

    it('Returns null if pair cannot beat target pair', () => {
      const targetPair = Combinations.detect([
        createCard('8', 'spade'),
        createCard('8', 'club'),
      ])!;

      const card7Spade = createCard('7', 'spade');
      const card7Heart = createCard('7', 'heart');
      const hand = [card7Spade, card7Heart];

      // 7 pair cannot beat 8 pair
      const suggestion = Compare.findSmartSuggestion(card7Spade, hand, targetPair);
      expect(suggestion).toBeNull();
    });

    it('Auto-predicts winning triple when clicking a card in a triple', () => {
      const targetTriple = Combinations.detect([
        createCard('5', 'spade'),
        createCard('5', 'club'),
        createCard('5', 'heart'),
      ])!;

      const card8Spade = createCard('8', 'spade');
      const card8Club = createCard('8', 'club');
      const card8Heart = createCard('8', 'heart');
      const card3Spade = createCard('3', 'spade');
      const hand = [card8Spade, card8Club, card8Heart, card3Spade];

      const suggestion = Compare.findSmartSuggestion(card8Spade, hand, targetTriple);
      expect(suggestion).not.toBeNull();
      expect(suggestion!.length).toBe(3);
      expect(suggestion!.map(c => c.id)).toContain(card8Spade.id);
      expect(suggestion!.map(c => c.id)).toContain(card8Club.id);
      expect(suggestion!.map(c => c.id)).toContain(card8Heart.id);
    });

    it('Auto-predicts winning straight containing clicked card', () => {
      const targetStraight = Combinations.detect([
        createCard('3', 'spade'),
        createCard('4', 'club'),
        createCard('5', 'diamond'),
        createCard('6', 'spade'),
      ])!;

      const card4Spade = createCard('4', 'spade');
      const card5Club = createCard('5', 'club');
      const card6Diamond = createCard('6', 'diamond');
      const card7Heart = createCard('7', 'heart');
      const hand = [card4Spade, card5Club, card6Diamond, card7Heart];

      // User clicks 7♥ -> Forms 4-5-6-7 which beats 3-4-5-6
      const suggestion = Compare.findSmartSuggestion(card7Heart, hand, targetStraight);
      expect(suggestion).not.toBeNull();
      expect(suggestion!.length).toBe(4);
      expect(suggestion!.map(c => c.id)).toContain(card7Heart.id);
      expect(suggestion!.map(c => c.id)).toContain(card4Spade.id);
    });

    it('Auto-predicts Tu Quy when clicking card to chop single 2', () => {
      const targetHeo = Combinations.detect([createCard('2', 'heart')])!;

      const card9Spade = createCard('9', 'spade');
      const card9Club = createCard('9', 'club');
      const card9Diamond = createCard('9', 'diamond');
      const card9Heart = createCard('9', 'heart');
      const hand = [card9Spade, card9Club, card9Diamond, card9Heart];

      const suggestion = Compare.findSmartSuggestion(card9Spade, hand, targetHeo);
      expect(suggestion).not.toBeNull();
      expect(suggestion!.length).toBe(4);
    });
  });
});

