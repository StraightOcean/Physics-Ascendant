// ============================================================
// 资源类效果处理器
// energy / entropy / shield / max entropy
// ============================================================

import {
  GameState, PlayerState, PlayCardParams,
} from '../../state/types';
import {
  addLog, getCurrentPlayer, getOpponents, getAlivePlayers, findPlayer,
} from '../../state/GameState';

/** 能量获取（可突破上限 → 虚空零点能） */
export function applyGainEnergy(
  state: GameState,
  player: PlayerState,
  effect: { amount: number; canExceedCap?: boolean }
): string[] {
  const eliminated: string[] = [];
  const oldEnergy = player.energy;
  const cap = player.maxEnergy;
  player.energy += effect.amount;

  if (player.energy > cap) {
    const oldExcess = Math.max(0, oldEnergy - cap);
    const newExcess = Math.max(0, player.energy - cap);
    const addedVoid = newExcess - oldExcess;
    if (addedVoid > 0) {
      player.voidEnergy += addedVoid;
      addLog(state, player.id, `能量突破上限！虚空零点能 +${addedVoid}，当前: ${player.voidEnergy}`);
    }
    if (player.voidEnergy > 5) {
      eliminated.push(player.id);
    }
  }

  addLog(state, player.id, `能量 ${oldEnergy} → ${player.energy}`);
  return eliminated;
}

/** 熵增（支持 self / opponent / all_others / all） */
export function applyGainEntropy(
  state: GameState,
  effect: { target: string; amount: number },
  params?: PlayCardParams
): string[] {
  const eliminated: string[] = [];
  const currentPlayer = getCurrentPlayer(state);

  let targets: PlayerState[] = [];
  switch (effect.target) {
    case 'self':
      targets = [currentPlayer];
      break;
    case 'opponent':
      if (params?.targetPlayerId) {
        const target = findPlayer(state, params.targetPlayerId);
        if (target) targets = [target];
      } else {
        const opps = getOpponents(state, currentPlayer.id);
        if (opps.length > 0) targets = [opps[0]];
      }
      break;
    case 'all_others':
      targets = getOpponents(state, currentPlayer.id);
      break;
    case 'all':
      targets = getAlivePlayers(state);
      break;
  }

  for (const target of targets) {
    if (target.shield > 0) {
      const blocked = Math.min(target.shield, effect.amount);
      target.shield -= blocked;
      const remaining = effect.amount - blocked;
      addLog(state, target.id,
        `护盾抵挡了${blocked}点熵增${target.shield > 0 ? `，剩余护盾: ${target.shield}` : '，护盾已耗尽'}${remaining > 0 ? `，实际受到${remaining}点熵增` : ''}`);
      if (remaining > 0) {
        target.entropy += remaining;
        if (target.entropy >= target.maxEntropy) eliminated.push(target.id);
      }
      continue;
    }
    target.entropy += effect.amount;
    addLog(state, target.id, `熵值 +${effect.amount}，当前熵值: ${target.entropy}`);
    if (target.entropy >= target.maxEntropy) eliminated.push(target.id);
  }

  return eliminated;
}

/** 获得护盾 */
export function applyGainShield(
  player: PlayerState,
  effect: { amount: number }
): void {
  player.shield += effect.amount;
}

/** 熵值削减 */
export function applyReduceEntropy(
  player: PlayerState,
  effect: { amount: number; oncePerGame?: boolean }
): void {
  player.entropy = Math.max(0, player.entropy - effect.amount);
}

/** 提升熵值上限 */
export function applyIncreaseMaxEntropy(
  player: PlayerState,
  effect: { amount: number }
): void {
  player.maxEntropy += effect.amount;
}

/** 熵值转移（self → opponent，对手获得能量补偿） */
export function applyTransferEntropy(
  state: GameState,
  player: PlayerState,
  opponent: PlayerState,
  effect: { from: string; to: string; amount: number; compensateEnergy: number }
): void {
  if (player.entropy > 0) {
    const transfer = Math.min(player.entropy, effect.amount);
    player.entropy -= transfer;
    opponent.entropy += transfer;
    opponent.energy += effect.compensateEnergy;
    addLog(state, player.id,
      `转移${transfer}点熵值给 ${opponent.name}，对方获得${effect.compensateEnergy}能量补偿`);
  }
}
