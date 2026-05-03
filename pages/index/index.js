Page({
  data: {
    clockStr: ''
  },

  onShow() {
    this.updateClock()
    if (this._clockTimer) clearInterval(this._clockTimer)
    this._clockTimer = setInterval(() => this.updateClock(), 1000)
  },

  onHide() {
    if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null }
  },

  updateClock() {
    const n = new Date()
    const str = n.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' + n.toLocaleTimeString('zh-CN', { hour12: false })
    this.setData({ clockStr: str })
  },

  goPet() {
    wx.switchTab({ url: '/pages/pet/pet' })
  },

  goChain() {
    wx.switchTab({ url: '/pages/chain/chain' })
  },

  onShareAppMessage() {
    return {
      title: '梦幻搞钱工具箱 — 跑环记录 · 积分预测 · 奖励结算',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '梦幻搞钱工具箱 — 跑环记录一站式工具'
    }
  }
})
