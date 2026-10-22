const app = getApp()
const HOME = require('../../utils/ledger-home')
const MOTION = require('../../utils/motion')
const MONEY = require('../../utils/money')
const GOLD = require('../../utils/gold-calc')

Page({
  data: {
    clockStr: '',
    sparkBars: [],
    reduceMotion: false,
    statusBarHeight: 20,
    navRight: 90,
    scrollIntoView: '',
    goldWan: '3000',
    goldYuan: '202',
    goldRatioText: '',
    goldRatioWan: '3000',
    goldRatioYuan: '202',
    showGoldSettings: false,
    ledgerSummary: { hasData: false, profitStr: '0.0 万两', profitPos: true, roiStr: '—', costStr: '0.0 万两', incomeStr: '0.0 万两', count: 0, hourlyStr: '—' }
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      let navRight = 90
      try {
        const rect = wx.getMenuButtonBoundingClientRect()
        if (rect && rect.left) navRight = Math.max(70, info.windowWidth - rect.left + 10)
      } catch (e) { /* 忽略 */ }
      this.setData({ statusBarHeight: info.statusBarHeight || 20, navRight })
    } catch (e) { /* 忽略 */ }
  },

  onShow() {
    this.updateClock()
    this.loadLedgerSummary()
    this.loadGold()
    this.setData({ reduceMotion: MOTION.getReduceMotion() })
    if (this._clockTimer) clearInterval(this._clockTimer)
    this._clockTimer = setInterval(() => this.updateClock(), 1000)
  },

  // ===== 金价计算器 =====
  loadGold() {
    const cfg = MONEY.getMoneyCfg()
    this._goldCfg = cfg
    const pair = GOLD.getPair(cfg)
    const wan = this.data.goldWan || String(pair.wan)
    const yuan = GOLD.fmt(GOLD.wanToYuan(parseFloat(wan) || 0, cfg), 2)
    this.setData({
      goldRatioText: GOLD.ratioText(cfg),
      goldRatioWan: String(pair.wan),
      goldRatioYuan: String(pair.yuan),
      goldWan: wan,
      goldYuan: yuan
    })
  },

  onGoldWanInput(e) {
    const v = e.detail.value
    const cfg = this._goldCfg || MONEY.getMoneyCfg()
    const yuan = GOLD.fmt(GOLD.wanToYuan(parseFloat(v) || 0, cfg), 2)
    this.setData({ goldWan: v, goldYuan: yuan })
  },

  onGoldYuanInput(e) {
    const v = e.detail.value
    const cfg = this._goldCfg || MONEY.getMoneyCfg()
    const wan = GOLD.fmt(GOLD.yuanToWan(parseFloat(v) || 0, cfg), 2)
    this.setData({ goldYuan: v, goldWan: wan })
  },

  quickGold(e) {
    const wan = Number(e.currentTarget.dataset.wan)
    if (!wan) return
    const cfg = this._goldCfg || MONEY.getMoneyCfg()
    this.setData({ goldWan: String(wan), goldYuan: GOLD.fmt(GOLD.wanToYuan(wan, cfg), 2) })
  },

  scrollToGold() {
    this.setData({ scrollIntoView: 'gold-calc' })
    setTimeout(() => this.setData({ scrollIntoView: '' }), 600)
  },

  openGoldSettings() {
    const cfg = MONEY.getMoneyCfg()
    const pair = GOLD.getPair(cfg)
    this.setData({
      showGoldSettings: true,
      goldRatioWan: String(pair.wan),
      goldRatioYuan: String(pair.yuan)
    })
  },

  closeGoldSettings() {
    this.setData({ showGoldSettings: false })
  },

  onGoldRatioInput(e) {
    const key = e.currentTarget.dataset.k
    const patch = {}
    patch[key] = e.detail.value
    this.setData(patch)
  },

  recalcGold() {
    const cfg = this._goldCfg || MONEY.getMoneyCfg()
    const yuan = GOLD.fmt(GOLD.wanToYuan(parseFloat(this.data.goldWan) || 0, cfg), 2)
    this.setData({ goldYuan: yuan })
  },

  saveGoldSettings() {
    const wan = parseFloat(this.data.goldRatioWan)
    const yuan = parseFloat(this.data.goldRatioYuan)
    const ratio = GOLD.pairToRatio(wan, yuan)
    if (!ratio) {
      wx.showToast({ title: '比例需要大于 0', icon: 'none' })
      return
    }
    const cfg = Object.assign(MONEY.getMoneyCfg(), { ratioWan: wan, ratioYuan: yuan, wanPerYuan: ratio })
    MONEY.saveMoneyCfg(cfg)
    this._goldCfg = cfg
    this.setData({
      showGoldSettings: false,
      goldRatioText: GOLD.ratioText(cfg),
      goldRatioWan: String(wan),
      goldRatioYuan: String(yuan)
    })
    this.recalcGold()
    wx.showToast({ title: '比例已保存', icon: 'none' })
  },

  resetGoldSettings() {
    MONEY.resetMoneyCfg()
    const cfg = MONEY.getMoneyCfg()
    this._goldCfg = cfg
    const pair = GOLD.getPair(cfg)
    this.setData({
      showGoldSettings: false,
      goldRatioText: GOLD.ratioText(cfg),
      goldRatioWan: String(pair.wan),
      goldRatioYuan: String(pair.yuan)
    })
    this.recalcGold()
    wx.showToast({ title: '已恢复默认比例', icon: 'none' })
  },

  loadLedgerSummary() {
    try {
      this.setData({
        ledgerSummary: HOME.getHomeSummary({ period: 'all' }),
        sparkBars: HOME.getHomeChart({ count: 12 })
      })
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

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  noop() {},

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
