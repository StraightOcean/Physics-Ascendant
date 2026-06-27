// ============================================================
// 游戏状态管理
// ============================================================

import {
  GameState,
  PlayerState,
  GamePhase,
  CardInstance,
  GameLogEntry,
  TemporaryEffect,
  ParticleType,
} from './types';

// ---- 工厂函数 ----

/** 创建初始玩家状态 */
export function createPlayerState(id: string, name: string, playerCount: 2 | 4): PlayerState {
  // 根据人数设置初始能量和手牌
  const config = PLAYER_INIT_CONFIG[playerCount];
  const lab: (ParticleType | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  // 中心格放置夸克
  lab[1][1] = 'Q';

  return {
    id,
    name,
    lab,
    labSize: 3,
    energy: config.initialEnergy,
    entropy: 0,
    voidEnergy: 0,
    researchLevel: 0,
    hand: [],
    shield: 0,
    alive: true,
    skipNextTurn: false,
    lockedCells: [],
    extraTurn: false,
    maxEntropy: 10,
    maxEnergy: 10,
  };
}

/** 不同人数下的初始配置 */
const PLAYER_INIT_CONFIG: Record<number, { initialEnergy: number; initialHandSize: number }> = {
  2: { initialEnergy: 5, initialHandSize: 5 },
  4: { initialEnergy: 3, initialHandSize: 5 },
};

/** 创建初始游戏状态 */
export function createGameState(
  playerNames: string[],
  playerCount: 2 | 4
): GameState {
  const players = playerNames.map((name, i) =>
    createPlayerState(`player_${i}`, name, playerCount)
  );

  return {
    players,
    turn: 1,
    currentPlayerIndex: 0,
    phase: GamePhase.COSMIC_DIE,
    cosmicDieResult: null,
    playerCount,
    mainDecks: {},
    discardPiles: {},
    techDecks: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    gameOver: false,
    winner: null,
    log: [],
    temporaryEffects: [],
  };
}

// ---- 状态查询 ----

/** 获取当前回合玩家 */
export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

/** 获取存活玩家列表 */
export function getAlivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.alive);
}

/** 获取对手列表 */
export function getOpponents(state: GameState, playerId: string): PlayerState[] {
  return state.players.filter((p) => p.id !== playerId && p.alive);
}

/** 查找指定ID的玩家 */
export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}

/** 查找玩家索引 */
export function findPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

/** 获取逆时针下一个存活玩家索引 */
export function getNextAlivePlayerIndex(state: GameState, fromIndex: number): number {
  // 防御性：使用实际玩家数而非 playerCount（防止初始化未完成）
  const count = Math.min(state.players.length, state.playerCount || state.players.length);
  if (count === 0) return fromIndex;
  for (let i = 1; i <= count; i++) {
    const idx = (fromIndex + i) % count;
    if (state.players[idx] && state.players[idx].alive) return idx;
  }
  return fromIndex; // 不应到达（除非所有玩家都已死）
}

/** 按逆时针顺序获取玩家（从指定索引开始） */
export function getPlayersCounterClockwise(state: GameState, fromIndex: number): PlayerState[] {
  const result: PlayerState[] = [];
  const count = state.playerCount;
  for (let i = 0; i < count; i++) {
    const idx = (fromIndex + i) % count;
    if (state.players[idx].alive) result.push(state.players[idx]);
  }
  return result;
}

/** 找到熵值最低的存活玩家 */
export function getLowestEntropyPlayer(state: GameState, excludeId?: string): PlayerState | null {
  const alive = getAlivePlayers(state).filter((p) => p.id !== excludeId);
  if (alive.length === 0) return null;
  return alive.reduce((best, p) => (p.entropy < best.entropy ? p : best));
}

/** 找到逆时针最近者 */
export function getNearestCounterClockwise(
  state: GameState,
  fromIndex: number,
  candidates: PlayerState[]
): PlayerState | null {
  const count = state.playerCount;
  for (let i = 1; i <= count; i++) {
    const idx = (fromIndex + i) % count;
    const candidate = candidates.find((p) => p.id === state.players[idx].id);
    if (candidate) return candidate;
  }
  return null;
}

// ---- 状态修改 ----

/** 添加日志 */
export function addLog(state: GameState, playerId: string, message: string): void {
  state.log.push({
    turn: state.turn,
    phase: state.phase,
    playerId,
    message,
  });
}

/** 克隆游戏状态（深拷贝，用于 AI 模拟） */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

/** 序列化游戏状态 */
export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** 反序列化游戏状态 */
export function deserializeState(json: string): GameState {
  return JSON.parse(json);
}

// ---- 网格工具函数 ----

/** 检查坐标是否在实验场范围内 */
export function isInBounds(pos: { row: number; col: number }, size: number): boolean {
  return pos.row >= 0 && pos.row < size && pos.col >= 0 && pos.col < size;
}

/** 判断两个坐标是否相邻（四正交） */
export function isAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

/** 判断两个坐标是否在对角线相邻 */
export function isDiagonalAdjacent(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return Math.abs(a.row - b.row) === 1 && Math.abs(a.col - b.col) === 1;
}

/** 获取指定位置的粒子 */
export function getParticleAt(
  lab: (ParticleType | null)[][],
  pos: { row: number; col: number }
): ParticleType | null {
  if (!isInBounds(pos, lab.length)) return null;
  return lab[pos.row][pos.col];
}

/** 设置指定位置的粒子 */
export function setParticleAt(
  lab: (ParticleType | null)[][],
  pos: { row: number; col: number },
  particle: ParticleType | null
): void {
  if (isInBounds(pos, lab.length)) {
    lab[pos.row][pos.col] = particle;
  }
}

/** 检查格子上是否有粒子 */
export function hasParticle(lab: (ParticleType | null)[][], pos: { row: number; col: number }): boolean {
  return getParticleAt(lab, pos) !== null;
}

/** 网格扫描结果（单次遍历返回所有信息） */
export interface LabScanResult {
  occupied: { row: number; col: number }[];
  empty: { row: number; col: number }[];
  byType: Map<ParticleType, { row: number; col: number }[]>;
  totalCount: number;
}

/** 单次遍历扫描整个实验场（避免重复 O(n²) 扫描） */
export function scanLab(lab: (ParticleType | null)[][]): LabScanResult {
  const occupied: { row: number; col: number }[] = [];
  const empty: { row: number; col: number }[] = [];
  const byType = new Map<ParticleType, { row: number; col: number }[]>();
  const size = lab.length;
  for (let r = 0; r < size; r++) {
    const row = lab[r];
    for (let c = 0; c < size; c++) {
      const cell = row[c];
      if (cell !== null) {
        occupied.push({ row: r, col: c });
        let list = byType.get(cell);
        if (!list) {
          list = [];
          byType.set(cell, list);
        }
        list.push({ row: r, col: c });
      } else {
        empty.push({ row: r, col: c });
      }
    }
  }
  return { occupied, empty, byType, totalCount: occupied.length };
}

/** 获取所有有粒子的位置 */
export function getOccupiedPositions(lab: (ParticleType | null)[][]): { row: number; col: number }[] {
  return scanLab(lab).occupied;
}

/** 获取所有空格位置 */
export function getEmptyPositions(lab: (ParticleType | null)[][]): { row: number; col: number }[] {
  return scanLab(lab).empty;
}

/** 获取指定类型的所有粒子位置 */
export function getParticlesOfType(
  lab: (ParticleType | null)[][],
  type: ParticleType
): { row: number; col: number }[] {
  return scanLab(lab).byType.get(type) ?? [];
}

/** 获取场上所有不同的粒子类型 */
export function getDistinctParticleTypes(lab: (ParticleType | null)[][]): ParticleType[] {
  return Array.from(scanLab(lab).byType.keys());
}

/** 获取场上粒子总数 */
export function getParticleCount(lab: (ParticleType | null)[][]): number {
  return scanLab(lab).totalCount;
}
