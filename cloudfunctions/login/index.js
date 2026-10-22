const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const OPENID = wxContext.OPENID

  if (!OPENID) {
    return { code: -1, message: '获取用户身份失败，请确认云开发环境已正确配置' }
  }

  const now = Date.now()

  try {
    // Find or create user — auto-create collection if needed
    let user = null
    try {
      const { data: users } = await db.collection('users').where({ _openid: OPENID }).get()
      if (users.length > 0) user = users[0]
    } catch (e) {
      // Collection might not exist yet, will create on first add
      console.log('[login] users collection may not exist yet:', e.message)
    }

    if (user) {
      // Update last login
      await db.collection('users').doc(user._id).update({
        data: { lastLoginAt: now, updatedAt: now }
      }).catch(() => {})
      user.lastLoginAt = now
    } else {
      // Create new user
      const newUser = {
        _openid: OPENID,
        nickName: '',
        avatarUrl: '',
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now
      }
      try {
        const result = await db.collection('users').add({ data: newUser })
        user = { _id: result._id, ...newUser }
      } catch (e) {
        console.error('[login] failed to create user:', e)
        // Fallback: return basic info without DB
        return {
          code: 0,
          data: {
            id: 'temp_' + Date.now(),
            openid: OPENID,
            nickName: '',
            avatarUrl: '',
            lastLoginAt: now,
            isAdmin: false
          }
        }
      }
    }

    // Check if user is admin (by openid whitelist)
    let isAdmin = false
    try {
      const { total } = await db.collection('admins').where({ openid: OPENID, isActive: true }).count()
      isAdmin = total > 0
    } catch (e) { /* admins collection might not exist yet */ }

    return {
      code: 0,
      data: {
        id: user._id,
        openid: user._openid,
        nickName: user.nickName || '',
        avatarUrl: user.avatarUrl || '',
        lastLoginAt: user.lastLoginAt,
        isAdmin
      }
    }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: '登录失败: ' + (err.message || '未知错误') }
  }
}
