// ============================================================
// 正反物质对湮灭检测
// ============================================================

import { ParticleType, ANTIMATTER_PAIR } from '../state/types';
import { isAdjacent } from '../state/GameState';

/**
 * 检查实验场上所有相邻的正反物质对
 * 返回所有需要湮灭的粒子位置对
 */
export function findAnnihilationPairs(
  lab: (ParticleType | null)[][],
  extendedRange: boolean = false // 引力透镜效果
): { pair: { pos1: { row: number; col: number }; pos2: { row: number; col: number } }[] } {
  const pairs: { pos1: { row: number; col: number }; pos2: { row: number; col: number } }[] = [];
  const size = lab.length;

  // 扩展判定距离（引力透镜：2格也算相邻）
  const maxDist = extendedRange ? 2 : 1;

  for (let r1 = 0; r1 < size; r1++) {
    for (let c1 = 0; c1 < size; c1++) {
      const p1 = lab[r1][c1];
      if (p1 === null) continue;

      const anti1 = ANTIMATTER_PAIR[p1 as ParticleType];

      // 只检查"右侧"和"下方"的粒子，避免重复检查同一对
      for (let r2 = r1; r2 < size && r2 <= r1 + maxDist; r2++) {
        for (let c2 = (r2 === r1 ? c1 + 1 : 0); c2 < size && c2 <= c1 + maxDist; c2++) {
          const p2 = lab[r2][c2];
          if (p2 === null) continue;
          if (p2 !== anti1) continue;

          // 检查距离
          const dr = Math.abs(r1 - r2);
          const dc = Math.abs(c1 - c2);

          if (extendedRange) {
            // 引力透镜：曼哈顿距离≤2 且非同一格
            if (dr + dc <= 2 && dr + dc > 0) {
              pairs.push({ pos1: { row: r1, col: c1 }, pos2: { row: r2, col: c2 } });
            }
          } else {
            if (isAdjacent({ row: r1, col: c1 }, { row: r2, col: c2 })) {
              pairs.push({ pos1: { row: r1, col: c1 }, pos2: { row: r2, col: c2 } });
            }
          }
        }
      }
    }
  }

  return { pair: pairs };
}

/**
 * 执行湮灭：移除粒子对，返回移除的粒子类型
 */
export function executeAnnihilation(
  lab: (ParticleType | null)[][],
  pairs: { pos1: { row: number; col: number }; pos2: { row: number; col: number } }[]
): { count: number } {
  let count = 0;
  for (const { pos1, pos2 } of pairs) {
    // 检查粒子是否还在（可能被前面的湮灭移除）
    if (lab[pos1.row][pos1.col] !== null && lab[pos2.row][pos2.col] !== null) {
      lab[pos1.row][pos1.col] = null;
      lab[pos2.row][pos2.col] = null;
      count++;
    }
  }
  return { count };
}

/**
 * 阶段5：湮灭清算
 * 一次性检查，不触发连锁
 */
export function performAnnihilationPhase(
  lab: (ParticleType | null)[][],
  extendedRange: boolean = false
): { annihilationCount: number } {
  const { pair: pairs } = findAnnihilationPairs(lab, extendedRange);
  const { count } = executeAnnihilation(lab, pairs);
  return { annihilationCount: count };
}
