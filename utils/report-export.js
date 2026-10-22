// 收益报表导出：把账本数据整理成腾讯文档多工作表
// 结构：总览 / 宠环明细 / 人环明细
const C = require('./constants')
const LEDGER = require('./ledger')
const MONEY = require('./money')

function toolLabel(tool) {
  return tool === 'chain' ? '人环' : '宠环'
}

function pct(v) {
  return v === null || v === undefined || !Number.isFinite(Number(v))
    ? '—'
    : (Number(v) * 100).toFixed(1) + '%'
}

function wanNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Number((n / 10000).toFixed(2)) : 0
}

function roiText(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v)) ? '1 : ' + Number(v).toFixed(2) : '—'
}

// 点卡成本（两）：有效工时 × 每小时点卡人民币 × 金价（万两/元）
function runPointCost(run, cfg) {
  const d = Number(run && run.durationMin)
  if (!Number.isFinite(d) || d < 5) return 0
  const c = cfg || MONEY.getMoneyCfg()
  return (d / 60) * c.pointCostYuanPerHour * c.wanPerYuan * 10000
}

function rewardSummary(run) {
  if (Array.isArray(run.reward) && run.reward.length) return run.reward.join('、')
  if (run.rewards && typeof run.rewards === 'object') {
    const parts = []
    ;[100, 200, 300].forEach(seg => {
      if (Array.isArray(run.rewards[seg]) && run.rewards[seg].length) {
        parts.push(seg + '环：' + run.rewards[seg].join('、'))
      }
    })
    if (parts.length) return parts.join('；')
  }
  if (Array.isArray(run.incomeItems)) {
    return run.incomeItems.map(i => i && i.name).filter(Boolean).join('、')
  }
  return ''
}

function detailHeader() {
  return [
    '序号', '类型', '结算时间', '角色', '等级', '完成/总环', '有效工时(分钟)',
    '任务成本(万两)', '点卡成本(万两)', '总成本(万两)', '产出(万两)',
    '净收益(扣点卡,万两)', 'ROI(扣点卡)', '净收益率(扣点卡)',
    '时薪(万两/时)', '时薪(元/时)', '账面净收益(万两)', '账面ROI',
    '奖励摘要', '备注'
  ]
}

function detailRow(r, index, cfg) {
  const taskCost = LEDGER.runCost(r)
  const pointCost = runPointCost(r, cfg)
  const totalCost = taskCost + pointCost
  const income = Number(r.income) || 0
  const net = income - totalCost
  const duration = Number(r.durationMin)
  const hours = Number.isFinite(duration) && duration >= 5 ? duration / 60 : 0
  const hourly = hours > 0 ? net / hours : null
  const hourlyYuan = hourly !== null ? MONEY.wanToYuan(hourly / 10000, cfg) : null
  const roi = totalCost > 0 ? income / totalCost : null
  const netRate = totalCost > 0 ? net / totalCost : null
  const bookProfit = Number(r.profit) || 0
  const doneAt = r.doneAt || r.startedAt || 0
  const comp = Array.isArray(r.rings) ? r.rings.filter(x => x.t).length : 0
  const total = r._tool === 'chain' ? 300 : 100
  const note = Number(r.pausedMs) > 0 ? '含暂停' : ''
  return {
    row: [
      index,
      toolLabel(r._tool),
      doneAt ? C.fmtDate(doneAt) : '',
      r._roleName || '',
      r.level || '',
      comp + '/' + total,
      Number.isFinite(duration) ? duration : '',
      wanNum(taskCost),
      wanNum(pointCost),
      wanNum(totalCost),
      wanNum(income),
      wanNum(net),
      roiText(roi),
      pct(netRate),
      hourly !== null ? Number((hourly / 10000).toFixed(2)) : '',
      hourlyYuan !== null ? Number(hourlyYuan.toFixed(1)) : '',
      wanNum(bookProfit),
      roiText(r.roi),
      rewardSummary(r),
      note
    ],
    taskCost,
    pointCost,
    income,
    net,
    duration: Number.isFinite(duration) ? duration : 0,
    bookProfit
  }
}

function buildDetailSheet(allRuns, cfg) {
  const rows = [detailHeader()]
  const totals = { taskCost: 0, pointCost: 0, income: 0, net: 0, duration: 0, bookProfit: 0, count: 0 }
  const sections = [
    { label: '宠环轮次', runs: allRuns.filter(r => r._tool === 'pet') },
    { label: '人环轮次', runs: allRuns.filter(r => r._tool === 'chain') }
  ]
  let index = 0
  let firstSection = true
  sections.forEach(section => {
    if (!firstSection) rows.push([])
    firstSection = false
    rows.push([section.label, '共 ' + section.runs.length + ' 轮'])
    if (!section.runs.length) {
      rows.push(['暂无已记账轮次'])
    }
    section.runs.forEach(r => {
      index += 1
      const item = detailRow(r, index, cfg)
      rows.push(item.row)
      totals.taskCost += item.taskCost
      totals.pointCost += item.pointCost
      totals.income += item.income
      totals.net += item.net
      totals.duration += item.duration
      totals.bookProfit += item.bookProfit
      totals.count += 1
    })
  })
  rows.push([])
  rows.push([
    '合计', '全部', '', '', '', '', Number(totals.duration.toFixed(1)),
    wanNum(totals.taskCost), wanNum(totals.pointCost), wanNum(totals.taskCost + totals.pointCost),
    wanNum(totals.income), wanNum(totals.net),
    roiText(totals.taskCost + totals.pointCost > 0 ? totals.income / (totals.taskCost + totals.pointCost) : null),
    pct(totals.taskCost + totals.pointCost > 0 ? totals.net / (totals.taskCost + totals.pointCost) : null),
    '', '', wanNum(totals.bookProfit), '', '', ''
  ])

  const colCount = detailHeader().length
  rows.forEach(row => {
    while (row.length < colCount) row.push('')
  })
  return { title: '轮次明细', rows, totals }
}

function overviewRows(booked, agg, cfg, opts, pointCostTotal) {
  const o = opts || {}
  const totalCostWithPoint = (agg.totalCost || 0) + pointCostTotal
  const netWithPoint = (agg.totalIncome || 0) - totalCostWithPoint
  const hours = agg.totalHours || 0
  const hourlyWan = hours > 0 ? netWithPoint / hours : null
  const hourlyYuan = hourlyWan !== null ? MONEY.wanToYuan(hourlyWan / 10000, cfg) : null
  const targetGap = hourlyYuan !== null ? hourlyYuan - cfg.targetHourlyYuan : null
  const petRuns = booked.filter(r => r._tool === 'pet')
  const chainRuns = booked.filter(r => r._tool === 'chain')
  const profitOf = list => list.reduce((s, r) => s + (Number(r.profit) || 0), 0)
  const pointOf = list => list.reduce((s, r) => s + runPointCost(r, cfg), 0)
  const netOf = list => profitOf(list) - pointOf(list)
  const scope = [o.scopeLabel, o.toolLabel, o.periodLabel].filter(Boolean).join(' · ')

  return [
    ['梦幻搞钱工具箱 · 收益报表'],
    ['生成时间', C.fmtDate(o.now || Date.now())],
    ['角色范围', o.roleName || '全部角色'],
    ['统计范围', scope || '全部数据'],
    ['币种说明', '金额单位：万两；时薪同时给出万两/时与元/时'],
    [],
    ['一、核心指标', '数值'],
    ['统计轮次', (agg.count || 0) + (agg.unbooked || 0)],
    ['已记账轮次', agg.count || 0],
    ['未记账轮次', agg.unbooked || 0],
    ['正收益率', pct(agg.winRate)],
    [],
    ['二、收益与成本', '数值'],
    ['任务成本(万两)', wanNum(agg.totalCost)],
    ['点卡成本(万两)', wanNum(pointCostTotal)],
    ['总成本(万两)', wanNum(totalCostWithPoint)],
    ['总产出(万两)', wanNum(agg.totalIncome)],
    ['净收益(未扣点卡,万两)', wanNum(agg.totalProfit)],
    ['净收益(扣点卡,万两)', wanNum(netWithPoint)],
    ['ROI(未扣点卡)', roiText(agg.roi)],
    ['ROI(扣点卡)', roiText(totalCostWithPoint > 0 ? agg.totalIncome / totalCostWithPoint : null)],
    ['净收益率(扣点卡)', pct(totalCostWithPoint > 0 ? netWithPoint / totalCostWithPoint : null)],
    [],
    ['三、工时与效率', '数值'],
    ['总有效工时(小时)', Number((hours || 0).toFixed(1))],
    ['平均时薪(万两/时)', hourlyWan !== null ? Number((hourlyWan / 10000).toFixed(2)) : '—'],
    ['平均时薪(元/时)', hourlyYuan !== null ? Number(hourlyYuan.toFixed(1)) : '—'],
    ['日均收益(万两)', agg.dailyAvgProfit !== null ? wanNum(agg.dailyAvgProfit) : '—'],
    ['月化收益(万两)', agg.monthEstimate !== null ? wanNum(agg.monthEstimate) : '—'],
    ['目标时薪(元/时)', cfg.targetHourlyYuan],
    ['目标差距(元/时)', targetGap !== null ? Number(targetGap.toFixed(1)) : '—'],
    [],
    ['四、玩法拆分', '轮次', '净收益(扣点卡,万两)'],
    ['宠环', petRuns.length, wanNum(netOf(petRuns))],
    ['人环', chainRuns.length, wanNum(netOf(chainRuns))],
    [],
    ['计算说明', 'ROI = 产出 ÷ 含点卡总成本；净收益率 = 净收益 ÷ 含点卡总成本；时薪 = 净收益 ÷ 有效工时。'],
    ['数据来源', '本地收益账本，仅供娱乐参考；点卡成本按设置的目标点卡价计算。']
  ]
}

// rawRuns：账本里的原始 run（带 _tool / _roleName）
// opts：{ roleName, scopeLabel, toolLabel, periodLabel, cfg, now }
function buildReport(rawRuns, opts) {
  const o = opts || {}
  const cfg = o.cfg && o.cfg.wanPerYuan ? o.cfg : MONEY.getMoneyCfg()
  const list = Array.isArray(rawRuns) ? rawRuns : []
  const booked = list.filter(LEDGER.isBooked)
    .slice()
    .sort((a, b) => (b.doneAt || b.startedAt || 0) - (a.doneAt || a.startedAt || 0))
  const agg = LEDGER.aggregateRuns(list)
  const pointCostTotal = booked.reduce((s, r) => s + runPointCost(r, cfg), 0)
  const overview = overviewRows(booked, agg, cfg, o, pointCostTotal)
  const detail = buildDetailSheet(booked, cfg).rows
  const rows = overview.concat([[]], [['轮次明细']], detail)

  const sheets = [
    { key: 'report', title: '收益报表', rows }
  ]

  const roleName = o.roleName || '全部角色'
  const titlePrefix = o.titlePrefix || '梦幻收益报表'
  const dateStr = C.fmtDate(o.now || Date.now()).slice(0, 10)
  const title = (titlePrefix + '-' + roleName + '-' + dateStr).slice(0, 36)
  return {
    title,
    sheets,
    summary: agg,
    totalPointCost: pointCostTotal,
    totalCostWithPoint: (agg.totalCost || 0) + pointCostTotal,
    netWithPoint: (agg.totalIncome || 0) - ((agg.totalCost || 0) + pointCostTotal)
  }
}

module.exports = { buildReport, runPointCost, rewardSummary }
