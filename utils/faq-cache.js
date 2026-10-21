// FAQ local cache — offline-first for FAQ data
const CACHE_TTL = 3600000 // 1 hour

function getCacheKey(key) {
  return 'mhxy_faq_' + key
}

function getCached(key) {
  try {
    const raw = wx.getStorageSync(getCacheKey(key))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch (e) {
    return null
  }
}

function setCache(key, data) {
  try {
    wx.setStorageSync(getCacheKey(key), JSON.stringify({ data, ts: Date.now() }))
    return true
  } catch (e) {
    return false
  }
}

function clearAll() {
  try {
    const info = wx.getStorageInfoSync()
    info.keys.forEach(k => {
      if (k.indexOf('mhxy_faq_') === 0) wx.removeStorageSync(k)
    })
  } catch (e) { /* ignore */ }
}

module.exports = {
  getCached,
  setCache,
  clearAll,
  CACHE_TTL
}
