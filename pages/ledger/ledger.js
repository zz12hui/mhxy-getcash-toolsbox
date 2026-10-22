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
      { key: 'chain', label: '人环' }
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
    pageSize: 20,
    page: 1,
    pageCount: 1,
    listTotal: 0,
    chartImage: '',
    unbookedCount: 0,
    hasRuns: false,
    sharing: false,
    docsError: '',
    statusBarHeight: 20,
    navRight: 90,
    reduceMotion: false,
    scrollIntoView: '',
    docsLoading: false,
    docsBound: false,
    docsBindingTitle: '',
    docsBindingUrl: '',
    docsResultMode: '',
    docsResultSheets: '',
    docsResultRows: 0,
    showDocsResult: false,
    docsResultUrl: '',
    docsResultTitle: '',
    docsResultWarning: '',
    showDetail: false,
    detailRun: null
  },

  onLoad() {
    this.initNavMetrics()
  },

  onResize() {
    this.initNavMetrics()
  },

  initNavMetrics() {
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
    const allRows = filtered
      .slice()
      .sort((a, b) => (b.doneAt || b.startedAt || 0) - (a.doneAt || a.startedAt || 0))
      .map(r => {
        const key = r._tool + '_' + r.id
        this._runMap[key] = r
        return this.toRow(r, key, cfg, currency)
      })
    this._allRows = allRows

    const total = allRows.length
    const pageSize = this.data.pageSize || 20
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(Math.max(1, this.data.page || 1), pageCount)
    const pageRows = allRows.slice((page - 1) * pageSize, page * pageSize)
    const binding = S.getDocsBinding(activeUser)

    this.setData({
      activeUserName: activeObj ? activeObj.name : '未创建角色',
      activeUserId: activeUser || '',
      roleCount: users.length,
      moneyCfg: cfg,
      moneyInputs: {
        wanPerYuan: String(cfg.wanPerYuan),
        pointCostYuanPerHour: String(cfg.pointCostYuanPerHour),
        targetHourlyYuan: String(cfg.targetHourlyYuan)
      },
      summary: this.buildSummary(agg, cfg, currency),
      runList: pageRows,
      page,
      pageCount,
      listTotal: total,
      docsBound: !!(binding && binding.fileID),
      docsBindingTitle: binding && binding.title ? binding.title : '',
      docsBindingUrl: binding && binding.url ? binding.url : '',
      docsResultUrl: binding && binding.url ? binding.url : '',
      unbookedCount: agg.unbooked,
      hasRuns: filtered.length > 0
    })
    this._chartPoints = this.buildChartPoints(filtered)
    if (!this._chartPoints.length) {
      this.setData({ chartImage: '' })
    } else {
      setTimeout(() => this.drawChart(), 120)
    }
  },

  applyPage() {
    const all = this._allRows || []
    const pageSize = this.data.pageSize || 20
    const pageCount = Math.max(1, Math.ceil(all.length / pageSize))
    const page = Math.min(Math.max(1, this.data.page || 1), pageCount)
    this.setData({
      page,
      pageCount,
      listTotal: all.length,
      runList: all.slice((page - 1) * pageSize, page * pageSize)
    })
  },

  prevPage() {
    if (this.data.page <= 1) return
    this.setData({ page: this.data.page - 1 })
    this.applyPage()
  },

  nextPage() {
    if (this.data.page >= this.data.pageCount) return
    this.setData({ page: this.data.page + 1 })
    this.applyPage()
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
      hourlyWanStr: agg.hourly != null ? (agg.hourly / 10000).toFixed(1) + ' 万两/时' : '—',
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
      toolLabel: run._tool === 'pet' ? '宠环' : '人环',
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
    query.select('#chartCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      canvas.width = 650
      canvas.height = 320
      const w = 650
      const h = 320

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

      drawAt(1)
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: 650,
          height: 320,
          destWidth: 650,
          destHeight: 320,
          fileType: 'png',
          success: r => this.setData({ chartImage: r.tempFilePath }),
          fail: () => { /* 保底：保留上一张图 */ }
        })
      }, 80)
    })
  },

  onScopeTap(e) { this.setData({ scope: e.currentTarget.dataset.s, page: 1 }); this.loadData() },
  onToolTap(e) { this.setData({ tool: e.currentTarget.dataset.t, page: 1 }); this.loadData() },
  onPeriodTap(e) { this.setData({ period: e.currentTarget.dataset.p, page: 1 }); this.loadData() },
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
    this.syncDocsReport(false)
  },

  regenerateDocsReport() {
    const uid = this.data.activeUserId || S.getActiveUser()
    S.clearDocsBinding(uid)
    this.setData({ docsBound: false, docsBindingTitle: '' })
    this.syncDocsReport(true)
  },

  syncDocsReport(forceCreate) {
    if (this.data.docsLoading) return
    const runs = this._filtered || []
    if (!runs.filter(r => LEDGER.isBooked(r)).length) {
      wx.showToast({ title: '没有已记账轮次，先结算一轮', icon: 'none' })
      return
    }
    const toolLabel = (this.data.tools.find(t => t.key === this.data.tool) || {}).label || '全部工具'
    const periodLabel = (this.data.periods.find(p => p.key === this.data.period) || {}).label || '全部'
    const roleName = this.data.scope === 'all' ? '全部角色' : this.data.activeUserName
    const rep = REPORT.buildReport(runs, {
      roleName,
      scopeLabel: this.data.scope === 'all' ? '全部角色' : '当前角色',
      toolLabel,
      periodLabel,
      cfg: this.data.moneyCfg,
      now: Date.now()
    })
    const uid = this.data.activeUserId || S.getActiveUser()
    const binding = forceCreate ? null : S.getDocsBinding(uid)
    const canUpdate = !!(binding && binding.fileID && Array.isArray(binding.sheets) && binding.sheets.length)
    const sentSheets = rep.sheets.map(sheet => {
      const old = canUpdate ? binding.sheets.find(x => x && x.title === sheet.title) : null
      return {
        title: sheet.title,
        rows: sheet.rows,
        sheetID: old ? old.sheetID : '',
        prevRows: old ? (old.rowCount || 0) : 0
      }
    })

    const call = extra => wx.cloud.callFunction({
      name: 'docsReport',
      data: Object.assign({ title: rep.title }, extra)
    })

    const finish = (result, mode) => {
      const data = result || {}
      const outSheets = Array.isArray(data.sheets) && data.sheets.length
        ? data.sheets
        : sentSheets.map(s => ({ title: s.title, sheetID: s.sheetID, rowCount: s.rows.length }))
      const record = {
        fileID: data.fileID || (binding && binding.fileID) || '',
        sheetID: data.sheetID || (outSheets[0] && outSheets[0].sheetID) || '',
        url: data.url || (binding && binding.url) || '',
        title: data.title || rep.title,
        sheets: outSheets,
        rowCount: outSheets.reduce((sum, s) => sum + (Number(s.rowCount) || 0), 0),
        updatedAt: Date.now()
      }
      S.saveDocsBinding(uid, record)
      this.setData({
        docsLoading: false,
        showDocsResult: true,
        docsResultMode: mode,
        docsResultUrl: record.url,
        docsResultTitle: record.title,
        docsResultSheets: outSheets.map(s => s.title).join(' / '),
        docsResultRows: record.rowCount,
        docsResultWarning: data.shareWarning || '',
        docsBound: true,
        docsBindingTitle: record.title,
        docsBindingUrl: record.url
      })
    }

    const createNew = () => call({
      action: 'create',
      sheets: rep.sheets.map(s => ({ title: s.title, rows: s.rows }))
    }).then(res => {
      const r = (res && res.result) || {}
      if (!r.ok) throw new Error(r.error || '生成失败')
      finish(r, '已生成')
    })

    this.setData({ docsLoading: true, docsError: '' })
    const task = canUpdate
      ? call({
        action: 'update',
        fileID: binding.fileID,
        sheets: sentSheets.map(s => ({
          title: s.title,
          rows: s.rows,
          sheetID: s.sheetID,
          prevRows: s.prevRows
        }))
      }).then(res => {
        const r = (res && res.result) || {}
        if (!r.ok) throw new Error(r.error || '更新失败')
        finish(r, '已更新')
      }).catch(() => createNew())
      : createNew()

    task.catch(err => {
      const msg = (err && err.message) || '请稍后重试'
      this.setData({ docsLoading: false, docsError: msg })
      wx.showModal({
        title: '同步腾讯文档失败',
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
    this.ensureWxacode().then(qrPath => this.drawSharePoster(model, qrPath, cb))
  },

  ensureWxacode() {
    if (this._wxacodePath) return Promise.resolve(this._wxacodePath)
    try {
      const cached = wx.getStorageSync('mhxy_wxacode_file')
      if (cached) {
        try {
          wx.getFileSystemManager().accessSync(cached)
          this._wxacodePath = cached
          return Promise.resolve(cached)
        } catch (e) {
          wx.removeStorageSync('mhxy_wxacode_file')
        }
      }
    } catch (e) { /* 忽略 */ }
    if (!wx.cloud || !wx.cloud.callFunction) return Promise.resolve(null)
    return wx.cloud.callFunction({
      name: 'wxacode',
      data: { page: 'pages/index/index', scene: 'share' }
    }).then(res => {
      const r = (res && res.result) || {}
      if (!r.ok || !r.buffer) throw new Error(r.error || '生成小程序码失败')
      const filePath = wx.env.USER_DATA_PATH + '/share_wxacode.png'
      return new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
          filePath,
          data: r.buffer,
          encoding: 'base64',
          success: () => {
            this._wxacodePath = filePath
            try { wx.setStorageSync('mhxy_wxacode_file', filePath) } catch (e) { /* 忽略 */ }
            resolve(filePath)
          },
          fail: reject
        })
      })
    }).catch(() => null)
  },

  drawSharePoster(model, qrPath, cb) {
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

      // 文字宽度自适应：缩字号 / 换行 / 省略号
      const fitSize = (text, maxWidth, start, min, bold) => {
        let size = start
        while (size > min) {
          ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif'
          if (ctx.measureText(text).width <= maxWidth) break
          size -= 2
        }
        return size
      }
      const ellipsis = (text, maxWidth) => {
        const str = String(text)
        if (ctx.measureText(str).width <= maxWidth) return str
        let out = str
        while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1)
        return out + '…'
      }
      const wrapText = (text, maxWidth, maxLines, font) => {
        ctx.font = font
        const chars = Array.from(String(text))
        const lines = []
        let cur = ''
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i]
          if (lines.length >= maxLines) break
          if (cur && ctx.measureText(cur + ch).width > maxWidth) {
            lines.push(cur)
            cur = ch
          } else {
            cur += ch
          }
        }
        if (cur && lines.length < maxLines) lines.push(cur)
        if (lines.length === maxLines && lines.join('').length < chars.length) {
          lines[maxLines - 1] = ellipsis(lines[maxLines - 1] + '…', maxWidth)
        }
        return lines
      }
      const exportImage = () => {
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
        }, 100)
      }

      // 背景
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#060a12')
      bg.addColorStop(0.55, '#0a1322')
      bg.addColorStop(1, '#0b1524')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      const glow = ctx.createRadialGradient(620, 160, 20, 620, 160, 520)
      glow.addColorStop(0, 'rgba(56,242,200,0.18)')
      glow.addColorStop(1, 'rgba(56,242,200,0)')
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
      const titleSize = fitSize(model.title, 650, 58, 38, true)
      ctx.font = 'bold ' + titleSize + 'px sans-serif'
      ctx.fillText(ellipsis(model.title, 650), 50, 150)
      ctx.fillStyle = '#8fa3bd'
      const subLines = wrapText(model.subtitle, 650, 2, '24px sans-serif')
      subLines.forEach((line, i) => ctx.fillText(line, 50, 198 + i * 28))

      // 主卡：累计净收益 + ROI
      roundRect(50, 232, 650, 190, 24)
      ctx.fillStyle = 'rgba(56,242,200,0.08)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(56,242,200,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '24px sans-serif'
      ctx.fillText(model.heroLabel, 90, 288)
      ctx.fillStyle = model.heroPos ? '#38f2c8' : '#ff6b6b'
      const heroSize = fitSize(model.heroValue, 400, 62, 36, true)
      ctx.font = 'bold ' + heroSize + 'px sans-serif'
      ctx.fillText(ellipsis(model.heroValue, 400), 90, 372)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#8fa3bd'
      ctx.font = '22px sans-serif'
      ctx.fillText('投入产出比', W - 90, 288)
      ctx.fillStyle = '#e8eef7'
      const roiSize = fitSize(model.roiStr, 180, 34, 22, true)
      ctx.font = 'bold ' + roiSize + 'px sans-serif'
      ctx.fillText(ellipsis(model.roiStr, 180), W - 90, 340)
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
        ctx.fillText(ellipsis(c.label, cardW - 48), x + 24, y + 40)
        ctx.fillStyle = c.color || '#e8eef7'
        const cardLines = (Array.isArray(c.lines) && c.lines.length ? c.lines : [c.value]).filter(Boolean)
        if (cardLines.length > 1) {
          cardLines.forEach((line, li) => {
            const size = fitSize(line, cardW - 48, 22, 16, true)
            ctx.font = 'bold ' + size + 'px sans-serif'
            ctx.fillText(ellipsis(line, cardW - 48), x + 24, y + 72 + li * 26)
          })
        } else {
          const valMax = cardW - 48
          let valSize = fitSize(cardLines[0] || '', valMax, 30, 22, true)
          ctx.font = 'bold ' + valSize + 'px sans-serif'
          let valLines = wrapText(cardLines[0] || '', valMax, 2, 'bold ' + valSize + 'px sans-serif')
          if (valLines.length > 1 && valSize > 24) {
            valSize = 24
            ctx.font = 'bold ' + valSize + 'px sans-serif'
            valLines = wrapText(cardLines[0] || '', valMax, 2, 'bold ' + valSize + 'px sans-serif')
          }
          if (valLines.length > 1) {
            ctx.font = 'bold ' + valSize + 'px sans-serif'
            valLines.forEach((line, li) => ctx.fillText(line, x + 24, y + 72 + li * (valSize + 6)))
          } else {
            ctx.fillText(valLines[0] || '', x + 24, y + 88)
          }
        }
      })

      // 指标
      model.meta.forEach((m, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = 50 + col * 340
        const y = 790 + row * 68
        ctx.fillStyle = '#8fa3bd'
        const labelLines = wrapText(m.label, 140, 2, '21px sans-serif')
        ctx.font = '21px sans-serif'
        labelLines.forEach((line, li) => ctx.fillText(line, x, y - (labelLines.length > 1 ? 6 : 0) + li * 20))
        ctx.textAlign = 'right'
        ctx.fillStyle = '#c9d6e8'
        const valueLines = wrapText(m.value, 155, 2, '19px sans-serif')
        ctx.font = '19px sans-serif'
        valueLines.forEach((line, li) => ctx.fillText(line, x + 300, y - (valueLines.length > 1 ? 6 : 0) + li * 20))
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
        const cw = 520
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
        const cw = 520
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

      // 页脚 + 小程序码
      ctx.textAlign = 'left'
      ctx.fillStyle = '#6b7d95'
      const footerLines = wrapText(model.footer, 500, 2, '20px sans-serif')
      ctx.font = '20px sans-serif'
      footerLines.forEach((line, i) => ctx.fillText(line, 50, 1130 + i * 22))
      ctx.textAlign = 'left'

      const drawQr = img => {
        roundRect(582, 990, 138, 138, 16)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.drawImage(img, 590, 998, 122, 122)
        ctx.fillStyle = '#8fa3bd'
        ctx.font = '18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('长按识别小程序', 651, 1150)
        ctx.textAlign = 'left'
      }

      if (qrPath) {
        const qrImg = canvas.createImage()
        qrImg.onload = () => {
          drawQr(qrImg)
          exportImage()
        }
        qrImg.onerror = () => exportImage()
        qrImg.src = qrPath
      } else {
        exportImage()
      }
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
