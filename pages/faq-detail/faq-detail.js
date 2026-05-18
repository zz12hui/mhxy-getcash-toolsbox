const CLOUD = require('../../utils/cloud')
const CACHE = require('../../utils/faq-cache')

Page({
  data: {
    id: '',
    loading: true,
    error: false,
    errorText: '',

    // Pre-computed for WXML
    title: '',
    contentHtml: '',
    tagArr: [],
    hasTags: false,
    dateStr: '',
    viewStr: ''
  },

  onLoad(options) {
    const id = options.id
    if (!id) {
      this.setData({ loading: false, error: true, errorText: '参数错误' })
      return
    }
    this.setData({ id })
    this.loadDetail()
  },

  async loadDetail() {
    const { id } = this.data

    // Try cache first
    let item = CACHE.getCached('item_' + id)

    if (!item) {
      try {
        item = await CLOUD.fetchFaqItem(id)
        if (item) CACHE.setCache('item_' + id, item)
      } catch (err) {
        this.setData({
          loading: false,
          error: true,
          errorText: '加载失败，请检查网络后重试'
        })
        return
      }
    }

    if (!item) {
      this.setData({
        loading: false,
        error: true,
        errorText: '文章不存在或已删除'
      })
      return
    }

    const tagArr = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    const dateStr = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : ''

    this.setData({
      loading: false,
      title: item.title || '',
      contentHtml: item.contentHtml || '',
      tagArr,
      hasTags: tagArr.length > 0,
      dateStr,
      viewStr: item.viewCount > 0 ? ('已查看 ' + item.viewCount + ' 次') : ''
    })
  },

  onRetry() {
    this.setData({ loading: true, error: false })
    this.loadDetail()
  }
})
