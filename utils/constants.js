// 宠环任务类型（cost 为参考市场均价，单位：两银子）
const PET_TYPES = [
  { id: 'find_npc', name: '找人', icon: '👤', sc: 1, cat: 'f', cost: 0 },
  { id: 'equip60', name: '60环装', icon: '⚔️', sc: 2, cat: 'l', cost: 180000 },
  { id: 'equip70', name: '70环装', icon: '🗡️', sc: 3, cat: 'l', cost: 120000 },
  { id: 'food_drug', name: '烹饪/三药', icon: '🍖', sc: 2, cat: 'l', cost: 20000 },
  { id: 'furniture1', name: '1级家具', icon: '🪑', sc: 2, cat: 'l', cost: 30000 },
  { id: 'flower', name: '花卉', icon: '🌸', sc: 4, cat: 'm', cost: 50000 },
  { id: 'instrument', name: '乐器', icon: '🎵', sc: 4, cat: 'm', cost: 80000 },
  { id: 'equip80', name: '80环装', icon: '🔪', sc: 5, cat: 'h', cost: 450000 },
  { id: 'furniture2', name: '2级家具', icon: '🛋️', sc: 5, cat: 'h', cost: 50000 },
  { id: 'variant_nonspecific', name: '非指定变异', icon: '🐉', sc: 5, cat: 'h', cost: 2500000 },
  { id: 'variant_specific', name: '指定变异', icon: '⭐', sc: 10, cat: 'b', cost: 6000000 },
  { id: 'variant_substitute', name: '普通宠替变异', icon: '❌', sc: -15, cat: 'n', cost: 10000 },
  { id: 'skip', name: '跳过任务', icon: '⏭️', sc: -20, cat: 'n', cost: 0 }
]

// 任务链任务类型
const CHAIN_TYPES = [
  { id: 'find_npc', name: '寻人', icon: '👤', cat: 'f', cost: 0 },
  { id: 'battle', name: '战斗', icon: '⚔️', cat: 'f', cost: 0 },
  { id: 'capture', name: '寻宠', icon: '🐾', cat: 'f', cost: 0 },
  { id: 'equip60_3', name: '60环装', icon: '🛡️', cat: 'l', cost: 80000 },
  { id: 'equip70_3', name: '70环装', icon: '🗡️', cat: 'm', cost: 120000 },
  { id: 'equip80_3', name: '80环装', icon: '🔪', cat: 'h', cost: 450000 },
  { id: 'food_3', name: '烹饪', icon: '🍖', cat: 'l', cost: 15000 },
  { id: 'drug_3', name: '三药', icon: '💊', cat: 'l', cost: 20000 },
  { id: 'flower_3', name: '花卉', icon: '🌸', cat: 'm', cost: 50000 },
  { id: 'instrument_3', name: '乐器', icon: '🎵', cat: 'm', cost: 60000 },
  { id: 'beast_book', name: '兽诀', icon: '📖', cat: 'h', cost: 800000 },
  { id: 'gem', name: '宝石', icon: '💎', cat: 'l', cost: 50000 },
  { id: 'c66', name: '金柳露', icon: '🧪', cat: 'l', cost: 80000 }
]

const BOOK_WEAPONS = ['刀', '剑', '扇', '枪', '锤', '斧', '鞭', '环圈', '双剑', '爪刺', '弓', '弩']
const BOOK_ARMORS = ['头盔', '项链', '衣服', '鞋子', '腰带']
const BOOK_LVLS = [150, 140, 130, 120, 110, 100, 90, 80]

const P_DEFAULT_PRICES = {}
PET_TYPES.forEach(t => { P_DEFAULT_PRICES[t.id] = t.cost || 0 })
const C_DEFAULT_PRICES = {}
CHAIN_TYPES.forEach(t => { C_DEFAULT_PRICES[t.id] = t.cost || 0 })

const REWARD_TIERS = [
  { minB: -999, maxB: 79, label: '80书铁(保底)', color: '#9ca3af' },
  { minB: 80, maxB: 89, label: '80书铁', color: '#9ca3af' },
  { minB: 90, maxB: 99, label: '90书铁', color: '#60a5fa' },
  { minB: 100, maxB: 109, label: '100书铁', color: '#818cf8' },
  { minB: 110, maxB: 119, label: '110书铁', color: '#a78bfa' },
  { minB: 120, maxB: 129, label: '120书铁', color: '#c084fc' },
  { minB: 130, maxB: 139, label: '130书铁', color: '#e879f9' },
  { minB: 140, maxB: 149, label: '140书铁', color: '#f472b6' },
  { minB: 150, maxB: 999, label: '150书铁/战魄', color: '#22d3ee' }
]

// 经验表 (每10环)
const EXP_TABLE = [3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,7,7,7,7,7,7,7,7,7,7,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,12,12,12,12,12,12,12,12,12,13]

// ===== Helpers =====
function cellClassPet(sc) {
  if (sc === 10) return 'db'
  if (sc >= 5) return 'd5'
  if (sc >= 3) return 'd3'
  if (sc >= 1) return 'd1'
  if (sc < 0) return 'dn'
  return ''
}

function cellClassChain(t) {
  if (!t) return ''
  const c = CHAIN_TYPES.find(x => x.id === t)
  if (!c) return ''
  if (c.cat === 'f') return 'df'
  if (c.cat === 'l') return 'd1'
  if (c.cat === 'm') return 'dm'
  if (c.cat === 'h') return 'dh'
  return ''
}

function pGetT(id) { return PET_TYPES.find(t => t.id === id) }
function cGetT(id) { return CHAIN_TYPES.find(t => t.id === id) }

function pBookLevel(sc, lv) {
  let raw = sc + Math.floor(lv / 3) - 130
  raw = Math.floor(raw / 10) * 10
  return Math.max(80, Math.min(150, raw))
}

function pGetTier(sc, lv) {
  const bl = pBookLevel(sc, lv)
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (bl >= REWARD_TIERS[i].minB) return REWARD_TIERS[i]
  }
  return REWARD_TIERS[0]
}

function pExp(rings) {
  let e = 0
  for (let i = 1; i <= 100; i++) {
    if (rings[i - 1] && rings[i - 1].t) e += EXP_TABLE[i - 1] || 0
  }
  return Math.min(e, 760)
}

function cRewardRange(lv) {
  if (lv >= 156) return { min: 130, max: 140, has150: true, hasLingshi: lv >= 110 }
  if (lv >= 140) return { min: 130, max: 140, has150: false, hasLingshi: lv >= 110 }
  const lo = lv - 10, hi = lv + 10
  return { min: Math.max(80, lo), max: Math.max(80, Math.min(150, hi)), has150: false, hasLingshi: lv >= 110 }
}

function cBookLevels(lv) {
  const r = cRewardRange(lv)
  const lvls = []
  for (let l = r.max; l >= Math.max(80, r.min); l -= 10) lvls.push(l)
  if (r.has150 && !lvls.includes(150)) lvls.unshift(150)
  return lvls
}

function fmtDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

module.exports = {
  PET_TYPES, CHAIN_TYPES, BOOK_WEAPONS, BOOK_ARMORS, BOOK_LVLS,
  P_DEFAULT_PRICES, C_DEFAULT_PRICES, REWARD_TIERS, EXP_TABLE,
  cellClassPet, cellClassChain, pGetT, cGetT, pBookLevel, pGetTier, pExp,
  cRewardRange, cBookLevels, fmtDate
}
