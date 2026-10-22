#!/usr/bin/env node
/**
 * 腾讯文档 OAuth 本地联调脚本（不打印、不提交密钥）
 *
 * 用法：
 *   node scripts/tencent-docs-oauth.js auth      生成授权链接
 *   node scripts/tencent-docs-oauth.js exchange "<回调URL或code>"  用 code 换 token
 *   node scripts/tencent-docs-oauth.js refresh   用 refresh_token 续期
 *   node scripts/tencent-docs-oauth.js status    查看本地 token 状态（脱敏）
 *
 * 配置来源（二选一）：
 *   1) .secrets/tencent-docs.json（已在 .gitignore 中忽略）
 *      { "clientId": "...", "clientSecret": "...", "redirectUri": "...", "scope": "all" }
 *   2) 环境变量 TENCENT_DOCS_CLIENT_ID / TENCENT_DOCS_CLIENT_SECRET / TENCENT_DOCS_REDIRECT_URI
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const SECRETS_FILE = path.join(ROOT, '.secrets', 'tencent-docs.json')
const TOKEN_FILE = path.join(ROOT, '.secrets', 'tencent-docs-token.json')
const AUTH_URL = 'https://docs.qq.com/oauth/v2/authorize'
const TOKEN_URL = 'https://docs.qq.com/oauth/v2/token'

function loadCfg() {
  let fileCfg = {}
  try {
    fileCfg = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'))
  } catch (e) { /* 没有本地配置就用环境变量 */ }
  return {
    clientId: process.env.TENCENT_DOCS_CLIENT_ID || fileCfg.clientId || '',
    clientSecret: process.env.TENCENT_DOCS_CLIENT_SECRET || fileCfg.clientSecret || '',
    redirectUri: process.env.TENCENT_DOCS_REDIRECT_URI || fileCfg.redirectUri || '',
    scope: process.env.TENCENT_DOCS_SCOPE || fileCfg.scope || 'all'
  }
}

function readToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) } catch (e) { return null }
}

function saveToken(data) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8')
  try { fs.chmodSync(TOKEN_FILE, 0o600) } catch (e) { /* Windows 可忽略 */ }
}

function mask(v) {
  if (!v) return '(空)'
  const s = String(v)
  if (s.length <= 8) return '****'
  return s.slice(0, 4) + '****' + s.slice(-4)
}

function requireCfg(cfg, needSecret) {
  if (!cfg.clientId || !cfg.redirectUri) {
    console.error('缺少 clientId / redirectUri：请先填写 .secrets/tencent-docs.json')
    process.exit(1)
  }
  if (needSecret && !cfg.clientSecret) {
    console.error('缺少 clientSecret：请填到 .secrets/tencent-docs.json 或环境变量（不要贴到聊天里）')
    process.exit(1)
  }
}

function extractCode(input) {
  if (!input) return ''
  try {
    const u = new URL(input)
    return u.searchParams.get('code') || ''
  } catch (e) {
    return input.trim()
  }
}

async function exchange(params) {
  const body = new URLSearchParams(params)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch (e) { data = { raw: text } }
  if (!data || !data.access_token) {
    console.error('换取 token 失败：HTTP ' + res.status)
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    open_id: data.open_id || data.openId || '',
    expires_at: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : null,
    updated_at: new Date().toISOString()
  }
  saveToken(record)
  console.log('已保存 token 到 .secrets/tencent-docs-token.json')
  console.log('open_id: ' + mask(record.open_id))
  console.log('access_token: ' + mask(record.access_token))
  console.log('refresh_token: ' + mask(record.refresh_token))
  if (record.expires_at) console.log('过期时间: ' + new Date(record.expires_at).toLocaleString())
}

async function main() {
  const cmd = process.argv[2]
  const cfg = loadCfg()

  if (cmd === 'auth') {
    requireCfg(cfg, false)
    const state = crypto.randomBytes(8).toString('hex')
    const url = AUTH_URL
      + '?client_id=' + encodeURIComponent(cfg.clientId)
      + '&redirect_uri=' + encodeURIComponent(cfg.redirectUri)
      + '&response_type=code'
      + '&scope=' + encodeURIComponent(cfg.scope)
      + '&state=' + state
    console.log('请在浏览器打开以下链接完成授权：\n')
    console.log(url)
    console.log('\n授权后浏览器会跳转到你的 redirect_uri（地址栏带 code 参数），把整段回调 URL 复制回来执行：')
    console.log('node scripts/tencent-docs-oauth.js exchange "<回调URL>"')
    return
  }

  if (cmd === 'exchange') {
    requireCfg(cfg, true)
    const code = extractCode(process.argv[3])
    if (!code) {
      console.error('用法：node scripts/tencent-docs-oauth.js exchange "<回调URL或code>"')
      process.exit(1)
    }
    await exchange({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code'
    })
    return
  }

  if (cmd === 'refresh') {
    requireCfg(cfg, true)
    const token = readToken()
    if (!token || !token.refresh_token) {
      console.error('没有本地 refresh_token，先完成 auth + exchange')
      process.exit(1)
    }
    await exchange({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: token.refresh_token,
      redirect_uri: cfg.redirectUri,
      grant_type: 'refresh_token'
    })
    return
  }

  if (cmd === 'status') {
    const token = readToken()
    if (!token) {
      console.log('还没有本地 token，先执行 auth + exchange')
      return
    }
    console.log('open_id: ' + mask(token.open_id))
    console.log('access_token: ' + mask(token.access_token))
    console.log('refresh_token: ' + mask(token.refresh_token))
    console.log('过期时间: ' + (token.expires_at ? new Date(token.expires_at).toLocaleString() : '未知'))
    if (token.expires_at && token.expires_at < Date.now()) console.log('⚠️ 已过期，执行 refresh 续期')
    return
  }

  console.log('用法：node scripts/tencent-docs-oauth.js <auth|exchange|refresh|status>')
}

main().catch(err => {
  console.error('执行失败：' + (err && err.message ? err.message : err))
  process.exit(1)
})
