// 底部自定义 TabBar 选中态同步（页面 onShow 调用，避免只依赖 pageLifetimes）
function syncTabBar(page, index) {
  if (!page || typeof page.getTabBar !== 'function') return
  const tb = page.getTabBar()
  if (tb && tb.setData) tb.setData({ selected: index })
}

module.exports = { syncTabBar }
