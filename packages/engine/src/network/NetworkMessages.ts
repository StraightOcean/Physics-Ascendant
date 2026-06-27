// ============================================================
// 网络消息类型定义 — client/server/cf-worker 统一引用
// ============================================================

import { GameState, PlayCardParams } from '../state/types';

/**
 * 网络消息格式
 * 用于 client ↔ server ↔ cf-worker 之间的 WebSocket 通信
 */
export interface NetworkMessage {
  /** 消息类型 */
  type:
    | 'host_game'
    | 'join_game'
    | 'start_game'
    | 'game_state'
    | 'play_card'
    | 'do_upgrade'
    | 'end_turn'
    | 'surrender'
    | 'discard_card'
    | 'connected'
    | 'player_joined'
    | 'player_left'
    | 'error';

  /** 发送者 playerId */
  from?: string;

  /** 房间 ID */
  roomId?: string;

  /** 玩家数量 */
  playerCount?: number;

  /** 玩家名称列表 */
  playerNames?: string[];

  /** 游戏状态（主机广播用） */
  state?: GameState;

  /** 卡牌 ID（play_card 消息） */
  cardId?: string;

  /** 卡牌参数 */
  params?: PlayCardParams;

  /** 升级目标等级（do_upgrade 消息） */
  targetLevel?: number;

  /** 弃牌 ID（discard_card / end_turn 消息） */
  discardCardId?: string;

  /** 成功/失败标记 */
  success?: boolean;

  /** 错误信息 */
  error?: string;
}
