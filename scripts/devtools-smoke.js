/* eslint-disable no-console */
/**
 * 微信开发者工具自动化冒烟测试（v1.2 A+B 核心路径）
 *
 * 前置：
 *   1. 已通过微信开发者工具扫码登录（游客模式无法使用自动化）
 *   2. 开发者工具 设置 → 安全设置 → 服务端口 已开启
 *   3. 项目已导入且云环境可编译（云函数是否部署不影响本地记录流程）
 *
 * 运行：
 *   npm run smoke
 *
 * 可选环境变量：
 *   WX_DEVTOOLS_CLI  开发者工具 cli.bat 路径（默认 C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat）
 *   WX_PROJECT       小程序项目路径（默认仓库根目录）
 *   WX_AUTO_PORT     自动化端口（默认 9420）
 */
const path = require('path')
const fs = require('fs')
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

async function tapByText(page, selector, text) {
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

async function main() {
  if (!fs.existsSync(CLI)) {
    console.error('找不到开发者工具 CLI：' + CLI)
    console.error('请通过环境变量 WX_DEVTOOLS_CLI 指定 cli.bat 路径')
    process.exit(2)
  }

  let miniProgram
  try {
    miniProgram = await automator.launch({
      cliPath: CLI,
      projectPath: PROJECT,
      port: PORT
    })
  } catch (err) {
    console.error('启动开发者工具失败：' + (err && err.message))
    console.error('请确认：① 已扫码登录；② 设置 → 安全设置 → 服务端口已开启；③ 项目能正常编译')
    process.exit(2)
  }

  try {
    // ===== 宠环：新建 → 连续记录 → 撤销 =====
    let page = await miniProgram.reLaunch('/pages/pet/pet')
    await page.waitFor(1500)
    let data = await page.data()
    record('宠环页面加载', !!data, 'hasCur=' + data.hasCur)

    if (!data.hasCur) {
      const started = await tapByText(page, '.empty-state .btn', '开始新跑环')
      await page.waitFor(1000)
      data = await page.data()
      record('宠环新建记录', started && data.hasCur === true, 'nextRing=' + data.nextRing)
    }

    const picked = await tapByText(page, '.qb-t', '找人')
    if (picked) {
      const before = (await page.data()).completed
      await (await page.$('.qb-go')).tap()
      await page.waitFor(600)
      await (await page.$('.qb-go')).tap()
      await page.waitFor(800)
      data = await page.data()
      record('宠环连续记录（任务类型保留）', data.completed >= before + 2, 'completed=' + data.completed + ' → ' + (before + 2))
      record('常用任务快速栏 ≤ 8 个', (data.quickTasks || []).length <= 8, 'quickTasks=' + (data.quickTasks || []).length)

      const undone = await tapByText(page, '.grid-tools .btn', '撤销')
      await page.waitFor(600)
      data = await page.data()
      record('撤销回到上一环', undone && data.completed === before + 1, 'completed=' + data.completed)
    } else {
      record('宠环任务选择', false, '未找到「找人」任务按钮')
    }

    // ===== 跑环：新建 =====
    page = await miniProgram.reLaunch('/pages/chain/chain')
    await page.waitFor(1500)
    data = await page.data()
    record('跑环页面加载', !!data, 'hasCur=' + data.hasCur)
    if (!data.hasCur) {
      const started = await tapByText(page, '.empty-state .btn', '开始新任务链')
      await page.waitFor(1000)
      data = await page.data()
      record('跑环新建记录', started && data.hasCur === true, 'nextRing=' + data.nextRing)
    }

    // ===== 隐私与协议页 =====
    page = await miniProgram.reLaunch('/pages/privacy/privacy')
    await page.waitFor(800)
    data = await page.data()
    record('隐私与协议页可打开', data.activeTab === 'privacy')

    // ===== 个人中心（账号闭环入口存在） =====
    page = await miniProgram.reLaunch('/pages/profile/profile')
    await page.waitFor(800)
    data = await page.data()
    record('个人中心加载', !!data && Array.isArray(data.users), '角色数=' + (data.roleCount || 0))
  } catch (err) {
    console.error('冒烟测试异常：' + (err && err.stack ? err.stack : err))
    record('执行完整性', false, err && err.message)
  } finally {
    try { await miniProgram.close() } catch (e) { /* ignore */ }
  }

  const failed = results.filter(r => !r.ok)
  console.log('\n结果：' + (results.length - failed.length) + '/' + results.length + ' 通过')
  process.exit(failed.length ? 1 : 0)
}

main()
