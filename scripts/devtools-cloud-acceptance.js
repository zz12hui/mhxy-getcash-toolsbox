/* eslint-disable no-console */
/**
 * v1.2 云功能自动化验收（登录 / FAQ / 云备份 / 反馈）
 *
 * 前置：开发者工具已扫码登录、服务端口开启；4 个云函数已部署（init/getPhone/syncUpload/syncDownload）。
 * 运行：npm run accept:cloud
 *
 * 说明：wx.showModal 确认框无法被自动化，恢复流程只验证到「备份调用成功」；其余走真实点击。
 */
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn } = require('child_process')
const automator = require('miniprogram-automator')

const DEFAULT_CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat'
const CLI = process.env.WX_DEVTOOLS_CLI || DEFAULT_CLI
const PROJECT = process.env.WX_PROJECT || path.resolve(__dirname, '..')
const PORT = Number(process.env.WX_AUTO_PORT || 9420)

const results = []

function record(name, ok, detail) {
  results.push({ name, ok })
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''))
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function isPortOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    let done = false
    const finish = ok => { if (done) return; done = true; socket.destroy(); resolve(ok) }
    socket.setTimeout(1000)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function waitPort(port, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true
    await sleep(1000)
  }
  return false
}

async function openAutomation() {
  const wsEndpoint = process.env.WX_WS_ENDPOINT || ('ws://127.0.0.1:' + PORT)
  if (process.env.WX_WS_ENDPOINT || await isPortOpen(PORT)) {
    return automator.connect({ wsEndpoint })
  }
  const cmd = '"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT
  const child = spawn(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  if (!(await waitPort(PORT, 90000))) throw new Error('等待自动化端口超时')
  return automator.connect({ wsEndpoint })
}

async function getPage(mp) { return mp.currentPage() }
async function getData(mp) { return (await getPage(mp)).data() }

async function tapByText(mp, selector, text, useTrigger) {
  const page = await getPage(mp)
  const nodes = await page.$$(selector)
  for (const node of nodes) {
    const label = (await node.text()).trim()
    if (label.indexOf(text) >= 0) {
      if (useTrigger) await node.trigger('tap')
      else await node.tap()
      return true
    }
  }
  return false
}

async function main() {
  if (!fs.existsSync(CLI)) {
    console.error('找不到开发者工具 CLI：' + CLI)
    process.exit(2)
  }
  let miniProgram
  try {
    miniProgram = await openAutomation()
  } catch (err) {
    console.error('连接自动化失败：' + (err && err.message))
    process.exit(2)
  }

  try {
    // ===== 1. 微信登录（云函数 login） =====
    await miniProgram.reLaunch('/pages/login/login')
    await sleep(1500)
    let data = await getData(miniProgram)
    if (!data.isLoggedIn) {
      const btn = await (await getPage(miniProgram)).$('.login-btn')
      if (btn) await btn.trigger('tap')
      for (let i = 0; i < 20; i++) {
        await sleep(500)
        data = await getData(miniProgram)
        if (data.isLoggedIn) break
      }
    }
    record('微信登录（login 云函数）', data.isLoggedIn === true, 'isLoggedIn=' + data.isLoggedIn)
    const profile = await miniProgram.callWxMethod('getStorageSync', 'mhxy_wx_profile')
    record('登录态写入本地', !!(profile && profile.openid), 'openid=' + (profile && profile.openid ? profile.openid.slice(0, 8) + '...' : ''))

    // ===== 2. FAQ 云端读取 =====
    await miniProgram.reLaunch('/pages/faq/faq')
    await sleep(2500)
    data = await getData(miniProgram)
    record('FAQ 分类从云端加载', (data.categoryTabs || []).length >= 2, 'tabs=' + (data.categoryTabs || []).length)
    record('FAQ 条目从云端加载', (data.itemList || []).length > 0, 'items=' + (data.itemList || []).length)

    // ===== 3. 云备份（syncUpload 新协议） =====
    await miniProgram.reLaunch('/pages/profile/profile')
    await sleep(1200)
    const before = await miniProgram.callWxMethod('getStorageSync', 'mhxy_last_sync_at')
    const backupOk = await tapByText(miniProgram, '.menu-item', '备份到云端')
    await sleep(4000)
    const after = await miniProgram.callWxMethod('getStorageSync', 'mhxy_last_sync_at')
    record('云备份调用成功', !!backupOk && (after || 0) !== (before || 0),
      'lastSyncAt: ' + (before || 0) + ' -> ' + (after || 0))

    // ===== 3.1 读取云端备份（syncDownload 新协议），确认角色数据真的落库 =====
    const download = await miniProgram.evaluate(() => {
      return wx.cloud.callFunction({ name: 'syncDownload', data: {} }).then(res => res.result)
    })
    const roles = (download && download.data && download.data.roles) || []
    const firstRole = roles[0] || {}
    const roleDataOk = !!(firstRole.id && firstRole.pet && firstRole.pet.cfg && Array.isArray(firstRole.pet.runs))
    record('云端备份可读回（syncDownload）', roles.length >= 1 && roleDataOk,
      'roles=' + roles.length + ' role=' + (firstRole.name || '') + ' petRuns=' + ((firstRole.pet && firstRole.pet.runs) || []).length)

    // ===== 3.2 init 鉴权（无 ADMIN_OPENIDS/INIT_SECRET 时应拒绝） =====
    const initRes = await miniProgram.evaluate(() => {
      return wx.cloud.callFunction({ name: 'init', data: {} }).then(res => res.result).catch(err => ({ code: -999, message: String(err) }))
    })
    record('init 云函数受鉴权保护', !!initRes && initRes.code === 403, 'code=' + (initRes && initRes.code) + ' msg=' + ((initRes && initRes.message) || '').slice(0, 40))

    // ===== 3.3 getPhone 参数校验 =====
    const phoneRes = await miniProgram.evaluate(() => {
      return wx.cloud.callFunction({ name: 'getPhone', data: {} }).then(res => res.result).catch(err => ({ code: -999, message: String(err) }))
    })
    record('getPhone 缺少 code 时正确拒绝', !!phoneRes && phoneRes.code === -1, 'code=' + (phoneRes && phoneRes.code))

    // ===== 4. 意见反馈（submitFeedback 云函数） =====
    await miniProgram.reLaunch('/pages/feedback/feedback')
    await sleep(1200)
    const page = await getPage(miniProgram)
    const textarea = await page.$('.form-textarea')
    if (textarea) await textarea.input('v1.2 自动化验收反馈，可忽略')
    const submit = await tapByText(miniProgram, '.feedback-form .btn', '提交反馈')
    await sleep(3000)
    data = await getData(miniProgram)
    record('意见反馈提交成功', !!submit && data.submitted === true, 'submitted=' + data.submitted)
  } catch (err) {
    console.error('云验收脚本异常：' + (err && err.stack ? err.stack : err))
    record('执行完整性', false, err && err.message)
  } finally {
    try {
      if (miniProgram) await miniProgram.close()
    } catch (e) { /* ignore */ }
  }

  const failed = results.filter(r => !r.ok)
  console.log('\n结果：' + (results.length - failed.length) + '/' + results.length + ' 通过')
  process.exit(failed.length ? 1 : 0)
}

main()
