// ============================================================
// 特殊效果处理器
// 锁定 / 随机移动 / 棋盘置换 / 粒子重排 / 条件分支 / 额外回合 / 直接升级
// ============================================================

import {
  GameState, PlayerState, PlayCardParams,
  GridPos, Direction, ParticleType,
  ConditionalEffect, CardAtomicEffect,
} from '../../state/types';
import {
  addLog, getOpponents, getCurrentPlayer, isInBounds, hasParticle,
} from '../../state/GameState';
import { getCardDef, getUpgradeRewardCard, createCardInstance } from '../CardRegistry';

function findCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

/** 锁定对手一个粒子（持续一回合） */
export function applyLockParticle(
  state: GameState,
  effect: { player: 'opponent'; pos: GridPos }
): void {
  const opponent = getOpponents(state, findCurrentPlayer(state).id)[0];
  if (!opponent) return;
  const { row, col } = effect.pos;
  if (!isInBounds({ row, col }, opponent.labSize)) return;
  if (!hasParticle(opponent.lab, { row, col })) return;
  if (!opponent.lockedCells.some(c => c.row === row && c.col === col)) {
    opponent.lockedCells.push({ row, col });
  }
  addLog(state, opponent.id, `${opponent.name} 的粒子 (${row},${col}) 被锁定，下回合不可移动`);
}

const COMPASS: Direction[] = ['up', 'down', 'left', 'right'];
const COMPASS_VECS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 },
};

/** 随机移动一个粒子 */
export function applyRandomMoveParticle(
  state: GameState,
  effect: { player: 'self' | 'opponent' }
): string[] {
  const eliminated: string[] = [];
  const target = effect.player === 'self'
    ? findCurrentPlayer(state)
    : getOpponents(state, findCurrentPlayer(state).id)[0];
  if (!target) return eliminated;

  // 找一个可移动的非锁定粒子
  const candidates: GridPos[] = [];
  for (let r = 0; r < target.labSize; r++) {
    for (let c = 0; c < target.labSize; c++) {
      if (target.lab[r][c] && !target.lockedCells.some(l => l.row === r && l.col === c)) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  if (candidates.length === 0) {
    addLog(state, target.id, `${target.name} 无可移动位置`);
    return eliminated;
  }

  const from = candidates[Math.floor(Math.random() * candidates.length)];
  const particle = target.lab[from.row][from.col]!;

  // Fisher-Yates 随机方向顺序
  const dirs = [...COMPASS];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }

  for (const dir of dirs) {
    const v = COMPASS_VECS[dir];
    const to: GridPos = { row: from.row + v.dr, col: from.col + v.dc };
    if (isInBounds(to, target.labSize) && !target.lab[to.row][to.col]) {
      target.lab[from.row][from.col] = null;
      target.lab[to.row][to.col] = particle;
      addLog(state, target.id, `${target.name} 的粒子随机移动到 (${to.row},${to.col})`);
      return eliminated;
    }
  }
  return eliminated;
}

/** 棋盘置换：2人颠倒，4人逆时针旋转 */
export function applyBoardPermute(state: GameState): void {
  const alivePlayers = state.players.filter(p => p.alive);
  if (alivePlayers.length === 2) {
    [alivePlayers[0].lab, alivePlayers[1].lab] = [alivePlayers[1].lab, alivePlayers[0].lab];
    addLog(state, 'system', '时空弯曲：双方棋盘颠倒！');
  } else if (alivePlayers.length === 4) {
    const [a, b, c, d] = alivePlayers;
    // 逆时针旋转：A→B→C→D→A
    const oldA = a.lab; a.lab = b.lab; b.lab = c.lab; c.lab = d.lab; d.lab = oldA;
    addLog(state, 'system', '时空弯曲：棋盘逆时针旋转！');
  }
}

/** 布朗运动：打乱每个玩家棋盘上的粒子位置 */
export function applyShuffleParticles(state: GameState, _effect: any): void {
  for (const player of state.players) {
    if (!player.alive) continue;
    // 收集所有粒子
    const particles: ParticleType[] = [];
    for (let r = 0; r < player.labSize; r++) {
      for (let c = 0; c < player.labSize; c++) {
        if (player.lab[r][c]) {
          particles.push(player.lab[r][c]!);
          player.lab[r][c] = null;
        }
      }
    }
    // Fisher-Yates 打乱
    for (let i = particles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [particles[i], particles[j]] = [particles[j], particles[i]];
    }
    // 按行填充回
    let idx = 0;
    for (let r = 0; r < player.labSize && idx < particles.length; r++) {
      for (let c = 0; c < player.labSize && idx < particles.length; c++) {
        if (!player.lab[r][c]) {
          player.lab[r][c] = particles[idx++];
        }
      }
    }
  }
  addLog(state, 'system', '布朗运动：所有玩家的粒子被打乱！');
}

/** 卡拉比-丘流形：标记需 UI 交互 */
export function applyRearrangeLab(
  state: GameState,
  player: PlayerState
): void {
  addLog(state, player.id, `使用卡拉比-丘流形，可重新排列实验场`);
}

/** 额外回合 */
export function applyExtraTurn(state: GameState, player: PlayerState): void {
  player.extraTurn = true;
  addLog(state, player.id, `${player.name} 获得一个额外回合`);
}

/** 直接升级（大统一理论） */
export function applyDirectUpgrade(
  state: GameState,
  player: PlayerState,
  effect: { targetLevel: number; cost: number; entropyPenalty: number }
): string[] {
  const eliminated: string[] = [];
  if (player.energy < effect.cost) {
    addLog(state, player.id, `能量不足，无法使用大统一理论`);
    return eliminated;
  }
  player.energy -= effect.cost;
  if (player.researchLevel === 5 && effect.targetLevel === 6) {
    player.researchLevel = 6;
    const rewardCard = getUpgradeRewardCard(6);
    if (rewardCard) {
      player.hand.push(createCardInstance(rewardCard.id));
      addLog(state, player.id, '大统一理论！升至Lv.6，获得维度打击');
    }
  }
  player.entropy += effect.entropyPenalty;
  addLog(state, player.id, `熵值 +${effect.entropyPenalty}`);
  if (player.entropy >= player.maxEntropy) eliminated.push(player.id);
  return eliminated;
}

/** 宇宙膨胀标记（实际效果由 CosmicDie 处理） */
export function applyCosmicExpansion(state: GameState): void {
  addLog(state, 'system', '宇宙膨胀：实验场临时扩展为5x5');
}

/** 量子涨落标记（实际效果由 CosmicDie 处理） */
export function applyQuantumFluctuation(state: GameState): void {
  addLog(state, 'system', '量子涨落：玩家间传递手牌');
}

/** 跳过回合 */
export function applySkipTurn(
  opponent: PlayerState,
  _effect: { target: string }
): void {
  opponent.skipNextTurn = true;
}

/** 条件分支执行（观测坍缩等） */
export function applyConditional(
  state: GameState,
  effect: ConditionalEffect,
  params: PlayCardParams | undefined,
  resolveSubEffect: (eff: CardAtomicEffect) => string[]
): string[] {
  const eliminated: string[] = [];
  const guessCorrect = params?.guessCorrect === true;
  const branch = guessCorrect ? effect.then : (effect.else || []);
  for (const subEffect of branch) {
    eliminated.push(...resolveSubEffect(subEffect));
  }
  return eliminated;
}

/** 占位效果（保留为日志） */
export function applyPlaceholder(
  state: GameState,
  player: PlayerState,
  effect: { cardId: string }
): void {
  addLog(state, player.id, `[未实现] 卡牌效果 "${effect.cardId}" 尚未实现`);
}
