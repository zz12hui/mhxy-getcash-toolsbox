const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const GOLD = require('../utils/gold-calc')

test('金价默认：3000 万两 = 202 元', () => {
  mock.reset()
  assert.deepEqual(GOLD.defaultPair(), { wan: 3000, yuan: 202 })
  assert.ok(Math.abs(GOLD.wanToYuan(3000) - 202) < 1e-9)
  assert.ok(Math.abs(GOLD.yuanToWan(202) - 3000) < 1e-9)
})

test('金价自定义比例：双向换算', () => {
  mock.reset()
  const cfg = { ratioWan: 1500, ratioYuan: 100 }
  assert.equal(GOLD.pairToRatio(1500, 100), 15)
  assert.ok(Math.abs(GOLD.wanToYuan(1500, cfg) - 100) < 1e-9)
  assert.ok(Math.abs(GOLD.yuanToWan(100, cfg) - 1500) < 1e-9)
})

test('比例非法时返回 null', () => {
  assert.equal(GOLD.pairToRatio(0, 100), null)
  assert.equal(GOLD.pairToRatio(100, -1), null)
})

test('比例文案与数字格式化', () => {
  mock.reset()
  const text = GOLD.ratioText()
  assert.ok(text.indexOf('3000 万两 = 202 元') >= 0)
  assert.ok(text.indexOf('1 元 ≈') >= 0)
  assert.equal(GOLD.fmt(202, 2), '202')
  assert.equal(GOLD.fmt(14.8515, 2), '14.85')
})
