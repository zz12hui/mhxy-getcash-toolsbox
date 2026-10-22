const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const NAV = require('../utils/home-nav')

test('首页工具指令：写入后只能取一次', () => {
  mock.reset()
  assert.equal(NAV.setPending('pet:predict'), true)
  assert.equal(NAV.takePending(), 'pet:predict')
  assert.equal(NAV.takePending(), '')
})

test('没有指令时返回空字符串', () => {
  mock.reset()
  assert.equal(NAV.takePending(), '')
})
