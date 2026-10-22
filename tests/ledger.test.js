const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('../utils/ledger')

test('奖励文字解析', () => {
  assert.deepEqual(L.parseRewardText('150级制造指南书-剑'), { kind: 'book', level: 150, subType: '剑', name: '150级制造指南书-剑' })
  assert.deepEqual(L.parseRewardText('120级百炼精铁'), { kind: 'iron', level: 120, name: '120级百炼精铁' })
  assert.deepEqual(L.parseRewardText('160级战魄'), { kind: 'zhanpo', name: '160级战魄' })
  assert.deepEqual(L.parseRewardText('修炼果'), { kind: 'xiulian_guo', name: '修炼果' })
  assert.deepEqual(L.parseRewardText('200修炼点'), { kind: 'xiulian_200', name: '200修炼点' })
  assert.deepEqual(L.parseRewardText('3级家具设计图'), { kind: 'furniture3', name: '3级家具设计图' })
  assert.deepEqual(L.parseRewardText('120灵饰指南书'), { kind: 'lingshi_book', level: 120, name: '120灵饰指南书' })
  assert.deepEqual(L.parseRewardText('140元灵晶石'), { kind: 'lingshi_stone', level: 140, name: '140元灵晶石' })
  assert.deepEqual(L.parseRewardText('神秘奖励'), { kind: 'other', name: '神秘奖励' })
  assert.equal(L.parseRewardText(''), null)
  assert.equal(L.parseRewardText(null), null)
})

test('成本明细按任务类型汇总', () => {
  const rings = [
    { t: 'equip60' },
    { t: 'equip60' },
    { t: 'find_npc' },
    { t: null }
  ]
  const items = L.buildCostItems(rings, {}, { equip60: 180000, find_npc: 0 })
  const eq = items.find(i => i.tid === 'equip60')
  const find = items.find(i => i.tid === 'find_npc')
  assert.equal(items.length, 2)
  assert.equal(eq.qty, 2)
  assert.equal(eq.amount, 360000)
  assert.equal(find.amount, 0)
})

test('收益估值：默认价与手动改价', () => {
  const prices = {
    books: { 150: 50000000 },
    irons: { 120: 2400000 },
    lingshi: { 120: 3000000 },
    items: { xiulian_guo: 500000 },
    zhanpo: 80000000
  }
  const items = L.valueIncomeItems([
    { kind: 'book', level: 150, name: '150级制造指南书-剑' },
    { kind: 'xiulian_guo', name: '修炼果', qty: 2 },
    { kind: 'other', name: '自定义', unitPrice: 1000000 }
  ], prices)
  assert.equal(items[0].unitPrice, 50000000)
  assert.equal(items[1].amount, 1000000)
  assert.equal(items[2].amount, 1000000)
  assert.equal(items[0].amount, 50000000)
})

test('单轮汇总：投入/产出/净收益/ROI/时薪', () => {
  const run = L.summarizeRun({
    rings: [{ t: 'equip60' }, { t: 'equip60' }],
    prices: {},
    defaults: { equip60: 180000 },
    incomeItems: [{ kind: 'book', level: 150, name: '150级制造指南书-剑' }],
    extraCost: 100000,
    startedAt: 1000000,
    doneAt: 1000000 + 60 * 60000
  })
  assert.equal(run.cost, 360000 + 100000)
  assert.equal(run.income, 50000000)
  assert.equal(run.profit, 50000000 - 460000)
  assert.equal(run.roi, 50000000 / 460000)
  assert.equal(run.durationMin, 60)
  assert.equal(run.hourly, run.profit)
})

test('单轮汇总边界：0 成本 / 缺用时 / 无奖励', () => {
  const zero = L.summarizeRun({ rings: [{ t: 'find_npc' }], prices: {}, defaults: { find_npc: 0 }, incomeItems: [] })
  assert.equal(zero.cost, 0)
  assert.equal(zero.income, 0)
  assert.equal(zero.roi, null)
  assert.equal(zero.netRate, null)
  assert.equal(zero.hourly, null)
  const short = L.summarizeRun({ rings: [], incomeItems: [], startedAt: 0, doneAt: 0 })
  assert.equal(short.durationMin, null)
})

test('周期过滤与多轮汇总', () => {
  const now = new Date(2026, 9, 22, 12, 0, 0).getTime()
  const day = 24 * 3600 * 1000
  const runs = [
    { doneAt: now - 1 * day, income: 200, incomeItems: [], cost: 100, profit: 100, durationMin: 60 },
    { doneAt: now - 10 * day, income: 50, incomeItems: [], cost: 100, profit: -50, durationMin: 30 },
    { doneAt: now - 40 * day, income: 300, incomeItems: [], cost: 100, profit: 200, durationMin: 60 },
    { doneAt: now - 1 * day, totalCost: 100 } // 未记账
  ]
  assert.equal(L.filterRunsByPeriod(runs, '7d', now).length, 2)
  assert.equal(L.filterRunsByPeriod(runs, '30d', now).length, 3)
  assert.equal(L.filterRunsByPeriod(runs, 'month', now).length, 3)
  assert.equal(L.filterRunsByPeriod(runs, 'all', now).length, 4)

  const agg = L.aggregateRuns(runs)
  assert.equal(agg.count, 3)
  assert.equal(agg.unbooked, 1)
  assert.equal(agg.totalCost, 300)
  assert.equal(agg.totalIncome, 550)
  assert.equal(agg.totalProfit, 250)
  assert.equal(agg.avgProfit, 250 / 3)
  assert.equal(agg.winRate, 2 / 3)
  assert.equal(agg.hourly, 250 / 2.5)
})

test('isBooked 识别旧数据', () => {
  assert.equal(L.isBooked({ income: 100, incomeItems: [] }), true)
  assert.equal(L.isBooked({ totalCost: 100 }), false)
  assert.equal(L.isBooked(null), false)
})
