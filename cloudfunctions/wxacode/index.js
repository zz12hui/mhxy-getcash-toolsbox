const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  try {
    const page = String((event && event.page) || 'pages/index/index')
    const scene = String((event && event.scene) || 'share')
    const res = await cloud.openapi.wxacode.getUnlimited({
      page,
      scene,
      checkPath: false,
      envVersion: (event && event.envVersion) || 'release',
      width: 280
    })
    return {
      ok: true,
      contentType: res.contentType || 'image/png',
      buffer: res.buffer.toString('base64')
    }
  } catch (err) {
    return { ok: false, error: (err && err.message) || '生成小程序码失败' }
  }
}
