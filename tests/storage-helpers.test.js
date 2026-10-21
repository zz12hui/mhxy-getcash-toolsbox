const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')

const usage = require('../utils/task-usage')
const memory = require('../utils/item-memory')
const faqCache = require('../utils/faq-cache')

test('常用任务按使用次数排序，未用过的保持原顺序', () => {
  mock.reset()
  usage.bump('u1', 'pet', 'equip80')
  usage.bump('u1', 'pet', 'equip80')
  usage.bump('u1', 'pet', 'find_npc')
  const tasks = [
    { id: 'find_npc' },
    { id: 'equip60' },
    { id: 'equip80' }
  ]
  const ordered = usage.sortTasks(tasks, usage.getUsage('u1', 'pet'))
  assert.deepEqual(ordered.map(t => t.id), ['equip80', 'find_npc', 'equip60'])
})

test('使用记录按角色/工具隔离', () => {
  mock.reset()
  usage.bump('u1', 'pet', 'equip80')
  usage.bump('u2', 'pet', 'find_npc')
  usage.bump('u1', 'chain', 'beast_book')
  assert.equal(usage.getUsage('u1', 'pet').equip80.count, 1)
  assert.equal(usage.getUsage('u2', 'pet').find_npc.count, 1)
  assert.equal(usage.getUsage('u1', 'chain').beast_book.count, 1)
  assert.deepEqual(usage.getUsage('u1', 'pet').find_npc, undefined)
})

test('物品名记忆去重、最近优先、最多 8 条', () => {
  mock.reset()
  const uid = 'u1'
  memory.add(uid, '60级武器')
  memory.add(uid, '70级刀')
  memory.add(uid, '60级武器')
  assert.deepEqual(memory.getAll(uid), ['60级武器', '70级刀'])
  for (let i = 0; i < 10; i++) memory.add(uid, 'item' + i)
  assert.equal(memory.getAll(uid).length, 8)
  assert.equal(memory.getAll(uid)[0], 'item9')
})

test('FAQ 缓存读写与清理', () => {
  mock.reset()
  faqCache.setCache('categories', [{ id: 'c1' }])
  assert.deepEqual(faqCache.getCached('categories'), [{ id: 'c1' }])
  faqCache.clearAll()
  assert.equal(faqCache.getCached('categories'), null)
})
