// ============================================================
// 统一大棋盘 v2 — 双主题支持 + 无缝隙拼接 + 3×3居中渲染
// ============================================================

import React, { useRef, useEffect } from 'react';
import type { PlayerState, ParticleType, GridPos } from '@engine/state/types';
import type { Theme } from '../hooks/useTheme';

const CELL = 56;
const PAD = 20;
const LABEL_H = 18;
const CROSS_GAP = 0;

const PARTICLE_COLORS: Record<ParticleType, string> = {
  Q: '#e74c3c', E: '#3498db', P: '#2ecc71',
  'Ā': '#9b59b6', 'Ē': '#1abc9c', 'P̄': '#f39c12',
};

// ---- 双主题配色 ----
const DARK = {
  bg: '#0a0a18',
  gridBg: '#111122',
  gridBgDead: '#1a0a0a',
  boardBorder: '#303060',
  boardBorderDead: '#402020',
  coreBg: 'rgba(64, 96, 192, 0.06)',
  coreBgDead: 'rgba(100, 20, 20, 0.06)',
  coreBorder: 'rgba(96, 128, 255, 0.22)',
  coreBorderDead: 'rgba(200, 40, 40, 0.22)',
  gridLine: '#202040',
  gridLineDead: '#201010',
  glow: 'rgba(128, 128, 255, 0.1)',
  glowExpanded: 'rgba(255, 80, 80, 0.2)',
  dot: '#404080',
  dotDead: '#402020',
  labelHuman: '#e0c080',
  labelAI: '#8080c0',
  labelDead: '#602020',
  vacuumBg: '#0a0a14',
  vacuumBorder: '#1a1a30',
  vacuumGrid: '#151525',
  vacuumText: '#1a1a30',
  preview: 'rgba(255, 200, 60, 0.35)',
  previewBorder: '#ffc830',
  textOnParticle: '#fff',
};

const LIGHT = {
  bg: '#f0f0f5',
  gridBg: '#e8e8f0',
  gridBgDead: '#f5e8e8',
  boardBorder: '#c0c0d0',
  boardBorderDead: '#d0b0b0',
  coreBg: 'rgba(64, 96, 192, 0.04)',
  coreBgDead: 'rgba(200, 80, 80, 0.04)',
  coreBorder: 'rgba(64, 96, 192, 0.2)',
  coreBorderDead: 'rgba(200, 80, 80, 0.2)',
  gridLine: '#d0d0e0',
  gridLineDead: '#e0d0d0',
  glow: 'rgba(64, 96, 192, 0.08)',
  glowExpanded: 'rgba(200, 60, 60, 0.15)',
  dot: '#8080b0',
  dotDead: '#b08080',
  labelHuman: '#6040a0',
  labelAI: '#4060a0',
  labelDead: '#a06060',
  vacuumBg: '#e0e0e8',
  vacuumBorder: '#d0d0d8',
  vacuumGrid: '#d8d8e0',
  vacuumText: '#c0c0d0',
  preview: 'rgba(200, 160, 40, 0.3)',
  previewBorder: '#c0a020',
  textOnParticle: '#fff',
};

interface Props {
  players: PlayerState[];
  currentPlayerIndex: number;
  preview?: { playerId: string; pos: GridPos } | null;
  onCellClick?: (playerId: string, gridRow: number, gridCol: number) => void;
  viewerId?: string;
  theme?: Theme;
}

interface Region {
  player: PlayerState | null;
  ox: number; oy: number;
}

const UnifiedBoard = React.memo(function UnifiedBoard({ players: rawPlayers, currentPlayerIndex, preview, onCellClick, viewerId, theme = 'dark' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const players = viewerId && viewerId !== 'player_0' && rawPlayers.length === 2
    ? [rawPlayers[1], rawPlayers[0]]
    : rawPlayers;
  const n = players.length;
  const colors = theme === 'light' ? LIGHT : DARK;

  const { regions, width, height } = computeLayout(players);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    regions.forEach(r => drawRegion(ctx, r, colors));

    if (preview) {
      const r = regions.find(rr => rr.player && rr.player.id === preview.playerId);
      if (r && r.player) {
        const pos = preview.pos;
        const labSize = r.player.labSize;
        const { cx, cy } = posToPixel(r.ox, r.oy, pos.row, pos.col, labSize);
        ctx.beginPath();
        ctx.arc(cx, cy, CELL / 2 - 3, 0, Math.PI * 2);
        ctx.fillStyle = colors.preview;
        ctx.fill();
        ctx.strokeStyle = colors.previewBorder;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    drawLabels(ctx, regions, colors);
  });

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCellClick) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const r of regions) {
      if (!r.player) continue;
      if (mx >= r.ox && mx < r.ox + 5*CELL && my >= r.oy && my < r.oy + 5*CELL) {
        const col5 = Math.floor((mx - r.ox) / CELL);
        const row5 = Math.floor((my - r.oy) / CELL);
        const offset = r.player.labSize === 3 ? 1 : 0;
        const row = row5 - offset;
        const col = col5 - offset;
        if (row >= 0 && row < r.player.labSize && col >= 0 && col < r.player.labSize) {
          onCellClick(r.player.id, row, col);
        }
        return;
      }
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <canvas ref={canvasRef} width={width} height={height}
        onClick={handleCanvasClick}
        style={{ borderRadius: 10, display: 'block', maxWidth: '100%', cursor: onCellClick ? 'crosshair' : 'default' }} />
    </div>
  );
});

// ---- 坐标转换 ----
function posToPixel(ox: number, oy: number, row: number, col: number, labSize: number) {
  const offset = labSize === 3 ? 1 : 0;
  const cx = ox + (col + offset) * CELL + CELL / 2;
  const cy = oy + (row + offset) * CELL + CELL / 2;
  return { cx, cy };
}

// ---- 布局计算 ----
function computeLayout(players: PlayerState[]): { regions: Region[]; width: number; height: number } {
  const RW = 5 * CELL;

  // 2人: 上下拼接
  if (players.length === 2) {
    const width = RW + PAD * 2;
    const height = RW * 2 + PAD * 2 + LABEL_H;
    return {
      width, height,
      regions: [
        { player: players[1], ox: PAD, oy: PAD + LABEL_H },
        { player: players[0], ox: PAD, oy: PAD + LABEL_H + RW },
      ],
    };
  }

  // 4人十字型:   [P3]
  //          [P1][空][P2]
  //            [P0]
  const width4 = PAD + RW + CROSS_GAP + RW + CROSS_GAP + RW + PAD;
  const height4 = PAD + LABEL_H + RW + CROSS_GAP + RW + CROSS_GAP + RW + PAD;
  const col3 = (x: number) => PAD + x * (RW + CROSS_GAP);
  const row3 = (y: number) => PAD + LABEL_H + y * (RW + CROSS_GAP);

  return {
    width: width4, height: height4,
    regions: [
      { player: players[3], ox: col3(1), oy: row3(0) },  // 上
      { player: players[1], ox: col3(0), oy: row3(1) },  // 左
      { player: null, ox: col3(1), oy: row3(1) },         // 中(真空)
      { player: players[2], ox: col3(2), oy: row3(1) },  // 右
      { player: players[0], ox: col3(1), oy: row3(2) },  // 下(玩家)
    ],
  };
}

// ---- 绘制区域 ----
function drawRegion(ctx: CanvasRenderingContext2D, r: Region, C: typeof DARK) {
  const { ox, oy, player } = r;

  // 真空区域
  if (!player) {
    ctx.fillStyle = C.vacuumBg;
    ctx.fillRect(ox - 1, oy - 1, 5 * CELL + 2, 5 * CELL + 2);
    ctx.strokeStyle = C.vacuumBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(ox, oy, 5 * CELL, 5 * CELL);
    ctx.setLineDash([]);
    ctx.strokeStyle = C.vacuumGrid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(ox + i * CELL, oy); ctx.lineTo(ox + i * CELL, oy + 5 * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + i * CELL); ctx.lineTo(ox + 5 * CELL, oy + i * CELL); ctx.stroke();
    }
    ctx.fillStyle = C.vacuumText;
    ctx.font = 'italic 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('真空', ox + 2.5 * CELL, oy + 2.5 * CELL);
    return;
  }

  const alive = player.alive;
  const labSize = player.labSize;

  ctx.fillStyle = alive ? C.gridBg : C.gridBgDead;
  ctx.fillRect(ox - 1, oy - 1, 5 * CELL + 2, 5 * CELL + 2);

  ctx.strokeStyle = alive ? C.boardBorder : C.boardBorderDead;
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, 5 * CELL, 5 * CELL);

  const cx = ox + CELL, cy = oy + CELL;
  ctx.fillStyle = alive ? C.coreBg : C.coreBgDead;
  ctx.fillRect(cx, cy, 3 * CELL, 3 * CELL);
  ctx.strokeStyle = alive ? C.coreBorder : C.coreBorderDead;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(cx, cy, 3 * CELL, 3 * CELL);
  ctx.setLineDash([]);

  ctx.strokeStyle = alive ? C.gridLine : C.gridLineDead;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(ox + i * CELL, oy); ctx.lineTo(ox + i * CELL, oy + 5 * CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy + i * CELL); ctx.lineTo(ox + 5 * CELL, oy + i * CELL); ctx.stroke();
  }

  for (let row = 0; row < labSize; row++) {
    for (let col = 0; col < labSize; col++) {
      const p = player.lab[row]?.[col];
      if (!p) continue;

      const { cx: px, cy: py } = posToPixel(ox, oy, row, col, labSize);
      const r = CELL / 2 - 6;
      const inCore = labSize === 3 || (row >= 1 && row <= 3 && col >= 1 && col <= 3);
      const expanded = !inCore && labSize === 5;

      ctx.beginPath();
      ctx.arc(px, py, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = expanded ? C.glowExpanded : C.glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = alive ? (PARTICLE_COLORS[p] || '#aaa') : '#444';
      ctx.fill();
      ctx.strokeStyle = C.textOnParticle;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = C.textOnParticle;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p, px, py);
    }
  }

  const mid = ox + 2.5 * CELL;
  const midY = oy + 2.5 * CELL;
  ctx.beginPath();
  ctx.arc(mid, midY, 3, 0, Math.PI * 2);
  ctx.fillStyle = alive ? C.dot : C.dotDead;
  ctx.fill();
}

// ---- 标签 ----
function drawLabels(ctx: CanvasRenderingContext2D, regions: Region[], C: typeof DARK) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 12px sans-serif';

  regions.forEach(r => {
    if (!r.player) return;
    const alive = r.player.alive;
    const isHuman = r.player.id === 'player_0';
    const lx = r.ox + 2.5 * CELL;
    const ly = r.oy - LABEL_H + 2;
    ctx.fillStyle = alive ? (isHuman ? C.labelHuman : C.labelAI) : C.labelDead;
    ctx.fillText(`${isHuman ? '👤 ' : '🤖 '}${r.player.name}${!alive ? ' ☠' : ''}`, lx, Math.max(2, ly));
  });
}
export default UnifiedBoard;
