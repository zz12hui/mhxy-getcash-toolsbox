const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const RP = require('../utils/reward-prices')

test('首次读取自动写入默认价目表', () => {
  mock.reset()
  const p = RP.getRewardPrices('u1')
  assert.equal(p.books[150], 50000000)
  assert.equal(p.irons[120], 2400000)
  assert.equal(p.lingshi[140], 12000000)
  assert.equal(p.items.xiulian_guo, 500000)
  assert.equal(p.zhanpo, 80000000)
  const stored = global.wx.getStorageSync('mhxy_reward_prices_u1')
  assert.ok(stored && stored.books)
})

test('保存/读取/恢复默认', () => {
  mock.reset()
  RP.getRewardPrices('u1')
  const p = RP.getRewardPrices('u1')
  p.books[150] = 66000000
  p.items.xiulian_guo = 550000
  assert.equal(RP.saveRewardPrices('u1', p), true)
  const read = RP.getRewardPrices('u1')
  assert.equal(read.books[150], 66000000)
  assert.equal(read.items.xiulian_guo, 550000)

  assert.equal(RP.resetRewardPrices('u1'), true)
  assert.equal(RP.getRewardPrices('u1').books[150], 50000000)
})

test('不完整数据会补默认项', () => {
  mock.reset()
  global.wx.setStorageSync('mhxy_reward_prices_u2', { books: { 120: 3000000 }, zhanpo: 0 })
  const p = RP.getRewardPrices('u2')
  assert.equal(p.books[120], 3000000)
  assert.equal(p.books[80], 200000)
  assert.equal(p.zhanpo, 80000000)
  assert.equal(p.items.furniture3, 2000000)
})

test('奖励单价查询', () => {
  const prices = RP.getRewardPrices('u3')
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'book', level: 140 }), 20000000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'iron', level: 100 }), 600000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'zhanpo' }), 80000000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'lingshi_book', level: 120 }), 3000000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'xiulian_guo' }), 500000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'other', unitPrice: 1230000 }), 1230000)
  assert.equal(RP.rewardUnitPrice(prices, { kind: 'book', level: 999 }), 0)
})
