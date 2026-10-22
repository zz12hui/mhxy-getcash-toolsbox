const test = require('node:test')
const assert = require('node:assert/strict')
const mock = require('./helpers/mock-wx')

let pageDef = null
Object.assign(global.wx, { showToast: () => {} })
global.Page = def => { pageDef = def }

require('../pages/prices/prices.js')
const S = require('../utils/storage')
const C = require('../utils/constants')

function createPage() {
  return Object.assign({}, pageDef, {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(patch) { Object.assign(this.data, patch) }
  })
}

test('物品参考价：任务物品 + 奖励价目表', () => {
  mock.reset()
  S.saveUsers([{ id: 'u1', name: '角色A', createdAt: 1 }])
  S.saveActiveUser('u1')
  S.savePetPrices('u1', { equip60: 200000 })
  const page = createPage()
  page.loadData()
  assert.equal(page.data.roleName, '角色A')
  assert.equal(page.data.petRows.length, C.PET_TYPES.length)
  assert.equal(page.data.chainRows.length, C.CHAIN_TYPES.length)
  assert.equal(page.data.books.length, C.BOOK_LVLS.length)
  assert.ok(page.data.ratioText.indexOf('3000 万两 = 202 元') >= 0)
  const equip = page.data.petRows.find(r => r.name === '60环装')
  assert.equal(equip.custom, true)
  assert.equal(equip.curWan, '20')
})
