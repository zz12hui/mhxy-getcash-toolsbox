// 价格与费用计算（v1.2）
// 规则：用户自定义价格优先；显式设为 0 表示免费，不再回退默认价；缺省时才用默认价。

function toAmount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function getPrice(prices, tid, defaults) {
  if (!tid) return 0
  if (prices && Object.prototype.hasOwnProperty.call(prices, tid)) {
    return toAmount(prices[tid])
  }
  if (defaults && Object.prototype.hasOwnProperty.call(defaults, tid)) {
    return toAmount(defaults[tid])
  }
  return 0
}

function ringCost(ring, prices, defaults) {
  if (!ring || !ring.t) return 0
  return getPrice(prices, ring.t, defaults)
}

function totalCost(rings, prices, defaults) {
  if (!Array.isArray(rings)) return 0
  return rings.reduce((sum, ring) => sum + ringCost(ring, prices, defaults), 0)
}

module.exports = { getPrice, ringCost, totalCost, toAmount }
