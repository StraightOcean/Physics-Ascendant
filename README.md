<p align="center">
  <img src="art/logo.png" alt="Physics Ascendant" width="120" onerror="this.style.display='none'" />
</p>

<h1 align="center">Physics Ascendant</h1>
<h3 align="center">《物理法则之下：科技死斗》</h3>

<p align="center">
  <b>一款以现代物理学为背景的数字桌面卡牌策略游戏</b><br/>
  从夸克到弦论——在 3×3 实验场中部署粒子、攀爬科技树、湮灭对手
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blueviolet" alt="version" />
  <img src="https://img.shields.io/badge/tests-121%20passed-brightgreen" alt="tests" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="platform" />
</p>

---

## 游戏简介

《物理法则之下：科技死斗》融合了**粒子物理**与**策略卡牌**的核心乐趣。2-4 名玩家（或与 AI 对战）在自己的 3×3 实验场面板上部署夸克(Q)、电子(E)、质子(P)及其反粒子，通过卡牌操控粒子运动、干涉对手实验场、攀爬从经典力学到弦论的六层科技树——最终成为唯一的"终极造物主"。

### 核心数字

| 维度 | 数据 |
|:---|---|
| 卡牌总数 | 96 张（60 基础 + 36 科技放逐，每次对局可用不同组合） |
| 粒子类型 | Q / E / P / Ā / Ē / P̄ 共 6 种 |
| 科技等级 | 0 → 6 级（经典力学 → 弦论终极） |
| 宇宙骰子 | 6 种全局事件，第 4 回合起触发 |
| 支持模式 | 单机 AI / 局域网联机 / Cloudflare 远程中继 |

---

## 游戏特性

### 策略深度
- **回合制 + 实时决策**：补给阶段自动获取资源，主要行动自由选择升级或打出任意数量卡牌
- **粒子操控**：推力、引力拉扯、库仑斥力、量子隧穿——每张卡都是物理学概念的战术化表达
- **正反物质湮灭**：相邻正反粒子对在回合末湮灭，降低熵值；是风险也是机遇
- **虚空零点能**：突破能量上限积累虚空能量，超过 5 点立即出局——高风险高回报

### 科技树
```
Lv.1  经典力学    — 惯性、动量、杠杆、摩擦
Lv.2  电磁统一    — 法拉第护盾、库仑力、电磁感应
Lv.3  热力学统计  — 麦克斯韦妖、布朗运动、相变
Lv.4  量子力学    — 观测坍缩、叠加态、纠缠传输
Lv.5  广义相对论  — 时空弯曲、虫洞、时间膨胀
Lv.6  弦论终极    — 维度打击、膜宇宙碰撞、大统一
```
每次升级获得对应等级的科技卡，并解锁副牌库的抽牌权限。

### AI 对手
- 三位 AI 对手（爱因斯坦、薛定谔、费曼、玻尔、海森堡随机选取）
- 三档难度（简单/中等/困难），启发式局面评估 + 智能参数生成
- AI 会评估升级价值、选择最优卡牌、自动生成符合规则的目标选择

### 对战模式

| 模式 | 技术 | 说明 |
|:---|:---|:---|
| 本地对战 | - | 人类 vs 1-3 个 AI 对手 |
| 局域网联机 | WebSocket | 一人建主机，他人直连 IP |
| 远程联机 | Cloudflare Durable Objects | 通过中继服务器全球联机 |

---

## 技术架构

```
physics-ascendant/
├── packages/
│   ├── engine/          # 核心引擎（状态管理、规则、AI、效果解析）
│   ├── client/           # React 桌面 UI（Vite + Canvas 2D 渲染）
│   ├── cli/              # CLI 终端原型（调试用）
│   └── server/           # WebSocket 局域网服务端
├── cf-worker/            # Cloudflare 远程中继
└── art/                  # 美术资源
```

| 技术 | 用途 |
|:---|:---|
| TypeScript | 全栈类型安全 |
| React 18 + Vite 5 | 桌面 UI |
| Canvas 2D | 实验场棋盘渲染 |
| WebSocket (ws) | 局域网联机 |
| Cloudflare Workers + Durable Objects | 远程中继 |
| Electron 28 | 桌面打包 |
| Jest (121 测试) | 引擎测试覆盖 |

---

## 快速开始

### 环境要求
- Node.js ≥ 18
- npm ≥ 9

### 安装运行

```bash
# 克隆仓库
git clone https://github.com/your-username/physics-ascendant.git
cd physics-ascendant

# 安装依赖
npm install

# 开发模式（客户端 + 服务端同时启动）
npm run dev:all

# 仅启动客户端
npm run dev

# CLI 终端版
npm run cli
```

### 桌面打包

```bash
cd packages/client

# Windows NSIS 安装包
npm run build:electron:win

# 或仅生成免安装目录
npm run build:electron:dir
```

---

## 游戏规则概要

> 完整规则请参阅 [`rule.md`](./rule.md) | 卡牌图鉴 [`Cards.md`](./Cards.md)

1. **设置**：每人 3×3 实验场（中心 B2 初始放置夸克 Q），初始熵值 0、能量 3-5（按人数）
2. **回合流程**：宇宙骰子 → 宇宙熵增 → 补给抽牌 → 主要行动（升级/出牌）→ 湮灭清算 → 回合结束
3. **主要行动**：支付能量打出手牌（任意数量）或支付能量 + 满足粒子构型升级研究所
4. **湮灭清算**：回合末相邻正反粒子对湮灭，净化熵值
5. **胜利条件**：所有其他玩家出局（熵值超限 / 虚空零点能超限）

---

## 项目进度

| 阶段 | 状态 |
|:---|:---:|
| 核心引擎（状态管理、卡牌、规则、AI） | ✅ |
| React 桌面 UI + Canvas 2D 渲染 | ✅ |
| CLI 终端原型 | ✅ |
| 局域网 WebSocket 联机 | ✅ |
| Cloudflare Durable Objects 远程中继 | ✅ |
| AI 对战（三档难度） | ✅ |
| DLC / MOD 扩展系统 | ✅ |
| Electron 桌面打包 | ✅ |
| 音效 / 进阶美术 | 📋 |
| CI/CD | 📋 |

---

## 许可证

MIT License — 详见 [`LICENSE`](./LICENSE)

---

<p align="center">
  <sub>Built with TypeScript · React · Vite · Electron · WebSocket · Cloudflare Workers</sub>
</p>
