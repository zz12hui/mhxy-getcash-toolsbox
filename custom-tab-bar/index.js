Component({
  data: {
    selected: 0,
    hidden: false,
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
      const list = [
        { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
        { pagePath: '/pages/pet/pet', text: '宠环', icon: '🐾' },
        { pagePath: '/pages/chain/chain', text: '跑环', icon: '📜' },
        { pagePath: '/pages/profile/profile', text: '我的', icon: '👤' }
      ]
      let selected = 0
      if (route === 'pages/index/index') selected = 0
      else if (route === 'pages/pet/pet') selected = 1
      else if (route === 'pages/chain/chain') selected = 2
      else if (route === 'pages/profile/profile') selected = 3
      this.setData({ selected, list })
    },

    switchTab(e) {
      wx.switchTab({ url: e.currentTarget.dataset.path })
    }
  }
})

