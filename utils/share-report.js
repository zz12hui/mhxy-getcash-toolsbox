// 分享报表海报的数据模型（纯函数，方便单测）
const C = require('./constants')

function buildShareModel(input) {
  const o = input || {}
  const s = o.summary || {}
  const now = o.now || Date.now()
  const subtitle = [o.roleName || '全部角色', o.scopeLabel, o.toolLabel || '全部工具', o.periodLabel || '全部']
    .filter(Boolean)
    .join(' · ')
  return {
    brand: '梦幻搞钱工具箱',
    title: '收益报表',
    subtitle,
    dateStr: C.fmtDate(now).slice(0, 10),
    heroLabel: '累计净收益',
    heroValue: s.profitStr || '—',
    heroPos: s.profitPos !== false,
    roiStr: s.roiStr || '—',
    cards: [
      { label: '总投入', value: s.totalCostStr || '—', color: '#ff6bcb' },
      { label: '总产出', value: s.totalIncomeStr || '—', color: '#38f2c8' },
      { label: '净收益率', value: s.netRateStr || '—', color: '#8ba3bf' },
      { label: '平均时薪', value: s.hourlyStr || '—', color: '#ffc857' }
    ],
    meta: [
      { label: '轮次', value: (s.count || 0) + ' 轮' },
      { label: '正收益率', value: s.winRateStr || '—' },
      { label: '总工时', value: s.totalHoursStr || '—' },
      { label: '日均收益', value: s.dailyStr || '—' },
      { label: '月化收益', value: s.monthStr || '—' },
      { label: '目标时薪', value: s.targetStr || '—' }
    ],
    chartPoints: Array.isArray(o.chartPoints) ? o.chartPoints.slice() : [],
    footer: '数据来自本地收益账本 · 仅供娱乐参考'
  }
}

module.exports = { buildShareModel }
