import React, { useState } from 'react';
import type { PlayerState } from '@engine/state/types';
import { getCardDef } from '@engine/cards/CardRegistry';

interface Props {
  player: PlayerState;
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  disabled?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  '资源':'💰','部署':'✨','位移':'➡️','攻击':'⚔️',
  '干扰':'🌀','防御':'🛡️','清场':'💥','特殊':'🔮',
  '自损':'⚠️','科技':'🔬',
};

// 卡牌效果详细说明
const CARD_EFFECT_DETAIL: Record<string, string> = {
  energy_drain: '获得2点能量。若超过上限10，每超1点积累1虚空零点能（>5出局）。',
  particle_spawn: '在己方空格生成1个夸克(Q)或电子(E)。',
  thrust: '将己方1个粒子沿上下左右移动1格（不可移出场外）。',
  entropy_pulse: '指定1名对手，其熵值+1。',
  gravity_pull: '将对手的1个粒子沿直线拉近己方1格（目标须为真空）。',
  energy_shield: '获得1点护盾值，可抵挡1次熵增脉冲或湮灭造成的熵增。',
  vacuum_decay: '移除己方1个粒子 → 熵+1 → 能量+3。',
  antimatter_catalysis: '将己方1个普通粒子(Q/E/P)转变为对应的反粒子(Ā/Ē/P̄)。',
  gravity_slingshot: '将己方1个粒子沿直线推出，撞到对手粒子双方各+1熵。',
  energy_overload: '能量+5，但熵值+2（可能积累虚空零点能）。',
  // Lv.1
  inertia_launch: '使相邻的两个夸克(Q)合并为一个质子(P)。',
  momentum_conservation: '本回合每移动1次己方粒子，对手须移动1个自己的粒子。',
  lever_principle: '己方场上相距2格的粒子互换位置。',
  friction_torque: '指定对手1个粒子，下回合不可移动。',
  free_fall: '己方1个粒子从上往下移动到底（遇粒子停止）。',
  collision_restore: '移除己方2个相邻粒子，能量+4。',
  // Lv.2
  faraday_shield: '本回合及下回合免疫所有熵值增加（含自然熵增和湮灭）。',
  coulomb_repulsion: '将对手1个粒子弹离你的方向2格。',
  electromagnetic_induction: '对手场上2个相邻粒子互换位置。',
  magnetic_closure: '己方直线3粒子顺时针循环移动1格。',
  electrostatic_adsorption: '对手1个粒子移至己方空格（缴获，归属不变）。',
  current_impact: '对手熵+2，你必须弃1张手牌。',
  // Lv.3
  maxwell_demon: '无视距离移动场上任意1个粒子到己方空格。',
  brownian_motion: '己方所有粒子各移动1格（对手选方向）。',
  heat_conduction: '转移己方1熵给对手，对手获得1能量补偿。',
  adiabatic_compression: '移除己方2个粒子，获得5能量。',
  entropy_reducer: '己方熵值-1（可多次使用，费用6）。',
  phase_transition: '己方所有同类型粒子全转为另一种（自选）。',
  // Lv.4
  observation_collapse: '猜对手1个粒子类型→猜中移除+对方+2熵/猜错自己+1熵。',
  quantum_tunneling: '己方1个粒子穿墙移至相邻真空格（无视阻挡）。',
  superposition: '己方1个粒子同时视为两种类型，持续1回合。',
  entanglement_transfer: '己方2粒子建立纠缠（整局），一毁俱毁。',
  wave_particle_duality: '将粒子视为"波"：指定一个粒子立即斜向移动一格。',
  uncertainty: '弃1张手牌，随机抽对手1张手牌。',
  // Lv.5
  spacetime_curvature: '己方一行与对手一行重叠，对应正反物质对同时湮灭。',
  gravitational_lens: '对手场上"相邻"判定延长至2格（持续1回合）。',
  time_dilation: '跳过对手下一回合（对方熵增照常但无法行动抽牌）。',
  wormhole_connection: '己方2空格建立虫洞（持续2回合），进入即传送。',
  singularity_collapse: '移除己方所有粒子，每1个所有对手各+1熵。',
  gravitational_wave: '所有对手各移动场上1个粒子（你指定方向）。',
  // Lv.6
  dimension_strike: '对手弃2张最高等级科技牌（无则弃4张基础牌），+3熵。',
  brane_collision: '所有存活玩家各+2熵，各移除1个粒子。',
  superstring_resonance: '手牌洗回牌库重抽5张（保留科技卡）。',
  calabi_yau_manifold: '重排场上所有粒子位置，熵-1。',
  multiverse_split: '本轮可执行两次主要行动（两升级/两部署/各一）。',
  grand_unification: '熵值-2，熵值上限+5。',
};

const HandPanel = React.memo(function HandPanel({ player, selectedCard, onSelectCard, disabled }: Props) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="hand-panel" style={{position:'relative'}}>
      <div className="hand-label">
        🎴 手牌 ({player.hand.length}/8)
        {player.hand.length > 8 && <span className="hand-overflow">⚠ 超出上限</span>}
      </div>
      <div className="hand-cards">
        {player.hand.map((card) => {
          const def = getCardDef(card.defId);
          if (!def) return null;

          const isSelected = selectedCard === card.id;
          const canAfford = def.cost <= player.energy;
          const isTech = def.level > 0;
          const isHovered = hoveredCard === card.id;
          const detail = CARD_EFFECT_DETAIL[def.id] || def.description;

          return (
            <div key={card.id} style={{position:'relative'}}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={`hand-card ${isSelected ? 'selected' : ''} ${!canAfford ? 'unaffordable' : ''} ${isTech ? 'tech' : ''}`}
                onClick={() => !disabled && canAfford && onSelectCard(card.id)}
              >
                <div className="card-cost">{def.cost === 0 ? '0' : def.cost}</div>
                <div className="card-type-icon">{TYPE_ICONS[def.type] || '📜'}</div>
                <div className="card-name">{def.name}</div>
                {isTech && <div className="card-tech-level">Lv.{def.level}</div>}
                <div className="card-desc">{def.description.slice(0, 24)}...</div>
              </div>

              {/* 悬浮详情弹窗 */}
              {isHovered && (
                <div style={{
                  position:'absolute',bottom:'100%',left:'50%',transform:'translateX(-50%)',
                  marginBottom:8,width:220,padding:12,
                  background:'var(--bg-panel)',border:'2px solid var(--border-accent)',borderRadius:10,
                  color:'#e0e0e0',zIndex:500,boxShadow:'0 8px 24px rgba(0,0,0,0.6)',
                  pointerEvents:'none',fontSize:12,
                }}>
                  <div style={{fontWeight:'bold',color:'#e0c080',marginBottom:4}}>
                    {TYPE_ICONS[def.type]} {def.name}
                    {isTech && <span style={{color:'var(--text-accent)',marginLeft:6}}>Lv.{def.level}</span>}
                  </div>
                  <div style={{color:'#e0c080',marginBottom:6}}>费用：⚡{def.cost} | 类型：{def.type}</div>
                  <div style={{color:'var(--text-primary)',lineHeight:1.5,fontSize:11}}>{detail}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
export default HandPanel;
