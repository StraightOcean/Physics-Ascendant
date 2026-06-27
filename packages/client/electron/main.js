// ============================================================
// Electron 主进程 — Physics Ascendant 桌面版
// ============================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLANSever, stopLANSever } = require('./server');

let mainWindow = null;

function getModsDir() {
  // 生产：exe 同目录下的 mods/ 文件夹
  if (!app.isPackaged) {
    // 开发模式：使用 public/mods/
    return path.join(__dirname, '../../public/mods');
  }
  // 打包后：exe 所在目录下的 mods/
  return path.join(path.dirname(app.getPath('exe')), 'mods');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    minWidth: 900, minHeight: 600,
    title: 'Physics Ascendant - 物理法则之下',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#0f0f1a',
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC：扫描 mods 文件夹
ipcMain.handle('scan-mods-folder', async () => {
  try {
    const dir = getModsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return [];
    }
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
});

// IPC：读取单个 mod 文件内容
ipcMain.handle('read-mod-file', async (_event, filename) => {
  try {
    const filePath = path.join(getModsDir(), filename);
    // 安全检查：防止路径穿越
    if (!filePath.startsWith(getModsDir())) return null;
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

// IPC：启动内嵌局域网服务器
ipcMain.handle('start-lan-server', async (_event, port) => {
  try {
    const p = port || 3456;
    startLANSever(p);
    return { success: true, port: p };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC：停止局域网服务器
ipcMain.handle('stop-lan-server', async () => {
  stopLANSever();
  return { success: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
