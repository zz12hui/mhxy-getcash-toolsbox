const test = require('node:test')
const assert = require('node:assert/strict')
const { UndoStack } = require('../utils/undo')

test('撤销栈后进先出', () => {
  const stack = new UndoStack(10)
  stack.push({ label: 'a' })
  stack.push({ label: 'b' })
  assert.equal(stack.size, 2)
  assert.equal(stack.pop().label, 'b')
  assert.equal(stack.pop().label, 'a')
  assert.equal(stack.pop(), null)
})

test('超过上限丢弃最旧记录', () => {
  const stack = new UndoStack(3)
  for (let i = 0; i < 5; i++) stack.push({ label: i })
  assert.equal(stack.size, 3)
  assert.equal(stack.pop().label, 4)
  assert.equal(stack.pop().label, 3)
  assert.equal(stack.pop().label, 2)
})

test('clear 清空', () => {
  const stack = new UndoStack(5)
  stack.push({ label: 'x' })
  stack.clear()
  assert.equal(stack.size, 0)
  assert.equal(stack.pop(), null)
})
