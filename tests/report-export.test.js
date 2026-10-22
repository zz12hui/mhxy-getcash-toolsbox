const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const REPORT = require('../utils/report-export')

function run(id, tool, profit, extra) {
  return Object.assign({
    id,
    level: 175,
    startedAt: 1700000000000,
    doneAt: 1700003600000,
    rings: [{ t: 'find_npc' }],
    costItems: [],
    cost: 3000000,
    incomeItems: [],
    income: profit + 3000000,
    profit,
    roi: 1.5,
    netRate: 0.5,
    durationMin: 60,
    hourly: profit,
    ledgerVersion: 1,
    _tool: tool
  }, extra || {})
}

test('报表：表头 + 每轮明细 + 汇总', () => {
  mock.reset()
  const runs = [run(1, 'pet', 2000000), run(2, 'chain', -1000000)]
  const rep = REPORT.buildReport(runs, { roleName: '测试角色', now: new Date('2026-10-22T12:00:00+08:00').getTime() })
  assert.ok(rep.title.indexOf('梦幻收益报表-测试角色') === 0)
  assert.equal(rep.rows[0][0], '结算时间')
  assert.equal(rep.rows[1][0].length > 0, true)
  assert.equal(rep.rows.length, 1 + 2 + 1 + 2) // 表头 + 2 轮 + 空行 + 汇总 + 指标行
  const summary = rep.rows[rep.rows.length - 2]
  assert.equal(summary[0], '汇总（2 轮）')
  assert.ok(rep.summary.count === 2)
})

test('报表：没有已记账轮次时只有表头和汇总', () => {
  mock.reset()
  const rep = REPORT.buildReport([], { roleName: '空角色' })
  assert.equal(rep.rows[0][0], '结算时间')
  assert.equal(rep.summary.count, 0)
  assert.ok(rep.rows[rep.rows.length - 2][0].indexOf('汇总（0 轮）') === 0)
})

test('报表：人民币口径', () => {
  mock.reset()
  const rep = REPORT.buildReport([run(1, 'pet', 1200000)], { roleName: 'R', currency: 'yuan' })
  assert.ok(rep.rows[1][5].indexOf('元') >= 0)
})
