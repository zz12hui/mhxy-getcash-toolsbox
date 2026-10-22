// 奖励价目表（按角色）：书/铁/灵饰/战魄/特殊奖励的参考价
// 价格单位：两（银子），展示时换算成"万"
const KEY = 'mhxy_reward_prices_'

const DEFAULT_REWARD_PRICES = {
  version: 1,
  books: { 80: 200000, 90: 350000, 100: 1000000, 110: 1500000, 120: 4000000, 130: 10000000, 140: 20000000, 150: 50000000 },
  irons: { 80: 120000, 90: 200000, 100: 600000, 110: 900000, 120: 2400000, 130: 6000000, 140: 12000000, 150: 30000000 },
  zhanpo: 80000000,
  lingshi: { 120: 3000000, 140: 12000000 },
  items: {
    xiulian_guo: 500000,
    xiulian_200: 600000,
    furniture3: 2000000
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function toAmount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// 把任意历史数据补齐成完整结构（缺项用默认价）
function normalize(raw) {
  const d = clone(DEFAULT_REWARD_PRICES)
  if (!raw || typeof raw !== 'object') return d
  const out = {
    version: 1,
    books: Object.assign({}, d.books, raw.books || {}),
    irons: Object.assign({}, d.irons, raw.irons || {}),
    lingshi: Object.assign({}, d.lingshi, raw.lingshi || {}),
    items: Object.assign({}, d.items, raw.items || {}),
    zhanpo: toAmount(raw.zhanpo) || d.zhanpo
  }
  Object.keys(out.books).forEach(k => { out.books[k] = toAmount(out.books[k]) })
  Object.keys(out.irons).forEach(k => { out.irons[k] = toAmount(out.irons[k]) })
  Object.keys(out.lingshi).forEach(k => { out.lingshi[k] = toAmount(out.lingshi[k]) })
  Object.keys(out.items).forEach(k => { out.items[k] = toAmount(out.items[k]) })
  return out
}

function getRewardPrices(uid) {
  try {
    const raw = wx.getStorageSync(KEY + uid)
    if (raw && typeof raw === 'object') return normalize(raw)
  } catch (e) { /* ignore */ }
  const defaults = clone(DEFAULT_REWARD_PRICES)
  try { wx.setStorageSync(KEY + uid, defaults) } catch (e) { /* ignore */ }
  return defaults
}

function saveRewardPrices(uid, prices) {
  try {
    wx.setStorageSync(KEY + uid, normalize(prices))
    return true
  } catch (e) {
    return false
  }
}

function resetRewardPrices(uid) {
  return saveRewardPrices(uid, DEFAULT_REWARD_PRICES)
}

// 单个奖励项的单价（两）；book/iron/lingshi 按等级，特殊奖励按 kind
function rewardUnitPrice(prices, item) {
  if (!item) return 0
  const table = normalize(prices)
  const level = Number(item.level) || 0
  switch (item.kind) {
    case 'book': return toAmount(table.books[level])
    case 'iron': return toAmount(table.irons[level])
    case 'zhanpo': return toAmount(table.zhanpo)
    case 'lingshi_book':
    case 'lingshi_stone': return toAmount(table.lingshi[level])
    case 'xiulian_guo':
    case 'xiulian_200':
    case 'furniture3': return toAmount(table.items[item.kind])
    default: return toAmount(item.unitPrice)
  }
}

module.exports = {
  DEFAULT_REWARD_PRICES,
  getRewardPrices,
  saveRewardPrices,
  resetRewardPrices,
  normalize,
  rewardUnitPrice
}
