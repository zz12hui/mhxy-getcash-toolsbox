# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

梦幻搞钱工具箱 — 微信小程序。当前提供宠环助手（100环召唤兽修炼）和跑环助手（300环任务链）两个工具，后续可扩展更多功能模块（收益统计、物价参考、答题器、传说计时等）。支持跑环记录、积分预测、控分策略、奖励结算、历史统计和多角色数据隔离。纯本地存储，无后端。

## 运行方式

用**微信开发者工具**打开此目录。AppID 选"测试号"即可（`project.config.json` 中 `appid` 已设为 `touristappid`）。基础库版本 2.19.4。

无需构建/安装依赖。直接在开发者工具中编译预览。

## 架构

```
app.js / app.json / app.wxss    # 应用入口、全局配置、全局样式（CSS 变量深色主题）
utils/
  constants.js                   # 游戏数据常量 + 计算公式（任务类型、积分表、奖励档位）
  storage.js                     # wx.setStorageSync 封装，按用户 ID 做 key 命名空间隔离
pages/
  index/                         # 首页 — 可扩展工具箱布局（tool-card 列表 + coming-soon 占位）
  pet/                           # 宠环助手 — 5 个内部 Tab（记录/预测/控分/历史/统计）
  chain/                         # 跑环助手 — 4 个内部 Tab（记录/奖励/历史/统计）
images/                          # 6 张 81×81 的 tabBar 图标（home/pet/chain × active/inactive）
```

### 数据流

1. `app.js` onLaunch 初始化用户系统（`mhxy_users` / `mhxy_active`），迁移旧版全局数据
2. 每个页面 `onShow` 时调用 `loadData()` → 从 storage 读取当前用户的 cfg/cur/prices/runs
3. 调用 `buildXxxData()` 方法将原始数据转换为视图所需格式（**所有显示值在 JS 层预计算，不在 WXML 中调用方法**）
4. 通过 `setData()` 更新视图
5. 修改操作直接写入 `this._cur`（内存中的当前跑环对象）然后 `S.savePetCur()` / `S.saveChainCur()` 持久化
6. 页面间通过 `app.globalData` 共享 activeUser，通过 `wx.switchTab` 切换

### 页面内部状态管理

- 每个页面通过 `tab` 字符串控制当前子 Tab
- 弹窗显隐通过 `showXxxModal` / `showMoreMenu` 等布尔值控制
- 所有弹窗的临时状态（选中的任务类型、价格输入等）放在 `data` 中
- 内存中的当前跑环对象存储在 `this._cur`，不在 data 中

### UI 模式

- **弹窗**：统一使用底部弹出式（`.sheet-overlay` + `.sheet`），圆角 32rpx 顶部 + 滑入动画 + 拖动条指示器（`.sheet-handle`）。轻触遮罩可关闭，内部用 `catchtap="noop"` 阻止冒泡
- **标题栏**：核心操作放 header，次要功能（角色管理、价格设置、放弃跑环）收入 `⋯` 更多菜单（底部弹出）
- **更多菜单**：`showMoreMenu` 控制显隐，点击菜单项关闭自身并打开对应子功能弹窗
- **首页工具箱**：纵向 card 列表 `.tool-grid`，每张卡含图标/标题/描述/标签，底部有 `.coming-soon-grid` 占位区域。新增工具时：app.json 加页面 → tool-grid 加 card → 完成
- **批量填充**：用数字输入框替代滑块，`onBatchStartInput` / `onBatchEndInput` 处理输入

### 触摸目标规范

| 元素 | 最小高度 | CSS 类 |
|------|----------|--------|
| 标准按钮 | 80rpx | `.btn` |
| 小按钮 | 64rpx | `.btn-xs` |
| 标签页 | 80rpx | `.tab` |
| 网格单元 | 68rpx | `.cell` |
| 快速栏芯片 | 72rpx | `.qb-t` |
| 弹窗选项 | 72rpx | `.modal-item` |

### 数据模型

宠环（`_cur`）:
```js
{ id, level, startedAt, rings: [{t, sc, item} × 100], notes, done, doneAt, reward, totalScore, totalExp, totalCost, bookLevel }
```

任务链（`_cur`）:
```js
{ id, level, startedAt, rings: [{t, item} × 300], rewards: {100:[], 200:[], 300:[]}, notes, done, doneAt, totalCost }
```

### WXML 约束（重要）

微信小程序 WXML 表达式解析器**不支持方法调用**。以下写法在 WXML 中无效：
- `{{arr.indexOf(x)}}` — ❌ 不可用
- `{{num.toFixed(0)}}` — ❌ 不可用
- `{{str.join(',')}}` — ❌ 不可用

**解决方案**：在 JS 的 `buildXxxData()` 中预计算好显示值，通过 `setData` 传入。例如：
- chain.js loadData() 中把 `C.CHAIN_TYPES` 映射为带 `costLabel` 的对象数组
- pet.js showSettle() 中把 `bonusOpts` 映射为带 `{label, checked}` 的对象数组
- 用 `{{item.checked}}` 代替 `{{arr.indexOf(item)>-1}}`

WXSS 也不支持 `inset` 简写，需使用 `top/right/bottom/left`。

### Storage key 命名规则

| 前缀 | 用途 |
|------|------|
| `mhxy_users` / `mhxy_active` | 全局用户列表和当前活跃用户 |
| `mhxy_{k}_{uid}` | 宠环数据（cfg/cur/runs/prices） |
| `mhxy3_{k}_{uid}` | 任务链数据（cfg/cur/runs/prices） |

### 页面配置要求

每个页面的 `.json` 必须包含 `"enable-flex": true` 以启用 flexbox 布局（即使 `app.json` 已设置 `"style": "v2"`）。

### 关键模式与约定

- `pages/pet/pet.js` 和 `pages/chain/chain.js` 存在约 200 行相似逻辑（用户管理、导入导出、价格设置），后续可提取共享模块
- chain.js 有 `switchUserById(uid)` 辅助方法，pet.js 应该对齐
- 时钟定时器：`onShow` 创建前需先 `clearInterval`，`onHide` 中清除
- Canvas 使用 `type="2d"` API，查询用 `wx.createSelectorQuery()`
- 颜色值统一通过 `page` 选择器中的 CSS 变量定义，页面内不硬编码颜色
- Toast 位置设为 `bottom: 120rpx` 以避开 iPhone Home Indicator
