const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 一次备份允许的最大角色数，避免单次请求过大
const MAX_ROLES = 10
const MAX_DOC_BYTES = 900 * 1024
const FIELDS = ['cfg', 'prices', 'runs', 'cur']
const TOOLS = ['pet', 'chain']

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function runChunks(tasks, size) {
  for (const part of chunk(tasks, size)) {
    await Promise.all(part)
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, message: '用户未登录' }

  const roles = (Array.isArray(event.roles) ? event.roles : []).slice(0, MAX_ROLES)
  if (!roles.length) return { code: -1, message: '没有可备份的角色' }

  const now = Date.now()

  // 1) 先完整校验并组装，避免写一半才失败
  const entries = []
  for (const role of roles) {
    const roleId = String(role.id || '').slice(0, 64)
    if (!roleId) continue
    const roleName = String(role.name || '角色').slice(0, 12)
    const createdAt = Number(role.createdAt) || now
    entries.push({
      roleId,
      dataType: 'role_meta',
      doc: { roleName, createdAt, dataJson: null }
    })
    for (const tool of TOOLS) {
      const source = role[tool]
      if (!source) continue
      for (const field of FIELDS) {
        const value = source[field]
        if (value === undefined) continue
        if (JSON.stringify(value).length > MAX_DOC_BYTES) {
          return { code: -1, message: '角色「' + roleName + '」的 ' + tool + ' 数据过大，请先导出/清理部分历史后再备份' }
        }
        entries.push({
          roleId,
          dataType: tool + '_' + field,
          doc: { dataJson: value }
        })
      }
    }
  }
  if (!entries.length) return { code: -1, message: '没有可备份的数据' }

  try {
    // 一次取出该用户全部同步文档（只按 _openid 查询，不依赖复合索引）
    const { data: docs } = await db.collection('user_sync_data')
      .where({ _openid: OPENID })
      .limit(1000)
      .get()

    const existing = new Map()
    docs.forEach(d => {
      if (d.roleId && d.dataType) existing.set(d.roleId + '::' + d.dataType, d)
    })

    // 2) 写入本次快照
    const keep = new Set()
    const writes = []
    entries.forEach(entry => {
      const key = entry.roleId + '::' + entry.dataType
      keep.add(key)
      const old = existing.get(key)
      if (old) {
        writes.push(db.collection('user_sync_data').doc(old._id).update({
          data: Object.assign({}, entry.doc, { updatedAt: now })
        }))
      } else {
        writes.push(db.collection('user_sync_data').add({
          data: Object.assign({
            _openid: OPENID,
            roleId: entry.roleId,
            dataType: entry.dataType,
            updatedAt: now
          }, entry.doc)
        }))
      }
    })

    // 3) 删除本次未提交的旧文档（含 v1.1 之前的旧格式备份）
    const removes = []
    docs.forEach(d => {
      if (!d.roleId || !d.dataType) {
        removes.push(db.collection('user_sync_data').doc(d._id).remove())
        return
      }
      if (!keep.has(d.roleId + '::' + d.dataType)) {
        removes.push(db.collection('user_sync_data').doc(d._id).remove())
      }
    })

    await runChunks(writes, 8)
    if (removes.length) await runChunks(removes, 20)

    return { code: 0, data: { syncedAt: now, roles: roles.length, docs: entries.length } }
  } catch (err) {
    console.error('[syncUpload] error:', err)
    return { code: -1, message: '备份失败: ' + (err.message || '未知错误') }
  }
}
