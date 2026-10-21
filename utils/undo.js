// 撤销栈：记录操作前后的快照，最多保留 limit 步（仅当前页面会话）
class UndoStack {
  constructor(limit) {
    this.limit = limit || 10
    this.items = []
  }

  push(snapshot) {
    this.items.push(snapshot)
    if (this.items.length > this.limit) this.items.shift()
  }

  pop() {
    return this.items.pop() || null
  }

  clear() {
    this.items = []
  }

  get size() {
    return this.items.length
  }
}

module.exports = { UndoStack }
