const test = require('node:test')
const assert = require('node:assert/strict')
const { getPrice, ringCost, totalCost, toAmount } = require('../utils/ring-cost')

const DEFAULTS = { find_npc: 0, equip60: 180000, equip80: 450000 }

test('价格设为 0 时生效，不再回退默认价', () => {
  assert.equal(getPrice({ equip60: 0 }, 'equip60', DEFAULTS), 0)
  assert.equal(ringCost({ t: 'equip60' }, { equip60: 0 }, DEFAULTS), 0)
})

test('未设置价格时使用默认价', () => {
  assert.equal(getPrice({}, 'equip60', DEFAULTS), 180000)
  assert.equal(getPrice(null, 'equip80', DEFAULTS), 450000)
})

test('未知任务与非法值按 0 处理', () => {
  assert.equal(getPrice({}, 'unknown', DEFAULTS), 0)
  assert.equal(toAmount(-5), 0)
  assert.equal(toAmount('abc'), 0)
  assert.equal(toAmount('500'), 500)
  assert.equal(ringCost(null, {}, DEFAULTS), 0)
  assert.equal(ringCost({ t: null }, {}, DEFAULTS), 0)
})

test('总费用累加', () => {
  const rings = [
    { t: 'find_npc' },
    { t: 'equip60' },
    { t: 'equip60' },
    { t: 'equip80' }
  ]
  assert.equal(totalCost(rings, {}, DEFAULTS), 180000 * 2 + 450000)
  assert.equal(totalCost([{ t: 'equip60' }], { equip60: 0 }, DEFAULTS), 0)
  assert.equal(totalCost(null, {}, DEFAULTS), 0)
})
