const C = require('../../utils/constants')
const S = require('../../utils/storage')
const LEDGER = require('../../utils/ledger')
const MONEY = require('../../utils/money')

Page({
  data: {
    scope: 'role',
    tool: 'all',
    period: '7d',
    currency: 'wan',
    scopes: [
      { key: 'role', label: '当前角色' },
      { key: 'all', label: '全部角色' }
    ],
    tools: [
      { key: 'all', label: '全部工具' },
      { key: 'pet', label: '宠环' },
      { key: 'chain', label: '跑环' }
    ],
    periods: [
      { key: '7d', label: '近7天' },
      { key: '30d', label: '近30天' },
      { key: 'month', label: '本月' },
      { key: 'all', label: '全部' }
    ],
    activeUserName: '',
    roleCount: 0,
    moneyCfg: {},
    moneyInputs: { wanPerYuan: '', pointCostYuanPerHour: '', targetHourlyYuan: '' },
    showMoneySettings: false,
    summary: {},
    runList: [],
    unbookedCount: 0,
    hasRuns: false,
    showDetail: false,
    detailRun: null
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const users = S.getUsers() || []
    const activeUser = S.getActiveUser()
    const activeObj = users.find(u => u.id === activeUser) || users[0] || null
    const cfg = MONEY.getMoneyCfg()
    const currency = this.data.currency || 'wan'
    const runs = this.collectRuns(users, activeObj)
    const toolRuns = this.data.tool === 'all' ? runs : runs.filter(r => r._tool === this.data.tool)
    const filtered = LEDGER.filterRunsByPeriod(toolRuns, this.data.period)
    const agg = LEDGER.aggregateRuns(filtered)

    this._runMap = {}
    const runList = filtered
      .slice()
      .sort((a, b) => (b.doneAt || b.startedAt || 0) - (a.doneAt || a.startedAt || 0))
      .slice(0, 200)
      .map(r => {
        const key = r._tool + '_' + r.id
        this._runMap[key] = r
        return this.toRow(r, key, cfg, currency)
      })

    this.setData({
      activeUserName: activeObj ? activeObj.name : '未创建角色',
      roleCount: users.length,
      moneyCfg: cfg,
      moneyInputs: {
        wanPerYuan: String(cfg.wanPerYuan),
        pointCostYuanPerHour: String(cfg.pointCostYuanPerHour),
        targetHourlyYuan: String(cfg.targetHourlyYuan)
      },
      summary: this.buildSummary(agg, cfg, currency),
      runList,
      unbookedCount: agg.unbooked,
      hasRuns: filtered.length > 0
    })
    this._chartPoints = this.buildChartPoints(filtered)
    setTimeout(() => this.drawChart(), 300)
  },

  buildSummary(agg, cfg, currency) {
    const fmt = amount => MONEY.formatAmount(amount, cfg, currency)
    const alt = currency === 'wan' ? 'yuan' : 'wan'
    const hourlyYuan = agg.hourly != null ? MONEY.wanToYuan(agg.hourly / 10000, cfg) : null
    const pointCostLiang = (agg.totalHours || 0) * cfg.pointCostYuanPerHour * cfg.wanPerYuan * 10000
    const netAfterPoint = agg.totalProfit - pointCostLiang
    const targetGap = hourlyYuan != null ? hourlyYuan - cfg.targetHourlyYuan : null
    return {
      totalCostStr: fmt(agg.totalCost),
      totalIncomeStr: fmt(agg.totalIncome),
      profitStr: fmt(agg.totalProfit),
      profitPos: agg.totalProfit >= 0,
      roiStr: agg.roi != null && Number.isFinite(agg.roi) ? '1 : ' + agg.roi.toFixed(2) : '—',
      netRateStr: agg.netRate != null ? (agg.netRate * 100).toFixed(1) + '%' : '—',
      count: agg.count,
      unbooked: agg.unbooked,
      winRateStr: agg.winRate != null ? (agg.winRate * 100).toFixed(0) + '%' : '—',
      totalHoursStr: agg.totalHours ? agg.totalHours.toFixed(1) + ' 小时' : '—',
      hourlyStr: agg.hourly != null
        ? MONEY.formatHourly(agg.hourly, cfg, currency) + '（≈ ' + MONEY.formatHourly(agg.hourly, cfg, alt) + '）'
        : '—',
      hourlyYuanStr: hourlyYuan != null ? hourlyYuan.toFixed(1) + ' 元/时' : '—',
      dailyStr: fmt(agg.dailyAvgProfit),
      monthStr: fmt(agg.monthEstimate),
      avgProfitStr: fmt(agg.avgProfit),
      pointStr: agg.totalHours > 0 ? fmt(pointCostLiang) : '—',
      netAfterPointStr: agg.totalHours > 0 ? fmt(netAfterPoint) : '—',
      netAfterPointPos: netAfterPoint >= 0,
      targetStr: hourlyYuan != null
        ? (targetGap >= 0 ? '达标 +' + targetGap.toFixed(1) + ' 元/时' : '差 ' + Math.abs(targetGap).toFixed(1) + ' 元/时')
        : '—',
      targetHourlyYuan: cfg.targetHourlyYuan
    }
  },

  collectRuns(users, activeObj) {
    const out = []
    const addRole = (uid, name) => {
      if (!uid) return
      ;(S.getPetRuns(uid) || []).forEach(r => out.push(Object.assign({}, r, { _tool: 'pet', _roleName: name })))
      ;(S.getChainRuns(uid) || []).forEach(r => out.push(Object.assign({}, r, { _tool: 'chain', _roleName: name })))
    }
    if (this.data.scope === 'all') {
      users.forEach(u => addRole(u.id, u.name))
    } else if (activeObj) {
      addRole(activeObj.id, activeObj.name)
    }
    return out
  },

  toRow(run, key, cfg, currency) {
    const booked = LEDGER.isBooked(run)
    const doneAt = run.doneAt || run.startedAt || 0
    const comp = run.rings ? run.rings.filter(x => x.t).length : 0
    const total = run._tool === 'pet' ? 100 : 300
    const fmt = amount => MONEY.formatAmount(amount, cfg, currency)
    return {
      key,
      tool: run._tool,
      toolLabel: run._tool === 'pet' ? '宠环' : '跑环',
      roleName: run._roleName || '',
      level: run.level || '-',
      dateStr: doneAt ? C.fmtDate(doneAt).slice(5, 16) : '',
      compStr: comp + '/' + total,
      incomeStr: booked ? fmt(run.income) : '—',
      profitStr: booked ? fmt(run.profit) : '—',
      profitPos: booked ? Number(run.profit) >= 0 : true,
      roiStr: booked && run.roi != null ? '1 : ' + Number(run.roi).toFixed(2) : '—',
      unbooked: !booked
    }
  },

  buildChartPoints(runs) {
    return runs
      .filter(r => LEDGER.isBooked(r) && (r.doneAt || r.startedAt))
      .sort((a, b) => (a.doneAt || a.startedAt) - (b.doneAt || b.startedAt))
      .reduce((acc, r) => {
        const prev = acc.length ? acc[acc.length - 1] : 0
        acc.push(prev + Number(r.profit || 0))
        return acc
      }, [])
  },

  drawChart() {
    const points = this._chartPoints || []
    const query = wx.createSelectorQuery()
    query.select('#ledgerChart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = win.pixelRatio || 1
      canvas.width = res[0].width * dpr
      canvas.height = res[0].height * dpr
      ctx.scale(dpr, dpr)
      const w = res[0].width
      const h = res[0].height
      ctx.clearRect(0, 0, w, h)
      if (points.length < 2) {
        ctx.fillStyle = '#6b7d95'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('已记账轮次不足，继续跑环并结算后查看趋势', w / 2, h / 2)
        return
      }
      const pad = { l: 42, r: 12, t: 14, b: 22 }
      const pw = w - pad.l - pad.r
      const ph = h - pad.t - pad.b
      const max = Math.max.apply(null, points.concat([0]))
      const min = Math.min.apply(null, points.concat([0]))
      const range = max - min || 1
      const y = v => pad.t + ph - ((v - min) / range) * ph
      ctx.strokeStyle = '#1a2740'
      ctx.beginPath()
      ctx.moveTo(pad.l, y(0))
      ctx.lineTo(w - pad.r, y(0))
      ctx.stroke()
      ctx.strokeStyle = '#00d4aa'
      ctx.lineWidth = 2
      ctx.beginPath()
      points.forEach((v, i) => {
        const x = pad.l + (pw / (points.length - 1)) * i
        if (i === 0) ctx.moveTo(x, y(v))
        else ctx.lineTo(x, y(v))
      })
      ctx.stroke()
      const lastX = w - pad.r
      const lastY = y(points[points.length - 1])
      ctx.fillStyle = '#00d4aa'
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#6b7d95'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText((max / 10000).toFixed(0) + '万', 2, pad.t + 8)
      ctx.fillText((min / 10000).toFixed(0) + '万', 2, pad.t + ph)
    })
  },

  onScopeTap(e) { this.setData({ scope: e.currentTarget.dataset.s }); this.loadData() },
  onToolTap(e) { this.setData({ tool: e.currentTarget.dataset.t }); this.loadData() },
  onPeriodTap(e) { this.setData({ period: e.currentTarget.dataset.p }); this.loadData() },
  onCurrencyTap(e) { this.setData({ currency: e.currentTarget.dataset.c }); this.loadData() },

  openMoneySettings() {
    const cfg = this.data.moneyCfg
    this.setData({
      showMoneySettings: true,
      moneyInputs: {
        wanPerYuan: String(cfg.wanPerYuan),
        pointCostYuanPerHour: String(cfg.pointCostYuanPerHour),
        targetHourlyYuan: String(cfg.targetHourlyYuan)
      }
    })
  },

  closeMoneySettings() { this.setData({ showMoneySettings: false }) },

  noop() {},

  onMoneyInput(e) {
    const key = e.currentTarget.dataset.k
    const inputs = Object.assign({}, this.data.moneyInputs)
    inputs[key] = e.detail.value
    this.setData({ moneyInputs: inputs })
  },

  saveMoneySettings() {
    const i = this.data.moneyInputs
    const cfg = {
      wanPerYuan: parseFloat(i.wanPerYuan),
      pointCostYuanPerHour: parseFloat(i.pointCostYuanPerHour),
      targetHourlyYuan: parseFloat(i.targetHourlyYuan)
    }
    MONEY.saveMoneyCfg(cfg)
    this.setData({ showMoneySettings: false })
    this.loadData()
    wx.showToast({ title: '换算设置已保存', icon: 'none' })
  },

  resetMoneySettings() {
    MONEY.resetMoneyCfg()
    this.setData({ showMoneySettings: false })
    this.loadData()
    wx.showToast({ title: '已恢复默认换算', icon: 'none' })
  },

  openDetail(e) {
    const key = e.currentTarget.dataset.key
    const run = this._runMap && this._runMap[key]
    if (!run) return
    this.setData({ showDetail: true, detailRun: run })
  },

  closeDetail() {
    this.setData({ showDetail: false, detailRun: null })
  },

  goPet() { wx.switchTab({ url: '/pages/pet/pet' }) },
  goChain() { wx.switchTab({ url: '/pages/chain/chain' }) }
})
