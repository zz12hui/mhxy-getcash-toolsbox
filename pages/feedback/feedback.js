const CLOUD = require('../../utils/cloud')

Page({
  data: {
    content: '',
    contactInfo: '',
    submitting: false,
    submitted: false
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contactInfo: e.detail.value })
  },

  async submitFeedback() {
    const content = (this.data.content || '').trim()
    if (!content) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    try {
      const pages = getCurrentPages()
      const prevPage = pages.length > 1 ? pages[pages.length - 2].route : ''

      await CLOUD.callFunction('submitFeedback', {
        content,
        contactInfo: (this.data.contactInfo || '').trim(),
        pagePath: prevPage
      })

      wx.hideLoading()
      this.setData({ submitting: false, submitted: true })
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败: ' + (err.message || ''), icon: 'none' })
    }
  },

  resetAndGoBack() {
    wx.navigateBack()
  }
})
