const CLOUD = require('../../utils/cloud')
const S = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    nickName: '',
    avatarUrl: '',
    loggingIn: false,
    loginErr: ''
  },

  onShow() {
    this.refreshState()
  },

  refreshState() {
    const profile = S.getWxProfile()
    const isLoggedIn = !!profile
    // 手机号能力已下线：清理历史版本可能残留的本地手机号
    if (profile && profile.phoneNumber) {
      delete profile.phoneNumber
      S.saveWxProfile(profile)
    }
    this.setData({
      isLoggedIn,
      nickName: profile ? (profile.nickName || '微信用户') : '',
      avatarUrl: profile ? (profile.avatarUrl || '') : '',
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

  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl
    if (!tempUrl) return
    const profile = S.getWxProfile() || {}
    this.setData({ avatarUrl: tempUrl })

    const saveLocal = url => {
      profile.avatarUrl = url
      S.saveWxProfile(profile)
      app.globalData.wxProfile = profile
      this.setData({ avatarUrl: url })
    }

    // 头像先上传到云存储，避免临时路径在重启后失效
    if (!wx.cloud || !profile.openid) { saveLocal(tempUrl); return }
    wx.showLoading({ title: '上传头像...', mask: true })
    wx.cloud.uploadFile({
      cloudPath: 'avatars/' + profile.openid + '_' + Date.now() + '.png',
      filePath: tempUrl
    }).then(res => {
      wx.hideLoading()
      saveLocal(res.fileID || tempUrl)
    }).catch(err => {
      wx.hideLoading()
      console.error('[login] upload avatar failed:', err)
      saveLocal(tempUrl)
      wx.showToast({ title: '头像已更换（未上传云端）', icon: 'none' })
    })
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

  onPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy?tab=privacy' })
  },

  onTerms() {
    wx.navigateTo({ url: '/pages/privacy/privacy?tab=terms' })
  },

  goBack() {
    wx.navigateBack()
  }
})
