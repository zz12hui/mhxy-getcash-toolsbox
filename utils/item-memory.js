// 物品名记忆：输入过的物品名做成候选，减少重复打字

const MAX_ITEMS = 8
const KEY = 'mhxy_items_'

function getAll(uid) {
  try {
    const raw = wx.getStorageSync(KEY + uid)
    return Array.isArray(raw) ? raw.filter(Boolean).slice(0, MAX_ITEMS) : []
  } catch (e) {
    return []
  }
}

function add(uid, name) {
  const value = String(name || '').trim().slice(0, 24)
  if (!uid || !value) return getAll(uid)
  const list = getAll(uid).filter(item => item !== value)
  list.unshift(value)
  const next = list.slice(0, MAX_ITEMS)
  try { wx.setStorageSync(KEY + uid, next) } catch (e) { /* ignore */ }
  return next
}

module.exports = { getAll, add }
