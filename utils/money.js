// 梦幻币换算配置（全局）：万两 ↔ 人民币、点卡成本、目标时薪
const KEY = 'mhxy_money_cfg'

const DEFAULT_MONEY_CFG = {
  version: 1,
  wanPerYuan: 12, // 1 元 ≈ 12 万两（可按区服修改）
  pointCostYuanPerHour: 0.4, // 点卡 0.4 元/小时（4点/小时）
  targetHourlyYuan: 10 // 目标时薪（元/小时）
}

function toPositive(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function normalize(raw) {
  const d = DEFAULT_MONEY_CFG
  if (!raw || typeof raw !== 'object') return Object.assign({}, d)
  return {
    version: 1,
    wanPerYuan: toPositive(raw.wanPerYuan, d.wanPerYuan),
    pointCostYuanPerHour: toPositive(raw.pointCostYuanPerHour, d.pointCostYuanPerHour),
    targetHourlyYuan: toPositive(raw.targetHourlyYuan, d.targetHourlyYuan)
  }
}

function getMoneyCfg() {
  try {
    const raw = wx.getStorageSync(KEY)
    if (raw && typeof raw === 'object') return normalize(raw)
  } catch (e) { /* ignore */ }
  const d = Object.assign({}, DEFAULT_MONEY_CFG)
  try { wx.setStorageSync(KEY, d) } catch (e) { /* ignore */ }
  return d
}

function saveMoneyCfg(cfg) {
  try {
    wx.setStorageSync(KEY, normalize(cfg))
    return true
  } catch (e) {
    return false
  }
}

function resetMoneyCfg() {
  return saveMoneyCfg(DEFAULT_MONEY_CFG)
}

// 万两 → 元
function wanToYuan(wan, cfg) {
  const c = normalize(cfg)
  const n = Number(wan)
  if (!Number.isFinite(n)) return null
  return n / c.wanPerYuan
}

// 元 → 万两
function yuanToWan(yuan, cfg) {
  const c = normalize(cfg)
  const n = Number(yuan)
  if (!Number.isFinite(n)) return null
  return n * c.wanPerYuan
}

// 金额（两）格式化：currency = 'wan' | 'yuan'
function formatAmount(amountLiang, cfg, currency) {
  if (amountLiang === null || amountLiang === undefined) return '—'
  const n = Number(amountLiang)
  if (!Number.isFinite(n)) return '—'
  const wan = n / 10000
  if (currency === 'yuan') {
    return wanToYuan(wan, cfg).toFixed(2) + ' 元'
  }
  return wan.toFixed(1) + ' 万两'
}

// 时薪（两/小时）格式化
function formatHourly(hourlyLiang, cfg, currency) {
  if (hourlyLiang === null || hourlyLiang === undefined) return '—'
  return formatAmount(hourlyLiang, cfg, currency) + '/时'
}

module.exports = {
  DEFAULT_MONEY_CFG,
  getMoneyCfg,
  saveMoneyCfg,
  resetMoneyCfg,
  normalize,
  wanToYuan,
  yuanToWan,
  formatAmount,
  formatHourly
}
