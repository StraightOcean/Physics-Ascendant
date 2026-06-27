// ============================================================
// 粒子移动合法性校验
// ============================================================

import { GridPos, Direction, DIRECTION_VECTORS, ParticleType } from '../state/types';
import { isInBounds, hasParticle, getParticleAt } from '../state/GameState';

/**
 * 验证基本移动（移动1格）
 * 规则：只能沿四正交方向移动，目标格必须为真空且在边界内
 * "波粒二象性" 效果下可斜向移动（由调用方处理）
 */
export function validateBasicMove(
  lab: (ParticleType | null)[][],
  from: GridPos,
  direction: Direction,
  steps: number = 1,
  lockedCells?: { row: number; col: number }[]
): { valid: boolean; reason?: string } {
  // 检查起点是否有粒子
  if (!hasParticle(lab, from)) {
    return { valid: false, reason: '起点没有粒子' };
  }

  // 检查粒子是否被锁定
  if (lockedCells && lockedCells.some(c => c.row === from.row && c.col === from.col)) {
    return { valid: false, reason: '该粒子被锁定，不可移动' };
  }

  let current = { ...from };
  const vec = DIRECTION_VECTORS[direction];

  for (let i = 0; i < steps; i++) {
    const next: GridPos = {
      row: current.row + vec.dr,
      col: current.col + vec.dc,
    };

    // 检查是否在边界内
    if (!isInBounds(next, lab.length)) {
      if (i === 0) {
        return { valid: false, reason: '移动超出实验场边界' };
      }
      // 中间步骤超出边界
      return { valid: false, reason: '路径超出实验场边界' };
    }

    // 检查目标格是否为真空
    if (hasParticle(lab, next)) {
      return { valid: false, reason: '目标格已有粒子' };
    }

    current = next;
  }

  return { valid: true };
}

/**
 * 验证推出操作（沿直线滑行）
 * 粒子沿指定方向滑行，经过所有空格，直到：
 * (a) 到达边界 → 粒子湮灭
 * (b) 撞到第一个粒子 → 停在它前面的空格
 */
export function simulatePush(
  lab: (ParticleType | null)[][],
  origin: GridPos,
  direction: Direction,
  extraDistance: number = 0 // 光速变化事件可增加距离
): {
  path: GridPos[];
  finalPos: GridPos | null; // null = 出界湮灭
  hitParticle: GridPos | null; // 撞到的第一个粒子位置
  wentOutOfBounds: boolean;
} {
  const vec = DIRECTION_VECTORS[direction];
  const path: GridPos[] = [];
  let current: GridPos = { row: origin.row, col: origin.col };
  let hitParticle: GridPos | null = null;
  let wentOutOfBounds = false;
  let maxSteps = 100; // 安全上限

  while (maxSteps-- > 0) {
    const next: GridPos = {
      row: current.row + vec.dr,
      col: current.col + vec.dc,
    };

    // 检查是否超出边界
    if (!isInBounds(next, lab.length)) {
      wentOutOfBounds = true;
      // 额外距离：宇宙膨胀事件时允许滑出更远
      if (extraDistance > 0) {
        extraDistance--;
        current = next;
        path.push(next);
        continue;
      }
      break;
    }

    // 检查是否撞到粒子
    if (hasParticle(lab, next)) {
      hitParticle = next;
      break;
    }

    // 空格，继续滑行
    current = next;
    path.push(next);
  }

  const finalPos = wentOutOfBounds ? null : current;

  return {
    path,
    finalPos,
    hitParticle,
    wentOutOfBounds,
  };
}

/**
 * 验证拉近操作
 * 将目标粒子沿指定方向直线拉近1格，目标格必须为真空
 */
export function validatePull(
  lab: (ParticleType | null)[][],
  target: GridPos,
  direction: Direction
): { valid: boolean; newPos?: GridPos; outOfBounds?: boolean; reason?: string } {
  // 检查目标格是否有粒子
  if (!hasParticle(lab, target)) {
    return { valid: false, reason: '目标位置没有粒子' };
  }

  const vec = DIRECTION_VECTORS[direction];
  // 拉近方向是 direction 的反方向（粒子向 direction 方向移动1格）
  const newPos: GridPos = {
    row: target.row + vec.dr,
    col: target.col + vec.dc,
  };

  // 检查新位置是否在边界内
  if (!isInBounds(newPos, lab.length)) {
    return { valid: true, outOfBounds: true, reason: '粒子被拉出实验场边界，触发湮灭' };
  }

  // 检查新位置是否为真空
  if (hasParticle(lab, newPos)) {
    return { valid: false, reason: '拉近目标格已有粒子' };
  }

  return { valid: true, newPos };
}

/**
 * 验证旋转90°（两个相邻粒子互换位置）
 */
export function validateRotate(
  lab: (ParticleType | null)[][],
  p1: GridPos,
  p2: GridPos
): { valid: boolean; reason?: string } {
  if (!hasParticle(lab, p1)) {
    return { valid: false, reason: '粒子1不存在' };
  }
  if (!hasParticle(lab, p2)) {
    return { valid: false, reason: '粒子2不存在' };
  }

  const dr = Math.abs(p1.row - p2.row);
  const dc = Math.abs(p1.col - p2.col);

  if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) {
    return { valid: false, reason: '两个粒子不相邻，无法旋转' };
  }

  return { valid: true };
}

/**
 * 执行粒子移动
 */
export function moveParticle(
  lab: (ParticleType | null)[][],
  from: GridPos,
  to: GridPos
): void {
  const particle = getParticleAt(lab, from);
  if (particle === null) return;

  lab[from.row][from.col] = null;
  lab[to.row][to.col] = particle;
}

/**
 * 验证对角线移动（波粒二象性）
 */
export function validateDiagonalMove(
  lab: (ParticleType | null)[][],
  from: GridPos,
  to: GridPos
): { valid: boolean; reason?: string } {
  if (!hasParticle(lab, from)) {
    return { valid: false, reason: '起点没有粒子' };
  }

  const dr = Math.abs(from.row - to.row);
  const dc = Math.abs(from.col - to.col);

  if (dr !== 1 || dc !== 1) {
    return { valid: false, reason: '不是对角相邻' };
  }

  if (!isInBounds(to, lab.length)) {
    return { valid: false, reason: '目标超出边界' };
  }

  if (hasParticle(lab, to)) {
    return { valid: false, reason: '目标格已有粒子' };
  }

  return { valid: true };
}

/**
 * 将粒子移出实验场（湮灭）
 */
export function annihilateParticle(
  lab: (ParticleType | null)[][],
  pos: GridPos
): ParticleType | null {
  const particle = getParticleAt(lab, pos);
  if (particle !== null) {
    lab[pos.row][pos.col] = null;
  }
  return particle;
}

/**
 * 在空格生成粒子
 */
export function spawnParticle(
  lab: (ParticleType | null)[][],
  pos: GridPos,
  type: ParticleType
): { success: boolean; reason?: string } {
  if (!isInBounds(pos, lab.length)) {
    return { success: false, reason: '位置超出实验场边界' };
  }
  if (hasParticle(lab, pos)) {
    return { success: false, reason: '目标格已有粒子' };
  }
  lab[pos.row][pos.col] = type;
  return { success: true };
}

/**
 * 查找实验场上所有空格
 */
export function findEmptySlots(lab: (ParticleType | null)[][]): GridPos[] {
  const slots: GridPos[] = [];
  const size = lab.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (lab[r][c] === null) {
        slots.push({ row: r, col: c });
      }
    }
  }
  return slots;
}
