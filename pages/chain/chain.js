const C = require('../../utils/constants')
const S = require('../../utils/storage')
const app = getApp()

Page({
  data: {
    tab: 'record',
    clockStr: '',
    // User
    users: [], activeUser: '', currentUserName: '', userIdx: 0, userNames: [],
    // Config
    cfg: { level: 175 }, hasCur: false,
    // Record
    chainTypes: [], modalTask: '', qbItem: '',
    completed: 0, remaining: 300, costWan: '0', completedPct: 0,
    nextRing: 0, ringList: [], gridCells: [],
    seg1Done: false, seg2Done: false, seg3Done: false, curSeg: 1,
    // Reward
    rewardLv: 175, rewardRuleStr: '', rewardRuleShort: '',
    segRewards: [], rewardRows: [],
    // History
    history: [],
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
    // Toast
    toastMsg: '',
    // Running
    _cur: null
  },

  onShow() {
    this.loadData()
    this.updateClock()
    if (this._clockTimer) clearInterval(this._clockTimer)
    this._clockTimer = setInterval(() => this.updateClock(), 1000)
    const uid = this.data.activeUser
    if (uid && !wx.getStorageSync('mhxy_guide_seen_chain_' + uid)) {
      setTimeout(() => this.setData({ showGuide: true }), 500)
    }
  },

  onHide() {
    if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null }
    if (this._checkTimer) { clearTimeout(this._checkTimer); this._checkTimer = null }
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

    const hasCur = !!cur
    const userIdx = users.findIndex(u => u.id === activeUser)

    let recordData = this.buildRecordData(cur, prices, cfg)
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
      ...recordData, ...rewardData,
      history: historyData, ...statsData
    })
  },

  // ===== Clock =====
  updateClock() {
    const n = new Date()
    this.setData({ clockStr: n.toLocaleTimeString('zh-CN', { hour12: false }) })
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
          ['mhxy3_cfg_','mhxy3_cur_','mhxy3_runs_','mhxy3_prices_'].forEach(k => wx.removeStorageSync(k + uid))
          const newUsers = users.filter(u => u.id !== uid)
          S.saveUsers(newUsers)
          if (this.data.activeUser === uid) { S.saveActiveUser(newUsers[0].id); app.globalData.activeUser = newUsers[0].id }
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
    cur.totalCost = cur.rings.reduce((s, r) => s + this.ringCost(r), 0)
    const runs = S.getChainRuns(this.data.activeUser)
    runs.unshift({ ...cur })
    S.saveChainRuns(this.data.activeUser, runs)
    S.saveChainCur(this.data.activeUser, null)
    this._cur = null
    this.loadData()
    this.showToast('结算完成！费用:' + (cur.totalCost / 10000).toFixed(0) + '万')
  },

  // ===== Ring editing =====
  setRing(rn, tid, item) {
    if (!this._cur) return
    this._cur.rings[rn - 1] = { t: tid, item: item || '' }
    S.saveChainCur(this.data.activeUser, this._cur)
  },

  selectTask(e) { this.setData({ modalTask: e.currentTarget.dataset.tid }) },
  onQbItemInput(e) { this.setData({ qbItem: e.detail.value }) },

  quickRecord() {
    if (!this._cur) return
    const tid = this.data.modalTask
    if (!tid) { this.showToast('请先选择任务类型'); return }
    const nr = this._cur.rings.findIndex(r => !r.t) + 1
    if (!nr) { this.showToast('已全部记录'); return }
    this.setRing(nr, tid, this.data.qbItem)
    this.setData({ modalTask: '', qbItem: '' })
    this.loadData()
    this.checkSeg()
  },

  editCell(e) {
    const rn = parseInt(e.currentTarget.dataset.ring)
    if (!this._cur) return
    const ring = this._cur.rings[rn - 1]
    const hasCur = !!ring.t
    this.setData({
      showEditModal: true, editRing: rn,
      editSelTid: ring.t || '', editItem: ring.item || '',
      editHasCur: hasCur,
      editCostWan: (this.ringCost(ring) / 10000).toFixed(0)
    })
  },

  closeEditModal() { this.setData({ showEditModal: false }) },
  pickEditType(e) { this.setData({ editSelTid: e.currentTarget.dataset.tid }) },
  onEditItemInput(e) { this.setData({ editItem: e.detail.value }) },

  saveEdit() {
    const tid = this.data.editSelTid
    if (!tid) { this.showToast('请选择任务类型'); return }
    this.setRing(this.data.editRing, tid, this.data.editItem)
    this.setData({ showEditModal: false })
    this.loadData()
    this.checkSeg()
  },

  clearEdit() {
    if (!this._cur) return
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
    for (let i = batchStart; i <= effEnd; i++) {
      if (!this._cur.rings[i - 1].t) this._cur.rings[i - 1] = { t: batchSelTid, item: '' }
    }
    S.saveChainCur(this.data.activeUser, this._cur)
    this.setData({ showBatchModal: false })
    this.loadData()
    this.showToast(`已填充${batchStart}-${effEnd}环`)
    this.checkSeg()
  },

  // ===== Prices =====
  showPrices() { this.setData({ showPricesModal: true }) },
  closePricesModal() { this.setData({ showPricesModal: false }) },

  onPriceChange(e) {
    const tid = e.currentTarget.dataset.tid
    const prices = { ...this.data.prices, [tid]: parseInt(e.detail.value) || 0 }
    this.setData({ prices })
  },

  savePrices() {
    S.saveChainPrices(this.data.activeUser, this.data.prices)
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
      segExtras: extrasLabels.map(l => ({ label: l, checked: false })),
      segCats: cats
    })
  },

  closeSegModal() { this.setData({ showSegModal: false }) },

  onSegCatChange(e) { this.setData({ segCatIdx: parseInt(e.detail.value), segLvIdx: 0, segTypeIdx: 0, segMainReward: '' }) },
  onSegLvChange(e) { this.setData({ segLvIdx: parseInt(e.detail.value), segMainReward: '' }) },
  onSegTypeChange(e) { this.setData({ segTypeIdx: parseInt(e.detail.value), segMainReward: '' }) },

  addSegMain() {
    const { segCats, segCatIdx, segFixedCat, segLvs, segLvIdx, segSubTypes, segTypeIdx, segShowCat } = this.data
    const cat = segShowCat ? segCats[segCatIdx] : segFixedCat
    if (!cat) { this.showToast('请选择类别'); return }
    let reward = ''
    if (cat === '战魄') { reward = '160级战魄' }
    else {
      const lv = segLvs[segLvIdx]
      if (!lv) { this.showToast('请选择等级'); return }
      if (cat === '制造指南书') {
        const tp = segSubTypes[segTypeIdx]
        if (!tp) { this.showToast('请选择类型'); return }
        reward = lv + '级' + cat + '-' + tp
      } else { reward = lv + '级' + cat }
    }
    this.setData({ segMainReward: reward })
  },

  clearSegMain() { this.setData({ segMainReward: '' }) },

  toggleSegExtra(_e) {
    // handled by onSegExtrasChange instead
  },

  onSegExtrasChange(e) {
    const selected = e.detail.value
    const segExtras = this.data.segExtras.map(s => ({ label: s.label, checked: selected.indexOf(s.label) >= 0 }))
    this.setData({ segExtraChecked: selected, segExtras })
  },

  onSegCustom(e) { this.setData({ segCustom: e.detail.value }) },

  confirmSeg() {
    if (!this._cur) return
    const seg = this.data.segRewardSeg
    const checked = []
    if (this.data.segMainReward) checked.push(this.data.segMainReward)
    checked.push(...this.data.segExtraChecked)
    if (this.data.segCustom.trim()) checked.push(this.data.segCustom.trim())
    this._cur.rewards[seg] = checked.length > 0 ? checked : ['未记录']
    S.saveChainCur(this.data.activeUser, this._cur)
    this.setData({ showSegModal: false })
    this.loadData()
    if (seg === 300 && this.segDone(100) && this.segDone(200)) this.doComplete()
  },

  // ===== History =====
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
                const imported = d.hist || d.history
                if (imported && Array.isArray(imported)) {
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
                } else this.showToast('无效数据')
              } catch (e) { this.showToast('解析失败') }
            }
          })
        }
      }
    })
  },

  // ===== Data builders =====
  ringCost(ring) {
    if (!ring || !ring.t) return 0
    return this.data.prices[ring.t] || C.C_DEFAULT_PRICES[ring.t] || 0
  },

  buildRecordData(cur, _prices, _cfg) {
    const data = {
      completed: 0, remaining: 300, costWan: '0', completedPct: 0,
      nextRing: 0, ringList: [], gridCells: [],
      seg1Done: false, seg2Done: false, seg3Done: false, curSeg: 1
    }
    if (!cur) return data
    const comp = cur.rings.filter(r => r.t).length
    const cost = cur.rings.reduce((s, r) => s + this.ringCost(r), 0)
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
      completedPct: (comp / 3).toFixed(0),
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
      s100: lv >= 156 ? '可能' : (l >= r.min && l <= r.max ? '可能' : '—'),
      s200: lv >= 156 ? '可能' : (l >= r.min && l <= r.max ? '可能' : '—'),
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
        rewardStr
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

  // ===== Toast =====
  showToast(msg) {
    this.setData({ toastMsg: msg })
    setTimeout(() => this.setData({ toastMsg: '' }), 2000)
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '跑环助手 · 300环任务链记录与奖励结算 | 梦幻搞钱工具箱',
      path: '/pages/chain/chain'
    }
  },

  onShareTimeline() {
    return {
      title: '跑环助手 — 300环三段奖励结算 · 等级预测书铁区间'
    }
  }
})
