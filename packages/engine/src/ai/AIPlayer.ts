// ============================================================
// AI 玩家决策引擎 v3 — 与 CardRegistry 真实卡牌 ID 对齐
// 审查要点: 修复 v0.2.0 之前 9 个 phantom ID + 12 个 missing 分支
// ============================================================

import {
  GameState, PlayerState, PlayCardParams, ParticleType, GridPos, Direction,
} from '../state/types';
import {
  getCurrentPlayer, getAlivePlayers, getOpponents,
  getOccupiedPositions, getParticlesOfType, getEmptyPositions,
  findPlayer, getDistinctParticleTypes, getParticleCount, isAdjacent,
} from '../state/GameState';
import { getCardDef } from '../cards/CardRegistry';
import { evaluateCardValue } from './Evaluator';
import { checkUpgradeRequirement } from '../rules/UpgradeChecker';

export enum AIDifficulty { EASY = 'easy', MEDIUM = 'medium', HARD = 'hard' }

export interface AIDecision {
  action: 'upgrade' | 'play_card' | 'end_turn';
  targetLevel?: number;
  cardId?: string;
  params?: PlayCardParams;
}

// ============================================================
// 主决策入口
// ============================================================

export function aiDecideMainAction(
  state: GameState, difficulty: AIDifficulty = AIDifficulty.MEDIUM
): AIDecision {
  const player = getCurrentPlayer(state);
  if (!player || !player.alive) return { action: 'end_turn' };

  // 找出所有可打出的卡牌
  const playable = getPlayableCards(player);
  const bestCard = pickBestCard(state, player, playable, difficulty);

  // 评估升级价值
  const upgradeDecision = evaluateUpgrade(state, player, difficulty, bestCard);

  // 决策：升级 vs 打牌
  if (upgradeDecision && (!bestCard || upgradeDecision.score > (bestCard.score ?? 0) * 1.2)) {
    return upgradeDecision.decision;
  }
  if (bestCard) return bestCard.decision;
  return { action: 'end_turn' };
}

// ============================================================
// 升级评估
// ============================================================

interface ScoredDecision { decision: AIDecision; score: number }

function evaluateUpgrade(
  state: GameState, player: PlayerState,
  difficulty: AIDifficulty, bestCard: ScoredDecision | null
): ScoredDecision | null {
  const nextLevel = player.researchLevel + 1;
  if (nextLevel > 6) return null;

  // 使用引擎层 UPGRADE_REQUIREMENTS（与 CardRegistry 一致）
  const UPGRADE_COSTS: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8 };
  const req = UPGRADE_COSTS[nextLevel];
  if (req === undefined || player.energy < req) return null;

  const checkResult = checkUpgradeRequirement(player.lab, nextLevel);
  if (!checkResult.satisfied) return null;

  // 评分：升级级别越高越重要
  let score = nextLevel * 25 - (difficulty === AIDifficulty.EASY ? 15 : 0);
  // 如果手中无好牌，升级价值更高
  if (!bestCard || (bestCard.score ?? 0) < 10) score += 20;
  // 能量充沛时优先升级
  if (player.energy - req >= 3) score += 10;

  return { decision: { action: 'upgrade', targetLevel: nextLevel }, score };
}

// ============================================================
// 卡牌选择
// ============================================================

interface CardWithScore { card: { id: string; defId: string }; score: number }

function getPlayableCards(player: PlayerState): CardWithScore[] {
  return player.hand
    .filter(c => { const d = getCardDef(c.defId); return d && d.cost <= player.energy; })
    .map(c => ({ card: c, score: 0 }));
}

function pickBestCard(
  state: GameState, player: PlayerState,
  playable: CardWithScore[], difficulty: AIDifficulty
): ScoredDecision | null {
  // 评分
  const scored = playable.map(p => ({
    ...p,
    score: evaluateCardValue(state, player.id, p.card.defId),
  })).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  // 简单难度：在 Top 3 中随机选
  if (difficulty === AIDifficulty.EASY) {
    const pool = scored.slice(0, Math.min(3, scored.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return {
      decision: smartParams(state, player, pick.card.defId),
      score: pick.score,
    };
  }

  // 中等/困难：选最高分
  const best = scored[0];
  return {
    decision: smartParams(state, player, best.card.defId),
    score: best.score,
  };
}

// ============================================================
// 智能参数生成（覆盖所有 46 种真实卡牌）
// ============================================================

/** 选出最威胁的对手（熵值+能量+科技 综合评分） */
function pickThreatOpponent(state: GameState, playerId: string): PlayerState | undefined {
  const opps = getOpponents(state, playerId);
  if (opps.length === 0) return undefined;
  return opps.sort((a, b) =>
    (b.entropy * 3 + b.energy * 2 + b.researchLevel * 5) -
    (a.entropy * 3 + a.energy * 2 + a.researchLevel * 5)
  )[0] ?? opps[0];
}

/** 选取有粒子的位置（优先中心 Q，其次任意） */
function pickOwnParticlePos(player: PlayerState): GridPos | undefined {
  const particles = getOccupiedPositions(player.lab);
  if (particles.length === 0) return undefined;
  // 优先选 Q（更可能引发升级/湮灭）
  const qPos = particles.find(p => player.lab[p.row][p.col] === 'Q');
  return qPos ?? particles[0];
}

/** 选取空格位置（优先中心） */
function pickEmptyPos(player: PlayerState): GridPos | undefined {
  const emptySlots = getEmptyPositions(player.lab);
  if (emptySlots.length === 0) return undefined;
  const size = player.labSize;
  const mid = Math.floor(size / 2);
  const center = emptySlots.find(p => p.row === mid && p.col === mid);
  return center ?? emptySlots[0];
}

/** 选取对手空格位置（用于 spawn_particle player=opponent 等） */
function pickOpponentEmptyPos(opp: PlayerState): GridPos | undefined {
  return pickEmptyPos(opp);
}

/** 选取对手的粒子位置（用于 pull/transform 等） */
function pickOpponentParticlePos(opp: PlayerState): GridPos | undefined {
  const positions = getOccupiedPositions(opp.lab);
  if (positions.length === 0) return undefined;
  return positions[0];
}

function smartParams(
  state: GameState, player: PlayerState, cardDefId: string
): AIDecision {
  const params: PlayCardParams = {};
  const threat = pickThreatOpponent(state, player.id);
  const myPos = pickOwnParticlePos(player);
  const myEmpty = pickEmptyPos(player);

  switch (cardDefId) {
    // === 基础现象卡 (10) ===
    case 'energy_drain':
      // 自身能量效果，无需 target
      break;
    case 'particle_spawn':
      if (myEmpty) params.targetPos = myEmpty;
      // choose_q_or_e: 只能在 Q/E 中选择，不生成反物质
      params.particleType = player.lab.some(row => row.some(cell => cell === 'Q')) ? 'E' : 'Q';
      break;
    case 'thrust':
      if (myPos) params.fromPos = myPos;
      params.direction = 'down';
      break;
    case 'entropy_pulse':
      if (threat) params.targetPlayerId = threat.id;
      break;
    case 'gravity_pull':
      if (threat) {
        params.targetPlayerId = threat.id;
        const oppPos = pickOpponentParticlePos(threat);
        if (oppPos) {
          params.targetPos = oppPos;
          params.direction = 'down';
        }
      }
      break;
    case 'energy_shield':
      break; // 自身效果
    case 'vacuum_decay':
      // remove_particle 读取 targetPos（不是 fromPos）
      if (myPos) params.targetPos = myPos;
      break;
    case 'antimatter_catalysis':
      if (myPos) params.targetPos = myPos;
      break;
    case 'gravity_slingshot':
      if (myPos) {
        params.fromPos = myPos;
        params.direction = 'down';
      }
      break;
    case 'energy_overload':
      break; // 自身效果

    // === TR1 经典力学 (6) ===
    case 'inertia_launch':
      // 合并两个 Q → P：UI 不需要参数，引擎自动选
      break;
    case 'momentum_conservation':
      if (myPos) params.fromPos = myPos;
      break;
    case 'lever_principle':
      // 杠杆原理：选两个有粒子的位置
      if (myPos) {
        params.p1 = myPos;
        // 找另一个非空位置
        const particles = getOccupiedPositions(player.lab);
        const other = particles.find(p => p.row !== myPos.row || p.col !== myPos.col);
        if (other) params.p2 = other;
      }
      break;
    case 'friction_torque':
      // 锁定对手一个粒子
      if (threat) {
        params.targetPlayerId = threat.id;
        const oppPos = pickOpponentParticlePos(threat);
        if (oppPos) params.targetPos = oppPos;
      }
      break;
    case 'free_fall':
      if (myPos) params.fromPos = myPos;
      break;
    case 'collision_restore':
      // 两次 remove_particle 各有预设位置，不便用单个 targetPos 覆盖
      break;

    // === TR2 电磁统一 (6) ===
    case 'faraday_shield':
      break; // 自身效果 + 抽 1 张（不需要参数）
    case 'coulomb_repulsion':
      // 推动对手一个粒子
      if (threat) {
        params.targetPlayerId = threat.id;
        const oppPos = pickOpponentParticlePos(threat);
        if (oppPos) {
          params.fromPos = oppPos;
          params.targetPos = oppPos;
          params.direction = 'down';
        }
      }
      break;
    case 'electromagnetic_induction':
      if (threat) {
        params.targetPlayerId = threat.id;
        // 两个相邻粒子
        const oppParticles = getOccupiedPositions(threat.lab);
        params.p1 = oppParticles[0];
        params.p2 = oppParticles[1];
      }
      break;
    case 'magnetic_closure':
      // 己方两个粒子互换
      if (myPos) {
        params.p1 = myPos;
        const other = getOccupiedPositions(player.lab).find(p => p.row !== myPos.row || p.col !== myPos.col);
        if (other) params.p2 = other;
      }
      break;
    case 'electrostatic_adsorption':
      if (threat) {
        params.targetPlayerId = threat.id;
        const oppPos = pickOpponentParticlePos(threat);
        if (oppPos) params.targetPos = oppPos;
      }
      break;
    case 'current_impact':
      if (threat) params.targetPlayerId = threat.id;
      break;

    // === TR3 热力学统计 (6) ===
    case 'maxwell_demon':
      if (myPos) {
        params.p1 = myPos;
        const other = getOccupiedPositions(player.lab).find(p => p.row !== myPos.row || p.col !== myPos.col);
        if (other) params.p2 = other;
      }
      break;
    case 'brownian_motion':
      // shuffle_particles(player: "all") 不需要参数
      break;
    case 'heat_conduction':
      if (threat) params.targetPlayerId = threat.id;
      break;
    case 'adiabatic_compression':
      // 两次 remove_particle 各有预设位置
      break;
    case 'entropy_reducer':
      break; // 自身效果
    case 'phase_transition':
      // 两次 transform_particle 各有预设位置
      break;

    // === TR4 量子力学 (6) ===
    case 'observation_collapse':
      if (threat) {
        params.targetPlayerId = threat.id;
        const oppPos = pickOpponentParticlePos(threat);
        if (oppPos) params.targetPos = oppPos;
        // 智能猜测：选场上最多的类型
        const types = getDistinctParticleTypes(threat.lab);
        params.guessType = pickMostCommonParticle(threat, types);
      }
      break;
    case 'quantum_tunneling':
      if (myPos) {
        params.p1 = myPos;
        const other = getOccupiedPositions(player.lab).find(p => p.row !== myPos.row || p.col !== myPos.col);
        if (other) params.p2 = other;
      }
      break;
    case 'superposition':
      if (myEmpty) params.targetPos = myEmpty;
      // choose_q_or_e: 只能在 Q/E 中选择
      params.particleType = player.lab.some(row => row.some(cell => cell === 'Q')) ? 'E' : 'Q';
      break;
    case 'entanglement_transfer':
      // swap_particles(相邻) + spawn_particle
      if (myPos) {
        params.p1 = myPos;
        const other = getOccupiedPositions(player.lab).find(p => isAdjacent(p, myPos));
        if (other) params.p2 = other;
      }
      if (myEmpty) params.targetPos = myEmpty;
      params.particleType = player.lab.some(row => row.some(cell => cell === 'Q')) ? 'E' : 'Q';
      break;
    case 'wave_particle_duality':
      if (myPos) {
        params.fromPos = myPos;
        params.direction = 'down-left';
      }
      break;
    case 'uncertainty':
      if (threat) params.targetPlayerId = threat.id;
      break;

    // === TR5 广义相对论 (6) ===
    case 'spacetime_curvature':
      // board_permute 不需要参数
      break;
    case 'gravitational_lens':
      if (myPos) {
        params.fromPos = myPos;
        params.direction = 'up-left';
      }
      break;
    case 'time_dilation':
      if (threat) params.targetPlayerId = threat.id;
      break;
    case 'wormhole_connection':
      if (myPos) {
        params.p1 = myPos;
        const other = getOccupiedPositions(player.lab).find(p => p.row !== myPos.row && p.col !== myPos.col);
        if (other) params.p2 = other;
      }
      break;
    case 'singularity_collapse':
      // remove_particle 读取 targetPos（不是 fromPos）
      if (myPos) params.targetPos = myPos;
      break;
    case 'gravitational_wave':
      // all_others 已在 effect 中处理
      break;

    // === TR6 弦论终极 (6) ===
    case 'dimension_strike':
      if (threat) params.targetPlayerId = threat.id;
      break;
    case 'brane_collision':
      // all 已在 effect 中处理
      break;
    case 'superstring_resonance':
      break; // 自身效果
    case 'calabi_yau_manifold':
      break; // 自身效果（UI 触发）
    case 'multiverse_split':
      break; // 自身效果
    case 'grand_unification':
      break; // 自身效果

    // === 默认：未识别卡牌启发式（MOD 卡等） ===
    default:
      if (cardDefId.includes('shield') || cardDefId.includes('defense')) {
        // 自身效果
      } else if (cardDefId.includes('spawn')) {
        if (myEmpty) params.targetPos = myEmpty;
      } else if (cardDefId.includes('strike') || cardDefId.includes('damage') || cardDefId.includes('attack')) {
        if (threat) params.targetPlayerId = threat.id;
      } else if (cardDefId.includes('draw') || cardDefId.includes('energy')) {
        // 自身效果
      }
      break;
  }

  // 在手牌中查找卡牌实例
  const handCard = player.hand.find(c => c.defId === cardDefId);
  return {
    action: 'play_card',
    cardId: handCard?.id || '',
    params,
  };
}

// ============================================================
// 辅助函数
// ============================================================

/** 决定是生成正物质 Q 还是反物质 Ā */
function needsAntimatter(player: PlayerState): boolean {
  const qCount = getParticlesOfType(player.lab, 'Q').length;
  const aqCount = getParticlesOfType(player.lab, 'Ā').length;
  return qCount > aqCount * 2;
}

/** 选出对手场上出现最多的粒子类型（用于观测坍缩猜对） */
function pickMostCommonParticle(opp: PlayerState, types: ParticleType[]): ParticleType {
  if (types.length === 0) return 'Q';
  let bestType: ParticleType = types[0];
  let bestCount = 0;
  for (const t of types) {
    const c = getParticlesOfType(opp.lab, t).length;
    if (c > bestCount) { bestCount = c; bestType = t; }
  }
  return bestType;
}

// ============================================================
// 公开工具
// ============================================================

export function aiGetPlayableCards(
  state: GameState, playerId: string
): { cardId: string; defId: string; cost: number; name: string }[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];
  return player.hand
    .filter(c => { const d = getCardDef(c.defId); return d && d.cost <= player.energy; })
    .map(c => {
      const d = getCardDef(c.defId)!;
      return { cardId: c.id, defId: c.defId, cost: d.cost, name: d.name };
    });
}
