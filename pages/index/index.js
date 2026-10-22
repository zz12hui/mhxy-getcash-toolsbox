const app = getApp()
const HOME = require('../../utils/ledger-home')

Page({
  data: {
    clockStr: '',
    ledgerSummary: { hasData: false, profitStr: '0.0 万两', profitPos: true, roiStr: '—', costStr: '0.0 万两', incomeStr: '0.0 万两', count: 0, hourlyStr: '—' }
  },

  onShow() {
    this.updateClock()
    this.loadLedgerSummary()
    if (this._clockTimer) clearInterval(this._clockTimer)
    this._clockTimer = setInterval(() => this.updateClock(), 1000)
  },

  loadLedgerSummary() {
    try {
      this.setData({ ledgerSummary: HOME.getHomeSummary({ period: 'all' }) })
    } catch (e) { /* 忽略首页摘要失败 */ }
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
    app.globalData.currentToolTab = 'pet'
    wx.setStorageSync('mhxy_tool_tab', 'pet')
    wx.switchTab({ url: '/pages/pet/pet' })
  },

  goChain() {
    app.globalData.currentToolTab = 'chain'
    wx.setStorageSync('mhxy_tool_tab', 'chain')
    wx.switchTab({ url: '/pages/chain/chain' })
  },

  goFaq() {
    wx.navigateTo({ url: '/pages/faq/faq' })
  },

  goLedger() {
    wx.navigateTo({ url: '/pages/ledger/ledger' })
  },

  onComing() {
    wx.showToast({ title: '功能开发中，敬请期待', icon: 'none' })
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
