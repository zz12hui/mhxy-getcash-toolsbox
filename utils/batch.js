// 批量填充范围解析：允许输入过程中为空，确认时再校验
function toInt(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : NaN
}

function count(startRaw, endRaw, limit) {
  const s = toInt(startRaw)
  const e = toInt(endRaw)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0
  const cs = Math.max(1, Math.min(limit, s))
  const ce = Math.max(1, Math.min(limit, e))
  return Math.max(0, ce - cs + 1)
}

function normalize(startRaw, endRaw, limit) {
  const s = toInt(startRaw)
  const e = toInt(endRaw)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null
  if (s < 1 || e > limit || s > e) return null
  return { start: s, end: e, count: e - s + 1 }
}

module.exports = { toInt, count, normalize }
