// ============================================================
// ActionLog — 行动回放日志组件
// ============================================================

import React from 'react';
import type { GameState } from '@engine/state/types';

interface Props {
  state: GameState;
}

const ActionLog = React.memo(function ActionLog({ state }: Props) {
  return (
    <div style={{
      background: 'var(--bg-panel2)', border: '1px solid var(--border-panel)',
      borderRadius: 8, flex: 1, overflow: 'hidden', display: 'flex',
      flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{
        padding: '6px 10px', background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-panel)',
        fontSize: 12, color: 'var(--text-accent)', fontWeight: 'bold',
      }}>
        📜 行动回放
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 8px',
        fontSize: 10, color: 'var(--text-sub)', lineHeight: 1.6,
      }}>
        {state.log.slice().reverse().map((entry, i) => {
          const pname = entry.playerId === 'system'
            ? '系统'
            : state.players.find(p => p.id === entry.playerId)?.name || entry.playerId;
          return (
            <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #151525' }}>
              <span style={{ color: 'var(--text-dim)' }}>[{entry.turn}]</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>{pname}</span>:{' '}
              {entry.message}
            </div>
          );
        })}
      </div>
    </div>
  );
});
export default ActionLog;
