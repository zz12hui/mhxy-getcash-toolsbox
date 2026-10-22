const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')

let pageDef = null
Object.assign(global.wx, {
  createSelectorQuery: () => ({
    select() { return this },
    fields() { return this },
    exec(cb) { cb([{ node: null, width: 0, height: 0 }]) }
  }),
  getWindowInfo: () => ({ pixelRatio: 2 })
})
global.Page = def => { pageDef = def }

require('../pages/ledger/ledger.js')
const S = require('../utils/storage')

function seed() {
  mock.reset()
  const now = Date.now()
  const day = 24 * 3600 * 1000
  S.saveUsers([
    { id: 'u1', name: '角色A', createdAt: 1 },
    { id: 'u2', name: '角色B', createdAt: 2 }
  ])
  S.saveActiveUser('u1')
  S.savePetRuns('u1', [
    {
      id: 1, level: 175, startedAt: now - 3600000, doneAt: now, rings: [],
      costItems: [], cost: 3000000, incomeItems: [], income: 5000000,
      profit: 2000000, roi: 1.6667, netRate: 0.6667, durationMin: 60,
      ledgerVersion: 1
    }
  ])
  S.saveChainRuns('u1', [
    {
      id: 2, level: 175, startedAt: now - 7200000, doneAt: now - day, rings: [],
      rewards: {}, costItems: [], cost: 2000000, incomeItems: [], income: 1000000,
      profit: -1000000, roi: 0.5, netRate: -0.5, durationMin: 120,
      ledgerVersion: 1
    },
    // 未记账轮次：只计入投入
    { id: 3, level: 175, startedAt: now - 2 * day, doneAt: now - 2 * day, rings: [], totalCost: 100000 }
  ])
  S.savePetRuns('u2', [
    {
      id: 4, level: 160, startedAt: now - 1800000, doneAt: now - 1800000, rings: [],
      costItems: [], cost: 500000, incomeItems: [], income: 1000000,
      profit: 500000, roi: 2, netRate: 1, durationMin: 30, ledgerVersion: 1
    }
  ])
}

function createPage() {
  return Object.assign({}, pageDef, {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(patch) { Object.assign(this.data, patch) }
  })
}

test('账本：当前角色汇总（含未记账）', () => {
  seed()
  const page = createPage()
  page.loadData()
  const s = page.data.summary
  assert.equal(s.count, 2)
  assert.equal(s.unbooked, 1)
  assert.equal(s.totalCostWan, '500.0') // 300万 + 200万（未记账的 10 万只算投入？不，未记账不计入 booked 汇总）
  assert.equal(s.totalIncomeWan, '600.0')
  assert.equal(s.profitWan, '100.0')
  assert.equal(page.data.runList.length, 3)
  assert.equal(page.data.hasRuns, true)
})

test('账本：按工具筛选', () => {
  seed()
  const page = createPage()
  page.setData({ tool: 'pet' })
  page.loadData()
  assert.equal(page.data.summary.count, 1)
  assert.equal(page.data.summary.totalIncomeWan, '500.0')
  assert.ok(page.data.runList.every(r => r.tool === 'pet'))
})

test('账本：全部角色汇总', () => {
  seed()
  const page = createPage()
  page.setData({ scope: 'all' })
  page.loadData()
  assert.equal(page.data.summary.count, 3)
  assert.equal(page.data.summary.totalIncomeWan, '700.0')
})

test('账本：周期筛选（7 天 / 全部）', () => {
  seed()
  const page = createPage()
  page.loadData()
  assert.equal(page.data.summary.count, 2)
  page.setData({ period: 'all' })
  page.loadData()
  assert.equal(page.data.summary.count, 2) // 当前角色只有 2 条已记账（另一条未记账）
  assert.equal(page.data.runList.length, 3)
})

test('账本：打开轮次明细抽屉', () => {
  seed()
  const page = createPage()
  page.loadData()
  const key = Object.keys(page._runMap)[0]
  page.openDetail({ currentTarget: { dataset: { key } } })
  assert.equal(page.data.showDetail, true)
  assert.ok(page.data.detailRun)
  page.closeDetail()
  assert.equal(page.data.showDetail, false)
})
