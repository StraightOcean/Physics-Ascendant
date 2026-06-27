// ============================================================
// 手牌/牌库类效果处理器
// draw / discard / steal / shuffle_hand
// ============================================================

import {
  GameState, PlayerState, PlayCardParams, CardInstance,
} from '../../state/types';
import {
  addLog, getOpponents, getCurrentPlayer,
} from '../../state/GameState';
import { drawFromDeck, shuffleDeck, getCardDef } from '../CardRegistry';

/** 抽牌（主牌库/科技牌库，含弃牌堆洗回） */
export function applyDrawCards(
  state: GameState,
  player: PlayerState,
  effect: { source: string; count: number; techLevel?: number }
): void {
  if (effect.source === 'tech' && effect.techLevel) {
    const techDeck = state.techDecks[effect.techLevel];
    if (techDeck && techDeck.length > 0) {
      const { drawn, remaining } = drawFromDeck(techDeck, effect.count);
      state.techDecks[effect.techLevel] = remaining;
      player.hand.push(...drawn);
      addLog(state, player.id, `从Lv.${effect.techLevel}科技库抽取${drawn.length}张`);
    }
    return;
  }

  let deck = state.mainDecks[player.id] || [];
  if (deck.length < effect.count) {
    const discard = state.discardPiles[player.id] || [];
    if (discard.length > 0) {
      const reshuffled = shuffleDeck(discard);
      deck = [...deck, ...reshuffled];
      state.discardPiles[player.id] = [];
      addLog(state, player.id, '弃牌堆已洗回牌库');
    }
  }
  if (deck.length === 0) {
    addLog(state, player.id, `主牌库为空，无法抽牌`);
    return;
  }
  const drawCount = Math.min(effect.count, deck.length);
  const { drawn, remaining } = drawFromDeck(deck, drawCount);
  state.mainDecks[player.id] = remaining;
  player.hand.push(...drawn);
  addLog(state, player.id, `从主牌库抽取${drawn.length}张`);
}

/** 弃牌（可指定最高科技 / 玩家选择 / 随机） */
export function applyDiscardCards(
  state: GameState,
  player: PlayerState,
  effect: { player: string; count: number; cardType?: string; highestTechOnly?: boolean },
  params?: PlayCardParams
): void {
  const targetPlayer = effect.player === 'self' ? player : getOpponents(state, getCurrentPlayer(state).id)[0];
  if (!targetPlayer) return;

  const cardsToDiscard = selectCardsToDiscard(state, targetPlayer, effect, params);
  moveCardsToDiscard(state, targetPlayer, cardsToDiscard);
  addLog(state, targetPlayer.id, `弃掉${cardsToDiscard.length}张手牌`);
}

/** 选择要弃掉的卡（最高科技卡优先 / 玩家指定 / 取前 N 张） */
function selectCardsToDiscard(
  state: GameState,
  targetPlayer: PlayerState,
  effect: { count: number; highestTechOnly?: boolean },
  params?: PlayCardParams
): CardInstance[] {
  if (effect.highestTechOnly) {
    // 找最高等级科技卡；若无科技卡则退回到基础卡
    const techCards = targetPlayer.hand.filter(c => (getCardDef(c.defId)?.level ?? 0) > 0);
    if (techCards.length > 0) {
      const maxLevel = Math.max(...techCards.map(c => getCardDef(c.defId)!.level));
      return techCards.filter(c => getCardDef(c.defId)!.level === maxLevel).slice(0, effect.count);
    }
    return targetPlayer.hand.slice(0, effect.count * 2);
  }

  if (params?.chooseDiscardCardIds && params.chooseDiscardCardIds.length > 0) {
    const ids = new Set(params.chooseDiscardCardIds);
    return targetPlayer.hand.filter(c => ids.has(c.id)).slice(0, effect.count);
  }

  // 默认：取前 N 张
  return targetPlayer.hand.slice(0, effect.count);
}

/** 将指定卡牌移到弃牌堆 */
function moveCardsToDiscard(
  state: GameState,
  targetPlayer: PlayerState,
  cards: CardInstance[]
): void {
  if (cards.length === 0) return;
  if (!state.discardPiles[targetPlayer.id]) state.discardPiles[targetPlayer.id] = [];
  for (const card of cards) {
    const idx = targetPlayer.hand.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      targetPlayer.hand.splice(idx, 1);
      state.discardPiles[targetPlayer.id].push(card);
    }
  }
}

/** 偷取对手手牌（当前实现：取第一张） */
export function applyStealCard(
  state: GameState,
  player: PlayerState,
  _effect: { from: string; count: number; random?: boolean }
): void {
  const opponent = getOpponents(state, player.id)[0];
  if (!opponent || opponent.hand.length === 0) return;
  const stolen = opponent.hand.splice(0, 1);
  player.hand.push(...stolen);
  addLog(state, player.id, `从 ${opponent.name} 偷取1张手牌`);
}

/** 重洗手牌（保留科技卡，重新抽 N 张） */
export function applyShuffleHand(
  state: GameState,
  player: PlayerState,
  effect: { keepTech: boolean; drawCount: number }
): void {
  const isTechCard = (c: CardInstance) => (getCardDef(c.defId)?.level ?? 0) > 0;
  const techCards = effect.keepTech ? player.hand.filter(isTechCard) : [];
  const nonTech = player.hand.filter(c => !techCards.includes(c));

  if (!state.discardPiles[player.id]) state.discardPiles[player.id] = [];
  state.discardPiles[player.id].push(...nonTech);

  const shuffled = shuffleDeck([...(state.mainDecks[player.id] || [])]);
  const { drawn, remaining } = drawFromDeck(shuffled, effect.drawCount);
  state.mainDecks[player.id] = remaining;
  player.hand = [...techCards, ...drawn];
  addLog(state, player.id, `超弦共振：手牌重洗，保留科技卡，抽取${effect.drawCount}张`);
}
