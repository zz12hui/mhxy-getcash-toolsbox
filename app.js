const STORAGE = require('./utils/storage')

App({
  onLaunch() {
    // Init WeChat cloud
    if (wx.cloud) {
      wx.cloud.init({
        env: '<YOUR_CLOUD_ENV>',
        traceUser: true
      })
    }

    const users = STORAGE.getUsers()
    let activeUser = STORAGE.getActiveUser()

    if (!users.length) {
      const du = { id: 'user_' + Date.now(), name: '默认角色', createdAt: Date.now() }
      users.push(du)
      activeUser = du.id
      STORAGE.saveUsers(users)
      STORAGE.saveActiveUser(activeUser)
      // Migrate old global data if any
      const op = wx.getStorageSync('mhxy_runs') || wx.getStorageSync('mhxy_pet_ring_runs')
      const oc = wx.getStorageSync('mhxy_cur') || wx.getStorageSync('mhxy_pet_ring_current')
      const ocfg = wx.getStorageSync('mhxy_cfg') || wx.getStorageSync('mhxy_pet_ring_settings')
      const opr = wx.getStorageSync('mhxy_prices')
      if (ocfg) STORAGE.savePetCfg(activeUser, ocfg)
      if (oc) STORAGE.savePetCur(activeUser, oc)
      if (op) STORAGE.savePetRuns(activeUser, op)
      if (opr) STORAGE.savePetPrices(activeUser, opr)
      const keys = ['mhxy_runs', 'mhxy_cur', 'mhxy_cfg', 'mhxy_prices',
        'mhxy_pet_ring_settings', 'mhxy_pet_ring_current', 'mhxy_pet_ring_runs']
      keys.forEach(k => wx.removeStorageSync(k))
    }
    if (!users.find(u => u.id === activeUser)) {
      activeUser = users[0] ? users[0].id : null
      if (!activeUser) {
        const du = { id: 'user_' + Date.now(), name: '默认角色', createdAt: Date.now() }
        users.push(du)
        activeUser = du.id
        STORAGE.saveUsers(users)
      }
      STORAGE.saveActiveUser(activeUser)
    }

    // Load WeChat login state
    const wxProfile = STORAGE.getWxProfile()
    this.globalData.wxProfile = wxProfile
    this.globalData.isLoggedIn = !!wxProfile

    this.globalData.activeUser = activeUser
    this.globalData.users = users
    this.globalData.currentToolTab = wx.getStorageSync('mhxy_tool_tab') || 'pet'
  },

  globalData: {
    activeUser: null,
    users: [],
    wxProfile: null,
    isLoggedIn: false,
    currentToolTab: 'pet'
  }
})
