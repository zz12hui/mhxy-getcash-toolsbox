# 梦幻搞钱工具箱

微信小程序 — 梦幻西游跑环辅助工具。宠环助手（100 环）+ 跑环助手（300 环）+ 知识库 + 用户系统 + 后台管理。

## 技术栈

- 微信小程序原生开发
- 微信云开发（云函数 + 云数据库）
- 基础库 2.19.4
- AppID: `<YOUR_APPID>`

## 功能模块

### 宠环助手（100 环）
- 逐环记录任务类型和花费
- 积分实时计算与预测：`BookLevel = round10(totalScore + floor(level/3) - 130)`
- 控分策略辅助（PPR 每环所需平均分计算）
- 历史记录与统计分析

### 跑环助手（300 环）
- 任务记录与分段检查（每 100 环触发奖励记录）
- 奖励区间动态计算
- 历史记录与统计

### 知识库
- 4 分类 FAQ（宠环技巧、跑环攻略、物价参考、常见问题）
- 分类 Tab + 搜索
- 离线缓存（1h TTL）

### 用户系统
- 本地用户系统（多角色数据隔离，按用户 ID 存储 key）
- 微信登录（可选，支持云端备份 syncUpload/syncDownload）
- 管理员白名单机制

### 后台管理
- 数据看板
- FAQ 分类+条目 CRUD
- 用户和反馈管理

## 项目结构

```
app.js / app.json / app.wxss     # 应用入口、云开发初始化、全局样式
custom-tab-bar/                   # 自定义 TabBar 组件（首页 | 当前工具 | 我的）
utils/
  constants.js                    # 游戏常量 + 计算公式
  storage.js                      # 本地存储封装（按用户 ID 隔离）
  cloud.js                        # 云开发 API 封装
  faq-cache.js                    # FAQ 本地缓存
cloudfunctions/                   # 11 个云函数
pages/
  index/                          # 首页（工具卡片 + 入口）
  pet/                            # 宠环助手（记录/预测/控分/历史/统计）
  chain/                          # 跑环助手（记录/奖励/历史/统计）
  profile/                        # 个人中心（登录/云同步/角色管理/反馈/后台入口）
  faq/                            # 知识库列表
  faq-detail/                     # 知识库详情
  login/                          # 微信登录/手机绑定
  feedback/                       # 意见反馈
  admin/                          # 后台管理
admin/                            # PC 后台管理 React 项目（备用）
```

## 云数据库集合

| 集合 | 用途 |
|------|------|
| `faq_categories` | FAQ 分类 |
| `faq_items` | FAQ 条目 |
| `users` | 微信登录用户 |
| `user_sync_data` | 用户云端备份数据 |
| `feedbacks` | 用户反馈 |
| `admins` | 管理员白名单 |

## 本地开发

使用微信开发者工具导入项目，云环境: `<YOUR_CLOUD_ENV>`。

## License

MIT
