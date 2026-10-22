// 梦幻币换算配置（全局）：万两 ↔ 人民币、点卡成本、目标时薪
// 比例同时保存一对数（默认 3000 万两 = 202 元），便于设置页回显
const KEY = 'mhxy_money_cfg'

const DEFAULT_RATIO = { wan: 3000, yuan: 202 }

const DEFAULT_MONEY_CFG = {
  version: 2,
  wanPerYuan: DEFAULT_RATIO.wan / DEFAULT_RATIO.yuan,
  ratioWan: DEFAULT_RATIO.wan,
  ratioYuan: DEFAULT_RATIO.yuan,
  pointCostYuanPerHour: 0.4,
  targetHourlyYuan: 10
}

function toPositive(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function normalize(raw) {
  const d = DEFAULT_MONEY_CFG
  if (!raw || typeof raw !== 'object') {
    return {
      version: 2,
      wanPerYuan: d.wanPerYuan,
      ratioWan: d.ratioWan,
      ratioYuan: d.ratioYuan,
      pointCostYuanPerHour: d.pointCostYuanPerHour,
      targetHourlyYuan: d.targetHourlyYuan
    }
  }
  const out = {
    version: 2,
    wanPerYuan: d.wanPerYuan,
    ratioWan: d.ratioWan,
    ratioYuan: d.ratioYuan,
    pointCostYuanPerHour: toPositive(raw.pointCostYuanPerHour, d.pointCostYuanPerHour),
    targetHourlyYuan: toPositive(raw.targetHourlyYuan, d.targetHourlyYuan)
  }
  // 旧版本默认 12 万两/元：升级时直接迁移到新默认，避免沿用测试/占位值
  const legacyDefault = Number(raw.version || 1) < 2 && Number(raw.wanPerYuan) === 12
  if (legacyDefault) return out

  const wan = Number(raw.ratioWan)
  const yuan = Number(raw.ratioYuan)
  if (wan > 0 && yuan > 0) {
    out.ratioWan = wan
    out.ratioYuan = yuan
    out.wanPerYuan = wan / yuan
  } else if (Number(raw.wanPerYuan) > 0) {
    out.wanPerYuan = Number(raw.wanPerYuan)
    out.ratioWan = out.wanPerYuan
    out.ratioYuan = 1
  }
  return out
}

function getMoneyCfg() {
  try {
    const raw = wx.getStorageSync(KEY)
    if (raw && typeof raw === 'object') return normalize(raw)
  } catch (e) { /* ignore */ }
  const defaults = normalize(DEFAULT_MONEY_CFG)
  try { wx.setStorageSync(KEY, defaults) } catch (e) { /* ignore */ }
  return defaults
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
  DEFAULT_RATIO,
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
