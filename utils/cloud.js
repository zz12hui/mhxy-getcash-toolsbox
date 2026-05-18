// Cloud utility — wraps wx.cloud APIs for the mini-program

function getDb() {
  return wx.cloud.database()
}

function callFunction(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name, data })
      .then(res => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data)
        } else if (res.result && res.result.message) {
          reject(new Error(res.result.message))
        } else {
          resolve(res.result)
        }
      })
      .catch(err => {
        console.error('[cloud] callFunction error:', name, err)
        reject(new Error(err.errMsg || '云函数调用失败'))
      })
  })
}

function getWxContext() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name: 'login', data: {} })
      .then(res => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data)
        } else {
          reject(new Error(res.result ? res.result.message : '登录失败'))
        }
      })
      .catch(reject)
  })
}

// Fetch FAQ categories from cloud DB (public, no auth needed)
function fetchFaqCategories() {
  return getDb().collection('faq_categories')
    .where({ isActive: true })
    .orderBy('sortOrder', 'asc')
    .get()
    .then(res => res.data || [])
    .catch(err => {
      console.error('[cloud] fetchFaqCategories error:', err)
      return []
    })
}

// Fetch FAQ items with optional filters
function fetchFaqItems({ categoryId, search, page, pageSize } = {}) {
  const _ = getDb().command
  let query = getDb().collection('faq_items').where({ isActive: true })

  if (categoryId) {
    query = query.where({ categoryId, isActive: true })
  }
  if (search) {
    query = query.where(_.or([
      { title: getDb().RegExp({ regexp: search, options: 'i' }) },
      { summary: getDb().RegExp({ regexp: search, options: 'i' }) },
      { tags: getDb().RegExp({ regexp: search, options: 'i' }) }
    ]).and({ isActive: true }))
  }

  return query
    .orderBy('isPinned', 'desc')
    .orderBy('sortOrder', 'asc')
    .skip((page - 1) * pageSize || 0)
    .limit(pageSize || 20)
    .get()
    .then(res => {
      const items = res.data || []
      // Increment view count in background
      return { items, total: items.length }
    })
    .catch(err => {
      console.error('[cloud] fetchFaqItems error:', err)
      return { items: [], total: 0 }
    })
}

// Fetch single FAQ item
function fetchFaqItem(id) {
  return getDb().collection('faq_items').doc(id).get()
    .then(res => {
      const item = res.data
      if (item) {
        // Increment view count in background
        getDb().collection('faq_items').doc(id).update({
          data: { viewCount: getDb().command.inc(1) }
        }).catch(() => {})
      }
      return item
    })
}

// Get total count for FAQ items (for pagination)
function countFaqItems(categoryId) {
  let query = getDb().collection('faq_items').where({ isActive: true })
  if (categoryId) query = query.where({ categoryId, isActive: true })
  return query.count().then(res => res.total || 0).catch(() => 0)
}

module.exports = {
  getDb,
  callFunction,
  getWxContext,
  fetchFaqCategories,
  fetchFaqItems,
  fetchFaqItem,
  countFaqItems
}
