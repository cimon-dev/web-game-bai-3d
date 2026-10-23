import { Card, CardCombination, PlayerPublicInfo, ScoreboardEntry, ScoreboardPenalty, getCardDisplayNameVi } from '@game/shared';
import { Combinations } from './Combinations';
import { Compare } from './Compare';
import { Deck } from './Deck';

export interface InternalPlayer {
  id: string;
  name: string;
  seatIndex: number;
  hand: Card[];
  isReady: boolean;
  isConnected: boolean;
  hasPassed: boolean;
  playedCardsCount: number;
  avatar?: import('@game/shared').AvatarCustomization;
  selectedCardIndices?: number[];
}

export class TienLenRule {
  public players: InternalPlayer[] = [];
  public currentTurnPlayerId: string | null = null;
  public tableLastPlay: { playerId: string; combination: CardCombination } | null = null;
  public roundPlayerPassedIds: Set<string> = new Set();
  public firstTurn3SpadeRequired: boolean = false;
  public firstTurnRequiredCardId: string | null = null;
  public firstTurnRequiredCardName: string | null = null;
  public gamePhase: 'waiting' | 'dealing' | 'playing' | 'game_over' = 'waiting';
  public winnerId: string | null = null;
  public lastGameWinnerId: string | null = null;

  public initPlayers(playerList: { id: string; name: string; seatIndex: number }[]): void {
    this.players = playerList.map(p => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      hand: [],
      isReady: false,
      isConnected: true,
      hasPassed: false,
      playedCardsCount: 0,
    }));
  }

  public startGame(): { firstTurnPlayerId: string } {
    if (this.players.length < 2 || this.players.length > 4) {
      throw new Error('Số người chơi phải từ 2 đến 4.');
    }

    const shuffled = Deck.createShuffledDeck();
    const hands = Deck.dealHands(shuffled, this.players.length);

    this.tableLastPlay = null;
    this.roundPlayerPassedIds.clear();
    this.winnerId = null;

    for (let i = 0; i < this.players.length; i++) {
      this.players[i].hand = hands[i];
      this.players[i].hasPassed = false;
      this.players[i].playedCardsCount = 0;
    }

    // Determine first turn: Winner of last game leads, or player holding smallest card (3♠ or lowest dealt card)
    let startingIndex = 0;
    if (this.lastGameWinnerId) {
      const idx = this.players.findIndex(p => p.id === this.lastGameWinnerId);
      if (idx !== -1) {
        startingIndex = idx;
        this.firstTurn3SpadeRequired = false;
        this.firstTurnRequiredCardId = null;
        this.firstTurnRequiredCardName = null;
      } else {
        const { playerIndex, smallestCard } = Deck.findStartingPlayerAndCard(hands);
        startingIndex = playerIndex;
        this.firstTurnRequiredCardId = smallestCard.id;
        this.firstTurnRequiredCardName = getCardDisplayNameVi(smallestCard);
        this.firstTurn3SpadeRequired = true;
      }
    } else {
      const { playerIndex, smallestCard } = Deck.findStartingPlayerAndCard(hands);
      startingIndex = playerIndex;
      this.firstTurnRequiredCardId = smallestCard.id;
      this.firstTurnRequiredCardName = getCardDisplayNameVi(smallestCard);
      this.firstTurn3SpadeRequired = true;
    }

    this.currentTurnPlayerId = this.players[startingIndex].id;
    this.gamePhase = 'playing';

    return { firstTurnPlayerId: this.currentTurnPlayerId };
  }

  public canPlay(
    playerId: string,
    cardIds: string[]
  ): { valid: boolean; error?: string; combination?: CardCombination } {
    if (this.gamePhase !== 'playing') {
      return { valid: false, error: 'Ván đấu chưa bắt đầu hoặc đã kết thúc.' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { valid: false, error: 'Chưa tới lượt của bạn.' };
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Không tìm thấy người chơi.' };
    }

    if (!cardIds || cardIds.length === 0) {
      return { valid: false, error: 'Vui lòng chọn ít nhất 1 lá bài.' };
    }

    // Check ownership of cards
    const selectedCards: Card[] = [];
    for (const cardId of cardIds) {
      const found = player.hand.find(c => c.id === cardId);
      if (!found) {
        return { valid: false, error: 'Bạn không sở hữu lá bài này.' };
      }
      selectedCards.push(found);
    }

    // Detect combination
    const combination = Combinations.detect(selectedCards);
    if (!combination) {
      return { valid: false, error: 'Tổ hợp bài không hợp lệ.' };
    }

    // First turn of the game check: MUST contain the smallest opening card
    if (this.firstTurn3SpadeRequired && this.firstTurnRequiredCardId) {
      const hasReq = selectedCards.some(c => c.id === this.firstTurnRequiredCardId);
      if (!hasReq) {
        const cardName = this.firstTurnRequiredCardName || (this.firstTurnRequiredCardId === '3_spade' ? '3 Bích (3♠)' : 'quân bài nhỏ nhất');
        return { valid: false, error: `Nước đi đầu tiên bắt buộc phải chứa ${cardName}.` };
      }
    } else if (this.firstTurn3SpadeRequired) {
      const has3Spade = selectedCards.some(c => c.id === '3_spade');
      if (!has3Spade) {
        return { valid: false, error: 'Nước đi đầu tiên bắt buộc phải chứa 3 Bích (3♠).' };
      }
    }

    // Check if player passed earlier in this round
    // Exception: 4 pairs consecutive can cut at any time without following trick!
    if (player.hasPassed && combination.type !== 'four_pairs_consecutive') {
      return { valid: false, error: 'Bạn đã bỏ lượt trong vòng này.' };
    }

    // If table is free (new round / no cards yet)
    if (!this.tableLastPlay) {
      return { valid: true, combination };
    }

    // If table has cards, check if combination can beat it
    if (!Compare.canBeat(combination, this.tableLastPlay.combination)) {
      return { valid: false, error: 'Bài đánh ra không đè được bài trên bàn.' };
    }

    return { valid: true, combination };
  }

  public playCards(
    playerId: string,
    cardIds: string[]
  ): {
    success: boolean;
    error?: string;
    combination?: CardCombination;
    isGameOver: boolean;
    nextPlayerId: string | null;
    scoreboard?: ScoreboardEntry[];
  } {
    const check = this.canPlay(playerId, cardIds);
    if (!check.valid || !check.combination) {
      return {
        success: false,
        error: check.error || 'Nước đi không hợp lệ.',
        isGameOver: false,
        nextPlayerId: this.currentTurnPlayerId,
      };
    }

    const player = this.players.find(p => p.id === playerId)!;
    const cardIdSet = new Set(cardIds);

    // Remove cards from player's hand
    player.hand = player.hand.filter(c => !cardIdSet.has(c.id));
    player.playedCardsCount += cardIds.length;
    this.firstTurn3SpadeRequired = false;
    this.firstTurnRequiredCardId = null;
    this.firstTurnRequiredCardName = null;

    // Update table
    this.tableLastPlay = {
      playerId,
      combination: check.combination,
    };

    // Check game over (TLMN Dem La: first player with empty hand wins!)
    if (player.hand.length === 0) {
      this.gamePhase = 'game_over';
      this.winnerId = playerId;
      this.lastGameWinnerId = playerId;
      const scoreboard = this.calculateScoreboard();
      return {
        success: true,
        combination: check.combination,
        isGameOver: true,
        nextPlayerId: null,
        scoreboard,
      };
    }

    // Advance turn to next active player
    const nextPlayerId = this.findNextPlayerId(playerId);
    this.currentTurnPlayerId = nextPlayerId;

    return {
      success: true,
      combination: check.combination,
      isGameOver: false,
      nextPlayerId,
    };
  }

  public passTurn(playerId: string): {
    success: boolean;
    error?: string;
    roundReset: boolean;
    nextPlayerId: string;
  } {
    if (this.gamePhase !== 'playing') {
      return { success: false, error: 'Ván đấu chưa diễn ra.', roundReset: false, nextPlayerId: '' };
    }

    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, error: 'Chưa tới lượt của bạn.', roundReset: false, nextPlayerId: '' };
    }

    if (!this.tableLastPlay) {
      return {
        success: false,
        error: 'Bạn đang cầm vòng mới, không thể bỏ lượt.',
        roundReset: false,
        nextPlayerId: playerId,
      };
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Không tìm thấy người chơi.', roundReset: false, nextPlayerId: '' };
    }

    player.hasPassed = true;
    this.roundPlayerPassedIds.add(playerId);

    // Count how many players have NOT passed
    const activePlayers = this.players.filter(p => !p.hasPassed);

    // If only 1 player remains (which is the one who played the highest combination on table)
    if (activePlayers.length <= 1) {
      // Trick ends! Round resets!
      const roundWinnerId = this.tableLastPlay.playerId;
      this.resetRound();
      this.currentTurnPlayerId = roundWinnerId;
      return {
        success: true,
        roundReset: true,
        nextPlayerId: roundWinnerId,
      };
    }

    // Advance to next active player
    const nextPlayerId = this.findNextPlayerId(playerId);
    this.currentTurnPlayerId = nextPlayerId;
    return {
      success: true,
      roundReset: false,
      nextPlayerId,
    };
  }

  public autoPlayTimeout(playerId: string): {
    action: 'play' | 'pass';
    cardIds?: string[];
    roundReset?: boolean;
    nextPlayerId: string;
    isGameOver: boolean;
    scoreboard?: ScoreboardEntry[];
  } {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.hand.length === 0) {
      return { action: 'pass', nextPlayerId: '', isGameOver: false };
    }

    const isLeadTurn = this.tableLastPlay === null;

    // "nếu là lượt đầu tiên của người đó đánh (bắt đầu vòng/lượt tự do) thì mới là đánh quân nhỏ nhất"
    if (isLeadTurn) {
      const smallestCards = Compare.findSmallestPlayable(
        player.hand,
        null,
        this.firstTurnRequiredCardId || this.firstTurn3SpadeRequired
      );

      if (smallestCards && smallestCards.length > 0) {
        const cardIds = smallestCards.map(c => c.id);
        const res = this.playCards(playerId, cardIds);
        if (res.success) {
          return {
            action: 'play',
            cardIds,
            isGameOver: res.isGameOver,
            nextPlayerId: res.nextPlayerId || '',
            scoreboard: res.scoreboard,
          };
        }
      }
    }

    // Nếu không phải lượt đầu tiên (đã có bài trên bàn): tự động bỏ lượt
    const passRes = this.passTurn(playerId);
    return {
      action: 'pass',
      roundReset: passRes.roundReset,
      nextPlayerId: passRes.nextPlayerId,
      isGameOver: false,
    };
  }

  public resetRound(): void {
    this.tableLastPlay = null;
    this.roundPlayerPassedIds.clear();
    for (const p of this.players) {
      p.hasPassed = false;
    }
  }

  private findNextPlayerId(fromPlayerId: string): string {
    const currentIndex = this.players.findIndex(p => p.id === fromPlayerId);
    const n = this.players.length;

    for (let step = 1; step <= n; step++) {
      const nextIdx = (currentIndex + step) % n;
      const candidate = this.players[nextIdx];
      if (!candidate.hasPassed) {
        return candidate.id;
      }
    }

    return fromPlayerId;
  }

  public calculateScoreboard(): ScoreboardEntry[] {
    const entries: ScoreboardEntry[] = [];
    let totalPenalty = 0;

    for (const player of this.players) {
      if (player.id === this.winnerId) {
        continue;
      }

      const remaining = player.hand.length;
      let thoiHeoDen = 0;
      let thoiHeoDo = 0;
      let thoi3DoiThong = 0;
      let thoiTuQuy = 0;
      let thoi4DoiThong = 0;

      // Check remaining cards for Heo
      for (const card of player.hand) {
        if (card.rankValue === 15) {
          if (card.suit === 'spade' || card.suit === 'club') {
            thoiHeoDen++;
          } else {
            thoiHeoDo++;
          }
        }
      }

      // Check combinations in remaining hand for Hàng
      if (Combinations.isFourPairsConsecutive(player.hand)) {
        thoi4DoiThong++;
      } else if (player.hand.length >= 4) {
        // Count four of a kind
        const rankCounts = new Map<number, number>();
        for (const card of player.hand) {
          rankCounts.set(card.rankValue, (rankCounts.get(card.rankValue) || 0) + 1);
        }
        for (const count of rankCounts.values()) {
          if (count === 4) thoiTuQuy++;
        }
      }

      const isCong = player.playedCardsCount === 0;

      // Base penalty in Đếm Lá: 1 point per remaining card
      let penaltyPoints = remaining;
      penaltyPoints += thoiHeoDen * 1;
      penaltyPoints += thoiHeoDo * 2;
      penaltyPoints += thoi3DoiThong * 2;
      penaltyPoints += thoiTuQuy * 3;
      penaltyPoints += thoi4DoiThong * 4;

      if (isCong) {
        penaltyPoints = Math.max(penaltyPoints * 2, 26);
      }

      totalPenalty += penaltyPoints;

      const penalty: ScoreboardPenalty = {
        thoiHeoDen,
        thoiHeoDo,
        thoi3DoiThong,
        thoiTuQuy,
        thoi4DoiThong,
        isCong,
      };

      entries.push({
        playerId: player.id,
        playerName: player.name,
        seatIndex: player.seatIndex,
        rank: 2, // loser
        remainingCards: remaining,
        penalty,
        scoreDelta: -penaltyPoints,
      });
    }

    // Add winner entry
    const winner = this.players.find(p => p.id === this.winnerId)!;
    entries.unshift({
      playerId: winner.id,
      playerName: winner.name,
      seatIndex: winner.seatIndex,
      rank: 1, // Winner
      remainingCards: 0,
      penalty: {
        thoiHeoDen: 0,
        thoiHeoDo: 0,
        thoi3DoiThong: 0,
        thoiTuQuy: 0,
        thoi4DoiThong: 0,
        isCong: false,
      },
      scoreDelta: totalPenalty,
    });

    return entries;
  }

  public getPublicPlayers(): PlayerPublicInfo[] {
    return this.players.map(p => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      cardCount: p.hand.length,
      isReady: p.isReady,
      isConnected: p.isConnected,
      isTurn: p.id === this.currentTurnPlayerId,
      hasPassed: p.hasPassed,
      rankPosition: p.id === this.winnerId ? 1 : null,
      avatar: p.avatar,
      selectedCardIndices: p.selectedCardIndices,
    }));
  }
}
