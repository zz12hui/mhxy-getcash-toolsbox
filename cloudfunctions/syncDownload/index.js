const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) return { code: -1, message: '用户未登录' }

  try {
    const { data: entries } = await db.collection('user_sync_data')
      .where({ _openid: OPENID })
      .get()

    const pet = {}
    const chain = {}

    entries.forEach(e => {
      if (e.dataType.startsWith('pet_')) {
        pet[e.dataType.replace('pet_', '')] = e.dataJson
      } else if (e.dataType.startsWith('chain_')) {
        chain[e.dataType.replace('chain_', '')] = e.dataJson
      }
    })

    const syncedAt = entries.length > 0
      ? Math.max(...entries.map(e => e.updatedAt || 0))
      : null

    return { code: 0, data: { pet, chain, syncedAt } }
  } catch (err) {
    console.error('[syncDownload] error:', err)
    return { code: -1, message: '恢复失败: ' + err.message }
  }
}
