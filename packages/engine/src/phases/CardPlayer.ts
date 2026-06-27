// ============================================================
// 出牌与弃牌处理
// ============================================================

import { GameState, PlayCardParams } from '../state/types';
import { findPlayer, addLog } from '../state/GameState';
import { getCardDef } from '../cards/CardRegistry';
import { resolveEffects } from '../cards/EffectResolver';

/**
 * 打出卡牌
 */
export function executePlayCard(
  state: GameState,
  playerId: string,
  cardId: string,
  params?: PlayCardParams
): { success: boolean; reason?: string; eliminated: string[] } {
  const player = findPlayer(state, playerId);
  if (!player) return { success: false, reason: '玩家不存在', eliminated: [] };

  // 找到手牌中的卡牌
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) return { success: false, reason: '手牌中没有此卡', eliminated: [] };

  const cardInstance = player.hand[cardIndex];
  const cardDef = getCardDef(cardInstance.defId);
  if (!cardDef) return { success: false, reason: '卡牌定义不存在', eliminated: [] };

  // 检查能量
  if (player.energy < cardDef.cost) {
    return { success: false, reason: `能量不足（需要${cardDef.cost}）`, eliminated: [] };
  }

  // 支付能量
  player.energy -= cardDef.cost;

  // 移除手牌
  player.hand.splice(cardIndex, 1);

  // 放入弃牌堆
  if (!state.discardPiles[playerId]) {
    state.discardPiles[playerId] = [];
  }
  state.discardPiles[playerId].push(cardInstance);

  // 记录打出（在效果解析前）
  addLog(state, playerId, `${player.name} 打出了 ${cardDef.name}`);

  // 解析并执行卡牌效果（直接从 CardDef 读取）
  const eliminated = resolveEffects(state, cardDef.effects, params);

  return { success: true, eliminated };
}

/**
 * 由玩家选择弃置指定手牌
 */
export function executeDiscardCard(
  state: GameState,
  playerId: string,
  cardId: string
): { success: boolean; reason?: string } {
  const player = findPlayer(state, playerId);
  if (!player) return { success: false, reason: '玩家不存在' };

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) return { success: false, reason: '手牌中没有此卡' };

  const card = player.hand.splice(cardIndex, 1)[0];
  if (!state.discardPiles[playerId]) {
    state.discardPiles[playerId] = [];
  }
  state.discardPiles[playerId].push(card);
  addLog(state, playerId, '弃掉1张手牌');
  return { success: true };
}

/**
 * 获取手牌溢出数量
 */
export function getHandOverflow(state: GameState, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  return Math.max(0, player.hand.length - 8);
}
