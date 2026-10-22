const app = getApp()
const S = require('../../utils/storage')
const CLOUD = require('../../utils/cloud')
const HOME = require('../../utils/ledger-home')
const MOTION = require('../../utils/motion')
const TABBAR = require('../../utils/tabbar')

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
    roleCount: 0,
    activeUser: '',
    activeUserIndex: -1,
    activeUserName: '',
    userPickerRange: [],
    reduceMotion: false,
    ledgerSummary: { hasData: false, profitStr: '0.0 万两', profitPos: true, roiStr: '—', costStr: '0.0 万两', incomeStr: '0.0 万两', count: 0, hourlyStr: '—' }
  },

  onShow() {
    this.loadData()
    TABBAR.syncTabBar(this, 3)
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
      roleCount: users.length,
      activeUser,
      activeUserIndex,
      activeUserName: activeUserObj ? activeUserObj.name : '',
      userPickerRange,
      reduceMotion: MOTION.getReduceMotion(),
      ledgerSummary: this.getLedgerSummary()
    })
  },

  getLedgerSummary() {
    try {
      return HOME.getHomeSummary({ period: 'all' })
    } catch (e) {
      return { hasData: false, profitStr: '0.0 万两', profitPos: true, roiStr: '—', costStr: '0.0 万两', incomeStr: '0.0 万两', count: 0, hourlyStr: '—' }
    }
  },

  formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },

  // v1.2：登录后也能进入账号页（改头像/昵称/退出登录）
  onAccountTap() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async backupToCloud() {
    if (!this.data.isLoggedIn) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    if (this.data.isSyncing) return
    const roles = S.exportAllRoles()
    if (!roles.length) { wx.showToast({ title: '没有可备份的角色', icon: 'none' }); return }
    if (roles.length > 10) { wx.showToast({ title: '最多备份 10 个角色，请先导出多余角色', icon: 'none' }); return }
    this.setData({ isSyncing: true })
    wx.showLoading({ title: '备份中...', mask: true })
    try {
      const data = await CLOUD.callFunction('syncUpload', { roles })
      S.saveLastSyncAt((data && data.syncedAt) || Date.now())
      wx.hideLoading()
      this.setData({ isSyncing: false })
      this.loadData()
      wx.showToast({ title: '已备份 ' + roles.length + ' 个角色', icon: 'none' })
    } catch (err) {
      wx.hideLoading()
      this.setData({ isSyncing: false })
      wx.showToast({ title: err.message || '备份失败', icon: 'none' })
    }
  },

  restoreFromCloud() {
    if (!this.data.isLoggedIn) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    wx.showLoading({ title: '读取备份...', mask: true })
    CLOUD.callFunction('syncDownload', {})
      .then(data => {
        wx.hideLoading()
        const roles = (data && data.roles) || []
        if (!roles.length) {
          wx.showToast({
            title: data && data.legacy ? '云端是旧版备份，请先重新备份一次' : '云端还没有备份',
            icon: 'none'
          })
          return
        }
        const lines = roles.map(r => r.name + ' · ' + this.formatTime(r.updatedAt)).join('\n')
        wx.showModal({
          title: '从云端恢复',
          content: '云端共 ' + roles.length + ' 个角色：\n' + lines +
            '\n\n将用云端数据覆盖本地全部角色，建议先备份。确定恢复？',
          confirmText: '覆盖恢复',
          success: res => {
            if (res.confirm) this.doRestore(roles, data.syncedAt)
          }
        })
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: err.message || '读取备份失败', icon: 'none' })
      })
  },

  doRestore(roles, syncedAt) {
    wx.showLoading({ title: '恢复中...', mask: true })
    try {
      if (!S.applyAllRoles(roles)) throw new Error('写入本地失败，可能是存储空间不足')
      app.globalData.users = S.getUsers()
      app.globalData.activeUser = S.getActiveUser()
      if (syncedAt) S.saveLastSyncAt(syncedAt)
      wx.hideLoading()
      this.loadData()
      wx.showToast({ title: '已恢复 ' + roles.length + ' 个角色', icon: 'none' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '恢复失败', icon: 'none' })
    }
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

  toggleReduceMotion(e) {
    const v = !!(e && e.detail && e.detail.value)
    MOTION.setReduceMotion(v)
    this.setData({ reduceMotion: v })
    wx.showToast({ title: v ? '已开启精简动效' : '已恢复完整动效', icon: 'none' })
  },

  goManual() { wx.navigateTo({ url: '/pages/manual/manual' }) },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  goLedger() { wx.navigateTo({ url: '/pages/ledger/ledger' }) },
  noop() {}
})
