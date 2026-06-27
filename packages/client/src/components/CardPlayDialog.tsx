// ============================================================
// 卡牌参数选择弹窗（v3 - 共享 CardRequirements 配置）
// ============================================================

import React, { useState, useEffect } from 'react';
import type { PlayerState, PlayCardParams, GridPos } from '@engine/state/types';
import { getCardDef } from '@engine/cards/CardRegistry';
import { getEmptyPositions, getOccupiedPositions } from '@engine/state/GameState';
import {
  getCardParamRequirements,
  COMPASS_OPTIONS, DIAGONAL_OPTIONS,
  SPAWN_PARTICLE_OPTIONS, ALL_PARTICLE_OPTIONS,
} from '@engine/state/CardRequirements';

interface Props {
  player: PlayerState;
  opponents: PlayerState[];
  cardId: string;
  cardDefId: string;
  onConfirm: (params: PlayCardParams) => void;
  onCancel: () => void;
  onPreview?: (preview: { playerId: string; pos: GridPos } | null) => void;
  /** 棋盘点击的格子（用于直接在棋盘上选位） */
  boardClickPos?: { playerId: string; row: number; col: number } | null;
}

const posLabel = (p: GridPos) => `(${p.row},${p.col})`;

/** 判断该卡是否需要选对手位置（来自共享配置） */
function needsRequirement(defId: string, key: string): boolean {
  return getCardParamRequirements(defId).includes(key as any);
}

const CardPlayDialog = React.memo(function CardPlayDialog({ player, opponents, cardId, cardDefId, onConfirm, onCancel, onPreview, boardClickPos }: Props) {
  const def = getCardDef(cardDefId);
  const [params, setParams] = useState<PlayCardParams>({});

  if (!def) return null;

  const reqs = getCardParamRequirements(cardDefId);

  // 棋盘点击 → 自动填入位置参数
  useEffect(() => {
    if (!boardClickPos) return;
    const pos: GridPos = { row: boardClickPos.row, col: boardClickPos.col };

    if (needsRequirement(cardDefId, 'own_particle')) {
      setParams(p => ({ ...p, fromPos: pos, targetPos: pos }));
    } else if (needsRequirement(cardDefId, 'own_empty')) {
      setParams(p => ({ ...p, targetPos: pos }));
    } else if (needsRequirement(cardDefId, 'opponent_particle')) {
      setParams(p => ({ ...p, targetPos: pos, targetPlayerId: boardClickPos.playerId }));
    }
  }, [boardClickPos, cardDefId]);

  if (reqs.length === 0) {
    React.useEffect(() => { onConfirm({}); }, []);
    return null;
  }

  const ownOccupied = getOccupiedPositions(player.lab);
  const ownEmpty = getEmptyPositions(player.lab);

  // 对手粒子（用于引力拉扯等）
  const opponentParticles: { pos: GridPos; playerName: string; playerId: string; type: string }[] = [];
  opponents.forEach(o => {
    getOccupiedPositions(o.lab).forEach(pos => {
      const t = o.lab[pos.row][pos.col];
      opponentParticles.push({ pos, playerName: o.name, playerId: o.id, type: t || '?' });
    });
  });

  const handleConfirm = () => onConfirm(params);

  // 检查必填参数是否已选择
  let canConfirm = true;
  let missingParams: string[] = [];
  if (needsRequirement(cardDefId, 'direction') && !params.direction) { canConfirm = false; missingParams.push('方向'); }
  if (needsRequirement(cardDefId, 'own_particle') && !params.fromPos && !params.targetPos) { canConfirm = false; missingParams.push('粒子位置'); }
  if (needsRequirement(cardDefId, 'own_empty') && !params.targetPos) { canConfirm = false; missingParams.push('空格位置'); }
  if (needsRequirement(cardDefId, 'opponent_particle') && !params.targetPos) { canConfirm = false; missingParams.push('对手粒子'); }
  if (needsRequirement(cardDefId, 'particle_type') && !params.particleType) { canConfirm = false; missingParams.push('粒子类型'); }
  if (needsRequirement(cardDefId, 'target_player') && !params.targetPlayerId) { canConfirm = false; missingParams.push('目标对手'); }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-panel)', border: '2px solid #e0c080', borderRadius: 12,
        padding: 24, minWidth: 340, maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', color: '#e0e0e0'
      }}>
        <h3 style={{color:'#e0c080',marginBottom:4}}>🃏 打出：{def.name}</h3>
        <p style={{color:'var(--text-muted)',fontSize:13,marginBottom:16}}>{def.description}</p>

        {/* 目标对手选择 */}
        {needsRequirement(cardDefId, 'target_player') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>选择目标对手：</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {opponents.filter(o=>o.alive).map(o=>(
                <button key={o.id}
                  onClick={()=>setParams(p=>({...p,targetPlayerId:o.id}))}
                  style={{
                    padding:'8px 16px',fontSize:14,
                    background:params.targetPlayerId===o.id?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.targetPlayerId===o.id?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:8,color:'var(--text-primary)',cursor:'pointer'
                  }}>
                  {o.name} (熵:{o.entropy})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 方向选择 */}
        {needsRequirement(cardDefId, 'direction') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>选择方向：</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              {COMPASS_OPTIONS.map(d=>(
                <button key={d.value} onClick={()=>setParams(p=>({...p,direction:d.value}))}
                  style={{
                    padding:8, fontSize:14,
                    background:params.direction===d.value?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.direction===d.value?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:6, color:'var(--text-primary)', cursor:'pointer'
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 对角线方向选择 */}
        {needsRequirement(cardDefId, 'diagonal_direction') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>选择对角方向：</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              {DIAGONAL_OPTIONS.map(d=>(
                <button key={d.value} onClick={()=>setParams(p=>({...p,direction:d.value as any}))}
                  style={{
                    padding:8, fontSize:18,
                    background:params.direction===d.value?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.direction===d.value?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:6, color:'var(--text-primary)', cursor:'pointer'
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 己方粒子选择 */}
        {needsRequirement(cardDefId, 'own_particle') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>
              {cardDefId === 'vacuum_decay' ? '选择要移除的粒子：' : '选择己方粒子：'}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:120,overflowY:'auto'}}>
              {ownOccupied.map(p=>{
                const particle = player.lab[p.row][p.col];
                return (
                  <button key={posLabel(p)} onClick={()=>setParams(pr=>({...pr,fromPos:p,targetPos:p}))}
                    onMouseEnter={()=>onPreview?.({playerId:player.id, pos:p})}
                    onMouseLeave={()=>onPreview?.(null)}
                    style={{
                      padding:'4px 10px',fontSize:12,
                      background:params.fromPos?.row===p.row&&params.fromPos?.col===p.col?'var(--bg-selected)':'var(--bg-button)',
                      border:`1px solid ${params.fromPos?.row===p.row&&params.fromPos?.col===p.col?'var(--border-active)':'var(--border-panel)'}`,
                      borderRadius:6,color:['Q'].includes(particle||'')?'#e74c3c':['E'].includes(particle||'')?'#3498db':['P'].includes(particle||'')?'#2ecc71':'#c0c0ff',cursor:'pointer'
                    }}>
                    {posLabel(p)} [{particle}]
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 己方空格选择 */}
        {needsRequirement(cardDefId, 'own_empty') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>选择空格：</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:120,overflowY:'auto'}}>
              {ownEmpty.map(p=>(
                <button key={posLabel(p)} onClick={()=>setParams(pr=>({...pr,targetPos:p}))}
                  onMouseEnter={()=>onPreview?.({playerId:player.id, pos:p})}
                  onMouseLeave={()=>onPreview?.(null)}
                  style={{
                    padding:'4px 10px',fontSize:12,
                    background:params.targetPos?.row===p.row&&params.targetPos?.col===p.col?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.targetPos?.row===p.row&&params.targetPos?.col===p.col?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:6,color:'var(--text-primary)',cursor:'pointer'
                  }}>
                  {posLabel(p)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 对手粒子选择（引力拉扯、静电吸附等） */}
        {needsRequirement(cardDefId, 'opponent_particle') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>
              {cardDefId==='observation_collapse'?'选择对手粒子并猜测类型：':'选择对手粒子：'}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,maxHeight:150,overflowY:'auto'}}>
              {opponentParticles.map(pp=>(
                <button key={`${pp.playerId}-${posLabel(pp.pos)}`}
                  onMouseEnter={()=>onPreview?.({playerId:pp.playerId, pos:pp.pos})}
                  onMouseLeave={()=>onPreview?.(null)}
                  onClick={()=>setParams(pr=>({...pr, targetPos:pp.pos, targetPlayerId:pp.playerId}))}
                  style={{
                    padding:'4px 8px',fontSize:11,
                    background:params.targetPos?.row===pp.pos.row&&params.targetPos?.col===pp.pos.col?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.targetPos?.row===pp.pos.row&&params.targetPos?.col===pp.pos.col?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:6,color:'var(--text-primary)',cursor:'pointer'
                  }}>
                  [{pp.type}] {pp.playerName} {posLabel(pp.pos)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 粒子类型选择 */}
        {needsRequirement(cardDefId, 'particle_type') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>选择粒子类型：</div>
            <div style={{display:'flex',gap:6}}>
              {SPAWN_PARTICLE_OPTIONS.map(t=>(
                <button key={t} onClick={()=>setParams(p=>({...p,particleType:t}))}
                  style={{
                    padding:'8px 16px',fontSize:16,fontWeight:'bold',
                    background:params.particleType===t?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.particleType===t?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:8,color:t==='Q'?'#e74c3c':t==='E'?'#3498db':'#2ecc71',cursor:'pointer'
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 猜测类型 */}
        {needsRequirement(cardDefId, 'guess') && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:4}}>猜测粒子类型：</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {ALL_PARTICLE_OPTIONS.map(t=>(
                <button key={t} onClick={()=>setParams(p=>({...p,guessType:t}))}
                  style={{
                    padding:'6px 12px',fontSize:13,
                    background:params.guessType===t?'var(--bg-selected)':'var(--bg-button)',
                    border:`1px solid ${params.guessType===t?'var(--border-active)':'var(--border-panel)'}`,
                    borderRadius:6,color:'var(--text-primary)',cursor:'pointer'
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button onClick={onCancel} style={{
            flex:1,padding:10,background:'#302020',color:'#e06060',
            border:'none',borderRadius:8,fontSize:14,cursor:'pointer'
          }}>取消（不消耗能量）</button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            title={canConfirm ? '' : `请先选择：${missingParams.join('、')}`}
            style={{
              flex:1,padding:10,
              background: canConfirm ? 'linear-gradient(135deg,#40a060,#208040)' : '#303030',
              color: canConfirm ? '#fff' : '#606060',
              border:'none',borderRadius:8,fontSize:14,fontWeight:'bold',
              cursor: canConfirm ? 'pointer' : 'not-allowed'
            }}>
            {canConfirm ? `打出 ⚡${def.cost}` : `请选择${missingParams[0]||''}`}
          </button>
        </div>
      </div>
    </div>
  );
});
export default CardPlayDialog;
