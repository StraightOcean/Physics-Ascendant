// ============================================================
// 局域网联机服务端
// 运行: npx tsx src/index.ts [--port=3456]
// 默认端口 3456，可通过 --port=N / PA_PORT 环境变量自定义
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import {
  initGame, GameState,
  getCurrentPlayer, getAlivePlayers,
  checkAndProcessLegacies,
  executeTurnAutoPhases, executeTurnEndPhases, executeFullTurn,
  executeUpgrade, executePlayCard,
  getHandOverflow, executeDiscardCard,
  AIDifficulty, aiDecideMainAction,
} from '@physics-ascendant/engine';
import type { NetworkMessage } from '@physics-ascendant/engine';

// 端口优先级：--port=N > PA_PORT 环境变量 > 默认 3456
function resolvePort(): number {
  const argPort = process.argv.find(a => a.startsWith('--port='));
  if (argPort) return parseInt(argPort.split('=')[1], 10);
  if (process.env.PA_PORT) return parseInt(process.env.PA_PORT, 10);
  return 3456;
}

const PORT = resolvePort();

const wss = new WebSocketServer({ port: PORT });

interface Client {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  roomId: string;
}

const clients: Map<WebSocket, Client> = new Map();
const rooms: Map<string, { state: GameState; host: WebSocket; playerNames: string[]; playerCount: number; started: boolean }> = new Map();

console.log(`🔌 局域网联机服务器启动，端口 ${PORT}`);

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(ws, msg);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: '无效消息' }));
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`👋 ${client.playerName} 断开连接`);
      clients.delete(ws);
    }
  });
});

function handleMessage(ws: WebSocket, msg: NetworkMessage) {
  switch (msg.type) {
    case 'host_game':
      handleHostGame(ws, msg);
      break;
    case 'join_game':
      handleJoinGame(ws, msg);
      break;
    case 'start_game':
      handleStartGame(ws, msg);
      break;
    case 'play_card':
      handleClientPlayCard(ws, msg);
      break;
    case 'do_upgrade':
      handleClientUpgrade(ws, msg);
      break;
    case 'end_turn':
      handleClientEndTurn(ws, msg);
      break;
    case 'add_ai':
      handleAddAI(ws, msg);
      break;
    case 'surrender':
      handleSurrender(ws, msg);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: `未知消息: ${msg.type}` }));
  }
}

function sendState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || !room.state) return;
  console.log(`📤 发送 game_state 到房间 ${roomId}, ${clients.size} 个连接`);
  const state = room.state;
  let sent = 0;
  for (const [ws, client] of clients) {
    if (client.roomId === roomId) {
      const playerState = {
        ...state,
        players: state.players.map(p => ({
          ...p,
          hand: p.id === client.playerId ? p.hand : [],
        })),
      };
      ws.send(JSON.stringify({
        type: 'game_state',
        state: playerState,
        yourPlayerId: client.playerId,
      }));
      sent++;
    }
  }
  console.log(`📤 已发送 game_state 给 ${sent} 个客户端`);
}

function broadcastToRoom(roomId: string, msg: NetworkMessage) {
  for (const [ws, client] of clients) {
    if (client.roomId === roomId) {
      ws.send(JSON.stringify(msg));
    }
  }
}

// ---- 房间管理 ----

function handleHostGame(ws: WebSocket, msg: NetworkMessage) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const playerName = String(msg.playerName || '主机玩家').slice(0, 20);
  const rawCount = Number(msg.playerCount) || 2;
  // 输入验证：仅允许 2 或 4
  const playerCount = (rawCount === 4 ? 4 : 2) as 2 | 4;
  const playerId = 'player_0';

  clients.set(ws, { ws, playerId, playerName, roomId });
  rooms.set(roomId, {
    state: null as unknown as GameState,
    host: ws,
    playerNames: [playerName],
    playerCount,
    started: false,
  });

  const players = [{ id: playerId, name: playerName }];

  ws.send(JSON.stringify({
    type: 'room_created',
    roomId,
    playerId,
    playerName,
    playerCount,
    players,
  }));

  console.log(`🏠 ${playerName} 创建房间 ${roomId} (${playerCount}人)`);
}

function handleJoinGame(ws: WebSocket, msg: NetworkMessage) {
  let roomId = msg.roomId;
  const playerName = String(msg.playerName || '加入玩家').slice(0, 20);

  // 未指定房间时，自动加入第一个可用房间
  if (!roomId) {
    for (const [id, r] of rooms) {
      if (!r.started && r.playerNames.length < r.playerCount) {
        roomId = id;
        break;
      }
    }
    if (!roomId) {
      ws.send(JSON.stringify({ type: 'error', message: '没有可用的房间，请先让主机创建房间' }));
      return;
    }
  }

  const room = rooms.get(roomId);

  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
    return;
  }
  if (room.started) {
    ws.send(JSON.stringify({ type: 'error', message: '游戏已开始' }));
    return;
  }

  const playerIndex = room.playerNames.length;
  if (playerIndex >= room.playerCount) {
    ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
    return;
  }

  const playerId = `player_${playerIndex}`;
  room.playerNames.push(playerName);
  clients.set(ws, { ws, playerId, playerName, roomId });

  const players = room.playerNames.map((n, i) => ({ id: `player_${i}`, name: n }));

  ws.send(JSON.stringify({
    type: 'joined_room',
    roomId,
    playerId,
    playerName,
    playerCount: room.playerCount,
    players,
  }));

  // 通知主机有新玩家
  broadcastToRoom(roomId, {
    type: 'player_joined',
    playerId,
    playerName,
    players: room.playerNames.map((n, i) => ({ id: `player_${i}`, name: n })),
  });

  console.log(`👤 ${playerName} 加入房间 ${roomId}`);
}

function handleStartGame(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) { console.log('❌ start_game: 客户端未找到'); return; }
  const room = rooms.get(client.roomId);
  if (!room) { console.log('❌ start_game: 房间未找到'); return; }
  if (room.host !== ws) { console.log('❌ start_game: 非主机无法开始'); return; }
  if (room.started) {
    ws.send(JSON.stringify({ type: 'error', message: '游戏已开始了' }));
    return;
  }
  if (room.playerCount !== 2 && room.playerCount !== 4) {
    ws.send(JSON.stringify({ type: 'error', message: `无效的玩家数量: ${room.playerCount}` }));
    return;
  }

  console.log(`🎮 开始游戏: ${room.playerNames.join(', ')} (${room.playerCount}人)`);

  // 用AI填充未满的席位
  const aiNames = ['爱因斯坦', '薛定谔', '费曼', '玻尔', '海森堡'];
  while (room.playerNames.length < room.playerCount) {
    room.playerNames.push(aiNames[room.playerNames.length % aiNames.length]);
  }

  // 输入清洗：限制玩家名长度
  room.playerNames = room.playerNames.map(n => String(n).slice(0, 20) || '玩家');

  const state = initGame(room.playerNames, room.playerCount as 2|4);
  room.state = state;
  room.started = true;

  // 直接发送每人独立的状态（含手牌隐藏）
  sendState(client.roomId);

  console.log(`🎮 房间 ${client.roomId} 游戏开始`);
}

function handleAddAI(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || room.host !== ws || room.started) return;
  if (room.playerNames.length >= room.playerCount) return;

  // 防止重复添加同名 AI
  const usedNames = new Set(room.playerNames);
  const aiPool = ['爱因斯坦', '薛定谔', '费曼', '玻尔', '海森堡'];
  const aiName = aiPool.find(n => !usedNames.has(n))
    || `AI-${room.playerNames.length}`;

  room.playerNames.push(aiName);

  broadcastToRoom(client.roomId, {
    type: 'player_joined',
    playerId: `player_${room.playerNames.length - 1}`,
    playerName: aiName,
    players: room.playerNames.map((n, i) => ({ id: `player_${i}`, name: n })),
  });
}

// ---- 游戏操作 ----

function handleClientPlayCard(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) { console.log('❌ play_card: 客户端未找到'); return; }
  const room = rooms.get(client.roomId);
  if (!room || !room.started) { console.log('❌ play_card: 房间未开始'); return; }

  const state = room.state;
  const currentPlayer = getCurrentPlayer(state);
  if (currentPlayer.id !== client.playerId) {
    console.log(`❌ play_card: 不是 ${client.playerName}(${client.playerId}) 的回合，当前是 ${currentPlayer.name}(${currentPlayer.id})`);
    return;
  }

  console.log(`🃏 ${client.playerName} 打出 ${msg.cardId}`);
  const result = executePlayCard(state, client.playerId, msg.cardId, msg.params);
  console.log(`🃏 结果: ${result.success ? '成功' : result.reason}`);
  sendState(client.roomId);

  broadcastToRoom(client.roomId, {
    type: 'action_result',
    success: result.success,
    message: result.success ? `${client.playerName} 打出了手牌` : result.reason,
  });

  if (state.gameOver) {
    broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(state)[0]?.name });
    return;
  }
}

function handleClientUpgrade(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.started) return;

  const state = room.state;
  const currentPlayer = getCurrentPlayer(state);
  if (currentPlayer.id !== client.playerId) return;

  const result = executeUpgrade(state, client.playerId, msg.targetLevel);
  sendState(client.roomId);

  broadcastToRoom(client.roomId, {
    type: 'action_result',
    success: result.success,
    message: result.success ? `${client.playerName} 升级了研究所` : result.reason,
  });

  if (state.gameOver) {
    broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(state)[0]?.name });
    return;
  }
}

function handleClientEndTurn(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.started) return;

  const state = room.state;
  const currentPlayer = getCurrentPlayer(state);
  if (currentPlayer.id !== client.playerId) return;

  // 弃牌检查
  const overflow = getHandOverflow(state, client.playerId);
  if (msg.discardCardId && overflow > 0) {
    executeDiscardCard(state, client.playerId, msg.discardCardId);
    const newOverflow = getHandOverflow(state, client.playerId);
    if (newOverflow > 0) {
      sendState(client.roomId);
      return; // 还需要继续弃牌
    }
  } else if (overflow > 0) {
    sendState(client.roomId);
    broadcastToRoom(client.roomId, { type: 'need_discard', count: overflow });
    return;
  }

  executeTurnEndPhases(state);
  checkAndProcessLegacies(state);

  if (state.gameOver) {
    sendState(client.roomId);
    broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(state)[0]?.name });
    return;
  }

  // 下一回合
  advanceToNext(client.roomId);
}

function advanceToNext(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const state = room.state;

  executeTurnAutoPhases(state);

  const player = getCurrentPlayer(state);
  console.log(`🔄 回合推进: 当前玩家 ${player.name}(${player.id}), 第 ${state.turn} 回合`);
  sendState(roomId);

  broadcastToRoom(roomId, {
    type: 'turn_info',
    currentPlayerId: player.id,
    currentPlayerName: player.name,
    turn: state.turn,
    cosmicDie: state.cosmicDieResult || null,
  });

  // 如果是AI，自动执行
  const humanPlayers = room.playerNames.map((_, i) => `player_${i}`);
  if (!humanPlayers.includes(player.id) && player.alive) {
    setTimeout(() => executeAITurn(roomId), 1000);
  }
}

function executeAITurn(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const state = room.state;

  // 使用引擎层 executeFullTurn 封装完整 AI 回合（消除双推进 bug）
  executeFullTurn(state, {
    autoPlay: (s) => aiDecideMainAction(s, AIDifficulty.MEDIUM),
    difficulty: AIDifficulty.MEDIUM,
  });
  checkAndProcessLegacies(state);

  if (state.gameOver) {
    sendState(roomId);
    broadcastToRoom(roomId, { type: 'game_over', winner: getAlivePlayers(state)[0]?.name });
    return;
  }

  advanceToNext(roomId);
}

function handleSurrender(ws: WebSocket, msg: NetworkMessage) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room) return;

  const player = room.state.players.find(p => p.id === client.playerId);
  if (player) {
    player.entropy = player.maxEntropy;
    player.alive = false;
  }
  checkAndProcessLegacies(room.state);
  sendState(client.roomId);

  if (room.state.gameOver) {
    broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name });
  } else {
    advanceToNext(client.roomId);
  }
}

console.log('✅ 服务器就绪，等待连接...');
