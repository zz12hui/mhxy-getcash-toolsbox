const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { content, contactInfo, pagePath } = event

  if (!content || !content.trim()) {
    return { code: -1, message: '请填写反馈内容' }
  }

  try {
    const now = Date.now()
    const result = await db.collection('feedbacks').add({
      data: {
        _openid: OPENID || '',
        content: content.trim().substring(0, 500),
        contactInfo: (contactInfo || '').substring(0, 128),
        pagePath: (pagePath || '').substring(0, 128),
        status: 'pending',
        adminReply: '',
        createdAt: now,
        updatedAt: now
      }
    })
    return { code: 0, data: { id: result._id } }
  } catch (err) {
    console.error('[submitFeedback] error:', err)
    return { code: -1, message: '提交失败: ' + err.message }
  }
}
