// 宠环页面逻辑集成测试：用最小 mock 模拟小程序 Page/wx，不依赖开发者工具
const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')

const toasts = []
const modals = []
let pageDef = null

Object.assign(global.wx, {
  showToast: opts => toasts.push(opts && opts.title),
  showModal: opts => {
    modals.push(opts && opts.content)
    if (opts && opts.success) opts.success({ confirm: true, cancel: false })
  },
  vibrateShort: () => {},
  getWindowInfo: () => ({ pixelRatio: 2 }),
  getSystemInfoSync: () => ({ pixelRatio: 2 })
})

const app = { globalData: { activeUser: null, users: [] } }
global.getApp = () => app
global.Page = def => { pageDef = def }

require('../pages/pet/pet.js')

function createPage() {
  const page = Object.assign({}, pageDef, {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(patch) {
      Object.assign(this.data, patch)
    }
  })
  return page
}

function seedUser() {
  mock.reset()
  global.wx.setStorageSync('mhxy_users', [{ id: 'u1', name: '角色A', createdAt: 1700000000000 }])
  global.wx.setStorageSync('mhxy_active', 'u1')
  app.globalData.activeUser = 'u1'
  pageDef._cur = null
}

test('宠环：新建 → 连续记录同类型 → 撤销', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  assert.equal(page.data.hasCur, false)

  page.doStartNew()
  assert.equal(page.data.hasCur, true)
  assert.equal(page.data.nextRing, 1)

  page.setData({ modalTask: 'find_npc' })
  page.quickRecord()
  assert.equal(page.data.nextRing, 2)
  assert.equal(page._cur.rings[0].t, 'find_npc')
  assert.equal(page.data.score, 1)
  assert.equal(page.data.undoCount, 1)
  // 任务类型保留，可直接连续记录
  assert.equal(page.data.modalTask, 'find_npc')

  page.quickRecord()
  assert.equal(page._cur.rings[1].t, 'find_npc')

  page.undoLast()
  assert.equal(page._cur.rings[1].t, null)
  assert.equal(page.data.undoCount, 1)
})

test('宠环：价格设为 0 时费用为 0（不再回退默认价）', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ modalTask: 'equip60' })
  page.quickRecord()
  const before = Number(page.data.costWan)
  assert.equal(before, 18) // 默认 60 环装 18 万

  // 保存自定义价格 0，重新加载后费用应为 0
  global.wx.setStorageSync('mhxy_prices_u1', { equip60: 0 })
  page.loadData()
  assert.equal(Number(page.data.costWan), 0)
})

test('宠环：批量填充 + 结算写入历史', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ batchStart: 1, batchEnd: 100, batchSelTid: 'find_npc' })
  page.confirmBatch()
  assert.equal(page.data.completed, 100)
  assert.equal(page.data.score, 100)
  page.loadData()
  page.complete()
  assert.ok(page.data.showSettleModal, '应弹出结算')
  page.confirmSettle()
  assert.equal(page.data.hasCur, false)
  const runs = global.wx.getStorageSync('mhxy_runs_u1')
  assert.equal(runs.length, 1)
  assert.equal(runs[0].totalScore, 100)
  assert.ok(Array.isArray(runs[0].reward))
  // 没选任何奖励 → 标记未记账
  assert.equal(runs[0].unbooked, true)
})

test('宠环：结算记账（奖励估值/净收益/ROI/用时）', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ batchStart: 1, batchEnd: 100, batchSelTid: 'equip60' })
  page.confirmBatch()
  page.loadData()
  page.complete()
  // 主奖励：80 级书，实际价 25 万
  page.setData({ settleMainReward: '80级制造指南书-剑', settleMainValue: '25' })
  page.confirmSettle()

  const run = global.wx.getStorageSync('mhxy_runs_u1')[0]
  assert.equal(run.unbooked, false)
  assert.equal(run.ledgerVersion, 1)
  assert.equal(run.incomeItems.length, 1)
  assert.equal(run.incomeItems[0].kind, 'book')
  assert.equal(run.incomeItems[0].unitPrice, 250000)
  assert.equal(run.income, 250000)
  assert.equal(run.cost, 180000 * 100)
  assert.equal(run.profit, 250000 - 18000000)
  assert.equal(run.roi, 250000 / 18000000)
  assert.ok(Array.isArray(run.costItems))
  assert.equal(run.costItems[0].qty, 100)
  assert.ok(run.durationMin === null || typeof run.durationMin === 'number')
})

test('宠环：取消结算回滚完成状态', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ batchStart: 1, batchEnd: 100, batchSelTid: 'find_npc' })
  page.confirmBatch()
  page.loadData()
  page.complete()
  assert.ok(page.data.showSettleModal)
  const run = page._settleRun
  page.closeSettleModal()
  assert.equal(page.data.showSettleModal, false)
  assert.equal(run.done, false)
  const stored = global.wx.getStorageSync('mhxy_cur_u1')
  assert.equal(stored.done, false)
})
