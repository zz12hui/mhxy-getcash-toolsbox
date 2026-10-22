// ===== Storage helpers =====
// Each save function returns true on success, false on error.
// Errors are logged via console.error for debugging.
// Callers can check return value or the module-level _lastError.

let _lastError = null

function logError(op, key, e) {
  _lastError = { op, key, msg: (e && e.message) || 'unknown', time: Date.now() }
  console.error('[storage]', op, key, _lastError.msg)
}

function getUsers() {
  try { return wx.getStorageSync('mhxy_users') || [] } catch (e) { return [] }
}

function saveUsers(users) {
  try { wx.setStorageSync('mhxy_users', users); return true } catch (e) { logError('save', 'mhxy_users', e); return false }
}

function getActiveUser() {
  try { return wx.getStorageSync('mhxy_active') || null } catch (e) { return null }
}

function saveActiveUser(uid) {
  try { wx.setStorageSync('mhxy_active', uid); return true } catch (e) { logError('save', 'mhxy_active', e); return false }
}

// ===== Pet ring storage =====
const C = require('./constants')

function getPetPrices(uid) {
  try { return wx.getStorageSync('mhxy_prices_' + uid) || { ...C.P_DEFAULT_PRICES } } catch (e) { return { ...C.P_DEFAULT_PRICES } }
}
function savePetPrices(uid, prices) {
  try { wx.setStorageSync('mhxy_prices_' + uid, prices); return true } catch (e) { logError('save', 'mhxy_prices_' + uid, e); return false }
}

function getPetCfg(uid) {
  try { return wx.getStorageSync('mhxy_cfg_' + uid) || { level: 175 } } catch (e) { return { level: 175 } }
}
function savePetCfg(uid, cfg) {
  try { wx.setStorageSync('mhxy_cfg_' + uid, cfg); return true } catch (e) { logError('save', 'mhxy_cfg_' + uid, e); return false }
}

function getPetCur(uid) {
  try { return wx.getStorageSync('mhxy_cur_' + uid) || null } catch (e) { return null }
}
function savePetCur(uid, cur) {
  if (cur === null) {
    try { wx.removeStorageSync('mhxy_cur_' + uid); return true } catch (e) { logError('remove', 'mhxy_cur_' + uid, e); return false }
  } else {
    try { wx.setStorageSync('mhxy_cur_' + uid, cur); return true } catch (e) { logError('save', 'mhxy_cur_' + uid, e); return false }
  }
}

function getPetRuns(uid) {
  try { return wx.getStorageSync('mhxy_runs_' + uid) || [] } catch (e) { return [] }
}
function savePetRuns(uid, runs) {
  try { wx.setStorageSync('mhxy_runs_' + uid, runs); return true } catch (e) { logError('save', 'mhxy_runs_' + uid, e); return false }
}

// ===== Chain storage =====
function getChainPrices(uid) {
  try { return wx.getStorageSync('mhxy3_prices_' + uid) || { ...C.C_DEFAULT_PRICES } } catch (e) { return { ...C.C_DEFAULT_PRICES } }
}
function saveChainPrices(uid, prices) {
  try { wx.setStorageSync('mhxy3_prices_' + uid, prices); return true } catch (e) { logError('save', 'mhxy3_prices_' + uid, e); return false }
}

function getChainCfg(uid) {
  try { return wx.getStorageSync('mhxy3_cfg_' + uid) || { level: 175 } } catch (e) { return { level: 175 } }
}
function saveChainCfg(uid, cfg) {
  try { wx.setStorageSync('mhxy3_cfg_' + uid, cfg); return true } catch (e) { logError('save', 'mhxy3_cfg_' + uid, e); return false }
}

function getChainCur(uid) {
  try { return wx.getStorageSync('mhxy3_cur_' + uid) || null } catch (e) { return null }
}
function saveChainCur(uid, cur) {
  if (cur === null) {
    try { wx.removeStorageSync('mhxy3_cur_' + uid); return true } catch (e) { logError('remove', 'mhxy3_cur_' + uid, e); return false }
  } else {
    try { wx.setStorageSync('mhxy3_cur_' + uid, cur); return true } catch (e) { logError('save', 'mhxy3_cur_' + uid, e); return false }
  }
}

function getChainRuns(uid) {
  try { return wx.getStorageSync('mhxy3_runs_' + uid) || [] } catch (e) { return [] }
}
function saveChainRuns(uid, runs) {
  try { wx.setStorageSync('mhxy3_runs_' + uid, runs); return true } catch (e) { logError('save', 'mhxy3_runs_' + uid, e); return false }
}

// ===== WeChat login profile =====
function getWxProfile() {
  try { return wx.getStorageSync('mhxy_wx_profile') || null } catch (e) { return null }
}
function saveWxProfile(profile) {
  try { wx.setStorageSync('mhxy_wx_profile', profile); return true } catch (e) { logError('save', 'mhxy_wx_profile', e); return false }
}
function clearWxProfile() {
  try { wx.removeStorageSync('mhxy_wx_profile'); return true } catch (e) { logError('remove', 'mhxy_wx_profile', e); return false }
}

// ===== Last sync timestamp =====
function getLastSyncAt() {
  try { return wx.getStorageSync('mhxy_last_sync_at') || null } catch (e) { return null }
}
function saveLastSyncAt(ts) {
  try { wx.setStorageSync('mhxy_last_sync_at', ts); return true } catch (e) { logError('save', 'mhxy_last_sync_at', e); return false }
}

// ===== Whole account backup / restore (v1.2) =====
// 云备份按角色整体导出/恢复：roles = [{ id, name, createdAt, pet, chain }]
const ROLE_KEYS = [
  'mhxy_cfg_', 'mhxy_cur_', 'mhxy_runs_', 'mhxy_prices_',
  'mhxy3_cfg_', 'mhxy3_cur_', 'mhxy3_runs_', 'mhxy3_prices_',
  'mhxy_task_usage_pet_', 'mhxy_task_usage_chain_', 'mhxy_items_',
  'mhxy_guide_seen_pet_', 'mhxy_guide_seen_chain_'
]

function clearRoleData(uid) {
  if (!uid) return
  ROLE_KEYS.forEach(k => {
    try { wx.removeStorageSync(k + uid) } catch (e) { logError('remove', k + uid, e) }
  })
}

function exportAllRoles() {
  return getUsers().map(u => ({
    id: u.id,
    name: u.name,
    createdAt: u.createdAt,
    pet: {
      cfg: getPetCfg(u.id),
      prices: getPetPrices(u.id),
      runs: getPetRuns(u.id),
      cur: getPetCur(u.id)
    },
    chain: {
      cfg: getChainCfg(u.id),
      prices: getChainPrices(u.id),
      runs: getChainRuns(u.id),
      cur: getChainCur(u.id)
    }
  }))
}

// 用云端快照整体替换本地角色与数据；返回是否成功
function applyAllRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return false
  const oldUsers = getUsers()
  const users = roles.map((r, idx) => ({
    id: String(r.id || ('user_' + Date.now() + '_' + idx)),
    name: String(r.name || '角色').slice(0, 12),
    createdAt: Number(r.createdAt) || Date.now()
  }))
  // 先写角色列表；写失败则不动旧数据，避免解析到一半丢失
  if (!saveUsers(users)) return false

  const newIds = {}
  users.forEach(u => { newIds[u.id] = true })
  oldUsers.forEach(u => {
    if (!newIds[u.id]) clearRoleData(u.id)
  })

  roles.forEach((r, idx) => {
    const uid = users[idx].id
    const pet = r.pet || {}
    const chain = r.chain || {}
    clearRoleData(uid)
    if (pet.cfg) savePetCfg(uid, pet.cfg)
    if (pet.prices) savePetPrices(uid, pet.prices)
    if (Array.isArray(pet.runs)) savePetRuns(uid, pet.runs)
    savePetCur(uid, pet.cur || null)
    if (chain.cfg) saveChainCfg(uid, chain.cfg)
    if (chain.prices) saveChainPrices(uid, chain.prices)
    if (Array.isArray(chain.runs)) saveChainRuns(uid, chain.runs)
    saveChainCur(uid, chain.cur || null)
  })

  saveActiveUser(users[0].id)
  return true
}

// 腾讯文档报表绑定（本机记录，换设备后需重新生成）
function getDocsBinding(uid) {
  try { return wx.getStorageSync('mhxy_docs_doc_' + uid) || null } catch (e) { return null }
}

function saveDocsBinding(uid, binding) {
  try { wx.setStorageSync('mhxy_docs_doc_' + uid, binding); return true } catch (e) { return false }
}

function clearDocsBinding(uid) {
  try { wx.removeStorageSync('mhxy_docs_doc_' + uid); return true } catch (e) { return false }
}

module.exports = {
  getUsers, saveUsers, getActiveUser, saveActiveUser,
  getPetPrices, savePetPrices, getPetCfg, savePetCfg,
  getPetCur, savePetCur, getPetRuns, savePetRuns,
  getChainPrices, saveChainPrices, getChainCfg, saveChainCfg,
  getChainCur, saveChainCur, getChainRuns, saveChainRuns,
  getWxProfile, saveWxProfile, clearWxProfile,
  getLastSyncAt, saveLastSyncAt,
  getDocsBinding, saveDocsBinding, clearDocsBinding,
  clearRoleData, exportAllRoles, applyAllRoles,
  getLastError: () => _lastError
}
