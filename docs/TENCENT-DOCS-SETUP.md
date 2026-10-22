# 腾讯文档接入 · 准备与联调

> 关联方案：[PLAN-v1.3.1-tencent-docs-sync.md](PLAN-v1.3.1-tencent-docs-sync.md)
> 状态：已拿到 client_id；待补 access_token / open_id / 回调地址 /（如有）client_secret，然后先做 API 连通性测试。

---

## 1. 后台那三个字段分别是什么

你在开发者后台看到的 `client_id` / `access_token` / `open_id` 是调用 OpenAPI 的**请求头三元组**：

| 字段 | 用途 | 敏感度 |
|---|---|---|
| client_id | 应用标识（请求头 `Client-Id`） | 公开 |
| access_token | 调用凭证（请求头 `Access-Token`） | 敏感，会过期 |
| open_id | 用户标识（请求头 `Open-Id`，与 token 匹配） | 半敏感 |

调用示例（新建在线表格）：

```http
POST /openapi/drive/v2/files
Host: docs.qq.com
Access-Token: <access_token>
Client-Id: <client_id>
Open-Id: <open_id>
Content-Type: application/x-www-form-urlencoded

type=sheet&title=梦幻收益报表
```

### 但「每个用户绑定自己的文档」还需要 OAuth

- 上面这套三元组是**某个账号自己的调用凭证**（大概率是你开发者账号的），用它只能操作你自己的文档，不能代表其他用户。
- 要让每个用户绑定自己的腾讯文档，需要 **OAuth2 授权码流程**：用户在腾讯文档授权页同意 → 回调 `code` → 服务端用 `client_id + client_secret + code` 换该用户的 `access_token + open_id`。
- 所以请再确认一下后台有没有 **client_secret / AppSecret / 应用密钥**（通常在「应用详情 → 凭证管理 / 重置密钥」）。如果确实只有三个字段，说明当前应用是 Token 模式，那就退回 B 路线（每个用户粘贴自己的 token），或者只同步到你自己的文档。

> 你现在的三元组可以**立刻用来做 API 连通测试**（建测试表、写数据），不需要等 OAuth。

---

## 2. 绑定流程（用户侧）

目标：用户点一次「绑定」，之后点「同步」就能把收益报表写进自己的腾讯文档。

```
账本页「绑定腾讯文档」
   ↓
云函数 docsOauthStart 生成 state + 授权链接
   ↓
小程序展示「复制授权链接」
   ↓
用户复制到浏览器打开 → 腾讯文档登录 → 同意授权
   ↓
跳转回调页 https://你的域名/tencent-docs-callback.html?code=...&state=...
   ↓
回调页显示「绑定码(code) + state」，用户复制回小程序
   ↓
小程序调云函数 docsBind(code, state)
   ↓
云函数：校验 state → client_secret + code 换用户 token → 创建/绑定在线表格 → 加密保存
   ↓
账本页显示「已绑定：XX报表」+「同步到腾讯文档」按钮
```

同步时：`docsSync` 读绑定 token → 把「已记账轮次 + 汇总」写进用户表格（按 runId 去重）→ 返回文档链接。

### 回调页已经帮你写好

- 文件：`docs/tencent-docs-callback.html`（纯静态，无任何密钥）
- 你只需要：
  1. 把它放到你的域名下，例如 `https://你的域名/tencent-docs-callback.html`
  2. 在腾讯文档开放平台应用配置里，把它登记为 `redirect_uri`（必须完全一致，含 https 和路径）
  3. 把完整地址发我

> 如果域名不方便放文件，也可以直接用 GitHub Pages 的同一份页面，我这边会配好。

---

## 3. 现在需要你做的 4 件事

1. **把三元组放进 `.secrets/tencent-docs.json`**（模板已更新）：
   ```json
   {
     "clientId": "<TENCENT_DOCS_CLIENT_ID>",
     "accessToken": "后台的 access_token",
     "openId": "后台的 open_id",
     "redirectUri": "https://你的域名/tencent-docs-callback.html",
     "clientSecret": "有就填；没有留空",
     "scope": "all"
   }
   ```
   放好回我「放好了」，我立刻跑 API 测试（建一张测试表，不碰你的正式文档）。
2. **告诉我域名 + 回调路径**，并在开放平台把 `https://域名/tencent-docs-callback.html` 登记为 redirect_uri。
3. **确认后台有没有 client_secret**（有就一并放上面文件；没有就告诉我，我们改方案）。
4. **同意我创建一张测试表格**（标题类似「梦幻收益报表-测试」），联调完可以删。

---

## 4. 本地测试命令

```bash
# 1) 用三元组验证 API：创建一张测试在线表格
node scripts/tencent-docs-api-test.js

# 2) 如果之后拿到 client_secret，再走 OAuth 授权换 token
node scripts/tencent-docs-oauth.js auth
node scripts/tencent-docs-oauth.js exchange "<回调URL或code>"
node scripts/tencent-docs-oauth.js status
```

所有 token/密钥只读 `.secrets/`（已 gitignore），不会打印、不会提交。

---

## 5. 额度和同步策略

- 你现在是 **2000 次/天限免**。按我们的设计：
  - 每个用户绑定：约 2 次调用（换 token + 建表）
  - 每次手动同步：约 1~3 次调用（读表 + 写表）
  - 2000 次/天够几十个用户正常用；**同步做成手动触发**，不做后台自动轮询。
- 如果以后用户量上来，再考虑申请提额/付费；同步失败会提示原因，不会静默失败。

---

## 6. 安全提醒

- `access_token` 会过期（通常 2 小时左右），过期后重新生成即可；**不要贴到聊天里**，只放 `.secrets`。
- `client_secret` 如果存在，更不要发聊天/截图；万一发过，去后台重置。
- 云函数上线后，`client_id` 放环境变量、`client_secret` 放云函数环境变量，用户 token 加密存云数据库，客户端永远拿不到。

---

## 7. 已联调通过（2026-10-22）

用 `.secrets/tencent-docs.json` 里的三元组实测通过：

1. 新建在线表格：`POST /openapi/drive/v2/files`（`type=sheet`）
2. 添加子表：`POST /openapi/sheetbook/v2/{bookID}:batchUpdate`（`addSheet`）→ 返回 `sheetID`
3. 写入数据：`PUT /openapi/sheetbook/v2/{bookID}/values/{sheetID}!A1:H3`，body `{ "values": [[...], [...]] }`
4. 测试文档（已写入表头 + 2 行示例）：`https://docs.qq.com/sheet/DUFhUekJLTUp3R3Vn`

Token 情况：JWT 有效期约 30 天（当前到 2026-11-21），过期后需重新生成；生产环境不能依赖手动换 token。

### 关于「文档归属」

- 当前 token 属于**开发者账号**：用它建的表在开发者账号下，不是每个用户自己的文档。
- 两种产品形态：
  - **A. 开发者账号建表 + 链接可读**：用户打开链接查看 / 另存为到自己的文档（不需要 OAuth，今天可做）；
  - **B. 每个用户自己的文档**：必须走 OAuth（需要 `client_secret` + 回调页），或让用户提供自己的三元组（需验证）。
- 回调页 `docs/tencent-docs-callback.html` 已就绪，域名 `4si.cc` 若能托管静态文件即可用。

---

## 8. 小程序内已接入（A 版：开发者账号建表）

已新增云函数 `docsReport`（已部署到云环境）和账本页按钮「📄 生成腾讯文档报表」：

1. 账本页按当前筛选（角色/工具/周期）整理表头 + 每轮明细 + 汇总；
2. 调云函数 `docsReport` → 建在线表格 → 加子表「收益报表」→ 写入数据 → 设为「链接可读」；
3. 小程序弹窗显示链接，可「复制链接」或「打开腾讯文档」：
   - 使用腾讯文档小程序跳转规范：
     `wx.navigateToMiniProgram({ appId: 'wxd45c635d754dbf59', path: 'pages/detail/detail?url=' + encodeURIComponent(url) })`
   - 半屏 `wx.openEmbeddedMiniProgram` 需在小程序后台「第三方设置 → 半屏小程序管理」申请，暂未接。

### 需要你配置 3 个环境变量（一次性）

微信开发者工具 → 云开发控制台 → 云函数 → `docsReport` → 函数配置 → 环境变量，添加：

| 变量名 | 值 |
|---|---|
| TENCENT_DOCS_CLIENT_ID | `<TENCENT_DOCS_CLIENT_ID>` |
| TENCENT_DOCS_ACCESS_TOKEN | `.secrets/tencent-docs.json` 里的 accessToken（后台那个，别贴聊天） |
| TENCENT_DOCS_OPEN_ID | `.secrets/tencent-docs.json` 里的 openId |

保存后如果调用仍提示缺少变量，重新部署一次云函数（我可以执行）。

### 文档归属（重要）

- **A 版**：文档创建在**开发者账号**下，通过「链接可读」分享给用户；用户可以查看、另存为到自己的腾讯文档。
- **B 版**（每个用户自己的文档）：需要 `client_secret` + 回调页做 OAuth；你后台目前只有三元组，若确认没有 client_secret，就只能先上 A 版。
- Token 是 30 天有效期，过期需重新生成；生产要长期稳定需要 OAuth refresh token。

---

## 9. 云函数端到端已跑通（2026-10-22）

实测链路：账本页点「📄 腾讯文档」→ 云函数 `docsReport` → 创建在线表格 → 加子表 → 写表头/明细/汇总 → 设为链接可读 → 返回链接。

测试生成文档：`https://docs.qq.com/sheet/DUGJKZ1pSSEpsbWRr`

### 环境变量问题与本地兜底

云函数当前**读不到**控制台环境变量（报缺 `TENCENT_DOCS_CLIENT_ID/ACCESS_TOKEN/OPEN_ID`），因此加了一个本地兜底：

```bash
# 从 .secrets/tencent-docs.json 生成云函数本地配置（已 gitignore，不会提交）
node scripts/gen-docs-config.js
# 然后重新部署
cli cloud functions deploy --env <YOUR_CLOUD_ENV> --names docsReport --project . --remote-npm-install
```

优先级：**环境变量 > 本地兜底**。等确认环境变量生效后，删除 `cloudfunctions/docsReport/config.local.js` 并重新部署，即可回到纯环境变量。

> 排查建议：环境变量要配在「云开发控制台 → 云函数 → docsReport → 函数配置 → 环境变量」，注意环境 ID 是 `<YOUR_CLOUD_ENV>`；保存后重新部署一次。配在「本地调试环境变量」里不会生效。

> 2026-10-22 更新：环境变量已修好并验证生效；`cloudfunctions/docsReport/config.local.js` 已删除并重新部署（纯环境变量，3 个文件）。`scripts/gen-docs-config.js` 只作为他人/临时兜底保留，正常情况下不需要再生成。

### 更新已有文档（不再重复生成）

首次点击「腾讯文档」会创建表格，并把 `fileID / sheetID / url` 记录在本机（`mhxy_docs_doc_<uid>`）。之后按钮变成「更新腾讯文档」：
- 云函数收到 `action=update` 时，按原 `fileID/sheetID` 覆盖写入当前全部轮次；
- 如果轮次比上次少，会清理多余的旧行；
- 换手机/清缓存后本地绑定丢失，会重新生成一份新文档；
- 结果弹窗里提供「重新生成新文档」。

### 报表结构（2026-10-22 重设计）

- **单工作表「收益报表」**：总览指标 + 宠环/人环轮次明细分区。
- 总览：统计/已记账/未记账轮次、正收益率、任务成本、点卡成本、总成本、产出、净收益（未扣/扣点卡）、ROI、净收益率、总工时、平均时薪（万两 + 元）、日均/月化收益、目标差距、宠环/人环拆分。
- 轮次明细（20 列）：序号、类型、结算时间、角色、等级、完成/总环、有效工时、任务成本、点卡成本、总成本、产出、净收益（扣点卡）、ROI（扣点卡）、净收益率、时薪（万两/时）、时薪（元/时）、账面净收益、账面 ROI、奖励摘要、备注。
- 计算口径：点卡成本 = 有效工时 × 点卡价 × 金价；ROI = 产出 ÷ 含点卡总成本；时薪 = 净收益 ÷ 有效工时。
- 为什么是单表：腾讯文档 `addSheet` 连续调用会触发 608694 限流，云函数默认 3 秒也容易超时；单表一次写入最稳。后续在云开发控制台把 `docsReport` 超时调到 20 秒后，可再切回多工作表。
