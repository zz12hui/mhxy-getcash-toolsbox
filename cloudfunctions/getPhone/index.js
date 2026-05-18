const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const code = event.code || event.encryptedData

  if (!OPENID) return { code: -1, message: '用户未登录' }
  if (!code) return { code: -1, message: '缺少授权数据' }

  try {
    let phoneNumber = ''

    // New API (base lib >= 2.21.2): code-based
    try {
      const result = await cloud.openapi.security.getPhoneNumber({ code })
      phoneNumber = result.phoneInfo ? (result.phoneInfo.purePhoneNumber || result.phoneInfo.phoneNumber) : ''
    } catch (e1) {
      // Fallback: old API with encryptedData+iv (base lib < 2.21.2)
      const { encryptedData, iv } = event
      if (encryptedData && iv) {
        try {
          const WXBizDataCrypt = require('./WXBizDataCrypt')
          const sessionKey = '' // would need to be stored from login
          // Old decrypt path — not implemented, recommend upgrading base lib
          throw new Error('unsupported')
        } catch (e2) {
          console.error('[getPhone] decrypt failed:', e2)
          return { code: -1, message: '获取手机号失败，请升级微信版本' }
        }
      }
      console.error('[getPhone] new API failed:', e1)
      return { code: -1, message: '获取手机号失败: ' + e1.message }
    }

    if (phoneNumber) {
      const now = Date.now()
      const { data: users } = await db.collection('users').where({ _openid: OPENID }).get()
      if (users.length > 0) {
        await db.collection('users').doc(users[0]._id).update({
          data: { phoneNumber, updatedAt: now }
        })
      }
      return { code: 0, data: { phoneNumber } }
    }

    return { code: -1, message: '获取手机号失败' }
  } catch (err) {
    console.error('[getPhone] error:', err)
    return { code: -1, message: '解密手机号失败: ' + err.message }
  }
}
