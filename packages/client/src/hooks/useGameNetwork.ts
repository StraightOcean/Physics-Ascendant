// ============================================================
// useGameNetwork — 联机回合管理 Hook
// 封装网络消息处理 + 回合推进 + AI 回合
// ============================================================

import { useEffect, useCallback, useRef, MutableRefObject } from 'react';
import type { GameState } from '@engine/state/types';
import type { NetworkMessage } from '@engine/network/NetworkMessages';
import { initGame } from '@engine/index';
import { getCurrentPlayer } from '@engine/state/GameState';
import { getCardDef } from '@engine/cards/CardRegistry';
import {
  executeTurnAutoPhases, executeTurnEndPhases,
  executeUpgrade, executePlayCard,
  getHandOverflow, executeDiscardCard,
} from '@engine/phases/TurnManager';
import { checkAndProcessLegacies } from '@engine/legacy/LegacyMechanism';
import { AIDifficulty, aiDecideMainAction } from '@engine/ai/AIPlayer';
import { networkClient } from '../network/NetworkClient';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
/** 随机延迟区间 [min, max]，模拟自然思考节奏 */
function randomDelay(min: number, max: number) {
  return sleep(min + Math.random() * (max - min));
}

interface UseGameNetworkOpts {
  state: GameState | null;
  stateRef: MutableRefObject<GameState | null>;
  isHost: boolean;
  serverAuthorityRef: MutableRefObject<boolean>;
  difficulty: AIDifficulty;
  aiTimerRef: MutableRefObject<number | null>;
  setState: (s: GameState) => void;
  setAppPhase: (p: string) => void;
  setNetworkMode: (v: boolean) => void;
  setIsHost: (v: boolean) => void;
  setMessage: (m: string) => void;
  setTransitionMsg: (m: string | null) => void;
  setAiAction: (a: string | null) => void;
}

export function useGameNetwork(opts: UseGameNetworkOpts) {
  const {
    state, stateRef, isHost, serverAuthorityRef, difficulty, aiTimerRef,
    setState, setAppPhase, setNetworkMode, setIsHost, setMessage, setTransitionMsg, setAiAction,
  } = opts;

  const clamp = useCallback((s: GameState) => {
    const clone = structuredClone(s);
    setState(clone);
    stateRef.current = clone;
  }, [setState, stateRef]);

  // 用 ref 打破 endTurn ↔ doAITurn 的循环依赖
  const doAITurnRef = useRef<((s: GameState) => Promise<void>) | null>(null);

  // ---- 回合推进（跳过死亡玩家定位到下一个存活者）----
  // 注意：此函数会自行推进 currentPlayerIndex，调用方不应在调用前手动修改索引
  const advanceToNext = useCallback((s: GameState) => {
    // 最多跳过 playerCount 次防止无限循环
    for (let safety = 0; safety < s.playerCount; safety++) {
      s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.playerCount;
      if (s.currentPlayerIndex === 0) s.turn++;
      const player = s.players[s.currentPlayerIndex];
      if (!player.alive) continue;
      // 找到存活玩家
      clamp(s);
      if (player.id === 'player_0') {
        beginTurn(s);
      } else {
        setTransitionMsg(`${player.name} 的回合`);
        setTimeout(() => {
          setTransitionMsg(null);
          setMessage(`${player.name} 思考中...`);
          aiTimerRef.current = window.setTimeout(() => doAITurn(s), 800);
        }, 800);
      }
      return;
    }
    // 所有玩家都死亡 → 游戏结束
    s.gameOver = true;
    clamp(s);
    setAppPhase('gameover');
  }, []); // eslint-disable-line

  const beginTurn = useCallback((s: GameState) => {
    executeTurnAutoPhases(s);
    clamp(s);
    if (s.cosmicDieResult && s.turn >= 4) {
      setAppPhase('die_show');
    } else {
      setTransitionMsg(`第 ${s.turn} 回合`);
      setTimeout(() => { setTransitionMsg(null); setAppPhase('main_action'); setMessage('选择行动'); }, 800);
    }
  }, [clamp, setAppPhase, setMessage, setTransitionMsg]);

  const endTurn = useCallback((s: GameState) => {
    executeTurnEndPhases(s);
    checkAndProcessLegacies(s);
    if (s.gameOver) { clamp(s); setAppPhase('gameover'); return; }
    // executeTurnEndPhases 已推进索引，根据下一玩家类型分发
    const nextPlayer = s.players[s.currentPlayerIndex];
    if (!nextPlayer.alive) {
      advanceToNext(s);
    } else if (nextPlayer.id === 'player_0') {
      beginTurn(s);
    } else {
      // AI 回合 — 通过 ref 调用最新的 doAITurn（打破循环依赖）
      clamp(s);
      setTransitionMsg(`${nextPlayer.name} 的回合`);
      setTimeout(() => {
        setTransitionMsg(null);
        setMessage(`${nextPlayer.name} 思考中...`);
        aiTimerRef.current = window.setTimeout(() => doAITurnRef.current?.(s), 800);
      }, 800);
    }
  }, [clamp, setAppPhase, beginTurn, advanceToNext, setTransitionMsg, setMessage, aiTimerRef]);

  // ---- AI 回合 ----
  // 选卡辅助：调用 aiDecideMainAction 获取最优卡牌决策，提取可打出的卡实例
  function pickCard(s: GameState, player: any, _diff: AIDifficulty) {
    const cd = aiDecideMainAction(s, _diff);
    if (cd.action !== 'play_card' || !cd.cardId) return null;
    const inst = player.hand.find((h: any) => h.id === cd.cardId);
    if (!inst) return null;
    const d = getCardDef(inst.defId);
    if (!d || d.cost > player.energy) return null;
    return { instance: inst, def: d, params: cd.params };
  }

  /** 从手牌中选出仅次于指定卡牌的最优卡（备选方案） */
  function pickFallbackCard(s: GameState, player: any, _diff: AIDifficulty, failedDefIds: Set<string>) {
    const playable = player.hand
      .filter((c: any) => {
        if (failedDefIds.has(c.defId)) return false;
        const d = getCardDef(c.defId);
        return d && d.cost <= player.energy;
      })
      .sort((a: any, b: any) => {
        const dA = getCardDef(a.defId);
        const dB = getCardDef(b.defId);
        if (!dA || !dB) return 0;
        // 优先用费用低的卡（保留能量用于后续出牌）
        return dA.cost - dB.cost || a.defId.localeCompare(b.defId);
      });
    if (playable.length === 0) return null;
    const picked = playable[0];
    const d = getCardDef(picked.defId);
    if (!d) return null;
    // 用 smartParams 生成参数（手写 safe 调用）
    const cd = aiDecideMainAction(s, _diff);
    return { instance: picked, def: d, params: cd.params ?? {} };
  }

  const doAITurn = useCallback(async (s: GameState) => {
    // ======== 紧急超时保护：AI 回合最长 45s ========
    const AI_TURN_TIMEOUT = 45000;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      console.warn(`[AI] ⚠️ 回合超时！强制结束 ${getCurrentPlayer(s)?.name} 的回合`);
    }, AI_TURN_TIMEOUT);

    try {
      const player = getCurrentPlayer(s);
      if (!player.alive) {
        clearTimeout(timeoutId);
        advanceToNext(s); return;
      }

      console.log(`[AI] 回合开始: ${player.name} E=${player.energy} H=${player.hand.length} Lv.${player.researchLevel}`);

      const { eliminated } = executeTurnAutoPhases(s);
      if (eliminated.length > 0) checkAndProcessLegacies(s);
      clamp(s);
      if (s.gameOver) { clearTimeout(timeoutId); setAppPhase('gameover'); return; }

      await randomDelay(1500, 2500);

      // -------- 先升级 --------
      const firstDecision = aiDecideMainAction(s, difficulty);
      console.log(`[AI] 初始决策: ${firstDecision.action}` +
        (firstDecision.action === 'upgrade' ? ` → Lv.${firstDecision.targetLevel}` : '') +
        (firstDecision.action === 'play_card' ? ` cardId=${firstDecision.cardId}` : ''));

      if (firstDecision.action === 'upgrade' && firstDecision.targetLevel) {
        setAiAction(`${player.name} 升级研究所至 Lv.${firstDecision.targetLevel}`);
        const upResult = executeUpgrade(s, player.id, firstDecision.targetLevel);
        console.log(`[AI] 升级结果: ${upResult.success ? '成功' : '失败 ' + upResult.reason}`);
        clamp(s); await randomDelay(1500, 2000);
      }

      // -------- 循环出牌（带失败黑名单和重试）--------
      const failedCards = new Set<string>(); // 失败的 cardDefId 不再重试
      let playCount = 0;
      let consecutiveFails = 0;
      const MAX_CONSECUTIVE_FAILS = 3;
      const MAX_CARDS = 10;

      while (playCount < MAX_CARDS && player.alive && player.energy > 0 && player.hand.length > 0) {
        if (timedOut) break;

        const card = pickCard(s, player, difficulty);

        // 首选卡在黑名单中 → 换备选
        if (card && failedCards.has(card.instance.defId)) {
          console.log(`[AI] 跳过已失败的卡 ${card.def.name}(${card.instance.defId})`);
          const fallback = pickFallbackCard(s, player, difficulty, failedCards);
          if (!fallback) break;
          // 打出备选
          setAiAction(`${player.name} 打出 ${fallback.def.name}（备选）${playCount > 0 ? ` #${playCount+1}` : ''}`);
          try {
            const result = executePlayCard(s, player.id, fallback.instance.id, fallback.params);
            if (result.success) {
              playCount++;
              consecutiveFails = 0;
              console.log(`[AI] 备选成功: ${fallback.def.name} cost=${fallback.def.cost} 剩余E=${player.energy}`);
            } else {
              failedCards.add(fallback.instance.defId);
              consecutiveFails++;
              console.warn(`[AI] 备选出牌失败: ${fallback.def.name} → ${result.reason}`);
            }
          } catch (e) {
            failedCards.add(fallback.instance.defId);
            consecutiveFails++;
            console.error(`[AI] 备选出牌异常: ${fallback.def.name}`, e);
          }
          clamp(s);
          await randomDelay(1000, 1800);
          if (s.gameOver) { clearTimeout(timeoutId); setAppPhase('gameover'); setAiAction(null); return; }
          if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
            console.warn(`[AI] 连续 ${MAX_CONSECUTIVE_FAILS} 次出牌失败，退出循环`);
            break;
          }
          continue;
        }

        if (!card) break;

        setAiAction(`${player.name} 打出 ${card.def.name}${playCount > 0 ? ` #${playCount+1}` : ''}`);
        try {
          const result = executePlayCard(s, player.id, card.instance.id, card.params);
          if (result.success) {
            playCount++;
            consecutiveFails = 0;
            console.log(`[AI] 出牌成功: ${card.def.name} cost=${card.def.cost} 剩余E=${player.energy}`);
          } else {
            failedCards.add(card.instance.defId);
            consecutiveFails++;
            console.warn(`[AI] 出牌失败: ${card.def.name}(${card.instance.defId}) → ${result.reason} (连续失败 ${consecutiveFails}/${MAX_CONSECUTIVE_FAILS})`);
          }
        } catch (e) {
          failedCards.add(card.instance.defId);
          consecutiveFails++;
          console.error(`[AI] 出牌异常: ${card.def.name}(${card.instance.defId})`, e);
        }
        clamp(s); await randomDelay(1000, 1800);
        if (s.gameOver) { clearTimeout(timeoutId); setAppPhase('gameover'); setAiAction(null); return; }
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
          console.warn(`[AI] 连续 ${MAX_CONSECUTIVE_FAILS} 次出牌失败，退出循环`);
          break;
        }
      }

      setAiAction(null);
      console.log(`[AI] 出牌循环结束: ${playCount} 张, 剩余 E=${player.energy} H=${player.hand.length}`);

      // -------- 弃牌 --------
      const discardCount = Math.max(0, player.hand.length - 8);
      for (let i = 0; i < discardCount; i++) {
        const card = player.hand[player.hand.length - 1];
        if (card) {
          const idx = player.hand.indexOf(card);
          if (idx >= 0) player.hand.splice(idx, 1);
          if (!s.discardPiles[player.id]) s.discardPiles[player.id] = [];
          s.discardPiles[player.id].push(card);
        }
      }
      if (discardCount > 0) { clamp(s); await randomDelay(800, 1200); }

      // -------- 回合结束 --------
      executeTurnEndPhases(s);
      checkAndProcessLegacies(s);
      clamp(s);
      if (s.gameOver) { clearTimeout(timeoutId); setAppPhase('gameover'); return; }

      const nextPlayer = s.players[s.currentPlayerIndex];
      console.log(`[AI] 回合结束, 下一个玩家: ${nextPlayer.name}(${nextPlayer.id})`);

      if (timedOut) {
        advanceToNext(s);
      } else if (nextPlayer.id === 'player_0') {
        beginTurn(s);
      } else {
        setTransitionMsg(`${nextPlayer.name} 的回合`);
        setTimeout(() => {
          setTransitionMsg(null);
          setMessage(`${nextPlayer.name} 思考中...`);
          aiTimerRef.current = window.setTimeout(() => doAITurn(s), 800);
        }, 800);
      }
    } catch (err) {
      console.error('[AI] ⚠️ 回合执行异常，强制跳过:', err);
      // 紧急恢复：直接推进到下一个玩家
      try {
        if (s && !s.gameOver) {
          s.turn++;
          s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.playerCount;
          clamp(s);
          advanceToNext(s);
        }
      } catch (recoveryErr) {
        console.error('[AI] 恢复失败，终止游戏:', recoveryErr);
        if (s) { s.gameOver = true; clamp(s); setAppPhase('gameover'); }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [difficulty, clamp, setAppPhase, setAiAction, beginTurn, setTransitionMsg, setMessage, aiTimerRef]);

  // 始终保持 ref 指向最新的 doAITurn（打破 endTurn ↔ doAITurn 循环依赖）
  doAITurnRef.current = doAITurn;

  // ---- 联机回合 ----
  const networkBeginTurn = useCallback((s: GameState) => {
    executeTurnAutoPhases(s);
    clamp(s);
    networkClient.send({ type: 'game_state', state: s });
    if (s.cosmicDieResult && s.turn >= 4) {
      setAppPhase('die_show');
    } else {
      setTransitionMsg(`第 ${s.turn} 回合`);
      setTimeout(() => {
        setTransitionMsg(null);
        setAppPhase('main_action');
        const cp = s.players[s.currentPlayerIndex];
        setMessage(cp.id === 'player_0' ? '你的回合' : `等待 ${cp.name} 行动...`);
      }, 800);
    }
  }, [clamp, setAppPhase, setMessage, setTransitionMsg]);

  const networkEndTurn = useCallback((s: GameState) => {
    executeTurnEndPhases(s);
    checkAndProcessLegacies(s);
    clamp(s);
    if (s.gameOver) {
      networkClient.send({ type: 'game_state', state: s });
      setAppPhase('gameover'); return;
    }
    networkClient.send({ type: 'game_state', state: s });
    // executeTurnEndPhases 已通过 executePhaseEnd 推进了 currentPlayerIndex
    const cp = s.players[s.currentPlayerIndex];
    if (cp.id === 'player_0') {
      networkBeginTurn(s);
    } else {
      networkClient.send({ type: 'game_state', state: s });
      setTransitionMsg(`${cp.name} 的回合`);
      setTimeout(() => { setTransitionMsg(null); setMessage(`等待 ${cp.name} 行动...`); }, 800);
    }
  }, [clamp, setAppPhase, setMessage, setTransitionMsg, networkBeginTurn]);

  // ---- 网络消息处理 ----
  useEffect(() => {
    const onStartGame = (msg: NetworkMessage) => {
      if (stateRef.current) return;
      const count = msg.playerCount || 2;
      const names = (msg.playerNames && msg.playerNames.length >= count)
        ? msg.playerNames.slice(0, count) : ['主机', '玩家2'];
      const s = initGame(names, count as 2 | 4);
      setState(s);
      setNetworkMode(true);
      setIsHost(true);
      networkClient.playerId = 'player_0';
      const cp = s.players[s.currentPlayerIndex];
      if (cp.id === 'player_0') { networkBeginTurn(s); }
      else { setAppPhase('main_action'); setMessage(`等待 ${cp.name} 行动...`); }
      networkClient.send({ type: 'game_state', state: s });
    };

    const onGameState = (msg: NetworkMessage) => {
      if (!msg.state || !msg.state.players) return;
      const s = msg.state as GameState;
      const hasServerId = !!(msg as any).yourPlayerId;
      if (hasServerId) serverAuthorityRef.current = true;
      const myId = (msg as any).yourPlayerId || networkClient.playerId || 'player_0';
      networkClient.playerId = myId;
      setState(s);
      setNetworkMode(true);
      setIsHost(hasServerId ? myId === 'player_0' : true);
      setAppPhase('main_action');
      const cp = s.players[s.currentPlayerIndex];
      if (cp.id === myId) setMessage('你的回合');
      else setMessage(`等待 ${cp.name} 行动...`);
      if (s.gameOver) setAppPhase('gameover');
    };

    const onPlayCard = (msg: NetworkMessage) => {
      if (!stateRef.current || !isHost || !msg.from) return;
      const joiner = stateRef.current.players.find(p => p.id === msg.from);
      if (!joiner || !joiner.alive) return;
      executePlayCard(stateRef.current, msg.from, msg.cardId, msg.params || {});
      clamp(stateRef.current);
      if (stateRef.current.gameOver) { setAppPhase('gameover'); }
      networkClient.send({ type: 'game_state', state: stateRef.current });
    };

    const onUpgrade = (msg: NetworkMessage) => {
      if (!stateRef.current || !isHost || !msg.from) return;
      executeUpgrade(stateRef.current, msg.from, msg.targetLevel);
      clamp(stateRef.current);
      networkClient.send({ type: 'game_state', state: stateRef.current });
    };

    const onEndTurn = (msg: NetworkMessage) => {
      if (!stateRef.current || !isHost || !msg.from) return;
      if (msg.discardCardId) {
        executeDiscardCard(stateRef.current, msg.from, msg.discardCardId);
        clamp(stateRef.current);
        if (getHandOverflow(stateRef.current, msg.from) > 0) {
          networkClient.send({ type: 'game_state', state: stateRef.current });
          return;
        }
      }
      networkEndTurn(stateRef.current);
    };

    const onSurrender = (msg: NetworkMessage) => {
      if (!stateRef.current || !msg.from) return;
      const p = stateRef.current.players.find(pl => pl.id === msg.from);
      if (p) { p.entropy = p.maxEntropy; p.alive = false; }
      checkAndProcessLegacies(stateRef.current);
      clamp(stateRef.current);
      networkClient.send({ type: 'game_state', state: stateRef.current });
      if (stateRef.current.gameOver) setAppPhase('gameover');
    };

    networkClient.on('start_game', onStartGame);
    networkClient.on('game_state', onGameState);
    networkClient.on('play_card', onPlayCard);
    networkClient.on('do_upgrade', onUpgrade);
    networkClient.on('end_turn', onEndTurn);
    networkClient.on('surrender', onSurrender);

    const onNeedDiscard = (msg: NetworkMessage) => {
      if (!stateRef.current) return;
      setAppPhase('discard');
      setMessage(`手牌超出上限，请弃 ${(msg as any).count || 1} 张牌`);
    };
    const onGameOver = () => {
      if (!stateRef.current) return;
      stateRef.current.gameOver = true;
      clamp(stateRef.current);
      setAppPhase('gameover');
    };
    networkClient.on('need_discard', onNeedDiscard);
    networkClient.on('game_over', onGameOver);

    return () => {
      networkClient.off('start_game', onStartGame);
      networkClient.off('game_state', onGameState);
      networkClient.off('need_discard', onNeedDiscard);
      networkClient.off('game_over', onGameOver);
      networkClient.off('play_card', onPlayCard);
      networkClient.off('do_upgrade', onUpgrade);
      networkClient.off('end_turn', onEndTurn);
      networkClient.off('surrender', onSurrender);
    };
  }, [isHost, clamp, stateRef, serverAuthorityRef, setState, setAppPhase, setNetworkMode, setIsHost, setMessage, networkBeginTurn, networkEndTurn]);

  return {
    clamp,
    beginTurn, endTurn, advanceToNext,
    doAITurn,
    networkBeginTurn, networkEndTurn,
  };
}
