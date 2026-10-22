// 金价计算器：万两 ↔ 人民币，双向换算 + 比例配置
const MONEY = require('./money')

function defaultPair() {
  return { wan: MONEY.DEFAULT_RATIO.wan, yuan: MONEY.DEFAULT_RATIO.yuan }
}

function fmt(n, digits) {
  const d = digits === undefined ? 2 : digits
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  const fixed = num.toFixed(d)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function getPair(cfg) {
  const c = MONEY.normalize(cfg)
  return { wan: c.ratioWan, yuan: c.ratioYuan }
}

function pairToRatio(wan, yuan) {
  const w = Number(wan)
  const y = Number(yuan)
  if (!Number.isFinite(w) || !Number.isFinite(y) || w <= 0 || y <= 0) return null
  return w / y
}

function wanToYuan(wan, cfg) {
  const n = Number(wan)
  if (!Number.isFinite(n)) return 0
  return MONEY.wanToYuan(n, cfg)
}

function yuanToWan(yuan, cfg) {
  const n = Number(yuan)
  if (!Number.isFinite(n)) return 0
  return MONEY.yuanToWan(n, cfg)
}

function ratioText(cfg) {
  const c = MONEY.normalize(cfg)
  const pair = getPair(c)
  return fmt(pair.wan, 0) + ' 万两 = ' + fmt(pair.yuan, 2) + ' 元 · 1 元 ≈ ' + c.wanPerYuan.toFixed(2) + ' 万两'
}

module.exports = { defaultPair, fmt, getPair, pairToRatio, wanToYuan, yuanToWan, ratioText }
