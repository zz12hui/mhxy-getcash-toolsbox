const app = getApp()

Component({
  data: {
    selected: 0,
    list: []
  },

  lifetimes: {
    attached() {
      this.rebuild()
    }
  },

  pageLifetimes: {
    show() {
      this.rebuild()
    }
  },

  methods: {
    rebuild() {
      const pages = getCurrentPages()
      const route = pages.length > 0 ? pages[pages.length - 1].route : ''
      const toolTab = app.globalData.currentToolTab || wx.getStorageSync('mhxy_tool_tab') || 'pet'

      // Build 3-tab display: 首页 | 当前工具 | 个人中心
      const toolItem = toolTab === 'chain'
        ? { pagePath: '/pages/chain/chain', text: '跑环助手', icon: '📜' }
        : { pagePath: '/pages/pet/pet', text: '宠环助手', icon: '🐾' }

      const list = [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        toolItem,
        { pagePath: '/pages/profile/profile', text: '我的', icon: '👤' }
      ]

      let selected = 0
      if (route === 'pages/index/index') selected = 0
      else if (route === 'pages/pet/pet' || route === 'pages/chain/chain') selected = 1
      else if (route === 'pages/profile/profile') selected = 2

      this.setData({ selected, list })
    },

    switchTab(e) {
      const path = e.currentTarget.dataset.path
      const index = e.currentTarget.dataset.index

      // Update tool tab in globalData when switching to middle tab
      if (index === 1) {
        const toolTab = path.includes('chain') ? 'chain' : 'pet'
        app.globalData.currentToolTab = toolTab
        wx.setStorageSync('mhxy_tool_tab', toolTab)
      }

      wx.switchTab({ url: path })
    }
  }
})
