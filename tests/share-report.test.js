const test = require('node:test')
const assert = require('node:assert/strict')
const SHARE = require('../utils/share-report')

test('分享海报模型：字段齐全', () => {
  const m = SHARE.buildShareModel({
    summary: {
      profitStr: '120.0 万两', profitPos: true, roiStr: '1 : 1.30', totalCostStr: '400.0 万两',
      totalIncomeStr: '520.0 万两', netRateStr: '30.0%',
      hourlyStr: '45.0 万两/时（≈ 3.0 元/时）',
      hourlyWanStr: '45.0 万两/时', hourlyYuanStr: '3.0 元/时',
      count: 8, winRateStr: '63%', totalHoursStr: '18.0 小时', dailyStr: '15.0 万两',
      monthStr: '450.0 万两', targetStr: '达标 +3.0 元/时'
    },
    roleName: '角色A',
    scopeLabel: '当前角色',
    toolLabel: '全部工具',
    periodLabel: '近30天',
    chartPoints: [0, 100, 50],
    now: new Date('2026-10-22T12:00:00+08:00').getTime()
  })
  assert.equal(m.brand, '梦幻搞钱工具箱')
  assert.equal(m.title, '收益报表')
  assert.ok(m.subtitle.indexOf('角色A') >= 0)
  assert.equal(m.heroValue, '120.0 万两')
  assert.equal(m.cards.length, 4)
  const hourly = m.cards[3]
  assert.equal(hourly.label, '平均时薪')
  assert.equal(hourly.lines.length, 2)
  assert.ok(hourly.lines[0].indexOf('万两/时') >= 0)
  assert.ok(hourly.lines[1].indexOf('≈') >= 0)
  assert.equal(m.meta.length, 6)
  assert.equal(m.chartPoints.length, 3)
  assert.equal(m.dateStr, '2026-10-22')
})

test('分享海报模型：空数据兜底', () => {
  const m = SHARE.buildShareModel({})
  assert.equal(m.heroValue, '—')
  assert.equal(m.cards[0].value, '—')
  assert.ok(m.cards[3].lines.length >= 1)
  assert.equal(m.subtitle, '全部角色 · 全部工具 · 全部')
})
