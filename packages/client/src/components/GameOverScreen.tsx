// ============================================================
// 游戏结束画面
// ============================================================

import React from 'react';
import type { UIGameState } from '../hooks/useGameState';
import { getAlivePlayers } from '@engine/state/GameState';

interface Props {
  uiState: UIGameState;
  onRestart: () => void;
}

const GameOverScreen = React.memo(function GameOverScreen({ uiState, onRestart }: Props) {
  const state = uiState.gameState;
  const alive = getAlivePlayers(state);
  const winner = alive.length === 1 ? alive[0] : null;
  const humanWon = winner?.id === 'player_0';

  return (
    <div className="app game-screen">
      <div className="gameover-overlay">
        <div className={`gameover-card ${humanWon ? 'win' : 'lose'}`}>
          {winner ? (
            <>
              <div className="gameover-icon">{humanWon ? '🏆' : '💀'}</div>
              <h1 className="gameover-title">
                {humanWon ? '你赢了！' : `${winner.name} 获胜`}
              </h1>
              <p className="gameover-subtitle">
                {humanWon ? '终极造物主' : '下次加油！'}
              </p>
            </>
          ) : (
            <>
              <div className="gameover-icon">🤝</div>
              <h1 className="gameover-title">游戏平局！</h1>
            </>
          )}

          <div className="gameover-stats">
            <p>回合数：{state.turn}</p>
            <p>存活玩家：{alive.length} / {state.playerCount}</p>
          </div>

          <div className="gameover-players">
            {state.players.map(p => {
              const isSurrendered = (p as any).surrendered === true;
              return (
              <div key={p.id} className={`gameover-player ${p.alive ? 'alive' : 'dead'}`}>
                <span>{p.alive ? '✅' : (isSurrendered ? '🏳️' : '☠')}</span>
                <span>{p.name}{isSurrendered ? ' (已投降)' : ''}</span>
                <span>{isSurrendered ? '您已投降' : `熵值: ${p.entropy} / ${p.maxEntropy}`}</span>
                <span>科技: Lv.{p.researchLevel}</span>
              </div>
              );
            })}
          </div>

          <button className="gameover-btn" onClick={onRestart}>
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
});
export default GameOverScreen;
