// 收益报表导出：把账本数据整理成腾讯文档在线表格的行
const C = require('./constants')
const LEDGER = require('./ledger')
const MONEY = require('./money')

function toolLabel(tool) {
  return tool === 'chain' ? '跑环' : '宠环'
}

function pct(v) {
  return v === null || v === undefined || !Number.isFinite(Number(v))
    ? '—'
    : (Number(v) * 100).toFixed(1) + '%'
}

// rawRuns：账本里的原始 run（带 _tool / _roleName）
// opts：{ roleName, cfg, currency, titlePrefix, now }
function buildReport(rawRuns, opts) {
  const o = opts || {}
  const cfg = o.cfg && o.cfg.wanPerYuan ? o.cfg : MONEY.getMoneyCfg()
  const currency = o.currency || 'wan'
  const fmt = amount => MONEY.formatAmount(amount, cfg, currency)
  const list = Array.isArray(rawRuns) ? rawRuns : []
  const booked = list.filter(LEDGER.isBooked)
    .slice()
    .sort((a, b) => (b.doneAt || b.startedAt || 0) - (a.doneAt || a.startedAt || 0))
  const agg = LEDGER.aggregateRuns(list)

  const header = ['结算时间', '角色', '工具', '等级', '完成环数', '投入', '产出', '净收益', '投入产出比', '净收益率', '用时(分钟)', '时薪']
  const rows = booked.map(r => {
    const doneAt = r.doneAt || r.startedAt || 0
    const comp = r.rings ? r.rings.filter(x => x.t).length : 0
    const total = r._tool === 'chain' ? 300 : 100
    return [
      C.fmtDate(doneAt),
      o.roleName || r._roleName || '',
      toolLabel(r._tool),
      r.level || '',
      comp + '/' + total,
      fmt(LEDGER.runCost(r)),
      fmt(r.income),
      fmt(r.profit),
      r.roi != null && Number.isFinite(Number(r.roi)) ? '1 : ' + Number(r.roi).toFixed(2) : '—',
      pct(r.netRate),
      r.durationMin != null ? r.durationMin : '—',
      typeof r.hourly === 'number' ? MONEY.formatHourly(r.hourly, cfg, currency) : '—'
    ]
  })

  rows.push([])
  rows.push([
    '汇总（' + agg.count + ' 轮）', '', '', '', '',
    fmt(agg.totalCost),
    fmt(agg.totalIncome),
    fmt(agg.totalProfit),
    agg.roi != null ? '1 : ' + agg.roi.toFixed(2) : '—',
    pct(agg.netRate),
    agg.totalHours ? agg.totalHours.toFixed(1) : '—',
    typeof agg.hourly === 'number' ? MONEY.formatHourly(agg.hourly, cfg, currency) : '—'
  ])
  rows.push(['正收益率', pct(agg.winRate), '未记账轮次', agg.unbooked, '生成时间', C.fmtDate(o.now || Date.now())])

  const roleName = o.roleName || '全部角色'
  const titlePrefix = o.titlePrefix || '梦幻收益报表'
  const dateStr = C.fmtDate(o.now || Date.now()).slice(0, 10)
  const title = (titlePrefix + '-' + roleName + '-' + dateStr).slice(0, 36)
  return { title, header, rows: [header].concat(rows), summary: agg }
}

module.exports = { buildReport }
