const CLOUD = require('../../utils/cloud')
const CACHE = require('../../utils/faq-cache')

Page({
  data: {
    loading: false,
    error: false,
    searchKeyword: '',
    activeCategoryId: null,
    page: 1,
    pageSize: 20,
    hasMore: false,

    // Pre-computed for WXML
    categoryTabs: [],
    itemList: [],
    totalStr: '',
    emptyText: '暂无相关知识条目',
    errorText: ''
  },

  onLoad() {
    this.loadCategories()
  },

  async loadCategories() {
    // Try cache first
    let cats = CACHE.getCached('categories')
    if (!cats) {
      cats = await CLOUD.fetchFaqCategories()
      if (cats.length) CACHE.setCache('categories', cats)
    }

    const allTab = { id: 'all', name: '全部', icon: '📚', activeClass: '', isAll: true, label: '📚 全部' }
    const tabs = [allTab]
    cats.forEach(c => {
      tabs.push({
        id: c._id,
        name: c.name,
        icon: c.icon || '📖',
        activeClass: '',
        isAll: false,
        label: (c.icon || '📖') + ' ' + c.name
      })
    })
    this.setData({ categoryTabs: tabs })
    this.setActiveTab('all')
    this.loadItems()
  },

  setActiveTab(catId) {
    const tabs = this.data.categoryTabs.map(t => ({
      ...t,
      activeClass: t.id === catId ? 'active' : ''
    }))
    this.setData({ categoryTabs: tabs, activeCategoryId: catId, page: 1 })
  },

  async loadItems(append) {
    const { activeCategoryId, searchKeyword, page, pageSize } = this.data
    const categoryId = activeCategoryId === 'all' ? null : activeCategoryId
    this.setData({ loading: true, error: false, errorText: '' })

    try {
      // Try cache for first page without search
      let result
      if (!searchKeyword && page === 1) {
        const cacheKey = 'items_' + (activeCategoryId || 'all')
        result = CACHE.getCached(cacheKey)
      }
      if (!result) {
        result = await CLOUD.fetchFaqItems({
          categoryId,
          search: searchKeyword,
          page,
          pageSize
        })
        if (!searchKeyword && page === 1) {
          const cacheKey = 'items_' + (activeCategoryId || 'all')
          CACHE.setCache(cacheKey, result)
        }
      }

      const itemList = (result.items || []).map(i => ({
        id: i._id,
        title: i.title || '',
        summary: i.summary || '',
        tagStr: i.tags ? i.tags.split(',').join(' · ') : '',
        isPinned: i.isPinned,
        viewStr: i.viewCount > 0 ? ('查看 ' + i.viewCount + ' 次') : '',
        pinnedClass: i.isPinned ? 'pinned' : ''
      }))

      const oldItems = append ? this.data.itemList : []
      this.setData({
        itemList: append ? oldItems.concat(itemList) : itemList,
        hasMore: itemList.length >= pageSize,
        totalStr: '共 ' + (result.total || itemList.length) + ' 条',
        loading: false
      })
    } catch (err) {
      this.setData({
        loading: false,
        error: true,
        errorText: '加载失败，请检查网络后重试',
        itemList: append ? this.data.itemList : []
      })
    }
  },

  onCategoryTap(e) {
    const catId = e.currentTarget.dataset.id
    this.setActiveTab(catId)
    this.loadItems()
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearch() {
    this.setData({ page: 1 })
    this.loadItems()
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', page: 1 })
    this.loadItems()
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/faq-detail/faq-detail?id=' + id })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 })
      this.loadItems(true)
    }
  },

  onRetry() {
    this.loadCategories()
  }
})
