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

module.exports = {
  getUsers, saveUsers, getActiveUser, saveActiveUser,
  getPetPrices, savePetPrices, getPetCfg, savePetCfg,
  getPetCur, savePetCur, getPetRuns, savePetRuns,
  getChainPrices, saveChainPrices, getChainCfg, saveChainCfg,
  getChainCur, saveChainCur, getChainRuns, saveChainRuns,
  getLastError: () => _lastError
}
