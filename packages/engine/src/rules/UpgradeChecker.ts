// ============================================================
// 研究所升级构型检测
// ============================================================

import { ParticleType, UPGRADE_REQUIREMENTS } from '../state/types';
import { isAdjacent, getParticlesOfType, getOccupiedPositions, getDistinctParticleTypes, getParticleCount } from '../state/GameState';
import { ANTIMATTER_PAIR } from '../state/types';

/**
 * 检查是否满足指定等级的升级构型要求
 */
export function checkUpgradeRequirement(
  lab: (ParticleType | null)[][],
  targetLevel: number
): { satisfied: boolean; reason?: string } {
  switch (targetLevel) {
    case 1: return checkLv1Requirement(lab);
    case 2: return checkLv2Requirement(lab);
    case 3: return checkLv3Requirement(lab);
    case 4: return checkLv4Requirement(lab);
    case 5: return checkLv5Requirement(lab);
    case 6: return checkLv6Requirement(lab);
    default: return { satisfied: false, reason: '无效的升级等级' };
  }
}

/**
 * Lv.1 经典力学：任意2个夸克(Q)相邻
 */
function checkLv1Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const qPositions = getParticlesOfType(lab, 'Q');
  if (qPositions.length < 2) {
    return { satisfied: false, reason: '场上夸克不足2个' };
  }

  // 检查是否有任意2个相邻
  for (let i = 0; i < qPositions.length; i++) {
    for (let j = i + 1; j < qPositions.length; j++) {
      if (isAdjacent(qPositions[i], qPositions[j])) {
        return { satisfied: true };
      }
    }
  }

  return { satisfied: false, reason: '没有2个相邻的夸克' };
}

/**
 * Lv.2 电磁统一：1个质子(P) + 1个电子(E)相邻
 */
function checkLv2Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const pPositions = getParticlesOfType(lab, 'P');
  const ePositions = getParticlesOfType(lab, 'E');

  if (pPositions.length === 0) {
    return { satisfied: false, reason: '场上没有质子(P)' };
  }
  if (ePositions.length === 0) {
    return { satisfied: false, reason: '场上没有电子(E)' };
  }

  for (const p of pPositions) {
    for (const e of ePositions) {
      if (isAdjacent(p, e)) {
        return { satisfied: true };
      }
    }
  }

  return { satisfied: false, reason: '没有相邻的质子(P)和电子(E)' };
}

/**
 * Lv.3 热力学统计：1个P，与任意1个游离粒子相隔1格（中间不能有其他粒子）
 * "相隔1格"指两粒子之间恰好空1格
 */
function checkLv3Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const pPositions = getParticlesOfType(lab, 'P');
  if (pPositions.length === 0) {
    return { satisfied: false, reason: '场上没有质子(P)' };
  }

  const allParticles = getOccupiedPositions(lab);
  if (allParticles.length < 2) {
    return { satisfied: false, reason: '场上至少需要2个粒子' };
  }

  const size = lab.length;

  for (const pPos of pPositions) {
    // 检查四个方向上距离2格的位置（距离1格是紧挨着，距离2格是间隔1格）
    const directions = [
      { dr: -2, dc: 0 }, // 上2格
      { dr: 2, dc: 0 },  // 下2格
      { dr: 0, dc: -2 }, // 左2格
      { dr: 0, dc: 2 },  // 右2格
    ];

    for (const dir of directions) {
      const targetRow = pPos.row + dir.dr;
      const targetCol = pPos.col + dir.dc;

      // 检查目标位置是否在边界内
      if (targetRow < 0 || targetRow >= size || targetCol < 0 || targetCol >= size) {
        continue;
      }

      // 检查目标位置是否有粒子
      const targetParticle = lab[targetRow][targetCol];
      if (targetParticle === null) continue;

      // 检查中间格（距离1格处）是否为空
      const midRow = pPos.row + dir.dr / 2;
      const midCol = pPos.col + dir.dc / 2;
      if (lab[midRow][midCol] !== null) {
        continue; // 中间有粒子阻挡
      }

      return { satisfied: true };
    }
  }

  return { satisfied: false, reason: '没有满足"相隔1格（中间真空）"条件的P和其他粒子' };
}

/**
 * Lv.4 量子力学：场上同时存在至少1对正反物质对且它们不相邻
 */
function checkLv4Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const size = lab.length;

  // 检查所有正物质粒子
  const regularTypes: ParticleType[] = ['Q', 'E', 'P'];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const particle = lab[r][c];
      if (particle === null) continue;
      if (!regularTypes.includes(particle)) continue;

      // 找对应的反物质
      const antiType = ANTIMATTER_PAIR[particle];
      const antiPositions = getParticlesOfType(lab, antiType);

      for (const antiPos of antiPositions) {
        // 检查它们是否不相邻（四正交）
        if (!isAdjacent({ row: r, col: c }, antiPos)) {
          return { satisfied: true };
        }
      }
    }
  }

  return { satisfied: false, reason: '场上没有不相邻的正反物质对' };
}

/**
 * Lv.5 广义相对论：场上至少3个粒子排成一条直线（横/竖/斜均可，必须3格连续）
 */
function checkLv5Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const size = lab.length;

  if (getParticleCount(lab) < 3) {
    return { satisfied: false, reason: '场上粒子不足3个' };
  }

  // 检查横行
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 3; c++) {
      if (lab[r][c] !== null && lab[r][c + 1] !== null && lab[r][c + 2] !== null) {
        return { satisfied: true };
      }
    }
  }

  // 检查竖列
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 3; r++) {
      if (lab[r][c] !== null && lab[r + 1][c] !== null && lab[r + 2][c] !== null) {
        return { satisfied: true };
      }
    }
  }

  // 检查对角线（3x3 只有两条对角线：从左上到右下 和 从右上到左下）
  if (lab[0][0] !== null && lab[1][1] !== null && lab[2][2] !== null) {
    return { satisfied: true };
  }
  if (lab[0][2] !== null && lab[1][1] !== null && lab[2][0] !== null) {
    return { satisfied: true };
  }

  return { satisfied: false, reason: '没有3个粒子排成一条直线' };
}

/**
 * Lv.6 弦论终极：场上至少存在5种不同种类的粒子（共6种：Q/E/P/Ā/Ē/P̄）
 */
function checkLv6Requirement(lab: (ParticleType | null)[][]): { satisfied: boolean; reason?: string } {
  const types = getDistinctParticleTypes(lab);
  if (types.length >= 5) {
    return { satisfied: true };
  }
  return { satisfied: false, reason: `场上只有${types.length}种粒子，需要5种` };
}
