const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const S = require('../utils/storage')
const HOME = require('../utils/ledger-home')

function seed() {
  mock.reset()
  const now = Date.now()
  S.saveUsers([{ id: 'u1', name: '角色A', createdAt: 1 }])
  S.saveActiveUser('u1')
  S.savePetRuns('u1', [{
    id: 1, level: 175, startedAt: now - 3600000, doneAt: now, rings: [],
    costItems: [], cost: 3000000, incomeItems: [], income: 5000000,
    profit: 2000000, roi: 1.6667, netRate: 0.6667, durationMin: 60, hourly: 2000000,
    ledgerVersion: 1
  }])
}

test('首页摘要：当前角色全部账本', () => {
  seed()
  const sum = HOME.getHomeSummary()
  assert.equal(sum.roleName, '角色A')
  assert.equal(sum.count, 1)
  assert.equal(sum.profitStr, '200.0 万两')
  assert.equal(sum.profitPos, true)
  assert.equal(sum.roiStr, '1 : 1.67')
  assert.equal(sum.hourlyStr, '200.0 万两/时')
})

test('首页摘要：无数据', () => {
  mock.reset()
  S.saveUsers([{ id: 'u1', name: '角色A', createdAt: 1 }])
  S.saveActiveUser('u1')
  const sum = HOME.getHomeSummary()
  assert.equal(sum.hasData, false)
  assert.equal(sum.count, 0)
  assert.equal(sum.profitStr, '0.0 万两')
})
