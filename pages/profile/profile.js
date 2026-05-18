const app = getApp()
const S = require('../../utils/storage')
const CLOUD = require('../../utils/cloud')

Page({
  data: {
    isLoggedIn: false,
    isAdmin: false,
    wxProfile: null,
    nickName: '',
    avatarUrl: '',

    lastSyncAtStr: '',
    isSyncing: false,

    users: [],
    activeUser: '',
    activeUserIndex: -1,
    activeUserName: '',
    userPickerRange: [],
    showDeleteConfirm: false,
    deleteTarget: null
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const profile = S.getWxProfile()
    const isLoggedIn = !!profile
    const users = S.getUsers()
    const activeUser = S.getActiveUser() || (users[0] ? users[0].id : '')
    const activeUserObj = users.find(u => u.id === activeUser)
    const activeUserIndex = users.findIndex(u => u.id === activeUser)
    const userPickerRange = users.map(u => u.name)

    const lastSync = S.getLastSyncAt()
    let lastSyncAtStr = '未同步'
    if (lastSync) {
      const d = new Date(lastSync)
      lastSyncAtStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
        ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }

    this.setData({
      isLoggedIn,
      isAdmin: profile ? !!profile.isAdmin : false,
      wxProfile: profile,
      nickName: profile ? (profile.nickName || '微信用户') : '',
      avatarUrl: profile ? (profile.avatarUrl || '') : '',
      lastSyncAtStr,
      users,
      activeUser,
      activeUserIndex,
      activeUserName: activeUserObj ? activeUserObj.name : '',
      userPickerRange
    })
  },

  onAccountTap() {
    if (!this.data.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
    }
  },

  async backupToCloud() {
    if (!this.data.isLoggedIn) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    this.setData({ isSyncing: true })
    wx.showLoading({ title: '备份中...' })
    try {
      const uid = app.globalData.activeUser
      const payload = {
        pet: { cfg: S.getPetCfg(uid), prices: S.getPetPrices(uid), runs: S.getPetRuns(uid), cur: S.getPetCur(uid) },
        chain: { cfg: S.getChainCfg(uid), prices: S.getChainPrices(uid), runs: S.getChainRuns(uid), cur: S.getChainCur(uid) }
      }
      const data = await CLOUD.callFunction('syncUpload', payload)
      S.saveLastSyncAt(data.syncedAt || Date.now())
      wx.hideLoading()
      this.setData({ isSyncing: false })
      this.loadData()
      wx.showToast({ title: '备份成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      this.setData({ isSyncing: false })
      wx.showToast({ title: '备份失败', icon: 'none' })
    }
  },

  async restoreFromCloud() {
    if (!this.data.isLoggedIn) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    wx.showModal({
      title: '恢复数据',
      content: '将从云端下载数据覆盖本地当前角色数据，确认？',
      success: async res => {
        if (!res.confirm) return
        wx.showLoading({ title: '恢复中...' })
        try {
          const data = await CLOUD.callFunction('syncDownload', {})
          const uid = app.globalData.activeUser
          if (data.pet) {
            if (data.pet.cfg) S.savePetCfg(uid, data.pet.cfg)
            if (data.pet.prices) S.savePetPrices(uid, data.pet.prices)
            if (data.pet.runs) S.savePetRuns(uid, data.pet.runs)
            if (data.pet.cur) S.savePetCur(uid, data.pet.cur)
          }
          if (data.chain) {
            if (data.chain.cfg) S.saveChainCfg(uid, data.chain.cfg)
            if (data.chain.prices) S.saveChainPrices(uid, data.chain.prices)
            if (data.chain.runs) S.saveChainRuns(uid, data.chain.runs)
            if (data.chain.cur) S.saveChainCur(uid, data.chain.cur)
          }
          if (data.syncedAt) S.saveLastSyncAt(data.syncedAt)
          wx.hideLoading()
          this.loadData()
          wx.showToast({ title: '恢复成功', icon: 'success' })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '恢复失败', icon: 'none' })
        }
      }
    })
  },

  // Simple role switch via picker
  onUserPickerChange(e) {
    const idx = parseInt(e.detail.value)
    const user = this.data.users[idx]
    if (!user || user.id === this.data.activeUser) return
    S.saveActiveUser(user.id)
    app.globalData.activeUser = user.id
    app.globalData.users = this.data.users
    this.loadData()
    wx.showToast({ title: '已切换到 ' + user.name, icon: 'none' })
  },

  goManual() { wx.navigateTo({ url: '/pages/manual/manual' }) },
  noop() {}
})
