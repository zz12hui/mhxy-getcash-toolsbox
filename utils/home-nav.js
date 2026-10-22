// 首页 → 内置工具 的跨 Tab 跳转指令（tab 页不能带参数）
const KEY = 'mhxy_pending_tool'

function setPending(tool) {
  try {
    wx.setStorageSync(KEY, tool)
    return true
  } catch (e) {
    return false
  }
}

function takePending() {
  try {
    const v = wx.getStorageSync(KEY)
    if (v) wx.removeStorageSync(KEY)
    return v || ''
  } catch (e) {
    return ''
  }
}

module.exports = { setPending, takePending }
