// ============================================================
// MOD 包类型定义
// ============================================================

import { CardDef, CardAtomicEffect } from '../state/types';

/**
 * MOD 包格式
 * 一个 JSON/TS 对象即可定义完整的卡牌扩展包
 */
export interface ModPackage {
  /** MOD 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 版本号 */
  version: string;
  /** 依赖的引擎版本 */
  engineVersion: string;
  /** 作者 */
  author?: string;
  /** 描述 */
  description?: string;

  /** 新增卡牌（CardDef + effects 已合并） */
  cards: ModCardDef[];

  /** 新增效果类型（可选） */
  effectTypes?: ModEffectTypeDef[];

  /** 新增宇宙骰子事件（可选） */
  cosmicEvents?: ModCosmicEventDef[];

  /** 新增升级等级/构型检测（可选） */
  upgrades?: ModUpgradeDef[];
}

/**
 * MOD 卡牌定义（完整定义含效果）
 */
export interface ModCardDef extends CardDef {
  effects: CardAtomicEffect[];
  /** 是否应加入主牌库 */
  addToMainDeck?: boolean;
  /** 加入科技牌库的等级（若为科技卡） */
  addToTechDeckLevel?: number;
}

/**
 * MOD 效果类型定义
 */
export interface ModEffectTypeDef {
  /** 效果类型标识（如 'particle_beam'） */
  type: string;
  /** 参数 schema 描述 */
  paramsSchema: Record<string, string>;
  /** 效果描述 */
  description: string;
}

/**
 * MOD 宇宙骰子事件定义
 */
export interface ModCosmicEventDef {
  id: number;
  name: string;
  description: string;
  /** 使用引擎内置效果类型（可选） */
  effects?: CardAtomicEffect[];
}

/**
 * MOD 升级定义
 */
export interface ModUpgradeDef {
  level: number;
  name: string;
  energyCost: number;
  description: string;
}

/**
 * MOD 加载结果
 */
export interface ModLoadResult {
  success: boolean;
  dlcId: string;
  /** 加载详情 */
  cardsLoaded: number;
  effectTypesLoaded: number;
  cosmicEventsLoaded: number;
  upgradesLoaded: number;
  /** 错误信息 */
  errors: string[];
  /** 警告信息（不阻塞加载但需用户知晓） */
  warnings: string[];
}
