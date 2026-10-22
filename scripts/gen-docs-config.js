#!/usr/bin/env node
/**
 * 生成云函数 docsReport 的本地兜底配置（含 token，文件已 gitignore）
 * 用法：node scripts/gen-docs-config.js
 * 之后重新部署 docsReport 即可；优先级：环境变量 > 本地配置
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SECRETS = path.join(ROOT, '.secrets', 'tencent-docs.json')
const OUT = path.join(ROOT, 'cloudfunctions', 'docsReport', 'config.local.js')

function main() {
  let cfg = {}
  try {
    cfg = JSON.parse(fs.readFileSync(SECRETS, 'utf8'))
  } catch (e) {
    console.error('读不到 .secrets/tencent-docs.json，请先填三元组')
    process.exit(1)
  }
  const clientId = process.env.TENCENT_DOCS_CLIENT_ID || cfg.clientId || ''
  const accessToken = process.env.TENCENT_DOCS_ACCESS_TOKEN || cfg.accessToken || ''
  const openId = process.env.TENCENT_DOCS_OPEN_ID || cfg.openId || ''
  if (!clientId || !accessToken || !openId) {
    console.error('三元组不完整：需要 clientId / accessToken / openId')
    process.exit(1)
  }
  const content = '// 本地兜底配置（gitignore，勿提交）\nmodule.exports = ' + JSON.stringify({
    clientId,
    accessToken,
    openId
  }, null, 2) + '\n'
  fs.writeFileSync(OUT, content, 'utf8')
  console.log('已生成 ' + path.relative(ROOT, OUT) + '（长度 ' + content.length + ' 字节）')
}

main()
