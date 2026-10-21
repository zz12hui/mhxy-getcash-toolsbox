const test = require('node:test')
const assert = require('node:assert/strict')
const C = require('../utils/constants')

test('任务类型数量与分类完整', () => {
  assert.equal(C.PET_TYPES.length, 13)
  assert.equal(C.CHAIN_TYPES.length, 13)
  C.PET_TYPES.forEach(t => {
    assert.ok(t.id && t.name, 'pet task 缺少 id/name')
    assert.equal(typeof t.sc, 'number')
  })
})

test('EXP_TABLE：100 项，合计 751', () => {
  assert.equal(C.EXP_TABLE.length, 100)
  assert.equal(C.EXP_TABLE.reduce((a, b) => a + b, 0), 751)
})

test('宠环书铁公式与上下限', () => {
  assert.equal(C.pBookLevel(200, 175), 120)
  assert.equal(C.pBookLevel(222, 175), 150)
  assert.equal(C.pBookLevel(0, 175), 80)
  assert.equal(C.pBookLevel(999, 175), 150)
  assert.equal(C.pBookLevel(200, 129), 110)
})

test('宠环档位边界', () => {
  assert.equal(C.pGetTier(222, 175).label, '150书铁/战魄')
  assert.equal(C.pGetTier(212, 175).label, '140书铁')
  assert.equal(C.pGetTier(152, 175).label, '80书铁(保底)')
  assert.equal(C.pGetTier(0, 175).label, '80书铁(保底)')
})

test('宠环经验：只统计已录环，合计与上限一致', () => {
  assert.equal(C.pExp([]), 0)
  const rings = Array.from({ length: 100 }, () => ({ t: null, sc: 0 }))
  for (let i = 0; i < 10; i++) rings[i] = { t: 'find_npc', sc: 1 }
  assert.equal(C.pExp(rings), 30)
  for (let i = 0; i < 100; i++) rings[i] = { t: 'find_npc', sc: 1 }
  assert.equal(C.pExp(rings), 751)
})

test('跑环奖励区间', () => {
  const r175 = C.cRewardRange(175)
  assert.deepEqual(r175, { min: 130, max: 140, has150: true, hasLingshi: true })
  const r150 = C.cRewardRange(150)
  assert.equal(r150.has150, false)
  assert.equal(r150.hasLingshi, true)
  const r100 = C.cRewardRange(100)
  assert.deepEqual(r100, { min: 90, max: 110, has150: false, hasLingshi: false })
})

test('跑环书铁等级均为 10 的倍数', () => {
  ;[60, 100, 129, 140, 150, 156, 175].forEach(lv => {
    const levels = C.cBookLevels(lv)
    assert.ok(levels.length > 0, 'lv ' + lv + ' 无等级')
    levels.forEach(l => assert.equal(l % 10, 0, 'lv ' + lv + ' 出现非整十等级 ' + l))
  })
  assert.deepEqual(C.cBookLevels(175), [150, 140, 130])
})
