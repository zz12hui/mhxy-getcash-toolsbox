const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')
const S = require('../utils/storage')

function seedRole(id, name, score) {
  S.saveUsers([{ id, name, createdAt: 1700000000000 }])
  S.saveActiveUser(id)
  S.savePetCfg(id, { level: 175 })
  S.savePetPrices(id, { equip60: 0 })
  S.savePetRuns(id, [{ id: 1, totalScore: score }])
  S.savePetCur(id, { id: 1, rings: [] })
  S.saveChainCfg(id, { level: 175 })
  S.saveChainRuns(id, [{ id: 2, totalCost: 100 }])
  S.saveChainCur(id, null)
}

test('exportAllRoles 导出角色及其宠环/跑环数据', () => {
  mock.reset()
  seedRole('u1', '角色A', 200)
  const roles = S.exportAllRoles()
  assert.equal(roles.length, 1)
  assert.equal(roles[0].id, 'u1')
  assert.equal(roles[0].name, '角色A')
  assert.equal(roles[0].pet.cfg.level, 175)
  assert.equal(roles[0].pet.prices.equip60, 0)
  assert.equal(roles[0].pet.runs[0].totalScore, 200)
  assert.equal(roles[0].chain.runs[0].totalCost, 100)
  assert.equal(roles[0].chain.cur, null)
})

test('applyAllRoles 整份替换本地角色与数据', () => {
  mock.reset()
  seedRole('old', '旧角色', 100)
  const ok = S.applyAllRoles([
    {
      id: 'new1', name: '新角色', createdAt: 1700000000001,
      pet: { cfg: { level: 160 }, prices: {}, runs: [{ id: 9 }], cur: null },
      chain: { cfg: { level: 160 }, prices: {}, runs: [], cur: null }
    }
  ])
  assert.equal(ok, true)
  const users = S.getUsers()
  assert.equal(users.length, 1)
  assert.equal(users[0].id, 'new1')
  assert.equal(S.getActiveUser(), 'new1')
  assert.equal(S.getPetCfg('new1').level, 160)
  assert.equal(S.getPetRuns('new1')[0].id, 9)
  // 旧角色数据已清理
  assert.equal(S.getPetCfg('old').level, 175) // 回退默认值
  assert.deepEqual(S.getPetRuns('old'), [])
})

test('applyAllRoles 空数组不生效', () => {
  mock.reset()
  seedRole('u1', '角色A', 200)
  assert.equal(S.applyAllRoles([]), false)
  assert.equal(S.getUsers().length, 1)
})

test('clearRoleData 清理全部角色 key', () => {
  mock.reset()
  seedRole('u1', '角色A', 200)
  S.clearRoleData('u1')
  assert.equal(S.getPetCfg('u1').level, 175)
  assert.equal(S.getPetCur('u1'), null)
  assert.equal(S.getChainCur('u1'), null)
  assert.deepEqual(S.getPetRuns('u1'), [])
  assert.deepEqual(S.getChainRuns('u1'), [])
})
