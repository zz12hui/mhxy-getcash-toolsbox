const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const M = require('../utils/money')

const DEFAULT_WAN_PER_YUAN = 3000 / 202

test('默认配置：3000 万两 = 202 元', () => {
  mock.reset()
  const cfg = M.getMoneyCfg()
  assert.ok(Math.abs(cfg.wanPerYuan - DEFAULT_WAN_PER_YUAN) < 1e-9)
  assert.equal(cfg.ratioWan, 3000)
  assert.equal(cfg.ratioYuan, 202)
  assert.equal(cfg.pointCostYuanPerHour, 0.4)
  assert.equal(cfg.targetHourlyYuan, 10)
})

test('保存/读取/恢复默认（成对比例）', () => {
  mock.reset()
  M.getMoneyCfg()
  assert.equal(M.saveMoneyCfg({ ratioWan: 1500, ratioYuan: 100, pointCostYuanPerHour: 0.5, targetHourlyYuan: 15 }), true)
  const read = M.getMoneyCfg()
  assert.equal(read.wanPerYuan, 15)
  assert.equal(read.ratioWan, 1500)
  assert.equal(read.ratioYuan, 100)
  assert.equal(read.pointCostYuanPerHour, 0.5)
  assert.equal(read.targetHourlyYuan, 15)
  M.resetMoneyCfg()
  assert.ok(Math.abs(M.getMoneyCfg().wanPerYuan - DEFAULT_WAN_PER_YUAN) < 1e-9)
})

test('旧版默认 12 万两/元自动迁移到新默认', () => {
  mock.reset()
  global.wx.setStorageSync('mhxy_money_cfg', { wanPerYuan: 12, pointCostYuanPerHour: 0.4, targetHourlyYuan: 10 })
  const cfg = M.getMoneyCfg()
  assert.equal(cfg.ratioWan, 3000)
  assert.equal(cfg.ratioYuan, 202)
})

test('非法值回退默认', () => {
  mock.reset()
  global.wx.setStorageSync('mhxy_money_cfg', { wanPerYuan: -1, targetHourlyYuan: 'x' })
  const cfg = M.getMoneyCfg()
  assert.ok(Math.abs(cfg.wanPerYuan - DEFAULT_WAN_PER_YUAN) < 1e-9)
  assert.equal(cfg.targetHourlyYuan, 10)
})

test('万两↔人民币换算', () => {
  const cfg = { wanPerYuan: 10 }
  assert.equal(M.wanToYuan(100, cfg), 10)
  assert.equal(M.yuanToWan(10, cfg), 100)
  assert.equal(M.wanToYuan('x', cfg), null)
})

test('金额与时薪格式化（双币种）', () => {
  const cfg = { wanPerYuan: 10 }
  assert.equal(M.formatAmount(1250000, cfg, 'wan'), '125.0 万两')
  assert.equal(M.formatAmount(1250000, cfg, 'yuan'), '12.50 元')
  assert.equal(M.formatHourly(2500000, cfg, 'wan'), '250.0 万两/时')
  assert.equal(M.formatHourly(2500000, cfg, 'yuan'), '25.00 元/时')
  assert.equal(M.formatAmount(null, cfg, 'wan'), '—')
})
