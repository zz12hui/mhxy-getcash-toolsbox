/* eslint-disable no-console */
/**
 * v1.2 A+B 自动化验收（比 smoke 覆盖更全）
 *
 * 前置：开发者工具已扫码登录、服务端口开启、项目可编译。
 * 运行：npm run accept
 *
 * 说明：
 *  - automator 的 page.callMethod 在当前工具版本不可用，改用真实点击 + page.setData；
 *  - wx.showModal 原生弹窗不在自动化 DOM 中，涉及确认框的流程由 Node 单测覆盖。
 */
const path = require('path')
const fs = require('fs')
const net = require('net')
const { spawn, execSync } = require('child_process')
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
    const finish = ok => {
      if (done) return
      done = true
      socket.destroy()
      resolve(ok)
    }
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
  console.log('未检测到自动化端口，正在通过 CLI 启动自动化...')
  const cmd = '"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT
  const child = spawn(cmd, { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  if (!(await waitPort(PORT, 90000))) throw new Error('等待自动化端口超时')
  return automator.connect({ wsEndpoint })
}

async function getPage(miniProgram) {
  return miniProgram.currentPage()
}

async function getData(miniProgram) {
  const page = await getPage(miniProgram)
  return page.data()
}

async function waitRoute(miniProgram, expected, timeoutMs) {
  const start = Date.now()
  const limit = timeoutMs || 4000
  while (Date.now() - start < limit) {
    const page = await getPage(miniProgram)
    if (page.path === expected) return true
    await sleep(300)
  }
  return false
}

async function tapByText(miniProgram, selector, text) {
  const page = await getPage(miniProgram)
  const nodes = await page.$$(selector)
  for (const node of nodes) {
    const label = (await node.text()).trim()
    if (label.indexOf(text) >= 0) {
      await node.tap()
      return true
    }
  }
  return false
}

async function inputBySelector(miniProgram, selector, value) {
  const page = await getPage(miniProgram)
  const node = await page.$(selector)
  if (!node) return false
  await node.input(String(value))
  return true
}

async function main() {
  if (!fs.existsSync(CLI)) {
    console.error('找不到开发者工具 CLI：' + CLI)
    process.exit(2)
  }
  let miniProgram
  try {
    if (process.argv.indexOf('--clean') >= 0) {
      console.log('清理小程序数据缓存（storage），保证从干净状态验收...')
      try {
        execSync('"' + CLI + '" cache --clean storage --project "' + PROJECT + '"', { stdio: 'ignore' })
      } catch (e) {
        console.log('清理缓存失败（不影响继续）: ' + (e && e.message))
      }
    }
    miniProgram = await openAutomation()
  } catch (err) {
    console.error('连接自动化失败：' + (err && err.message))
    process.exit(2)
  }

  try {
    // ===== 1. 宠环：可记录 + 常用任务展开/收起 =====
    await miniProgram.reLaunch('/pages/pet/pet')
    await sleep(1500)
    let data = await getData(miniProgram)
    if (!data.hasCur) {
      await tapByText(miniProgram, '.empty-state .btn', '开始新跑环')
      await sleep(800)
      data = await getData(miniProgram)
    }
    const baseCompleted = data.completed
    record('宠环页面可记录', data.hasCur === true, 'completed=' + baseCompleted)

    const moreBtn = await (await getPage(miniProgram)).$('.qb-more')
    if (moreBtn) {
      await moreBtn.tap()
      await sleep(500)
      const allCount = (await (await getPage(miniProgram)).$$('.qb-t')).length
      await (await (await getPage(miniProgram)).$('.qb-more')).tap()
      await sleep(500)
      const smallCount = (await (await getPage(miniProgram)).$$('.qb-t')).length
      record('常用任务可展开/收起', allCount === 13 && smallCount === 8, 'all=' + allCount + ' small=' + smallCount)
    } else {
      record('常用任务可展开/收起', false, '未找到「更多」按钮')
    }

    // ===== 2. 环号跳转 =====
    await inputBySelector(miniProgram, '.jump-box input', '50')
    await tapByText(miniProgram, '.jump-box .btn', '跳转')
    await sleep(600)
    data = await getData(miniProgram)
    record('环号跳转打开指定环编辑', data.showEditModal === true && data.editRing === 50, 'editRing=' + data.editRing)
    await tapByText(miniProgram, '.sheet-actions .btn', '取消')
    await sleep(400)

    // ===== 3. 批量填充「下一整十」 =====
    await tapByText(miniProgram, '.grid-tools .btn', '批量填充')
    await sleep(500)
    await tapByText(miniProgram, '.batch-quick-btns .btn', '下一整十')
    await sleep(300)
    data = await getData(miniProgram)
    const plannedOk = data.batchCount > 0 && data.batchCount <= 10
    await tapByText(miniProgram, '.sheet-actions .btn', '填充')
    await sleep(800)
    data = await getData(miniProgram)
    record('批量填充「下一整十」', plannedOk && data.completed >= baseCompleted + 1,
      'batch=' + data.batchStart + '-' + data.batchEnd + ' completed=' + data.completed)

    // ===== 4. 价格设 0 =====
    data = await getData(miniProgram)
    const headerBtns = await (await getPage(miniProgram)).$$('.header-r .btn')
    await headerBtns[headerBtns.length - 1].tap()
    await sleep(400)
    const menuOk = await tapByText(miniProgram, '.more-menu-item', '物品价格设置')
    await sleep(600)
    const pricePage = await getPage(miniProgram)
    const priceData = await pricePage.data()
    const nextPrices = Object.assign({}, priceData.prices, { equip60: 0 })
    await pricePage.setData({ prices: nextPrices })
    await sleep(300)
    const saved = await tapByText(miniProgram, '.sheet-actions .btn', '保存')
    await sleep(800)
    const stored = await miniProgram.callWxMethod('getStorageSync', 'mhxy_prices_' + priceData.activeUser)
    record('价格设置可为 0 并保存', menuOk && saved && stored && stored.equip60 === 0, 'equip60=' + (stored && stored.equip60))

    // ===== 5. 价格 0 生效 + 物品名记忆 =====
    await inputBySelector(miniProgram, '.qb-input', '60级武器')
    await tapByText(miniProgram, '.qb-t', '60环装')
    const goBtn = await (await getPage(miniProgram)).$('.qb-go')
    await goBtn.tap()
    await sleep(800)
    data = await getData(miniProgram)
    record('价格 0 生效（60环装费用不计入）', data.costWan === '0', 'costWan=' + data.costWan)
    record('物品名记忆为 chips', (data.itemChips || []).indexOf('60级武器') >= 0, 'chips=' + JSON.stringify(data.itemChips))

    // ===== 6. 撤销 =====
    const beforeUndo = data.completed
    await tapByText(miniProgram, '.grid-tools .btn', '撤销')
    await sleep(600)
    data = await getData(miniProgram)
    // 撤销可能回退单环，也可能回退上一批批量填充；只校验「轮次减少」
    record('撤销恢复上一环', data.completed < beforeUndo, 'completed=' + data.completed + ' before=' + beforeUndo)

    // ===== 7. 跑环：新建 + 记录 + 撤销 =====
    await miniProgram.reLaunch('/pages/chain/chain')
    await sleep(1500)
    data = await getData(miniProgram)
    if (!data.hasCur) {
      await tapByText(miniProgram, '.empty-state .btn', '开始新任务链')
      await sleep(800)
      data = await getData(miniProgram)
    }
    const chainBase = data.completed
    record('跑环页面可记录', data.hasCur === true, 'completed=' + chainBase)
    await tapByText(miniProgram, '.qb-t', '寻人')
    await (await (await getPage(miniProgram)).$('.qb-go')).tap()
    await sleep(500)
    await (await (await getPage(miniProgram)).$('.qb-go')).tap()
    await sleep(700)
    data = await getData(miniProgram)
    record('跑环连续记录', data.completed === chainBase + 2, 'completed=' + data.completed)
    await tapByText(miniProgram, '.grid-tools .btn', '撤销')
    await sleep(600)
    data = await getData(miniProgram)
    record('跑环撤销', data.completed === chainBase + 1, 'completed=' + data.completed)

    // ===== 8. 隐私与协议 Tab =====
    await miniProgram.reLaunch('/pages/privacy/privacy')
    await sleep(800)
    await tapByText(miniProgram, '.tabs .tab', '用户协议')
    await sleep(400)
    data = await getData(miniProgram)
    record('隐私页可切换用户协议', data.activeTab === 'terms', 'activeTab=' + data.activeTab)

    // ===== 9. 个人中心 → 账号页 =====
    await miniProgram.reLaunch('/pages/profile/profile')
    await sleep(1200)
    const card = await (await getPage(miniProgram)).$('.profile-card')
    // scroll-view 内的卡片用 tap() 坐标点击在部分工具版本不生效，trigger('tap') 更稳
    if (card) await card.trigger('tap')
    const loginOk = card ? await waitRoute(miniProgram, 'pages/login/login', 5000) : false
    const route = (await getPage(miniProgram)).path
    record('个人中心可进入账号页', loginOk, 'route=' + route)

    // ===== 10. 意见反馈页 =====
    await miniProgram.reLaunch('/pages/profile/profile')
    await sleep(1200)
    const serviceItems = await (await getPage(miniProgram)).$$('.service-item')
    let feedbackOk = false
    for (const item of serviceItems) {
      const label = (await item.text()).trim()
      if (label.indexOf('意见反馈') >= 0) {
        await item.trigger('tap')
        feedbackOk = true
        break
      }
    }
    const feedbackRouteOk = feedbackOk ? await waitRoute(miniProgram, 'pages/feedback/feedback', 5000) : false
    const route2 = (await getPage(miniProgram)).path
    record('意见反馈页可进入', feedbackRouteOk, 'route=' + route2)

    // ===== 11. 使用引导点击遮罩空白可关闭 =====
    await miniProgram.reLaunch('/pages/pet/pet')
    await sleep(1000)
    const petPage = await getPage(miniProgram)
    await petPage.setData({ showGuide: true, guideStep: 0 })
    await sleep(400)
    const guideOverlay = await (await getPage(miniProgram)).$('.sheet-overlay')
    let petGuideClosed = false
    if (guideOverlay) {
      await guideOverlay.trigger('tap')
      await sleep(400)
      petGuideClosed = (await getData(miniProgram)).showGuide === false
    }
    record('宠环使用引导点击空白可关闭', petGuideClosed)

    await miniProgram.reLaunch('/pages/chain/chain')
    await sleep(1000)
    const chainPage = await getPage(miniProgram)
    await chainPage.setData({ showGuide: true, guideStep: 0 })
    await sleep(400)
    const guideOverlay2 = await (await getPage(miniProgram)).$('.sheet-overlay')
    let chainGuideClosed = false
    if (guideOverlay2) {
      await guideOverlay2.trigger('tap')
      await sleep(400)
      chainGuideClosed = (await getData(miniProgram)).showGuide === false
    }
    record('跑环使用引导点击空白可关闭', chainGuideClosed)

    // ===== 12. 收益账本页 =====
    await miniProgram.reLaunch('/pages/ledger/ledger')
    await sleep(1200)
    const ledgerData = await getData(miniProgram)
    record('收益账本页可打开', !!(ledgerData && ledgerData.summary), 'count=' + (ledgerData.summary && ledgerData.summary.count))
    await tapByText(miniProgram, '.period-chip', '全部')
    await sleep(600)
    const ledgerAll = await getData(miniProgram)
    record('账本周期筛选可切换', ledgerAll.period === 'all', 'period=' + ledgerAll.period)
    await tapByText(miniProgram, '.currency-switch .cur-item', '人民币')
    await sleep(600)
    const ledgerYuan = await getData(miniProgram)
    record('账本人民币显示可切换', ledgerYuan.currency === 'yuan' && String(ledgerYuan.summary && ledgerYuan.summary.profitStr).indexOf('元') >= 0, 'currency=' + ledgerYuan.currency)

    // ===== 13. 首页收益大栏目 & 我的页入口 =====
    await miniProgram.reLaunch('/pages/index/index')
    await sleep(1200)
    const homeData = await getData(miniProgram)
    const homeHero = await (await getPage(miniProgram)).$('.ledger-hero')
    let homeHeroOk = !!(homeData.ledgerSummary && homeHero)
    if (homeHero) { await homeHero.trigger('tap') ; await sleep(800) }
    const homeLedgerRoute = await waitRoute(miniProgram, 'pages/ledger/ledger', 4000)
    record('首页收益大栏目可进入账本', homeHeroOk && homeLedgerRoute, 'hasSummary=' + !!homeData.ledgerSummary)
    record('首页金价计算器（默认 3000万=202元）', homeData.goldYuan === '202' && String(homeData.goldRatioText).indexOf('3000') >= 0, 'ratio=' + homeData.goldRatioText)

    await miniProgram.reLaunch('/pages/profile/profile')
    await sleep(1200)
    const profileData = await getData(miniProgram)
    const profileHero = await (await getPage(miniProgram)).$('.ledger-hero')
    record('我的页有收益账本入口', !!(profileData.ledgerSummary && profileHero), 'hasSummary=' + !!profileData.ledgerSummary)
  } catch (err) {
    console.error('验收脚本异常：' + (err && err.stack ? err.stack : err))
    record('执行完整性', false, err && err.message)
  } finally {
    try {
      // close() 会关闭项目窗口并释放自动化端口，保证下次可重新启动
      if (miniProgram) await miniProgram.close()
    } catch (e) { /* ignore */ }
  }

  const failed = results.filter(r => !r.ok)
  console.log('\n结果：' + (results.length - failed.length) + '/' + results.length + ' 通过')
  process.exit(failed.length ? 1 : 0)
}

main()
