Page({
  data: {
    tabs: [
      { key: 'privacy', label: '隐私政策' },
      { key: 'terms', label: '用户协议' }
    ],
    activeTab: 'privacy'
  },

  onLoad(options) {
    if (options && options.tab === 'terms') this.setData({ activeTab: 'terms' })
  },

  onTabTap(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key })
  }
})
