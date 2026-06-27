import React, { useState, useEffect } from 'react';
import { networkClient } from '../network/NetworkClient';
import type { NetworkMessage } from '@engine/network/NetworkMessages';

// 官方服务器地址（已替换为实际域名）
const OFFICIAL_SERVER = 'physics-relay.xzy7885356.workers.dev';

interface Props {
  onBack: () => void;
  playerName: string;
}

const LANScreen = React.memo(function LANScreen({ onBack, playerName }: Props) {
  const [serverMode, setServerMode] = useState<'official' | 'custom'>('official');
  const [customUrl, setCustomUrl] = useState('localhost:3456');
  const [action, setAction] = useState<'host' | 'join'>('host');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState<{id:string;name:string}[]>([]);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [status, setStatus] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnectedState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hostPort, setHostPort] = useState(3456);

  // 注意：不在此处自动断开连接，由 doDisconnect 或 onBack 显式处理

  // 生成6位房间号
  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function getServerUrl(): string {
    if (serverMode === 'official') return `wss://${OFFICIAL_SERVER}`;
    let addr = customUrl.trim().replace(/^wss?:\/\//, '');
    const isLocal = addr.startsWith('localhost') || addr.startsWith('127.') || addr.startsWith('192.168.');
    return `${isLocal ? 'ws' : 'wss'}://${addr}`;
  }

  function parsePlayers(msg: any): { id: string; name: string }[] {
    if (msg.players) return msg.players;
    if (msg.playerNames) return msg.playerNames.map((n: string, i: number) => ({ id: `player_${i}`, name: n }));
    return [];
  }

  function getWsUrl(code: string, name: string): string {
    const base = getServerUrl();
    if (serverMode === 'official') {
      return `${base}/room/${code}?name=${encodeURIComponent(name)}`;
    }
    // 自建服务器（Node.js）：直连，协议消息在连接后发送
    return base;
  }

  async function doHost() {
    const code = genCode();
    setRoomCode(code);
    setAction('host');
    setConnecting(true);
    setStatus('正在启动局域网服务...');

    // Electron 打包版：通过 IPC 启动内嵌服务器
    let hostPort = 3456;
    const api = (window as any).electronAPI;
    if (api?.startLANSever) {
      const result = await api.startLANSever(hostPort);
      if (!result?.success) {
        setStatus(`❌ 无法启动服务器: ${result?.error}`);
        setConnecting(false);
        return;
      }
      hostPort = result.port;
      setHostPort(hostPort);
      setCustomUrl(`localhost:${hostPort}`);
    }

    setStatus('正在连接...');

    const handleResponse = (msg: NetworkMessage) => {
      console.log('📩 room_created/connected:', msg.type, 'data:', (msg as any).players || (msg as any).playerNames);
      setMyPlayerId(msg.playerId || networkClient.playerId);
      setPlayers(parsePlayers(msg));
      setStatus('✅ 房间已创建');
      setConnecting(false);
      setConnectedState(true);
    };

    // Workers 发 connected，Node.js 服务器发 room_created
    networkClient.on('connected', handleResponse);
    networkClient.on('room_created', handleResponse);
    networkClient.on('player_joined', (msg: NetworkMessage) => {
      console.log('📩 player_joined 收到:', (msg as any).players || (msg as any).playerNames);
      setPlayers(parsePlayers(msg));
      setStatus(`👤 ${msg.playerName} 加入`);
    });
    networkClient.on('player_left', (msg: NetworkMessage) => {
      setPlayers(parsePlayers(msg));
      setStatus(`👋 ${msg.playerName} 离开`);
    });
    networkClient.on('error', (msg: NetworkMessage) => { setStatus(`❌ ${msg.message}`); setConnecting(false); });
    networkClient.on('disconnected', () => { setStatus('❌ 连接断开'); setConnecting(false); setConnectedState(false); });

    try {
      await networkClient.connect(getWsUrl(code, playerName));
      // Node.js 服务器需要发 host_game 消息
      if (serverMode === 'custom') {
        networkClient.send({ type: 'host_game', playerName, playerCount });
      }
    } catch (e: any) {
      const msg = e.message || '连接失败';
      setErrorMsg(msg);
      setStatus(`❌ ${msg}`);
      setConnecting(false);
    }
  }

  async function doJoin() {
    if (!joinCode.trim()) { setStatus('❌ 请输入房间号'); return; }
    const code = joinCode.trim().toUpperCase();
    setAction('join');
    setConnecting(true);
    setStatus('正在加入...');

    const handleResponse = (msg: NetworkMessage) => {
      console.log('📩 joined_room/connected:', msg.type, 'data:', (msg as any).players || (msg as any).playerNames);
      networkClient.playerId = msg.playerId;
      setMyPlayerId(msg.playerId);
      setPlayers(parsePlayers(msg));
      setStatus('✅ 已加入房间');
      setConnecting(false);
      setConnectedState(true);
      setRoomCode(code);
    };

    // Workers 发 connected，Node.js 服务器发 joined_room
    networkClient.on('connected', handleResponse);
    networkClient.on('joined_room', handleResponse);
    networkClient.on('player_joined', (msg: NetworkMessage) => {
      console.log('📩 player_joined 收到:', msg, 'players:', (msg as any).players);
      setPlayers((msg as any).players || []);
      setStatus(`👤 ${msg.playerName} 加入`);
    });
    networkClient.on('player_left', (msg: NetworkMessage) => { setPlayers(msg.players || []); });
    networkClient.on('error', (msg: NetworkMessage) => { setStatus(`❌ ${msg.message}`); setConnecting(false); });
    networkClient.on('disconnected', () => { setStatus('❌ 连接断开'); setConnecting(false); setConnectedState(false); });

    try {
      const url = getWsUrl(code, playerName);
      await networkClient.connect(url);
      // Node.js 服务器需要发 join_game 消息
      if (serverMode === 'custom') {
        networkClient.send({ type: 'join_game', playerName });
      }
    } catch (e: any) {
      const msg = e.message || '连接失败';
      setErrorMsg(msg);
      setStatus(`❌ ${msg}`);
      setConnecting(false);
    }
  }

  function doStart() {
    console.log('🎮 doStart called, connected:', connected, 'players:', players.length, 'playerCount:', playerCount);
    if (!connected) { setStatus('❌ 未连接'); return; }
    if (players.length < playerCount) { setStatus(`❌ 等待 ${playerCount - players.length} 名玩家加入`); return; }
    console.log('📤 发送 start_game:', { playerCount, playerNames: players.map(p => p.name) });
    networkClient.send({ type: 'start_game', playerCount, playerNames: players.map(p => p.name) });
    setStatus('🎮 正在启动游戏...');
  }

  function doDisconnect() {
    networkClient.disconnect();
    // 关闭内嵌服务器
    const api = (window as any).electronAPI;
    if (api?.stopLANSever) api.stopLANSever();
    setConnectedState(false);
    setRoomCode('');
    setPlayers([]);
    setStatus('');
    setConnecting(false);
  }

  // 是否显示等待/连接界面
  const showLobby = connecting || connected;

  return (
    <div className="app menu-screen">
      <div className="menu-container" style={{maxWidth:480}}>
        <h1 className="menu-title">🌐 联机对战</h1>

        {!showLobby && (
          <div className="menu-form" style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* 服务器选择 */}
            <div style={{display:'flex',gap:0,background:'var(--bg-panel3)',borderRadius:8,padding:4}}>
              <button onClick={()=>setServerMode('official')} style={{
                flex:1,padding:'8px 0',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:'bold',
                background:serverMode==='official'?'var(--bg-panel)':'transparent',
                color:serverMode==='official'?'var(--text-accent)':'var(--text-dim)',
              }}>☁️ 官方服务器</button>
              <button onClick={()=>setServerMode('custom')} style={{
                flex:1,padding:'8px 0',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:'bold',
                background:serverMode==='custom'?'var(--bg-panel)':'transparent',
                color:serverMode==='custom'?'var(--text-accent)':'var(--text-dim)',
              }}>🏠 自建服务器</button>
            </div>

            {/* 自建服务器地址 */}
            {serverMode === 'custom' && (
              <div>
                <input className="menu-input" placeholder="localhost:3456 或你的服务器地址"
                  value={customUrl} onChange={e=>setCustomUrl(e.target.value)} style={{width:'100%'}} />
              </div>
            )}

            {/* 创建房间 */}
            <div style={{background:'var(--bg-panel)',padding:12,borderRadius:8,border:'1px solid var(--border-panel)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontWeight:'bold',color:'var(--text-primary)',fontSize:14}}>🏠 创建房间</span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <span style={{color:'var(--text-sub)',fontSize:11}}>人数</span>
                  {[2,4].map(n=>(
                    <button key={n} onClick={()=>setPlayerCount(n)} style={{
                      padding:'2px 10px',borderRadius:3,cursor:'pointer',fontSize:12,
                      background:playerCount===n?'var(--bg-selected)':'var(--bg-button)',
                      border:`1px solid ${playerCount===n?'var(--border-active)':'var(--border-panel)'}`,
                      color:playerCount===n?'var(--text-primary)':'var(--text-sub)',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <button className="menu-start-btn" onClick={doHost} disabled={connecting} style={{width:'100%'}}>
                创建房间
              </button>
            </div>

            {/* 加入房间 */}
            <div style={{background:'var(--bg-panel)',padding:12,borderRadius:8,border:'1px solid var(--border-panel)'}}>
              <div style={{fontWeight:'bold',color:'var(--text-primary)',marginBottom:8,fontSize:14}}>🔗 加入房间</div>
              <input className="menu-input" placeholder="输入6位房间号"
                value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().slice(0,6))}
                maxLength={6} style={{width:'100%',textAlign:'center',fontSize:22,letterSpacing:8,fontWeight:'bold',textTransform:'uppercase'}} />
              <button className="menu-start-btn" onClick={doJoin} disabled={connecting} style={{width:'100%',background:'var(--bg-selected)',borderColor:'#6040c0',marginTop:8}}>
                加入房间
              </button>
            </div>

            <button onClick={onBack} style={{padding:10,background:'transparent',border:'1px solid var(--border-panel)',borderRadius:8,color:'var(--text-sub)',cursor:'pointer'}}>返回</button>
          </div>
        )}

        {/* 房间等待界面 */}
        {showLobby && (
          <div className="menu-form" style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* 房间号大显示 */}
            {roomCode && (
              <div style={{textAlign:'center'}}>
                <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:4}}>房间号</div>
                <div style={{
                  fontSize:36,fontWeight:'bold',letterSpacing:10,color:'var(--text-gold)',
                  background:'var(--bg-panel)',padding:'12px 0',borderRadius:8,
                  border:'2px dashed var(--border-accent)',userSelect:'all'
                }}>{roomCode}</div>
                <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>分享此号码给好友加入</div>
              </div>
            )}

            {/* 状态 */}
            <div style={{color:'var(--text-gold)',fontSize:14,fontWeight:'bold',textAlign:'center'}}>
              {connecting ? '⏳ 连接中...' : connected ? '🟢 已连接' : '🔴 未连接'}
            </div>
            {status && <div style={{color:status.startsWith('❌')?'#e06060':'var(--text-sub)',textAlign:'center',fontSize:13}}>{status}</div>}

            {/* 玩家列表 */}
            {players.length > 0 && (
              <>
                <div style={{color:'var(--text-primary)',textAlign:'center',fontSize:13}}>玩家 ({players.length})：</div>
                {players.map((p,i) => (
                  <div key={p.id} style={{color:'var(--text-primary)',textAlign:'center',padding:6,background:'var(--bg-panel)',borderRadius:6}}>
                    {i === 0 ? '👑 ' : '👤 '}{p.name}{p.id===myPlayerId?' (你)':''}
                  </div>
                ))}
              </>
            )}

            {/* 操作按钮 */}
            {connected && players.length >= 2 && (
              <button onClick={doStart} style={{
                width:'100%',padding:'10px 40px',background:'#40a060',border:'2px solid #40a060',
                borderRadius:8,color:'#fff',fontSize:16,cursor:'pointer',fontWeight:'bold'
              }}>🎮 开始游戏</button>
            )}

            {!connecting && (
              <button onClick={doDisconnect} style={{padding:10,background:'#302020',border:'none',borderRadius:8,color:'#e06060',cursor:'pointer'}}>
                🔌 断开连接
              </button>
            )}
          </div>
        )}
      </div>

      {/* 连接错误弹窗 */}
      {errorMsg && !connecting && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.6)',display:'flex',
          alignItems:'center',justifyContent:'center',zIndex:2000
        }} onClick={()=>setErrorMsg('')}>
          <div style={{
            background:'var(--bg-panel)',border:'1px solid #e06060',borderRadius:12,
            padding:24,maxWidth:360,textAlign:'center'
          }} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:40,marginBottom:8}}>❌</div>
            <div style={{color:'#e06060',fontSize:16,fontWeight:'bold',marginBottom:12}}>连接失败</div>
            <div style={{color:'var(--text-sub)',fontSize:13,lineHeight:1.6,marginBottom:16}}>{errorMsg}</div>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:16}}>
              提示：国内连接 Cloudflare 可能较慢，请耐心等待（最长15秒）<br/>
              或尝试切换到「自建服务器」
            </div>
            <button onClick={()=>setErrorMsg('')} style={{
              padding:'8px 24px',background:'var(--bg-selected)',border:'1px solid var(--border-active)',
              borderRadius:6,color:'var(--text-primary)',cursor:'pointer',fontSize:13
            }}>确定</button>
          </div>
        </div>
      )}
    </div>
  );
});
export default LANScreen;
