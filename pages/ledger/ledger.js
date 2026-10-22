const C = require('../../utils/constants')
const S = require('../../utils/storage')
const LEDGER = require('../../utils/ledger')
const MONEY = require('../../utils/money')
const REPORT = require('../../utils/report-export')
const SHARE = require('../../utils/share-report')
const MOTION = require('../../utils/motion')

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
    sharing: false,
    docsError: '',
    statusBarHeight: 20,
    navRight: 90,
    reduceMotion: false,
    docsLoading: false,
    showDocsResult: false,
    docsResultUrl: '',
    docsResultTitle: '',
    docsResultWarning: '',
    showDetail: false,
    detailRun: null
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      let navRight = 90
      try {
        const rect = wx.getMenuButtonBoundingClientRect()
        if (rect && rect.left) navRight = Math.max(70, info.windowWidth - rect.left + 10)
      } catch (e) { /* 忽略胶囊信息失败 */ }
      this.setData({ statusBarHeight: info.statusBarHeight || 20, navRight, reduceMotion: MOTION.getReduceMotion() })
    } catch (e) { /* 忽略 */ }
  },

  onShow() {
    this.setData({ reduceMotion: MOTION.getReduceMotion() })
    this.loadData()
  },

  onHide() {
    this._stopChartAnim()
  },

  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
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
    this._filtered = filtered
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
      hourlyShortStr: agg.hourly != null
        ? (currency === 'wan'
          ? (agg.hourly / 10000).toFixed(0) + ' 万/时'
          : MONEY.wanToYuan(agg.hourly / 10000, cfg).toFixed(1) + ' 元/时')
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

  _stopChartAnim() {
    if (this._chartTimer) {
      clearTimeout(this._chartTimer)
      this._chartTimer = null
    }
  },

  drawChart() {
    this._stopChartAnim()
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

      const drawAt = progress => {
        ctx.clearRect(0, 0, w, h)
        if (!points.length) {
          ctx.fillStyle = '#6b7d95'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('还没有已记账轮次，先去结算一轮', w / 2, h / 2)
          return
        }
        const pad = { l: 42, r: 14, t: 16, b: 24 }
        const pw = w - pad.l - pad.r
        const ph = h - pad.t - pad.b
        const max = Math.max.apply(null, points.concat([0]))
        const min = Math.min.apply(null, points.concat([0]))
        const range = max - min || 1
        const y = v => pad.t + ph - ((v - min) / range) * ph

        ctx.strokeStyle = 'rgba(120,180,220,0.12)'
        ctx.lineWidth = 1
        for (let i = 0; i < 4; i++) {
          const yy = pad.t + (ph * i) / 3
          ctx.beginPath()
          ctx.moveTo(pad.l, yy)
          ctx.lineTo(w - pad.r, yy)
          ctx.stroke()
        }
        if (min < 0 && max > 0) {
          ctx.strokeStyle = 'rgba(139,163,191,0.35)'
          ctx.beginPath()
          ctx.moveTo(pad.l, y(0))
          ctx.lineTo(w - pad.r, y(0))
          ctx.stroke()
        }

        // 只有 1 轮：画一条基准线 + 单点，不再提示“轮次不足”
        if (points.length === 1) {
          const yy = y(points[0])
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = 'rgba(56,242,200,0.55)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(pad.l, yy)
          ctx.lineTo(w - pad.r, yy)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.arc(w - pad.r, yy, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#38f2c8'
          ctx.fill()
          ctx.fillStyle = '#8ba3bf'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('1 轮 · 累计', pad.l + 6, yy - 8)
          ctx.fillText((max / 10000).toFixed(1) + '万', 2, pad.t + 8)
          ctx.fillText((min / 10000).toFixed(1) + '万', 2, pad.t + ph)
          return
        }

        const n = points.length - 1
        const pos = Math.max(0, Math.min(n, n * progress))
        const idx = Math.floor(pos)
        const frac = pos - idx
        const xAt = i => pad.l + (pw / n) * i
        const segs = []
        for (let i = 0; i <= idx; i++) segs.push([xAt(i), y(points[i])])
        if (idx < n) {
          const x = pad.l + (pw / n) * pos
          const vy = points[idx] + (points[idx + 1] - points[idx]) * frac
          segs.push([x, y(vy)])
        }

        const areaGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph)
        areaGrad.addColorStop(0, 'rgba(56,242,200,0.30)')
        areaGrad.addColorStop(1, 'rgba(56,242,200,0)')
        ctx.beginPath()
        ctx.moveTo(segs[0][0], pad.t + ph)
        segs.forEach(s => ctx.lineTo(s[0], s[1]))
        ctx.lineTo(segs[segs.length - 1][0], pad.t + ph)
        ctx.closePath()
        ctx.fillStyle = areaGrad
        ctx.fill()

        ctx.beginPath()
        segs.forEach((s, i) => {
          if (i === 0) ctx.moveTo(s[0], s[1])
          else ctx.lineTo(s[0], s[1])
        })
        ctx.strokeStyle = '#38f2c8'
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.stroke()

        const last = segs[segs.length - 1]
        ctx.beginPath()
        ctx.arc(last[0], last[1], 4, 0, Math.PI * 2)
        ctx.fillStyle = '#38f2c8'
        ctx.fill()

        ctx.fillStyle = '#6b7d95'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText((max / 10000).toFixed(0) + '万', 2, pad.t + 8)
        ctx.fillText((min / 10000).toFixed(0) + '万', 2, pad.t + ph)
      }

      if (this.data.reduceMotion) {
        drawAt(1)
        return
      }

      let frame = 0
      const total = 24
      const tick = () => {
        frame += 1
        drawAt(Math.min(1, frame / total))
        if (frame < total) this._chartTimer = setTimeout(tick, 22)
      }
      drawAt(0)
      tick()
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

  createDocsReport() {
    if (this.data.docsLoading) return
    const runs = this._filtered || []
    if (!runs.filter(r => LEDGER.isBooked(r)).length) {
      wx.showToast({ title: '没有已记账轮次，先结算一轮', icon: 'none' })
      return
    }
    const rep = REPORT.buildReport(runs, {
      roleName: this.data.scope === 'all' ? '全部角色' : this.data.activeUserName,
      cfg: this.data.moneyCfg,
      currency: this.data.currency
    })
    this.setData({ docsLoading: true, docsError: '' })
    wx.cloud.callFunction({
      name: 'docsReport',
      data: { action: 'create', title: rep.title, rows: rep.rows }
    }).then(res => {
      const r = (res && res.result) || {}
      if (!r.ok) throw new Error(r.error || '生成失败')
      this.setData({
        docsLoading: false,
        showDocsResult: true,
        docsResultUrl: r.url || '',
        docsResultTitle: r.title || rep.title,
        docsResultWarning: r.shareWarning || ''
      })
    }).catch(err => {
      const msg = (err && err.message) || '请稍后重试'
      this.setData({ docsLoading: false, docsError: msg })
      wx.showModal({
        title: '生成腾讯文档失败',
        content: msg,
        showCancel: false
      })
    })
  },

  closeDocsResult() { this.setData({ showDocsResult: false }) },

  // ===== 分享报表（生成账本风格海报） =====
  renderShareImage(cb) {
    const runs = this._filtered || []
    if (!runs.filter(r => LEDGER.isBooked(r)).length) {
      wx.showToast({ title: '没有已记账轮次，先结算一轮', icon: 'none' })
      return
    }
    const tool = (this.data.tools.find(t => t.key === this.data.tool) || {}).label || '全部工具'
    const period = (this.data.periods.find(p => p.key === this.data.period) || {}).label || '全部'
    const model = SHARE.buildShareModel({
      summary: this.data.summary,
      roleName: this.data.scope === 'all' ? '全部角色' : this.data.activeUserName,
      scopeLabel: this.data.scope === 'all' ? '全部角色' : '当前角色',
      toolLabel: tool,
      periodLabel: period,
      chartPoints: this._chartPoints,
      now: Date.now()
    })
    this.drawSharePoster(model, cb)
  },

  drawSharePoster(model, cb) {
    const W = 750
    const H = 1180
    const query = wx.createSelectorQuery()
    query.select('#shareCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) { cb(null); return }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      canvas.width = W
      canvas.height = H

      const roundRect = (x, y, w, h, r) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
      }

      // 背景
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0b1220')
      bg.addColorStop(0.55, '#111c2e')
      bg.addColorStop(1, '#0a111d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      const glow = ctx.createRadialGradient(620, 160, 20, 620, 160, 520)
      glow.addColorStop(0, 'rgba(0,212,170,0.16)')
      glow.addColorStop(1, 'rgba(0,212,170,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, 760)

      // 页头
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '24px sans-serif'
      ctx.fillText(model.brand, 50, 70)
      ctx.textAlign = 'right'
      ctx.fillText(model.dateStr, W - 50, 70)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#e8eef7'
      ctx.font = 'bold 58px sans-serif'
      ctx.fillText(model.title, 50, 150)
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '24px sans-serif'
      ctx.fillText(model.subtitle, 50, 198)

      // 主卡：累计净收益 + ROI
      roundRect(50, 232, 650, 190, 24)
      ctx.fillStyle = 'rgba(0,212,170,0.08)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,212,170,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '24px sans-serif'
      ctx.fillText(model.heroLabel, 90, 288)
      ctx.fillStyle = model.heroPos ? '#00d4aa' : '#ff6b6b'
      ctx.font = 'bold 62px sans-serif'
      ctx.fillText(model.heroValue, 90, 372)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '22px sans-serif'
      ctx.fillText('投入产出比', W - 90, 288)
      ctx.fillStyle = '#e8eef7'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText(model.roiStr, W - 90, 340)
      ctx.textAlign = 'left'

      // 4 张小卡
      const cardW = 315
      const cardH = 118
      model.cards.forEach((c, i) => {
        const x = i % 2 === 0 ? 50 : 385
        const y = i < 2 ? 460 : 598
        roundRect(x, y, cardW, cardH, 20)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#8fa3bd'
        ctx.font = '22px sans-serif'
        ctx.fillText(c.label, x + 24, y + 40)
        ctx.fillStyle = c.color || '#e8eef7'
        ctx.font = 'bold 30px sans-serif'
        ctx.fillText(c.value, x + 24, y + 88)
      })

      // 指标
      model.meta.forEach((m, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = 50 + col * 340
        const y = 790 + row * 68
        ctx.fillStyle = '#8fa3bd'
        ctx.font = '21px sans-serif'
        ctx.fillText(m.label, x, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#c9d6e8'
        ctx.fillText(m.value, x + 300, y)
        ctx.textAlign = 'left'
      })

      // 累计净收益折线
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '22px sans-serif'
      ctx.fillText('累计净收益趋势', 50, 1000)
      const points = model.chartPoints || []
      if (points.length === 1) {
        const max = Math.max(points[0], 0)
        const min = Math.min(points[0], 0)
        const range = max - min || 1
        const cx0 = 50
        const cy0 = 1030
        const cw = 650
        const ch = 90
        const py = v => cy0 + ch - ((v - min) / range) * ch
        ctx.strokeStyle = 'rgba(56,242,200,0.55)'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 6])
        ctx.beginPath()
        ctx.moveTo(cx0, py(points[0]))
        ctx.lineTo(cx0 + cw, py(points[0]))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#38f2c8'
        ctx.beginPath()
        ctx.arc(cx0 + cw, py(points[0]), 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#8fa3bd'
        ctx.font = '20px sans-serif'
        ctx.fillText('1 轮 · 累计', cx0 + 6, py(points[0]) - 10)
      } else if (points.length >= 2) {
        const max = Math.max.apply(null, points.concat([0]))
        const min = Math.min.apply(null, points.concat([0]))
        const range = max - min || 1
        const cx0 = 50
        const cy0 = 1030
        const cw = 650
        const ch = 90
        const py = v => cy0 + ch - ((v - min) / range) * ch
        // 零轴
        ctx.strokeStyle = 'rgba(143,163,189,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx0, py(0))
        ctx.lineTo(cx0 + cw, py(0))
        ctx.stroke()
        // 折线
        ctx.strokeStyle = '#38f2c8'
        ctx.lineWidth = 3
        ctx.beginPath()
        points.forEach((v, i) => {
          const x = cx0 + (cw / (points.length - 1)) * i
          if (i === 0) ctx.moveTo(x, py(v))
          else ctx.lineTo(x, py(v))
        })
        ctx.stroke()
        // 末点
        ctx.fillStyle = '#38f2c8'
        ctx.beginPath()
        ctx.arc(cx0 + cw, py(points[points.length - 1]), 5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#6b7d95'
        ctx.font = '22px sans-serif'
        ctx.fillText('还没有已记账轮次，先去结算一轮', 50, 1075)
      }

      // 页脚
      ctx.textAlign = 'center'
      ctx.fillStyle = '#6b7d95'
      ctx.font = '21px sans-serif'
      ctx.fillText(model.footer, W / 2, 1145)
      ctx.textAlign = 'left'

      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: W,
          height: H,
          destWidth: W,
          destHeight: H,
          fileType: 'png',
          success: r => cb(r.tempFilePath),
          fail: () => cb(null)
        })
      }, 150)
    })
  },

  shareReport() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    this.renderShareImage(path => {
      this.setData({ sharing: false })
      if (!path) {
        wx.showModal({ title: '生成分享图失败', content: '请稍后重试', showCancel: false })
        return
      }
      this._shareImagePath = path
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({
          path,
          fail: () => this.previewShareImage(path)
        })
      } else {
        this.previewShareImage(path)
      }
    })
  },

  previewShareImage(path) {
    wx.previewImage({
      urls: [path],
      success: () => wx.showToast({ title: '长按图片可保存/转发', icon: 'none' })
    })
  },

  saveReportImage() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    this.renderShareImage(path => {
      this.setData({ sharing: false })
      if (!path) {
        wx.showModal({ title: '生成分享图失败', content: '请稍后重试', showCancel: false })
        return
      }
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => wx.showToast({ title: '已保存到相册', icon: 'none' }),
        fail: err => {
          if (String(err.errMsg || '').indexOf('auth') >= 0 || String(err.errMsg || '').indexOf('deny') >= 0) {
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许保存图片到相册',
              confirmText: '去设置',
              success: res => { if (res.confirm) wx.openSetting() }
            })
          } else {
            wx.showToast({ title: '保存失败，可长按图片保存', icon: 'none' })
          }
        }
      })
    })
  },


  copyDocsLink() {
    const url = this.data.docsResultUrl
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    })
  },

  openDocsMiniProgram() {
    const url = this.data.docsResultUrl
    if (!url) return
    const fallback = () => {
      if (!wx.navigateToMiniProgram) { this.copyDocsLink(); return }
      wx.navigateToMiniProgram({
        appId: 'wxd45c635d754dbf59',
        path: 'pages/detail/detail?url=' + encodeURIComponent(url),
        fail: () => {
          wx.setClipboardData({ data: url })
          wx.showToast({ title: '已复制链接，可粘贴打开', icon: 'none' })
        }
      })
    }
    // 优先半屏（需在小程序后台「第三方设置 → 半屏小程序管理」申请通过）
    if (wx.openEmbeddedMiniProgram) {
      wx.openEmbeddedMiniProgram({
        appId: 'wxd45c635d754dbf59',
        path: 'pages/detail/detail?url=' + encodeURIComponent(url),
        fail: fallback
      })
    } else {
      fallback()
    }
  },

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
  goChain() { wx.switchTab({ url: '/pages/chain/chain' }) },

  onShareAppMessage() {
    return {
      title: '我的梦幻收益报表',
      path: '/pages/ledger/ledger'
    }
  }
})
