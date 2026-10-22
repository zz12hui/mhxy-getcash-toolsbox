const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_HOST = 'docs.qq.com'

function requestJson(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined || body === null
      ? ''
      : (typeof body === 'string' ? body : JSON.stringify(body))
    const req = https.request({
      host: API_HOST,
      path,
      method,
      headers: Object.assign({
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }, headers || {})
    }, res => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        let data = null
        try { data = JSON.parse(raw) } catch (e) { data = { raw: raw.slice(0, 500) } }
        if (res.statusCode !== 200) {
          return reject(new Error('腾讯文档接口 HTTP ' + res.statusCode + '：' + (data.msg || data.raw || '')))
        }
        if (!data || data.ret !== 0) {
          return reject(new Error('腾讯文档接口失败：' + ((data && data.msg) || '未知错误')))
        }
        resolve(data)
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function getConfig() {
  const clientId = process.env.TENCENT_DOCS_CLIENT_ID || ''
  const accessToken = process.env.TENCENT_DOCS_ACCESS_TOKEN || ''
  const openId = process.env.TENCENT_DOCS_OPEN_ID || ''
  if (!clientId || !accessToken || !openId) {
    throw new Error('云函数缺少腾讯文档环境变量（TENCENT_DOCS_CLIENT_ID / TENCENT_DOCS_ACCESS_TOKEN / TENCENT_DOCS_OPEN_ID）')
  }
  return { clientId, accessToken, openId }
}

function authHeaders(cfg) {
  return {
    'Access-Token': cfg.accessToken,
    'Client-Id': cfg.clientId,
    'Open-Id': cfg.openId
  }
}

function colLetter(n) {
  let s = ''
  let num = n
  while (num > 0) {
    const rem = (num - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    num = Math.floor((num - 1) / 26)
  }
  return s || 'A'
}

function sanitizeRows(input) {
  if (!Array.isArray(input) || !input.length) throw new Error('没有可写入的报表数据')
  if (input.length > 500) throw new Error('单次最多 500 行，请缩小筛选范围')
  return input.map(row => {
    if (!Array.isArray(row)) return []
    return row.slice(0, 20).map(cell => {
      const s = cell === null || cell === undefined ? '' : String(cell)
      return s.slice(0, 300)
    })
  })
}

async function createSheet(cfg, title) {
  const body = new URLSearchParams({ type: 'sheet', title })
  const data = await requestJson(
    'POST',
    '/openapi/drive/v2/files',
    Object.assign(authHeaders(cfg), { 'Content-Type': 'application/x-www-form-urlencoded' }),
    body.toString()
  )
  const info = data.data || {}
  if (!info.ID || !info.url) throw new Error('创建表格成功但未返回文档信息')
  return info
}

async function addSheet(cfg, bookID, title, rowCount, columnCount) {
  const body = {
    addSheet: {
      properties: {
        title,
        index: 0,
        gridProperties: { rowCount, columnCount }
      }
    }
  }
  const data = await requestJson(
    'POST',
    '/openapi/sheetbook/v2/' + bookID + ':batchUpdate',
    Object.assign(authHeaders(cfg), { 'Content-Type': 'application/json' }),
    body
  )
  const props = data.data && data.data.addSheet && data.data.addSheet.properties
  if (!props || !props.sheetID) throw new Error('添加工作表失败：未返回 sheetID')
  return props.sheetID
}

async function writeValues(cfg, bookID, sheetID, rows) {
  const range = sheetID + '!A1:' + colLetter(rows[0].length) + rows.length
  await requestJson(
    'PUT',
    '/openapi/sheetbook/v2/' + bookID + '/values/' + encodeURIComponent(range),
    Object.assign(authHeaders(cfg), { 'Content-Type': 'application/json' }),
    { values: rows }
  )
}

async function setPublicRead(cfg, bookID) {
  await requestJson(
    'PATCH',
    '/openapi/drive/v2/files/' + bookID + '/permission',
    Object.assign(authHeaders(cfg), { 'Content-Type': 'application/json' }),
    { policy: 'publicRead' }
  )
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  try {
    if (!wxContext.OPENID) return { ok: false, error: '未登录' }
    if (event && event.action && event.action !== 'create') {
      return { ok: false, error: '不支持的操作' }
    }
    const rows = sanitizeRows(event && event.rows)
    const title = String((event && event.title) || '梦幻收益报表').slice(0, 36)
    const cfg = getConfig()

    const file = await createSheet(cfg, title)
    const bookID = file.ID
    const sheetID = await addSheet(cfg, bookID, '收益报表', Math.max(rows.length + 10, 100), Math.max(rows[0].length, 8))
    await writeValues(cfg, bookID, sheetID, rows)
    let shareWarning = ''
    try {
      await setPublicRead(cfg, bookID)
    } catch (e) {
      shareWarning = '（表格已生成，但链接公开权限设置失败，可在腾讯文档里手动分享）'
    }
    return {
      ok: true,
      url: file.url,
      fileID: bookID,
      title: file.title || title,
      rowCount: rows.length,
      shareWarning
    }
  } catch (err) {
    console.error('[docsReport]', err && err.message)
    return { ok: false, error: (err && err.message) || '生成失败' }
  }
}
