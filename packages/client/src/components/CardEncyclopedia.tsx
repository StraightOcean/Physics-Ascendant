import React, { useState, useEffect } from 'react';
import { getModRegisteredCards } from '@engine/cards/CardRegistry';
import { getLoadedMods } from '@engine/mod/ModManager';

interface Props {
  onClose: () => void;
  playerLevel: number;
}

interface CardInfo {
  name: string; type: string; cost: number; lv: number; desc: string; qty: number; modName?: string;
}

const BASIC: CardInfo[] = [
  {name:'能量汲取',type:'资源',cost:0,lv:0,qty:10,desc:'能量+2。若突破上限，每超1点积累1虚空零点能（>5出局）。'},
  {name:'粒子生成',type:'部署',cost:1,lv:0,qty:8,desc:'在己方一个空格生成1个夸克(Q)或电子(E)，自选。'},
  {name:'推力',type:'位移',cost:1,lv:0,qty:8,desc:'将己方1个粒子沿上下左右移动1格（不可移出场外）。'},
  {name:'熵增脉冲',type:'攻击',cost:2,lv:0,qty:8,desc:'指定1名对手，其熵值+1。'},
  {name:'引力拉扯',type:'干扰',cost:2,lv:0,qty:6,desc:'将对手的1个粒子沿直线拉近己方1格（目标格须为真空，否则无效）。'},
  {name:'能量护盾',type:'防御',cost:1,lv:0,qty:6,desc:'获得1点护盾值，可抵挡1次"熵增脉冲"或"湮灭清算"造成的熵值增加。'},
  {name:'真空衰变',type:'清场',cost:3,lv:0,qty:4,desc:'移除己方场上1个粒子，熵值+1，然后能量+3。'},
  {name:'正反催化',type:'特殊',cost:2,lv:0,qty:4,desc:'将己方场上1个普通粒子(Q/E/P)转变为对应的反粒子(Ā/Ē/P̄)。'},
  {name:'引力弹弓',type:'位移',cost:2,lv:0,qty:3,desc:'将己方1个粒子沿直线推出，若撞到对手粒子双方各+1熵（推出边界仅自己+1）。'},
  {name:'能量过载',type:'自损',cost:0,lv:0,qty:3,desc:'能量+5，但熵值+2。若能量突破上限10，积累虚空零点能，超过5则出局。'},
];

const TECH: Record<number, CardInfo[]> = {
  1:[{name:'引力聚合',type:'科技',cost:2,lv:1,qty:2,desc:'【升级即得】使相邻的两个夸克(Q)合并为一个质子(P)。'},{name:'动量守恒',type:'科技',cost:1,lv:1,qty:2,desc:'对手随机移动一个自己的粒子。能量+1。'},{name:'杠杆原理',type:'科技',cost:2,lv:1,qty:2,desc:'将己方场上相距2格的粒子互换位置。'},{name:'摩擦力矩',type:'科技',cost:2,lv:1,qty:2,desc:'锁定对手一个粒子，该粒子下一回合不可移动。'},{name:'自由落体',type:'科技',cost:1,lv:1,qty:2,desc:'将己方一个粒子向下推出。'},{name:'碰撞恢复',type:'科技',cost:3,lv:1,qty:2,desc:'移除己方2个相邻粒子，能量+4。'},],
  2:[{name:'法拉第护盾',type:'科技',cost:2,lv:2,qty:2,desc:'【升级即得】获得3点护盾，抽取1张牌。'},{name:'库仑斥力',type:'科技',cost:2,lv:2,qty:2,desc:'将对手场上一个粒子推出。'},{name:'电磁感应',type:'科技',cost:3,lv:2,qty:2,desc:'互换对手场上两个相邻粒子位置。'},{name:'磁感线闭合',type:'科技',cost:1,lv:2,qty:2,desc:'互换己方两个粒子位置。'},{name:'静电吸附',type:'科技',cost:2,lv:2,qty:2,desc:'将对手一个普通粒子转化为反粒子。'},{name:'电流冲击',type:'科技',cost:3,lv:2,qty:2,desc:'对手熵值+2，你必须弃掉1张手牌。'},],
  3:[{name:'麦克斯韦妖',type:'科技',cost:3,lv:3,qty:2,desc:'【升级即得】互换己方两个粒子位置，能量+1。'},{name:'布朗运动',type:'科技',cost:4,lv:3,qty:2,desc:'将所有玩家的粒子随机打乱排列（每人粒子留在自己棋盘上）。'},{name:'热传导',type:'科技',cost:3,lv:3,qty:2,desc:'将己方1点熵值转移给对手，对手获得1能量作为补偿。'},{name:'绝热压缩',type:'科技',cost:2,lv:3,qty:2,desc:'移除己方场上2个粒子，获得5能量。'},{name:'熵减机',type:'科技',cost:6,lv:3,qty:2,desc:'己方熵值-1。'},{name:'相变临界',type:'科技',cost:3,lv:3,qty:2,desc:'将己方两个普通粒子转化为反粒子。'},],
  4:[{name:'观测坍缩',type:'科技',cost:4,lv:4,qty:2,desc:'【升级即得】猜对手粒子类型，猜中移除该粒子对方+2熵；猜错自己+1熵。'},{name:'量子隧穿',type:'科技',cost:2,lv:4,qty:2,desc:'互换己方两个粒子位置，获得1点护盾。'},{name:'叠加态',type:'科技',cost:1,lv:4,qty:2,desc:'生成一个粒子（Q/E自选），抽取1张牌。'},{name:'纠缠传输',type:'科技',cost:3,lv:4,qty:2,desc:'互换己方两个相邻粒子并生成一个新粒子。'},{name:'波粒二象性',type:'科技',cost:2,lv:4,qty:2,desc:'己方粒子斜向移动一格。'},{name:'不确定性',type:'科技',cost:1,lv:4,qty:2,desc:'弃掉1张手牌，随机抽取对手1张手牌。'},],
  5:[{name:'时空弯曲',type:'科技',cost:5,lv:5,qty:2,desc:'【升级即得】打乱棋盘：2人颠倒，4人逆时针旋转。'},{name:'引力透镜',type:'科技',cost:3,lv:5,qty:2,desc:'己方粒子斜向移动并抽取1张牌。'},{name:'时间膨胀',type:'科技',cost:4,lv:5,qty:2,desc:'跳过对手的下一个回合。'},{name:'虫洞连接',type:'科技',cost:3,lv:5,qty:2,desc:'互换己方两个对角粒子，能量+2。'},{name:'奇点坍缩',type:'科技',cost:5,lv:5,qty:2,desc:'移除己方1个粒子（能量+2），所有对手+1熵。'},{name:'引力波',type:'科技',cost:4,lv:5,qty:2,desc:'所有对手各+2熵值。'},],
  6:[{name:'维度打击',type:'科技',cost:6,lv:6,qty:2,desc:'【升级即得】对手弃2张最高等级科技牌，+3熵值。'},{name:'膜宇宙碰撞',type:'科技',cost:6,lv:6,qty:2,desc:'所有存活玩家+2熵，各移除场上1个粒子。'},{name:'超弦共振',type:'科技',cost:5,lv:6,qty:2,desc:'手牌洗回牌库，重新抽取5张牌（保留科技卡）。'},{name:'卡拉比-丘流形',type:'科技',cost:4,lv:6,qty:2,desc:'重新排列己方实验场粒子，熵值-1。'},{name:'多重宇宙分裂',type:'科技',cost:7,lv:6,qty:2,desc:'获得一个额外回合（完整回合流程）。'},{name:'大统一理论',type:'科技',cost:8,lv:6,qty:2,desc:'熵值-2，熵值上限+5。'},],
};

const LEVEL_GRADIENT=['#606070','#4caf50','#2196f3','#9c27b0','#ffd700','#f44336','linear-gradient(90deg,#f44336,#ff9800,#ffeb3b,#4caf50,#2196f3,#9c27b0)'];
const LEVEL_BG=['rgba(96,96,112,0.08)','rgba(76,175,80,0.08)','rgba(33,150,243,0.08)','rgba(156,39,176,0.08)','rgba(255,215,0,0.08)','rgba(244,67,54,0.08)','transparent'];

const CardEncyclopedia = React.memo(function CardEncyclopedia({ onClose, playerLevel }: Props) {
  const [activeTab, setActiveTab] = useState<'builtin'|'mod'>('builtin');
  const [modCards, setModCards] = useState<CardInfo[]>([]);

  useEffect(() => {
    // 动态读取已注册的 MOD 卡牌，并按 MOD 分组标注来源
    const mods = getLoadedMods();
    const cards: CardInfo[] = [];
    for (const mod of mods) {
      for (const card of mod.cards) {
        cards.push({
          name: card.name, type: 'MOD', cost: card.cost, lv: card.level,
          desc: card.description, qty: card.quantity,
          modName: mod.name,
        });
      }
    }
    setModCards(cards);
  }, []);

  const builtinCards: (CardInfo&{section:string})[] = [
    ...BASIC.map(c=>({...c,section:'基础现象卡'})),
    ...[1,2,3,4,5,6].flatMap(lv=>TECH[lv].map(c=>({...c,section:`Lv.${lv} ${['','经典力学','电磁统一','热力学统计','量子力学','广义相对论','弦论终极'][lv]}`}))),
  ];

  const displayCards = activeTab === 'builtin' ? builtinCards : modCards;
  const tabLabel = activeTab === 'builtin' ? `内置卡牌 (${builtinCards.length}张)` : `MOD 卡牌 (${modCards.length}张)`;

  const cardStyle = (c: CardInfo) => {
    const lv = Math.min(c.lv, 6);
    const borderColor = typeof LEVEL_GRADIENT[lv] === 'string' ? LEVEL_GRADIENT[lv] : '#c060e0';
    const bg = lv === 6 ? 'rgba(200,100,255,0.06)' : LEVEL_BG[lv];
    return { borderColor, bg };
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1800}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--bg-panel3)',border:'2px solid var(--border-accent)',borderRadius:12,
        padding:'16px 20px',width:'95vw',maxWidth:900,height:'85vh',
        display:'flex',flexDirection:'column',color:'#e0e0e0',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{color:'var(--text-accent)',margin:0,fontSize:22}}>📚 {tabLabel}</h2>
          <div style={{display:'flex',gap:6}}>
            {/* Tab 切换 */}
            <button onClick={()=>setActiveTab('builtin')} style={{
              padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:'bold',
              border:activeTab==='builtin'?'2px solid var(--border-accent)':'1px solid var(--border-panel)',
              background:activeTab==='builtin'?'var(--bg-selected)':'var(--bg-panel2)',
              color:activeTab==='builtin'?'var(--text-accent)':'var(--text-sub)',
            }}>内置卡牌</button>
            <button onClick={()=>setActiveTab('mod')} style={{
              padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:'bold',
              border:activeTab==='mod'?'2px solid #c080ff':'1px solid var(--border-panel)',
              background:activeTab==='mod'?'rgba(192,128,255,0.1)':'var(--bg-panel2)',
              color:activeTab==='mod'?'#c080ff':'var(--text-sub)',
              display:'flex',alignItems:'center',gap:4,
            }}>
              🧩 MOD
              {modCards.length > 0 && <span style={{fontSize:10,background:'rgba(192,128,255,0.2)',padding:'1px 6px',borderRadius:6}}>{modCards.length}</span>}
            </button>
            <button onClick={onClose} style={{padding:'6px 14px',background:'#302020',color:'#e06060',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,marginLeft:8}}>关闭</button>
          </div>
        </div>

        {/* 无 MOD 提示 */}
        {activeTab === 'mod' && modCards.length === 0 && (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',fontSize:14}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>🧩</div>
              <div>暂无已加载的 MOD 卡牌</div>
              <div style={{fontSize:12,marginTop:8}}>在主菜单「MOD」面板中启用 MOD 后即可在此查看</div>
            </div>
          </div>
        )}

        {/* 卡牌列表 */}
        {!(activeTab === 'mod' && modCards.length === 0) && (
          <div style={{flex:1,overflowY:'auto',fontSize:13,lineHeight:1.6}}>
            {activeTab === 'builtin' && displayCards.map((c:any,i) => {
              const {borderColor,bg} = cardStyle(c);
              const lv = Math.min(c.lv,6);
              const rainbowStyle = lv===6?{background:'linear-gradient(135deg,rgba(244,67,54,0.08),rgba(255,152,0,0.08),rgba(255,235,59,0.08),rgba(76,175,80,0.08),rgba(33,150,243,0.08),rgba(156,39,176,0.08))',boxShadow:'inset 0 0 0 1px rgba(200,150,255,0.15)'}:{};
              return(
              <div key={i} style={{padding:'6px 10px',margin:'2px 0',background:bg,borderRadius:4,borderLeft:`3px solid ${borderColor}`,display:'flex',gap:14,alignItems:'flex-start',fontSize:13,...rainbowStyle}}>
                <div style={{flexShrink:0,minWidth:80}}>
                  <span style={{color:'var(--text-primary)',fontWeight:'bold'}}>{c.name}</span>
                  {c.lv>0&&<span style={{color:'var(--text-accent)',marginLeft:4,fontSize:10}}>Lv.{c.lv}</span>}
                </div>
                <div style={{flexShrink:0,width:36,textAlign:'center',color:'#e0c080',fontSize:13}}>⚡{c.cost}</div>
                <div style={{flexShrink:0,width:40,textAlign:'center',color:'var(--text-dim)',fontSize:12}}>×{c.qty}</div>
                <div style={{flex:1,color:'#9090b0',minWidth:0,fontSize:13}}>{c.desc}</div>
              </div>
              );
            })}
            {activeTab === 'mod' && (() => {
              const grouped: Record<string, CardInfo[]> = {};
              for (const c of displayCards) {
                const key = c.modName || '未分类 MOD';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(c);
              }
              const sections = Object.entries(grouped);
              return sections.map(([modName, cards], si) => (
                <div key={si} style={{marginBottom: si < sections.length - 1 ? 16 : 0}}>
                  <div style={{
                    color:'var(--text-accent)',fontSize:14,fontWeight:'bold',
                    padding:'4px 0 8px',borderBottom:'1px solid var(--border-panel)',marginBottom:6,
                  }}>🧩 {modName}</div>
                  {cards.map((c, i) => {
                    const lv = Math.min(c.lv,6);
                    const borderColor = typeof LEVEL_GRADIENT[lv] === 'string' ? LEVEL_GRADIENT[lv] : '#c060e0';
                    const bg = lv === 6 ? 'rgba(200,100,255,0.06)' : LEVEL_BG[lv];
                    const rainbowStyle = lv===6?{background:'linear-gradient(135deg,rgba(244,67,54,0.08),rgba(255,152,0,0.08),rgba(255,235,59,0.08),rgba(76,175,80,0.08),rgba(33,150,243,0.08),rgba(156,39,176,0.08))',boxShadow:'inset 0 0 0 1px rgba(200,150,255,0.15)'}:{};
                    return(
                    <div key={i} style={{padding:'6px 10px',margin:'2px 0',background:bg,borderRadius:4,borderLeft:`3px solid ${borderColor}`,display:'flex',gap:14,alignItems:'flex-start',fontSize:13,...rainbowStyle}}>
                      <div style={{flexShrink:0,minWidth:80}}>
                        <span style={{color:'var(--text-primary)',fontWeight:'bold'}}>{c.name}</span>
                        {c.lv>0&&<span style={{color:'var(--text-accent)',marginLeft:4,fontSize:10}}>Lv.{c.lv}</span>}
                      </div>
                      <div style={{flexShrink:0,width:36,textAlign:'center',color:'#e0c080',fontSize:13}}>⚡{c.cost}</div>
                      <div style={{flexShrink:0,width:40,textAlign:'center',color:'var(--text-dim)',fontSize:12}}>×{c.qty}</div>
                      <div style={{flex:1,color:'#9090b0',minWidth:0,fontSize:13}}>{c.desc}</div>
                    </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
});
export default CardEncyclopedia;
