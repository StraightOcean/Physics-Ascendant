# Physics Ascendant v2.0.0 — 《物理法则之下：科技死斗》

> 从夸克到弦论——一款以现代物理学为背景的数字桌面策略卡牌游戏

---

## 更新日志

### 游戏机制
- ✅ 完整 6 阶段回合系统（宇宙骰子 / 熵增 / 补给 / 行动 / 湮灭 / 结末）
- ✅ 46 种卡牌全部效果实现（10 基础 + 36 科技，涵盖 6 个科技等级）
- ✅ 正反物质湮灭机制（Q↔Ā, E↔Ē, P↔P̄）
- ✅ 虚空零点能系统（突破能量上限的代价，超 5 出局）
- ✅ 宇宙骰子 6 种全局事件（第 4 回合起）

### AI 对手
- ✅ 三档难度 AI（简单 / 中等 / 困难）
- ✅ 启发式局面评估 + 智能卡牌参数生成
- ✅ 三位经典物理学家命名的 AI 对手
- ✅ AI 自我保护机制：超时保护、连续失败兜底、备选出牌

### 对战模式
- ✅ 本地单机（人类 vs AI）
- ✅ 局域网 WebSocket 联机（默认端口 3456，支持自定义）
- ✅ Cloudflare Durable Objects 远程中继（`physics-relay.xzy7885356.workers.dev`）

### UI / UX
- ✅ React 18 + Vite 5 桌面 UI
- ✅ Canvas 2D 实验场棋盘渲染（3×3 / 5×5 动态切换）
- ✅ 暗色 / 浅色双主题（CSS 变量驱动）
- ✅ 回合过渡动画 + AI 行动实时提示
- ✅ 卡牌直选出牌（棋盘选格 + 方向/粒子选择工具栏）
- ✅ 卡牌百科 + 科技树 + 宇宙骰子事件表面板
- ✅ 操作日志实时滚动

### 工程架构
- ✅ TypeScript Monorepo（engine / client / cli / server / cf-worker）
- ✅ 引擎模块化（EffectResolver 按资源/粒子/手牌/特殊 拆分 handler）
- ✅ DLC / MOD 扩展系统（EffectRegistry + ModManager + JSON 驱动包）
- ✅ 121 项 Jest 单元测试
- ✅ Electron 28 桌面打包（Windows NSIS / portable）

### v2.0.0 修复（2026-06-27 ~ 2026-06-28）
- 🔧 修复 AI 回合双推进 BUG（每轮跳过一半 AI 对手）
- 🔧 修复 `endTurn` 未触发 AI 回合（人类→AI 过渡断裂）
- 🔧 修复 AI 卡牌效果参数系统性错误（涉及 ~15 张卡的 fromPos/targetPos/p1p2/粒子类型）
- 🔧 AI 防御性加固（try-catch、45s 超时、失败黑名单、全链路日志）
- 🔧 服务端模块解析修复（`tsx` 路径别名）
- 🔧 服务端自定义端口支持（`--port=N` / `PA_PORT` 环境变量）

---

## 安装方式

### 方式一：下载安装包（推荐）

| 平台 | 文件 |
|:---|---|
| Windows (NSIS) | `Physics Ascendant Setup 2.0.0.exe` |
| Windows (Portable) | `Physics Ascendant 2.0.0.exe` |

### 方式二：npm 运行

```bash
git clone https://github.com/your-username/physics-ascendant.git
cd physics-ascendant
npm install
npm run dev:all
```

---

## 游戏截图

<p align="center">
  <i>（截图占位 — 等待实际游戏画面截图替换）</i>
  <br/>
  <img src="art/screenshot-game.png" alt="游戏主界面" width="80%" onerror="this.style.display='none'" />
</p>

---

## 技术栈

| 层 | 技术 |
|:---|:---|
| 引擎 | TypeScript · 模块化 EffectResolver · Jest 121 测试 |
| UI | React 18 · Vite 5 · Canvas 2D · CSS Variables 双主题 |
| 桌面 | Electron 28 · electron-builder |
| 联机 | WebSocket (ws) · Cloudflare Workers · Durable Objects |
| 扩展 | EffectRegistry · ModManager · JSON 驱动 MOD 包 |

---

## 贡献

欢迎提交 Issue、PR 或自定义 MOD 包。MOD 开发规范参见 `packages/engine/src/dlc/types.ts`。

---

## 许可证

MIT License
