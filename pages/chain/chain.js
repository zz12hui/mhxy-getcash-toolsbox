const C = require('../../utils/constants')
const S = require('../../utils/storage')
const RING_COST = require('../../utils/ring-cost')
const TASK_USAGE = require('../../utils/task-usage')
const ITEM_MEMORY = require('../../utils/item-memory')
const UI = require('../../utils/ui')
const UNDO = require('../../utils/undo')
const MOTION = require('../../utils/motion')
const NAV = require('../../utils/home-nav')
const TABBAR = require('../../utils/tabbar')
const REWARD_PRICES = require('../../utils/reward-prices')
const LEDGER = require('../../utils/ledger')
const MONEY = require('../../utils/money')
const app = getApp()

Page({
  data: {
    tab: 'record',
    // User
    users: [], activeUser: '', currentUserName: '', userIdx: 0, userNames: [],
    // Config
    cfg: { level: 175 }, hasCur: false, isPaused: false, moneyCfg: {}, reduceMotion: false,
    // Record
    chainTypes: [], quickTasks: [], showAllTasks: false,
    itemChips: [], modalTask: '', qbItem: '', jumpRing: '', undoCount: 0, vibrateOn: true,
    completed: 0, remaining: 300, costWan: '0', completedPct: 0,
    nextRing: 0, ringList: [], gridCells: [],
    seg1Done: false, seg2Done: false, seg3Done: false, curSeg: 1,
    // Reward
    rewardLv: 175, rewardRuleStr: '', rewardRuleShort: '',
    segRewards: [], rewardRows: [],
    // History
    history: [],
    showRunDetail: false, runDetailRun: null,
    // Stats
    stats: {}, typeDist: [],
    // Guide
    showGuide: false, guideStep: 0,
    guideSteps: [
      { icon: '👤', title: '创建角色', desc: '点击标题栏角色名切换或创建角色，不同角色数据完全隔离', pos: '📍 位置：标题栏左侧，角色名显示区域' },
      { icon: '⚙️', title: '设置等级', desc: '输入角色等级（60~175），等级决定三段奖励的书铁等级区间', pos: '📍 位置：标题栏 Lv. 输入框' },
      { icon: '💰', title: '设置物品价格', desc: '修改60环装/80环装/兽诀等物品价格，用于准确计算总费用', pos: '👉 操作：标题栏 ⋯ → 💰 物品价格设置' },
      { icon: '▶️', title: '开始任务链', desc: '开始新一轮300环任务链，每个角色独立存储数据', pos: '👉 操作：标题栏 "+新" 按钮（绿色）' },
      { icon: '📝', title: '记录每环任务', desc: '选择快速栏中的任务类型，点击"记录"录入当前环', pos: '📍 位置：页面中部快速栏区域，任务类型按钮 → "记录 #N" 按钮' },
      { icon: '📦', title: '批量填充', desc: '选择100环范围一键填入相同任务，快速通过找人/战斗段', pos: '👉 操作：网格标题行 → "批量填充" 按钮' },
      { icon: '🏷️', title: '段奖励记录', desc: '每完成100环自动弹出提示，选择实际获得的制造指南书/百炼精铁等级和类型', pos: '📍 位置：自动弹出，每100环触发一次' },
      { icon: '🏁', title: '完成结算', desc: '300环全部完成并记录三段奖励后自动结算', pos: '👉 操作：也可在完成300环前主动点击标题栏 "结算" 按钮' },
      { icon: '📊', title: '查看历史和统计', desc: '查看多轮任务链的费用和任务类型分布', pos: '📍 位置：顶部标签栏 → "历史" / "统计" 标签页' }
    ],
    // Modals
    showMoreMenu: false,
    showEditModal: false, editRing: 0, editSelTid: '', editItem: '', editHasCur: false, editCostWan: '0',
    showBatchModal: false, batchStart: 1, batchEnd: 100, batchCount: 100, batchSelTid: 'find_npc',
    showPricesModal: false, prices: {},
    showUserModal: false, newUserName: '',
    showSegModal: false, segRewardSeg: 100, segLabel: '', segShowCat: true,
    segCats: ['制造指南书','百炼精铁','战魄'], segCatIdx: 0,
    segFixedCat: '', segLvs: [], segLvIdx: 0,
    segSubTypes: [], segTypeIdx: 0,
    segMainReward: '', segExtras: [], segExtraChecked: [], segCustom: '',
    segMainValueWan: '', segMainItem: null, segExtraRows: [],
    segCustomValue: '', segIncomeWan: '0',
    // Toast
    toastMsg: '',
    // Running
    _cur: null
  },

  onLoad() {
    this._undo = new UNDO.UndoStack(10)
  },

  onShow() {
    const pending = NAV.takePending()
    this.loadData()
    this.setData({ vibrateOn: UI.isVibrateOn() })
    TABBAR.syncTabBar(this, 2)
    if (pending && pending.indexOf('chain:') === 0) {
      const action = pending.slice(6)
      setTimeout(() => {
        if (action === 'prices') this.showPricesSheet()
        else if (action === 'batch') this.showBatch()
        else if (['record', 'reward', 'history', 'stats'].indexOf(action) >= 0) {
          this.setData({ tab: action })
          this.loadData()
        }
      }, 220)
      return
    }
    const uid = this.data.activeUser
    if (uid && !wx.getStorageSync('mhxy_guide_seen_chain_' + uid)) {
      setTimeout(() => this.setData({ showGuide: true }), 500)
    }
  },

  onHide() {
    if (this._checkTimer) { clearTimeout(this._checkTimer); this._checkTimer = null }
    this.setTabBarHidden(false)
  },

  setTabBarHidden(hidden) {
    if (typeof this.getTabBar !== 'function') return
    const tb = this.getTabBar()
    if (tb && tb.setData) tb.setData({ hidden: !!hidden })
  },

  togglePause() {
    if (!this._cur) return
    if (this._cur.pausedAt) {
      this._cur.pausedMs = (this._cur.pausedMs || 0) + (Date.now() - this._cur.pausedAt)
      this._cur.pausedAt = null
      this.showToast('继续计时')
    } else {
      this._cur.pausedAt = Date.now()
      this.showToast('已暂停计时')
    }
    S.saveChainCur(this.data.activeUser, this._cur)
    UI.vibrate()
    this.loadData()
  },

  loadData() {
    const users = S.getUsers()
    const activeUser = S.getActiveUser()
    if (!activeUser) return

    const cfg = S.getChainCfg(activeUser)
    const cur = S.getChainCur(activeUser)
    const prices = S.getChainPrices(activeUser)
    const runs = S.getChainRuns(activeUser)
    this._cur = cur
    this._prices = prices

    const hasCur = !!cur
    const userIdx = users.findIndex(u => u.id === activeUser)

    // 快速栏：常用任务置顶（前 8 个），可展开全部
    const usage = TASK_USAGE.getUsage(activeUser, 'chain')
    const orderedTasks = TASK_USAGE.sortTasks(C.CHAIN_TYPES, usage)
    const quickTasks = this.data.showAllTasks ? orderedTasks : orderedTasks.slice(0, 8)
    const itemChips = ITEM_MEMORY.getAll(activeUser)

    let recordData = this.buildRecordData(cur, prices)
    let rewardData = this.buildRewardData(cur, cfg)
    let historyData = this.buildHistoryData(runs)
    let statsData = this.buildStatsData(runs)

    // Pre-compute chainTypes display labels (WXML can't call .toFixed)
    const chainTypes = C.CHAIN_TYPES.map(t => ({
      ...t,
      costLabel: t.cost > 0 ? (t.cost / 10000).toFixed(0) + '万' : '免费'
    }))

    this.setData({
      users: users.map(u => ({ ...u, createdStr: C.fmtDate(u.createdAt) })),
      activeUser, userIdx: Math.max(0, userIdx),
      userNames: users.map(u => u.name),
      currentUserName: users[userIdx] ? users[userIdx].name : '',
      cfg, hasCur, prices: { ...prices }, chainTypes,
      isPaused: !!(cur && cur.pausedAt),
      moneyCfg: MONEY.getMoneyCfg(),
      reduceMotion: MOTION.getReduceMotion(),
      quickTasks, itemChips, undoCount: this._undo ? this._undo.size : 0,
      ...recordData, ...rewardData,
      history: historyData, ...statsData
    })
  },

  // ===== Tab =====
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t, showMoreMenu: false, showEditModal: false, showBatchModal: false, showPricesModal: false, showUserModal: false, showSegModal: false })
  },

  // ===== More menu =====
  toggleMoreMenu() { this.setData({ showMoreMenu: !this.data.showMoreMenu }) },
  closeMoreMenu() { this.setData({ showMoreMenu: false }) },
  showUserSheet() { this.setData({ showMoreMenu: false, showUserModal: true }) },
  showPricesSheet() { this.setData({ showMoreMenu: false, showPricesModal: true }) },
  showGuideSheet() { this.setData({ showMoreMenu: false, showGuide: true, guideStep: 0 }) },
  abandonFromMenu() { this.setData({ showMoreMenu: false }); this.abandon() },

  // ===== Guide =====
  closeGuide() {
    this.setData({ showGuide: false, guideStep: 0 })
    const uid = this.data.activeUser
    if (uid) wx.setStorageSync('mhxy_guide_seen_chain_' + uid, true)
  },
  guideNext() {
    const next = this.data.guideStep + 1
    if (next >= this.data.guideSteps.length) this.closeGuide()
    else this.setData({ guideStep: next })
  },
  guidePrev() {
    this.setData({ guideStep: Math.max(0, this.data.guideStep - 1) })
  },

  // ===== User =====
  onUserChange(e) {
    const idx = parseInt(e.detail.value)
    const u = this.data.users[idx]
    if (u && u.id !== this.data.activeUser) this.switchUserById(u.id)
  },
  showUserModal() { this.setData({ showUserModal: true }) },
  closeUserModal() { this.setData({ showUserModal: false }) },

  switchUser(e) {
    this.setData({ showUserModal: false })
    this.switchUserById(e.currentTarget.dataset.uid)
  },

  switchUserById(uid) {
    S.saveActiveUser(uid)
    app.globalData.activeUser = uid
    if (this._undo) this._undo.clear()
    this.loadData()
    this.showToast('已切换角色')
  },

  deleteUser(e) {
    const uid = e.currentTarget.dataset.uid
    const users = this.data.users
    if (users.length <= 1) { this.showToast('至少保留一个角色'); return }
    wx.showModal({
      title: '确认删除',
      content: '该角色的所有人环数据将被永久删除。',
      success: res => {
        if (res.confirm) {
          S.clearRoleData(uid)
          const newUsers = users.filter(u => u.id !== uid)
          S.saveUsers(newUsers)
          if (this.data.activeUser === uid) { S.saveActiveUser(newUsers[0].id); app.globalData.activeUser = newUsers[0].id }
          if (this._undo) this._undo.clear()
          this.setData({ showUserModal: false })
          this.loadData()
        }
      }
    })
  },

  createUser() {
    const name = this.data.newUserName.trim()
    if (!name) { this.showToast('请输入角色名称'); return }
    const nu = { id: 'user_' + Date.now(), name, createdAt: Date.now() }
    const users = [...this.data.users, nu]
    S.saveUsers(users); S.saveActiveUser(nu.id); app.globalData.activeUser = nu.id
    if (this._undo) this._undo.clear()
    this.setData({ showUserModal: false, newUserName: '' })
    this.loadData()
    this.showToast('已创建角色')
  },

  onNewUserName(e) { this.setData({ newUserName: e.detail.value }) },

  // ===== Level =====
  onLevelChange(e) {
    let lv = parseInt(e.detail.value) || 175
    lv = Math.max(60, Math.min(175, lv))
    const cfg = { ...this.data.cfg, level: lv }
    S.saveChainCfg(this.data.activeUser, cfg)
    if (this._cur) { this._cur.level = lv; S.saveChainCur(this.data.activeUser, this._cur) }
    this.loadData()
  },

  // ===== Run ops =====
  startNew() {
    const cur = this._cur
    if (cur) {
      const comp = cur.rings.filter(r => r.t).length
      if (comp > 0 && comp < 300) {
        wx.showModal({
          title: '确认',
          content: `任务链未完成（${comp}/300），放弃并新建？`,
          success: res => { if (res.confirm) this.doStartNew() }
        })
        return
      }
    }
    this.doStartNew()
  },

  doStartNew() {
    if (this._undo) this._undo.clear()
    const cur = {
      id: Date.now(), level: this.data.cfg.level, startedAt: Date.now(),
      rings: Array.from({ length: 300 }, () => ({ t: null, item: '' })),
      rewards: { 100: [], 200: [], 300: [] },
      notes: '', done: false, doneAt: null, totalCost: 0
    }
    this._cur = cur
    S.saveChainCur(this.data.activeUser, cur)
    this.loadData()
    this.showToast('新任务链已开始！')
  },

  abandon() {
    wx.showModal({
      title: '确认放弃',
      content: '放弃当前任务链？',
      success: res => {
        if (res.confirm) {
          this._cur = null
          if (this._undo) this._undo.clear()
          S.saveChainCur(this.data.activeUser, null)
          this.loadData()
          this.showToast('已放弃')
        }
      }
    })
  },

  complete() {
    if (!this._cur) return
    const comp = this.data.completed
    wx.showModal({
      title: comp < 300 ? '确认' : '🏁 任务链完成',
      content: comp < 300 ? `仅完成${comp}/300环，确认结束？` : '确认结算任务链？',
      success: res => {
        if (res.confirm) this.doComplete()
      }
    })
  },

  doComplete() {
    const cur = this._cur
    if (!cur || cur.done) return
    cur.done = true; cur.doneAt = Date.now()
    cur.totalCost = RING_COST.totalCost(cur.rings, this._prices, C.C_DEFAULT_PRICES)
    const incomeItems = cur.incomeItems || []
    const summary = LEDGER.summarizeRun({
      rings: cur.rings,
      prices: this._prices,
      defaults: C.C_DEFAULT_PRICES,
      incomeItems,
      extraCost: 0,
      startedAt: cur.startedAt,
      doneAt: cur.doneAt,
      pausedMs: cur.pausedMs,
      pausedAt: cur.pausedAt
    })
    cur.ledgerVersion = 1
    cur.costItems = summary.costItems
    cur.cost = summary.cost
    if (incomeItems.length === 0) {
      cur.unbooked = true
      delete cur.incomeItems
      delete cur.income
      delete cur.profit
      delete cur.roi
      delete cur.netRate
      delete cur.hourly
      delete cur.durationMin
    } else {
      cur.unbooked = false
      cur.incomeItems = summary.incomeItems
      cur.income = summary.income
      cur.profit = summary.profit
      cur.roi = summary.roi
      cur.netRate = summary.netRate
      cur.durationMin = summary.durationMin
      cur.hourly = summary.hourly
    }
    const runs = S.getChainRuns(this.data.activeUser)
    runs.unshift({ ...cur })
    S.saveChainRuns(this.data.activeUser, runs)
    S.saveChainCur(this.data.activeUser, null)
    this._cur = null
    if (this._undo) this._undo.clear()
    this.loadData()
    const suffix = cur.unbooked
      ? '（未记账，可到历史补录收益）'
      : '|收入:' + LEDGER.formatWan(cur.income) + '万|净收益:' + LEDGER.formatWan(cur.profit) + '万'
    this.showToast('结算完成！费用:' + (cur.totalCost / 10000).toFixed(0) + '万' + suffix)
  },

  // ===== Ring editing =====
  setRing(rn, tid, item) {
    if (!this._cur) return
    this._cur.rings[rn - 1] = { t: tid, item: item || '' }
    S.saveChainCur(this.data.activeUser, this._cur)
  },

  selectTask(e) {
    const tid = e.currentTarget.dataset.tid
    this.setData({ modalTask: this.data.modalTask === tid ? '' : tid })
  },
  onQbItemInput(e) { this.setData({ qbItem: e.detail.value }) },

  quickRecord() {
    if (!this._cur) return
    const tid = this.data.modalTask
    if (!tid) { this.showToast('请先选择任务类型'); return }
    const nr = this._cur.rings.findIndex(r => !r.t) + 1
    if (!nr) { this.showToast('已全部记录'); return }
    this.pushUndo('记录第' + nr + '环')
    this.setRing(nr, tid, this.data.qbItem)
    TASK_USAGE.bump(this.data.activeUser, 'chain', tid)
    if (this.data.qbItem) ITEM_MEMORY.add(this.data.activeUser, this.data.qbItem)
    // 保留任务类型方便连续记录同类型，只清空物品名
    this.setData({ qbItem: '' })
    UI.vibrate()
    this.loadData()
    this.checkSeg()
  },

  editCell(e) {
    this.openEdit(parseInt(e.currentTarget.dataset.ring))
  },

  openEdit(rn) {
    if (!this._cur || !rn || rn < 1 || rn > 300) return
    const ring = this._cur.rings[rn - 1] || { t: null, item: '' }
    const hasCur = !!ring.t
    this.setData({
      showEditModal: true, editRing: rn,
      editSelTid: ring.t || '', editItem: ring.item || '',
      editHasCur: hasCur,
      editCostWan: (this.ringCost(ring) / 10000).toFixed(0)
    })
  },

  onJumpInput(e) { this.setData({ jumpRing: e.detail.value }) },

  jumpRingTo() {
    const rn = parseInt(this.data.jumpRing)
    if (!rn || rn < 1 || rn > 300) { this.showToast('请输入 1-300 的环号'); return }
    this.setData({ jumpRing: '' })
    this.openEdit(rn)
  },

  pickItem(e) { this.setData({ qbItem: e.currentTarget.dataset.item }) },

  closeEditModal() { this.setData({ showEditModal: false }) },
  pickEditType(e) { this.setData({ editSelTid: e.currentTarget.dataset.tid }) },
  onEditItemInput(e) { this.setData({ editItem: e.detail.value }) },

  saveEdit() {
    const tid = this.data.editSelTid
    if (!tid) { this.showToast('请选择任务类型'); return }
    this.pushUndo('编辑第' + this.data.editRing + '环')
    this.setRing(this.data.editRing, tid, this.data.editItem)
    TASK_USAGE.bump(this.data.activeUser, 'chain', tid)
    if (this.data.editItem) ITEM_MEMORY.add(this.data.activeUser, this.data.editItem)
    UI.vibrate()
    this.setData({ showEditModal: false })
    this.loadData()
    this.checkSeg()
  },

  clearEdit() {
    if (!this._cur) return
    this.pushUndo('清除第' + this.data.editRing + '环')
    this._cur.rings[this.data.editRing - 1] = { t: null, item: '' }
    S.saveChainCur(this.data.activeUser, this._cur)
    this.setData({ showEditModal: false })
    this.loadData()
  },

  clearAll() {
    if (!this._cur) return
    wx.showModal({
      title: '确认清除',
      content: '清除所有记录？',
      success: res => {
        if (res.confirm) {
          this.pushUndo('清除全部记录')
          this._cur.rings = Array.from({ length: 300 }, () => ({ t: null, item: '' }))
          this._cur.rewards = { 100: [], 200: [], 300: [] }
          S.saveChainCur(this.data.activeUser, this._cur)
          this.loadData()
          this.showToast('已清除')
        }
      }
    })
  },

  // ===== Segment check =====
  segDone(seg) {
    if (!this._cur) return false
    const s = seg >= 100 ? seg - 100 : (seg - 1) * 100
    return this._cur.rings.slice(s, s + 100).every(r => r.t)
  },

  checkSeg() {
    const cur = this._cur
    if (!cur || cur.done) return
    for (const seg of [100, 200, 300]) {
      if (this.segDone(seg) && cur.rewards[seg] && cur.rewards[seg].length === 0) {
        this._checkTimer = setTimeout(() => {
          if (this._cur !== cur) return
          if ((cur.rewards[seg] && cur.rewards[seg].length > 0)) return
          wx.showModal({
            title: `🎉 第${seg}环已完成`,
            content: '是否记录奖励？',
            success: res => { if (res.confirm && this._cur === cur) this.showSegReward(seg) }
          })
        }, 300)
        return
      }
    }
  },

  // ===== Batch =====
  showBatch() {
    const firstEmpty = this._cur ? this._cur.rings.findIndex(r => !r.t) + 1 : 1
    const end = Math.min(firstEmpty + 99, 300)
    this.setData({
      showBatchModal: true, batchStart: firstEmpty || 1,
      batchEnd: end, batchCount: end - (firstEmpty || 1) + 1,
      batchSelTid: this.data.modalTask || 'find_npc'
    })
  },

  closeBatchModal() { this.setData({ showBatchModal: false }) },

  onBatchStartInput(e) {
    const v = parseInt(e.detail.value) || 1
    this.setData({ batchStart: Math.max(1, Math.min(300, v)), batchCount: Math.max(0, this.data.batchEnd - Math.max(1, Math.min(300, v)) + 1) })
  },

  onBatchEndInput(e) {
    const v = parseInt(e.detail.value) || 1
    this.setData({ batchEnd: Math.max(1, Math.min(300, v)), batchCount: Math.max(0, Math.max(1, Math.min(300, v)) - this.data.batchStart + 1) })
  },

  quickBatchRange(e) {
    const s = parseInt(e.currentTarget.dataset.s), e2 = parseInt(e.currentTarget.dataset.e)
    this.setData({ batchStart: s, batchEnd: e2, batchCount: e2 - s + 1 })
  },

  pickBatchType(e) { this.setData({ batchSelTid: e.currentTarget.dataset.tid }) },

  confirmBatch() {
    if (!this._cur) return
    const { batchStart, batchEnd, batchSelTid } = this.data
    let effEnd = batchEnd
    // Guard against crossing segment boundaries without recording reward
    if (batchStart <= 100 && batchEnd > 100 && this._cur.rewards[100].length === 0) {
      effEnd = 100; this.showToast('已限制到第100环，请先结算第100环奖励')
    } else if (batchStart <= 200 && batchEnd > 200 && this._cur.rewards[200].length === 0) {
      effEnd = 200; this.showToast('已限制到第200环，请先结算第200环奖励')
    }
    this.pushUndo('批量填充 ' + batchStart + '-' + effEnd)
    for (let i = batchStart; i <= effEnd; i++) {
      if (!this._cur.rings[i - 1].t) this._cur.rings[i - 1] = { t: batchSelTid, item: '' }
    }
    S.saveChainCur(this.data.activeUser, this._cur)
    TASK_USAGE.bump(this.data.activeUser, 'chain', batchSelTid)
    UI.vibrate()
    this.setData({ showBatchModal: false })
    this.loadData()
    this.showToast(`已填充${batchStart}-${effEnd}环`)
    this.checkSeg()
  },

  // ===== Prices =====
  showPrices() { this.setData({ showPricesModal: true }) },
  closePricesModal() {
    // 取消编辑：恢复已保存价格，避免未保存的价格参与费用计算
    this.setData({
      showPricesModal: false,
      prices: { ...S.getChainPrices(this.data.activeUser) }
    })
  },

  onPriceChange(e) {
    const tid = e.currentTarget.dataset.tid
    const prices = { ...this.data.prices, [tid]: parseInt(e.detail.value) || 0 }
    this.setData({ prices })
  },

  savePrices() {
    const prices = { ...this.data.prices }
    S.saveChainPrices(this.data.activeUser, prices)
    this._prices = prices
    this.setData({ showPricesModal: false })
    this.loadData()
    this.showToast('价格已保存')
  },

  resetPrices() {
    wx.showModal({
      title: '确认', content: '恢复默认价格？',
      success: res => {
        if (res.confirm) {
          S.saveChainPrices(this.data.activeUser, { ...C.C_DEFAULT_PRICES })
          this._prices = { ...C.C_DEFAULT_PRICES }
          this.setData({ showPricesModal: false, prices: { ...C.C_DEFAULT_PRICES } })
          this.loadData()
          this.showToast('已恢复默认价格')
        }
      }
    })
  },

  // ===== Seg reward modal =====
  showSegReward(seg) {
    const lv = this._cur ? this._cur.level : this.data.cfg.level
    const lvls = C.cBookLevels(lv)
    const r = C.cRewardRange(lv)
    this._rewardPrices = REWARD_PRICES.getRewardPrices(this.data.activeUser)
    let label, fixedCat = '', showCat = true
    if (seg === 100) { label = '制造指南书'; fixedCat = '制造指南书'; showCat = false }
    else if (seg === 200) { label = '百炼精铁'; fixedCat = '百炼精铁'; showCat = false }
    else { label = '书/铁随机'; showCat = true }

    const subTypes = fixedCat === '制造指南书' || (!fixedCat && seg === 300)
      ? [...C.BOOK_WEAPONS, ...C.BOOK_ARMORS] : []

    const extrasLabels = r.hasLingshi
      ? ['120灵饰指南书', '140灵饰指南书', '120元灵晶石', '140元灵晶石'] : []

    const cats = r.has150 ? ['制造指南书','百炼精铁','战魄'] : ['制造指南书','百炼精铁']

    this.setData({
      showSegModal: true, segRewardSeg: seg, segLabel: label,
      segShowCat: showCat, segFixedCat: fixedCat,
      segCatIdx: 0, segLvs: lvls.map(String), segLvIdx: 0,
      segSubTypes: subTypes, segTypeIdx: 0,
      segMainReward: '', segExtraChecked: [], segCustom: '',
      segMainValueWan: '', segMainItem: null, segExtraRows: [],
      segCustomValue: '', segIncomeWan: '0',
      segExtras: extrasLabels.map(l => ({ label: l, checked: false })),
      segCats: cats
    })
    this.setTabBarHidden(true)
  },

  closeSegModal() { this.setData({ showSegModal: false }); this.setTabBarHidden(false) },

  onSegCatChange(e) { this.setData({ segCatIdx: parseInt(e.detail.value), segLvIdx: 0, segTypeIdx: 0, segMainReward: '' }) },
  onSegLvChange(e) { this.setData({ segLvIdx: parseInt(e.detail.value), segMainReward: '' }) },
  onSegTypeChange(e) { this.setData({ segTypeIdx: parseInt(e.detail.value), segMainReward: '' }) },

  addSegMain() {
    const { segCats, segCatIdx, segFixedCat, segLvs, segLvIdx, segSubTypes, segTypeIdx, segShowCat } = this.data
    const cat = segShowCat ? segCats[segCatIdx] : segFixedCat
    if (!cat) { this.showToast('请选择类别'); return }
    let item = null
    if (cat === '战魄') {
      item = { kind: 'zhanpo', name: '160级战魄' }
    } else {
      const lv = segLvs[segLvIdx]
      if (!lv) { this.showToast('请选择等级'); return }
      if (cat === '制造指南书') {
        const tp = segSubTypes[segTypeIdx]
        if (!tp) { this.showToast('请选择类型'); return }
        item = { kind: 'book', level: Number(lv), subType: tp, name: lv + '级' + cat + '-' + tp }
      } else {
        item = { kind: 'iron', level: Number(lv), name: lv + '级' + cat }
      }
    }
    const unit = REWARD_PRICES.rewardUnitPrice(this._rewardPrices, item)
    this.setData({
      segMainReward: item.name,
      segMainItem: item,
      segMainValueWan: (unit / 10000).toFixed(1)
    })
    this.computeSegPreview()
  },

  clearSegMain() {
    this.setData({ segMainReward: '', segMainItem: null, segMainValueWan: '' })
    this.computeSegPreview()
  },

  segExtraKind(label) {
    const m = String(label || '').match(/^(\d{2,3})(灵饰指南书|元灵晶石)$/)
    if (!m) return { kind: 'other', name: label }
    return {
      kind: m[2] === '灵饰指南书' ? 'lingshi_book' : 'lingshi_stone',
      level: Number(m[1]),
      name: label
    }
  },

  computeSegPreview() {
    const main = parseFloat(this.data.segMainValueWan) || 0
    const extras = (this.data.segExtraRows || []).reduce((s, r) => s + (parseFloat(r.valueWan) || 0), 0)
    const custom = parseFloat(this.data.segCustomValue) || 0
    this.setData({ segIncomeWan: (main + extras + custom).toFixed(1) })
  },

  onSegMainValueInput(e) { this.setData({ segMainValueWan: e.detail.value }); this.computeSegPreview() },
  onSegCustomValue(e) { this.setData({ segCustomValue: e.detail.value }); this.computeSegPreview() },

  onSegExtraValueInput(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const rows = this.data.segExtraRows.map((r, i) => i === idx ? Object.assign({}, r, { valueWan: e.detail.value }) : r)
    this.setData({ segExtraRows: rows })
    this.computeSegPreview()
  },

  toggleSegExtra(_e) {
    // handled by onSegExtrasChange instead
  },

  onSegExtrasChange(e) {
    const selected = e.detail.value || []
    const segExtras = this.data.segExtras.map(s => ({ label: s.label, checked: selected.indexOf(s.label) >= 0 }))
    const rows = selected.map(label => {
      const item = this.segExtraKind(label)
      const unit = REWARD_PRICES.rewardUnitPrice(this._rewardPrices, item)
      return { label, kind: item.kind, level: item.level, valueWan: (unit / 10000).toFixed(1) }
    })
    this.setData({ segExtraChecked: selected, segExtras, segExtraRows: rows })
    this.computeSegPreview()
  },

  onSegCustom(e) { this.setData({ segCustom: e.detail.value }) },

  confirmSeg() {
    if (!this._cur) return
    const seg = this.data.segRewardSeg
    const texts = []
    const items = []
    if (this.data.segMainReward) {
      const item = (this.data.segMainItem && this.data.segMainItem.kind)
        ? { ...this.data.segMainItem }
        : LEDGER.parseRewardText(this.data.segMainReward)
      if (item) {
        item.qty = 1
        item.unitPrice = Math.max(0, (parseFloat(this.data.segMainValueWan) || 0) * 10000)
        items.push(item)
        texts.push(this.data.segMainReward)
      }
    }
    const extraRows = this.data.segExtraRows || []
    extraRows.forEach(row => {
      items.push({
        kind: row.kind,
        name: row.label,
        level: row.level,
        qty: 1,
        unitPrice: Math.max(0, (parseFloat(row.valueWan) || 0) * 10000)
      })
      texts.push(row.label)
    })
    const custom = (this.data.segCustom || '').trim()
    if (custom) {
      items.push({
        kind: 'other',
        name: custom,
        qty: 1,
        unitPrice: Math.max(0, (parseFloat(this.data.segCustomValue) || 0) * 10000)
      })
      texts.push(custom)
    }
    this.pushUndo('记录第' + seg + '环奖励')
    this._cur.rewards[seg] = texts.length > 0 ? texts : ['未记录']
    const others = (this._cur.incomeItems || []).filter(i => i.seg !== seg)
    this._cur.incomeItems = items.length > 0
      ? others.concat(items.map(i => Object.assign({}, i, { seg })))
      : others
    S.saveChainCur(this.data.activeUser, this._cur)
    this.setData({ showSegModal: false })
    this.setTabBarHidden(false)
    this.loadData()
    if (seg === 300 && this.segDone(100) && this.segDone(200)) this.doComplete()
  },

  // ===== History =====
  openRunDetail(e) {
    const id = e.currentTarget.dataset.id
    const r = this.data.history.find(h => h._raw && h._raw.id === id)
    if (!r || !r._raw) return
    this.setData({ showRunDetail: true, runDetailRun: r._raw })
  },

  closeRunDetail() {
    this.setData({ showRunDetail: false, runDetailRun: null })
  },

  goLedger() {
    wx.navigateTo({ url: '/pages/ledger/ledger' })
  },

  showReport(e) {
    const id = e.currentTarget.dataset.id
    const r = this.data.history.find(h => h._raw && h._raw.id === id)
    if (!r || !r._raw) return
    const run = r._raw
    wx.showModal({
      title: '📊 任务链统计报告',
      content: `等级:${run.level} | 完成:${r.comp}/300\n费用:${r.costWan}万\n100环:${(run.rewards?.[100]||['未记录']).join(',')}\n200环:${(run.rewards?.[200]||['未记录']).join(',')}\n300环:${(run.rewards?.[300]||['未记录']).join(',')}\n时间:${r.startedStr}`,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  deleteRun(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除', content: '确定删除这条记录？',
      success: res => {
        if (res.confirm) {
          S.saveChainRuns(this.data.activeUser, S.getChainRuns(this.data.activeUser).filter(r => r.id !== id))
          this.loadData()
          this.showToast('已删除')
        }
      }
    })
  },

  exportData() {
    const data = {
      time: new Date().toISOString(),
      user: this.data.currentUserName,
      type: 'chain',
      cfg: this.data.cfg,
      hist: S.getChainRuns(this.data.activeUser),
      prices: this.data.prices,
      cur: this._cur
    }
    wx.setClipboardData({
      data: JSON.stringify(data, null, 2),
      success: () => this.showToast('已复制到剪贴板')
    })
  },

  importData() {
    wx.showModal({
      title: '导入数据',
      content: '请将JSON数据粘贴到剪贴板，然后点确定读取',
      success: res => {
        if (res.confirm) {
          wx.getClipboardData({
            success: res2 => {
              try {
                const d = JSON.parse(res2.data)
                const raw = d.hist || d.history
                const imported = Array.isArray(raw)
                  ? raw.filter(r => r && typeof r === 'object').slice(0, 500)
                  : []
                if (imported.length) {
                  wx.showModal({
                    title: '确认导入',
                    content: `导入${imported.length}条记录？`,
                    success: res3 => {
                      if (res3.confirm) {
                        S.saveChainRuns(this.data.activeUser, [...imported, ...S.getChainRuns(this.data.activeUser)])
                        this.loadData()
                        this.showToast(`已导入${imported.length}条`)
                      }
                    }
                  })
                } else this.showToast('没有可导入的记录')
              } catch (e) { this.showToast('解析失败') }
            }
          })
        }
      }
    })
  },

  // ===== Data builders =====
  ringCost(ring, prices) {
    return RING_COST.ringCost(ring, prices || this._prices, C.C_DEFAULT_PRICES)
  },

  buildRecordData(cur, prices) {
    const data = {
      completed: 0, remaining: 300, costWan: '0', completedPct: 0,
      nextRing: 0, ringList: [], gridCells: [],
      seg1Done: false, seg2Done: false, seg3Done: false, curSeg: 1
    }
    if (!cur) return data
    const comp = cur.rings.filter(r => r.t).length
    const cost = RING_COST.totalCost(cur.rings, prices, C.C_DEFAULT_PRICES)
    const nr = cur.rings.findIndex(r => !r.t) + 1
    const s1 = this.segDone(100), s2 = this.segDone(200), s3 = this.segDone(300)
    let curSeg = 1
    if (s1 && s2) curSeg = 3
    else if (s1) curSeg = 2

    const ringList = cur.rings.map((r, i) => {
      let cls = 'dot'
      if (r.t) {
        cls += ' done'
        if ((i + 1) % 100 === 0) cls += ' ck'
      }
      return { cls }
    })

    const gridCells = cur.rings.map((r, i) => {
      let cls = 'cell'
      if (r.t) cls += ' ' + C.cellClassChain(r.t)
      return { rn: i + 1, cls }
    })

    return {
      completed: comp, remaining: 300 - comp,
      costWan: (cost / 10000).toFixed(0),
      completedPct: Math.floor(comp / 3),
      nextRing: nr, ringList, gridCells,
      seg1Done: s1, seg2Done: s2, seg3Done: s3, curSeg
    }
  },

  buildRewardData(cur, cfg) {
    const lv = cur ? cur.level : cfg.level
    const r = C.cRewardRange(lv)
    const lvls = C.cBookLevels(lv)
    let ruleStr = ''
    if (lv >= 156) ruleStr = '130~140书铁随机，300环几率150书铁/战魄'
    else if (lv >= 140) ruleStr = '130~140书铁（100书/200铁/300随机）'
    else ruleStr = `${r.min}~${r.max}书铁（100书/200铁/300随机）`
    if (r.hasLingshi) ruleStr += '，几率灵饰书/元灵晶石(120/140)'

    const segRewards = [
      { seg: 100, desc: '制造指南书', done: cur ? this.segDone(100) : false, rewards: cur && cur.rewards[100] ? cur.rewards[100].join(', ') : '' },
      { seg: 200, desc: '百炼精铁', done: cur ? this.segDone(200) : false, rewards: cur && cur.rewards[200] ? cur.rewards[200].join(', ') : '' },
      { seg: 300, desc: '书/铁随机', done: cur ? this.segDone(300) : false, rewards: cur && cur.rewards[300] ? cur.rewards[300].join(', ') : '' }
    ]

    const rows = lvls.map(l => ({
      lv: l, label: l + '级', cls: l === r.max ? 'hl' : '',
      s100: l >= r.min && l <= r.max ? '可能' : '—',
      s200: l >= r.min && l <= r.max ? '可能' : '—',
      s300: '可能'
    }))
    if (r.has150) rows.unshift({ lv: 160, label: '160战魄', cls: 'hl', s100: '—', s200: '—', s300: 'lv≥156极高分可能' })

    return {
      rewardLv: lv, rewardRuleStr: ruleStr,
      rewardRuleShort: lv >= 156 ? '130~140随机，300环概率150/战魄' : `${r.min}~${r.max}随机`,
      segRewards, rewardRows: rows
    }
  },

  buildHistoryData(runs) {
    return runs.map(r => {
      const comp = r.rings ? r.rings.filter(x => x.t).length : 0
      const costWan = (r.totalCost || 0) / 10000
      let rewardStr = ''
      if (r.rewards) {
        rewardStr = `100:${(r.rewards[100]||['-']).join(',')} 200:${(r.rewards[200]||['-']).join(',')} 300:${(r.rewards[300]||['-']).join(',')}`
      }
      return {
        id: r.id, _raw: r, done: r.done, level: r.level, comp, costWan: costWan.toFixed(0),
        startedStr: C.fmtDate(r.startedAt),
        doneStr: r.doneAt ? '→' + C.fmtDate(r.doneAt) : '',
        rewardStr,
        booked: LEDGER.isBooked(r),
        incomeWan: LEDGER.isBooked(r) ? LEDGER.formatWan(r.income) : '—',
        profitWan: LEDGER.isBooked(r) ? LEDGER.formatWan(r.profit) : '—',
        profitPos: LEDGER.isBooked(r) ? Number(r.profit) >= 0 : true,
        roiStr: LEDGER.isBooked(r) && r.roi != null ? '1 : ' + Number(r.roi).toFixed(2) : '—'
      }
    })
  },

  buildStatsData(runs) {
    if (!runs.length) return { stats: {}, typeDist: [] }
    const costs = runs.map(r => r.totalCost || 0).filter(c => c > 0)
    const avgCost = costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length / 10000).toFixed(0) : 0
    const totalAll = costs.reduce((a, b) => a + b, 0)
    const avgComp = (runs.reduce((s, r) => s + (r.rings ? r.rings.filter(x => x.t).length : 0), 0) / runs.length).toFixed(0)
    const tDist = {}
    C.CHAIN_TYPES.forEach(t => { tDist[t.name] = 0 })
    runs.forEach(r => {
      if (r.rings) r.rings.forEach(x => {
        if (x.t) { const n = C.cGetT(x.t) ? C.cGetT(x.t).name : x.t; tDist[n] = (tDist[n] || 0) + 1 }
      })
    })
    const total = Object.values(tDist).reduce((a, b) => a + b, 0)
    const typeDist = Object.entries(tDist).filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, pct: total ? (count / total * 100).toFixed(0) : 0 }))

    return {
      stats: { total: runs.length, avgComp, avgCostWan: avgCost, totalCostWan: (totalAll / 10000).toFixed(0) },
      typeDist
    }
  },

  // ===== Record helpers (v1.2) =====
  pushUndo(label) {
    if (!this._cur || !this._undo) return
    this._undo.push({ label, cur: JSON.parse(JSON.stringify(this._cur)) })
    this.setData({ undoCount: this._undo.size })
  },

  undoLast() {
    if (!this._undo || !this._undo.size) { this.showToast('没有可撤销的操作'); return }
    const snapshot = this._undo.pop()
    if (!snapshot || !snapshot.cur) { this.setData({ undoCount: this._undo.size }); return }
    this._cur = snapshot.cur
    S.saveChainCur(this.data.activeUser, this._cur)
    UI.vibrate()
    this.loadData()
    this.showToast('已撤销：' + snapshot.label)
  },

  toggleVibrate() {
    const on = !this.data.vibrateOn
    UI.setVibrate(on)
    this.setData({ vibrateOn: on })
    if (on) UI.vibrate()
  },

  toggleAllTasks() {
    this.setData({ showAllTasks: !this.data.showAllTasks })
    this.loadData()
  },

  batchToNextTen() {
    const firstEmpty = this._cur ? this._cur.rings.findIndex(r => !r.t) + 1 : 1
    const start = firstEmpty || 1
    const end = Math.min(Math.max(1, Math.ceil(start / 10) * 10), 300)
    this.setData({ batchStart: start, batchEnd: end, batchCount: end - start + 1 })
  },

  batchToSegEnd() {
    const firstEmpty = this._cur ? this._cur.rings.findIndex(r => !r.t) + 1 : 1
    const start = firstEmpty || 1
    const end = start <= 100 ? 100 : (start <= 200 ? 200 : 300)
    this.setData({ batchStart: start, batchEnd: end, batchCount: end - start + 1 })
  },

  // ===== Toast =====
  showToast(msg) {
    this.setData({ toastMsg: msg })
    setTimeout(() => this.setData({ toastMsg: '' }), 2000)
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '人环助手 · 300环任务链记录与奖励结算 | 梦幻搞钱工具箱',
      path: '/pages/chain/chain'
    }
  },

  onShareTimeline() {
    return {
      title: '人环助手 — 300环三段奖励结算 · 等级预测书铁区间'
    }
  }
})
