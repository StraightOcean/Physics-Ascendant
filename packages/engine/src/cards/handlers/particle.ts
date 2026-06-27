// ============================================================
// 粒子操作类效果处理器
// spawn / move / push / pull / remove / swap / transform / merge / diagonal
// ============================================================

import {
  GameState, PlayerState, PlayCardParams,
  GridPos, Direction, ParticleType, ANTIMATTER_PAIR,
} from '../../state/types';
import {
  addLog, getOpponents, isInBounds, hasParticle, getParticleAt,
  getEmptyPositions, getParticlesOfType,
} from '../../state/GameState';
import {
  simulatePush, moveParticle, annihilateParticle, spawnParticle,
  validateBasicMove, validatePull, validateRotate,
} from '../../rules/MoveValidator';
import { findPlayer } from '../../state/GameState';

/** 粒子生成（己方空格） */
export function applySpawnParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; pos: GridPos | 'empty_slot'; particle: ParticleType | 'choose_q_or_e' },
  params?: PlayCardParams
): string[] {
  const targetPlayer = effect.player === 'self' ? player : getOpponents(state, player.id)[0];
  if (!targetPlayer) return [];

  let pos: GridPos;
  if (effect.pos === 'empty_slot') {
    if (params?.targetPos) {
      pos = params.targetPos;
    } else {
      const slots = getEmptyPositions(targetPlayer.lab);
      if (slots.length === 0) return [];
      pos = slots[0];
    }
  } else {
    pos = params?.targetPos || (effect.pos as GridPos);
  }

  let type: ParticleType;
  if (effect.particle === 'choose_q_or_e') {
    type = params?.particleType || 'Q';
  } else {
    type = effect.particle;
  }

  const result = spawnParticle(targetPlayer.lab, pos, type);
  if (result.success) {
    addLog(state, targetPlayer.id, `在 (${pos.row}, ${pos.col}) 生成了 ${type}`);
  }
  return [];
}

/** 粒子移动（上下左右 + 步数） */
export function applyMoveParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; from: GridPos; direction: Direction; steps: number },
  params?: PlayCardParams
): void {
  const from = params?.fromPos || effect.from;
  const direction = (params?.direction as Direction | undefined) || effect.direction;
  const steps = effect.steps || 1;

  const validation = validateBasicMove(player.lab, from, direction, steps, player.lockedCells);
  if (!validation.valid) {
    addLog(state, player.id, `移动无效: ${validation.reason}`);
    return;
  }

  const vec = { up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 }, left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 } }[direction];
  if (!vec) { addLog(state, player.id, `无效方向: ${direction}`); return; }
  const to: GridPos = { row: from.row + vec.dr * steps, col: from.col + vec.dc * steps };
  moveParticle(player.lab, from, to);
  addLog(state, player.id, `粒子从 (${from.row},${from.col}) 移动到 (${to.row},${to.col})`);
}

const DIAGONAL_VECTORS: Record<string, { dr: number; dc: number }> = {
  'up-left': { dr: -1, dc: -1 }, 'up-right': { dr: -1, dc: 1 },
  'down-left': { dr: 1, dc: -1 }, 'down-right': { dr: 1, dc: 1 },
};

/** 斜向移动（对角线一格） */
export function applyDiagonalMove(
  state: GameState,
  player: PlayerState,
  effect: { player: string; from: GridPos; direction: string },
  params?: PlayCardParams
): void {
  const from = params?.fromPos || effect.from;
  const direction = (params?.direction || effect.direction) as string;
  const v = DIAGONAL_VECTORS[direction];
  if (!v) { addLog(state, player.id, `无效对角线方向: ${direction}`); return; }
  const to: GridPos = { row: from.row + v.dr, col: from.col + v.dc };
  if (!isInBounds(to, player.lab.length) || hasParticle(player.lab, to)) {
    addLog(state, player.id, '对角线移动无效');
    return;
  }
  const particle = getParticleAt(player.lab, from);
  if (!particle) { addLog(state, player.id, '起点无粒子'); return; }
  player.lab[from.row][from.col] = null;
  player.lab[to.row][to.col] = particle;
  addLog(state, player.id, `粒子波移 (${from.row},${from.col}) → (${to.row},${to.col})`);
}

/** 粒子推动（直推 + 碰撞） */
export function applyPushParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; origin: GridPos; direction: Direction; dealDamageOnCollision?: boolean },
  params?: PlayCardParams
): string[] {
  const eliminated: string[] = [];
  const origin = params?.fromPos || effect.origin;
  const direction = (params?.direction as Direction | undefined) || effect.direction;

  const result = simulatePush(player.lab, origin, direction);
  const particle = annihilateParticle(player.lab, origin);

  if (result.wentOutOfBounds) {
    player.entropy += 1;
    addLog(state, player.id, '粒子被推出实验场边界，湮灭！熵值 +1');
    if (player.entropy >= player.maxEntropy) eliminated.push(player.id);
  } else if (result.hitParticle) {
    if (result.path.length > 0) {
      const stopPos = result.path[result.path.length - 1];
      player.lab[stopPos.row][stopPos.col] = particle;
      addLog(state, player.id, `粒子被推出，停在 (${stopPos.row},${stopPos.col})`);
    }
    if (effect.dealDamageOnCollision) {
      player.entropy += 1;
      const opponent = getOpponents(state, player.id)[0];
      if (opponent) {
        opponent.entropy += 1;
        addLog(state, player.id, `撞到对手粒子，双方各+1熵值`);
        if (opponent.entropy >= opponent.maxEntropy) eliminated.push(opponent.id);
      }
      if (player.entropy >= player.maxEntropy) eliminated.push(player.id);
    }
  } else if (result.finalPos) {
    player.lab[result.finalPos.row][result.finalPos.col] = particle;
    addLog(state, player.id, `粒子被推到 (${result.finalPos.row},${result.finalPos.col})`);
  }

  return eliminated;
}

/** 粒子拉近（可拉对手的粒子） */
export function applyPullParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; target: GridPos; direction: Direction },
  params?: PlayCardParams
): string[] {
  const eliminated: string[] = [];

  const targetPlayer = effect.player === 'opponent'
    ? getOpponents(state, player.id)[0]
    : player;
  if (!targetPlayer) return eliminated;
  const lab = targetPlayer.lab;

  const target = params?.targetPos || effect.target;
  const direction = (params?.direction as Direction | undefined) || effect.direction;

  const validation = validatePull(lab, target, direction);
  if (!validation.valid && !validation.outOfBounds) {
    addLog(state, player.id, `拉近无效: ${validation.reason}`);
    return eliminated;
  }

  if (validation.outOfBounds) {
    const particle = annihilateParticle(lab, target);
    if (particle) {
      targetPlayer.entropy += 1;
      addLog(state, targetPlayer.id,
        `${targetPlayer.name} 的粒子 ${particle} 被拉出实验场边界，湮灭！熵值 +1`);
      if (targetPlayer.entropy >= targetPlayer.maxEntropy) eliminated.push(targetPlayer.id);
    }
    return eliminated;
  }

  const particle = getParticleAt(lab, target);
  if (particle) {
    lab[target.row][target.col] = null;
    lab[validation.newPos!.row][validation.newPos!.col] = particle;
    addLog(state, player.id,
      `粒子从 (${target.row},${target.col}) 被拉近到 (${validation.newPos!.row},${validation.newPos!.col})`);
  }
  return eliminated;
}

/** 移除粒子（带熵增/能量奖励） */
export function applyRemoveParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; pos: GridPos; entropyPenalty?: number; energyReward?: number },
  params?: PlayCardParams
): string[] {
  const eliminated: string[] = [];
  const pos = params?.targetPos || effect.pos;

  const particle = annihilateParticle(player.lab, pos);
  if (particle) {
    addLog(state, player.id, `移除了粒子 ${particle} at (${pos.row},${pos.col})`);
    if (effect.entropyPenalty) {
      player.entropy += effect.entropyPenalty;
      addLog(state, player.id, `熵值 +${effect.entropyPenalty}`);
      if (player.entropy >= player.maxEntropy) eliminated.push(player.id);
    }
    if (effect.energyReward) {
      player.energy += effect.energyReward;
      addLog(state, player.id, `能量 +${effect.energyReward}`);
    }
  }
  return eliminated;
}

/** 互换两个粒子位置 */
export function applySwapParticles(
  state: GameState,
  player: PlayerState,
  effect: { player: string; p1: GridPos; p2: GridPos },
  params?: PlayCardParams
): void {
  const p1 = params?.fromPos || params?.p1 || effect.p1;
  const p2 = params?.toPos   || params?.p2 || effect.p2;

  const validation = validateRotate(player.lab, p1, p2);
  if (!validation.valid) {
    addLog(state, player.id, `旋转无效: ${validation.reason}`);
    return;
  }

  const temp = player.lab[p1.row][p1.col];
  player.lab[p1.row][p1.col] = player.lab[p2.row][p2.col];
  player.lab[p2.row][p2.col] = temp;
  addLog(state, player.id, `粒子 (${p1.row},${p1.col}) 和 (${p2.row},${p2.col}) 互换位置`);
}

/** 粒子转变（普通→反物质 / 自选类型） */
export function applyTransformParticle(
  state: GameState,
  player: PlayerState,
  effect: { player: string; pos: GridPos; from: string; to: string },
  params?: PlayCardParams
): void {
  const targetPlayer = params?.targetPlayerId
    ? findPlayer(state, params.targetPlayerId) || player
    : player;
  const pos = params?.targetPos || effect.pos;
  const current = getParticleAt(targetPlayer.lab, pos);

  if (!current) {
    addLog(state, player.id, `变换失败: ${targetPlayer.name} 场上(${pos.row},${pos.col})位置无粒子`);
    return;
  }

  let targetType: ParticleType;
  if (effect.to === 'its_antimatter') {
    targetType = ANTIMATTER_PAIR[current as ParticleType];
  } else if (effect.to === 'choose') {
    targetType = params?.particleType || 'Q';
  } else {
    targetType = effect.to as ParticleType;
  }

  targetPlayer.lab[pos.row][pos.col] = targetType;
  addLog(state, player.id, `${targetPlayer.name} 的 ${current} 转变为 ${targetType}`);
}

/** 合并粒子（两个同种 → 一个新种，要求相邻） */
export function applyMergeParticles(
  state: GameState,
  player: PlayerState,
  effect: { player: string; from: string; to: string; requireAdjacent?: boolean }
): void {
  const fromType = effect.from as ParticleType;
  const toType = effect.to as ParticleType;
  const positions = getParticlesOfType(player.lab, fromType);

  if (positions.length < 2) return;

  // 找到满足相邻条件的两个位置
  const pair = findAdjacentPair(positions, effect.requireAdjacent);
  if (!pair) return;

  player.lab[pair.a.row][pair.a.col] = toType;
  player.lab[pair.b.row][pair.b.col] = null;
  addLog(state, player.id, `2个${fromType}合并为1个${toType}`);
}

function findAdjacentPair(
  positions: GridPos[],
  requireAdjacent: boolean | undefined
): { a: GridPos; b: GridPos } | null {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dr = Math.abs(positions[i].row - positions[j].row);
      const dc = Math.abs(positions[i].col - positions[j].col);
      if (!requireAdjacent || dr + dc === 1) {
        return { a: positions[i], b: positions[j] };
      }
    }
  }
  return null;
}
