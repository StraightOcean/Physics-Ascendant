# Physics Ascendant — MOD 开放 API 文档

> 引擎版本：**0.2.0** | 最后更新：2026-06-27

---

## 一、概述

Physics Ascendant 支持**纯 JSON MOD 扩展**。玩家无需修改引擎源码，只需将 `.json` 文件放入 `mods/` 目录即可扩展游戏。

### 安全策略

- **仅接受 `.json` 文件**——不执行任何 TypeScript/JavaScript 代码
- **所有效果必须使用引擎内置 32 种效果类型**
- MOD 卡牌通过 JSON 声明式定义，由引擎解析执行

### MOD 存放位置

```
packages/client/public/mods/
├── manifest.json              ← MOD 文件清单
├── sample-mod.json            ← 示例 MOD
└── neutron-star.mod.json      ← 中子星 MOD
```

### 加载顺序（重要！）

`loadMod()` **必须先于** `initGame()` 调用，因为牌库只在 `initGame` 时创建一次。
中途加载的 MOD 不会刷新已构建的牌库，**仅在开局前有效**。

---

## 二、快速开始

### 2.1 创建 MOD 文件

在 `mods/` 目录下创建一个 `.json` 文件：

```json
{
  "id": "my-first-mod",
  "name": "我的第一个 MOD",
  "version": "1.0.0",
  "engineVersion": "0.2.0",
  "author": "MOD 作者",
  "description": "一个简单的 MOD 示例",
  "cards": [
    {
      "id": "my_custom_card",
      "name": "自定义卡牌",
      "type": "攻击",
      "cost": 3,
      "level": 0,
      "isUpgradeReward": false,
      "description": "对对手造成熵增打击。",
      "quantity": 2,
      "effects": [
        { "type": "gain_entropy", "target": "opponent", "amount": 2 }
      ]
    }
  ]
}
```

### 2.2 注册 MOD 文件

在 `manifest.json` 中添加文件名：

```json
["sample-mod.json", "neutron-star.mod.json", "my-first-mod.json"]
```

### 2.3 启用 MOD

打开游戏 → 主菜单点击「🧩 MOD」→ 找到你的 MOD → 点击「启用」。

---

## 三、完整类型参考

### 3.1 ModPackage（MOD 包）

```json
{
  "id": "string",              // 必填：MOD 唯一标识
  "name": "string",            // 必填：MOD 显示名称
  "version": "string",         // 版本号
  "engineVersion": "string",   // 兼容引擎版本（主版本必须匹配；如 "0.2.0"）
  "author": "string",          // 作者
  "description": "string",     // 描述
  "cards": [ ModCardDef ],     // 必填：卡牌列表
  "effectTypes": [ ModEffectTypeDef ],  // 可选：自定义效果类型声明
  "cosmicEvents": [ ModCosmicEventDef ], // 可选：宇宙事件
  "upgrades": [ ModUpgradeDef ]  // 可选：升级等级
}
```

### 3.2 ModCardDef（MOD 卡牌）

```json
{
  "id": "string",                 // 必填：卡牌唯一 ID（建议加前缀避免冲突）
  "name": "string",               // 必填：卡牌名称
  "type": "string",               // 必填：卡牌类型（见下表）
  "cost": 3,                      // 必填：能量消耗
  "level": 0,                     // 0=基础卡, 1-6=科技卡
  "isUpgradeReward": false,       // 是否为升级即得卡
  "description": "string",        // 必填：卡牌效果说明
  "quantity": 2,                  // 必填：牌库中数量
  "effects": [ CardEffect ],      // 必填：效果数组（原子指令）
  "addToMainDeck": false,         // 🆕 可选：true=加入主牌库
  "addToTechDeckLevel": 0         // 可选：1-6=添加到指定科技等级牌库
}
```

### 3.3 卡牌类型枚举

| 值 | 中文 | 说明 |
|----|------|------|
| `"资源"` | 资源 | 产生能量或虚空能 |
| `"部署"` | 部署 | 生成粒子 |
| `"位移"` | 位移 | 移动粒子 |
| `"攻击"` | 攻击 | 增加对手熵值 |
| `"干扰"` | 干扰 | 影响对手布局 |
| `"防御"` | 防御 | 护盾或减熵 |
| `"清场"` | 清场 | 大范围清理 |
| `"特殊"` | 特殊 | 转换或合并 |
| `"自伤"` | 自伤 | 以自身为代价 |
| `"科技"` | 科技 | 科技升级卡 |

---

## 四、效果类型参考（32 种）✨ v0.2.0 完整列表

引擎当前支持 **32 种** 卡牌效果（`CardAtomicEffect` union type）。
本节按职责分组列出每种效果的参数 schema 与示例。

### 4.1 能量与熵值

| 效果 | 参数 | 示例 |
|------|------|------|
| `gain_energy` | `amount`（能量值），`canExceedCap`（可选，突破上限） | `{ "type": "gain_energy", "amount": 3 }` |
| `gain_entropy` | `target`（"self"/"opponent"/"all_others"/"all"），`amount` | `{ "type": "gain_entropy", "target": "opponent", "amount": 2 }` |
| `reduce_entropy` | `amount` | `{ "type": "reduce_entropy", "amount": 3 }` |
| `increase_max_entropy` | `amount` | `{ "type": "increase_max_entropy", "amount": 2 }` |
| `transfer_entropy` | `amount`（转移点数），`compensateEnergy` | 从自身转移熵值给对手 |

### 4.2 护盾与抽牌

| 效果 | 参数 | 示例 |
|------|------|------|
| `gain_shield` | `amount` | `{ "type": "gain_shield", "amount": 3 }` |
| `draw_cards` | `source`（"main"/"tech"），`count`，`level`（科技库时指定） | `{ "type": "draw_cards", "source": "main", "count": 2 }` |
| `discard_cards` | `count`，`highestTechOnly`（可选） | `{ "type": "discard_cards", "count": 2, "highestTechOnly": true }` |
| `steal_card` | `from`，`count`，`random`（可选） | `{ "type": "steal_card", "from": "opponent", "count": 1 }` |
| `shuffle_hand` | `keepTech`，`drawCount` | `{ "type": "shuffle_hand", "keepTech": true, "drawCount": 5 }` |

### 4.3 粒子操作

| 效果 | 参数 | 示例 |
|------|------|------|
| `spawn_particle` | `player`，`pos`（"empty_slot" 或坐标），`particle`（"Q"/"E"/"P" 或 "choose_q_or_e"） | `{ "type": "spawn_particle", "player": "self", "pos": "empty_slot", "particle": "Q" }` |
| `remove_particle` | `player`（"self"/"opponent"/"all"），`pos`，`entropyPenalty`（可选），`energyReward`（可选） | `{ "type": "remove_particle", "player": "self", "pos": {"row":0,"col":0}, "energyReward": 2 }` |
| `transform_particle` | `player`，`pos`，`from`（"any_regular"），`to`（"its_antimatter"/"choose"） | `{ "type": "transform_particle", "player": "opponent", "pos": {"row":0,"col":0}, "from": "any_regular", "to": "its_antimatter" }` |
| `merge_particles` | `player`，`from`（粒子类型），`to`（目标类型），`requireAdjacent`（可选） | `{ "type": "merge_particles", "player": "self", "from": "Q", "to": "P", "requireAdjacent": true }` |

### 4.4 粒子移动

| 效果 | 参数 | 示例 |
|------|------|------|
| `move_particle` | `player`，`from`，`direction`（"up"/"down"/"left"/"right"），`steps` | `{ "type": "move_particle", "player": "self", "from": {"row":0,"col":0}, "direction": "right", "steps": 1 }` |
| `diagonal_move` | `player`，`from`，`direction`（"up-left"/"up-right"/"down-left"/"down-right"） | `{ "type": "diagonal_move", "player": "self", "from": {"row":0,"col":0}, "direction": "up-left" }` |
| `push_particle` | `player`，`origin`，`direction`，`dealDamageOnCollision`（可选） | `{ "type": "push_particle", "player": "opponent", "origin": {"row":0,"col":0}, "direction": "up" }` |
| `pull_particle` | `player`，`target`，`direction` | `{ "type": "pull_particle", "player": "opponent", "target": {"row":2,"col":2}, "direction": "down" }` |
| `swap_particles` | `player`，`p1`，`p2` | `{ "type": "swap_particles", "player": "self", "p1": {"row":0,"col":0}, "p2": {"row":2,"col":2} }` |

### 4.5 控制与特殊 🆕 v0.2.0 补全

| 效果 | 参数 | 说明 | 内置卡牌 |
|------|------|------|----------|
| `skip_turn` | `target` | 跳过指定玩家下一回合 | 时间膨胀 |
| `extra_main_action` | — | 获得额外主要行动 | 多重宇宙分裂 |
| `direct_upgrade` | `targetLevel`，`cost`，`entropyPenalty` | 直接升级（大统一理论） | 大统一理论 |
| `conditional` | `condition`，`then`，`else` | 条件分支 | 观测坍缩 |
| `lock_particle` 🆕 | `player: "opponent"`，`pos` | 锁定对手一个粒子（下回合不可移动） | 摩擦力矩 |
| `random_move_particle` 🆕 | `player`（"self"/"opponent"） | 随机移动一个粒子 | 动量守恒 |
| `extra_turn` 🆕 | — | 标记获得额外回合 | 多重宇宙分裂 |
| `board_permute` 🆕 | — | 棋盘置换（2人颠倒/4人逆时针） | 时空弯曲 |
| `shuffle_particles` 🆕 | `player: "all"` | 打乱所有存活玩家棋盘 | 布朗运动 |
| `rearrange_lab` 🆕 | — | 标记 UI 重排（卡拉比-丘流形） | 卡拉比-丘流形 |
| `cosmic_expansion` 🆕 | — | 标记宇宙膨胀（实际由 CosmicDie 处理） | （备用） |
| `quantum_fluctuation` 🆕 | — | 标记量子涨落（实际由 CosmicDie 处理） | （备用） |
| `placeholder` 🆕 | `cardId` | 占位效果（无实际行为，仅 log） | （MOD 临时卡） |

> **注**: `cosmic_expansion` / `quantum_fluctuation` / `placeholder` 主要由引擎内部使用，MOD 一般不需要直接声明。

---

## 五、完整 MOD 示例

```json
{
  "id": "quantum-resonance",
  "name": "量子共振",
  "version": "1.0.0",
  "engineVersion": "0.2.0",
  "author": "Physics Ascendant Community",
  "description": "添加 3 张量子主题科技卡牌",
  "cards": [
    {
      "id": "qr_resonance_blast",
      "name": "共振爆发",
      "type": "科技",
      "cost": 4,
      "level": 4,
      "isUpgradeReward": false,
      "description": "移除己方1个粒子（能量+2），对手熵值+1。",
      "quantity": 2,
      "effects": [
        { "type": "remove_particle", "player": "self", "pos": { "row": 0, "col": 0 }, "energyReward": 2 },
        { "type": "gain_entropy", "target": "opponent", "amount": 1 }
      ]
    },
    {
      "id": "qr_wave_collapse",
      "name": "波函数坍缩",
      "type": "科技",
      "cost": 5,
      "level": 4,
      "isUpgradeReward": false,
      "description": "所有对手熵值+1，你获得2点护盾。",
      "quantity": 2,
      "effects": [
        { "type": "gain_entropy", "target": "all_others", "amount": 1 },
        { "type": "gain_shield", "amount": 2 }
      ]
    },
    {
      "id": "qr_superposition_drive",
      "name": "叠加态驱动",
      "type": "科技",
      "cost": 6,
      "level": 4,
      "isUpgradeReward": true,
      "description": "【升级即得】在己方空格生成一个Q粒子，并抽取2张牌。",
      "quantity": 1,
      "effects": [
        { "type": "spawn_particle", "player": "self", "pos": "empty_slot", "particle": "Q" },
        { "type": "draw_cards", "source": "main", "count": 2 }
      ]
    }
  ]
}
```

### 5.1 加入主牌库的 MOD 卡 🆕

```json
{
  "id": "extras-pack",
  "name": "扩展包",
  "engineVersion": "0.2.0",
  "cards": [
    {
      "id": "extra_energy",
      "name": "额外能量",
      "type": "资源",
      "cost": 0,
      "level": 0,
      "quantity": 4,
      "addToMainDeck": true,
      "effects": [
        { "type": "gain_energy", "amount": 1 }
      ]
    }
  ]
}
```

`addToMainDeck: true` 表示此卡会进入主牌库；`addToTechDeckLevel: 1-6` 表示进入对应等级科技牌库。

---

## 六、MOD 管理

### 6.1 启用 MOD

1. 将 `.json` 文件放入 `mods/` 目录
2. 在 `mods/manifest.json` 中添加文件名
3. 启动游戏 → 主菜单「🧩 MOD」→ 找到 MOD → 点击「启用」

### 6.2 卸载 MOD

在 MOD 管理面板点击「卸载」。`unloadMod()` 会同时清理该 MOD 注册的所有 effect handler。

### 6.3 版本检查

引擎的 MOD 版本检查规则：
- 主版本号必须匹配（如 `0.x.x` 匹配 `0.y.y`）
- 次版本号不可超过引擎当前版本（MOD `0.2.5` 可在 `0.2.0` 引擎上加载，反之不行）

### 6.4 加载时机 ⚠️

`loadMod()` **必须先于** `initGame()` 调用。中途加载的 MOD 不会刷新已构建的牌库。

### 6.5 加载结果

`loadMod()` 返回 `ModLoadResult`：
- `success: boolean` — 是否成功
- `cardsLoaded / effectTypesLoaded / cosmicEventsLoaded / upgradesLoaded` — 各类型加载数
- `errors: string[]` — 错误（导致 `success=false`）
- `warnings: string[]` — 警告（不阻塞，例如自定义 effect handler 未注册）

---

## 七、安全说明

| 规则 | 说明 |
|------|------|
| 仅 `.json` | 拒绝 `.ts`、`.js` 等可执行文件 |
| 纯数据 | 效果仅可使用引擎内置 **32 种**类型 |
| 无代码执行 | `JSON.parse()` 验证，不执行任何脚本 |
| manifest 白名单 | 仅加载 `manifest.json` 中列出的文件 |
| 仅开局前生效 | 牌库创建后加载的 MOD 不影响已开局游戏 |

---

## 八、与引擎版本对齐

| 引擎版本 | 效果类型数 | 文档章节 |
|----------|------------|----------|
| 0.1.0 | 32 种（实际）但文档仅列 23 种 | — |
| **0.2.0** | **32 种** | **本文档（完整）** |

> **历史**: 早期版本文档将效果类型数误标为"27 种"，实际 union type 一直包含 32 种。v0.2.0 起文档与代码完全对齐。
