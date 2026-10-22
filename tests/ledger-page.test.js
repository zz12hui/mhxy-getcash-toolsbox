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
  getWindowInfo: () => ({ pixelRatio: 2 }),
  showToast: () => {}
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
  assert.equal(s.totalCostStr, '500.0 万两')
  assert.equal(s.totalIncomeStr, '600.0 万两')
  assert.equal(s.profitStr, '100.0 万两')
  assert.equal(s.totalHoursStr, '3.0 小时')
  assert.ok(s.hourlyStr.indexOf('万两/时') >= 0)
  assert.ok(s.targetStr.indexOf('达标') >= 0 || s.targetStr.indexOf('差') >= 0)
  assert.equal(page.data.runList.length, 3)
  assert.equal(page.data.hasRuns, true)
})

test('账本：按工具筛选', () => {
  seed()
  const page = createPage()
  page.setData({ tool: 'pet' })
  page.loadData()
  assert.equal(page.data.summary.count, 1)
  assert.equal(page.data.summary.totalIncomeStr, '500.0 万两')
  assert.ok(page.data.runList.every(r => r.tool === 'pet'))
})

test('账本：全部角色汇总', () => {
  seed()
  const page = createPage()
  page.setData({ scope: 'all' })
  page.loadData()
  assert.equal(page.data.summary.count, 3)
  assert.equal(page.data.summary.totalIncomeStr, '700.0 万两')
})

test('账本：周期筛选（7 天 / 全部）', () => {
  seed()
  const page = createPage()
  page.loadData()
  assert.equal(page.data.summary.count, 2)
  page.setData({ period: 'all' })
  page.loadData()
  assert.equal(page.data.summary.count, 2)
  assert.equal(page.data.runList.length, 3)
})

test('账本：切换人民币显示', () => {
  seed()
  const page = createPage()
  page.setData({ currency: 'yuan' })
  page.loadData()
  assert.equal(page.data.summary.totalIncomeStr, '40.40 元')
  assert.equal(page.data.summary.profitStr, '6.73 元')
  assert.ok(page.data.runList[0].profitStr.indexOf('元') >= 0)
})

test('账本：保存换算设置', () => {
  seed()
  const page = createPage()
  page.loadData()
  page.openMoneySettings()
  assert.equal(page.data.showMoneySettings, true)
  page.setData({ moneyInputs: { wanPerYuan: '10', pointCostYuanPerHour: '0.6', targetHourlyYuan: '20' } })
  page.saveMoneySettings()
  assert.equal(page.data.showMoneySettings, false)
  const cfg = global.wx.getStorageSync('mhxy_money_cfg')
  assert.equal(cfg.wanPerYuan, 10)
  assert.equal(cfg.pointCostYuanPerHour, 0.6)
  assert.equal(page.data.moneyCfg.targetHourlyYuan, 20)
})

test('账本：分页（超过 20 轮）', () => {
  mock.reset()
  const now = Date.now()
  S.saveUsers([{ id: 'u1', name: '角色A', createdAt: 1 }])
  S.saveActiveUser('u1')
  const runs = []
  for (let i = 0; i < 25; i++) {
    runs.push({
      id: 'p' + i, level: 175, startedAt: now - i * 3600000, doneAt: now - i * 3600000,
      rings: [], costItems: [], cost: 1000000, incomeItems: [], income: 1200000,
      profit: 200000, roi: 1.2, netRate: 0.2, durationMin: 30, ledgerVersion: 1
    })
  }
  S.savePetRuns('u1', runs)
  const page = createPage()
  page.loadData()
  assert.equal(page.data.listTotal, 25)
  assert.equal(page.data.pageCount, 2)
  assert.equal(page.data.runList.length, 20)
  page.nextPage()
  assert.equal(page.data.page, 2)
  assert.equal(page.data.runList.length, 5)
  page.nextPage()
  assert.equal(page.data.page, 2)
  page.prevPage()
  assert.equal(page.data.page, 1)
  assert.equal(page.data.runList.length, 20)
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
