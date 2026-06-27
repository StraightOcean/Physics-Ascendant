// ============================================================
// 卡牌注册表 - 46种卡牌定义 (60基础实例 + 72科技实例 = 132张)
// ============================================================

import { CardDef, CardType, CardInstance, CardAtomicEffect } from '../state/types';

// ============================================================
// 基础现象卡（10种 × 各数量 = 60张实例，主牌库）
// ============================================================

export const BASIC_CARDS: CardDef[] = [
  // ---- 能量汲取 (10张) ----
  {
    id: 'energy_drain',
    name: '能量汲取',
    type: CardType.RESOURCE,
    cost: 0,
    level: 0,
    isUpgradeReward: false,
    description: '能量+2。若突破上限10，每突破一次积累1点虚空零点能，虚空零点能超过5则立即出局。',
    quantity: 10,
    effects: [{ type: "gain_energy", amount: 2, canExceedCap: true }] as CardAtomicEffect[],
  },
  // ---- 粒子生成 (8张) ----
  {
    id: 'particle_spawn',
    name: '粒子生成',
    type: CardType.DEPLOY,
    cost: 1,
    level: 0,
    isUpgradeReward: false,
    description: '在己方一个空格生成1个夸克(Q)或电子(E)，自选。',
    quantity: 8,
    effects: [{ type: "spawn_particle", player: "self", pos: "empty_slot", particle: "choose_q_or_e" }] as CardAtomicEffect[],
  },
  // ---- 推力 (8张) ----
  {
    id: 'thrust',
    name: '推力',
    type: CardType.DISPLACE,
    cost: 1,
    level: 0,
    isUpgradeReward: false,
    description: '将己方1个粒子沿上下左右移动1格（不可移出场外）。',
    quantity: 8,
    effects: [{ type: "move_particle", player: "self", from: { row: 0, col: 0 }, direction: "up", steps: 1 }] as CardAtomicEffect[],
  },
  // ---- 熵增脉冲 (8张) ----
  {
    id: 'entropy_pulse',
    name: '熵增脉冲',
    type: CardType.ATTACK,
    cost: 2,
    level: 0,
    isUpgradeReward: false,
    description: '指定1名对手，其熵值+1。',
    quantity: 8,
    effects: [{ type: "gain_entropy", target: "opponent", amount: 1 }] as CardAtomicEffect[],
  },
  // ---- 引力拉扯 (6张) ----
  {
    id: 'gravity_pull',
    name: '引力拉扯',
    type: CardType.INTERFERE,
    cost: 2,
    level: 0,
    isUpgradeReward: false,
    description: '将对手的1个粒子沿直线拉近己方1格（目标格须为真空，否则无效）。',
    quantity: 6,
    effects: [{ type: "pull_particle", player: "opponent", target: { row: 0, col: 0 }, direction: "up" }] as CardAtomicEffect[],
  },
  // ---- 能量护盾 (6张) ----
  {
    id: 'energy_shield',
    name: '能量护盾',
    type: CardType.DEFENSE,
    cost: 1,
    level: 0,
    isUpgradeReward: false,
    description: '获得1点护盾值，可抵挡1次"熵增脉冲"或"湮灭清算"造成的熵值增加。',
    quantity: 6,
    effects: [{ type: "gain_shield", amount: 1 }] as CardAtomicEffect[],
  },
  // ---- 真空衰变 (4张) ----
  {
    id: 'vacuum_decay',
    name: '真空衰变',
    type: CardType.CLEAR,
    cost: 3,
    level: 0,
    isUpgradeReward: false,
    description: '移除己方场上1个粒子，熵值+1，然后能量+3。',
    quantity: 4,
    effects: [{ type: "remove_particle", player: "self", pos: { row: 0, col: 0 }, entropyPenalty: 1, energyReward: 3 }] as CardAtomicEffect[],
  },
  // ---- 正反催化 (4张) ----
  {
    id: 'antimatter_catalysis',
    name: '正反催化',
    type: CardType.SPECIAL,
    cost: 2,
    level: 0,
    isUpgradeReward: false,
    description: '将全场任意1个普通粒子(Q/E/P)转变为对应的反粒子(Ā/Ē/P̄)。',
    quantity: 4,
    effects: [{ type: "transform_particle", player: "any", pos: { row: 0, col: 0 }, from: "any_regular", to: "its_antimatter" }] as CardAtomicEffect[],
  },
  // ---- 引力弹弓 (3张) ----
  {
    id: 'gravity_slingshot',
    name: '引力弹弓',
    type: CardType.DISPLACE,
    cost: 2,
    level: 0,
    isUpgradeReward: false,
    description: '将己方1个粒子沿直线推出，若撞到对手粒子，双方各+1熵值（推出边界仅自己+1）。',
    quantity: 3,
    effects: [{ type: "push_particle", player: "self", origin: { row: 0, col: 0 }, direction: "up", dealDamageOnCollision: true }] as CardAtomicEffect[],
  },
  // ---- 能量过载 (3张) ----
  {
    id: 'energy_overload',
    name: '能量过载',
    type: CardType.SELF_DAMAGE,
    cost: 0,
    level: 0,
    isUpgradeReward: false,
    description: '能量+5，但熵值+2。若能量突破上限10，积累虚空零点能，超过5则出局。',
    quantity: 3,
    effects: [{ type: "gain_energy", amount: 5, canExceedCap: true }, { type: "gain_entropy", target: "self", amount: 2 }] as CardAtomicEffect[],
  },
];

// ============================================================
// 科技卡（36种 × 各2张 = 72张实例，6级×6种）
// ============================================================

const TECH_CARDS: CardDef[] = [
  // ========== Lv.1 经典力学 ==========
  {
    id: 'inertia_launch',
    name: '引力聚合',
    type: CardType.TECH,
    cost: 2,
    level: 1,
    isUpgradeReward: true,
    description: '使相邻的两个夸克(Q)合并为一个质子(P)。',
    quantity: 2,
    effects: [{ type: "merge_particles", player: "self", from: "Q", to: "P", requireAdjacent: true }] as CardAtomicEffect[],
  },
  {
    id: 'momentum_conservation',
    name: '动量守恒',
    type: CardType.TECH,
    cost: 1,
    level: 1,
    isUpgradeReward: false,
    description: '每当你移动一个粒子，对手须随机移动一个自己的粒子。能量+1。',
    quantity: 2,
    effects: [{ type: "random_move_particle", player: "opponent" }, { type: "gain_energy", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'lever_principle',
    name: '杠杆原理',
    type: CardType.TECH,
    cost: 2,
    level: 1,
    isUpgradeReward: false,
    description: '将己方相距2格的粒子互换位置（需两点均有粒子）。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 0, col: 2 } }] as CardAtomicEffect[],
  },
  {
    id: 'friction_torque',
    name: '摩擦力矩',
    type: CardType.TECH,
    cost: 2,
    level: 1,
    isUpgradeReward: false,
    description: '指定对手一个粒子，该粒子下一回合不可移动。',
    quantity: 2,
    effects: [{ type: "lock_particle", player: "opponent", pos: { row: 0, col: 0 } }] as CardAtomicEffect[],
  },
  {
    id: 'free_fall',
    name: '自由落体',
    type: CardType.TECH,
    cost: 1,
    level: 1,
    isUpgradeReward: false,
    description: '将己方一个粒子向下推出（撞到粒子或边界则停在原位）。',
    quantity: 2,
    effects: [{ type: "push_particle", player: "self", origin: { row: 0, col: 0 }, direction: "down" }] as CardAtomicEffect[],
  },
  {
    id: 'collision_restore',
    name: '碰撞恢复',
    type: CardType.TECH,
    cost: 3,
    level: 1,
    isUpgradeReward: false,
    description: '移除己方2个相邻粒子，各获得2点能量（共+4）。',
    quantity: 2,
    effects: [{ type: "remove_particle", player: "self", pos: { row: 0, col: 0 }, energyReward: 2 }, { type: "remove_particle", player: "self", pos: { row: 0, col: 1 }, energyReward: 2 }] as CardAtomicEffect[],
  },

  // ========== Lv.2 电磁统一 ==========
  {
    id: 'faraday_shield',
    name: '法拉第护盾',
    type: CardType.TECH,
    cost: 2,
    level: 2,
    isUpgradeReward: true,
    description: '获得3点护盾值，并抽取1张牌。',
    quantity: 2,
    effects: [{ type: "gain_shield", amount: 3 }, { type: "draw_cards", source: "main", count: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'coulomb_repulsion',
    name: '库仑斥力',
    type: CardType.TECH,
    cost: 2,
    level: 2,
    isUpgradeReward: false,
    description: '将对手一个粒子推离，撞到其他粒子造成碰撞伤害。',
    quantity: 2,
    effects: [{ type: "push_particle", player: "opponent", origin: { row: 0, col: 0 }, direction: "up" }] as CardAtomicEffect[],
  },
  {
    id: 'electromagnetic_induction',
    name: '电磁感应',
    type: CardType.TECH,
    cost: 3,
    level: 2,
    isUpgradeReward: false,
    description: '互换对手场上两个相邻粒子的位置，破坏其阵型。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "opponent", p1: { row: 0, col: 0 }, p2: { row: 0, col: 1 } }] as CardAtomicEffect[],
  },
  {
    id: 'magnetic_closure',
    name: '磁感线闭合',
    type: CardType.TECH,
    cost: 1,
    level: 2,
    isUpgradeReward: false,
    description: '己方两个粒子互换位置，扰乱对手攻击目标。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 0, col: 2 } }] as CardAtomicEffect[],
  },
  {
    id: 'electrostatic_adsorption',
    name: '静电吸附',
    type: CardType.TECH,
    cost: 2,
    level: 2,
    isUpgradeReward: false,
    description: '将对手一个普通粒子转化为反粒子，打乱其平衡。',
    quantity: 2,
    effects: [{ type: "transform_particle", player: "opponent", pos: { row: 0, col: 0 }, from: "any_regular", to: "its_antimatter" }] as CardAtomicEffect[],
  },
  {
    id: 'current_impact',
    name: '电流冲击',
    type: CardType.TECH,
    cost: 3,
    level: 2,
    isUpgradeReward: false,
    description: '对手熵值+2，但你必须弃掉1张手牌。',
    quantity: 2,
    effects: [{ type: "gain_entropy", target: "opponent", amount: 2 }, { type: "discard_cards", player: "self", count: 1 }] as CardAtomicEffect[],
  },

  // ========== Lv.3 热力学统计 ==========
  {
    id: 'maxwell_demon',
    name: '麦克斯韦妖',
    type: CardType.TECH,
    cost: 3,
    level: 3,
    isUpgradeReward: true,
    description: '互换己方两个粒子位置并能量+1。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 0, col: 2 } }, { type: "gain_energy", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'brownian_motion',
    name: '布朗运动',
    type: CardType.TECH,
    cost: 4,
    level: 3,
    isUpgradeReward: false,
    description: '将场上所有玩家的粒子随机打乱排列（每人的粒子留在自己场上）。',
    quantity: 2,
    effects: [{ type: "shuffle_particles", player: "all" }] as CardAtomicEffect[],
  },
  {
    id: 'heat_conduction',
    name: '热传导',
    type: CardType.TECH,
    cost: 3,
    level: 3,
    isUpgradeReward: false,
    description: '将己方1点熵值转移给对手，对手获得1能量作为补偿。',
    quantity: 2,
    effects: [{ type: "transfer_entropy", from: "self", to: "opponent", amount: 1, compensateEnergy: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'adiabatic_compression',
    name: '绝热压缩',
    type: CardType.TECH,
    cost: 2,
    level: 3,
    isUpgradeReward: false,
    description: '移除己方场上2个粒子，获得5能量。',
    quantity: 2,
    effects: [{ type: "remove_particle", player: "self", pos: { row: 0, col: 0 }, energyReward: 2 }, { type: "remove_particle", player: "self", pos: { row: 0, col: 1 }, energyReward: 3 }] as CardAtomicEffect[],
  },
  {
    id: 'entropy_reducer',
    name: '熵减机',
    type: CardType.TECH,
    cost: 6,
    level: 3,
    isUpgradeReward: false,
    description: '己方熵值-1。',
    quantity: 2,
    effects: [{ type: "reduce_entropy", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'phase_transition',
    name: '相变临界',
    type: CardType.TECH,
    cost: 3,
    level: 3,
    isUpgradeReward: false,
    description: '将己方两个普通粒子转化为反粒子，制造湮灭条件。',
    quantity: 2,
    effects: [{ type: "transform_particle", player: "self", pos: { row: 0, col: 0 }, from: "any_regular", to: "its_antimatter" }, { type: "transform_particle", player: "self", pos: { row: 0, col: 1 }, from: "any_regular", to: "its_antimatter" }] as CardAtomicEffect[],
  },

  // ========== Lv.4 量子力学 ==========
  {
    id: 'observation_collapse',
    name: '观测坍缩',
    type: CardType.TECH,
    cost: 4,
    level: 4,
    isUpgradeReward: true,
    description: '指定对手一个粒子，猜中种类则移除该粒子对方+2熵；猜错则自己+1熵。',
    quantity: 2,
    effects: [{ type: "conditional", condition: { type: "guess_particle_correct" }, then: [{ type: "remove_particle", player: "opponent", pos: { row: 0, col: 0 } }, { type: "gain_entropy", target: "opponent", amount: 2 }], else: [{ type: "gain_entropy", target: "self", amount: 1 }] }] as CardAtomicEffect[],
  },
  {
    id: 'quantum_tunneling',
    name: '量子隧穿',
    type: CardType.TECH,
    cost: 2,
    level: 4,
    isUpgradeReward: false,
    description: '互换己方两个粒子位置并获得1点护盾。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 0, col: 2 } }, { type: "gain_shield", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'superposition',
    name: '叠加态',
    type: CardType.TECH,
    cost: 1,
    level: 4,
    isUpgradeReward: false,
    description: '生成一个粒子（Q或E，自选）并抽取1张牌。',
    quantity: 2,
    effects: [{ type: "spawn_particle", player: "self", pos: "empty_slot", particle: "choose_q_or_e" }, { type: "draw_cards", source: "main", count: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'entanglement_transfer',
    name: '纠缠传输',
    type: CardType.TECH,
    cost: 3,
    level: 4,
    isUpgradeReward: false,
    description: '互换己方两个相邻粒子位置并生成一个新粒子。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 0, col: 1 } }, { type: "spawn_particle", player: "self", pos: "empty_slot", particle: "choose_q_or_e" }] as CardAtomicEffect[],
  },
  {
    id: 'wave_particle_duality',
    name: '波粒二象性',
    type: CardType.TECH,
    cost: 2,
    level: 4,
    isUpgradeReward: false,
    description: '将你的粒子视为"波"：指定一个粒子立即斜向移动一格。',
    quantity: 2,
    effects: [{ type: "diagonal_move", player: "self", from: { row: 0, col: 0 }, direction: "up-left" }] as CardAtomicEffect[],
  },
  {
    id: 'uncertainty',
    name: '不确定性',
    type: CardType.TECH,
    cost: 1,
    level: 4,
    isUpgradeReward: false,
    description: '弃掉1张手牌，随机抽取对手1张手牌。',
    quantity: 2,
    effects: [{ type: "discard_cards", player: "self", count: 1 }, { type: "steal_card", from: "opponent", count: 1, random: true }] as CardAtomicEffect[],
  },

  // ========== Lv.5 广义相对论 ==========
  {
    id: 'spacetime_curvature',
    name: '时空弯曲',
    type: CardType.TECH,
    cost: 5,
    level: 5,
    isUpgradeReward: true,
    description: '打乱棋盘：2人对战棋盘颠倒，4人对战棋盘逆时针旋转。',
    quantity: 2,
    effects: [{ type: "board_permute" }] as CardAtomicEffect[],
  },
  {
    id: 'gravitational_lens',
    name: '引力透镜',
    type: CardType.TECH,
    cost: 3,
    level: 5,
    isUpgradeReward: false,
    description: '己方一个粒子斜向移动并抽取1张牌。',
    quantity: 2,
    effects: [{ type: "diagonal_move", player: "self", from: { row: 0, col: 0 }, direction: "up-left" }, { type: "draw_cards", source: "main", count: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'time_dilation',
    name: '时间膨胀',
    type: CardType.TECH,
    cost: 4,
    level: 5,
    isUpgradeReward: false,
    description: '跳过对手的下一个回合。',
    quantity: 2,
    effects: [{ type: "skip_turn", target: "opponent" }] as CardAtomicEffect[],
  },
  {
    id: 'wormhole_connection',
    name: '虫洞连接',
    type: CardType.TECH,
    cost: 3,
    level: 5,
    isUpgradeReward: false,
    description: '己方两个对角粒子互换位置，能量+2。',
    quantity: 2,
    effects: [{ type: "swap_particles", player: "self", p1: { row: 0, col: 0 }, p2: { row: 2, col: 2 } }, { type: "gain_energy", amount: 2 }] as CardAtomicEffect[],
  },
  {
    id: 'singularity_collapse',
    name: '奇点坍缩',
    type: CardType.TECH,
    cost: 5,
    level: 5,
    isUpgradeReward: false,
    description: '移除己方一个粒子（能量+2），所有对手各+1熵。',
    quantity: 2,
    effects: [{ type: "remove_particle", player: "self", pos: { row: 0, col: 0 }, energyReward: 2 }, { type: "gain_entropy", target: "all_others", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'gravitational_wave',
    name: '引力波',
    type: CardType.TECH,
    cost: 4,
    level: 5,
    isUpgradeReward: false,
    description: '所有对手各+2熵值。',
    quantity: 2,
    effects: [{ type: "gain_entropy", target: "all_others", amount: 1 }, { type: "gain_entropy", target: "all_others", amount: 1 }] as CardAtomicEffect[],
  },

  // ========== Lv.6 弦论终极 ==========
  {
    id: 'dimension_strike',
    name: '维度打击',
    type: CardType.TECH,
    cost: 6,
    level: 6,
    isUpgradeReward: true,
    description: '指定一名对手，其弃掉2张最高等级的科技手牌（若无则弃4张基础牌），并+3熵值。',
    quantity: 2,
    effects: [{ type: "discard_cards", player: "opponent", count: 2, highestTechOnly: true }, { type: "gain_entropy", target: "opponent", amount: 3 }] as CardAtomicEffect[],
  },
  {
    id: 'brane_collision',
    name: '膜宇宙碰撞',
    type: CardType.TECH,
    cost: 6,
    level: 6,
    isUpgradeReward: false,
    description: '所有存活玩家各+2熵值，然后各自移除场上1个粒子。',
    quantity: 2,
    effects: [{ type: "gain_entropy", target: "all", amount: 2 }, { type: "remove_particle", player: "all", pos: { row: 0, col: 0 } }] as CardAtomicEffect[],
  },
  {
    id: 'superstring_resonance',
    name: '超弦共振',
    type: CardType.TECH,
    cost: 5,
    level: 6,
    isUpgradeReward: false,
    description: '将手牌洗回牌库，重新抽取5张牌（科技卡保留在手中）。',
    quantity: 2,
    effects: [{ type: "shuffle_hand", keepTech: true, drawCount: 5 }] as CardAtomicEffect[],
  },
  {
    id: 'calabi_yau_manifold',
    name: '卡拉比-丘流形',
    type: CardType.TECH,
    cost: 4,
    level: 6,
    isUpgradeReward: false,
    description: '将己方实验场重新排列（任意摆放所有粒子），熵值-1。',
    quantity: 2,
    effects: [{ type: "rearrange_lab" }, { type: "reduce_entropy", amount: 1 }] as CardAtomicEffect[],
  },
  {
    id: 'multiverse_split',
    name: '多重宇宙分裂',
    type: CardType.TECH,
    cost: 7,
    level: 6,
    isUpgradeReward: false,
    description: '你获得一个额外回合（正常回合流程）。',
    quantity: 2,
    effects: [{ type: "extra_turn" }] as CardAtomicEffect[],
  },
  {
    id: 'grand_unification',
    name: '大统一理论',
    type: CardType.TECH,
    cost: 8,
    level: 6,
    isUpgradeReward: false,
    description: '熵值-2，熵值上限+5。',
    quantity: 2,
    effects: [{ type: "reduce_entropy", amount: 2 }, { type: "increase_max_entropy", amount: 5 }] as CardAtomicEffect[],
  },
];

// ============================================================
// 卡牌注册表
// ============================================================

const ALL_CARDS: CardDef[] = [...BASIC_CARDS, ...TECH_CARDS];

const CARD_MAP: Record<string, CardDef> = {};
ALL_CARDS.forEach((c) => {
  CARD_MAP[c.id] = c;
});

/** 按ID获取卡牌定义 */
export function getCardDef(cardId: string): CardDef | undefined {
  return CARD_MAP[cardId];
}

/** 获取所有基础现象卡 */
export function getBasicCards(): CardDef[] {
  return BASIC_CARDS;
}

/** 获取指定等级的所有科技卡（含升级即得卡） */
export function getTechCardsByLevel(level: number): CardDef[] {
  return TECH_CARDS.filter((c) => c.level === level);
}

/** 获取指定等级的升级即得科技卡 */
export function getUpgradeRewardCard(level: number): CardDef | undefined {
  return TECH_CARDS.find((c) => c.level === level && c.isUpgradeReward);
}

/** 获取指定等级的牌库科技卡（不含升级即得卡） */
export function getTechDeckCards(level: number): CardDef[] {
  return TECH_CARDS.filter((c) => c.level === level && !c.isUpgradeReward);
}

/** 获取所有卡牌列表 */
export function getAllCards(): CardDef[] {
  return ALL_CARDS;
}

// ============================================================
// 动态卡牌注册（供 MOD 使用）
// ============================================================

/** 保存已注册的 MOD 卡牌 */
const MOD_CARDS: Map<string, CardDef> = new Map();

/**
 * 注册一张卡牌（MOD扩展用）
 * 若卡牌 ID 已存在则覆盖
 */
export function registerCard(card: CardDef): void {
  CARD_MAP[card.id] = card;
  MOD_CARDS.set(card.id, card);
  const existingIdx = ALL_CARDS.findIndex((c) => c.id === card.id);
  if (existingIdx >= 0) {
    ALL_CARDS[existingIdx] = card;
  } else {
    ALL_CARDS.push(card);
  }
}

/**
 * 批量注册卡牌（MOD 加载时调用）
 */
export function registerCards(cards: CardDef[]): void {
  for (const card of cards) {
    registerCard(card);
  }
}

/**
 * 注销一张卡牌（仅限 MOD 注册的卡牌）
 */
export function unregisterCard(cardId: string): boolean {
  if (!MOD_CARDS.has(cardId)) return false;
  const idx = ALL_CARDS.findIndex((c) => c.id === cardId);
  if (idx >= 0) ALL_CARDS.splice(idx, 1);
  delete CARD_MAP[cardId];
  MOD_CARDS.delete(cardId);
  return true;
}

/**
 * 获取所有 MOD 注册的卡牌
 */
export function getModRegisteredCards(): CardDef[] {
  return Array.from(MOD_CARDS.values());
}

// ============================================================
// 牌库构建
// ============================================================

/**
 * 为每位玩家创建独立的主牌库（60张基础现象卡，洗匀）
 */
export function createMainDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  BASIC_CARDS.forEach((def) => {
    for (let i = 0; i < def.quantity; i++) {
      deck.push({
        id: `${def.id}_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        defId: def.id,
      });
    }
  });
  // 追加 MOD 标记加入主牌库的卡（必须在 initGame 前 loadMod）
  const modMainCards = getModRegisteredCards().filter((c) => (c as any).addToMainDeck);
  modMainCards.forEach((def) => {
    const qty = (def as any).quantity ?? 1;
    for (let i = 0; i < qty; i++) {
      deck.push({
        id: `${def.id}_modmain_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        defId: def.id,
      });
    }
  });
  return shuffleDeck(deck);
}

/**
 * 创建科技副牌库（每级5张，不含升级即得卡）
 */
export function createTechDeck(level: number): CardInstance[] {
  const deck: CardInstance[] = [];
  // 内置科技卡牌
  const cards = getTechDeckCards(level);
  cards.forEach((def) => {
    deck.push({
      id: `${def.id}_tech_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      defId: def.id,
    });
  });
  // MOD 科技卡牌（addToTechDeckLevel 指定等级的）
  for (const card of getModRegisteredCards()) {
    if ((card as any).addToTechDeckLevel === level) {
      deck.push({
        id: `${card.id}_modtech_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        defId: card.id,
      });
    }
  }
  return shuffleDeck(deck);
}

/**
 * 创建所有科技副牌库
 */
export function createAllTechDecks(): Record<number, CardInstance[]> {
  return {
    1: createTechDeck(1),
    2: createTechDeck(2),
    3: createTechDeck(3),
    4: createTechDeck(4),
    5: createTechDeck(5),
    6: createTechDeck(6),
  };
}

// ============================================================
// 牌库操作
// ============================================================

/** 洗牌 (Fisher-Yates) */
export function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 从牌库顶部抽牌 */
export function drawFromDeck(deck: CardInstance[], count: number): { drawn: CardInstance[]; remaining: CardInstance[] } {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
}

/** 创建卡牌实例 */
export function createCardInstance(defId: string): CardInstance {
  return {
    id: `${defId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    defId,
  };
}
