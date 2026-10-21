const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const FIELDS = ['cfg', 'prices', 'runs', 'cur']
const TOOLS = ['pet', 'chain']

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: -1, message: '用户未登录' }

  try {
    const { data: docs } = await db.collection('user_sync_data')
      .where({ _openid: OPENID })
      .limit(1000)
      .get()

    const roleMap = new Map()
    const legacy = { hasLegacy: false }
    let syncedAt = null

    function ensureRole(roleId) {
      if (!roleMap.has(roleId)) {
        roleMap.set(roleId, {
          id: roleId,
          name: '角色',
          createdAt: 0,
          updatedAt: 0,
          pet: {},
          chain: {}
        })
      }
      return roleMap.get(roleId)
    }

    docs.forEach(d => {
      if (!d.roleId || !d.dataType) { legacy.hasLegacy = true; return }
      const role = ensureRole(d.roleId)
      const updatedAt = Number(d.updatedAt) || 0
      if (updatedAt > role.updatedAt) role.updatedAt = updatedAt
      if (syncedAt === null || updatedAt > syncedAt) syncedAt = updatedAt

      if (d.dataType === 'role_meta') {
        role.name = d.roleName || role.name
        role.createdAt = Number(d.createdAt) || role.createdAt
        return
      }

      const idx = d.dataType.indexOf('_')
      const tool = d.dataType.slice(0, idx)
      const field = d.dataType.slice(idx + 1)
      if (TOOLS.indexOf(tool) >= 0 && FIELDS.indexOf(field) >= 0) {
        role[tool][field] = d.dataJson
      }
    })

    const roles = Array.from(roleMap.values())
      .filter(r => r.updatedAt > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return { code: 0, data: { roles, syncedAt, legacy: !!legacy.hasLegacy } }
  } catch (err) {
    console.error('[syncDownload] error:', err)
    return { code: -1, message: '恢复失败: ' + (err.message || '未知错误') }
  }
}
