#!/usr/bin/env node
/**
 * 腾讯文档 API 连通性测试（用 client_id / access_token / open_id 三元组）
 * 不打印 token、不提交任何密钥。
 *
 * 前置：把三元组填到 .secrets/tencent-docs.json
 *   { "clientId": "...", "accessToken": "...", "openId": "..." }
 *
 * 用法：
 *   node scripts/tencent-docs-api-test.js            创建一张测试在线表格
 *   node scripts/tencent-docs-api-test.js --title=xx  自定义标题
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SECRETS_FILE = path.join(ROOT, '.secrets', 'tencent-docs.json')
const API_BASE = 'https://docs.qq.com'

function loadCfg() {
  let cfg = {}
  try {
    cfg = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'))
  } catch (e) { /* ignore */ }
  return {
    clientId: process.env.TENCENT_DOCS_CLIENT_ID || cfg.clientId || '',
    accessToken: process.env.TENCENT_DOCS_ACCESS_TOKEN || cfg.accessToken || '',
    openId: process.env.TENCENT_DOCS_OPEN_ID || cfg.openId || '',
    title: process.argv.find(a => a.indexOf('--title=') === 0)
      ? process.argv.find(a => a.indexOf('--title=') === 0).slice(8)
      : '梦幻收益报表-测试'
  }
}

async function createSheet(cfg) {
  const body = new URLSearchParams({ type: 'sheet', title: cfg.title })
  const res = await fetch(API_BASE + '/openapi/drive/v2/files', {
    method: 'POST',
    headers: {
      'Access-Token': cfg.accessToken,
      'Client-Id': cfg.clientId,
      'Open-Id': cfg.openId,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch (e) { data = { raw: text } }
  return { status: res.status, data }
}

async function main() {
  const cfg = loadCfg()
  if (!cfg.clientId || !cfg.accessToken || !cfg.openId) {
    console.error('缺少 client_id / access_token / open_id，请先填写 .secrets/tencent-docs.json')
    process.exit(1)
  }
  console.log('正在创建测试在线表格…')
  const { status, data } = await createSheet(cfg)
  if (status !== 200 || !data || data.ret !== 0) {
    console.error('创建失败：HTTP ' + status)
    console.error(JSON.stringify(data, null, 2))
    if (data && data.ret === 37019) console.error('提示：access_token 无效或已过期，去开放平台重新生成后更新 .secrets/tencent-docs.json')
    process.exit(1)
  }
  const info = data.data || {}
  console.log('创建成功：')
  console.log('  标题: ' + (info.title || cfg.title))
  console.log('  文件ID: ' + (info.ID || info.id || '(未返回)'))
  console.log('  链接: ' + (info.url || '(未返回)'))
  console.log('\n下一步：我可以继续用这个 token 写表头/追加测试数据，验证表格写入权限。')
}

main().catch(err => {
  console.error('执行失败：' + (err && err.message ? err.message : err))
  process.exit(1)
})
