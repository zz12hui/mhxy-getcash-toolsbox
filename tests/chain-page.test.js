// 跑环页面逻辑集成测试（最小 mock）
const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')

const toasts = []
const modals = []
const modalQueue = []
let pageDef = null

Object.assign(global.wx, {
  showToast: opts => toasts.push(opts && opts.title),
  showModal: opts => {
    modals.push(opts && opts.content)
    const confirm = modalQueue.length ? modalQueue.shift() : true
    if (opts && opts.success) opts.success({ confirm, cancel: !confirm })
  },
  vibrateShort: () => {},
  getWindowInfo: () => ({ pixelRatio: 2 }),
  getSystemInfoSync: () => ({ pixelRatio: 2 })
})

const app = { globalData: { activeUser: null, users: [] } }
global.getApp = () => app
global.Page = def => { pageDef = def }

require('../pages/chain/chain.js')

function createPage() {
  return Object.assign({}, pageDef, {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(patch) {
      Object.assign(this.data, patch)
    }
  })
}

function seedUser() {
  mock.reset()
  toasts.length = 0
  modals.length = 0
  modalQueue.length = 0
  global.wx.setStorageSync('mhxy_users', [{ id: 'u1', name: '角色A', createdAt: 1700000000000 }])
  global.wx.setStorageSync('mhxy_active', 'u1')
  app.globalData.activeUser = 'u1'
  pageDef._cur = null
}

test('跑环：新建 → 连续记录 → 撤销', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  assert.equal(page.data.hasCur, true)
  assert.equal(page.data.nextRing, 1)

  page.setData({ modalTask: 'find_npc' })
  page.quickRecord()
  page.quickRecord()
  assert.equal(page._cur.rings[0].t, 'find_npc')
  assert.equal(page._cur.rings[1].t, 'find_npc')
  assert.equal(page.data.completed, 2)

  page.undoLast()
  assert.equal(page._cur.rings[1].t, null)
  assert.equal(page.data.completed, 1)
})

test('跑环：批量跨段时要求先记录段奖励', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ batchStart: 1, batchEnd: 150, batchSelTid: 'find_npc' })
  page.confirmBatch()
  // 未记录 100 环奖励，只应填到 100
  assert.equal(page.data.completed, 100)
  assert.equal(page._cur.rewards[100].length, 0)

  // 记录 100 环奖励后，可以继续填充
  page.setData({
    showSegModal: true, segRewardSeg: 100, segMainReward: '120级制造指南书-剑',
    segExtraChecked: [], segCustom: ''
  })
  page.confirmSeg()
  page.setData({ batchStart: 101, batchEnd: 200, batchSelTid: 'find_npc' })
  page.confirmBatch()
  assert.equal(page.data.completed, 200)
})

test('跑环：价格设为 0 时费用为 0', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ modalTask: 'equip60_3' })
  page.quickRecord()
  assert.equal(Number(page.data.costWan), 8) // 默认 8 万

  global.wx.setStorageSync('mhxy3_prices_u1', { equip60_3: 0 })
  page.loadData()
  assert.equal(Number(page.data.costWan), 0)
})

test('跑环：完成度向下取整（299 环不显示 100%）', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()
  page.setData({ batchStart: 1, batchEnd: 100, batchSelTid: 'find_npc' })
  page.confirmBatch()
  page.setData({ showSegModal: true, segRewardSeg: 100, segMainReward: '120级制造指南书-剑', segExtraChecked: [], segCustom: '' })
  page.confirmSeg()
  page.setData({ batchStart: 101, batchEnd: 200, batchSelTid: 'find_npc' })
  page.confirmBatch()
  page.setData({ showSegModal: true, segRewardSeg: 200, segMainReward: '120级百炼精铁', segExtraChecked: [], segCustom: '' })
  page.confirmSeg()
  page.setData({ batchStart: 201, batchEnd: 299, batchSelTid: 'find_npc' })
  page.confirmBatch()
  assert.equal(page.data.completed, 299)
  assert.equal(page.data.completedPct, 99)
})

test('跑环：段奖励估值与结算记账', () => {
  seedUser()
  const page = createPage()
  page.onLoad()
  page.loadData()
  page.doStartNew()

  // 第 100 环：80 级书，实际价 25 万
  page.setData({ batchStart: 1, batchEnd: 100, batchSelTid: 'equip60_3' })
  page.confirmBatch()
  page.setData({
    showSegModal: true, segRewardSeg: 100, segMainReward: '80级制造指南书-剑',
    segMainValueWan: '25', segExtraRows: [], segCustom: '', segCustomValue: ''
  })
  page.confirmSeg()
  assert.equal(page._cur.incomeItems.length, 1)
  assert.equal(page._cur.incomeItems[0].seg, 100)
  assert.equal(page._cur.incomeItems[0].unitPrice, 250000)

  // 第 200 环：80 级铁，实际价 12 万
  page.setData({ batchStart: 101, batchEnd: 200, batchSelTid: 'equip60_3' })
  page.confirmBatch()
  page.setData({
    showSegModal: true, segRewardSeg: 200, segMainReward: '80级百炼精铁',
    segMainValueWan: '12', segExtraRows: [], segCustom: '', segCustomValue: ''
  })
  page.confirmSeg()

  // 第 300 环：80 级书，实际价 25 万，记录后自动结算
  page.setData({ batchStart: 201, batchEnd: 300, batchSelTid: 'equip60_3' })
  page.confirmBatch()
  page.setData({
    showSegModal: true, segRewardSeg: 300, segMainReward: '80级制造指南书-剑',
    segMainValueWan: '25', segExtraRows: [], segCustom: '', segCustomValue: ''
  })
  page.confirmSeg()

  const run = global.wx.getStorageSync('mhxy3_runs_u1')[0]
  assert.equal(run.unbooked, false)
  assert.equal(run.incomeItems.length, 3)
  assert.equal(run.income, 250000 + 120000 + 250000)
  assert.equal(run.cost, 300 * 80000)
  assert.equal(run.profit, 620000 - 24000000)
  assert.ok(run.roi > 0)
  assert.equal(run.costItems[0].qty, 300)
  assert.equal(run.ledgerVersion, 1)
})
