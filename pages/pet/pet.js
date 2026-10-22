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
    petTypes: C.PET_TYPES, quickTasks: C.PET_TYPES, showAllTasks: false,
    itemChips: [], modalTask: '', qbItem: '', jumpRing: '', undoCount: 0, vibrateOn: true,
    score: 0, minScore: 0, maxScore: 0, completed: 0, bookLevel: 80,
    expVal: 0, costWan: '0', skipCount: 0, tier: C.REWARD_TIERS[0],
    nextRing: 0, ringList: [], gridCells: [], remaining: 0,
    // Predict
    predictLv: 175, offset: 0, predictRows: [],
    // Control
    controlRows: [], controlNeedPerRing: '-',
    // History
    history: [],
    showRunDetail: false, runDetailRun: null,
    // Stats
    stats: {}, tierDist: [],
    // Guide
    showGuide: false, guideStep: 0,
    guideSteps: [
      { icon: '👤', title: '创建角色', desc: '点击标题栏角色名切换或创建角色，不同角色数据完全隔离', pos: '📍 位置：标题栏左侧，角色名显示区域' },
      { icon: '⚙️', title: '设置等级', desc: '输入你的角色等级（65~175），影响书铁奖励预测和控分计算', pos: '📍 位置：标题栏 Lv. 输入框' },
      { icon: '💰', title: '设置物品价格', desc: '修改60环装/80环装/变异等物品价格，用于准确计算每轮费用', pos: '👉 操作：标题栏 ⋯ → 💰 物品价格设置' },
      { icon: '▶️', title: '开始跑环', desc: '开始新一轮100环宠环记录，每个角色独立存储数据', pos: '👉 操作：标题栏 "+新" 按钮（绿色）' },
      { icon: '📝', title: '记录每环任务', desc: '选择快速栏中的任务类型，点击"记录"录入当前环', pos: '📍 位置：页面中部快速栏区域，任务类型按钮 → "记录 #N" 按钮' },
      { icon: '📦', title: '批量填充', desc: '选择范围一键填入相同任务类型，大幅提升记录效率', pos: '👉 操作：网格标题行 → "批量填充" 按钮' },
      { icon: '🏆', title: '结算奖励', desc: '全部100环完成后点击"结算"，记录实际获得的书铁等级和额外奖励', pos: '👉 操作：标题栏 "结算" 按钮（跑环进行中时显示）' },
      { icon: '📊', title: '查看历史和统计', desc: '查看多轮跑环的得分趋势、奖励档位分布和费用统计', pos: '📍 位置：顶部标签栏 → "历史" / "统计" 标签页' }
    ],
    // Modals
    showMoreMenu: false,
    showEditModal: false, editRing: 0, editSelTid: '', editItem: '', editHasCur: false, editCostWan: '0',
    showBatchModal: false, batchStart: 1, batchEnd: 10, batchCount: 10, batchSelTid: 'find_npc',
    showPricesModal: false, prices: {},
    showUserModal: false, newUserName: '',
    showSettleModal: false,
    settleScore: 0, settleBookLv: 80, settleHasBonus: false,
    settleCats: ['制造指南书', '百炼精铁', '战魄'], settleCatIdx: 0,
    settleLvs: ['150', '140', '130', '120', '110', '100', '90', '80'], settleLvIdx: 0,
    settleSubTypes: ['刀','剑','扇','枪','锤','斧','鞭','环圈','双剑','爪刺','弓','弩','头盔','项链','衣服','鞋子','腰带'], settleTypeIdx: 0,
    settleMainReward: '', settleExtras: [], settleCustom: '',
    settleMainValue: '', settleMainItem: null, settleExtraRows: [],
    settleCustomValue: '', settleOtherCost: '',
    settleIncomeWan: '0', settleCostWan: '0', settleProfitWan: '0',
    settleRoiStr: '—', settleProfitPos: true, settleHourlyStr: '—',
    bonusOpts: [],
    // Toast
    toastMsg: '', toastAnim: null,
    // Running
    _cur: null, _settleRun: null
  },

  onLoad() {
    this._undo = new UNDO.UndoStack(10)
  },

  onShow() {
    const pending = NAV.takePending()
    this.loadData()
    this.setData({ vibrateOn: UI.isVibrateOn() })
    TABBAR.syncTabBar(this, 1)
    if (pending && pending.indexOf('pet:') === 0) {
      const action = pending.slice(4)
      setTimeout(() => {
        if (action === 'prices') this.showPricesSheet()
        else if (action === 'batch') this.showBatch()
        else if (['record', 'predict', 'control', 'history', 'stats'].indexOf(action) >= 0) {
          this.setData({ tab: action })
          this.loadData()
        }
      }, 220)
      return
    }
    // First-use guide check
    const uid = this.data.activeUser
    if (uid && !wx.getStorageSync('mhxy_guide_seen_pet_' + uid)) {
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
    S.savePetCur(this.data.activeUser, this._cur)
    UI.vibrate()
    this.loadData()
  },

  onReady() {
    if (this.data.tab === 'stats' && this.data.history.length) this.drawChart()
  },

  loadData() {
    const users = S.getUsers()
    const activeUser = S.getActiveUser()
    if (!activeUser) return

    const cfg = S.getPetCfg(activeUser)
    const cur = S.getPetCur(activeUser)
    const prices = S.getPetPrices(activeUser)
    const runs = S.getPetRuns(activeUser)

    this._cur = cur
    this._prices = prices
    const hasCur = !!cur
    const userIdx = users.findIndex(u => u.id === activeUser)

    // 快速栏：常用任务置顶（前 8 个），可展开全部
    const usage = TASK_USAGE.getUsage(activeUser, 'pet')
    const orderedTasks = TASK_USAGE.sortTasks(C.PET_TYPES, usage)
    const quickTasks = this.data.showAllTasks ? orderedTasks : orderedTasks.slice(0, 8)
    const itemChips = ITEM_MEMORY.getAll(activeUser)

    let recordData = this.buildRecordData(cur, prices)
    let predictData = this.buildPredictData(cur, cfg)
    let controlData = this.buildControlData(cur, cfg)
    let historyData = this.buildHistoryData(runs)
    let statsData = this.buildStatsData(runs)

    this.setData({
      users: users.map(u => ({ ...u, createdStr: C.fmtDate(u.createdAt) })),
      activeUser, userIdx: Math.max(0, userIdx),
      userNames: users.map(u => u.name),
      currentUserName: users[userIdx] ? users[userIdx].name : '',
      cfg, hasCur, prices: { ...prices },
      isPaused: !!(cur && cur.pausedAt),
      moneyCfg: MONEY.getMoneyCfg(),
      reduceMotion: MOTION.getReduceMotion(),
      quickTasks, itemChips, undoCount: this._undo ? this._undo.size : 0,
      ...recordData, ...predictData, ...controlData,
      history: historyData, ...statsData
    })
  },

  // ===== Tab =====
  switchTab(e) {
    const t = e.currentTarget.dataset.t
    this.setData({ tab: t, showMoreMenu: false, showEditModal: false, showBatchModal: false, showPricesModal: false, showUserModal: false, showSettleModal: false })
    if (t === 'stats') setTimeout(() => this.drawChart(), 300)
  },

  // ===== More menu =====
  toggleMoreMenu() { this.setData({ showMoreMenu: !this.data.showMoreMenu }) },
  closeMoreMenu() { this.setData({ showMoreMenu: false }) },
  showUserSheet() { this.setData({ showMoreMenu: false, showUserModal: true }) },
  showPricesSheet() { this.setData({ showMoreMenu: false, showPricesModal: true }) },
  showGuideSheet() { this.setData({ showMoreMenu: false, showGuide: true, guideStep: 0 }) },
  abandonFromMenu() {
    this.setData({ showMoreMenu: false })
    this.abandon()
  },

  // ===== Guide =====
  closeGuide() {
    this.setData({ showGuide: false, guideStep: 0 })
    const uid = this.data.activeUser
    if (uid) wx.setStorageSync('mhxy_guide_seen_pet_' + uid, true)
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
    if (u && u.id !== this.data.activeUser) {
      this.switchUserById(u.id)
    }
  },

  showUserModal() { this.setData({ showUserModal: true }) },
  closeUserModal() { this.setData({ showUserModal: false }) },

  switchUser(e) {
    this.switchUserById(e.currentTarget.dataset.uid)
    this.setData({ showUserModal: false })
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
      content: '该角色的所有跑环数据将被永久删除。',
      success: res => {
        if (res.confirm) {
          S.clearRoleData(uid)
          const newUsers = users.filter(u => u.id !== uid)
          S.saveUsers(newUsers)
          if (this.data.activeUser === uid) {
            S.saveActiveUser(newUsers[0].id)
            app.globalData.activeUser = newUsers[0].id
          }
          if (this._undo) this._undo.clear()
          this.loadData()
          this.setData({ showUserModal: false })
          this.showToast('已删除')
        }
      }
    })
  },

  createUser() {
    const name = this.data.newUserName.trim()
    if (!name) { this.showToast('请输入角色名称'); return }
    const nu = { id: 'user_' + Date.now(), name, createdAt: Date.now() }
    const users = [...this.data.users, nu]
    S.saveUsers(users)
    S.saveActiveUser(nu.id)
    app.globalData.activeUser = nu.id
    if (this._undo) this._undo.clear()
    this.setData({ showUserModal: false, newUserName: '' })
    this.loadData()
    this.showToast('已创建角色')
  },

  onNewUserName(e) { this.setData({ newUserName: e.detail.value }) },

  // ===== Level =====
  onLevelChange(e) {
    let lv = parseInt(e.detail.value) || 175
    lv = Math.max(65, Math.min(175, lv))
    const cfg = { ...this.data.cfg, level: lv }
    S.savePetCfg(this.data.activeUser, cfg)
    if (this._cur) { this._cur.level = lv; S.savePetCur(this.data.activeUser, this._cur) }
    this.loadData()
  },

  // ===== Run operations =====
  startNew() {
    const cur = this._cur
    if (cur) {
      const comp = cur.rings.filter(r => r.t).length
      if (comp > 0 && comp < 100) {
        wx.showModal({
          title: '确认',
          content: `宠环未完成（${comp}/100），放弃并新建？`,
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
      rings: Array.from({ length: 100 }, () => ({ t: null, sc: 0, item: '' })),
      notes: '', done: false, doneAt: null, reward: null
    }
    this._cur = cur
    S.savePetCur(this.data.activeUser, cur)
    this.loadData()
    this.showToast('新宠环已开始！')
  },

  abandon() {
    wx.showModal({
      title: '确认放弃',
      content: '放弃当前宠环？',
      success: res => {
        if (res.confirm) {
          this._cur = null
          if (this._undo) this._undo.clear()
          S.savePetCur(this.data.activeUser, null)
          this.loadData()
          this.showToast('已放弃')
        }
      }
    })
  },

  complete() {
    if (!this._cur) return
    const cur = this._cur
    const sc = this.data.score
    const comp = this.data.completed
    if (comp < 100) {
      wx.showModal({
        title: '确认',
        content: `仅完成${comp}/100环，确认结束？`,
        success: res => { if (res.confirm) this.doComplete(cur, sc) }
      })
    } else {
      wx.showModal({
        title: '🎉 宠环100环全部完成',
        content: '是否结算？',
        success: res => { if (res.confirm) this.doComplete(cur, sc) }
      })
    }
  },

  doComplete(cur, sc) {
    cur.done = true
    cur.doneAt = Date.now()
    cur.totalScore = sc
    cur.totalExp = C.pExp(cur.rings)
    cur.totalCost = RING_COST.totalCost(cur.rings, this._prices, C.P_DEFAULT_PRICES)
    cur.rewardTier = C.pGetTier(sc, cur.level)
    cur.bookLevel = C.pBookLevel(sc, cur.level)
    this.showSettle(cur)
  },

  // ===== Ring editing =====
  setRing(rn, tid, item) {
    if (!this._cur) return
    const t = C.pGetT(tid)
    this._cur.rings[rn - 1] = { t: tid, sc: t ? t.sc : 0, item: item || '' }
    S.savePetCur(this.data.activeUser, this._cur)
  },

  selectTask(e) {
    const tid = e.currentTarget.dataset.tid
    this.setData({ modalTask: this.data.modalTask === tid ? '' : tid })
  },

  onQbItemInput(e) {
    this.setData({ qbItem: e.detail.value })
  },

  quickRecord() {
    if (!this._cur) return
    const tid = this.data.modalTask
    if (!tid) { this.showToast('请先选择任务类型'); return }
    const nr = this._cur.rings.findIndex(r => !r.t) + 1
    if (!nr) { this.showToast('已全部记录'); return }
    this.pushUndo('记录第' + nr + '环')
    this.setRing(nr, tid, this.data.qbItem)
    TASK_USAGE.bump(this.data.activeUser, 'pet', tid)
    if (this.data.qbItem) ITEM_MEMORY.add(this.data.activeUser, this.data.qbItem)
    // 保留任务类型方便连续记录同类型，只清空物品名
    this.setData({ qbItem: '' })
    UI.vibrate()
    this.loadData()
    this.checkComplete()
  },

  quickSkip() {
    if (!this._cur) return
    const nr = this._cur.rings.findIndex(r => !r.t) + 1
    if (!nr) { this.showToast('已全部记录'); return }
    wx.showModal({
      title: '确认跳过',
      content: `跳过第${nr}环？（扣20分）`,
      success: res => {
        if (res.confirm) {
          this.pushUndo('跳过第' + nr + '环')
          this.setRing(nr, 'skip', '')
          TASK_USAGE.bump(this.data.activeUser, 'pet', 'skip')
          UI.vibrate()
          this.loadData()
          this.checkComplete()
        }
      }
    })
  },

  editCell(e) {
    this.openEdit(parseInt(e.currentTarget.dataset.ring))
  },

  openEdit(rn) {
    if (!this._cur || !rn || rn < 1 || rn > 100) return
    const ring = this._cur.rings[rn - 1] || { t: null, sc: 0, item: '' }
    const hasCur = !!ring.t
    const cost = this.ringCost(ring)
    this.setData({
      showEditModal: true, editRing: rn,
      editSelTid: ring.t || '', editItem: ring.item || '',
      editHasCur: hasCur,
      editCostWan: (cost / 10000).toFixed(0)
    })
  },

  onJumpInput(e) { this.setData({ jumpRing: e.detail.value }) },

  jumpRingTo() {
    const rn = parseInt(this.data.jumpRing)
    if (!rn || rn < 1 || rn > 100) { this.showToast('请输入 1-100 的环号'); return }
    this.setData({ jumpRing: '' })
    this.openEdit(rn)
  },

  pickItem(e) { this.setData({ qbItem: e.currentTarget.dataset.item }) },

  closeEditModal() { this.setData({ showEditModal: false }) },

  pickEditType(e) {
    this.setData({ editSelTid: e.currentTarget.dataset.tid })
  },

  onEditItemInput(e) {
    this.setData({ editItem: e.detail.value })
  },

  saveEdit() {
    const tid = this.data.editSelTid
    if (!tid) { this.showToast('请选择任务类型'); return }
    this.pushUndo('编辑第' + this.data.editRing + '环')
    this.setRing(this.data.editRing, tid, this.data.editItem)
    TASK_USAGE.bump(this.data.activeUser, 'pet', tid)
    if (this.data.editItem) ITEM_MEMORY.add(this.data.activeUser, this.data.editItem)
    UI.vibrate()
    this.setData({ showEditModal: false })
    this.loadData()
    this.checkComplete()
  },

  clearEdit() {
    if (!this._cur) return
    this.pushUndo('清除第' + this.data.editRing + '环')
    this._cur.rings[this.data.editRing - 1] = { t: null, sc: 0, item: '' }
    S.savePetCur(this.data.activeUser, this._cur)
    this.setData({ showEditModal: false })
    this.loadData()
  },

  checkComplete() {
    const cur = this._cur
    if (!cur || cur.done) return
    if (cur.rings.every(r => r.t)) {
      this._checkTimer = setTimeout(() => {
        if (this._cur !== cur) return
        wx.showModal({
          title: '🎉 宠物环100环全部完成',
          content: '是否结算？',
          success: res => {
            if (res.confirm && this._cur === cur) {
              const sc = cur.rings.reduce((s, r) => s + (r.sc || 0), 0)
              this.doComplete(cur, sc)
            }
          }
        })
      }, 300)
    }
  },

  clearAll() {
    if (!this._cur) return
    wx.showModal({
      title: '确认清除',
      content: '清除所有记录？',
      success: res => {
        if (res.confirm) {
          this.pushUndo('清除全部记录')
          this._cur.rings = Array.from({ length: 100 }, () => ({ t: null, sc: 0, item: '' }))
          S.savePetCur(this.data.activeUser, this._cur)
          this.loadData()
          this.showToast('已清除')
        }
      }
    })
  },

  // ===== Batch =====
  showBatch() {
    const firstEmpty = this._cur ? this._cur.rings.findIndex(r => !r.t) + 1 : 1
    const end = Math.min(firstEmpty + 9, 100)
    this.setData({
      showBatchModal: true,
      batchStart: firstEmpty || 1,
      batchEnd: end,
      batchCount: end - (firstEmpty || 1) + 1,
      batchSelTid: this.data.modalTask || 'find_npc'
    })
  },

  closeBatchModal() { this.setData({ showBatchModal: false }) },

  onBatchStartInput(e) {
    const v = parseInt(e.detail.value) || 1
    this.setData({ batchStart: Math.max(1, Math.min(100, v)), batchCount: Math.max(0, this.data.batchEnd - Math.max(1, Math.min(100, v)) + 1) })
  },

  onBatchEndInput(e) {
    const v = parseInt(e.detail.value) || 1
    this.setData({ batchEnd: Math.max(1, Math.min(100, v)), batchCount: Math.max(0, Math.max(1, Math.min(100, v)) - this.data.batchStart + 1) })
  },

  quickBatchRange(e) {
    const s = parseInt(e.currentTarget.dataset.s)
    const e2 = parseInt(e.currentTarget.dataset.e)
    this.setData({ batchStart: s, batchEnd: e2, batchCount: e2 - s + 1 })
  },

  pickBatchType(e) {
    this.setData({ batchSelTid: e.currentTarget.dataset.tid })
  },

  confirmBatch() {
    if (!this._cur) return
    const { batchStart, batchEnd, batchSelTid } = this.data
    const t = C.pGetT(batchSelTid)
    this.pushUndo('批量填充 ' + batchStart + '-' + batchEnd)
    for (let i = batchStart; i <= batchEnd; i++) {
      if (!this._cur.rings[i - 1].t) {
        this._cur.rings[i - 1] = { t: batchSelTid, sc: t ? t.sc : 0, item: '' }
      }
    }
    S.savePetCur(this.data.activeUser, this._cur)
    TASK_USAGE.bump(this.data.activeUser, 'pet', batchSelTid)
    UI.vibrate()
    this.setData({ showBatchModal: false })
    this.loadData()
    this.showToast(`已填充${batchStart}-${batchEnd}环`)
    this.checkComplete()
  },

  // ===== Prices =====
  showPrices() { this.setData({ showPricesModal: true }) },
  closePricesModal() {
    // 取消编辑：恢复已保存价格，避免未保存的价格参与费用计算
    this.setData({
      showPricesModal: false,
      prices: { ...S.getPetPrices(this.data.activeUser) }
    })
  },

  onPriceChange(e) {
    const tid = e.currentTarget.dataset.tid
    const val = parseInt(e.detail.value) || 0
    const prices = { ...this.data.prices, [tid]: val }
    this.setData({ prices })
  },

  savePrices() {
    const prices = { ...this.data.prices }
    S.savePetPrices(this.data.activeUser, prices)
    this._prices = prices
    this.setData({ showPricesModal: false })
    this.loadData()
    this.showToast('价格已保存')
  },

  resetPrices() {
    wx.showModal({
      title: '确认',
      content: '恢复默认价格？',
      success: res => {
        if (res.confirm) {
          S.savePetPrices(this.data.activeUser, { ...C.P_DEFAULT_PRICES })
          this._prices = { ...C.P_DEFAULT_PRICES }
          this.setData({ showPricesModal: false, prices: { ...C.P_DEFAULT_PRICES } })
          this.loadData()
          this.showToast('已恢复默认价格')
        }
      }
    })
  },

  // ===== Settlement modal =====
  showSettle(run) {
    const bl = run.bookLevel || C.pBookLevel(run.totalScore || 0, run.level || 175)
    const sc = run.totalScore || 0
    const pLvOpts = C.BOOK_LVLS.filter(l => l <= bl)
    const bonusLabels = ['修炼果', '200修炼点', '3级家具设计图']
    this._rewardPrices = REWARD_PRICES.getRewardPrices(this.data.activeUser)
    this.setData({
      showSettleModal: true,
      settleScore: sc, settleBookLv: bl,
      settleHasBonus: sc >= 170,
      settleLvs: pLvOpts.map(String),
      settleCatIdx: 0, settleLvIdx: 0, settleTypeIdx: 0,
      settleMainReward: '', settleExtras: [], settleCustom: '',
      settleMainValue: '', settleMainItem: null, settleExtraRows: [],
      settleCustomValue: '', settleOtherCost: '',
      settleIncomeWan: '0', settleCostWan: ((run.totalCost || 0) / 10000).toFixed(1),
      settleProfitWan: '0', settleRoiStr: '—', settleProfitPos: true,
      bonusOpts: bonusLabels.map(l => ({ label: l, checked: false }))
    })
    this._settleRun = run
    this.computeSettlePreview()
    this.setTabBarHidden(true)
  },

  closeSettleModal() {
    // 取消结算：回滚内存中的完成状态，避免运行中的记录被标记为已完成
    const run = this._settleRun
    if (run) {
      run.done = false
      run.doneAt = null
      delete run.totalScore
      delete run.totalExp
      delete run.totalCost
      delete run.rewardTier
      delete run.bookLevel
      S.savePetCur(this.data.activeUser, run)
      this._settleRun = null
      this.loadData()
    }
    this.setData({ showSettleModal: false })
    this.setTabBarHidden(false)
  },

  onSettleCatChange(e) { this.setData({ settleCatIdx: parseInt(e.detail.value), settleLvIdx: 0, settleTypeIdx: 0, settleMainReward: '' }) },
  onSettleLvChange(e) { this.setData({ settleLvIdx: parseInt(e.detail.value), settleMainReward: '' }) },
  onSettleTypeChange(e) { this.setData({ settleTypeIdx: parseInt(e.detail.value), settleMainReward: '' }) },

  addSettleMain() {
    const { settleCats, settleCatIdx, settleLvs, settleLvIdx, settleSubTypes, settleTypeIdx } = this.data
    const cat = settleCats[settleCatIdx]
    if (!cat) { this.showToast('请选择类别'); return }
    let item = null
    if (cat === '战魄') {
      item = { kind: 'zhanpo', name: '160级战魄' }
    } else {
      const lv = settleLvs[settleLvIdx]
      if (!lv) { this.showToast('请选择等级'); return }
      if (cat === '制造指南书') {
        const tp = settleSubTypes[settleTypeIdx]
        if (!tp) { this.showToast('请选择类型'); return }
        item = { kind: 'book', level: Number(lv), subType: tp, name: lv + '级' + cat + '-' + tp }
      } else {
        item = { kind: 'iron', level: Number(lv), name: lv + '级' + cat }
      }
    }
    const unit = REWARD_PRICES.rewardUnitPrice(this._rewardPrices, item)
    this.setData({
      settleMainReward: item.name,
      settleMainItem: item,
      settleMainValue: (unit / 10000).toFixed(1)
    })
    this.computeSettlePreview()
  },

  clearSettleMain() {
    this.setData({ settleMainReward: '', settleMainItem: null, settleMainValue: '' })
    this.computeSettlePreview()
  },

  settleExtraKind(label) {
    if (label === '修炼果') return 'xiulian_guo'
    if (label === '200修炼点') return 'xiulian_200'
    if (label === '3级家具设计图') return 'furniture3'
    return 'other'
  },

  computeSettlePreview() {
    const main = parseFloat(this.data.settleMainValue) || 0
    const extras = (this.data.settleExtraRows || []).reduce((s, r) => s + (parseFloat(r.valueWan) || 0), 0)
    const custom = parseFloat(this.data.settleCustomValue) || 0
    const other = parseFloat(this.data.settleOtherCost) || 0
    const run = this._settleRun
    const incomeWan = main + extras + custom
    const costWan = ((run && run.totalCost) || 0) / 10000 + other
    const profitWan = incomeWan - costWan
    const roiStr = costWan > 0 ? '1 : ' + (incomeWan / costWan).toFixed(2) : '—'
    const durationMin = run
      ? LEDGER.effectiveDurationMin({
        startedAt: run.startedAt,
        doneAt: Date.now(),
        pausedMs: run.pausedMs,
        pausedAt: run.pausedAt
      }, Date.now())
      : null
    const hourlyLiang = durationMin !== null && durationMin >= 5
      ? (profitWan * 10000) / (durationMin / 60)
      : null
    const cfg = this.data.moneyCfg || MONEY.getMoneyCfg()
    const hourlyStr = hourlyLiang === null
      ? '—'
      : (hourlyLiang / 10000).toFixed(1) + ' 万两/时 ≈ ' + MONEY.wanToYuan(hourlyLiang / 10000, cfg).toFixed(1) + ' 元/时'
    this.setData({
      settleIncomeWan: incomeWan.toFixed(1),
      settleCostWan: costWan.toFixed(1),
      settleProfitWan: profitWan.toFixed(1),
      settleRoiStr: roiStr,
      settleProfitPos: profitWan >= 0,
      settleHourlyStr: hourlyStr
    })
  },

  onSettleMainValueInput(e) { this.setData({ settleMainValue: e.detail.value }); this.computeSettlePreview() },
  onSettleCustomValue(e) { this.setData({ settleCustomValue: e.detail.value }); this.computeSettlePreview() },
  onSettleOtherCost(e) { this.setData({ settleOtherCost: e.detail.value }); this.computeSettlePreview() },

  onSettleExtraValueInput(e) {
    const idx = parseInt(e.currentTarget.dataset.idx)
    const rows = this.data.settleExtraRows.map((r, i) => i === idx ? Object.assign({}, r, { valueWan: e.detail.value }) : r)
    this.setData({ settleExtraRows: rows })
    this.computeSettlePreview()
  },

  toggleSettleExtra(_e) {
    // handled by onSettleExtrasChange instead
  },

  onSettleExtrasChange(e) {
    const selected = e.detail.value || []
    const bonusOpts = this.data.bonusOpts.map(b => ({ label: b.label, checked: selected.indexOf(b.label) >= 0 }))
    const rows = selected.map(label => {
      const kind = this.settleExtraKind(label)
      const unit = REWARD_PRICES.rewardUnitPrice(this._rewardPrices, { kind, name: label })
      return { label, kind, name: label, valueWan: (unit / 10000).toFixed(1) }
    })
    this.setData({ settleExtras: selected, settleExtraRows: rows, bonusOpts })
    this.computeSettlePreview()
  },

  onSettleCustom(e) { this.setData({ settleCustom: e.detail.value }) },

  confirmSettle() {
    const run = this._settleRun
    if (!run) return
    const data = this.data
    const incomeItems = []
    const rewardTexts = []
    if (data.settleMainReward) {
      const item = (data.settleMainItem && data.settleMainItem.kind)
        ? { ...data.settleMainItem }
        : LEDGER.parseRewardText(data.settleMainReward)
      if (item) {
        item.qty = 1
        item.unitPrice = Math.max(0, (parseFloat(data.settleMainValue) || 0) * 10000)
        incomeItems.push(item)
        rewardTexts.push(data.settleMainReward)
      }
    }
    const extraRows = data.settleExtraRows || []
    extraRows.forEach(row => {
      incomeItems.push({
        kind: row.kind,
        name: row.label,
        qty: 1,
        unitPrice: Math.max(0, (parseFloat(row.valueWan) || 0) * 10000)
      })
      rewardTexts.push(row.label)
    })
    const customName = (data.settleCustom || '').trim()
    if (customName) {
      incomeItems.push({
        kind: 'other',
        name: customName,
        qty: 1,
        unitPrice: Math.max(0, (parseFloat(data.settleCustomValue) || 0) * 10000)
      })
      rewardTexts.push(customName)
    }
    run.reward = rewardTexts.length > 0 ? rewardTexts : ['未记录']

    const doneAt = run.doneAt || Date.now()
    run.doneAt = doneAt
    const summary = LEDGER.summarizeRun({
      rings: run.rings,
      prices: this._prices,
      defaults: C.P_DEFAULT_PRICES,
      incomeItems,
      extraCost: Math.max(0, (parseFloat(data.settleOtherCost) || 0) * 10000),
      startedAt: run.startedAt,
      doneAt,
      pausedMs: run.pausedMs,
      pausedAt: run.pausedAt
    })
    run.ledgerVersion = 1
    run.costItems = summary.costItems
    run.extraCost = summary.extraCost
    run.cost = summary.cost
    if (incomeItems.length === 0) {
      run.unbooked = true
      delete run.incomeItems
      delete run.income
      delete run.profit
      delete run.roi
      delete run.netRate
      delete run.hourly
      delete run.durationMin
    } else {
      run.unbooked = false
      run.incomeItems = summary.incomeItems
      run.income = summary.income
      run.profit = summary.profit
      run.roi = summary.roi
      run.netRate = summary.netRate
      run.durationMin = summary.durationMin
      run.hourly = summary.hourly
    }

    const runs = S.getPetRuns(this.data.activeUser)
    runs.unshift({ ...run })
    S.savePetRuns(this.data.activeUser, runs)
    S.savePetCur(this.data.activeUser, null)
    this._cur = null
    this._settleRun = null
    if (this._undo) this._undo.clear()
    this.setData({ showSettleModal: false })
    this.setTabBarHidden(false)
    this.loadData()
    const suffix = run.unbooked
      ? '（未记账，可到历史补录收益）'
      : '|收入:' + LEDGER.formatWan(run.income) + '万|净收益:' + LEDGER.formatWan(run.profit) + '万'
    this.showToast('结算完成！总分:' + run.totalScore + '|费用:' + (run.totalCost / 10000).toFixed(0) + '万' + suffix)
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
    const tier = C.pGetTier(run.totalScore || 0, run.level || 175)
    wx.showModal({
      title: '📊 宠环统计报告',
      content: `等级:${run.level} | 完成:${r.comp}/100\n总分:${run.totalScore}分 | 书铁:${run.bookLevel || C.pBookLevel(run.totalScore||0, run.level)}级\n费用:${r.costWan}万 | 经验:${run.totalExp||0}点\n奖励:${(run.reward||['未记录']).join(',')}\n档位:${tier.label}\n时间:${r.startedStr}`,
      showCancel: false,
      confirmText: '关闭'
    })
  },

  deleteRun(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条记录？',
      success: res => {
        if (res.confirm) {
          const runs = S.getPetRuns(this.data.activeUser).filter(r => r.id !== id)
          S.savePetRuns(this.data.activeUser, runs)
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
      type: 'pet',
      cfg: this.data.cfg,
      hist: S.getPetRuns(this.data.activeUser),
      prices: this.data.prices,
      cur: this._cur
    }
    const json = JSON.stringify(data, null, 2)
    wx.setClipboardData({
      data: json,
      success: () => this.showToast('已复制到剪贴板（可粘贴到文件中保存）')
    })
  },

  importData() {
    wx.showModal({
      title: '导入数据',
      content: '请将之前导出的JSON数据粘贴到剪贴板，然后点确定读取',
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
                        const runs = [...imported, ...S.getPetRuns(this.data.activeUser)]
                        S.savePetRuns(this.data.activeUser, runs)
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

  // ===== Settlement from history =====
  showReportModal(_e) {
    // stub
  },

  // ===== Chart =====
  drawChart() {
    const query = wx.createSelectorQuery()
    query.select('#scoreChart').fields({ node: true, size: true }).exec(res => {
      if (!res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = win.pixelRatio
      const w = res[0].width
      const h = res[0].height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const scores = this.data.history.map(h => h._raw.totalScore || 0).reverse()
      if (scores.length === 0) return
      const max = Math.max(...scores, 220)
      const min = Math.min(...scores, 100)
      const range = max - min || 1
      const pad = { t: 20, r: 12, b: 24, l: 36 }
      const pw = w - pad.l - pad.r
      const ph = h - pad.t - pad.b

      ctx.fillStyle = '#0f1623'
      ctx.fillRect(0, 0, w, h)

      // Grid lines
      ctx.strokeStyle = '#1a2740'
      ctx.lineWidth = 0.5
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ph / 4) * i
        const val = Math.round(max - (range / 4) * i)
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke()
        ctx.fillStyle = '#6b7d95'; ctx.font = '8px sans-serif'
        ctx.fillText(val, 2, y + 3)
      }

      // Line
      if (scores.length > 1) {
        ctx.strokeStyle = '#00d4aa'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        scores.forEach((s, i) => {
          const x = pad.l + (pw / (scores.length - 1 || 1)) * i
          const y = pad.t + ph - ((s - min) / range) * ph
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      // Dots
      scores.forEach((s, i) => {
        const x = pad.l + (pw / (scores.length - 1 || 1)) * i
        const y = pad.t + ph - ((s - min) / range) * ph
        ctx.fillStyle = '#00d4aa'
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(s, x, y - 7)
        ctx.fillStyle = '#6b7d95'
        ctx.fillText('#' + (i + 1), x, h - 6)
      })
    })
  },

  // ===== Data builders =====
  ringCost(ring, prices) {
    return RING_COST.ringCost(ring, prices || this._prices, C.P_DEFAULT_PRICES)
  },

  buildRecordData(cur, prices) {
    const data = {
      score: 0, minScore: 0, maxScore: 0, completed: 0,
      bookLevel: 80, expVal: 0, costWan: '0', skipCount: 0,
      tier: C.REWARD_TIERS[0], nextRing: 0, ringList: [], gridCells: [], remaining: 0
    }
    if (!cur) return data
    const sc = cur.rings.reduce((s, r) => s + (r.sc || 0), 0)
    const comp = cur.rings.filter(r => r.t).length
    const rem = 100 - comp
    const exp = C.pExp(cur.rings)
    const bl = C.pBookLevel(sc, cur.level)
    const tier = C.pGetTier(sc, cur.level)
    const cost = RING_COST.totalCost(cur.rings, prices, C.P_DEFAULT_PRICES)
    const nr = cur.rings.findIndex(r => !r.t) + 1
    const sk = cur.rings.filter(r => r.t === 'skip').length

    const ringList = cur.rings.map((r) => {
      let cls = 'dot'
      if (r.t) {
        cls += ' done'
        if (r.sc >= 10) cls += ' hi'
        else if (r.sc < 0) cls += ' neg'
      }
      const tName = r.t ? (C.pGetT(r.t) ? C.pGetT(r.t).name : '') : ''
      return { cls, title: r.t ? ': ' + tName + ' (' + (r.sc > 0 ? '+' : '') + r.sc + ')' : '' }
    })

    const gridCells = cur.rings.map((r, i) => {
      let cls = 'cell'
      if (r.t) cls += ' ' + C.cellClassPet(r.sc)
      return { rn: i + 1, cls }
    })

    return {
      score: sc, minScore: Math.max(0, sc + rem * (-20)), maxScore: sc + rem * 10,
      completed: comp, bookLevel: bl, expVal: exp, costWan: (cost / 10000).toFixed(0),
      skipCount: sk, tier, nextRing: nr, ringList, gridCells, remaining: rem
    }
  },

  buildPredictData(cur, cfg) {
    const lv = cur ? cur.level : cfg.level
    const sc = cur ? cur.rings.reduce((s, r) => s + (r.sc || 0), 0) : 0
    const lo = Math.floor(lv / 3)
    const lvls = [150, 140, 130, 120, 110, 100, 90, 80]
    const rows = lvls.map(l2 => {
      const need = Math.max(0, l2 + 130 - lo)
      const guaranteed = l2 === 80
      const ok = !!cur && (guaranteed || sc >= need)
      let status, tagCls, reward
      if (ok) { status = guaranteed ? '保底' : '已达标'; tagCls = 'tag tag-g' }
      else if (cur) {
        status = need - sc > 50 ? '差距大' : '可冲刺'
        tagCls = need - sc > 50 ? 'tag tag-r' : 'tag tag-y'
      } else { status = '—'; tagCls = 'tag tag-b' }
      if (l2 === 80) reward = '80书铁(保底)'
      else if (l2 === 150) reward = '150书铁/160战魄/修炼果'
      else reward = l2 + '制造书/铁+修炼果'
      return {
        lv: l2,
        label: l2 === 150 ? '150级+战魄' : l2 + '级',
        need: guaranteed ? '—' : need,
        cls: ok && cur && !guaranteed ? 'hl' : '',
        status,
        tagCls,
        reward
      }
    })
    return { predictLv: lv, offset: lo, predictRows: rows }
  },

  buildControlData(cur, _cfg) {
    if (!cur) return { controlRows: [], controlNeedPerRing: '-' }
    const sc = cur.rings.reduce((s, r) => s + (r.sc || 0), 0)
    const comp = cur.rings.filter(r => r.t).length
    const rem = 100 - comp
    const lo = Math.floor(cur.level / 3)
    const targets = [80, 90, 100, 110, 120, 130, 140, 150].map(lv => {
      const guaranteed = lv === 80
      const need = guaranteed ? 0 : Math.max(0, lv + 130 - lo)
      const diff = guaranteed ? 0 : Math.max(0, need - sc)
      const ppr = guaranteed || rem <= 0 ? 0 : Math.max(0, (need - sc) / rem)
      const ok = guaranteed || sc >= need
      const feasible = rem > 0 ? (ppr <= 10) : ok
      let label = lv === 150 ? '150书铁/战魄' : (lv === 80 ? '80书铁(保底)' : lv + '书铁')
      let ftCls = '', ftLabel = '', sg
      if (ok) {
        ftCls = 'tag tag-g'
        ftLabel = guaranteed ? '保底' : '已达成'
        sg = guaranteed ? '80级为保底档' : '保持即可'
      } else if (feasible) {
        ftCls = 'tag tag-g'; ftLabel = '可行'
        const an = parseFloat(ppr.toFixed(1))
        sg = an <= 3 ? '常规任务' : an <= 5 ? '多交80环/2家' : an <= 7 ? '需指定变异+高分' : '困难，需连续高分'
      } else { ftCls = 'tag tag-r'; ftLabel = '不可行'; sg = '降低目标或下轮再冲' }
      return { lv, label, need: guaranteed ? '—' : need, diff, pr: ok ? '—' : ppr.toFixed(1), ok, cls: ok && !guaranteed ? 'hl' : '', ftCls, ftLabel, suggestion: sg }
    })
    const firstNeed = targets.find(t => !t.ok)
    return { controlRows: targets, controlNeedPerRing: firstNeed ? firstNeed.pr : '—' }
  },

  buildHistoryData(runs) {
    return runs.map(r => {
      const comp = r.rings ? r.rings.filter(x => x.t).length : 0
      const costWan = (r.totalCost || 0) / 10000
      const tier = C.pGetTier(r.totalScore || 0, r.level || 175)
      return {
        id: r.id, _raw: r, done: r.done, level: r.level, comp, costWan: costWan.toFixed(0),
        startedStr: C.fmtDate(r.startedAt),
        doneStr: r.doneAt ? C.fmtDate(r.doneAt) : '',
        totalScore: r.totalScore || '-',
        rewardStr: r.reward ? r.reward.join(', ') : '',
        tierLabel: tier.label, tierColor: tier.color,
        booked: LEDGER.isBooked(r),
        incomeWan: LEDGER.isBooked(r) ? LEDGER.formatWan(r.income) : '—',
        profitWan: LEDGER.isBooked(r) ? LEDGER.formatWan(r.profit) : '—',
        profitPos: LEDGER.isBooked(r) ? Number(r.profit) >= 0 : true,
        roiStr: LEDGER.isBooked(r) && r.roi != null ? '1 : ' + Number(r.roi).toFixed(2) : '—'
      }
    })
  },

  buildStatsData(runs) {
    if (!runs.length) return { stats: {}, tierDist: [] }
    const scores = runs.map(r => r.totalScore || 0).filter(s => s > 0)
    const costs = runs.map(r => r.totalCost || 0).filter(c => c > 0)
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0
    const mx = scores.length ? Math.max(...scores) : 0
    const mn = scores.length ? Math.min(...scores) : 0
    const avgCost = costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length / 10000).toFixed(0) : 0
    const totalAll = costs.reduce((a, b) => a + b, 0)
    const tCnt = {}
    runs.forEach(r => {
      if (r.totalScore != null) {
        const t = C.pGetTier(r.totalScore, r.level || 175)
        tCnt[t.label] = (tCnt[t.label] || 0) + 1
      }
    })
    const tierDist = Object.entries(tCnt).map(([label, count]) => ({
      label, count, pct: (count / runs.length * 100).toFixed(0)
    }))
    return {
      stats: {
        total: runs.length, avgScore: avg, maxScore: mx, minScore: mn,
        avgCostWan: avgCost, totalCostWan: (totalAll / 10000).toFixed(0)
      },
      tierDist
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
    S.savePetCur(this.data.activeUser, this._cur)
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
    const end = Math.min(Math.max(1, Math.ceil(start / 10) * 10), 100)
    this.setData({ batchStart: start, batchEnd: end, batchCount: end - start + 1 })
  },

  batchToFull() {
    const firstEmpty = this._cur ? this._cur.rings.findIndex(r => !r.t) + 1 : 1
    const start = firstEmpty || 1
    this.setData({ batchStart: start, batchEnd: 100, batchCount: 100 - start + 1 })
  },

  // ===== Toast =====
  showToast(msg) {
    this.setData({ toastMsg: msg })
    setTimeout(() => this.setData({ toastMsg: '' }), 2000)
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '宠环助手 · 100环召唤兽修炼任务追踪 | 梦幻搞钱工具箱',
      path: '/pages/pet/pet'
    }
  },

  onShareTimeline() {
    return {
      title: '宠环助手 — 100环积分追踪 · 奖励预测 · 控分策略'
    }
  }
})
