// ============================================================
// 核心类型定义 - 《物理法则之下：科技死斗》
// ============================================================

/** 粒子类型：3种正物质 + 3种反物质 */
export type ParticleType = 'Q' | 'E' | 'P' | 'Ā' | 'Ē' | 'P̄';

/** 网格坐标 */
export interface GridPos {
  row: number; // 0-based
  col: number; // 0-based
}

/** 方向（上下左右） */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** 正交方向向量 */
export const DIRECTION_VECTORS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

/** 对角线方向 */
export type DiagonalDirection = 'up-left' | 'up-right' | 'down-left' | 'down-right';

/** 对角线方向向量 */
export const DIAGONAL_VECTORS: Record<DiagonalDirection, { dr: number; dc: number }> = {
  'up-left': { dr: -1, dc: -1 },
  'up-right': { dr: -1, dc: 1 },
  'down-left': { dr: 1, dc: -1 },
  'down-right': { dr: 1, dc: 1 },
};

/** 正反物质配对映射 */
export const ANTIMATTER_PAIR: Record<ParticleType, ParticleType> = {
  Q: 'Ā',
  Ā: 'Q',
  E: 'Ē',
  Ē: 'E',
  P: 'P̄',
  P̄: 'P',
};

/** 游戏阶段（6 阶段，rule.md v2.0） */
export enum GamePhase {
  COSMIC_DIE = 0,      // 宇宙骰子
  ENTROPY_INCREASE = 1, // 宇宙熵增
  SUPPLY_DRAW = 2,      // 补给与抽牌
  MAIN_ACTION = 3,      // 主要行动（升级或部署）
  ANNIHILATION = 4,     // 湮灭清算
  TURN_END = 5,         // 回合结束
}

/** 卡牌类型 */
export enum CardType {
  RESOURCE = '资源',
  DEPLOY = '部署',
  DISPLACE = '位移',
  ATTACK = '攻击',
  INTERFERE = '干扰',
  DEFENSE = '防御',
  CLEAR = '清场',
  SPECIAL = '特殊',
  SELF_DAMAGE = '自损',
  TECH = '科技',
}

/** 卡牌所属等级（科技卡）或 0（基础卡） */
export type TechLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 卡牌定义 */
export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  level: TechLevel;
  isUpgradeReward: boolean; // 是否为升级即得卡
  description: string;
  quantity: number; // 牌库中该卡的数量
  effects: CardAtomicEffect[]; // 卡牌效果列表
}

/** 手牌实例 */
export interface CardInstance {
  id: string;
  defId: string; // 对应 CardDef.id
}

/** 玩家状态 */
export interface PlayerState {
  id: string;
  name: string;
  /** 实验场网格，lab[row][col]（rule.md v2.0 §一：默认3x3，宇宙膨胀时5x5） */
  lab: (ParticleType | null)[][];
  /** 当前实验场尺寸（3 或 5；rule.md v2.0 §九 骰面3） */
  labSize: 3 | 5;
  /** 被锁定的粒子位置（摩擦力矩标记） */
  lockedCells: {row: number; col: number}[];
  /** 是否为额外回合（多重宇宙分裂） */
  extraTurn: boolean;
  /** 能量（rule.md v2.0 §三：上限10，每科技+1，Lv.6=16；可突破上限积累虚空零点能） */
  energy: number;
  /** 熵值（rule.md v2.0 §三：上限10，每科技+5，Lv.6=40） */
  entropy: number;
  /** 虚空零点能 0-5，超过5出局 */
  voidEnergy: number;
  /** 研究所等级 0-6 */
  researchLevel: number;
  /** 手牌 */
  hand: CardInstance[];
  /** 护盾值 */
  shield: number;
  /** 是否存活 */
  alive: boolean;
  /** 是否跳过下回合（时间膨胀效果） */
  skipNextTurn: boolean;
  /** 熵值上限（初始10，每科技等级+5） */
  maxEntropy: number;
  /** 能量上限（初始10，每科技等级+1） */
  maxEnergy: number;
}

/** 宇宙骰子事件定义 */
export interface CosmicEvent {
  id: number;
  name: string;
  description: string;
}

/** 6个宇宙骰子事件 */
export const COSMIC_EVENTS: Record<number, CosmicEvent> = {
  1: { id: 1, name: '光速变化', description: '所有"弹射""推力"类位移效果距离+1' },
  2: { id: 2, name: '量子涨落', description: '所有玩家按逆时针顺序给邻座1张牌' },
  3: { id: 3, name: '宇宙膨胀', description: '实验场临时变为5x5，回合结束外围粒子湮灭' },
  4: { id: 4, name: '强相互作用', description: '相邻2个夸克(Q)合并为1个质子(P)' },
  5: { id: 5, name: '弱衰变', description: '随机1个质子(P)衰变为电子(E)，获得1能量' },
  6: { id: 6, name: '暗能量爆发', description: '熵值-1，能量上限本回合-2' },
};

/** 游戏全局状态 */
export interface GameState {
  players: PlayerState[];
  turn: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  cosmicDieResult: number | null;
  playerCount: number;
  /** 每位玩家独立的主牌库 */
  mainDecks: Record<string, CardInstance[]>;
  /** 每位玩家独立的弃牌堆 */
  discardPiles: Record<string, CardInstance[]>;
  /** 科技副牌库（按等级） */
  techDecks: Record<number, CardInstance[]>;
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 胜利者ID */
  winner: string | null;
  /** 事件日志 */
  log: GameLogEntry[];
  /** 本回合临时效果标记 */
  temporaryEffects: TemporaryEffect[];
}

/** 游戏日志条目 */
export interface GameLogEntry {
  turn: number;
  phase: GamePhase;
  playerId: string;
  message: string;
}

/** 临时效果 */
export interface TemporaryEffect {
  type: string;
  playerId: string;
  duration: number; // 剩余回合数
  data?: Record<string, unknown>;
}

// ============================================================
// 卡牌效果原子指令
// ============================================================

export interface GainEnergyEffect {
  type: 'gain_energy';
  amount: number;
  canExceedCap?: boolean;
}

export interface GainEntropyEffect {
  type: 'gain_entropy';
  target: 'self' | 'opponent' | 'all_others' | 'all';
  amount: number;
}

export interface SpawnParticleEffect {
  type: 'spawn_particle';
  player: 'self' | 'opponent';
  pos: GridPos | 'empty_slot';
  particle: ParticleType | 'choose_q_or_e';
}

export interface MoveParticleEffect {
  type: 'move_particle';
  player: 'self' | 'opponent';
  from: GridPos;
  direction: Direction;
  steps: number;
}

export interface PushParticleEffect {
  type: 'push_particle';
  player: 'self' | 'opponent';
  origin: GridPos;
  direction: Direction;
  /** 撞到对手粒子时双方各+1熵 */
  dealDamageOnCollision?: boolean;
}

export interface PullParticleEffect {
  type: 'pull_particle';
  player: 'self' | 'opponent';
  target: GridPos;
  direction: Direction;
}

export interface RemoveParticleEffect {
  type: 'remove_particle';
  player: 'self' | 'opponent' | 'all';
  pos: GridPos;
  /** 移除后给玩家熵值惩罚 */
  entropyPenalty?: number;
  /** 移除后给玩家能量奖励 */
  energyReward?: number;
}

export interface LockParticleEffect {
  type: 'lock_particle';
  /** 目标对手的一个粒子 */
  player: 'opponent';
  pos: GridPos;
}

export interface RandomMoveParticleEffect {
  type: 'random_move_particle';
  player: 'self' | 'opponent';
}

export interface ExtraTurnEffect {
  type: 'extra_turn';
}

export interface BoardPermuteEffect {
  type: 'board_permute';
}

export interface ShuffleParticlesEffect {
  type: 'shuffle_particles';
  player: 'all' | 'self';
}


export interface SwapParticlesEffect {
  type: 'swap_particles';
  player: 'self' | 'opponent';
  p1: GridPos;
  p2: GridPos;
}

export interface TransformParticleEffect {
  type: 'transform_particle';
  player: 'self' | 'opponent' | 'any';
  pos: GridPos;
  from: ParticleType | 'any' | 'any_regular';
  to: ParticleType | 'its_antimatter' | 'choose';
}

export interface GainShieldEffect {
  type: 'gain_shield';
  amount: number;
}

export interface DrawCardsEffect {
  type: 'draw_cards';
  source: 'main' | 'tech';
  count: number;
  techLevel?: number;
}

export interface DiscardCardsEffect {
  type: 'discard_cards';
  player: 'self' | 'opponent';
  count: number;
  cardType?: 'tech' | 'basic' | 'any';
  highestTechOnly?: boolean;
}

export interface StealCardEffect {
  type: 'steal_card';
  from: 'opponent';
  count: number;
  random?: boolean;
}

export interface SkipTurnEffect {
  type: 'skip_turn';
  target: 'opponent';
}

export interface ReduceEntropyEffect {
  type: 'reduce_entropy';
  amount: number;
  oncePerGame?: boolean;
}

export interface IncreaseMaxEntropyEffect {
  type: 'increase_max_entropy';
  amount: number;
}

export interface TransferEntropyEffect {
  type: 'transfer_entropy';
  from: 'self';
  to: 'opponent';
  amount: number;
  compensateEnergy: number;
}

export interface MergeParticlesEffect {
  type: 'merge_particles';
  player: 'self' | 'opponent';
  from: ParticleType;
  to: ParticleType;
  requireAdjacent?: boolean;
}

export interface RearrangeLabEffect {
  type: 'rearrange_lab';
}

export interface ShuffleHandEffect {
  type: 'shuffle_hand';
  keepTech: boolean;
  drawCount: number;
}

export interface ExtraMainActionEffect {
  type: 'extra_main_action';
}

export interface DirectUpgradeEffect {
  type: 'direct_upgrade';
  targetLevel: number;
  cost: number;
  entropyPenalty: number;
}

export interface CosmicExpansionEffect {
  type: 'cosmic_expansion';
}

export interface QuantumFluctuationEffect {
  type: 'quantum_fluctuation';
}

export interface PlaceholderEffect {
  type: 'placeholder';
  cardId: string;
}

export interface ConditionalEffect {
  type: 'conditional';
  condition: EffectCondition;
  then: CardAtomicEffect[];
  else?: CardAtomicEffect[];
}

export type CardAtomicEffect =
  | GainEnergyEffect
  | GainEntropyEffect
  | SpawnParticleEffect
  | MoveParticleEffect
  | PushParticleEffect
  | PullParticleEffect
  | RemoveParticleEffect
  | SwapParticlesEffect
  | TransformParticleEffect
  | GainShieldEffect
  | DrawCardsEffect
  | DiscardCardsEffect
  | StealCardEffect
  | SkipTurnEffect
  | ReduceEntropyEffect
  | IncreaseMaxEntropyEffect
  | TransferEntropyEffect
  | MergeParticlesEffect
  | RearrangeLabEffect
  | ShuffleHandEffect
  | ExtraMainActionEffect
  | DirectUpgradeEffect
  | DiagonalMoveEffect
  | CosmicExpansionEffect
  | QuantumFluctuationEffect
  | ConditionalEffect
  | LockParticleEffect
  | RandomMoveParticleEffect
  | ExtraTurnEffect
  | BoardPermuteEffect
  | ShuffleParticlesEffect
  | PlaceholderEffect;

export interface DiagonalMoveEffect {
  type: 'diagonal_move';
  player: 'self' | 'opponent';
  from: GridPos;
  direction: DiagonalDirection;
}

// 效应条件
export interface EffectCondition {
  type: 'guess_particle_correct' | 'has_tech_cards' | 'particle_collision' | 'has_adjacent_same';
  params?: Record<string, unknown>;
}

// ============================================================
// 玩家动作
// ============================================================

export type PlayerAction =
  | { type: 'play_card'; cardId: string; params?: PlayCardParams }
  | { type: 'upgrade_research'; targetLevel: number }
  | { type: 'end_phase' }
  | { type: 'surrender' }
  | { type: 'discard_card'; cardId: string };

/** 打牌时的额外参数 */
export interface PlayCardParams {
  targetPlayerId?: string;
  targetPos?: GridPos;
  direction?: Direction | string;
  particleType?: ParticleType;
  fromPos?: GridPos;
  toPos?: GridPos;
  /** swap_particles 用：第一个位置 */
  p1?: GridPos;
  /** swap_particles 用：第二个位置 */
  p2?: GridPos;
  guessType?: ParticleType;
  guessCorrect?: boolean;
  chooseDiscardCardIds?: string[];
}

// ============================================================
// 升级构型检测参数
// ============================================================

export interface UpgradeRequirement {
  level: number;
  name: string;
  energyCost: number;
  description: string;
}

export const UPGRADE_REQUIREMENTS: Record<number, UpgradeRequirement> = {
  1: { level: 1, name: '经典力学', energyCost: 3, description: '任意2个夸克(Q)相邻' },
  2: { level: 2, name: '电磁统一', energyCost: 4, description: '1个质子(P)+1个电子(E)相邻' },
  3: { level: 3, name: '热力学统计', energyCost: 5, description: '1个P与任意1个游离粒子相隔1格' },
  4: { level: 4, name: '量子力学', energyCost: 6, description: '场上同时存在至少1对正反物质对且不相邻' },
  5: { level: 5, name: '广义相对论', energyCost: 7, description: '场上至少3个粒子排成一条直线' },
  6: { level: 6, name: '弦论终极', energyCost: 8, description: '场上至少存在5种不同种类的粒子' },
};

// ============================================================
// 粒子颜色映射（供 UI/CLI 渲染使用，统一引用避免重复）
// ============================================================

export const PARTICLE_COLORS: Record<ParticleType, string> = {
  Q: '#3498db',   // 蓝色 - 夸克
  E: '#2ecc71',   // 绿色 - 电子
  P: '#e74c3c',   // 红色 - 质子
  'Ā': '#e67e22', // 橙色 - 反夸克
  'Ē': '#9b59b6', // 紫色 - 反电子
  'P̄': '#f1c40f', // 金色 - 反质子
};
