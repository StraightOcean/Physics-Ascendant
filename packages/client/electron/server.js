// ============================================================
// 内嵌局域网服务器 — Electron main process 中运行
// ============================================================

const { WebSocketServer } = require('ws');
const engine = require('@physics-ascendant/engine');

const {
  initGame, getCurrentPlayer, getAlivePlayers, addLog,
  getCardDef, checkUpgradeRequirement, checkAndProcessLegacies,
  executeTurnAutoPhases, executeTurnEndPhases,
  executeUpgrade, executePlayCard,
  getHandOverflow, executeDiscardCard,
  AIDifficulty, aiDecideMainAction,
} = engine;

/** @type {import('ws').WebSocketServer|null} */
let wss = null;

const clients = new Map();
const rooms = new Map();

function startLANSever(port) {
  if (wss) { stopLANSever(); }
  wss = new WebSocketServer({ port });

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
      if (client) clients.delete(ws);
    });
  });

  return { port };
}

function stopLANSever() {
  if (wss) {
    clients.clear();
    rooms.clear();
    wss.close();
    wss = null;
  }
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'host_game': handleHostGame(ws, msg); break;
    case 'join_game': handleJoinGame(ws, msg); break;
    case 'start_game': handleStartGame(ws, msg); break;
    case 'play_card': handleClientPlayCard(ws, msg); break;
    case 'do_upgrade': handleClientUpgrade(ws, msg); break;
    case 'end_turn': handleClientEndTurn(ws, msg); break;
    case 'add_ai': handleAddAI(ws, msg); break;
    case 'surrender': handleSurrender(ws, msg); break;
  }
}

function sendState(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.state) return;
  const state = room.state;
  for (const [ws, client] of clients) {
    if (client.roomId === roomId) {
      ws.send(JSON.stringify({
        type: 'game_state',
        state: { ...state, players: state.players.map(p => ({ ...p, hand: p.id === client.playerId ? p.hand : [] })) },
        yourPlayerId: client.playerId,
      }));
    }
  }
}

function broadcastToRoom(roomId, msg) {
  for (const [ws, client] of clients) {
    if (client.roomId === roomId) ws.send(JSON.stringify(msg));
  }
}

function handleHostGame(ws, msg) {
  const roomId = 'room_' + Date.now();
  const playerName = msg.playerName || '主机玩家';
  clients.set(ws, { ws, playerId: 'player_0', playerName, roomId });
  rooms.set(roomId, { state: null, host: ws, playerNames: [playerName], playerCount: msg.playerCount || 2, started: false });
  ws.send(JSON.stringify({ type: 'room_created', roomId, playerId: 'player_0', playerName, playerCount: msg.playerCount || 2, players: [{ id: 'player_0', name: playerName }] }));
}

function handleJoinGame(ws, msg) {
  let roomId = msg.roomId;
  if (!roomId) {
    for (const [id, r] of rooms) {
      if (!r.started && r.playerNames.length < r.playerCount) { roomId = id; break; }
    }
    if (!roomId) { ws.send(JSON.stringify({ type: 'error', message: '没有可用房间' })); return; }
  }
  const room = rooms.get(roomId);
  if (!room) { ws.send(JSON.stringify({ type: 'error', message: '房间不存在' })); return; }
  if (room.started) { ws.send(JSON.stringify({ type: 'error', message: '游戏已开始' })); return; }
  const idx = room.playerNames.length;
  if (idx >= room.playerCount) { ws.send(JSON.stringify({ type: 'error', message: '房间已满' })); return; }
  const playerName = msg.playerName || '加入玩家';
  room.playerNames.push(playerName);
  clients.set(ws, { ws, playerId: 'player_' + idx, playerName, roomId });
  const players = room.playerNames.map((n, i) => ({ id: 'player_' + i, name: n }));
  ws.send(JSON.stringify({ type: 'joined_room', roomId, playerId: 'player_' + idx, playerName, playerCount: room.playerCount, players }));
  broadcastToRoom(roomId, { type: 'player_joined', playerId: 'player_' + idx, playerName, players });
}

function handleStartGame(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || room.host !== ws) return;
  const aiNames = ['爱因斯坦', '薛定谔', '费曼', '玻尔', '海森堡'];
  while (room.playerNames.length < room.playerCount) room.playerNames.push(aiNames[room.playerNames.length % aiNames.length]);
  const state = initGame(room.playerNames, room.playerCount);
  room.state = state; room.started = true;
  sendState(client.roomId);
}

function handleAddAI(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || room.host !== ws || room.started) return;
  if (room.playerNames.length >= room.playerCount) return;
  room.playerNames.push('AI-' + ['爱因斯坦', '薛定谔', '费曼'][room.playerNames.length % 3]);
  broadcastToRoom(client.roomId, { type: 'player_joined', playerId: 'player_' + (room.playerNames.length - 1), playerName: room.playerNames[room.playerNames.length - 1], players: room.playerNames.map((n, i) => ({ id: 'player_' + i, name: n })) });
}

function handleClientPlayCard(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.started) return;
  if (getCurrentPlayer(room.state).id !== client.playerId) return;
  const result = executePlayCard(room.state, client.playerId, msg.cardId, msg.params);
  sendState(client.roomId);
  broadcastToRoom(client.roomId, { type: 'action_result', success: result.success, message: result.success ? client.playerName + ' 打出了手牌' : result.reason });
  if (room.state.gameOver) broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name });
}

function handleClientUpgrade(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.started || getCurrentPlayer(room.state).id !== client.playerId) return;
  const result = executeUpgrade(room.state, client.playerId, msg.targetLevel);
  sendState(client.roomId);
  broadcastToRoom(client.roomId, { type: 'action_result', success: result.success, message: result.success ? client.playerName + ' 升级了研究所' : result.reason });
  if (room.state.gameOver) broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name });
}

function handleClientEndTurn(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room || !room.started || getCurrentPlayer(room.state).id !== client.playerId) return;
  const overflow = getHandOverflow(room.state, client.playerId);
  if (msg.discardCardId && overflow > 0) {
    executeDiscardCard(room.state, client.playerId, msg.discardCardId);
    if (getHandOverflow(room.state, client.playerId) > 0) { sendState(client.roomId); return; }
  } else if (overflow > 0) {
    sendState(client.roomId);
    broadcastToRoom(client.roomId, { type: 'need_discard', count: overflow });
    return;
  }
  executeTurnEndPhases(room.state);
  checkAndProcessLegacies(room.state);
  if (room.state.gameOver) { sendState(client.roomId); broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name }); return; }
  advanceToNext(client.roomId);
}

function advanceToNext(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  executeTurnAutoPhases(room.state);
  const player = getCurrentPlayer(room.state);
  sendState(roomId);
  broadcastToRoom(roomId, { type: 'turn_info', currentPlayerId: player.id, currentPlayerName: player.name, turn: room.state.turn, cosmicDie: room.state.cosmicDieResult || null });
  if (player.alive) {
    const humanPlayers = room.playerNames.map((_, i) => 'player_' + i);
    if (!humanPlayers.includes(player.id)) setTimeout(() => executeAITurn(roomId), 1000);
  } else {
    room.state.turn++; room.state.currentPlayerIndex = (room.state.currentPlayerIndex + 1) % room.state.playerCount;
    advanceToNext(roomId);
  }
}

function executeAITurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = getCurrentPlayer(room.state);
  if (!player.alive) {
    room.state.turn++; room.state.currentPlayerIndex = (room.state.currentPlayerIndex + 1) % room.state.playerCount;
    advanceToNext(roomId);
    return;
  }
  // 先升级
  const firstDecision = aiDecideMainAction(room.state, AIDifficulty.MEDIUM);
  if (firstDecision.action === 'upgrade' && firstDecision.targetLevel) executeUpgrade(room.state, player.id, firstDecision.targetLevel);
  // 循环出牌：直接从手牌中选最优可打出的卡
  let playCount = 0;
  while (playCount < 10 && player.alive && player.energy > 0 && player.hand.length > 0) {
    const playable = player.hand.filter(c => {
      const d = getCardDef(c.defId);
      return d && d.cost <= player.energy;
    });
    if (playable.length === 0) break;
    // 调用 AI 获取决策参数，取第一个可出牌的
    const cd = aiDecideMainAction(room.state, AIDifficulty.MEDIUM);
    if (cd.action === 'upgrade') break; // 升级已在上面处理
    if (cd.action !== 'play_card' || !cd.cardId) break;
    const card = player.hand.find(c => c.id === cd.cardId);
    if (!card) break;
    const def = getCardDef(card.defId);
    if (!def || def.cost > player.energy) break;
    executePlayCard(room.state, player.id, card.id, cd.params);
    playCount++;
  }
  const overflow = getHandOverflow(room.state, player.id);
  for (let i = 0; i < overflow && player.hand.length > 0; i++) executeDiscardCard(room.state, player.id, player.hand[0].id);
  executeTurnEndPhases(room.state);
  checkAndProcessLegacies(room.state);
  if (room.state.gameOver) { sendState(roomId); broadcastToRoom(roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name }); return; }
  advanceToNext(roomId);
}

function handleSurrender(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  const room = rooms.get(client.roomId);
  if (!room) return;
  const p = room.state.players.find(p => p.id === client.playerId);
  if (p) { p.entropy = p.maxEntropy; p.alive = false; }
  checkAndProcessLegacies(room.state);
  sendState(client.roomId);
  if (room.state.gameOver) broadcastToRoom(client.roomId, { type: 'game_over', winner: getAlivePlayers(room.state)[0]?.name });
  else advanceToNext(client.roomId);
}

module.exports = { startLANSever, stopLANSever };
