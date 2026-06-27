// ============================================================
// 升级处理
// ============================================================

import { GameState, UPGRADE_REQUIREMENTS } from '../state/types';
import { findPlayer, addLog } from '../state/GameState';
import { getUpgradeRewardCard, createCardInstance, shuffleDeck, BASIC_CARDS } from '../cards/CardRegistry';
import { checkUpgradeRequirement } from '../rules/UpgradeChecker';

/**
 * 执行升级操作
 */
export function executeUpgrade(
  state: GameState,
  playerId: string,
  targetLevel: number
): { success: boolean; reason?: string; eliminated: string[] } {
  const player = findPlayer(state, playerId);
  if (!player) return { success: false, reason: '玩家不存在', eliminated: [] };

  // 验证等级：必须当前等级+1
  if (targetLevel !== player.researchLevel + 1) {
    return { success: false, reason: `只能升至Lv.${player.researchLevel + 1}`, eliminated: [] };
  }

  const upgradeReq = UPGRADE_REQUIREMENTS[targetLevel];
  if (!upgradeReq || player.energy < upgradeReq.energyCost) {
    return { success: false, reason: `能量不足（需要${upgradeReq.energyCost}）`, eliminated: [] };
  }

  // 检查构型
  const checkResult = checkUpgradeRequirement(player.lab, targetLevel);
  if (!checkResult.satisfied) {
    return { success: false, reason: checkResult.reason, eliminated: [] };
  }

  // 支付能量
  player.energy -= upgradeReq.energyCost;

  // 升级成功
  player.researchLevel = targetLevel;
  player.maxEntropy += 5;
  player.maxEnergy += 1;
  addLog(state, playerId, `${player.name} 研究所升至 Lv.${targetLevel}！熵上限+5→${player.maxEntropy}，能上限+1→${player.maxEnergy}`);

  // 获得升级即得科技卡
  const rewardCard = getUpgradeRewardCard(targetLevel);
  if (rewardCard) {
    player.hand.push(createCardInstance(rewardCard.id));
    addLog(state, playerId, `获得科技卡：${rewardCard.name}`);
  }

  // 洗入基础卡各1张到牌库
  const deck = state.mainDecks[playerId];
  for (const def of BASIC_CARDS) {
    deck.push(createCardInstance(def.id));
  }
  state.mainDecks[playerId] = shuffleDeck(deck);
  addLog(state, playerId, `基础卡库扩充：${BASIC_CARDS.length}张基础卡洗入牌堆`);

  return { success: true, eliminated: [] };
}
