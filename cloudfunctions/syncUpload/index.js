const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { pet, chain } = event

  if (!OPENID) return { code: -1, message: '用户未登录' }

  const now = Date.now()
  const _ = db.command

  try {
    // Assemble all data types from pet and chain
    const entries = []
    if (pet) {
      Object.keys(pet).forEach(k => {
        if (pet[k] !== undefined) {
          entries.push({ dataType: 'pet_' + k, dataJson: pet[k] })
        }
      })
    }
    if (chain) {
      Object.keys(chain).forEach(k => {
        if (chain[k] !== undefined) {
          entries.push({ dataType: 'chain_' + k, dataJson: chain[k] })
        }
      })
    }

    // Upsert each data type
    for (const entry of entries) {
      const { data: existing } = await db.collection('user_sync_data')
        .where({ _openid: OPENID, dataType: entry.dataType })
        .get()

      if (existing.length > 0) {
        await db.collection('user_sync_data').doc(existing[0]._id).update({
          data: { dataJson: entry.dataJson, updatedAt: now }
        })
      } else {
        await db.collection('user_sync_data').add({
          data: {
            _openid: OPENID,
            dataType: entry.dataType,
            dataJson: entry.dataJson,
            updatedAt: now
          }
        })
      }
    }

    return { code: 0, data: { syncedAt: now } }
  } catch (err) {
    console.error('[syncUpload] error:', err)
    return { code: -1, message: '备份失败: ' + err.message }
  }
}
