// 轻量 UI 反馈：震动开关
const VIBRATE_KEY = 'mhxy_vibrate'

function isVibrateOn() {
  try {
    const v = wx.getStorageSync(VIBRATE_KEY)
    return v === '' || v === undefined || v === null ? true : !!v
  } catch (e) {
    return true
  }
}

function setVibrate(on) {
  try { wx.setStorageSync(VIBRATE_KEY, !!on) } catch (e) { /* ignore */ }
}

function vibrate() {
  if (!isVibrateOn()) return
  try { wx.vibrateShort({ type: 'light', fail: () => {} }) } catch (e) { /* ignore */ }
}

module.exports = { isVibrateOn, setVibrate, vibrate }
