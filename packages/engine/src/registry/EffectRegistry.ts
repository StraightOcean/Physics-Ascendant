// ============================================================
// 效果处理器注册表 — 支持 MOD 动态注册新效果类型
// ============================================================

import { GameState, CardAtomicEffect, PlayCardParams } from '../state/types';

/** 效果处理函数签名：返回出局玩家ID列表 */
export type EffectHandlerFn = (
  state: GameState,
  effect: CardAtomicEffect,
  params?: PlayCardParams
) => string[];

/** 全局效果处理器注册表 */
const effectHandlers: Map<string, EffectHandlerFn> = new Map();

/**
 * 注册效果处理器（MOD 扩展用）
 * 若类型已存在则覆盖（允许 MOD 覆盖默认行为）
 */
export function registerEffectHandler(
  effectType: string,
  handler: EffectHandlerFn
): void {
  effectHandlers.set(effectType, handler);
}

/**
 * 获取效果处理器
 * 返回 undefined 表示该效果类型未注册
 */
export function getEffectHandler(effectType: string): EffectHandlerFn | undefined {
  return effectHandlers.get(effectType);
}

/**
 * 检查效果类型是否已注册
 */
export function hasEffectHandler(effectType: string): boolean {
  return effectHandlers.has(effectType);
}

/**
 * 注销效果处理器（仅限 MOD 注册的）
 */
export function unregisterEffectHandler(effectType: string): boolean {
  return effectHandlers.delete(effectType);
}

/**
 * 获取所有已注册的效果类型
 */
export function getRegisteredEffectTypes(): string[] {
  return Array.from(effectHandlers.keys());
}
