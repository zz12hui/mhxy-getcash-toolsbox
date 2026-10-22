# CLAUDE.md

## 项目概述

梦幻搞钱工具箱 — 微信小程序，梦幻西游跑环记录/预测/统计工具。宠环助手（100 环）+ 跑环助手（300 环）+ 知识库 + 可选微信登录与云备份。微信云开发后端（5 个云函数 + 云数据库），无后台管理端。

基础库 2.24.0，AppID `<YOUR_APPID>`，云环境 `<YOUR_CLOUD_ENV>`（作者自用，他人 fork 需替换）。

## 架构

```
app.js / app.json / app.wxss      应用入口、云开发初始化、全局样式
custom-tab-bar/                    自定义 TabBar（首页 | 当前工具 | 我的）
utils/
  constants.js                     游戏常量 + 公式（纯函数，可 Node 单测）
  storage.js                       本地存储（按 uid 隔离 + exportAllRoles/applyAllRoles）
  cloud.js                         callFunction + FAQ 查询
  faq-cache.js                     FAQ 本地缓存（1h TTL）
  ring-cost.js                     价格/费用计算（0 价生效、显式传参）
  task-usage.js                   常用任务排序
  item-memory.js                  物品名记忆
  undo.js                         UndoStack（最多 10 步）
  ui.js                           震动开关
pages/
  index/                           首页
  pet/                             宠环（记录/预测/控分/历史/统计）
  chain/                           跑环（记录/奖励/历史/统计）
  profile/                         个人中心（账号/备份恢复/角色）
  faq/ + faq-detail/               知识库
  login/                           登录/账号设置（头像/昵称/退出）
  feedback/                        意见反馈
  manual/                          操作手册
  privacy/                         隐私政策与用户协议
cloudfunctions/                    login / syncUpload / syncDownload / submitFeedback / init
tests/                             Node 单测（npm test）
```

### 云函数清单（实际 5 个）

| 函数 | 说明 |
|---|---|
| login | 返回 openid / isAdmin；首次创建 users 记录 |
| syncUpload | 入参 `roles[]`，按角色 + 数据类型分文档写入 `user_sync_data` |
| syncDownload | 返回 `roles[]`（含 pet/chain），客户端整份恢复 |
| submitFeedback | 反馈写入 `feedbacks` |
| init | FAQ 初始化 + 绑定管理员；校验 openid（环境变量 `ADMIN_OPENIDS` 或 `admins` 集合），控制台调用可用 `INIT_SECRET` + `event.secret` |

### 云数据库集合

`faq_categories`、`faq_items`、`users`、`user_sync_data`、`feedbacks`、`admins`。
集合需在云控制台手动创建；FAQ 只读查询（isActive + orderBy）建议加索引。

### Storage key

- `mhxy_users` / `mhxy_active`：角色列表 / 当前角色
- `mhxy_{cfg,cur,runs,prices}_<uid>`：宠环数据；`mhxy3_*`：跑环数据
- `mhxy_wx_profile`：登录信息；`mhxy_last_sync_at`：上次备份时间
- `mhxy_task_usage_{pet,chain}_<uid>`、`mhxy_items_<uid>`、`mhxy_guide_seen_*_<uid>`、`mhxy_vibrate`
- `mhxy_faq_*`：FAQ 缓存

### 关键约定（改代码前必读）

1. **WXML 表达式不支持方法调用**：`indexOf`、`toFixed`、字符串拼接之外的复杂逻辑一律在 JS 里预计算，`setData` 传结果。
2. 每个页面 `.json` 必须带 `"enable-flex": true`；WXSS 不支持 `inset`，用 `top/right/bottom/left`。
3. 费用计算统一走 `utils/ring-cost.js`，**不要**写 `prices[tid] || DEFAULT[tid]`（0 价会被吞）；页面用 `this._prices`（已保存价格）计算，编辑框用 `data.prices`。
4. 记录类操作（记录/编辑/批量/清除/奖励）先 `pushUndo(label)` 再改 `this._cur`，否则不能撤销。
5. 角色数据清理用 `S.clearRoleData(uid)`，不要手写 key 列表。
6. 新增页面：`app.json.pages` + 4 个文件（js/json/wxml/wxss），json 加 `enable-flex`。

### 开发命令

```bash
npm install
npm run lint
npm test

# 以下需要微信开发者工具已扫码登录 + 设置→安全设置→服务端口开启
npm run smoke         # 核心路径冒烟（9 项）
npm run accept        # A+B 功能验收（16 项）
npm run accept:cloud  # 云函数/云数据验收（8 项，需已部署云函数）
```

### 注意事项

- 不要提交 `.claude/`、`node_modules/`、`tests/`、`scripts/`、`docs/` 到小程序包（已在 `.gitignore` / `packOptions.ignore` 排除）。
- 云函数依赖锁定 `wx-server-sdk@3.0.4`。
- 隐私政策/用户协议内容在 `pages/privacy/privacy.wxml`，修改后同步更新 `README` 合规说明。
- 自动化脚本基于 `miniprogram-automator`；该工具版本下 `page.callMethod` 不可用，自动化里改用真实点击 + `page.setData`。
