// ============================================================
// 引擎入口 - 统一导出
// ============================================================

// 核心类型
export * from './state/types';
export * from './state/CardRequirements';

// 游戏状态管理
export * from './state/GameState';

// 卡牌系统
export * from './cards/CardRegistry';
export * from './cards/EffectResolver';

// 规则系统
export * from './rules/MoveValidator';
export * from './rules/UpgradeChecker';
export * from './rules/AnnihilationChecker';

// 回合系统
export * from './phases/TurnManager';

// 宇宙骰子
export * from './events/CosmicDie';

// AI 系统
export * from './ai/Evaluator';
export * from './ai/AIPlayer';

// 遗产机制
export * from './legacy/LegacyMechanism';

// ============================================================
// 开放 API：注册表与 MOD 管理
// ============================================================

// 网络消息类型
export * from './network/NetworkMessages';

// MOD 包类型
export * from './mod/types';

// MOD 管理器
export { loadMod, unloadMod, getLoadedMods, isModLoaded } from './mod/ModManager';

// 效果处理器注册表
export {
  registerEffectHandler,
  getEffectHandler,
  hasEffectHandler,
  unregisterEffectHandler,
  getRegisteredEffectTypes,
} from './registry/EffectRegistry';

// 宇宙骰子事件注册表
export {
  registerCosmicEvent,
  registerCosmicEvents,
  getCosmicEvent,
  hasCosmicEvent,
  unregisterCosmicEvent,
  getRegisteredCosmicEventIds,
  getAllCosmicEvents,
} from './registry/CosmicEventRegistry';

// 升级检查器注册表
export {
  registerUpgrade,
  getUpgradeConfig,
  getUpgradeChecker,
  unregisterUpgrade,
  getRegisteredUpgradeLevels,
  getAllUpgradeConfigs,
} from './registry/UpgradeRegistry';

// ============================================================
// 便捷的游戏初始化
// ============================================================

import { createGameState, addLog } from './state/GameState';
import { createMainDeck, createAllTechDecks, shuffleDeck } from './cards/CardRegistry';
import { GameState } from './state/types';

/**
 * 初始化一局新游戏
 */
export function initGame(
  playerNames: string[],
  playerCount: 2 | 4
): GameState {
  const state = createGameState(playerNames, playerCount);

  // 为每位玩家创建独立主牌库
  for (const player of state.players) {
    state.mainDecks[player.id] = createMainDeck();
  }

  // 创建科技副牌库
  state.techDecks = createAllTechDecks();

  // 开局各摸初始手牌（统一5张）
  for (const player of state.players) {
    const deck = state.mainDecks[player.id];
    const handCards = deck.splice(0, 5);
    player.hand = handCards;
  }

  addLog(state, 'system', `游戏开始！${playerCount}人对战`);
  return state;
}
