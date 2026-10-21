// 最小 wx 存储 mock，用于 Node 单测（不依赖小程序运行时）
const store = new Map()

global.wx = {
  getStorageSync(key) {
    return store.has(key) ? store.get(key) : ''
  },
  setStorageSync(key, value) {
    store.set(key, value)
  },
  removeStorageSync(key) {
    store.delete(key)
  },
  getStorageInfoSync() {
    return { keys: Array.from(store.keys()) }
  },
  clearStorageSync() {
    store.clear()
  }
}

function reset() {
  store.clear()
}

module.exports = { reset, store }
