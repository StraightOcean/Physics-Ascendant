// ============================================================
// 卡牌效果解析引擎 - 调度器
// 把卡牌效果拆分为按类型分发的处理器，详见 ./handlers
// ============================================================

import {
  CardAtomicEffect, GameState, PlayerState, PlayCardParams,
} from '../state/types';
import {
  getCurrentPlayer, findPlayer, getOpponents, getAlivePlayers, addLog,
} from '../state/GameState';
import { hasEffectHandler, getEffectHandler } from '../registry/EffectRegistry';

import {
  applyGainEnergy, applyGainEntropy, applyGainShield,
  applyReduceEntropy, applyIncreaseMaxEntropy, applyTransferEntropy,
} from './handlers/resource';
import {
  applySpawnParticle, applyMoveParticle, applyDiagonalMove,
  applyPushParticle, applyPullParticle, applyRemoveParticle,
  applySwapParticles, applyTransformParticle, applyMergeParticles,
} from './handlers/particle';
import {
  applyDrawCards, applyDiscardCards, applyStealCard, applyShuffleHand,
} from './handlers/hand';
import {
  applyLockParticle, applyRandomMoveParticle, applyBoardPermute,
  applyShuffleParticles, applyRearrangeLab, applyExtraTurn,
  applyDirectUpgrade, applyCosmicExpansion, applyQuantumFluctuation,
  applySkipTurn, applyConditional, applyPlaceholder,
} from './handlers/special';
import { checkEliminations } from './handlers/shared';

// ============================================================
// 效果解析入口
// ============================================================

/**
 * 执行一系列卡牌效果
 * 返回执行后出局的玩家ID列表（用于触发遗产）
 */
export function resolveEffects(
  state: GameState,
  effects: CardAtomicEffect[],
  params?: PlayCardParams
): string[] {
  const eliminatedPlayers: string[] = [];
  for (const effect of effects) {
    const result = resolveSingleEffect(state, effect, params);
    eliminatedPlayers.push(...result);
  }
  const newEliminated = checkEliminations(state);
  eliminatedPlayers.push(...newEliminated);
  return [...new Set(eliminatedPlayers)];
}

/** 解析单个卡牌效果 */
function resolveSingleEffect(
  state: GameState,
  effect: CardAtomicEffect,
  params?: PlayCardParams
): string[] {
  // 解析目标玩家（默认当前玩家）
  const player = params?.targetPlayerId
    ? findPlayer(state, params.targetPlayerId) ?? getCurrentPlayer(state)
    : getCurrentPlayer(state);
  const opponent = params?.targetPlayerId
    ? findPlayer(state, params.targetPlayerId) ?? getOpponents(state, getCurrentPlayer(state).id)[0]
    : getOpponents(state, getCurrentPlayer(state).id)[0];

  switch (effect.type) {
    // 资源类
    case 'gain_energy':       return applyGainEnergy(state, player, effect);
    case 'gain_entropy':      return applyGainEntropy(state, effect, params);
    case 'gain_shield':       applyGainShield(player, effect); return [];
    case 'reduce_entropy':    applyReduceEntropy(player, effect); return [];
    case 'increase_max_entropy': applyIncreaseMaxEntropy(player, effect); return [];
    case 'transfer_entropy':  applyTransferEntropy(state, player, opponent!, effect); return [];

    // 粒子操作类
    case 'spawn_particle':    return applySpawnParticle(state, player, effect, params);
    case 'move_particle':     applyMoveParticle(state, player, effect, params); return [];
    case 'diagonal_move':     applyDiagonalMove(state, player, effect, params); return [];
    case 'push_particle':     return applyPushParticle(state, player, effect, params);
    case 'pull_particle':     return applyPullParticle(state, player, effect, params);
    case 'remove_particle':
      if (effect.player === 'all') {
        const out: string[] = [];
        for (const p of getAlivePlayers(state)) {
          out.push(...applyRemoveParticle(state, p, effect, params));
        }
        return out;
      }
      return applyRemoveParticle(state, player, effect, params);
    case 'swap_particles':    applySwapParticles(state, player, effect, params); return [];
    case 'transform_particle': applyTransformParticle(state, player, effect, params); return [];
    case 'merge_particles':   applyMergeParticles(state, player, effect); return [];

    // 手牌/牌库类
    case 'draw_cards':        applyDrawCards(state, player, effect); return [];
    case 'discard_cards':     applyDiscardCards(state, player, effect, params); return [];
    case 'steal_card':        applyStealCard(state, player, effect); return [];
    case 'shuffle_hand':      applyShuffleHand(state, player, effect); return [];

    // 特殊类
    case 'lock_particle':     applyLockParticle(state, effect); return [];
    case 'random_move_particle': return applyRandomMoveParticle(state, effect);
    case 'board_permute':     applyBoardPermute(state); return [];
    case 'shuffle_particles': applyShuffleParticles(state, effect); return [];
    case 'rearrange_lab':     applyRearrangeLab(state, player); return [];
    case 'extra_turn':        applyExtraTurn(state, player); return [];
    case 'extra_main_action': state.temporaryEffects.push({ type: 'extra_main_action', playerId: player.id, duration: 1 }); return [];
    case 'direct_upgrade':    return applyDirectUpgrade(state, player, effect);
    case 'cosmic_expansion':  applyCosmicExpansion(state); return [];
    case 'quantum_fluctuation': applyQuantumFluctuation(state); return [];
    case 'skip_turn':         applySkipTurn(opponent!, effect); return [];
    case 'conditional':       return applyConditional(state, effect, params, (sub) => resolveSingleEffect(state, sub, params));
    case 'placeholder':       applyPlaceholder(state, player, effect); return [];

    default: {
      // 编译期已穷举；但运行期可能有 MOD 注册的新类型
      // 优先查询 EffectRegistry，若已注册则委托给外部 handler
      const typeName = (effect as any)?.type as string | undefined;
      if (typeName && hasEffectHandler(typeName)) {
        const handler = getEffectHandler(typeName)!;
        return handler(state, effect, params);
      }
      addLog(state, player.id, `未实现的效果类型: ${String(typeName)}`);
      return [];
    }
  }
}
