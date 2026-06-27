// ============================================================
// 升级检查器注册表 — 支持 MOD 动态注册新升级检测
// ============================================================

import { ParticleType } from '../state/types';

/** 升级检测结果 */
export interface UpgradeCheckResult {
  satisfied: boolean;
  reason: string;
}

/** 升级检查函数签名 */
export type UpgradeCheckerFn = (
  lab: (ParticleType | null)[][],
  level: number
) => UpgradeCheckResult;

/** 升级配置 */
export interface UpgradeConfig {
  level: number;
  name: string;
  energyCost: number;
  description: string;
  checker: UpgradeCheckerFn;
}

/** 全局升级检查器注册表 */
const upgradeCheckers: Map<number, UpgradeCheckerFn> = new Map();
const upgradeConfigs: Map<number, UpgradeConfig> = new Map();

/**
 * 注册升级配置及检查器（MOD 扩展用）
 * 若等级已存在则覆盖
 */
export function registerUpgrade(config: UpgradeConfig): void {
  upgradeCheckers.set(config.level, config.checker);
  upgradeConfigs.set(config.level, config);
}

/**
 * 获取升级配置
 */
export function getUpgradeConfig(level: number): UpgradeConfig | undefined {
  return upgradeConfigs.get(level);
}

/**
 * 获取升级检查器
 */
export function getUpgradeChecker(level: number): UpgradeCheckerFn | undefined {
  return upgradeCheckers.get(level);
}

/**
 * 注销升级检查器
 */
export function unregisterUpgrade(level: number): boolean {
  upgradeCheckers.delete(level);
  return upgradeConfigs.delete(level);
}

/**
 * 获取所有已注册的升级等级
 */
export function getRegisteredUpgradeLevels(): number[] {
  return Array.from(upgradeConfigs.keys()).sort((a, b) => a - b);
}

/**
 * 获取所有升级配置
 */
export function getAllUpgradeConfigs(): Map<number, UpgradeConfig> {
  return new Map(upgradeConfigs);
}
