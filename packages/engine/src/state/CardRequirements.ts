// ============================================================
// 卡牌参数需求配置（共享给 UI 和服务端）
// 按卡牌 ID 声明它需要哪些参数
// ============================================================

import type { Direction, ParticleType } from './types';

export type CardParamRequirement =
  | 'target_player'      // 选对手
  | 'direction'          // 4方向
  | 'diagonal_direction' // 4对角方向
  | 'own_particle'       // 选己方粒子位置
  | 'own_empty'          // 选己方空格位置
  | 'opponent_particle'  // 选对手粒子位置
  | 'particle_type'      // 选粒子类型 Q/E
  | 'guess'              // 猜测类型 Q/E/P/Ā/Ē/P̄
  ;

const NEEDS_TARGET_PLAYER = new Set([
  'entropy_pulse', 'current_impact', 'dimension_strike', 'time_dilation',
  'heat_conduction', 'singularity_collapse', 'gravitational_wave', 'brane_collision',
]);

const NEEDS_DIRECTION = new Set([
  'thrust', 'gravity_slingshot', 'inertia_launch',
  'gravity_pull', 'coulomb_repulsion', 'gravitational_wave',
]);

const NEEDS_DIAGONAL = new Set([
  'wave_particle_duality',
]);

const NEEDS_OWN_PARTICLE = new Set([
  'thrust', 'gravity_slingshot', 'inertia_launch',
  'vacuum_decay', 'antimatter_catalysis', 'momentum_conservation',
  'free_fall', 'friction_torque',
]);

const NEEDS_OWN_EMPTY = new Set([
  'particle_spawn', 'quantum_tunneling',
]);

const TARGETS_OPPONENT_PARTICLE = new Set([
  'gravity_pull', 'electrostatic_adsorption', 'coulomb_repulsion',
  'observation_collapse', 'maxwell_demon',
]);

const NEEDS_PARTICLE_TYPE = new Set([
  'particle_spawn', 'phase_transition',
]);

const NEEDS_GUESS = new Set([
  'observation_collapse',
]);

/** 获取卡牌的所有参数需求（按显示顺序） */
export function getCardParamRequirements(cardId: string): CardParamRequirement[] {
  const req: CardParamRequirement[] = [];
  if (NEEDS_TARGET_PLAYER.has(cardId))    req.push('target_player');
  if (NEEDS_DIAGONAL.has(cardId))         req.push('diagonal_direction');
  else if (NEEDS_DIRECTION.has(cardId))   req.push('direction');
  if (NEEDS_OWN_PARTICLE.has(cardId))     req.push('own_particle');
  if (NEEDS_OWN_EMPTY.has(cardId))        req.push('own_empty');
  if (TARGETS_OPPONENT_PARTICLE.has(cardId)) req.push('opponent_particle');
  if (NEEDS_PARTICLE_TYPE.has(cardId))    req.push('particle_type');
  if (NEEDS_GUESS.has(cardId))            req.push('guess');
  return req;
}

/** 卡牌是否需要任何参数 */
export function cardNeedsAnyParam(cardId: string): boolean {
  return getCardParamRequirements(cardId).length > 0;
}

/** 是否仅需要 target_player（无需位置） */
export function isTargetOnlyCard(cardId: string): boolean {
  const reqs = getCardParamRequirements(cardId);
  return reqs.length === 1 && reqs[0] === 'target_player';
}

/** 4 方向选项 */
export const COMPASS_OPTIONS: { value: Direction; label: string }[] = [
  { value: 'up', label: '↑ 上' },
  { value: 'down', label: '↓ 下' },
  { value: 'left', label: '← 左' },
  { value: 'right', label: '→ 右' },
];

/** 4 对角方向选项 */
export const DIAGONAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'up-left', label: '↖' },
  { value: 'up-right', label: '↗' },
  { value: 'down-left', label: '↙' },
  { value: 'down-right', label: '↘' },
];

/** 粒子类型选项（生成时用：Q / E） */
export const SPAWN_PARTICLE_OPTIONS: ParticleType[] = ['Q', 'E'];

/** 全部粒子类型（猜测用） */
export const ALL_PARTICLE_OPTIONS: ParticleType[] = ['Q', 'E', 'P', 'Ā', 'Ē', 'P̄'];
