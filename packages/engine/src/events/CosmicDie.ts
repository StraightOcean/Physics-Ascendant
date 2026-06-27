// ============================================================
// 宇宙骰子事件系统
// ============================================================

import {
  GameState,
  PlayerState,
  ParticleType,
  COSMIC_EVENTS,
} from '../state/types';
import {
  getAlivePlayers,
  getCurrentPlayer,
  findPlayerIndex,
  addLog,
  isInBounds,
  getParticlesOfType,
  getOccupiedPositions,
} from '../state/GameState';
import { getCosmicEvent, getRegisteredCosmicEventIds } from '../registry/CosmicEventRegistry';

// ============================================================
// 掷骰子
// ============================================================

export function rollCosmicDie(): number {
  // 包含内置事件 (1-6) + MOD 事件 ID
  const allIds = [1, 2, 3, 4, 5, 6, ...getRegisteredCosmicEventIds().filter(id => id > 6)];
  return allIds[Math.floor(Math.random() * allIds.length)];
}

// ============================================================
// 事件应用
// ============================================================

export function applyCosmicEvent(state: GameState, dieResult: number): void {
  // 先检查 MOD 注册的事件，再检查内置事件
  const modEvent = getCosmicEvent(dieResult);
  const builtinEvent = COSMIC_EVENTS[dieResult];
  const event = modEvent || builtinEvent;
  if (!event) return;

  const eventName = 'apply' in event ? modEvent?.name || builtinEvent?.name : (event as any).name;
  const eventDesc = 'apply' in event ? modEvent?.description || builtinEvent?.description : (event as any).description;
  addLog(state, 'system', `宇宙骰子 [${dieResult}]: ${eventName} - ${eventDesc}`);

  // MOD 事件：调用注册好的 apply 函数
  if (modEvent && 'apply' in modEvent) {
    (modEvent as any).apply(state);
    return;
  }

  // 内置事件
  switch (dieResult) {
    case 1:
      applyLightSpeedChange(state);
      break;
    case 2:
      applyQuantumFluctuation(state);
      break;
    case 3:
      applyCosmicExpansion(state);
      break;
    case 4:
      applyStrongInteraction(state);
      break;
    case 5:
      applyWeakDecay(state);
      break;
    case 6:
      applyDarkEnergyBurst(state);
      break;
  }
}

/**
 * 事件1：光速变化
 * 所有"弹射""推力"类位移效果距离+1
 */
function applyLightSpeedChange(state: GameState): void {
  state.temporaryEffects.push({
    type: 'light_speed_change',
    playerId: 'all',
    duration: 1,
    data: { extraDistance: 1 },
  });
}

/**
 * 事件2：量子涨落
 * 所有玩家按逆时针顺序给邻座1张牌
 */
function applyQuantumFluctuation(state: GameState): void {
  const alivePlayers = getAlivePlayers(state);
  if (alivePlayers.length < 2) return;

  const currentIdx = state.currentPlayerIndex;
  const playerCount = state.playerCount;

  for (let offset = 0; offset < playerCount; offset++) {
    const giverIdx = (currentIdx + offset) % playerCount;
    const receiverIdx = (giverIdx + 1) % playerCount;
    const giver = state.players[giverIdx];
    const receiver = state.players[receiverIdx];

    if (!giver.alive || !receiver.alive) continue;
    if (giver.hand.length === 0) continue;

    // 给邻座1张手牌（随机选最后一张，实际应由玩家选择）
    const card = giver.hand.pop()!;
    receiver.hand.push(card);
    addLog(state, giver.id, `量子涨落：${giver.name} 传给 ${receiver.name} 1张牌`);
  }
}

/**
 * 事件3：宇宙膨胀
 * 实验场从3x3扩展到5x5，外围一圈临时格
 */
function applyCosmicExpansion(state: GameState): void {
  for (const player of getAlivePlayers(state)) {
    if (player.labSize === 5) continue;

    // 创建5x5网格，原3x3居中
    const newLab: (ParticleType | null)[][] = [];
    for (let r = 0; r < 5; r++) {
      newLab[r] = [];
      for (let c = 0; c < 5; c++) {
        // 原3x3区域映射到5x5的 [1,1]-[3,3]
        if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
          newLab[r][c] = player.lab[r - 1][c - 1];
        } else {
          newLab[r][c] = null;
        }
      }
    }

    player.lab = newLab;
    player.labSize = 5;
    // v0.2.1 提前警告：让玩家知道外围粒子回合末会湮灭
    addLog(state, player.id,
      `⚠️ ${player.name} 的实验场扩展为5x5 — 注意：外围粒子将在回合末湮灭！`);
  }

  addLog(state, 'system',
    '【宇宙膨胀】外围粒子仅本回合有效，回合末将统一湮灭并 +1 熵/粒子');

  state.temporaryEffects.push({
    type: 'cosmic_expansion_active',
    playerId: 'all',
    duration: 1,
  });
}

/**
 * 事件4：强相互作用
 * 所有玩家场上任意相邻2个夸克(Q)合并为1个质子(P)，移除多余的1个Q
 */
function applyStrongInteraction(state: GameState): void {
  for (const player of getAlivePlayers(state)) {
    const qPositions = getParticlesOfType(player.lab, 'Q');
    if (qPositions.length < 2) continue;

    // 找相邻的两个Q
    for (let i = 0; i < qPositions.length; i++) {
      for (let j = i + 1; j < qPositions.length; j++) {
        const dr = Math.abs(qPositions[i].row - qPositions[j].row);
        const dc = Math.abs(qPositions[i].col - qPositions[j].col);
        if (dr + dc === 1) {
          // 合并
          player.lab[qPositions[i].row][qPositions[i].col] = 'P';
          player.lab[qPositions[j].row][qPositions[j].col] = null;
          addLog(state, player.id, '强相互作用：2个Q合并为1个P');
          break;
        }
      }
    }
  }
}

/**
 * 事件5：弱衰变
 * 所有玩家场上随机1个质子(P)衰变为1个电子(E)，获得1能量
 */
function applyWeakDecay(state: GameState): void {
  for (const player of getAlivePlayers(state)) {
    const pPositions = getParticlesOfType(player.lab, 'P');
    if (pPositions.length === 0) continue;

    const randIdx = Math.floor(Math.random() * pPositions.length);
    const pos = pPositions[randIdx];
    player.lab[pos.row][pos.col] = 'E';
    player.energy += 1;
    addLog(state, player.id, `弱衰变：1个P衰变为E，能量+1`);
  }
}

/**
 * 事件6：暗能量爆发
 * 所有玩家熵值-1，但能量上限本回合-2（即上限变为8）
 */
function applyDarkEnergyBurst(state: GameState): void {
  for (const player of getAlivePlayers(state)) {
    player.entropy = Math.max(0, player.entropy - 1);
    addLog(state, player.id, `暗能量爆发：熵值 -1，当前: ${player.entropy}`);

    state.temporaryEffects.push({
      type: 'energy_cap_reduce',
      playerId: player.id,
      duration: 1,
    });
  }
}

// ============================================================
// 事件清理（回合结束时）
// ============================================================

export function cleanupCosmicEvent(state: GameState): void {
  // 处理宇宙膨胀结束
  const expansionEffect = state.temporaryEffects.find(
    (e) => e.type === 'cosmic_expansion_active'
  );

  if (expansionEffect) {
    for (const player of getAlivePlayers(state)) {
      if (player.labSize === 5) {
        shrinkLab(player, state);
      }
    }
  }
}

/**
 * 将5x5实验场缩回3x3，外围粒子湮灭
 */
function shrinkLab(player: PlayerState, state: GameState): void {
  const newLab: (ParticleType | null)[][] = [];
  let annihilated = 0;

  for (let r = 0; r < 3; r++) {
    newLab[r] = [];
    for (let c = 0; c < 3; c++) {
      newLab[r][c] = player.lab[r + 1][c + 1];
    }
  }

  // 检查外围格子（5x5的第一行/最后一行/第一列/最后一列）
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      // 跳过中心3x3
      if (r >= 1 && r <= 3 && c >= 1 && c <= 3) continue;
      if (player.lab[r][c] !== null) {
        annihilated++;
      }
    }
  }

  player.lab = newLab;
  player.labSize = 3;

  if (annihilated > 0) {
    player.entropy += annihilated;
    addLog(state, player.id, `宇宙膨胀结束：${annihilated}个外围粒子湮灭，熵值 +${annihilated}`);
  }
}
