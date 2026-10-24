# Security / 脱敏说明

这个仓库是公开版本，已经对作者自己的运行时标识和密钥做过脱敏。

## 当前提交内容

- 小程序 AppID、云环境 ID、腾讯文档 `client_id`：统一替换为占位符
  - `<YOUR_APPID>`
  - `<YOUR_CLOUD_ENV>`
  - `<TENCENT_DOCS_CLIENT_ID>`
- 仓库内不包含腾讯文档 `access_token` / `client_secret`
- 历史提交同样已重写，旧提交里的上述标识也替换为占位符

## 不会提交的内容

以下文件已在 `.gitignore` 中排除：

- `.secrets/`（腾讯文档 token / client_secret / open_id）
- `cloudfunctions/docsReport/config.local.js`（云函数本地兜底配置）
- `.env`、`.env.*`、`*.pem`、`*.key` 等本地凭据
- `project.private.config.json`（开发者工具私有配置）

## 本地运行

克隆后需要自己填写：

- `project.config.json` → `appid`
- `app.js` → `wx.cloud.init({ env: '你的云环境ID' })`
- 腾讯文档相关环境变量只配在云函数环境变量或本地 `.secrets/`，不要写入仓库

## 如果发现疑似泄露

1. 立即在腾讯文档开放平台 / 云开发控制台重置对应 token 或密钥
2. 不要先删除仓库里的提交；先备份，再用历史重写工具清理
3. 通知维护者检查 Git 历史、CI 日志和构建产物

## 说明

AppID 和云环境 ID 属于小程序运行时标识，本身不是密钥；真正的调用凭证是 access_token、client_secret 等。本次脱敏仍然按“公开仓库不出现作者实际标识”的标准处理。
