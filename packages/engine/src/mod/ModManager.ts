// ============================================================
// MOD 管理器 — 加载、卸载、版本检查
// ============================================================

import { ModPackage, ModLoadResult } from './types';
import { registerCards } from '../cards/CardRegistry';
import {
  registerEffectHandler, hasEffectHandler, unregisterEffectHandler,
} from '../registry/EffectRegistry';
import { registerCosmicEvent } from '../registry/CosmicEventRegistry';
import { registerUpgrade } from '../registry/UpgradeRegistry';
import { addLog } from '../state/GameState';
import { resolveEffects } from '../cards/EffectResolver';
import { checkAndProcessLegacies } from '../legacy/LegacyMechanism';
import type { GameState } from '../state/types';

/** 当前引擎版本 */
const ENGINE_VERSION = '0.2.0';

/** 已加载的 MOD 列表 */
const loadedMods: Map<string, ModPackage> = new Map();

/**
 * 加载一个 MOD 包
 */
export function loadMod(dlc: ModPackage): ModLoadResult {
  const result: ModLoadResult = {
    success: true,
    dlcId: dlc.id,
    cardsLoaded: 0,
    effectTypesLoaded: 0,
    cosmicEventsLoaded: 0,
    upgradesLoaded: 0,
    errors: [],
    warnings: [],
  };

  // 1. 版本检查
  if (!checkVersion(dlc.engineVersion, ENGINE_VERSION)) {
    result.errors.push(
      `引擎版本不匹配: MOD 需要 ${dlc.engineVersion}，当前引擎 ${ENGINE_VERSION}`
    );
    result.success = false;
    return result;
  }

  // 2. 注册卡牌（含效果）
  if (dlc.cards && dlc.cards.length > 0) {
    try {
      registerCards(dlc.cards);
      result.cardsLoaded = dlc.cards.length;
      // 校验卡牌的 effect types 是否都已注册
      validateLoaded(dlc, result);
    } catch (e) {
      result.errors.push(`卡牌注册失败: ${(e as Error).message}`);
    }
  }

  // 3. 注册效果类型 — 仅为占位记录
  // 实际可执行 handler 必须由 MOD 配套 JS 在 host 环境中通过 registerEffectHandler() 注册
  if (dlc.effectTypes && dlc.effectTypes.length > 0) {
    for (const ef of dlc.effectTypes) {
      result.effectTypesLoaded++;
      if (!hasEffectHandler(ef.type)) {
        result.warnings.push(
          `效果类型 [${ef.type}] 已声明但未注册可执行 handler；将走 default 分支`
        );
      }
    }
  }

  // 4. 注册宇宙骰子事件
  if (dlc.cosmicEvents && dlc.cosmicEvents.length > 0) {
    for (const ce of dlc.cosmicEvents) {
      try {
        registerCosmicEvent(ce.id, {
          name: ce.name,
          description: ce.description,
          apply: (state: GameState) => {
            addLog(state, 'system', `[MOD宇宙事件] ${ce.name}: ${ce.description}`);
            // MOD 事件若包含 effects 数组，则执行之（使用引擎内置效果类型）
            if ((ce as any).effects && Array.isArray((ce as any).effects)) {
              const eliminated = resolveEffects(state, (ce as any).effects);
              if (eliminated.length > 0) {
                checkAndProcessLegacies(state);
              }
            }
          },
        });
        result.cosmicEventsLoaded++;
      } catch (e) {
        result.errors.push(`宇宙事件注册失败 [${ce.id}]: ${(e as Error).message}`);
      }
    }
  }

  // 5. 注册升级检测
  if (dlc.upgrades && dlc.upgrades.length > 0) {
    for (const up of dlc.upgrades) {
      try {
        result.upgradesLoaded++;
        if (up.level < 1 || up.level > 6) {
          result.warnings.push(`升级等级 ${up.level} 越界 (合法: 1-6)`);
        }
        if (typeof up.energyCost !== 'number' || up.energyCost < 0) {
          result.warnings.push(`升级 Lv.${up.level} 能量消耗非法: ${up.energyCost}`);
        }
      } catch (e) {
        result.errors.push(`升级注册失败 [Lv.${up.level}]: ${(e as Error).message}`);
      }
    }
  }

  // 6. 记录已加载
  loadedMods.set(dlc.id, dlc);

  return result;
}

/**
 * 验证已加载 MOD 的卡牌字段合法性
 * 将检查 addToMainDeck / addToTechDeckLevel 等字段值
 */
function validateLoaded(dlc: ModPackage, result: ModLoadResult): void {
  for (const card of dlc.cards) {
    const def = card as any;
    if (def.addToMainDeck === true && (typeof def.addToTechDeckLevel === 'number')) {
      // 同时声明两个字段是允许的（卡可同时在 main 和 tech 中），不警告
    }
    if (def.addToTechDeckLevel !== undefined) {
      if (typeof def.addToTechDeckLevel !== 'number' ||
          def.addToTechDeckLevel < 1 || def.addToTechDeckLevel > 6) {
        result.warnings.push(
          `卡 [${card.id}] addToTechDeckLevel=${def.addToTechDeckLevel} 越界 (1-6)`
        );
      }
    }
  }
}

/**
 * 卸载一个 MOD 包
 */
export function unloadMod(dlcId: string): boolean {
  const dlc = loadedMods.get(dlcId);
  if (!dlc) return false;

  // 同步清理：注销该 MOD 注册的效果 handler（如有）
  if (dlc.effectTypes) {
    for (const ef of dlc.effectTypes) {
      unregisterEffectHandler(ef.type);
    }
  }

  return loadedMods.delete(dlcId);
}

/**
 * 获取所有已加载的 MOD
 */
export function getLoadedMods(): ModPackage[] {
  return Array.from(loadedMods.values());
}

/**
 * 检查 MOD 是否已加载
 */
export function isModLoaded(dlcId: string): boolean {
  return loadedMods.has(dlcId);
}

// ============================================================
// 版本检查
// ============================================================

/**
 * 检查引擎版本兼容性
 * 简单的主版本号比较：主版本号必须一致
 */
function checkVersion(required: string, current: string): boolean {
  const reqParts = required.split('.').map(Number);
  const curParts = current.split('.').map(Number);

  // 主版本号必须匹配
  if (reqParts[0] !== curParts[0]) return false;

  // 次版本号：需要的不能高于当前的
  if (reqParts.length > 1 && curParts.length > 1) {
    if (reqParts[1] > curParts[1]) return false;
  }

  return true;
}
