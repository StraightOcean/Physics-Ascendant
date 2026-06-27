// ============================================================
// 宇宙事件表 — 展示内置 + MOD 注册的所有宇宙骰子事件
// 复用卡牌百科的渲染代码
// ============================================================

import React from 'react';
import { COSMIC_EVENTS } from '@engine/state/types';
import { getAllCosmicEvents } from '@engine/registry/CosmicEventRegistry';

interface Props {
  onClose: () => void;
}

interface EventEntry {
  id: number;
  name: string;
  description: string;
  section: string;
}

const CosmicEventsPanel = React.memo(function CosmicEventsPanel({ onClose }: Props) {
  // 内置事件
  const builtin: EventEntry[] = Object.entries(COSMIC_EVENTS).map(([id, ev]) => ({
    id: Number(id),
    name: ev.name,
    description: ev.description,
    section: '内置事件',
  }));

  // MOD 事件
  const modEvents = getAllCosmicEvents();
  const mods: EventEntry[] = [];
  modEvents.forEach((config, id) => {
    mods.push({
      id,
      name: config.name,
      description: config.description,
      section: 'MOD 事件',
    });
  });

  const allEvents = [...builtin, ...mods];

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1800}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--bg-panel3)',border:'2px solid var(--border-accent)',borderRadius:12,
        padding:'16px 20px',width:'95vw',maxWidth:700,height:'85vh',
        display:'flex',flexDirection:'column',color:'#e0e0e0',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h2 style={{color:'var(--text-accent)',margin:0,fontSize:22}}>🎲 宇宙骰子事件表 ({allEvents.length}个)</h2>
          <button onClick={onClose} style={{padding:'8px 20px',background:'#302020',color:'#e06060',border:'none',borderRadius:6,cursor:'pointer',fontSize:15}}>关闭</button>
        </div>

        <div style={{flex:1,overflowY:'auto',fontSize:13,lineHeight:1.6}}>
          {/* 分组：内置 / MOD */}
          {([{key:'内置事件',label:'📡 内置事件'},{key:'MOD 事件',label:'🧩 MOD 事件'}]).map(({key,label}) => {
            const sectionCards = allEvents.filter(e => e.section === key);
            if (sectionCards.length === 0) return null;
            return (
              <div key={key} style={{marginBottom: 12}}>
                <div style={{
                  color:'var(--text-accent)',fontSize:14,fontWeight:'bold',
                  padding:'4px 0 8px',borderBottom:'1px solid var(--border-panel)',marginBottom:6,
                }}>{label}</div>
                {sectionCards.map(e => (
                  <div key={`${e.section}-${e.id}`} style={{
                    padding:'6px 10px',margin:'2px 0',background:'var(--bg-panel2)',
                    borderRadius:4,borderLeft:'3px solid var(--border-accent)',
                    display:'flex',gap:14,alignItems:'flex-start',
                  }}>
                    <div style={{flexShrink:0,minWidth:28,textAlign:'center',color:'#e0c080',fontWeight:'bold',fontSize:16}}>
                      ⚅{e.id}
                    </div>
                    <div style={{flexShrink:0,minWidth:96}}>
                      <span style={{color:'var(--text-primary)',fontWeight:'bold',fontSize:14}}>{e.name}</span>
                    </div>
                    <div style={{flex:1,color:'#9090b0',minWidth:0,fontSize:13}}>{e.description}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
export default CosmicEventsPanel;
