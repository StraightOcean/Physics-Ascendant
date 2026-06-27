// ============================================================
// 回合管理系统 - 6个阶段完整流程（rule.md v2.0 §五）
//   阶段0 宇宙骰子 / 阶段1 宇宙熵增 / 阶段2 补给与抽牌
//   阶段3 主要行动 / 阶段4 湮灭清算 / 阶段5 回合结束
// ============================================================

import {
  GameState,
  GamePhase,
  PlayerState,
  PlayCardParams,
  CardInstance,
  ParticleType,
  ANTIMATTER_PAIR,
  UPGRADE_REQUIREMENTS,
} from '../state/types';
import {
  getCurrentPlayer,
  getAlivePlayers,
  getOpponents,
  getNextAlivePlayerIndex,
  addLog,
  getPlayersCounterClockwise,
  findPlayer,
} from '../state/GameState';
import { drawFromDeck, shuffleDeck, getCardDef } from '../cards/CardRegistry';
import { performAnnihilationPhase } from '../rules/AnnihilationChecker';
import { rollCosmicDie, applyCosmicEvent, cleanupCosmicEvent } from '../events/CosmicDie';
import { checkAndProcessLegacies } from '../legacy/LegacyMechanism';
import { aiDecideMainAction, AIDifficulty, AIDecision } from '../ai/AIPlayer';
import { executePlayCard, executeDiscardCard } from './CardPlayer';
import { executeUpgrade } from './UpgradeHandler';

// 从子模块导入并重新导出（保持向后兼容）
export { executePlayCard, executeDiscardCard, getHandOverflow } from './CardPlayer';
export { executeUpgrade } from './UpgradeHandler';

// ============================================================
// 回合入口
// ============================================================

/**
 * 执行回合自动阶段（0-2）：宇宙骰子、熵增、补给抽牌
 * 由 UI 层在回合开始时调用，完成后进入玩家交互阶段
 */
export function executeTurnAutoPhases(state: GameState): { eliminated: string[] } {
  const eliminated: string[] = [];
  const currentPlayer = getCurrentPlayer(state);

  // 清除锁定标记（摩擦力矩仅持续一回合）
  clearLocks(state);

  // 检查是否被跳过（时间膨胀）
  if (currentPlayer.skipNextTurn) {
    currentPlayer.skipNextTurn = false;
    addLog(state, currentPlayer.id, `${currentPlayer.name} 的回合被时间膨胀跳过`);
    state.turn++;
    state.currentPlayerIndex = getNextAlivePlayerIndex(state, state.currentPlayerIndex);
    return { eliminated };
  }

  // 阶段0：宇宙骰子
  executePhase0_CosmicDie(state);

  // 阶段1：宇宙熵增
  executePhase1_EntropyIncrease(state, eliminated);

  // 阶段2：补给与抽牌
  executePhase2_SupplyDraw(state);

  // 标记进入主要行动阶段
  state.phase = GamePhase.MAIN_ACTION;

  return { eliminated };
}

/**
 * 执行回合收尾阶段（5 + 回合结束）：湮灭清算、清理效果、推进回合
 * 由 UI 层在玩家完成阶段3和4后调用
 */
export function executeTurnEndPhases(state: GameState): { eliminated: string[] } {
  const eliminated: string[] = [];

  // 阶段5：湮灭清算
  executePhase5_Annihilation(state, eliminated);

  if (eliminated.length > 0) {
    checkAndProcessLegacies(state);
  }

  // 回合结束
  executePhaseEnd(state);

  // 引擎层强制手牌上限（不再依赖 UI 触发）
  enforceHandLimit(state);

  return { eliminated };
}

/**
 * 执行一个完整回合（兼容旧CLI逻辑）
 */
export function executeTurn(state: GameState): { eliminated: string[] } {
  const eliminated: string[] = [];
  const currentPlayer = getCurrentPlayer(state);

  // 检查是否被跳过（时间膨胀）
  if (currentPlayer.skipNextTurn) {
    currentPlayer.skipNextTurn = false;
    addLog(state, currentPlayer.id, `${currentPlayer.name} 的回合被时间膨胀跳过`);
    state.turn++;
    state.currentPlayerIndex = getNextAlivePlayerIndex(state, state.currentPlayerIndex);
    return { eliminated };
  }

  // 阶段0：宇宙骰子（第4回合起；rule.md v2.0 §九）
  executePhase0_CosmicDie(state);

  // 阶段1：宇宙熵增（第4回合起；rule.md v2.0 §九）
  executePhase1_EntropyIncrease(state, eliminated);

  // 阶段2：补给与抽牌
  executePhase2_SupplyDraw(state);

  // 阶段3：主要行动（由玩家决策，此处返回需要交互的信息）
  // （在实际游戏中由客户端调用 playCard / upgradeResearch）

  // 阶段4：湮灭清算
  executePhase5_Annihilation(state, eliminated);

  // 阶段5：回合结束
  executePhaseEnd(state);

  return { eliminated };
}

// ============================================================
// 阶段0：宇宙骰子
// ============================================================

function executePhase0_CosmicDie(state: GameState): void {
  const cosmicStartTurn = 4;
  if (state.turn < cosmicStartTurn) {
    state.cosmicDieResult = null;
    return;
  }

  state.phase = GamePhase.COSMIC_DIE;
  state.cosmicDieResult = rollCosmicDie();
  addLog(state, 'system', `宇宙骰子：${state.cosmicDieResult}`);

  applyCosmicEvent(state, state.cosmicDieResult);
}

// ============================================================
// 阶段1：宇宙熵增
// ============================================================

function executePhase1_EntropyIncrease(state: GameState, eliminated: string[]): void {
  const entropyStartTurn = 4;
  if (state.turn < entropyStartTurn) return;

  state.phase = GamePhase.ENTROPY_INCREASE;

  for (const player of getAlivePlayers(state)) {
    // 检查法拉第护盾效果
    const hasFaradayEffect = state.temporaryEffects.some(
      (e) => e.type === 'faraday_shield' && e.playerId === player.id && e.duration > 0
    );

    if (!hasFaradayEffect) {
      player.entropy += 1;
      addLog(state, player.id, `宇宙熵增：${player.name} 熵值 +1，当前: ${player.entropy}`);
      if (player.entropy >= player.maxEntropy) {
        eliminated.push(player.id);
      }
    } else {
      addLog(state, player.id, `${player.name} 被法拉第护盾保护，免疫熵增`);
    }
  }
}

// ============================================================
// 阶段2：补给与抽牌
// ============================================================

function executePhase2_SupplyDraw(state: GameState): void {
  state.phase = GamePhase.SUPPLY_DRAW;
  const currentPlayer = getCurrentPlayer(state);

  // v0.2.1 宇宙膨胀二次警告：补给阶段再次提醒
  if (state.temporaryEffects.some((e) => e.type === 'cosmic_expansion_active')) {
    addLog(state, currentPlayer.id,
      `⚠️ 宇宙膨胀进行中：外围粒子回合末湮灭，请勿将核心棋子放至 5x5 外圈`);
  }

  // 能量 +2
  const energyCap = state.temporaryEffects.some(
    (e) => e.type === 'energy_cap_reduce' && e.playerId === currentPlayer.id
  ) ? Math.max(2, currentPlayer.maxEnergy - 2) : currentPlayer.maxEnergy;

  const oldEnergy = currentPlayer.energy;
  currentPlayer.energy = Math.min(currentPlayer.energy + 2, energyCap);
  addLog(state, currentPlayer.id, `补给：能量 ${oldEnergy} → ${currentPlayer.energy}`);

  // 从主牌库抽2张
  drawFromMainDeck(state, currentPlayer, 2);

  // 若研究所等级≥1，可额外从科技副牌库抽1张（自动抽）
  if (currentPlayer.researchLevel >= 1) {
    // 默认抽取最高已解锁等级的科技卡
    const level = currentPlayer.researchLevel;
    drawFromTechDeck(state, currentPlayer, level, 1);
  }
}

// ============================================================
// 阶段5：湮灭清算
// ============================================================

function executePhase5_Annihilation(state: GameState, eliminated: string[]): void {
  state.phase = GamePhase.ANNIHILATION;

  for (const player of getAlivePlayers(state)) {
    // 检查法拉第护盾
    const hasFaradayEffect = state.temporaryEffects.some(
      (e) => e.type === 'faraday_shield' && e.playerId === player.id && e.duration > 0
    );

    // 检查引力透镜效果
    const hasGravitationalLens = state.temporaryEffects.some(
      (e) => e.type === 'gravitational_lens' && e.playerId === player.id
    );

    const { annihilationCount } = performAnnihilationPhase(player.lab, hasGravitationalLens);

    if (annihilationCount > 0) {
      // 湮灭净化熵值（降低，法拉第护盾不生效；rule.md v2.0 §五阶段4）
      player.entropy = Math.max(0, player.entropy - annihilationCount);
      addLog(state, player.id, `湮灭清算：${player.name} 有${annihilationCount}对正反物质湮灭，熵值 -${annihilationCount}`);
    }
  }
}

// ============================================================
// 回合结束
// ============================================================

function executePhaseEnd(state: GameState): void {
  state.phase = GamePhase.TURN_END;

  // 清理宇宙骰子事件
  cleanupCosmicEvent(state);

  // 手牌上限检查 — 不再自动弃牌，由回合结束后玩家选择弃置

  // 递减临时效果
  state.temporaryEffects = state.temporaryEffects
    .map((e) => ({ ...e, duration: e.duration - 1 }))
    .filter((e) => e.duration > 0);

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
    return;
  }

  // 检查额外回合（多重宇宙分裂）
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.extraTurn) {
    currentPlayer.extraTurn = false;
    addLog(state, currentPlayer.id, `${currentPlayer.name} 执行额外回合`);
    return; // 不推进到下一位玩家
  }

  // 下一位玩家
  state.turn++;
  state.currentPlayerIndex = getNextAlivePlayerIndex(state, state.currentPlayerIndex);
}

// ============================================================
// 辅助函数
// ============================================================

function drawFromMainDeck(state: GameState, player: PlayerState, count: number): void {
  let deck = state.mainDecks[player.id] || [];

  if (deck.length < count) {
    // 洗回弃牌堆
    const discard = state.discardPiles[player.id] || [];
    if (discard.length > 0) {
      const reshuffled = shuffleDeck(discard);
      deck = [...deck, ...reshuffled];
      state.discardPiles[player.id] = [];
      addLog(state, player.id, '弃牌堆已洗回牌库');
    }
  }

  const { drawn, remaining } = drawFromDeck(deck, Math.min(count, deck.length));
  state.mainDecks[player.id] = remaining;
  player.hand.push(...drawn);
  addLog(state, player.id, `从主牌库抽取${drawn.length}张`);
}

function drawFromTechDeck(state: GameState, player: PlayerState, level: number, count: number): void {
  const techDeck = state.techDecks[level];
  if (!techDeck || techDeck.length === 0) return;

  const { drawn, remaining } = drawFromDeck(techDeck, count);
  state.techDecks[level] = remaining;
  player.hand.push(...drawn);
  addLog(state, player.id, `从Lv.${level}科技库抽取${drawn.length}张`);
}

/** 强制每位玩家手牌上限为8张（引擎层自动执行，不再依赖UI触发） */
function enforceHandLimit(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive) continue;
    while (player.hand.length > 8) {
      // 优先弃掉基础卡（非科技卡）
      const nonTechIdx = player.hand.findIndex(c => {
        try { return (getCardDef(c.defId)?.level ?? 0) === 0; } catch { return false; }
      });
      const idx = nonTechIdx >= 0 ? nonTechIdx : player.hand.length - 1;
      const card = player.hand.splice(idx, 1)[0];
      if (!state.discardPiles[player.id]) state.discardPiles[player.id] = [];
      state.discardPiles[player.id].push(card);
      addLog(state, player.id, `手牌溢出，自动弃掉1张`);
    }
  }
}

/** 清除所有玩家的锁定粒子标记（摩擦力矩效果仅持续一回合） */
function clearLocks(state: GameState): void {
  for (const player of state.players) {
    player.lockedCells = [];
  }
}

// ============================================================
// 完整回合封装（服务端 / CLI 复用入口）
// ============================================================

/** 完整回合的 AI 决策选项 */
export interface FullTurnOptions {
  /**
   * 当前回合的「主要行动」决策
   * - 不提供则跳过阶段 3（人类玩家手动）
   * - 提供则在回合内自动执行该决策
   */
  autoPlay?: (state: GameState) => AIDecision;
  /** AI 难度（用于自动弃牌时的优先级，缺省 MEDIUM） */
  difficulty?: AIDifficulty;
}

/**
 * 执行一个完整回合：auto 阶段（0-2）+ 主要行动（3）+ end 阶段（5 + 回合结束）
 * 用于服务端 AI 联机 + CLI 自动对战，避免调用方重复拼装 + 双推进 bug
 *
 * 调用方需自行保证 currentPlayerIndex 已指向正确玩家。
 * 若 currentPlayer.alive === false，自动跳到下一存活玩家（避免死循环）。
 */
export function executeFullTurn(
  state: GameState,
  options: FullTurnOptions = {}
): { eliminated: string[] } {
  // 1. 阶段 0-2（auto phases）
  const autoResult = executeTurnAutoPhases(state);
  if (autoResult.eliminated.length > 0) {
    checkAndProcessLegacies(state);
  }

  // 2. 如果当前玩家已死（被跳过 / 出局），直接跳到下一位
  const current = getCurrentPlayer(state);
  if (!current.alive) {
    const result = executeTurnEndPhases(state);
    return result;
  }

  // 3. 阶段 3：主要行动
  if (options.autoPlay) {
    const decision = options.autoPlay(state);
    applyDecision(state, current, decision);
  }

  // 4. 自动弃牌（若溢出）
  autoDiscardOverflow(state, current);

  // 5. 阶段 5 + 回合结束（统一由 executeTurnEndPhases 推进 turn）
  return executeTurnEndPhases(state);
}

/** 应用一次 AI/自动决策 */
function applyDecision(state: GameState, player: PlayerState, decision: AIDecision): void {
  if (decision.action === 'upgrade' && decision.targetLevel) {
    const result = executeUpgrade(state, player.id, decision.targetLevel);
    if (!result.success) {
      addLog(state, player.id, `AI 升级失败: ${result.reason}`);
    }
    return;
  }
  if (decision.action === 'play_card' && decision.cardId) {
    const result = executePlayCard(state, player.id, decision.cardId, decision.params);
    if (!result.success) {
      addLog(state, player.id, `AI 出牌失败: ${result.reason}`);
    }
  }
}

/** 若玩家手牌超过上限，自动弃掉基础卡优先（保持 8 张上限） */
function autoDiscardOverflow(state: GameState, player: PlayerState): void {
  let safety = 32; // 最多弃 32 张（防御性循环）
  while (player.hand.length > 8 && safety-- > 0) {
    const idx = player.hand.findIndex(c => {
      try { return (getCardDef(c.defId)?.level ?? 0) === 0; } catch { return false; }
    });
    const card = player.hand.splice(idx >= 0 ? idx : player.hand.length - 1, 1)[0];
    if (!state.discardPiles[player.id]) state.discardPiles[player.id] = [];
    state.discardPiles[player.id].push(card);
    addLog(state, player.id, `手牌溢出，自动弃掉1张`);
  }
}
