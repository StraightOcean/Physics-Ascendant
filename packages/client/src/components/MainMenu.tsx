// ============================================================
// MainMenu — 重新设计的主菜单界面
// ============================================================

import React from 'react';
import { AIDifficulty } from '@engine/ai/AIPlayer';
import type { Theme } from '../hooks/useTheme';

interface Props {
  playerName: string;
  aiCount: 1 | 3;
  difficulty: AIDifficulty;
  theme: Theme;
  onNameChange: (n: string) => void;
  onAiCount: (n: 1|3) => void;
  onDifficulty: (d: AIDifficulty) => void;
  onThemeToggle: () => void;
  onStart: () => void;
  onLAN: () => void;
  onMod: () => void;
}

const MainMenu = React.memo(function MainMenu({
  playerName, aiCount, difficulty, theme,
  onNameChange, onAiCount, onDifficulty, onThemeToggle,
  onStart, onLAN, onMod,
}: Props) {
  const C = {
    text: 'var(--text-primary)',
    sub: 'var(--text-sub)',
    accent: 'var(--text-accent)',
    gold: 'var(--text-gold)',
    panel: 'var(--bg-panel)',
    border: 'var(--border-panel)',
    accentBorder: 'var(--border-accent)',
    hl: 'var(--bg-selected)',
    dim: 'var(--text-dim)',
    muted: 'var(--text-muted)',
  };

  return (
    <div className="app menu-screen">
      <div style={{
        display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',minHeight:'100vh',padding:'20px',
        gap:32,
      }}>
        {/* Title */}
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:64,marginBottom:8,lineHeight:1}}>⚛</div>
          <h1 style={{color:C.gold,fontSize:36,margin:0,fontWeight:'bold',letterSpacing:4}}>
            物理法则之下
          </h1>
          <h2 style={{color:C.sub,fontSize:16,margin:'4px 0 0',fontWeight:'normal',letterSpacing:8}}>
            科技死斗
          </h2>
        </div>

        {/* Main Card */}
        <div style={{
          background:C.panel,border:`1px solid ${C.border}`,borderRadius:20,
          padding:'28px 32px',width:400,boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {/* Player Name */}
          <div style={{marginBottom:16}}>
            <label style={{color:C.dim,fontSize:11,display:'block',marginBottom:4}}>玩家昵称</label>
            <input
              value={playerName} onChange={e => onNameChange(e.target.value)}
              maxLength={10} className="menu-input"
              style={{textAlign:'center',fontSize:16,fontWeight:'bold',color:C.gold}}
            />
          </div>

          {/* Opponent Count */}
          <div style={{marginBottom:16}}>
            <label style={{color:C.dim,fontSize:11,display:'block',marginBottom:6}}>AI 对手</label>
            <div style={{display:'flex',gap:6}}>
              {([1, 3] as const).map(n => (
                <button key={n} onClick={() => onAiCount(n)}
                  style={{
                    flex:1,padding:'10px 0',borderRadius:10,cursor:'pointer',
                    fontSize:14,fontWeight:'bold',border:`2px solid ${aiCount===n?C.accentBorder:C.border}`,
                    background:aiCount===n?C.hl:'transparent',
                    color:aiCount===n?C.text:C.sub,
                    transition:'all 0.2s',
                  }}
                >
                  {n === 1 ? '👤 1v1' : '👥 4人'}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div style={{marginBottom:20}}>
            <label style={{color:C.dim,fontSize:11,display:'block',marginBottom:6}}>AI 难度</label>
            <div style={{display:'flex',gap:6}}>
              {(['简单','中等','困难'] as const).map((label, i) => {
                const val = [AIDifficulty.EASY, AIDifficulty.MEDIUM, AIDifficulty.HARD][i];
                return (
                  <button key={val} onClick={() => onDifficulty(val)}
                    style={{
                      flex:1,padding:'8px 0',borderRadius:10,cursor:'pointer',
                      fontSize:13,fontWeight:difficulty===val?'bold':'normal',
                      border:`2px solid ${difficulty===val?C.accentBorder:C.border}`,
                      background:difficulty===val?C.hl:'transparent',
                      color:difficulty===val?C.text:C.sub,
                      transition:'all 0.2s',
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          {/* Start */}
          <button onClick={onStart} style={{
            width:'100%',padding:'14px 0',marginBottom:12,
            background:'linear-gradient(135deg, #6040a0, #8060c0)',
            border:'none',borderRadius:12,color:'#fff',
            fontSize:18,fontWeight:'bold',cursor:'pointer',
            letterSpacing:2,transition:'all 0.2s',
            boxShadow:'0 4px 16px rgba(96,64,160,0.4)',
          }}>
            ⚡ 开始游戏
          </button>

          {/* Secondary actions */}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onLAN} style={{
              flex:1,padding:'10px 0',borderRadius:10,cursor:'pointer',
              fontSize:13,border:`1px solid ${C.accentBorder}`,
              background:'transparent',color:C.accent,
              transition:'all 0.2s',fontWeight:'bold',
            }}>
              🌐 联机
            </button>
            <button onClick={onMod} style={{
              flex:1,padding:'10px 0',borderRadius:10,cursor:'pointer',
              fontSize:13,border:`1px solid ${C.border}`,
              background:'transparent',color:C.sub,
              transition:'all 0.2s',
            }}>
              🧩 MOD
            </button>
          </div>
        </div>

        {/* Footer controls */}
        <div style={{
          display:'flex',gap:16,alignItems:'center',
        }}>
          <button onClick={onThemeToggle} style={{
            padding:'6px 14px',borderRadius:20,cursor:'pointer',fontSize:12,
            background:theme==='dark'?'var(--bg-panel)':'#e8e4d0',
            border:`1px solid ${theme==='dark'?C.accentBorder:'#c0a060'}`,
            color:theme==='dark'?C.sub:'#444',transition:'all 0.2s',
          }}>
            {theme==='dark'?'🌙 深色':'☀️ 浅色'}
          </button>
        </div>

        {/* Version */}
        <div style={{color:C.dim,fontSize:10,opacity:0.5}}>
          Physics Ascendant v0.1.0 · 62 tests
        </div>
      </div>
    </div>
  );
});
export default MainMenu;
