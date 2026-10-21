// 任务使用频率：用于「常用任务置顶」与快速栏排序
// 存储结构：{ [taskId]: { count, last } }

function key(uid, tool) {
  return 'mhxy_task_usage_' + tool + '_' + uid
}

function getUsage(uid, tool) {
  try {
    const raw = wx.getStorageSync(key(uid, tool))
    return raw && typeof raw === 'object' ? raw : {}
  } catch (e) {
    return {}
  }
}

function bump(uid, tool, tid) {
  if (!uid || !tid) return
  const usage = getUsage(uid, tool)
  const item = usage[tid] || { count: 0, last: 0 }
  item.count += 1
  item.last = Date.now()
  usage[tid] = item
  try { wx.setStorageSync(key(uid, tool), usage) } catch (e) { /* ignore */ }
}

// 常用任务排前面：按次数降序，次数相同按最近使用；未用过的保持原顺序
function sortTasks(tasks, usage) {
  const list = Array.isArray(tasks) ? tasks.slice() : []
  return list
    .map((task, index) => {
      const u = usage && usage[task.id]
      return {
        task,
        index,
        count: u ? u.count : 0,
        last: u ? u.last : 0
      }
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (b.last !== a.last) return b.last - a.last
      return a.index - b.index
    })
    .map(item => item.task)
}

module.exports = { getUsage, bump, sortTasks }
