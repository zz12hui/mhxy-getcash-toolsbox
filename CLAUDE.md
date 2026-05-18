# CLAUDE.md

## 项目概述

梦幻搞钱工具箱 — 微信小程序。宠环助手（100 环）+ 跑环助手（300 环）+ 知识库 + 用户系统 + 后台管理。微信云开发后端（云函数 + 云数据库），可选微信登录，登录后可云端备份数据。

基础库 2.19.4，AppID `<YOUR_APPID>`，云环境 `<YOUR_CLOUD_ENV>`。

## 架构

```
app.js / app.json / app.wxss       # 应用入口、云开发初始化、全局样式
custom-tab-bar/                     # 自定义 TabBar 组件（首页 | 当前工具 | 我的）
utils/
  constants.js                      # 游戏常量 + 计算公式
  storage.js                        # 本地存储封装（按用户 ID 隔离）
  cloud.js                          # 云开发 API 封装（callFunction + 数据库查询）
  faq-cache.js                      # FAQ 本地缓存（1h TTL 离线可用）
cloudfunctions/                     # 11 个云函数（login/getPhone/sync*/submitFeedback/init/admin*）
pages/
  index/                            # 首页 — 工具卡片 + 入口
  pet/                              # 宠环助手（记录/预测/控分/历史/统计）
  chain/                            # 跑环助手（记录/奖励/历史/统计）
  profile/                          # 个人中心（登录/云同步/角色管理/反馈/后台入口）
  faq/                              # 知识库列表（分类 Tab + 搜索）
  faq-detail/                       # 知识库详情（rich-text 渲染）
  login/                            # 微信登录/手机绑定
  feedback/                         # 意见反馈表单
  admin/                            # 后台管理（看板/FAQ CRUD/用户/反馈）
admin/                              # PC 后台管理 React 项目（备用，当前未启用）
```

### 导航结构

- **自定义 TabBar**：首页 | [宠环助手/跑环助手 动态切换] | 我的
- 中间 Tab 根据 `app.globalData.currentToolTab` 动态显示宠环或跑环
- 知识库、登录、反馈、后台管理为非 Tab 页面，通过 `wx.navigateTo` 进入

### 数据流

1. `app.js` onLaunch → 初始化云开发 + 用户系统 + 迁移旧数据 + 加载微信登录状态
2. 每个页面 `onShow` → `loadData()` 从 storage 读取数据 → `buildXxxData()` 预计算显示值 → `setData()`
3. 云数据：小程序通过 `wx.cloud.callFunction()` 调用云函数，FAQ 公开数据直接查云数据库
4. 本地用户系统（`mhxy_users`/`mhxy_active`）保持不变，微信登录是附加层
5. 登录可选，未登录用户体验与 v1.0 完全一致

### 云数据库集合

| 集合 | 用途 | 权限 |
|------|------|------|
| `faq_categories` | FAQ 分类 | 所有用户可读，仅云函数可写 |
| `faq_items` | FAQ 条目（含 contentHtml） | 所有用户可读，仅云函数可写 |
| `users` | 微信登录用户 | 仅创建者可读写 |
| `user_sync_data` | 用户云端备份数据 | 仅创建者可读写 |
| `feedbacks` | 用户反馈 | 所有用户可写 |
| `admins` | 管理员（含 openid 字段做白名单） | 仅云函数可读写 |

### 云函数清单

| 函数 | 用途 | 调用方 |
|------|------|--------|
| `login` | 微信登录，返回 openid + isAdmin | 小程序 callFunction |
| `getPhone` | 手机号解密存储 | 小程序 callFunction |
| `syncUpload` | 备份跑环数据 | 小程序 callFunction |
| `syncDownload` | 恢复跑环数据 | 小程序 callFunction |
| `submitFeedback` | 提交反馈 | 小程序 callFunction |
| `init` | 环境初始化（管理员+示例 FAQ） | 手动调用一次 |
| `adminLogin` | 管理员登录，返回 token | 小程序 callFunction |
| `adminStats` | 数据统计 | 小程序 callFunction |
| `adminUsers` | 用户列表/详情 | 小程序 callFunction |
| `adminFaq` | FAQ 分类+条目 CRUD | 小程序 callFunction |
| `adminFeedback` | 反馈列表+状态更新 | 小程序 callFunction |

### Storage key 清单

| Key | 用途 |
|-----|------|
| `mhxy_users` / `mhxy_active` | 本地用户列表和当前活跃用户 |
| `mhxy_{k}_{uid}` | 宠环数据（cfg/cur/runs/prices） |
| `mhxy3_{k}_{uid}` | 跑环数据（cfg/cur/runs/prices） |
| `mhxy_wx_profile` | 微信登录信息（openid/nickName/avatarUrl/phoneNumber/isAdmin） |
| `mhxy_last_sync_at` | 上次云端同步时间戳 |
| `mhxy_admin_token` | 管理员登录 token（24h 过期） |
| `mhxy_tool_tab` | 当前工具 Tab（'pet'/'chain'） |
| `mhxy_faq_*` | FAQ 本地缓存 |

### 管理员白名单机制

- 管理员通过 `admin`/`admin123` 登录后台 → 云函数将当前微信 openid 写入 `admins` 集合
- 后续微信登录时，`login` 云函数检查 openid 是否在 `admins` 中 → 返回 `isAdmin` 标记
- 仅 `isAdmin=true` 的用户在个人中心看到「后台管理」入口
- 首次使用：开发者先微信登录 → 再进后台管理登录 → openid 自动绑定

### UI 模式

- **弹窗**：统一底部弹出式（`.sheet-overlay` + `.sheet`），圆角 32rpx + 滑入动画 + `.sheet-handle`。遮罩可关闭，内部 `catchtap="noop"` 阻止冒泡
- **自定义 TabBar**：`custom-tab-bar/` 组件，3 项动态显示。`pageLifetimes.show` 自动更新选中状态
- **触摸目标**：标准按钮 ≥80rpx、小按钮 ≥64rpx、标签页 ≥80rpx

### WXML 约束（重要）

WXML 表达式**不支持方法调用**。`{{arr.indexOf(x)}}`、`{{num.toFixed(0)}}` 等均无效。必须在 JS 中预计算，通过 `setData` 传入。
WXSS 不支持 `inset` 简写，需用 `top/right/bottom/left`。每个页面 `.json` 必须包含 `"enable-flex": true`。
