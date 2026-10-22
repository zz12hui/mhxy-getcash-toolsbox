// 首页/我的页用的收益摘要（当前角色，全部周期）
const S = require('./storage')
const LEDGER = require('./ledger')
const MONEY = require('./money')

function getRoleRuns(uid) {
  if (!uid) return []
  const pet = (S.getPetRuns(uid) || []).map(r => Object.assign({}, r, { _tool: 'pet' }))
  const chain = (S.getChainRuns(uid) || []).map(r => Object.assign({}, r, { _tool: 'chain' }))
  return pet.concat(chain)
}

function getHomeSummary(opts) {
  const o = opts || {}
  const uid = o.uid || S.getActiveUser()
  const users = S.getUsers() || []
  const role = users.find(u => u.id === uid)
  const cfg = o.cfg && o.cfg.wanPerYuan ? o.cfg : MONEY.getMoneyCfg()
  const currency = o.currency || 'wan'
  const runs = getRoleRuns(uid)
  const filtered = LEDGER.filterRunsByPeriod(runs, o.period || 'all')
  const agg = LEDGER.aggregateRuns(filtered)
  const fmt = amount => MONEY.formatAmount(amount, cfg, currency)
  return {
    roleName: role ? role.name : '',
    hasData: agg.count > 0,
    count: agg.count,
    unbooked: agg.unbooked,
    profitStr: fmt(agg.totalProfit),
    profitPos: agg.totalProfit >= 0,
    roiStr: agg.roi != null && Number.isFinite(agg.roi) ? '1 : ' + agg.roi.toFixed(2) : '—',
    costStr: fmt(agg.totalCost),
    incomeStr: fmt(agg.totalIncome),
    hourlyStr: agg.hourly != null ? MONEY.formatHourly(agg.hourly, cfg, currency) : '—'
  }
}

// 首页迷你趋势：最近 N 轮累计净收益，归一化到 10~92（百分比高度）
// 只有 1 轮也返回一根柱子，避免首页看起来是空的
function getHomeChart(opts) {
  const o = opts || {}
  const uid = o.uid || S.getActiveUser()
  const count = o.count || 12
  const booked = getRoleRuns(uid)
    .filter(r => LEDGER.isBooked(r) && (r.doneAt || r.startedAt))
    .sort((a, b) => (a.doneAt || a.startedAt) - (b.doneAt || b.startedAt))
  if (!booked.length) return []
  let acc = 0
  const points = booked.map(r => {
    acc += Number(r.profit) || 0
    return acc
  }).slice(-count)
  if (points.length === 1) return [70]
  const min = Math.min.apply(null, points.concat([0]))
  const max = Math.max.apply(null, points.concat([0]))
  const range = max - min || 1
  return points.map(v => Math.round(10 + ((v - min) / range) * 82))
}

module.exports = { getRoleRuns, getHomeSummary, getHomeChart }
