const CLOUD = require('../../utils/cloud')
const S = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    nickName: '',
    avatarUrl: '',
    phoneNumber: '',
    hasPhone: false,
    loggingIn: false,
    loginErr: ''
  },

  onShow() {
    this.refreshState()
  },

  refreshState() {
    const profile = S.getWxProfile()
    const isLoggedIn = !!profile
    this.setData({
      isLoggedIn,
      nickName: profile ? (profile.nickName || '微信用户') : '',
      avatarUrl: profile ? (profile.avatarUrl || '') : '',
      phoneNumber: profile ? (profile.phoneNumber || '') : '',
      hasPhone: profile ? !!profile.phoneNumber : false,
      loginErr: ''
    })
  },

  async doLogin() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true, loginErr: '' })

    try {
      wx.showLoading({ title: '连接中...', mask: true })
      const user = await CLOUD.callFunction('login', {})

      const profile = {
        openid: user.openid,
        nickName: user.nickName || '微信用户',
        avatarUrl: user.avatarUrl || '',
        phoneNumber: user.phoneNumber || '',
        isAdmin: !!user.isAdmin
      }
      S.saveWxProfile(profile)
      app.globalData.wxProfile = profile
      app.globalData.isLoggedIn = true

      wx.hideLoading()
      this.setData({ loggingIn: false })
      this.refreshState()
      wx.showToast({ title: '登录成功', icon: 'success' })

    } catch (err) {
      wx.hideLoading()
      this.setData({ loggingIn: false, loginErr: (err.message || '登录失败，请重试') })
    }
  },

  onGetPhone(e) {
    const code = e.detail.code
    if (!code) {
      // User declined or WeChat real-name verification not completed
      wx.showToast({ title: '手机号授权需在微信公众平台开通「手机号快速验证」能力', icon: 'none', duration: 3000 })
      return
    }

    wx.showLoading({ title: '获取中...', mask: true })
    CLOUD.callFunction('getPhone', { code })
      .then(data => {
        wx.hideLoading()
        const profile = S.getWxProfile() || {}
        profile.phoneNumber = data.phoneNumber || ''
        S.saveWxProfile(profile)
        app.globalData.wxProfile = profile
        this.refreshState()
        wx.showToast({ title: '已绑定 ' + data.phoneNumber, icon: 'success' })
      }).catch(err => {
        wx.hideLoading()
        wx.showToast({ title: '绑定失败: ' + (err.message || ''), icon: 'none', duration: 3000 })
      })
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    this.setData({ avatarUrl })
    const profile = S.getWxProfile() || {}
    profile.avatarUrl = avatarUrl
    S.saveWxProfile(profile)
    app.globalData.wxProfile = profile
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后云端数据不会丢失，下次登录可恢复',
      success: res => {
        if (res.confirm) {
          S.clearWxProfile()
          app.globalData.wxProfile = null
          app.globalData.isLoggedIn = false
          this.refreshState()
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      }
    })
  },

  onNickInput(e) {
    const nickName = e.detail.value
    this.setData({ nickName })
    const profile = S.getWxProfile() || {}
    profile.nickName = nickName
    S.saveWxProfile(profile)
    app.globalData.wxProfile = profile
  },

  goBack() {
    wx.navigateBack()
  }
})
