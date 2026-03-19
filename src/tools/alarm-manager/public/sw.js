// Service Worker for alarm-manager
// 处理通知点击事件，支持「知道啦」和「稍后提醒」操作按钮

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action
  const data = event.notification.data || {}

  if (action === 'snooze') {
    // 通知所有客户端执行稍后提醒
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'SNOOZE_ALARM', alarmId: data.alarmId })
        }
      })
    )
  } else {
    // 「知道啦」或直接关闭 — 只通知客户端解除，不聚焦页面
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'DISMISS_ALARM', alarmId: data.alarmId })
        }
      })
    )
  }
})

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {}
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: 'DISMISS_ALARM', alarmId: data.alarmId })
    }
  })
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
