// 收益记账核心：成本明细、收益估值、指标计算、周期过滤、汇总
// 纯函数（除 reward-prices 读 storage 外），可直接 Node 单测
const C = require('./constants')
const RING_COST = require('./ring-cost')
const REWARD_PRICES = require('./reward-prices')

function amount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function qty(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// 成本明细：按任务类型汇总（数量 × 单价）
function buildCostItems(rings, prices, defaults) {
  const map = new Map()
  ;(Array.isArray(rings) ? rings : []).forEach(ring => {
    if (!ring || !ring.t) return
    const tid = ring.t
    let item = map.get(tid)
    if (!item) {
      const def = C.pGetT(tid) || C.cGetT(tid)
      item = {
        tid,
        name: def ? def.name : tid,
        qty: 0,
        unitPrice: RING_COST.getPrice(prices, tid, defaults),
        amount: 0
      }
      map.set(tid, item)
    }
    item.qty += 1
    item.amount = item.unitPrice * item.qty
  })
  return Array.from(map.values())
}

// 把奖励文字解析成结构化奖励项：
//   150级制造指南书-剑 / 120级百炼精铁 / 160级战魄 / 修炼果 / 120灵饰指南书 / 120元灵晶石
function parseRewardText(text) {
  if (!text || typeof text !== 'string') return null
  const s = text.trim()
  if (!s) return null

  if (s === '战魄' || /^160级战魄$/.test(s)) return { kind: 'zhanpo', name: '160级战魄' }

  let m = s.match(/^(\d{2,3})级制造指南书(?:-(.+))?$/)
  if (m) return { kind: 'book', level: Number(m[1]), subType: m[2] || '', name: s }

  m = s.match(/^(\d{2,3})级百炼精铁$/)
  if (m) return { kind: 'iron', level: Number(m[1]), name: s }

  m = s.match(/^(\d{2,3})灵饰指南书$/)
  if (m) return { kind: 'lingshi_book', level: Number(m[1]), name: s }

  m = s.match(/^(\d{2,3})元灵晶石$/)
  if (m) return { kind: 'lingshi_stone', level: Number(m[1]), name: s }

  if (s === '修炼果') return { kind: 'xiulian_guo', name: s }
  if (s === '200修炼点') return { kind: 'xiulian_200', name: s }
  if (s === '3级家具设计图') return { kind: 'furniture3', name: s }

  return { kind: 'other', name: s }
}

// 逐项估值：有显式 unitPrice（用户改过价）就用，否则按价目表
function valueIncomeItems(items, prices) {
  return (Array.isArray(items) ? items : []).map(item => {
    if (!item || typeof item !== 'object') return null
    const manual = Number(item.unitPrice)
    const unitPrice = Number.isFinite(manual) && manual > 0
      ? manual
      : REWARD_PRICES.rewardUnitPrice(prices, item)
    const count = qty(item.qty)
    return Object.assign({}, item, {
      qty: count,
      unitPrice,
      amount: unitPrice * count
    })
  }).filter(Boolean)
}

function isBooked(run) {
  return !!(run && typeof run.income === 'number' && Array.isArray(run.incomeItems))
}

// 有效工作时长（分钟）：扣除暂停累计与当前暂停段
function effectiveDurationMin(opts, now) {
  const o = opts || {}
  const startedAt = Number(o.startedAt) || 0
  const doneAt = Number(o.doneAt) || 0
  const end = doneAt || Number(now) || Date.now()
  if (!startedAt || end <= startedAt) return null
  let ms = end - startedAt - amount(o.pausedMs)
  if (o.pausedAt) ms -= Math.max(0, end - Number(o.pausedAt))
  return Math.max(0, Math.round(ms / 60000))
}

// 单轮汇总：cost / income / profit / roi / netRate / durationMin / hourly
function summarizeRun(opts) {
  const o = opts || {}
  const costItems = buildCostItems(o.rings, o.prices, o.defaults)
  const baseCost = costItems.reduce((s, it) => s + it.amount, 0)
  const extraCost = amount(o.extraCost)
  const cost = baseCost + extraCost
  const incomeItems = valueIncomeItems(o.incomeItems, o.prices)
  const income = incomeItems.reduce((s, it) => s + it.amount, 0)
  const profit = income - cost
  const roi = cost > 0 ? income / cost : null
  const netRate = cost > 0 ? profit / cost : null
  const durationMin = effectiveDurationMin(o, o.now)
  const hourly = durationMin !== null && durationMin >= 5
    ? profit / (durationMin / 60)
    : null
  return {
    costItems,
    extraCost,
    cost,
    incomeItems,
    income,
    profit,
    roi,
    netRate,
    durationMin,
    hourly
  }
}

// 周期起点（毫秒）：7d / 30d / month / all
function periodStart(period, now) {
  const t = Number(now) || Date.now()
  if (period === '7d') {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).getTime()
  }
  if (period === '30d') {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).getTime()
  }
  if (period === 'month') {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }
  return null
}

function runTime(run) {
  return Number(run && (run.doneAt || run.settledAt)) || 0
}

function filterRunsByPeriod(runs, period, now) {
  const list = Array.isArray(runs) ? runs : []
  const start = periodStart(period, now)
  if (start === null) return list.slice()
  return list.filter(run => {
    const t = runTime(run)
    return t > 0 && t >= start
  })
}

function runCost(run) {
  if (!run) return 0
  if (typeof run.cost === 'number') return run.cost
  return amount(run.totalCost) + amount(run.extraCost)
}

// 多轮汇总（只统计已记账轮次；未记账单独计数）
function aggregateRuns(runs) {
  const list = Array.isArray(runs) ? runs : []
  const booked = list.filter(isBooked)
  const totalCost = booked.reduce((s, r) => s + runCost(r), 0)
  const totalIncome = booked.reduce((s, r) => s + amount(r.income), 0)
  const totalProfit = booked.reduce((s, r) => s + Number(r.profit || 0), 0)
  const count = booked.length
  const totalHours = booked.reduce((s, r) => {
    const d = Number(r.durationMin)
    return Number.isFinite(d) && d >= 5 ? s + d / 60 : s
  }, 0)
  const winCount = booked.filter(r => Number(r.profit) > 0).length
  const daySet = {}
  booked.forEach(r => {
    const t = runTime(r)
    if (!t) return
    const d = new Date(t)
    daySet[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()] = true
  })
  const activeDays = Object.keys(daySet).length
  const dailyAvgProfit = activeDays ? totalProfit / activeDays : null
  return {
    totalCost,
    totalIncome,
    totalProfit,
    count,
    unbooked: list.length - count,
    roi: totalCost > 0 ? totalIncome / totalCost : null,
    netRate: totalCost > 0 ? totalProfit / totalCost : null,
    avgProfit: count ? totalProfit / count : null,
    hourly: totalHours > 0 ? totalProfit / totalHours : null,
    totalHours,
    activeDays,
    dailyAvgProfit,
    monthEstimate: dailyAvgProfit === null ? null : dailyAvgProfit * 30,
    winRate: count ? winCount / count : null
  }
}

function formatWan(v, digits) {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return (n / 10000).toFixed(digits === undefined ? 1 : digits)
}

module.exports = {
  buildCostItems,
  parseRewardText,
  valueIncomeItems,
  isBooked,
  effectiveDurationMin,
  summarizeRun,
  periodStart,
  filterRunsByPeriod,
  runCost,
  aggregateRuns,
  formatWan
}
