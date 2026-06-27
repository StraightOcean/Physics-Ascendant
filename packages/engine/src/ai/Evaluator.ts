// ============================================================
// AI 局面评估函数 v3 — 与 CardRegistry 真实卡牌 ID 对齐
// 审查要点: 修复 v0.2.0 之前 10 个 phantom ID + 12 个 missing 分支
// ============================================================

import {
  GameState,
  PlayerState,
  ParticleType,
  ANTIMATTER_PAIR,
} from '../state/types';
import {
  getAlivePlayers,
  getOccupiedPositions,
  getParticlesOfType,
  getDistinctParticleTypes,
  getParticleCount,
  isAdjacent,
} from '../state/GameState';
import { getCardDef } from '../cards/CardRegistry';

/**
 * 对当前玩家进行局面评估（正值=有利，负值=不利）
 */
export function evaluateBoard(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return -1000;

  let score = 0;

  // 1. 存活优势 (+200 基础值)
  score += 200;

  // 2. 对手出局奖励
  const aliveCount = getAlivePlayers(state).length;
  const opponentBonus = (state.playerCount - aliveCount) * 150;
  score += opponentBonus;

  // 3. 熵值评分（越低越好，0-10 映射为 +50 ~ -100）
  score -= player.entropy * 15;

  // 4. 能量评分（越多越好）
  score += player.energy * 8;

  // 5. 虚空零点能惩罚（越高越危险）
  score -= player.voidEnergy * 25;

  // 6. 研究所等级评分（越高越好）
  score += player.researchLevel * 30;

  // 7. 护盾值
  score += player.shield * 10;

  // 8. 实验场评分
  score += evaluateLab(player);

  // 9. 手牌数量
  score += player.hand.length * 5;

  // 10. 相对其他玩家的差值
  const opponents = getAlivePlayers(state).filter((p) => p.id !== playerId);
  for (const opp of opponents) {
    score -= opp.energy * 4;       // 对手能量多不利
    score += opp.entropy * 8;      // 对手熵值高有利
    score -= opp.researchLevel * 15; // 对手科技高不利
  }

  return score;
}

/**
 * 评估实验场状态
 */
function evaluateLab(player: PlayerState): number {
  let score = 0;
  const lab = player.lab;
  const size = lab.length;

  // 粒子多样性奖励
  const types = getDistinctParticleTypes(lab);
  score += types.length * 8;

  // 粒子数量（适度奖励）
  const count = getParticleCount(lab);
  score += Math.min(count, 6) * 5; // 超过6个奖励递减

  // 检查是否有正反物质对相邻（风险）
  const regularTypes: ParticleType[] = ['Q', 'E', 'P'];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const p = lab[r][c];
      if (p === null || !regularTypes.includes(p)) continue;

      const anti = ANTIMATTER_PAIR[p];
      // 检查四邻
      const neighbors = [
        { row: r - 1, col: c },
        { row: r + 1, col: c },
        { row: r, col: c - 1 },
        { row: r, col: c + 1 },
      ];
      for (const n of neighbors) {
        if (n.row >= 0 && n.row < size && n.col >= 0 && n.col < size) {
          if (lab[n.row][n.col] === anti) {
            score -= 20; // 惩罚相邻的正反物质对
          }
        }
      }
    }
  }

  // 检查升级潜力
  // Lv.1: 有相邻Q
  const qPositions = getParticlesOfType(lab, 'Q');
  for (let i = 0; i < qPositions.length; i++) {
    for (let j = i + 1; j < qPositions.length; j++) {
      if (isAdjacent(qPositions[i], qPositions[j])) {
        score += 15;
      }
    }
  }

  // 有P+E相邻
  const pPositions = getParticlesOfType(lab, 'P');
  const ePositions = getParticlesOfType(lab, 'E');
  for (const p of pPositions) {
    for (const e of ePositions) {
      if (isAdjacent(p, e)) {
        score += 20;
      }
    }
  }

  // 直线检测（3个粒子排成直线）
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 3; c++) {
      if (lab[r][c] && lab[r][c + 1] && lab[r][c + 2]) score += 25;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 3; r++) {
      if (lab[r][c] && lab[r + 1][c] && lab[r + 2][c]) score += 25;
    }
  }

  return score;
}

/**
 * 评估单个卡牌在当前位置的价值（启发式）
 * 必须覆盖 CardRegistry 中所有 46 种卡牌 ID
 */
export function evaluateCardValue(
  state: GameState,
  playerId: string,
  cardDefId: string
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;

  const opps = state.players.filter(p => p.id !== playerId && p.alive);
  const threat = opps.sort((a, b) =>
    (b.entropy * 3 + b.energy * 2 + b.researchLevel * 5) -
    (a.entropy * 3 + a.energy * 2 + a.researchLevel * 5)
  )[0];
  const oppEntropy = threat?.entropy ?? 0;
  const oppEnergy = threat?.energy ?? 0;
  const labSize = player.labSize;
  const myParticleCount = getParticleCount(player.lab);
  const oppParticleCount = getParticleCount(threat?.lab || []);

  let value = 0;

  switch (cardDefId) {
    // === 基础现象卡 (10) ===
    case 'energy_drain':       value = 15 + Math.max(0, 10 - player.energy) * 3; break;
    case 'particle_spawn':     value = 12 + Math.max(0, 5 - myParticleCount) * 3; break;
    case 'thrust':             value = 8 + myParticleCount; break;
    case 'entropy_pulse':      value = 18 + (oppEntropy > 3 ? 8 : 0); break;
    case 'gravity_pull':       value = 16 + oppParticleCount * 2; break;
    case 'energy_shield':      value = 10 + player.entropy * 2; break;
    case 'vacuum_decay':       value = 14 + player.entropy * 3; break;
    case 'antimatter_catalysis': value = 16; break;
    case 'gravity_slingshot':  value = 10 + myParticleCount; break;
    case 'energy_overload':    value = 20 - player.voidEnergy * 10; break;

    // === TR1 经典力学 (6) ===
    case 'inertia_launch':     value = 18 + (qCount(player.lab) >= 2 ? 10 : 0); break;
    case 'momentum_conservation': value = 12; break;
    case 'lever_principle':    value = 14 + myParticleCount; break;
    case 'friction_torque':    value = 14; break;
    case 'free_fall':          value = 8 + myParticleCount; break;
    case 'collision_restore':  value = 16 + myParticleCount; break;

    // === TR2 电磁统一 (6) ===
    case 'faraday_shield':     value = 20 + (player.entropy > 5 ? 15 : 0); break;
    case 'coulomb_repulsion':  value = 18 + oppParticleCount; break;
    case 'electromagnetic_induction': value = 20; break;
    case 'magnetic_closure':   value = 12 + myParticleCount * 2; break;
    case 'electrostatic_adsorption':  value = 18; break;
    case 'current_impact':     value = 25 + (oppEnergy > 5 ? 5 : 0); break;

    // === TR3 热力学统计 (6) ===
    case 'maxwell_demon':      value = 22 + oppEnergy * 2; break;
    case 'brownian_motion':    value = 14 + Math.max(0, 6 - myParticleCount) * 2; break;
    case 'heat_conduction':    value = 14 + player.entropy * 3; break;
    case 'adiabatic_compression': value = 18 + myParticleCount * 2; break;
    case 'entropy_reducer':    value = 28 + player.entropy * 4; break;
    case 'phase_transition':   value = 16 + myParticleCount; break;

    // === TR4 量子力学 (6) ===
    case 'observation_collapse': value = 15 + oppEntropy * 2; break;
    case 'quantum_tunneling':  value = 14 + myParticleCount; break;
    case 'superposition':      value = 14 + Math.max(0, 6 - myParticleCount) * 2; break;
    case 'entanglement_transfer': value = 18; break;
    case 'wave_particle_duality': value = 13 + myParticleCount; break;
    case 'uncertainty':        value = 12 + oppParticleCount; break;

    // === TR5 广义相对论 (6) ===
    case 'spacetime_curvature': value = 22; break;
    case 'gravitational_lens': value = 20 + myParticleCount; break;
    case 'time_dilation':      value = 22 + oppEntropy * 2; break;
    case 'wormhole_connection': value = 18 + myParticleCount; break;
    case 'singularity_collapse': value = 22 + myParticleCount * 2; break;
    case 'gravitational_wave': value = 28 + oppEntropy * 2; break;

    // === TR6 弦论终极 (6) ===
    case 'dimension_strike':   value = 35 + (oppEntropy > 7 ? 10 : 0); break;
    case 'brane_collision':    value = 30 + oppEntropy * 3; break;
    case 'superstring_resonance': value = 26; break;
    case 'calabi_yau_manifold': value = 28; break;
    case 'multiverse_split':   value = 30; break;
    case 'grand_unification':  value = 35; break;

    // === 默认：未识别卡牌启发式（MOD 卡等） ===
    default:
      value = 8;
      if (cardDefId.includes('shield') || cardDefId.includes('defense')) value += 10;
      if (cardDefId.includes('strike') || cardDefId.includes('damage') || cardDefId.includes('attack')) value += 12 + oppEntropy;
      if (cardDefId.includes('spawn')) value += Math.max(0, 6 - myParticleCount) * 2;
      if (cardDefId.includes('draw') || cardDefId.includes('energy')) value += 8;
  }

  // 成本惩罚：高费卡需要更高价值才值得打
  // 优化：从手牌中查 def 以获取 cost（避免重复 getCardDef）
  for (const c of player.hand) {
    if (c.defId === cardDefId) {
      const d = getCardDef(c.defId);
      if (d) {
        value -= d.cost * 2;
      }
      break;
    }
  }

  return Math.max(0, value);
}

function qCount(lab: (ParticleType | null)[][]): number {
  return getParticlesOfType(lab, 'Q').length;
}
