# 腾讯文档接入 · 准备与密钥约定

> 关联方案：[PLAN-v1.3.1-tencent-docs-sync.md](PLAN-v1.3.1-tencent-docs-sync.md)
> 当前状态：开放平台已注册、开发者权限已开通；走 OAuth 正式绑定路线，等待 AppID / 回调地址 / AppSecret 配置完成。

---

## 1. 安全约定（先看这个）

- ✅ **AppID（client_id）可以发我**，它是公开标识。
- ❌ **AppSecret / access_token / refresh_token 不要贴在聊天里**（会话有日志、截图也可能外泄）。
- ❌ 不要写进代码、不要提交到 git。
- 放在 **`.secrets/tencent-docs.json`**（已在 `.gitignore` 忽略），或环境变量 `TENCENT_DOCS_CLIENT_ID` / `TENCENT_DOCS_CLIENT_SECRET` / `TENCENT_DOCS_REDIRECT_URI`。
- 如果你已经不小心发过 secret/token：去开放平台**重置 AppSecret**、重新生成 token；旧的就当泄露处理。
- 我这边不会打印 secret，也不会把它写进日志/提交记录；`.secrets/` 已加入 `.gitignore`。

---

## 2. 需要你准备/确认的 4 件事

| # | 事项 | 怎么给 |
|---|---|---|
| 1 | **AppID（client_id）** | 直接发我即可 |
| 2 | **AppSecret** | 复制到 `.secrets/tencent-docs.json`（见下方模板），然后跟我说「放好了」 |
| 3 | **回调地址 redirect_uri** | 在腾讯文档开放平台应用配置里登记的那个 HTTPS 地址，发我 |
| 4 | **已获批的权限 scope** | 开放平台应用详情页截图或文字列一下（文档读取 / 文档编辑 / 创建文档 / 表格读写等），以及 API 免费额度 |

### 第 2 项模板

把 `.secrets/tencent-docs.example.json` 复制成 `.secrets/tencent-docs.json`，填好：

```json
{
  "clientId": "你的 AppID",
  "clientSecret": "你的 AppSecret",
  "redirectUri": "https://你的回调地址/tencent-docs-callback",
  "scope": "all"
}
```

---

## 3. 回调地址怎么解决（关键）

腾讯文档 OAuth 授权完成后会跳转到你登记的 `redirect_uri`（带 `code` 参数）。小程序内直接跳 OAuth 受限（web-view 业务域名），所以建议：

**方案 A：有自己的 HTTPS 域名（已备案）**
- 直接把回调地址配成该域名下的页面，最省事。

**方案 B：没有域名 → GitHub Pages 静态回调页（推荐先用这个）**
- 我在仓库里加一个 `docs/tencent-docs-callback.html`，开启 GitHub Pages；
- 回调地址形如 `https://zz12hui.github.io/mhxy-getcash-toolsbox/tencent-docs-callback.html`；
- 页面显示 `code`（复制按钮），用户回小程序粘贴绑定码；
- 你在开放平台应用里把这个 URL 登记为 redirect_uri 即可。

**方案 C：微信云开发静态托管**
- 用云开发默认域名（`*.tcloudbaseapp.com`）托管回调页；
- 需要确认该环境已开通静态托管。

> 你回我一下：**你有没有可用的 HTTPS 域名/回调地址？** 没有的话我按方案 B 先把回调页和 Pages 配好。

---

## 4. 本地 OAuth 联调（你填好密钥后执行）

```bash
# 1) 生成授权链接，浏览器打开并授权
node scripts/tencent-docs-oauth.js auth

# 2) 授权后浏览器地址栏会跳到 redirect_uri?code=...，复制整段 URL 回来
node scripts/tencent-docs-oauth.js exchange "<回调URL或code>"

# 3) 查看本地 token 状态（脱敏显示）
node scripts/tencent-docs-oauth.js status

# 4) token 过期时续期
node scripts/tencent-docs-oauth.js refresh
```

token 会保存到 `.secrets/tencent-docs-token.json`（已忽略），不会进 git。

---

## 5. 联调通过后我继续做

1. 用本地 token 调 OpenAPI：创建一张测试在线表格 → 写入表头 + 两行测试数据 → 返回文档链接（不碰你的正式文件）；
2. 云函数：
   - `docsOauthStart`：生成授权链接/state
   - `docsOauthCallback` / `docsBind`：code 换 token、校验文档、加密保存绑定
   - `docsSync`：把账本数据追加/覆盖到用户自己的表格（按 runId 去重）
   - `docsUnbind`：解绑并删除 token
3. 账本页加「绑定腾讯文档 / 同步」入口 + 同步状态；
4. 隐私政策补充腾讯文档授权信息说明；
5. 验收脚本 + 真机验证（用测试文档）。
