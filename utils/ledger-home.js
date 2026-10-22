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

module.exports = { getRoleRuns, getHomeSummary }
