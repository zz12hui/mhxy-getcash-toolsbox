const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const code = typeof event.code === 'string' ? event.code.trim() : ''

  if (!OPENID) return { code: -1, message: '用户未登录' }
  if (!code) return { code: -1, message: '缺少手机号授权 code' }

  try {
    // 基础库 >= 2.21.2：用 code 换取手机号（官方云调用接口为 phonenumber.getPhoneNumber）
    const result = await cloud.openapi.phonenumber.getPhoneNumber({ code })
    const phoneInfo = (result && result.phoneInfo) || {}
    const phoneNumber = phoneInfo.purePhoneNumber || phoneInfo.phoneNumber || ''

    if (!phoneNumber) {
      return { code: -1, message: '获取手机号失败' }
    }

    const now = Date.now()
    try {
      const { data: users } = await db.collection('users').where({ _openid: OPENID }).get()
      if (users.length > 0) {
        await db.collection('users').doc(users[0]._id).update({
          data: { phoneNumber, updatedAt: now }
        })
      }
    } catch (e) {
      // 用户记录可能还没创建，先返回手机号，下一次 login 会补建用户
      console.error('[getPhone] update user failed:', e)
    }

    return { code: 0, data: { phoneNumber } }
  } catch (err) {
    console.error('[getPhone] error:', err)
    return { code: -1, message: '获取手机号失败: ' + (err.message || '未知错误') }
  }
}
