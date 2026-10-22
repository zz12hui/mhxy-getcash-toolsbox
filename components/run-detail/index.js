const C = require('../../utils/constants')
const LEDGER = require('../../utils/ledger')
const MONEY = require('../../utils/money')

Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    show: { type: Boolean, value: false },
    run: { type: Object, value: null },
    tool: { type: String, value: 'pet' },
    moneyCfg: { type: Object, value: null },
    currency: { type: String, value: 'wan' }
  },

  data: {
    view: null
  },

  observers: {
    'show, run, tool, moneyCfg, currency': function (show, run, tool, moneyCfg, currency) {
      if (show && run) this.build(run, tool, moneyCfg, currency)
    }
  },

  methods: {
    build(run, tool, moneyCfg, currency) {
      const cfg = moneyCfg && moneyCfg.wanPerYuan ? moneyCfg : MONEY.getMoneyCfg()
      const cur = currency || 'wan'
      const fmt = amount => MONEY.formatAmount(amount, cfg, cur)
      const defaults = tool === 'pet' ? C.P_DEFAULT_PRICES : C.C_DEFAULT_PRICES
      const booked = LEDGER.isBooked(run)
      const costItems = Array.isArray(run.costItems) && run.costItems.length
        ? run.costItems
        : LEDGER.buildCostItems(run.rings, {}, defaults)
      const costRows = costItems.map(it => ({
        name: it.name || it.tid,
        qty: it.qty,
        unitStr: fmt(it.unitPrice || 0),
        amountStr: fmt(it.amount || 0)
      }))
      const incomeRows = (run.incomeItems || []).map(it => ({
        name: (it.seg ? '第' + it.seg + '环 ' : '') + (it.name || ''),
        qty: it.qty || 1,
        unitStr: fmt(it.unitPrice || 0),
        amountStr: fmt(it.amount || 0)
      }))
      const cost = typeof run.cost === 'number'
        ? run.cost
        : (run.totalCost || 0) + (run.extraCost || 0)
      const income = typeof run.income === 'number' ? run.income : null
      const profit = typeof run.profit === 'number' ? run.profit : null
      const roiStr = typeof run.roi === 'number' && Number.isFinite(run.roi)
        ? '1 : ' + run.roi.toFixed(2)
        : '—'
      const netRateStr = typeof run.netRate === 'number'
        ? (run.netRate * 100).toFixed(1) + '%'
        : '—'
      const durationStr = run.durationMin != null
        ? (run.durationMin >= 60
          ? Math.floor(run.durationMin / 60) + '小时' + (run.durationMin % 60) + '分'
          : run.durationMin + '分钟')
        : '—'
      const hourlyStr = typeof run.hourly === 'number'
        ? MONEY.formatHourly(run.hourly, cfg, cur) + '（≈ ' + MONEY.formatHourly(run.hourly, cfg, cur === 'wan' ? 'yuan' : 'wan') + '）'
        : '—'
      const comp = run.rings ? run.rings.filter(r => r.t).length : 0
      const total = tool === 'pet' ? 100 : 300
      const rewardStr = tool === 'pet'
        ? (run.reward || []).join(', ')
        : [100, 200, 300].map(seg => {
          const arr = (run.rewards && run.rewards[seg]) || []
          return '第' + seg + '环:' + (arr.join(',') || '未记录')
        }).join(' | ')
      this.setData({
        view: {
          title: tool === 'pet' ? '宠环轮次明细' : '跑环轮次明细',
          level: run.level || '-',
          comp: comp + '/' + total,
          dateStr: C.fmtDate(run.doneAt || run.startedAt || Date.now()),
          booked,
          rewardStr: rewardStr || '未记录',
          costRows,
          incomeRows,
          extraCostStr: fmt(run.extraCost || 0),
          extraCostShow: Number(run.extraCost || 0) > 0,
          costStr: fmt(cost),
          incomeStr: fmt(income),
          profitStr: fmt(profit),
          profitPos: profit === null ? true : profit >= 0,
          roiStr,
          netRateStr,
          durationStr,
          hourlyStr
        }
      })
    },

    onClose() {
      this.triggerEvent('close')
    },

    noop() {}
  }
})
