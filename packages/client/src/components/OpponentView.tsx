// ============================================================
// 对手信息卡片
// ============================================================

import React from 'react';
import type { PlayerState } from '@engine/state/types';

interface Props {
  player: PlayerState;
  index: number;
}

const AI_AVATARS = ['🤖', '🧪', '⚗️'];

const OpponentView = React.memo(function OpponentView({ player, index }: Props) {
  const entropyColor = player.entropy >= 7 ? '#e74c3c' : player.entropy >= 4 ? '#f39c12' : '#2ecc71';

  // 小棋盘
  const lab = player.lab;
  const size = player.labSize;

  return (
    <div className={`opponent-card ${!player.alive ? 'dead' : ''}`}>
      <div className="opponent-header">
        <span className="opponent-avatar">{AI_AVATARS[index] || '🤖'}</span>
        <span className="opponent-name">{player.name}</span>
        {!player.alive && <span className="opponent-dead">☠</span>}
      </div>

      {/* 迷你棋盘 */}
      <div className="opponent-mini-board">
        {Array.from({ length: size }).map((_, r) => (
          <div key={r} className="mini-row">
            {Array.from({ length: size }).map((_, c) => {
              const p = lab[r]?.[c];
              return (
                <div key={c} className={`mini-cell ${p ? 'has-particle' : ''}`}>
                  {p || ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 状态条 */}
      <div className="opponent-stats">
        <div className="opp-stat">
          <span>⚡{player.energy}</span>
          <span style={{ color: entropyColor }}>🔥{player.entropy}</span>
          <span>🔬Lv.{player.researchLevel}</span>
        </div>
        <div className="opp-stat">
          <span>🃏{player.hand.length}</span>
          {player.shield > 0 && <span>🛡{player.shield}</span>}
          {player.voidEnergy > 0 && <span style={{ color: '#e74c3c' }}>🌀{player.voidEnergy}</span>}
        </div>
      </div>
    </div>
  );
});
export default OpponentView;
