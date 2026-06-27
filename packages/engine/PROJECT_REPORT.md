# Physics Ascendant -- 项目综合报告

> 自动生成于 2026-06-27 | 引擎版本 0.2.1 | 扫描全部源文件
>
> 本版本主要变更：C3/M1/M4 MOD 端到端 + H1 服务端 AI 重构 + H2 宇宙膨胀体验优化

---

## 0. 本次更新概览 (v0.2.0 → v0.2.1)

| 维度 | v0.2.0 | v0.2.1 | 变化 |
|------|--------|--------|------|
| EffectResolver.ts | 127 行 (调度器) | 132 行 (+default fallback) | C3 |
| **C3** MOD 处理器 | default 分支仅 log | **查询 EffectRegistry fallback** | MOD 可注册 handler |
| **M1** MOD 主牌库 | 仅科技牌库 | **主牌库也支持 addToMainDeck** | MOD 卡可补充主牌库 |
| **M4** MOD_API.md | 27/23 种 | **32 种（完整）** | 文档与代码对齐 |
| **H1** 服务端 AI | 40 行自实现（双推进 bug） | **executeFullTurn 单行调用** | bug 消除 |
| **H2** 宇宙膨胀 | 1 条 log | **2 条 log 提前警告** | 体验优化 |
| 单元测试 | 90 个 | **90 个** | 不变 |
| 卡牌效果实现 | 100% (30/30) | 100% (30/30) | 不变 |

**v0.2.1 已解决问题清单**

| 级别 | 编号 | 标题 | 状态 |
|------|------|------|------|
| CRITICAL | C3 | MOD 自定义效果无可执行处理器 | ✅ |
| HIGH | H1 | 服务端 AI 回合独立实现（双推进 bug） | ✅ |
| HIGH | H2 | 宇宙膨胀结束延迟处理 | ✅（方案 A） |
| MEDIUM | M1 | MOD 卡牌不自动加入主牌库 | ✅ |
| MEDIUM | M4 | MOD_API.md 文档 27 种 vs 实际 32 种 | ✅ |

---

## 1. 行数统计 (Line Counts per File)

### 引擎核心 (packages/engine/src/)

| 文件 | 行数 | v0.2.0 | 变化 |
|------|------|--------|------|
| state/types.ts | 484 | 484 | — |
| state/GameState.ts | 282 | 282 | — |
| state/CardRequirements.ts | 101 | 101 | — |
| cards/CardRegistry.ts | **736** | 725 | +11 (M1) |
| cards/EffectResolver.ts | **132** | 127 | +5 (C3) |
| cards/handlers/resource.ts | 132 | 132 | — |
| cards/handlers/particle.ts | 308 | 308 | — |
| cards/handlers/hand.ts | 141 | 141 | — |
| cards/handlers/special.ts | 217 | 217 | — |
| cards/handlers/shared.ts | 20 | 20 | — |
| **phases/TurnManager.ts** | **432** | 339 | **+93 (H1 + H2)** |
| phases/CardPlayer.ts | 86 | 86 | — |
| phases/UpgradeHandler.ts | 62 | 62 | — |
| rules/AnnihilationChecker.ts | 88 | 88 | — |
| rules/MoveValidator.ts | 273 | 273 | — |
| rules/UpgradeChecker.ts | 205 | 205 | — |
| **events/CosmicDie.ts** | **266** | 261 | +5 (H2) |
| ai/AIPlayer.ts | 344 | 344 | — |
| ai/Evaluator.ts | 259 | 259 | — |
| legacy/LegacyMechanism.ts | 127 | 127 | — |
| network/NetworkMessages.ts | 60 | 60 | — |
| **mod/ModManager.ts** | **193** | 153 | **+40 (C3 warnings + validateLoaded + engineVersion)** |
| mod/types.ts | 95 | 95 | — |
| registry/EffectRegistry.ts | 55 | 55 | — |
| registry/CosmicEventRegistry.ts | 79 | 79 | — |
| registry/UpgradeRegistry.ts | 75 | 75 | — |
| index.ts | 111 | 111 | — |
| **引擎核心小计** | **5,304** | 5,185 | **+119** |

### 客户端 (packages/client/src/)

(与 v0.2.0 一致：4,254 行)

### CLI 终端 (packages/cli/src/)

(与 v0.2.0 一致：978 行)

### 服务端 & 测试

| 文件 | 行数 | v0.2.0 | 变化 |
|------|------|--------|------|
| **server/src/index.ts** | **395** | 439 | **-44 (H1)** |
| cf-worker/src/index.ts | 81 | 81 | — |
| engine/tests/*.ts | 1,132 | 1,132 | — |

### 文档

| 文件 | 行数 | v0.2.0 | 变化 |
|------|------|--------|------|
| Cards.md | 146 | 146 | — |
| rule.md | 44 | 44 | — |
| **MOD_API.md** | **~300** | 267 | **+33 (M4)** |

---

## 2. 卡牌系统

(与 v0.2.0 相同：46 种卡牌 / 132 张实例 / 32 种效果)

### 2.1 ✨ v0.2.1 新增

- `addToMainDeck` 字段现在生效（MOD 卡可加入主牌库）
- EffectRegistry fallback 机制启用

---

## 3. 效果引擎 (Effect Engine)

### 3.1 入口函数

- `resolveEffects()`: 批量执行 + 去重
- `resolveSingleEffect()`: switch 分发 32 种类型，**default 分支现在查询 EffectRegistry** ✨
- `checkEliminations()`: 出局检查

### 3.2 Handler 模块结构 (v0.2.1)

```
cards/
├── EffectResolver.ts          (132 行, 含 C3 default fallback)
└── handlers/
    ├── resource.ts   (132 行)
    ├── particle.ts   (308 行)
    ├── hand.ts       (141 行)
    ├── special.ts    (217 行)
    └── shared.ts     ( 20 行)
```

---

## 4. 性能优化

### 4.1 scanLab 单次遍历 (v0.2.0 保留)

### 4.2 App.tsx 共享参数配置 (v0.2.0 保留)

### 4.3 完整回合 API (v0.2.1 新增) ✨

**问题 (H1)**: 服务端 `executeAITurn` 之前是 40 行手写拼装，且自实现 `state.turn++; currentPlayerIndex++` 与 `executeTurnEndPhases` 内部推进逻辑重复，存在双推进风险。

**方案**: 在 `TurnManager.ts` 新增 `executeFullTurn(state, options)` 封装「auto 阶段 + AI 决策 + 弃牌 + end」完整流程。

**API**:

```typescript
export function executeFullTurn(
  state: GameState,
  options?: {
    autoPlay?: (state: GameState) => AIDecision;  // 阶段 3 决策
    difficulty?: AIDifficulty;
  }
): { eliminated: string[] };
```

**服务端调用示例**:

```typescript
// 之前: 40 行手写
function executeAITurn(roomId: string) { ... }

// 之后: 3 行
function executeAITurn(roomId: string) {
  executeFullTurn(state, {
    autoPlay: (s) => aiDecideMainAction(s, AIDifficulty.MEDIUM),
  });
  checkAndProcessLegacies(state);
  if (state.gameOver) { ... } else { advanceToNext(roomId); }
}
```

---

## 5. 网络架构对比

(与 v0.2.0 相同)

---

## 6. UI 组件详情 (15个)

(与 v0.2.0 相同)

---

## 7. Hooks 详情

(与 v0.2.0 相同)

---

## 8. MOD 系统状态 ✨ v0.2.1 改进

| 功能 | v0.2.0 | v0.2.1 | 变化 |
|------|--------|--------|------|
| JSON MOD 加载/卸载 | 完整 | 完整 | — |
| 安全模式 (仅JSON) | 完整 | 完整 | — |
| 内置效果类型复用 | 32 种 | 32 种 | — |
| **EffectRegistry 集成** | **无** | **✨ default 分支 fallback** | **C3** |
| **MOD 加载结果 warnings** | **无** | **✨ 字段 + handler 校验** | **C3** |
| **主牌库支持 addToMainDeck** | **❌** | **✨ 完整** | **M1** |
| 客户端 UI 管理面板 | 完整 | 完整 | — |
| **MOD_API.md 文档** | 27/23 种 | **✨ 32 种（完整）** | **M4** |
| **loadMod 时机说明** | 隐式 | **✨ 显式"开局前生效"** | **M1** |

**加载顺序** (M1 修复):
```
1. 加载所有 MOD（loadMod）
2. initGame（创建牌库，会扫描所有已注册 MOD 卡）
3. 游戏中：loadMod 不会刷新已构建的牌库
```

---

## 9. 测试覆盖

(与 v0.2.0 相同：6 文件 / 1,132 行 / 90 测试)

---

## 10. 已知问题

### CRITICAL
- C1: ~~EffectResolver 840 行无直接测试~~ ✅ v0.2.0
- C2: ~~conditional 效果存根~~ ✅ v0.2.0
- C3: ~~MOD 自定义效果无可执行处理器~~ ✅ **v0.2.1**

### HIGH
- H1: ~~服务端 AI 回合独立实现（双推进 bug）~~ ✅ **v0.2.1**
- H2: ~~宇宙膨胀结束延迟处理~~ ✅ **v0.2.1**（方案 A：仅提前警告）
- H3: ~~手牌上限依赖 UI 触发~~ ✅ v0.2.0
- H4: 网络全量 GameState 序列化 (性能开销)

### MEDIUM
- M1: ~~MOD 卡牌不自动加入主牌库~~ ✅ **v0.2.1**
- M2: ~~BoardPermute 4人旋转数组越界~~ ✅ v0.2.0
- M3: ~~App.tsx 网络分支硬编码卡牌 ID 列表~~ ✅ v0.2.0
- M4: ~~MOD_API.md 文档 27 种 vs 实际 32 种~~ ✅ **v0.2.1**
- M5: handler 进一步 OO 重构（建议 v0.3.0+）

### LOW
- L1-L4: (v0.2.0 标记)
- L5: 21 个 pre-existing TS 错误（与本次重构无关，**下一轮做"客户端类型清零"专项**）

---

## 11. 总代码行数汇总

### 按包聚合

| 包/类别 | 文件数 | 总行数 | 占比 | v0.2.0 变化 |
|----------|--------|--------|------|-------------|
| 引擎核心 (engine/src + tests) | 27 | 6,497 | 50.8% | +180 |
| 客户端 (client/src + config) | 24 | 4,331 | 33.9% | — |
| CLI (cli/src/) | 3 | 978 | 7.6% | — |
| 服务端 (server + cf-worker) | 2 | 476 | 3.7% | -44 |
| 文档 (MD) | 4 | ~791 | 6.2% | +50 |
| MOD JSON 示例 | 5 | 348 | 2.7% | — |
| 配置文件 | 14 | 160 | 1.3% | — |

### 总计

| 指标 | v0.2.0 | v0.2.1 | 变化 |
|------|--------|--------|------|
| 源文件总数 | 70 | 70 | — |
| 代码总行数 (TS/TSX/CSS) | 11,266 | 11,402 | +136 |
| 文档总行数 (MD) | 741 | 791 | +50 |
| **测试文件** | **6 / 1,132 / 90** | **6 / 1,132 / 90** | **稳定** |
| **引擎版本** | **0.2.0** | **0.2.1** | **修复版** |

### 包大小比例

```
引擎核心 (6497 行)     50.8%  ← +0.4%
客户端     (4331 行)   33.9%
CLI        ( 978 行)    7.6%
服务端     ( 476 行)    3.7%  ← -0.4% (server 简化)
文档+JSON  (1139 行)    8.9%  ← +0.2%
```

---

## 12. 升级指南 (v0.2.0 → v0.2.1)

### 引擎开发者
- ✅ `executeFullTurn(state, options)` 新 API 可用
- ✅ `registerEffectHandler` 现在会被 `EffectResolver` default 分支消费
- ✅ `ModLoadResult.warnings` 新增字段（向后兼容）

### MOD 开发者
- ✅ JSON 包可声明 `addToMainDeck: true` 让卡进主牌库
- ✅ JSON 包中未注册的 effect handler 会触发 warning 而非静默失败
- ✅ `MOD_API.md` 现在列出全部 32 种 effect 类型
- ⚠️ `loadMod()` **必须先于** `initGame()` 调用

### 客户端开发者
- 无破坏性变更
- ✅ MOD 加载结果可在 UI 中显示 `warnings` 数组

### 服务端开发者
- ✅ 之前手写的 AI 回合流程可替换为 `executeFullTurn(state, { autoPlay })`
- ⚠️ 移除了 `getCardDef` 在 AI 路径的硬编码引用（现在由引擎层处理）

---

## 13. 下一步建议

| 优先级 | 项目 | 预估 |
|--------|------|------|
| P0 | 修复 21 个 pre-existing TS 错误 | ~3h |
| P0 | 联机端到端测试（H1 重构后） | ~2h |
| P1 | M5 handler 进一步 OO 重构 | ~4h |
| P1 | H4 网络 GameState 增量同步 | ~6h |
| P2 | Electron 桌面打包 | ~1d |
| P2 | 音效/美术资源 | ~1d |

---

**引擎版本**: 0.2.1
**上次更新**: 2026-06-27
**已修复问题数**: 5（C3 + H1 + H2 + M1 + M4）
**下一版 (v0.3.0) 重点**: 客户端类型清零 + M5 handler 重构
