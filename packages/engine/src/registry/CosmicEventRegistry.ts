// ============================================================
// 宇宙骰子事件注册表 — 支持 MOD 动态注册新事件
// ============================================================

import { GameState } from '../state/types';

/**
 * 宇宙骰子事件处理器配置
 */
export interface CosmicEventConfig {
  /** 事件名称 */
  name: string;
  /** 事件描述 */
  description: string;
  /** 事件应用函数 */
  apply: (state: GameState) => void;
  /** 事件清理函数（回合结束时调用，可选） */
  cleanup?: (state: GameState) => void;
}

/** 全局宇宙骰子事件注册表 */
const cosmicEvents: Map<number, CosmicEventConfig> = new Map();

/**
 * 注册宇宙骰子事件（MOD 扩展用）
 * 若 eventId 已存在则覆盖
 */
export function registerCosmicEvent(
  eventId: number,
  config: CosmicEventConfig
): void {
  cosmicEvents.set(eventId, config);
}

/**
 * 批量注册宇宙骰子事件
 */
export function registerCosmicEvents(
  events: Array<{ eventId: number; config: CosmicEventConfig }>
): void {
  for (const { eventId, config } of events) {
    registerCosmicEvent(eventId, config);
  }
}

/**
 * 获取宇宙骰子事件配置
 */
export function getCosmicEvent(eventId: number): CosmicEventConfig | undefined {
  return cosmicEvents.get(eventId);
}

/**
 * 检查事件是否已注册
 */
export function hasCosmicEvent(eventId: number): boolean {
  return cosmicEvents.has(eventId);
}

/**
 * 注销宇宙骰子事件
 */
export function unregisterCosmicEvent(eventId: number): boolean {
  return cosmicEvents.delete(eventId);
}

/**
 * 获取所有已注册的宇宙骰子事件 ID
 */
export function getRegisteredCosmicEventIds(): number[] {
  return Array.from(cosmicEvents.keys());
}

/**
 * 获取所有已注册的宇宙骰子事件
 */
export function getAllCosmicEvents(): Map<number, CosmicEventConfig> {
  return new Map(cosmicEvents);
}
