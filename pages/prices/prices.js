const C = require('../../utils/constants')
const S = require('../../utils/storage')
const REWARD_PRICES = require('../../utils/reward-prices')
const MONEY = require('../../utils/money')
const GOLD = require('../../utils/gold-calc')
const NAV = require('../../utils/home-nav')

function fmtWan(v) {
  return GOLD.fmt(Number(v || 0) / 10000, 2)
}

Page({
  data: {
    statusBarHeight: 20,
    navRight: 90,
    activeTab: 'task',
    roleName: '',
    ratioText: '',
    petRows: [],
    chainRows: [],
    books: [],
    irons: [],
    lingshi: [],
    special: [],
    savedNote: ''
  },

  onLoad() {
    this.initNavMetrics()
  },

  onResize() {
    this.initNavMetrics()
  },

  initNavMetrics() {
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
    this.loadData()
  },

  loadData() {
    const uid = S.getActiveUser()
    const users = S.getUsers() || []
    const role = users.find(u => u.id === uid)
    const petPrices = S.getPetPrices(uid)
    const chainPrices = S.getChainPrices(uid)

    const petRows = C.PET_TYPES.map(t => {
      const def = C.P_DEFAULT_PRICES[t.id] || 0
      const cur = petPrices[t.id] !== undefined ? petPrices[t.id] : def
      return {
        icon: t.icon,
        name: t.name,
        defWan: fmtWan(def),
        curWan: fmtWan(cur),
        custom: Number(cur) !== Number(def)
      }
    })
    const chainRows = C.CHAIN_TYPES.map(t => {
      const def = C.C_DEFAULT_PRICES[t.id] || 0
      const cur = chainPrices[t.id] !== undefined ? chainPrices[t.id] : def
      return {
        icon: t.icon,
        name: t.name,
        defWan: fmtWan(def),
        curWan: fmtWan(cur),
        custom: Number(cur) !== Number(def)
      }
    })

    const rp = REWARD_PRICES.getRewardPrices(uid)
    const books = C.BOOK_LVLS.map(lv => ({ label: lv + '级制造指南书', value: fmtWan(rp.books[lv]) }))
    const irons = C.BOOK_LVLS.map(lv => ({ label: lv + '级百炼精铁', value: fmtWan(rp.irons[lv]) }))
    const lingshi = [120, 140].map(lv => ({ label: lv + '灵饰指南书/元灵晶石', value: fmtWan(rp.lingshi[lv]) }))
    const special = [
      { label: '160级战魄', value: fmtWan(rp.zhanpo) },
      { label: '修炼果', value: fmtWan(rp.items.xiulian_guo) },
      { label: '200修炼点', value: fmtWan(rp.items.xiulian_200) },
      { label: '3级家具设计图', value: fmtWan(rp.items.furniture3) }
    ]

    this.setData({
      roleName: role ? role.name : '',
      ratioText: GOLD.ratioText(MONEY.getMoneyCfg()),
      petRows,
      chainRows,
      books,
      irons,
      lingshi,
      special
    })
  },

  onTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  goPetPrices() {
    NAV.setPending('pet:prices')
    wx.switchTab({ url: '/pages/pet/pet' })
  },

  goChainPrices() {
    NAV.setPending('chain:prices')
    wx.switchTab({ url: '/pages/chain/chain' })
  }
})
