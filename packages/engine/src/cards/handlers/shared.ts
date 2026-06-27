// ============================================================
// 效果处理器共享辅助函数
// ============================================================

import { GameState, PlayerState } from '../../state/types';
import { getAlivePlayers } from '../../state/GameState';
import { addLog } from '../../state/GameState';

/** 检查并收集本回合因熵值/虚空能出局的玩家 */
export function checkEliminations(state: GameState): string[] {
  const eliminated: string[] = [];
  for (const player of getAlivePlayers(state)) {
    if (player.entropy >= player.maxEntropy || player.voidEnergy > 5) {
      player.alive = false;
      eliminated.push(player.id);
      addLog(state, player.id, `${player.name} 出局！`);
    }
  }
  return eliminated;
}
