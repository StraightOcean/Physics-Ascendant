// ============================================================
// 弃牌选择弹窗
// ============================================================

import React from 'react';
import type { GameState } from '@engine/state/types';
import { getCardDef } from '@engine/cards/CardRegistry';
import { getHandOverflow } from '@engine/phases/TurnManager';

interface Props {
  state: GameState;
  onDiscard: (cardId: string) => void;
}

const DiscardDialog = React.memo(function DiscardDialog({ state, onDiscard }: Props) {
  const player = state.players[0];
  const overflow = getHandOverflow(state, 'player_0');

  return (
    <div className="discard-overlay">
      <div className="discard-card">
        <h2>⚠️ 手牌超出上限</h2>
        <p>当前手牌：{player.hand.length} / 8</p>
        <p className="discard-hint">请点击要弃置的卡牌（还需弃 {overflow} 张）</p>

        <div className="discard-list">
          {player.hand.map(card => {
            const def = getCardDef(card.defId);
            if (!def) return null;
            return (
              <div
                key={card.id}
                className="discard-item"
                onClick={() => onDiscard(card.id)}
              >
                <div className="discard-item-name">{def.name}</div>
                <div className="discard-item-info">
                  <span>⚡{def.cost}</span>
                  {def.level > 0 && <span>Lv.{def.level}</span>}
                </div>
                <div className="discard-item-desc">{def.description.slice(0, 50)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
export default DiscardDialog;
