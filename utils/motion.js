// 动效开关（本地，跨页面生效）
const KEY = 'mhxy_reduce_motion'

function getReduceMotion() {
  try {
    return !!wx.getStorageSync(KEY)
  } catch (e) {
    return false
  }
}

function setReduceMotion(v) {
  try {
    wx.setStorageSync(KEY, !!v)
    return true
  } catch (e) {
    return false
  }
}

module.exports = { getReduceMotion, setReduceMotion }
