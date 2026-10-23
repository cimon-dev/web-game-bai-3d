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
});
