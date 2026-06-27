import React, { useState, useRef, useCallback, useEffect } from 'react';
import { initGame } from '@engine/index';
import { GameState, PlayCardParams, Direction, ParticleType } from '@engine/state/types';
import { UPGRADE_REQUIREMENTS } from '@engine/state/types';
import { cardNeedsAnyParam, getCardParamRequirements } from '@engine/state/CardRequirements';
import { AIDifficulty } from '@engine/ai/AIPlayer';
import { getCurrentPlayer, getAlivePlayers } from '@engine/state/GameState';
import { getCardDef } from '@engine/cards/CardRegistry';
import { checkUpgradeRequirement } from '@engine/rules/UpgradeChecker';
import { checkAndProcessLegacies } from '@engine/legacy/LegacyMechanism';
import {
  executeUpgrade, executePlayCard,
  getHandOverflow, executeDiscardCard,
} from '@engine/phases/TurnManager';
import { networkClient } from './network/NetworkClient';
import type { NetworkMessage } from '@engine/network/NetworkMessages';
import UnifiedBoard from './components/UnifiedBoard';
import ResourcePanel from './components/ResourcePanel';
import HandPanel from './components/HandPanel';
import TurnInfo from './components/TurnInfo';
import CosmicDieDisplay from './components/CosmicDieDisplay';
import TechTreePanel from './components/TechTreePanel';
import CardEncyclopedia from './components/CardEncyclopedia';
import CosmicEventsPanel from './components/CosmicEventsPanel';
import LANScreen from './components/LANScreen';
import ActionLog from './components/ActionLog';
import MainMenu from './components/MainMenu';
import ModManager from './components/ModManager';
import { useTheme } from './hooks/useTheme';
import { useGameNetwork } from './hooks/useGameNetwork';
import './styles/index.css';

type AppPhase = 'menu' | 'lan_lobby' | 'die_show' | 'main_action' | 'discard' | 'gameover';

// 升级数据来自引擎（单源真值）
const LEVEL_NAMES: Record<number,string>={};
const LEVEL_COSTS: Record<number,number>={};
const LEVEL_REQS: Record<number,string>={};
for (let i=1;i<=6;i++) {
  const r = UPGRADE_REQUIREMENTS[i];
  if (r) { LEVEL_NAMES[i]=r.name; LEVEL_COSTS[i]=r.energyCost; LEVEL_REQS[i]=r.description; }
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [appPhase, setAppPhase] = useState<AppPhase>('menu');
  const [message, setMessage] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('pa_playerName') || '科学家');
  useEffect(() => { localStorage.setItem('pa_playerName', playerName); }, [playerName]);
  const [aiCount, setAiCount] = useState<1|3>(1);
  const [difficulty, setDifficulty] = useState(AIDifficulty.MEDIUM);
  const aiTimerRef = useRef<number | null>(null);
  const [showTechTree, setShowTechTree] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [showCosmicEvents, setShowCosmicEvents] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showMod, setShowMod] = useState(false);
  const [showDieRef, setShowDieRef] = useState(false);
  // 局域网联机
  const [lanMode, setLanMode] = useState(false);
  const [lanHosting, setLanHosting] = useState(false);
  const [lanJoined, setLanJoined] = useState(false);
  const [lanRoomId, setLanRoomId] = useState('');
  const [lanHostIp, setLanHostIp] = useState('localhost');
  const [lanPort, setLanPort] = useState('3456');
  const [lanPlayers, setLanPlayers] = useState<string[]>([]);
  const [lanStatus, setLanStatus] = useState('');
  const [isHost, setIsHost] = useState(false);
  // 网络模式
  const [networkMode, setNetworkMode] = useState(false);
  const [myNetworkPlayerId, setMyNetworkPlayerId] = useState('');
  // 自定义服务器模式（服务端为游戏权威，非 P2P 中继）
  const serverAuthorityRef = useRef(false);

  // 棋盘直选出牌
  const [activeCard, setActiveCard] = useState<{cardId:string,defId:string} | null>(null);
  const [cardParams, setCardParams] = useState<PlayCardParams>({});
  const [previewPos, setPreviewPos] = useState<{playerId:string,pos:{row:number,col:number}} | null>(null);

  // 回合过渡动画
  const [transitionMsg, setTransitionMsg] = useState<string | null>(null);

  // AI 回放
  const [aiAction, setAiAction] = useState<string | null>(null);

  // 使用 ref 避免 useEffect 因 state 变化反复重注册网络处理器
  const stateRef = useRef<GameState | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); }, []);

  // 联机模式
  // 游戏网络 + 回合 + AI 管理（提取至 useGameNetwork hook）
  const { clamp, beginTurn, endTurn, advanceToNext, doAITurn } = useGameNetwork({
    state, stateRef, isHost, serverAuthorityRef, difficulty, aiTimerRef,
    setState, setAppPhase, setNetworkMode, setIsHost, setMessage, setTransitionMsg, setAiAction,
  });

  // ============ 开始游戏 ============
  const handleStart = useCallback(() => {
    const names = [playerName, '爱因斯坦','薛定谔','费曼','玻尔','海森堡'].slice(0, aiCount+1);
    const s = initGame(names, (aiCount+1) as 2|4);
    setState(s);
    if (getCurrentPlayer(s).id === 'player_0') beginTurn(s);
    else {
      setAppPhase('main_action');
      setMessage(`${getCurrentPlayer(s).name} 思考中...`);
      aiTimerRef.current = window.setTimeout(() => doAITurn(s), 800);
    }
  }, [playerName, aiCount, beginTurn, doAITurn, setState, setAppPhase, setMessage, aiTimerRef]);

  // ============ 玩家操作 ============
  const handleUpgrade = () => {
    if (!state) return;
    if (networkMode) {
      if (serverAuthorityRef.current) {
        // 自定义服务器模式：发送到服务端
        networkClient.send({ type: 'do_upgrade', targetLevel: nextLevel });
      } else if (isHost) {
        // 官方中继模式-主机：本地执行
        executeUpgrade(state, 'player_0', nextLevel);
        clamp(stateRef.current!);
        networkClient.send({ type: 'game_state', state: stateRef.current! });
      } else {
        // 官方中继模式-加入者：发送到主机
        networkClient.send({ type: 'do_upgrade', targetLevel: nextLevel });
      }
      return;
    }
    const lv = state.players[0].researchLevel + 1;
    executeUpgrade(state, 'player_0', lv);
    clamp(state);
    setMessage(`升级成功！Lv.${lv}`);
  };

  // 点击手牌 → 激活直选出牌
  const handleCardClick = (cardId: string, defId: string) => {
    if (!state || !isMyTurn()) return;
    const myPlayer = networkMode ? (state.players.find(p => p.id === networkClient.playerId) || state.players[0]) : state.players[0];
    const def = getCardDef(defId);
    if (!def || def.cost > myPlayer.energy) return;

    if (networkMode) {
      if (cardNeedsAnyParam(defId)) {
        setActiveCard({ cardId, defId });
        setCardParams({});
        setPreviewPos(null);
      } else if (serverAuthorityRef.current) {
        networkClient.send({ type: 'play_card', cardId, params: {} });
      } else if (isHost) {
        executePlayCard(state, myPlayer.id, cardId);
        clamp(stateRef.current!);
        networkClient.send({ type: 'game_state', state: stateRef.current! });
      } else {
        networkClient.send({ type: 'play_card', cardId, params: {} });
      }
      return;
    }

    if (cardNeedsAnyParam(defId)) {
      setActiveCard({ cardId, defId });
      // 需要选对手的卡牌，且只有一个存活对手时自动填入
      const needsTarget = getCardParamRequirements(defId).includes('target_player');
      const aliveOpps = state.players.filter((_,i)=>i>0 && state.players[i].alive);
      if (needsTarget && aliveOpps.length === 1) {
        setCardParams({ targetPlayerId: aliveOpps[0].id });
      } else {
        setCardParams({});
      }
      setPreviewPos(null);
    } else {
      executePlayCard(state, 'player_0', cardId);
      clamp(stateRef.current!);
      setMessage(`打出了 ${def.name}`);
      if (stateRef.current!.gameOver) setAppPhase('gameover');
    }
  };

  // 棋盘点击选格
  const handleBoardClick = (playerId: string, row: number, col: number) => {
    if (!activeCard) return;
    const pos = { row, col };
    setPreviewPos({ playerId, pos });

    const defId = activeCard.defId;
    if (['particle_spawn','quantum_tunneling','free_fall'].includes(defId)) {
      setCardParams(p => ({ ...p, targetPos: pos }));
    } else if (['thrust','gravity_slingshot','coulomb_repulsion','friction_torque','wave_particle_duality'].includes(defId)) {
      setCardParams(p => ({ ...p, fromPos: pos, targetPos: pos }));
    } else if (['vacuum_decay','antimatter_catalysis'].includes(defId)) {
      setCardParams(p => ({ ...p, targetPos: pos }));
    } else if (['gravity_pull','electrostatic_adsorption','maxwell_demon'].includes(defId)) {
      setCardParams(p => ({ ...p, targetPos: pos, targetPlayerId: playerId }));
    } else if (defId === 'observation_collapse') {
      setCardParams(p => ({ ...p, targetPos: pos, targetPlayerId: playerId }));
    }
  };

  // 工具栏选方向
  const handleDirSelect = (dir: Direction) => {
    setCardParams(p => ({ ...p, direction: dir }));
  };

  // 工具栏选粒子类型
  const handleTypeSelect = (type: string) => {
    setCardParams(p => ({ ...p, particleType: type as ParticleType }));
  };

  // 工具栏选对手
  const handleTargetSelect = (pid: string) => {
    setCardParams(p => ({ ...p, targetPlayerId: pid }));
  };

  // 工具栏选猜测
  const handleGuessSelect = (type: string) => {
    setCardParams(p => ({ ...p, guessType: type as ParticleType }));
  };

  // 确认打出（带校验）
  const handleConfirmPlay = () => {
    if (!activeCard || !state) return;
    const defId = activeCard.defId;

    if (networkMode) {
      const myId = networkClient.playerId || 'player_0';
      if (serverAuthorityRef.current) {
        // 自定义服务器模式：发送到服务端
        networkClient.send({ type: 'play_card', cardId: activeCard.cardId, params: cardParams });
        setActiveCard(null); setCardParams({}); setPreviewPos(null);
      } else if (isHost) {
        // 官方中继模式-主机：本地执行
        executePlayCard(state, myId, activeCard.cardId, cardParams);
        setActiveCard(null); setCardParams({}); setPreviewPos(null);
        clamp(stateRef.current!);
        networkClient.send({ type: 'game_state', state: stateRef.current! });
      } else {
        // 官方中继模式-加入者：发送到主机
        networkClient.send({ type: 'play_card', cardId: activeCard.cardId, params: cardParams });
        setActiveCard(null); setCardParams({}); setPreviewPos(null);
      }
      return;
    }

    // 本地模式的校验...
    const human = state.players[0];
    const opponent = state.players[1]; // 第一个对手

    // 校验：粒子生成等需要空格
    if (['particle_spawn','quantum_tunneling'].includes(defId)) {
      const pos = cardParams.targetPos;
      if (!pos || (human.lab[pos.row]?.[pos.col] !== null)) {
        setMessage('目标格已有粒子，请选择空格');
        return;
      }
    }
    // 校验：引力拉扯等需要对手粒子
    if (['gravity_pull','electrostatic_adsorption','coulomb_repulsion','observation_collapse','maxwell_demon'].includes(defId)) {
      const pos = cardParams.targetPos;
      const targetPlayer = cardParams.targetPlayerId ? state.players.find(p=>p.id===cardParams.targetPlayerId) : opponent;
      if (!pos || !targetPlayer || targetPlayer.lab[pos.row]?.[pos.col] === null) {
        setMessage('目标位置无粒子，请选择有粒子的格子');
        return;
      }
    }
    // 校验：推力等需要己方粒子
    if (['thrust','gravity_slingshot','inertia_launch','free_fall','friction_torque'].includes(defId)) {
      const pos = cardParams.fromPos || cardParams.targetPos;
      if (!pos || human.lab[pos.row]?.[pos.col] === null) {
        setMessage('起始位置无粒子，请选择有粒子的格子');
        return;
      }
    }

    executePlayCard(state, 'player_0', activeCard.cardId, cardParams);
    setActiveCard(null); setCardParams({}); setPreviewPos(null);
    clamp(state);
    const def = getCardDef(defId);
    setMessage(`打出了 ${def?.name}`);
    if (state.gameOver) setAppPhase('gameover');
  };

  const handleEndTurn = () => {
    if (!state) return;
    if (networkMode) {
      if (serverAuthorityRef.current) {
        // 自定义服务器模式：发送到服务端
        networkClient.send({ type: 'end_turn' });
      } else if (isHost) {
        const over = getHandOverflow(state, 'player_0');
        if (over > 0) { clamp(state); setAppPhase('discard'); return; }
        networkEndTurn(state);
      } else {
        const myId = networkClient.playerId;
        const myPlayer = state.players.find(p => p.id === myId);
        if (!myPlayer) return;
        const over = getHandOverflow(state, myId);
        if (over > 0) { clamp(state); setAppPhase('discard'); return; }
        networkClient.send({ type: 'end_turn' });
      }
      return;
    }
    const over = getHandOverflow(state, 'player_0');
    if (over > 0) { clamp(state); setAppPhase('discard'); }
    else endTurn(state);
  };

  const handleDiscard = (cardId: string) => {
    if (!state) return;
    if (networkMode) {
      if (serverAuthorityRef.current) {
        // 自定义服务器模式：发送弃牌到服务端
        networkClient.send({ type: 'end_turn', discardCardId: cardId });
      } else {
        const myId = networkClient.playerId || 'player_0';
        if (isHost) {
          executeDiscardCard(state, myId, cardId);
          clamp(stateRef.current!);
          if (getHandOverflow(state, myId) > 0) { return; }
          networkEndTurn(state);
        } else {
          networkClient.send({ type: 'end_turn', discardCardId: cardId });
        }
      }
      return;
    }
    executeDiscardCard(state, 'player_0', cardId);
    if (getHandOverflow(state, 'player_0') > 0) clamp(state);
    else endTurn(state);
  };

  const handleSurrender = () => {
    if (!state) return;
    if (networkMode) {
      const myId = networkClient.playerId || 'player_0';
      networkClient.send({ type: 'surrender' });
      if (serverAuthorityRef.current) {
        // 自定义服务器模式：服务端会处理并发送 game_state
        return;
      }
      if (isHost) {
        const p = state.players.find(pl => pl.id === myId);
        if (p) { p.entropy = p.maxEntropy; p.alive = false; }
        checkAndProcessLegacies(stateRef.current!);
        clamp(stateRef.current!);
        networkClient.send({ type: 'game_state', state: stateRef.current! });
        setAppPhase('gameover');
      }
      return;
    }
    state.players[0].entropy = state.players[0].maxEntropy; state.players[0].alive = false;
    // 投降使用独立标记，避免混淆正常阵亡
    (state.players[0] as any).surrendered = true;
    checkAndProcessLegacies(state); clamp(state); setAppPhase('gameover');
  };

  const isMyTurn = () => {
    if (!state) return false;
    if (networkMode) {
      const cp = state.players[state.currentPlayerIndex];
      return cp?.id === (myNetworkPlayerId || networkClient.playerId) && cp.alive;
    }
    const cp = getCurrentPlayer(state);
    return cp.id === 'player_0' && state.players[0].alive;
  };

  // 检查是否需要某类参数
  const activeDef = activeCard ? getCardDef(activeCard.defId) : null;
  const activeReqs = activeCard ? getCardParamRequirements(activeCard.defId) : [];
  const needsDir = activeReqs.includes('direction');
  const isDiagonal = activeReqs.includes('diagonal_direction');
  const needsType = activeReqs.includes('particle_type');
  const needsGuess = activeReqs.includes('guess');
  const needsTarget = activeReqs.includes('target_player');

  const canConfirm = activeCard && (
    (!needsDir || cardParams.direction) &&
    (!needsType || cardParams.particleType) &&
    (!needsGuess || cardParams.guessType) &&
    (!needsTarget || cardParams.targetPlayerId)
  );

  // ============ 渲染 ============

  if (appPhase === 'lan_lobby') {
    return <LANScreen
      playerName={playerName}
      onBack={() => {
        networkClient.disconnect();
        setAppPhase('menu');
      }}
    />;
  }

  if (appPhase === 'menu') {
    return <>
      <MainMenu
        playerName={playerName} aiCount={aiCount} difficulty={difficulty} theme={theme}
        onNameChange={setPlayerName} onAiCount={setAiCount} onDifficulty={setDifficulty}
        onThemeToggle={() => setTheme(theme==='dark'?'light':'dark')}
        onStart={handleStart} onLAN={() => setAppPhase('lan_lobby')}
        onMod={() => setShowMod(true)}
      />
      {showMod && <ModManager onClose={() => setShowMod(false)} />}
    </>;
  }

  if (appPhase === 'die_show' && state) {
    return (
      <div className="app game-screen">
        <TurnInfo state={state} />
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <UnifiedBoard players={state.players} currentPlayerIndex={state.currentPlayerIndex} theme={theme} viewerId={networkMode ? networkClient.playerId : undefined} />
        </div>
        <CosmicDieDisplay state={state} onDone={() => { setTransitionMsg(`第 ${state.turn} 回合`); setTimeout(() => { setTransitionMsg(null); setAppPhase('main_action'); setMessage('选择行动'); }, 800); }} />
      </div>
    );
  }

  if (appPhase === 'gameover' && state) {
    const alive = getAlivePlayers(state);
    const winner = alive.length===1 ? alive[0] : null;
    const hw = winner?.id === 'player_0';
    return (
      <div className="app game-screen">
        <div className="gameover-overlay">
          <div className={`gameover-card ${hw?'win':'lose'}`}>
            <div className="gameover-icon">{winner ? (hw?'🏆':'💀') : '🤝'}</div>
            <h1 className="gameover-title">{winner ? (hw?'你赢了！':`${winner.name} 获胜`) : '平局！'}</h1>
            <p style={{color:'var(--text-sub)',marginBottom:16}}>回合数：{state.turn}</p>
            {state.players.map(p=>(
              <div key={p.id} className={`gameover-player ${p.alive?'alive':'dead'}`}>
                <span>{p.alive?'✅':'☠'} {p.name}</span>
                <span>熵:{p.entropy} 科技:Lv.{p.researchLevel}</span>
              </div>
            ))}
            <button className="gameover-btn" onClick={()=>window.location.reload()}>再来一局</button>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'discard' && state) {
    return (
      <div className="app game-screen">
        <div className="discard-overlay">
          <div className="discard-card">
            <h2>⚠️ 手牌超出上限</h2>
            <p>当前：{state.players[0].hand.length} / 8</p>
            <p className="discard-hint">点击要弃置的卡牌</p>
            <div className="discard-list">
              {state.players[0].hand.map(c=>{
                const def=getCardDef(c.defId);
                if(!def) return null;
                return (
                  <div key={c.id} className="discard-item" onClick={()=>handleDiscard(c.id)}>
                    <div className="discard-item-name">{def.name}</div>
                    <div className="discard-item-info"><span>⚡{def.cost}</span> {def.level>0&&<span>Lv.{def.level}</span>}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ 游戏主界面 ============
  if (!state) return null;
  const human = networkMode ? (state.players.find(p => p.id === (myNetworkPlayerId || networkClient.playerId)) || state.players[0]) : state.players[0];
  const currentPlayer = state.players[state.currentPlayerIndex] || state.players[0];
  const myTurn = isMyTurn();
  const opponents = state.players.filter((_,i)=>i>0);
  const nextLevel = human.researchLevel + 1;
  let canUpgrade = nextLevel <= 6 && human.energy >= LEVEL_COSTS[nextLevel] && checkUpgradeRequirement(human.lab, nextLevel).satisfied;

  return (
    <div className="app game-screen">
      {/* 回合过渡动画 */}
      {transitionMsg && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,animation:'fadeIn 0.3s'}}>
          <div style={{textAlign:'center',color:'#e0c080',fontSize:32,fontWeight:'bold',textShadow:'0 0 20px rgba(224,192,128,0.5)'}}>
            {transitionMsg}
          </div>
        </div>
      )}

      {/* AI 行动提示 */}
      {aiAction && (
        <div style={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:1000,
          padding:'8px 20px',background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:8,
          color:'var(--text-accent)',fontSize:14,fontWeight:'bold',boxShadow:'0 4px 16px rgba(96,64,160,0.3)'}}>
          🤖 {aiAction}
        </div>
      )}

      {/* 直选出牌工具栏 */}
      {activeCard && (
        <div style={{position:'fixed',bottom:160,left:'50%',transform:'translateX(-50%)',zIndex:1000,
          padding:'10px 16px',background:'var(--bg-panel)',border:'2px solid #e0c080',borderRadius:10,
          display:'flex',gap:10,alignItems:'center',color:'#e0e0e0',fontSize:13}}>
          <span style={{color:'#e0c080',fontWeight:'bold',marginRight:4}}>🃏 {activeDef?.name}</span>

          {needsDir && (
            <div style={{display:'flex',gap:4}}>
              {(isDiagonal
                ? ['up-left','up-right','down-left','down-right'] as string[]
                : ['up','down','left','right'] as Direction[]
              ).map(d=>(
                <button key={d} onClick={()=>handleDirSelect(d as Direction)} style={{
                  padding:'4px 10px',fontSize:13,fontWeight:'bold',
                  background:cardParams.direction===d?'var(--bg-selected)':'var(--bg-button)',
                  border:`1px solid ${cardParams.direction===d?'var(--border-active)':'var(--border-panel)'}`,
                  borderRadius:4,color:'var(--text-primary)',cursor:'pointer'
                }}>{d==='up-left'?'↖':d==='up-right'?'↗':d==='down-left'?'↙':d==='down-right'?'↘':d==='up'?'↑':d==='down'?'↓':d==='left'?'←':'→'}</button>
              ))}
            </div>
          )}

          {needsType && (
            <div style={{display:'flex',gap:4}}>
              {(['Q','E'] as const).map(t=>(
                <button key={t} onClick={()=>handleTypeSelect(t)} style={{
                  padding:'4px 10px',fontSize:13,fontWeight:'bold',
                  background:cardParams.particleType===t?'var(--bg-selected)':'var(--bg-button)',
                  border:`1px solid ${cardParams.particleType===t?'var(--border-active)':'var(--border-panel)'}`,
                  borderRadius:4,color:t==='Q'?'#e74c3c':'#3498db',cursor:'pointer'
                }}>{t}</button>
              ))}
            </div>
          )}

          {needsGuess && (
            <div style={{display:'flex',gap:3}}>
              {(['Q','E','P','Ā','Ē','P̄'] as const).map(t=>(
                <button key={t} onClick={()=>handleGuessSelect(t)} style={{
                  padding:'3px 8px',fontSize:12,
                  background:cardParams.guessType===t?'var(--bg-selected)':'var(--bg-button)',
                  border:`1px solid ${cardParams.guessType===t?'var(--border-active)':'var(--border-panel)'}`,
                  borderRadius:4,color:'var(--text-primary)',cursor:'pointer'
                }}>{t}</button>
              ))}
            </div>
          )}

          {needsTarget && opponents.filter(o=>o.alive).length > 0 && (
            <div style={{display:'flex',gap:4}}>
              {opponents.filter(o=>o.alive).map(o=>(
                <button key={o.id} onClick={()=>handleTargetSelect(o.id)} style={{
                  padding:'4px 10px',fontSize:12,
                  background:cardParams.targetPlayerId===o.id?'var(--bg-selected)':'var(--bg-button)',
                  border:`1px solid ${cardParams.targetPlayerId===o.id?'var(--border-active)':'var(--border-panel)'}`,
                  borderRadius:4,color:'var(--text-primary)',cursor:'pointer'
                }}>{o.name}</button>
              ))}
            </div>
          )}

          <span style={{color:'var(--text-muted)',fontSize:11,marginLeft:4}}>
            {!needsDir && !needsType && !needsGuess && !needsTarget ? '点击棋盘选格' : needsTarget ? '选择目标对手' : needsDir ? '选择方向+点击棋盘' : ''}
          </span>

          <button onClick={handleConfirmPlay} disabled={!canConfirm}
            style={{padding:'6px 16px',fontSize:13,fontWeight:'bold',
              background:canConfirm?'linear-gradient(135deg,#40a060,#208040)':'#303030',
              color:canConfirm?'#fff':'#606060',border:'none',borderRadius:6,
              cursor:canConfirm?'pointer':'not-allowed',marginLeft:8}}>
            打出 ⚡{activeDef?.cost||0}
          </button>

          <button onClick={()=>{setActiveCard(null);setCardParams({});setPreviewPos(null);}}
            style={{padding:'6px 12px',fontSize:12,background:'#302020',color:'#e06060',border:'none',borderRadius:6,cursor:'pointer'}}>
            ✕
          </button>
        </div>
      )}

      <TurnInfo state={state} />

      <div style={{flex:1,display:'flex',padding:'6px 10px',gap:10,minHeight:0}}>
        {/* 左侧对手面板 */}
        <div style={{width:190,display:'flex',flexDirection:'column',gap:8,overflowY:'auto'}}>
          {opponents.map(p=>(
            <div key={p.id} style={{padding:10,background:p.alive?'var(--bg-panel)':'#2a1010',borderRadius:8,border:`1px solid ${p.alive?'var(--border-panel)':'#402020'}`,fontSize:12,color:'var(--text-primary)'}}>
              <div style={{fontWeight:'bold',fontSize:13,marginBottom:6,color:p.alive?'var(--text-primary)':'#804040'}}>{p.alive?'🤖':'☠'} {p.name}</div>
              <div>⚡{p.energy} 🔥<span style={{color:p.entropy>=7?'#e74c3c':p.entropy>=4?'#f39c12':'#2ecc71'}}>{p.entropy}</span>/{p.maxEntropy}</div>
              {p.voidEnergy>0 && <div>🌀{p.voidEnergy}</div>}
              <div>🔬Lv.{p.researchLevel} 🃏{p.hand.length}</div>
              {p.shield>0 && <div>🛡{p.shield}</div>}
            </div>
          ))}
          <button onClick={()=>setShowTechTree(true)} style={{padding:8,background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:6,color:'var(--text-accent)',fontSize:12,cursor:'pointer'}}>🌳 科技树</button>
          <button onClick={()=>setShowEncyclopedia(true)} style={{padding:8,background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:6,color:'var(--text-accent)',fontSize:12,cursor:'pointer'}}>📚 卡牌百科</button>
          <button onClick={()=>setShowCosmicEvents(true)} style={{padding:8,background:'var(--bg-panel)',border:'1px solid var(--border-accent)',borderRadius:6,color:'var(--text-accent)',fontSize:12,cursor:'pointer'}}>🎲 宇宙骰子</button>
          {showDieRef && (
            <div style={{background:'var(--bg-panel2)',border:'1px solid var(--border-panel)',borderRadius:6,padding:8,fontSize:10,color:'var(--text-sub)',maxHeight:200,overflowY:'auto'}}>
              <div style={{color:'var(--text-accent)',fontWeight:'bold',marginBottom:4}}>宇宙骰子事件表</div>
              {[1,2,3,4,5,6].map(n=>{
                const evt = COSMIC_EVENTS[n];
                const active = state.cosmicDieResult === n;
                return (
                  <div key={n} style={{padding:'3px 4px',margin:'2px 0',background:active?'var(--bg-hover)':'transparent',borderRadius:3,borderLeft:active?'3px solid var(--text-accent)':'3px solid transparent'}}>
                    <span style={{color:active?'var(--text-gold)':'var(--text-primary)',fontWeight:'bold'}}>{['','⚀','⚁','⚂','⚃','⚄','⚅'][n]} {evt.name}</span>
                    <div>{evt.description}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 中央棋盘 */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',overflow:'auto'}}>
          <UnifiedBoard players={state.players} currentPlayerIndex={state.currentPlayerIndex}
            theme={theme}
            viewerId={networkMode ? networkClient.playerId : undefined}
            preview={previewPos}
            onCellClick={handleBoardClick} />
        </div>

        {/* 右侧操作 */}
        <div style={{width:200,display:'flex',flexDirection:'column',gap:8}}>
          <div style={{background:'var(--bg-panel)',padding:10,borderRadius:10,border:'1px solid var(--border-panel)'}}>
            <div style={{fontWeight:'bold',color:'#e0c080',fontSize:13,marginBottom:4}}>
              {myTurn ? '🎯 行动' : currentPlayer.alive ? currentPlayer.name : ''}
            </div>
            <div style={{fontSize:11,color:'var(--text-sub)',marginBottom:6}}>{message}</div>
            {myTurn && (
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {nextLevel <= 6 && (
                  <div style={{padding:6,background:canUpgrade?'var(--bg-hover)':'var(--bg-panel3)',borderRadius:6,border:`1px solid ${canUpgrade?'var(--border-accent)':'var(--border-panel)'}`}}>
                    <div style={{fontSize:11,color:'var(--text-accent)',fontWeight:'bold'}}>🔬 Lv.{nextLevel} {LEVEL_NAMES[nextLevel]}</div>
                    <div style={{fontSize:9,color:'var(--text-sub)',margin:'2px 0'}}>{LEVEL_REQS[nextLevel]} ⚡{LEVEL_COSTS[nextLevel]}</div>
                    <button className="action-btn upgrade" disabled={!canUpgrade} onClick={handleUpgrade}
                      style={{opacity:canUpgrade?1:0.4,width:'100%',fontSize:12,padding:6}}>
                      {canUpgrade ? '升级' : '条件未满足'}
                    </button>
                  </div>
                )}
                <button className="action-btn end-turn" onClick={handleEndTurn} style={{fontSize:13}}>✅ 结束回合</button>
              </div>
            )}
            {!myTurn && <div style={{color:'var(--text-muted)',fontSize:11,textAlign:'center',padding:10}}>AI 思考中...</div>}
            <button className="action-btn surrender" onClick={handleSurrender} style={{fontSize:12,marginTop:4}}>🏳️ 投降</button>
            <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{
              width:'100%',padding:5,background:'transparent',border:'1px solid var(--border-panel)',
              borderRadius:4,color:'var(--text-sub)',fontSize:10,cursor:'pointer',marginTop:4
            }}>{theme==='dark'?'🌙':'☀️'}</button>
          </div>

          <ActionLog state={state} />
        </div>
      </div>

      {/* 底部：属性+手牌 */}
      <div style={{display:'flex',alignItems:'stretch',borderTop:'1px solid var(--border-panel)'}}>
        <div style={{flexShrink:0,padding:'6px 10px',borderRight:'1px solid var(--border-panel)'}}>
          <ResourcePanel player={human} isPlayer />
        </div>
        <div style={{flex:1}}>
          <HandPanel player={human} selectedCard={activeCard?.cardId||null}
            onSelectCard={(cid) => {
              const card = human.hand.find(c=>c.id===cid);
              if (card && myTurn) handleCardClick(cid, card.defId);
            }}
            disabled={!myTurn} />
        </div>
      </div>

      {showTechTree && <TechTreePanel playerLevel={human.researchLevel} onClose={() => setShowTechTree(false)} />}
      {showEncyclopedia && <CardEncyclopedia onClose={() => setShowEncyclopedia(false)} playerLevel={human.researchLevel} />}
      {showCosmicEvents && <CosmicEventsPanel onClose={() => setShowCosmicEvents(false)} />}
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
