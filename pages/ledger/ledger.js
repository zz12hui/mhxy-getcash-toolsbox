const C = require('../../utils/constants')
const S = require('../../utils/storage')
const LEDGER = require('../../utils/ledger')

Page({
  data: {
    scope: 'role',
    tool: 'all',
    period: '7d',
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
        return this.toRow(r, key)
      })

    const summary = {
      totalCostWan: LEDGER.formatWan(agg.totalCost),
      totalIncomeWan: LEDGER.formatWan(agg.totalIncome),
      profitWan: LEDGER.formatWan(agg.totalProfit),
      profitPos: agg.totalProfit >= 0,
      roiStr: agg.roi != null && Number.isFinite(agg.roi) ? '1 : ' + agg.roi.toFixed(2) : '—',
      netRateStr: agg.netRate != null ? (agg.netRate * 100).toFixed(1) + '%' : '—',
      hourlyStr: agg.hourly != null ? LEDGER.formatWan(agg.hourly) + '万/时' : '—',
      avgProfitWan: LEDGER.formatWan(agg.avgProfit),
      winRateStr: agg.winRate != null ? (agg.winRate * 100).toFixed(0) + '%' : '—',
      count: agg.count,
      unbooked: agg.unbooked
    }

    this.setData({
      activeUserName: activeObj ? activeObj.name : '未创建角色',
      roleCount: users.length,
      summary,
      runList,
      unbookedCount: agg.unbooked,
      hasRuns: filtered.length > 0
    })
    this._chartPoints = this.buildChartPoints(filtered)
    setTimeout(() => this.drawChart(), 300)
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

  toRow(run, key) {
    const booked = LEDGER.isBooked(run)
    const doneAt = run.doneAt || run.startedAt || 0
    const comp = run.rings ? run.rings.filter(x => x.t).length : 0
    const total = run._tool === 'pet' ? 100 : 300
    return {
      key,
      tool: run._tool,
      toolLabel: run._tool === 'pet' ? '宠环' : '跑环',
      roleName: run._roleName || '',
      level: run.level || '-',
      dateStr: doneAt ? C.fmtDate(doneAt).slice(5, 16) : '',
      compStr: comp + '/' + total,
      incomeWan: booked ? LEDGER.formatWan(run.income) : '—',
      profitWan: booked ? LEDGER.formatWan(run.profit) : '—',
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
      // 零轴
      ctx.strokeStyle = '#1a2740'
      ctx.beginPath()
      ctx.moveTo(pad.l, y(0))
      ctx.lineTo(w - pad.r, y(0))
      ctx.stroke()
      // 折线
      ctx.strokeStyle = '#00d4aa'
      ctx.lineWidth = 2
      ctx.beginPath()
      points.forEach((v, i) => {
        const x = pad.l + (pw / (points.length - 1)) * i
        if (i === 0) ctx.moveTo(x, y(v))
        else ctx.lineTo(x, y(v))
      })
      ctx.stroke()
      // 末点
      const lastX = w - pad.r
      const lastY = y(points[points.length - 1])
      ctx.fillStyle = '#00d4aa'
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()
      // 轴标注（万）
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
