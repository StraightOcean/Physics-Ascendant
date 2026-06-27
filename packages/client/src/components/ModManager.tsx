// ============================================================
// ModManager — MOD 管理面板
// 启动时扫描文件夹，结果存入 localStorage 缓存
// Electron: ipcRenderer 直读文件系统
// 浏览器: /mods/list API 实时扫描
// ============================================================

import React, { useState, useEffect } from 'react';
import { loadMod, unloadMod } from '@engine/mod/ModManager';
import type { ModPackage } from '@engine/mod/types';

interface ModEntry {
  id: string; name: string; version: string; author: string;
  description: string; filename: string; enabled: boolean; cardCount: number;
  source: 'folder' | 'import';
}

interface Props { onClose: () => void; }

const ENABLED_KEY = 'pa_enabled_mods';
const IMPORTED_KEY = 'pa_imported_mods';
const CACHE_KEY = 'pa_mods_cache';
const CACHE_TS_KEY = 'pa_mods_cache_ts';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

const ModManager = React.memo(function ModManager({ onClose }: Props) {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [scanning, setScanning] = useState(true);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => { doScan(); }, []);

  // ---- 扫描 mods 文件夹 ----
  async function doScan(force = false) {
    setScanning(true);
    setScanLog([]);
    const log = (msg: string) => setScanLog(prev => [...prev, msg]);
    const entries: ModEntry[] = [];
    const enabled = JSON.parse(localStorage.getItem(ENABLED_KEY) || '[]');

    // 先读缓存
    if (!force) {
      const cached = readCache();
      if (cached.length > 0) {
        log('从缓存恢复 MOD 列表...');
        for (const e of cached) {
          entries.push(e);
          if (e.enabled) {
            try {
              const pkg = await getModPackage(e);
              if (pkg) loadMod(pkg);
            } catch {}
          }
        }
        log(`缓存恢复完毕：${entries.length} 个 MOD`);
        setMods(entries);
        setScanning(false);
        // 后台扫描是否有新文件
        refreshScan(log, entries, enabled);
        return;
      }
    }

    // 扫描文件夹
    log('正在扫描 mods 文件夹...');
    const filenames = await discoverFiles();

    for (const fn of filenames) {
      log(`发现文件: ${fn}`);
      try {
        const text = await readModFile(fn);
        if (!text) { log(`⚠ 无法读取 ${fn}`); continue; }
        const pkg = validateModJson(text, fn, log);
        if (!pkg) continue;
        entries.push(makeEntry(pkg, fn, 'folder', enabled));
      } catch (e) {
        log(`✕ ${fn}: 读取异常`);
      }
    }

    // localStorage 中导入的 MOD
    addImportedEntries(entries, enabled);

    // 自动加载已启用的
    for (const e of entries) {
      if (e.enabled) {
        try {
          const pkg = await getModPackage(e);
          if (pkg) { const r = loadMod(pkg); if (!r.success) log(`⚠ ${e.name}: ${r.errors?.[0]}`); }
        } catch { log(`⚠ ${e.name}: 加载异常`); }
      }
    }

    // 写入缓存
    writeCache(entries);

    log(`扫描完成：${entries.length} 个 MOD`);
    setMods(entries);
    setScanning(false);
  }

  // 后台增量扫描（已读缓存，检查是否有新文件）
  async function refreshScan(log: (m: string) => void, entries: ModEntry[], enabled: string[]) {
    const filenames = await discoverFiles();
    let changed = false;
    for (const fn of filenames) {
      if (entries.find(e => e.filename === fn && e.source === 'folder')) continue;
      try {
        const text = await readModFile(fn);
        if (!text) continue;
        const pkg = validateModJson(text, fn, log);
        if (!pkg) continue;
        entries.push(makeEntry(pkg, fn, 'folder', enabled));
        changed = true;
      } catch {}
    }
    if (changed) {
      writeCache(entries);
      setMods([...entries]);
    }
  }

  // ---- 文件发现 ----
  async function discoverFiles(): Promise<string[]> {
    // Electron：通过 IPC 直读文件系统
    try {
      const api = (window as any).electronAPI;
      if (api?.scanModsFolder) {
        return await api.scanModsFolder();
      }
    } catch {}
    // 开发模式：/mods/list API
    try {
      const res = await fetch('/mods/list');
      if (res.ok) return await res.json();
    } catch {}
    return [];
  }

  // ---- 缓存 ----
  function readCache(): ModEntry[] {
    try {
      const ts = localStorage.getItem(CACHE_TS_KEY);
      if (ts && Date.now() - Number(ts) > CACHE_TTL) return [];
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function writeCache(entries: ModEntry[]) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  }

  // ---- JSON 校验 ----
  function validateModJson(text: string, fn: string, log: (m: string) => void): ModPackage | null {
    let pkg: any;
    try { pkg = JSON.parse(text); } catch { log(`✕ ${fn}: 不是合法 JSON`); return null; }
    if (!pkg || typeof pkg !== 'object') { log(`✕ ${fn}: 格式错误`); return null; }
    if (!pkg.id || !pkg.name) { log(`✕ ${fn}: 缺少 id/name`); return null; }
    if (!Array.isArray(pkg.cards)) { log(`✕ ${fn}: 缺少 cards 数组`); return null; }
    for (let i = 0; i < pkg.cards.length; i++) {
      const c = pkg.cards[i];
      if (!c.id || !c.name || c.cost === undefined || c.level === undefined) {
        log(`✕ ${fn}: 卡牌 #${i} 缺少字段`);
        return null;
      }
      if (!Array.isArray(c.effects)) {
        log(`✕ ${fn}: 卡牌 "${c.name}" 缺少 effects 数组`);
        return null;
      }
    }
    log(`✓ ${fn}: ${pkg.name} (${pkg.cards.length} 张卡牌)`);
    return pkg as ModPackage;
  }

  function makeEntry(pkg: ModPackage, fn: string, source: 'folder'|'import', enabled: string[]): ModEntry {
    return {
      id: pkg.id, name: pkg.name, version: pkg.version || '1.0.0',
      author: pkg.author || '未知', description: pkg.description || '',
      filename: fn, source,
      enabled: enabled.includes(pkg.id),
      cardCount: pkg.cards?.length || 0,
    };
  }

  function addImportedEntries(entries: ModEntry[], enabled: string[]) {
    try {
      const raw = localStorage.getItem(IMPORTED_KEY) || '[]';
      for (const pkg of JSON.parse(raw)) {
        if (entries.find(e => e.id === pkg.id)) continue;
        entries.push(makeEntry(pkg, '[导入] ' + pkg.id + '.json', 'import', enabled));
      }
    } catch {}
  }

  // ---- 读取 MOD 文件内容 ----
  async function readModFile(filename: string): Promise<string | null> {
    // Electron：IPC 直读文件系统
    try {
      const api = (window as any).electronAPI;
      if (api?.readModFile) return await api.readModFile(filename);
    } catch {}
    // 开发模式：fetch
    try {
      const res = await fetch('/mods/' + filename);
      return res.ok ? res.text() : null;
    } catch {
      return null;
    }
  }

  async function getModPackage(entry: ModEntry): Promise<ModPackage | null> {
    if (entry.source === 'folder') {
      const text = await readModFile(entry.filename);
      return text ? JSON.parse(text) : null;
    }
    const raw = localStorage.getItem(IMPORTED_KEY) || '[]';
    return JSON.parse(raw).find((m: ModPackage) => m.id === entry.id) || null;
  }

  // ---- 导入 ----
  async function handleImportMod() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const pkg = validateModJson(await file.text(), file.name, () => {});
        if (!pkg) { setStatus('❌ 校验失败'); setTimeout(() => setStatus(''), 3000); return; }
        const raw = localStorage.getItem(IMPORTED_KEY) || '[]';
        const imported: ModPackage[] = JSON.parse(raw);
        const idx = imported.findIndex(m => m.id === pkg.id);
        if (idx >= 0) imported[idx] = pkg; else imported.push(pkg);
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
        const ids = JSON.parse(localStorage.getItem(ENABLED_KEY) || '[]');
        if (!ids.includes(pkg.id)) { ids.push(pkg.id); localStorage.setItem(ENABLED_KEY, JSON.stringify(ids)); }
        loadMod(pkg);
        setStatus(`✅ 已导入 ${pkg.name}`);
        doScan(true);
      } catch (e) { setStatus(`❌ ${(e as Error).message}`); }
      setTimeout(() => setStatus(''), 3000);
    };
    input.click();
  }

  // ---- 启用/禁用 ----
  async function toggleMod(entry: ModEntry) {
    const ids = JSON.parse(localStorage.getItem(ENABLED_KEY) || '[]');
    if (entry.enabled) {
      unloadMod(entry.id);
      localStorage.setItem(ENABLED_KEY, JSON.stringify(ids.filter((id: string) => id !== entry.id)));
      setMods(prev => prev.map(m => m.id === entry.id ? { ...m, enabled: false } : m));
    } else {
      const pkg = await getModPackage(entry);
      if (!pkg) { setStatus('❌ 数据丢失'); return; }
      const r = loadMod(pkg);
      if (!r.success) { setStatus(`❌ ${r.errors?.[0]}`); return; }
      ids.push(entry.id);
      localStorage.setItem(ENABLED_KEY, JSON.stringify(ids));
      setMods(prev => prev.map(m => m.id === entry.id ? { ...m, enabled: true } : m));
    }
  }

  function removeImportedMod(entry: ModEntry) {
    if (entry.source !== 'import') return;
    if (entry.enabled) unloadMod(entry.id);
    const raw = localStorage.getItem(IMPORTED_KEY) || '[]';
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(JSON.parse(raw).filter((m: ModPackage) => m.id !== entry.id)));
    localStorage.setItem(ENABLED_KEY, JSON.stringify(JSON.parse(localStorage.getItem(ENABLED_KEY)||'[]').filter((id: string) => id !== entry.id)));
    setMods(prev => prev.filter(m => m.id !== entry.id));
  }

  const C = { bg:'var(--bg-panel)',border:'var(--border-panel)',accent:'var(--border-accent)',text:'var(--text-primary)',sub:'var(--text-sub)',accentText:'var(--text-accent)',gold:'var(--text-gold)' };

  if (scanning) {
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:440,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
          <div style={{textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:40,marginBottom:8}}>🔍</div>
            <h2 style={{color:C.accentText,margin:0,fontSize:18}}>正在扫描 MOD 文件夹</h2>
          </div>
          <div style={{background:'var(--bg-panel3)',borderRadius:8,padding:'10px 14px',maxHeight:240,overflowY:'auto',fontSize:12,fontFamily:'monospace',color:'var(--text-sub)',lineHeight:1.8}}>
            {scanLog.map((line, i) => (
              <div key={i} style={{color:line.startsWith('✓')?'#40a060':line.startsWith('✕')?'#e06060':line.startsWith('⚠')?'#e0a040':'var(--text-sub)'}}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:16,padding:0,width:580,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h2 style={{color:C.accentText,margin:0,fontSize:20}}>🧩 MOD 管理</h2>
            <div style={{color:'var(--text-muted)',fontSize:12,marginTop:4}}>将 .json 放入 mods/ 文件夹自动发现</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>doScan(true)} style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${C.border}`,cursor:'pointer',background:'var(--bg-panel2)',color:'var(--text-sub)',fontSize:12}}>🔄</button>
            <button onClick={handleImportMod} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${C.accent}`,cursor:'pointer',background:'var(--bg-panel2)',color:'var(--text-accent)',fontSize:13}}>📥 导入</button>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:'none',background:'var(--bg-panel3)',color:'var(--text-sub)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
        </div>
        {status && <div style={{margin:'0 24px',padding:'8px 12px',borderRadius:8,fontSize:13,background:status.startsWith('✅')?'rgba(64,160,96,0.15)':'rgba(224,96,96,0.15)',color:status.startsWith('✅')?'#40a060':'#e06060'}}>{status}</div>}
        <div style={{flex:1,overflowY:'auto',padding:'12px 24px'}}>
          {mods.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>
              <div style={{fontSize:40,marginBottom:12}}>📭</div>
              <div>mods/ 文件夹中未发现 MOD</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {mods.map(mod => (
                <div key={mod.id} style={{background:mod.enabled?'var(--bg-selected)':'var(--bg-panel3)',border:`1px solid ${mod.enabled?C.accent:C.border}`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{color:C.accentText,fontWeight:'bold',fontSize:14}}>{mod.name}</span>
                      <span style={{fontSize:10,color:'var(--text-dim)',background:'var(--bg-panel)',padding:'1px 6px',borderRadius:4}}>{mod.source==='import'?'📥 导入':'📁 mods/'}</span>
                      <span style={{fontSize:10,color:'var(--text-dim)',background:'var(--bg-panel)',padding:'1px 6px',borderRadius:4}}>v{mod.version}</span>
                      <span style={{fontSize:10,color:C.gold,background:'var(--bg-panel)',padding:'1px 6px',borderRadius:4}}>{mod.cardCount} 张卡牌</span>
                    </div>
                    <div style={{color:'var(--text-sub)',fontSize:12,lineHeight:1.4}}>{mod.description}</div>
                    {mod.enabled && <div style={{color:'#40a060',fontSize:10,marginTop:4}}>● 已启用</div>}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    {mod.source==='import' && <button onClick={()=>removeImportedMod(mod)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid var(--border-panel)',cursor:'pointer',fontSize:11,background:'transparent',color:'var(--text-dim)'}}>🗑</button>}
                    <button onClick={()=>toggleMod(mod)} style={{padding:'6px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:'bold',whiteSpace:'nowrap',background:mod.enabled?'rgba(224,96,96,0.2)':'rgba(64,160,96,0.2)',color:mod.enabled?'#e06060':'#40a060'}}>
                      {mod.enabled ? '卸载' : '启用'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,fontSize:11,color:'var(--text-dim)',textAlign:'center'}}>
          将 .json 放入 mods/ 文件夹即可自动发现
        </div>
      </div>
    </div>
  );
});
export default ModManager;
