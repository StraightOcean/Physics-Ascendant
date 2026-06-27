import React, { useEffect, useState } from 'react';
import type { GameState } from '@engine/state/types';
import { COSMIC_EVENTS } from '@engine/state/types';
import { getAllCosmicEvents } from '@engine/registry/CosmicEventRegistry';

interface Props {
  state: GameState;
  onDone: () => void;
}

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const CosmicDieDisplay = React.memo(function CosmicDieDisplay({ state, onDone }: Props) {
  const [rolling, setRolling] = useState(true);
  const [rollFace, setRollFace] = useState(1);
  const dieResult = state.cosmicDieResult;
  // 合并内置宇宙事件 + MOD 注册的宇宙事件 (Map → Object)
  const modEvents = getAllCosmicEvents();
  const modObj: Record<number, { name: string; description: string }> = {};
  modEvents.forEach((config, id) => { modObj[id] = config; });
  const allEvents = { ...COSMIC_EVENTS, ...modObj };
  const event = dieResult ? allEvents[dieResult] : null;

  useEffect(() => {
    if (!event) { onDone(); return; }
    let count = 0;
    const rollInterval = setInterval(() => {
      setRollFace(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count >= 8) {
        clearInterval(rollInterval);
        setRollFace(dieResult!);
        setRolling(false);
      }
    }, 120);
    const t = setTimeout(() => onDone(), 3200);
    return () => { clearInterval(rollInterval); clearTimeout(t); };
  }, [dieResult, event, onDone]);

  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      animation: 'fadeIn 0.3s',
    }}>
      <div style={{
        textAlign: 'center', color: '#e0e0e0',
        background: 'var(--gradient-bg)',
        padding: 40, borderRadius: 16, border: '2px solid var(--border-accent)',
        minWidth: 380, animation: rolling ? 'none' : 'pulse 0.5s',
      }}>
        {/* 骰子 */}
        <div style={{
          fontSize: 100, marginBottom: 8, transition: 'transform 0.1s',
          transform: rolling ? `rotate(${Math.random() * 20 - 10}deg) scale(1.1)` : 'rotate(0deg) scale(1)',
          filter: rolling ? 'brightness(1.3)' : 'brightness(1)',
        }}>
          {DIE_FACES[rollFace]}
        </div>

        {/* 事件名 */}
        <h2 style={{
          color: 'var(--text-accent)', fontSize: 26, marginBottom: 4,
          opacity: rolling ? 0.5 : 1, transition: 'opacity 0.3s',
        }}>
          {event.name}
        </h2>

        {/* 效果描述 */}
        <p style={{
          color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.5,
          maxWidth: 320, margin: '0 auto',
          opacity: rolling ? 0.5 : 1, transition: 'opacity 0.3s',
        }}>
          {event.description}
        </p>

        {/* 进度条 */}
        <div style={{
          marginTop: 20, height: 3, background: '#303060', borderRadius: 2,
          overflow: 'hidden', width: 200, marginLeft: 'auto', marginRight: 'auto',
        }}>
          <div style={{
            height: '100%', background: 'linear-gradient(90deg, var(--border-accent), var(--text-accent))',
            animation: 'shrink 3s linear forwards',
          }} />
        </div>

        <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11 }}>
          {rolling ? '宇宙骰子投掷中...' : '效果持续本回合'}
        </div>
      </div>
    </div>
  );
});
export default CosmicDieDisplay;
