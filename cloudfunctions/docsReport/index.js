const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_HOST = 'docs.qq.com'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
          const detail = (data && (data.msg || data.message || data.error || data.ret)) || JSON.stringify(data || {}).slice(0, 200)
          return reject(new Error('腾讯文档接口失败：' + detail))
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
  let local = {}
  try { local = require('./config.local') } catch (e) { /* 本地兜底配置不存在时忽略 */ }
  const clientId = process.env.TENCENT_DOCS_CLIENT_ID || local.clientId || ''
  const accessToken = process.env.TENCENT_DOCS_ACCESS_TOKEN || local.accessToken || ''
  const openId = process.env.TENCENT_DOCS_OPEN_ID || local.openId || ''
  if (!clientId || !accessToken || !openId) {
    const flags = [
      'CLIENT_ID=' + (clientId ? 'ok' : 'missing'),
      'ACCESS_TOKEN=' + (accessToken ? 'ok' : 'missing'),
      'OPEN_ID=' + (openId ? 'ok' : 'missing')
    ].join(' / ')
    throw new Error('云函数缺少腾讯文档配置（' + flags + '）：请在云开发控制台给 docsReport 配环境变量，或本地执行 node scripts/gen-docs-config.js 后重新部署')
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
  if (input.length > 2000) throw new Error('单表最多 2000 行，请缩小筛选范围')
  const maxCols = input.reduce((m, row) => Math.max(m, Array.isArray(row) ? row.length : 0), 0)
  const colCount = Math.min(Math.max(maxCols, 1), 20)
  return input.map(row => {
    const cells = Array.isArray(row) ? row.slice(0, colCount) : []
    while (cells.length < colCount) cells.push('')
    return cells.map(cell => {
      const s = cell === null || cell === undefined ? '' : String(cell)
      return s.slice(0, 300)
    })
  })
}

function sanitizeSheets(input) {
  if (!Array.isArray(input) || !input.length) throw new Error('没有可写入的工作表')
  if (input.length > 6) throw new Error('单次最多 6 个工作表')
  return input.map((sheet, i) => {
    const rows = sanitizeRows(sheet && sheet.rows)
    return {
      title: String((sheet && sheet.title) || ('明细' + (i + 1))).slice(0, 31),
      rows,
      sheetID: String((sheet && sheet.sheetID) || ''),
      prevRows: Math.max(0, Number(sheet && sheet.prevRows) || 0)
    }
  })
}

function readSheets(event) {
  if (event && Array.isArray(event.sheets)) return sanitizeSheets(event.sheets)
  // 兼容旧客户端：单表 rows
  return sanitizeSheets([{ title: '收益报表', rows: event && event.rows }])
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

async function addSheet(cfg, bookID, title, rowCount, columnCount, index) {
  const properties = { title, gridProperties: { rowCount, columnCount } }
  if (typeof index === 'number') properties.index = index
  const body = { addSheet: { properties } }
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

async function addSheetForRows(cfg, bookID, sheet) {
  const rowCount = Math.max(sheet.rows.length + 50, 300)
  const columnCount = Math.max(sheet.rows[0].length, 8)
  const sheetID = await addSheet(cfg, bookID, sheet.title, rowCount, columnCount)
    .catch(e => { throw new Error('添加「' + sheet.title + '」工作表步骤：' + e.message) })
  await writeValues(cfg, bookID, sheetID, sheet.rows).catch(e => { throw new Error('写入「' + sheet.title + '」步骤：' + e.message) })
  return sheetID
}

async function updateSheetRows(cfg, bookID, sheet) {
  let sheetID = sheet.sheetID
  if (!sheetID) {
    sheetID = await addSheetForRows(cfg, bookID, sheet)
    return { title: sheet.title, sheetID, rowCount: sheet.rows.length }
  }
  await writeValues(cfg, bookID, sheetID, sheet.rows).catch(e => { throw new Error('更新「' + sheet.title + '」步骤：' + e.message) })
  if (sheet.prevRows > sheet.rows.length) {
    await clearRows(cfg, bookID, sheetID, sheet.rows.length + 1, sheet.prevRows, sheet.rows[0].length)
      .catch(e => { throw new Error('清理「' + sheet.title + '」旧行步骤：' + e.message) })
  }
  return { title: sheet.title, sheetID, rowCount: sheet.rows.length }
}

async function clearRows(cfg, bookID, sheetID, fromRow, toRow, colCount) {
  if (toRow < fromRow) return
  const values = []
  const blank = new Array(colCount).fill('')
  for (let i = 0; i < toRow - fromRow + 1; i++) values.push(blank.slice())
  const range = sheetID + '!A' + fromRow + ':' + colLetter(colCount) + toRow
  await requestJson(
    'PUT',
    '/openapi/sheetbook/v2/' + bookID + '/values/' + encodeURIComponent(range),
    Object.assign(authHeaders(cfg), { 'Content-Type': 'application/json' }),
    { values }
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
    const action = (event && event.action) || 'create'
    const sheets = readSheets(event)
    const title = String((event && event.title) || '梦幻收益报表').slice(0, 36)
    const cfg = getConfig()

    if (action === 'update') {
      const fileID = String((event && event.fileID) || '')
      if (!fileID) throw new Error('更新失败：缺少文档 ID')
      const prepared = []
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i]
        let sheetID = sheet.sheetID
        if (!sheetID) {
          if (prepared.some(p => p.added)) await sleep(700)
          sheetID = await addSheet(cfg, fileID, sheet.title, Math.max(sheet.rows.length + 50, 300), Math.max(sheet.rows[0].length, 8))
            .catch(e => { throw new Error('添加「' + sheet.title + '」工作表步骤：' + e.message) })
          prepared.push({ sheet, sheetID, added: true })
        } else {
          prepared.push({ sheet, sheetID, added: false })
        }
      }
      let shareWarning = ''
      const writes = prepared.map(({ sheet, sheetID }) => (async () => {
        await writeValues(cfg, fileID, sheetID, sheet.rows).catch(e => { throw new Error('更新「' + sheet.title + '」步骤：' + e.message) })
        if (sheet.prevRows > sheet.rows.length) {
          await clearRows(cfg, fileID, sheetID, sheet.rows.length + 1, sheet.prevRows, sheet.rows[0].length)
            .catch(e => { throw new Error('清理「' + sheet.title + '」旧行步骤：' + e.message) })
        }
        return { title: sheet.title, sheetID, rowCount: sheet.rows.length }
      })())
      const perm = setPublicRead(cfg, fileID).catch(() => { shareWarning = '（已更新，但链接公开权限设置失败，可在腾讯文档里手动分享）' })
      const out = await Promise.all(writes.concat([perm])).then(list => list.slice(0, prepared.length))
      const rowCount = out.reduce((s, x) => s + x.rowCount, 0)
      return {
        ok: true,
        created: false,
        fileID,
        sheetID: out[0] && out[0].sheetID,
        sheets: out,
        title,
        rowCount,
        shareWarning
      }
    }

    if (action !== 'create') return { ok: false, error: '不支持的操作' }
    const file = await createSheet(cfg, title).catch(e => { throw new Error('创建表格步骤：' + e.message) })
    const bookID = file.ID
    const added = []
    for (let i = 0; i < sheets.length; i++) {
      if (i > 0) await sleep(700)
      const sheet = sheets[i]
      const sheetID = await addSheet(cfg, bookID, sheet.title, Math.max(sheet.rows.length + 50, 300), Math.max(sheet.rows[0].length, 8), i)
        .catch(e => { throw new Error('添加「' + sheet.title + '」工作表步骤：' + e.message) })
      added.push({ sheet, sheetID })
    }
    let shareWarning = ''
    const writes = added.map(({ sheet, sheetID }) => writeValues(cfg, bookID, sheetID, sheet.rows)
      .then(() => ({ title: sheet.title, sheetID, rowCount: sheet.rows.length }))
      .catch(e => { throw new Error('写入「' + sheet.title + '」步骤：' + e.message) }))
    const perm = setPublicRead(cfg, bookID).catch(() => { shareWarning = '（表格已生成，但链接公开权限设置失败，可在腾讯文档里手动分享）' })
    const out = await Promise.all(writes.concat([perm])).then(list => list.slice(0, added.length))
    return {
      ok: true,
      created: true,
      url: file.url,
      fileID: bookID,
      sheetID: out[0] && out[0].sheetID,
      sheets: out,
      title: file.title || title,
      rowCount: out.reduce((s, x) => s + x.rowCount, 0),
      shareWarning
    }
  } catch (err) {
    console.error('[docsReport]', err && err.message)
    return { ok: false, error: (err && err.message) || '生成失败' }
  }
}
