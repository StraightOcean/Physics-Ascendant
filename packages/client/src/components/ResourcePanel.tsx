// ============================================================
// 资源面板（能量/熵/虚空能/研究所/护盾）
// ============================================================

import React from 'react';
import type { PlayerState } from '@engine/state/types';

interface Props {
  player: PlayerState;
  isPlayer?: boolean;
}

const ResourcePanel = React.memo(function ResourcePanel({ player, isPlayer }: Props) {
  const energyPct = Math.min(player.energy / player.maxEnergy * 100, 100);
  const entropyPct = Math.min(player.entropy / player.maxEntropy * 100, 100);
  const voidPct = player.voidEnergy / 5 * 100;

  const entropyRatio = player.entropy / player.maxEntropy;
  const entropyClass = entropyRatio >= 0.7 ? 'danger' : entropyRatio >= 0.4 ? 'warning' : 'safe';
  const voidClass = player.voidEnergy >= 4 ? 'danger' : player.voidEnergy >= 2 ? 'warning' : 'safe';

  return (
    <div className={`resource-panel ${isPlayer ? 'player' : 'opponent'}`}>
      {!isPlayer && <div className="resource-name">{player.name}</div>}

      {/* 能量 */}
      <div className="resource-row">
        <span className="resource-label">⚡ 能量</span>
        <div className="resource-bar">
          <div className="resource-bar-fill energy" style={{ width: `${energyPct}%` }} />
        </div>
        <span className="resource-value">{player.energy}/{player.maxEnergy}</span>
      </div>

      {/* 熵值 */}
      <div className="resource-row">
        <span className="resource-label">🔥 熵值</span>
        <div className="resource-bar">
          <div className={`resource-bar-fill entropy ${entropyClass}`} style={{ width: `${entropyPct}%` }} />
        </div>
        <span className={`resource-value ${entropyClass}`}>{player.entropy}/{player.maxEntropy}</span>
      </div>

      {/* 虚空能 */}
      <div className="resource-row">
        <span className="resource-label">🌀 虚空能</span>
        <div className="resource-bar small">
          <div className={`resource-bar-fill void ${voidClass}`} style={{ width: `${voidPct}%` }} />
        </div>
        <span className={`resource-value ${voidClass}`}>{player.voidEnergy}/5</span>
      </div>

      {/* 研究所 */}
      <div className="resource-row">
        <span className="resource-label">🔬 研究所</span>
        <span className="resource-value">Lv.{player.researchLevel}/6</span>
      </div>

      {/* 护盾 */}
      {player.shield > 0 && (
        <div className="resource-row">
          <span className="resource-label">🛡️ 护盾</span>
          <span className="resource-value shield">{player.shield}</span>
        </div>
      )}
    </div>
  );
});
export default ResourcePanel;
