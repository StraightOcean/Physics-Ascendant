// ============================================================
// 科技树叠加层 — 显示全部6级×6张科技卡效果
// ============================================================

import React from 'react';

const FULL_TECH_TREE = [
  { lv: 1, name: '经典力学', cost: 3, req: '2个夸克(Q)相邻', cards: [
    { name:'惯性弹射', cost:2, desc:'将己方粒子沿直线推出，撞对手各+1熵(升级即得)' },
    { name:'动量守恒', cost:1, desc:'对手随机移动一个粒子，能量+1' },
    { name:'杠杆原理', cost:2, desc:'己方相距2格的粒子互换位置' },
    { name:'摩擦力矩', cost:2, desc:'锁定对手一个粒子，下回合不可移动' },
    { name:'自由落体', cost:1, desc:'己方粒子从上往下移动到底' },
    { name:'碰撞恢复', cost:3, desc:'移除己方2个相邻粒子，能量+4' },
  ]},
  { lv: 2, name: '电磁统一', cost: 4, req: '1质子(P)+1电子(E)相邻', cards: [
    { name:'法拉第护盾', cost:2, desc:'护盾+3，抽1张牌(升级即得)' },
    { name:'库仑斥力', cost:2, desc:'推出对手1个粒子' },
    { name:'电磁感应', cost:3, desc:'互换对手两个相邻粒子位置' },
    { name:'磁感线闭合', cost:1, desc:'互换己方两个粒子位置' },
    { name:'静电吸附', cost:2, desc:'对手1个普通粒子转化为反粒子' },
    { name:'电流冲击', cost:3, desc:'对手+2熵，你弃1张手牌' },
  ]},
  { lv: 3, name: '热力学统计', cost: 5, req: 'P与游离粒子相隔1格(中间真空)', cards: [
    { name:'麦克斯韦妖', cost:3, desc:'互换己方两粒子，能量+1(升级即得)' },
    { name:'布朗运动', cost:4, desc:'打乱所有玩家棋盘上的粒子' },
    { name:'热传导', cost:3, desc:'转移己方1熵给对手，对方+1能量' },
    { name:'绝热压缩', cost:2, desc:'移除己方2粒子，获得5能量' },
    { name:'熵减机', cost:6, desc:'熵值-1' },
    { name:'相变临界', cost:3, desc:'己方2个普通粒子转化为反粒子' },
  ]},
  { lv: 4, name: '量子力学', cost: 6, req: '1对正反物质对(不相邻)', cards: [
    { name:'观测坍缩', cost:4, desc:'猜对手粒子，猜中移除+2熵(升级即得)' },
    { name:'量子隧穿', cost:2, desc:'互换己方两粒子，护盾+1' },
    { name:'叠加态', cost:1, desc:'生成1粒子(Q/E)，抽1牌' },
    { name:'纠缠传输', cost:3, desc:'互换两相邻粒子，生成新粒子' },
    { name:'波粒二象性', cost:2, desc:'己方粒子斜向移动1格' },
    { name:'不确定性', cost:1, desc:'弃1张牌，偷对手1张牌' },
  ]},
  { lv: 5, name: '广义相对论', cost: 7, req: '3个粒子排成直线', cards: [
    { name:'时空弯曲', cost:5, desc:'打乱棋盘：2人颠倒，4人逆时针旋转(升级即得)' },
    { name:'引力透镜', cost:3, desc:'己方粒子斜向移动+抽1牌' },
    { name:'时间膨胀', cost:4, desc:'跳过对手下一回合' },
    { name:'虫洞连接', cost:3, desc:'互换两对角粒子，能量+2' },
    { name:'奇点坍缩', cost:5, desc:'移除己方1粒子(能量+2)，所有对手+1熵' },
    { name:'引力波', cost:4, desc:'所有对手+2熵' },
  ]},
  { lv: 6, name: '弦论终极', cost: 8, req: '5种不同粒子', cards: [
    { name:'维度打击', cost:6, desc:'对手弃2张最高科技牌，+3熵(升级即得)' },
    { name:'膜宇宙碰撞', cost:6, desc:'全体+2熵，各移除1粒子' },
    { name:'超弦共振', cost:5, desc:'手牌洗回重抽5张，保留科技卡' },
    { name:'卡拉比-丘流形', cost:4, desc:'重排实验场粒子，熵-1' },
    { name:'多重宇宙分裂', cost:7, desc:'获得一个额外回合' },
    { name:'大统一理论', cost:8, desc:'熵-2，熵上限+5' },
  ]},
];

interface Props {
  playerLevel: number;
  onClose: () => void;
}

const TechTreePanel = React.memo(function TechTreePanel({ playerLevel, onClose }: Props) {
  return (
    <div style={{
      position:'fixed',top:0,left:0,right:0,bottom:0,
      background:'rgba(0,0,0,0.8)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:1500,
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--bg-panel2)',border:'2px solid var(--border-accent)',borderRadius:12,
        padding:24,width:'90vw',maxWidth:800,maxHeight:'85vh',overflowY:'auto',
        color:'#e0e0e0'
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{color:'var(--text-accent)',margin:0}}>📚 科技树全览</h2>
          <button onClick={onClose} style={{
            padding:'6px 16px',background:'#302020',color:'#e06060',
            border:'none',borderRadius:6,cursor:'pointer',fontSize:14
          }}>关闭</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))',gap:12}}>
          {FULL_TECH_TREE.map(t => {
            const unlocked = playerLevel >= t.lv;
            const current = playerLevel === t.lv - 1;
            return (
              <div key={t.lv} style={{
                padding:12,background:unlocked?'var(--bg-panel)':current?'var(--bg-panel2)':'var(--bg-panel3)',
                border:`2px solid ${unlocked?'var(--border-accent)':current?'var(--bg-selected)':'var(--bg-panel3)'}`,
                borderRadius:10,opacity:unlocked?1:current?0.85:0.5,
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div>
                    <span style={{color:'var(--text-accent)',fontWeight:'bold',fontSize:15}}>
                      Lv.{t.lv} {t.name}
                    </span>
                    <span style={{marginLeft:8,fontSize:12}}>
                      {unlocked ? '✅' : current ? '⬅ 下一级' : '🔒'}
                    </span>
                  </div>
                  <span style={{color:'#e0c080',fontSize:13}}>升级 ⚡{t.cost}</span>
                </div>
                <div style={{color:'var(--text-sub)',fontSize:11,marginBottom:8}}>
                  构型需求：{t.req}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {t.cards.map((c,i) => (
                    <div key={c.name} style={{
                      padding:'4px 8px',background:'var(--bg-panel3)',
                      borderRadius:4,borderLeft:`3px solid ${i===0?'#e0c080':'#303060'}`,
                      fontSize:11
                    }}>
                      <span style={{color:i===0?'var(--text-gold)':'var(--text-primary)',fontWeight:'bold'}}>
                        {c.name}
                      </span>
                      <span style={{color:'#e0c080',marginLeft:8}}>⚡{c.cost}</span>
                      {i===0 && <span style={{color:'#c08060',fontSize:10,marginLeft:4}}>(升级即得)</span>}
                      <div style={{color:'var(--text-sub)',marginTop:1}}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
export default TechTreePanel;
