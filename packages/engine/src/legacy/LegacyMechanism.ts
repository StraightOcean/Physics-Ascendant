// ============================================================
// 遗产机制 - 玩家出局时触发（rule.md v2.0 §十）
//   1) 收集出局者手牌中所有科技卡（level > 0）
//   2) 选最高等级者作为「遗产池」
//   3) 现存熵值最低玩家从遗产池随机暗抽 1 张
//   4) 同熵值时按逆时针最近者优先（多人同回合出局按先手顺序结算）
// ============================================================

import {
  GameState,
  PlayerState,
  CardInstance,
} from '../state/types';
import {
  getAlivePlayers,
  getLowestEntropyPlayer,
  getNearestCounterClockwise,
  findPlayerIndex,
  findPlayer,
  addLog,
} from '../state/GameState';
import { getCardDef } from '../cards/CardRegistry';

/**
 * 处理单个玩家出局的遗产分配
 */
export function processLegacy(state: GameState, eliminatedPlayerId: string): void {
  const player = findPlayer(state, eliminatedPlayerId);
  if (!player) return;

  addLog(state, eliminatedPlayerId, `${player.name} 出局，触发遗产分配...`);

  // 1. 检查科技手牌
  const techCards = player.hand.filter((c) => {
    const def = getCardDef(c.defId);
    return def && def.level > 0;
  });

  // 2. 若无科技卡，遗产不触发
  if (techCards.length === 0) {
    addLog(state, 'system', '没有科技卡可继承');
    return;
  }

  // 3. 找出等级最高的科技卡
  const maxLevel = Math.max(...techCards.map((c) => getCardDef(c.defId)!.level));
  const legacyPool = techCards.filter((c) => getCardDef(c.defId)!.level === maxLevel);

  // 4. 由熵值最低的存活玩家随机暗抽1张
  const eligiblePlayers = getAlivePlayers(state).filter((p) => p.id !== eliminatedPlayerId);
  if (eligiblePlayers.length === 0) return;

  const lowestEntropy = getLowestEntropyPlayer(state, eliminatedPlayerId);
  let inheritor: PlayerState;

  if (lowestEntropy) {
    // 检查是否有多个同熵值玩家
    const sameEntropyPlayers = eligiblePlayers.filter(
      (p) => p.entropy === lowestEntropy.entropy
    );

    if (sameEntropyPlayers.length > 1) {
      // 熵值相同时，按逆时针最近者获得
      const playerIndex = findPlayerIndex(state, eliminatedPlayerId);
      const nearest = getNearestCounterClockwise(state, playerIndex, sameEntropyPlayers);
      inheritor = nearest || sameEntropyPlayers[0];
    } else {
      inheritor = lowestEntropy;
    }
  } else {
    inheritor = eligiblePlayers[0];
  }

  // 随机暗抽1张
  const chosenCard = legacyPool[Math.floor(Math.random() * legacyPool.length)];
  const cardDef = getCardDef(chosenCard.defId);

  // 从出局玩家手牌中移除遗产卡
  const cardIndex = player.hand.findIndex((c) => c.id === chosenCard.id);
  if (cardIndex >= 0) {
    player.hand.splice(cardIndex, 1);
  }

  // 加入继承者手牌
  inheritor.hand.push(chosenCard);
  addLog(state, inheritor.id, `${inheritor.name} 继承了 ${player.name} 的科技卡：${cardDef?.name} (Lv.${cardDef?.level})`);
}

/**
 * 批量处理出局遗产（按先手顺序）
 */
export function processLegacies(state: GameState, eliminatedPlayerIds: string[]): void {
  // 按玩家索引顺序（先手顺序）处理
  const sortedIds = eliminatedPlayerIds.sort((a, b) => {
    const idxA = findPlayerIndex(state, a);
    const idxB = findPlayerIndex(state, b);
    return idxA - idxB;
  });

  for (const playerId of sortedIds) {
    processLegacy(state, playerId);
  }
}

/**
 * 检查并处理所有出局玩家的遗产
 * 应在回合结束时调用
 */
export function checkAndProcessLegacies(state: GameState): void {
  const eliminated: string[] = [];

  for (const player of state.players) {
    if (!player.alive) continue;
    if (player.entropy >= player.maxEntropy || player.voidEnergy > 5) {
      player.alive = false;
      eliminated.push(player.id);
      addLog(state, player.id, `${player.name} 出局！`);
    }
  }

  if (eliminated.length > 0) {
    processLegacies(state, eliminated);
  }

  // 检查胜利条件
  const alive = getAlivePlayers(state);
  if (alive.length <= 1) {
    state.gameOver = true;
    state.winner = alive.length === 1 ? alive[0].id : null;
    if (state.winner) {
      addLog(state, state.winner, `${alive[0].name} 获得"终极造物主"称号！`);
    } else {
      addLog(state, 'system', '游戏平局！');
    }
  }
}
