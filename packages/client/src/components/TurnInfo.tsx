// ============================================================
// 回合信息栏
// ============================================================

import React from 'react';
import type { GameState } from '@engine/state/types';
import { COSMIC_EVENTS } from '@engine/state/types';
import { getCurrentPlayer } from '@engine/state/GameState';

// rule.md v2.0 §五：6 阶段（0-5）
const PHASE_NAMES: Record<number, string> = {
  0: '🎲 宇宙骰子', 1: '🔥 宇宙熵增', 2: '📦 补给抽牌',
  3: '🎯 主要行动', 4: '💥 湮灭清算', 5: '✅ 回合结束',
};

interface Props {
  state: GameState;
}

const TurnInfo = React.memo(function TurnInfo({ state }: Props) {
  const currentPlayer = getCurrentPlayer(state);
  const event = state.cosmicDieResult ? COSMIC_EVENTS[state.cosmicDieResult] : null;

  return (
    <div className="turn-info">
      <div className="turn-number">第 {state.turn} 回合</div>
      <div className="turn-phase">{PHASE_NAMES[state.phase] || state.phase}</div>
      <div className="turn-player">
        当前：<strong>{currentPlayer.name}</strong>
        {currentPlayer.id === 'player_0' ? ' 👤' : ' 🤖'}
      </div>
      {event && (
        <div className="turn-event" title={event.description}>
          🎲 {event.name}
        </div>
      )}
    </div>
  );
});
export default TurnInfo;
