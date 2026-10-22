const test = require('node:test')
const assert = require('node:assert/strict')
const BATCH = require('../utils/batch')

test('批量范围：输入过程允许为空，不能强制变回 1', () => {
  assert.equal(BATCH.count('', 10, 100), 0)
  assert.equal(BATCH.count('9', 10, 100), 2)
  assert.equal(BATCH.count('99', 99, 100), 1)
  assert.equal(BATCH.count('99', '', 100), 0)
})

test('批量范围：确认时校验 1..limit', () => {
  assert.deepEqual(BATCH.normalize('99', '99', 100), { start: 99, end: 99, count: 1 })
  assert.deepEqual(BATCH.normalize(1, 100, 100), { start: 1, end: 100, count: 100 })
  assert.equal(BATCH.normalize('', 10, 100), null)
  assert.equal(BATCH.normalize(0, 10, 100), null)
  assert.equal(BATCH.normalize(20, 10, 100), null)
  assert.equal(BATCH.normalize(1, 101, 100), null)
  assert.deepEqual(BATCH.normalize(1, 300, 300), { start: 1, end: 300, count: 300 })
})
