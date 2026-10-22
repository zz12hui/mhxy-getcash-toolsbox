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
    reward: ['150级制造指南书-剑'],
    ledgerVersion: 1,
    _tool: tool
  }, extra || {})
}

test('报表：收益报表单表包含总览 + 宠环/人环轮次', () => {
  mock.reset()
  const runs = [run(1, 'pet', 2000000), run(2, 'chain', -1000000)]
  const rep = REPORT.buildReport(runs, {
    roleName: '测试角色',
    scopeLabel: '当前角色',
    toolLabel: '全部工具',
    periodLabel: '近7天',
    now: new Date('2026-10-22T12:00:00+08:00').getTime()
  })
  assert.ok(rep.title.indexOf('梦幻收益报表-测试角色') === 0)
  assert.deepEqual(rep.sheets.map(s => s.title), ['收益报表'])

  const rows = rep.sheets[0].rows
  assert.equal(rows[0][0], '梦幻搞钱工具箱 · 收益报表')
  const findRow = label => rows.find(row => row[0] === label)
  assert.equal(findRow('已记账轮次')[1], 2)
  assert.equal(findRow('未记账轮次')[1], 0)
  assert.ok(findRow('点卡成本(万两)')[1] > 0)
  assert.ok(findRow('平均时薪(万两/时)')[1] > 0)
  assert.ok(findRow('平均时薪(元/时)')[1] > 0)
  assert.ok(rows.some(row => row[0] === '轮次明细'))

  const header = rows.find(row => row[0] === '序号')
  assert.ok(header.indexOf('ROI(扣点卡)') >= 0)
  assert.ok(header.indexOf('时薪(万两/时)') >= 0)
  const petRow = rows.find(row => row[1] === '宠环')
  const chainRow = rows.find(row => row[1] === '人环')
  assert.ok(petRow)
  assert.ok(chainRow)
  assert.ok(Number(petRow[8]) > 0)
  assert.ok(String(petRow[12]).indexOf('1 :') >= 0)
  assert.equal(String(petRow[18]), '150级制造指南书-剑')
  assert.ok(rows.some(row => row[0] === '合计'))
  assert.equal(rep.summary.count, 2)
  assert.ok(rep.totalPointCost > 0)
})

test('报表：没有已记账轮次也有一张完整表', () => {
  mock.reset()
  const rep = REPORT.buildReport([], { roleName: '空角色' })
  assert.equal(rep.sheets.length, 1)
  assert.equal(rep.summary.count, 0)
  const rows = rep.sheets[0].rows
  const row = rows.find(r => r[0] === '已记账轮次')
  assert.equal(row[1], 0)
  assert.ok(rows.some(r => r[0] === '合计'))
})

test('报表：单轮点卡成本、ROI、时薪字段可计算', () => {
  mock.reset()
  const rep = REPORT.buildReport([run(1, 'pet', 1200000)], { roleName: 'R' })
  const rows = rep.sheets[0].rows
  const row = rows.find(r => r[1] === '宠环')
  const taskCost = Number(row[7])
  const pointCost = Number(row[8])
  const totalCost = Number(row[9])
  assert.ok(Math.abs(totalCost - (taskCost + pointCost)) < 0.02)
  assert.ok(Number(row[15]) > 0)
  assert.ok(String(row[18]).length > 0)
})
