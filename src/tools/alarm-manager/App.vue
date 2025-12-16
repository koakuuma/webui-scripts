<template>
  <div class="app-container">
    <div v-if="showPermissionBanner" class="permission-banner" @click="requestPermission">
      {{ permissionBannerText }}
    </div>

    <div class="header">
      <div class="current-time">{{ currentTime }}</div>
      <div class="current-date">{{ currentDate }}</div>
    </div>

    <ul class="alarm-list">
      <li v-for="alarm in sortedAlarms" :key="alarm.id" class="alarm-item" @click="editAlarm(alarm)">
        <div class="alarm-info">
          <span class="alarm-time" :class="{ disabled: !alarm.enabled }">{{ alarm.time }}</span>
          <span class="alarm-meta">{{ alarm.label || '闹钟' }}, {{ getRepeatText(alarm.days) }}</span>
        </div>
        <label class="switch" @click.stop>
          <input type="checkbox" :checked="alarm.enabled" @change="toggleAlarm(alarm.id, $event)">
          <span class="slider"></span>
        </label>
      </li>
    </ul>

    <div class="footer">
      <button class="add-btn" @click="openModal()">+</button>
      <button class="test-btn" @click="testNotification">测试通知</button>
    </div>

    <!-- 添加/编辑闹钟模态框 -->
    <div class="modal" :class="{ active: isModalActive }">
      <div class="modal-header">
        <button class="modal-btn btn-cancel" @click="closeModal">取消</button>
        <span style="font-weight: bold;">{{ editingId ? '编辑闹钟' : '添加闹钟' }}</span>
        <button class="modal-btn btn-save" @click="saveAlarm">存储</button>
      </div>
      <div class="modal-content">
        <div class="time-picker-container">
          <input type="time" v-model="form.time" required>
        </div>

        <div class="setting-group">
          <div class="setting-item">
            <span class="setting-label">重复</span>
            <div class="week-selector">
              <button v-for="day in weekDays" :key="day.value" class="week-day"
                :class="{ selected: form.days.includes(day.value) }" @click="toggleDay(day.value)">
                {{ day.label }}
              </button>
            </div>
          </div>
          <div class="setting-item">
            <span class="setting-label">标签</span>
            <input type="text" v-model="form.label" placeholder="闹钟">
          </div>
        </div>

        <button v-if="editingId" class="btn-delete" @click="deleteCurrentAlarm">删除闹钟</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'

interface Alarm {
  id: string
  time: string
  label: string
  days: number[]
  enabled: boolean
  lastTriggered: string | null
}

interface WeekDay {
  value: number
  label: string
}

const weekDays: WeekDay[] = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

// 状态
const alarms = ref<Alarm[]>([])
const currentTime = ref('00:00')
const currentDate = ref('1月1日 星期一')
const showPermissionBanner = ref(false)
const permissionBannerText = ref('点击此处开启通知权限，否则闹钟无法生效')
const isModalActive = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  time: '',
  label: '',
  days: [] as number[]
})

let checkInterval: number | null = null
let clockInterval: number | null = null

// 计算属性
const sortedAlarms = computed(() => {
  return [...alarms.value].sort((a, b) => a.time.localeCompare(b.time))
})

// 初始化
onMounted(() => {
  const savedAlarms = localStorage.getItem('alarms')
  if (savedAlarms) {
    alarms.value = JSON.parse(savedAlarms)
  }

  updateClock()
  clockInterval = window.setInterval(updateClock, 1000)
  checkPermission()
  startAlarmChecker()
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
  if (checkInterval) clearInterval(checkInterval)
})

// 时钟更新
const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
}

// 权限处理
const checkPermission = () => {
  if (Notification.permission !== 'granted') {
    showPermissionBanner.value = true
    permissionBannerText.value = '点击此处开启通知权限，否则闹钟无法生效'
  } else {
    showPermissionBanner.value = false
  }
}

const requestPermission = () => {
  Notification.requestPermission().then(permission => {
    checkPermission()
    if (permission === 'granted') {
      new Notification('通知已开启', { body: '闹钟将通过系统通知提醒您' })
    }
  })
}

const showPermissionBannerMsg = (msg: string) => {
  showPermissionBanner.value = true
  permissionBannerText.value = `闹钟已触发 (${msg})，但系统通知权限未开启！点击此处开启。`
}

// 辅助函数
const getRepeatText = (days: number[]) => {
  if (days.length === 0) return '不重复'
  if (days.length === 7) return '每天'
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '工作日'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末'

  const weekMap: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
  return days.slice().sort().map(d => weekMap[d]).join(' ')
}

// 模态框操作
const openModal = (alarm: Alarm | null = null) => {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission()
  }

  if (alarm) {
    editingId.value = alarm.id
    form.time = alarm.time
    form.label = alarm.label
    form.days = [...alarm.days]
  } else {
    editingId.value = null
    const now = new Date()
    form.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    form.label = ''
    form.days = []
  }
  isModalActive.value = true
}

const closeModal = () => {
  isModalActive.value = false
}

const toggleDay = (day: number) => {
  const index = form.days.indexOf(day)
  if (index === -1) {
    form.days.push(day)
  } else {
    form.days.splice(index, 1)
  }
}

// 数据操作
const saveAlarm = () => {
  if (!form.time) return

  if (editingId.value) {
    const index = alarms.value.findIndex(a => a.id === editingId.value)
    if (index !== -1) {
      alarms.value[index] = {
        ...alarms.value[index],
        time: form.time,
        label: form.label,
        days: [...form.days],
        enabled: true
      }
    }
  } else {
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      time: form.time,
      label: form.label,
      days: [...form.days],
      enabled: true,
      lastTriggered: null
    }
    alarms.value.push(newAlarm)
  }

  saveToStorage()
  closeModal()
}

const deleteCurrentAlarm = () => {
  if (editingId.value) {
    alarms.value = alarms.value.filter(a => a.id !== editingId.value)
    saveToStorage()
    closeModal()
  }
}

const toggleAlarm = (id: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const alarm = alarms.value.find(a => a.id === id)
  if (alarm) {
    alarm.enabled = checked
    if (checked) alarm.lastTriggered = null
    saveToStorage()
  }
}

const editAlarm = (alarm: Alarm) => {
  openModal(alarm)
}

const saveToStorage = () => {
  localStorage.setItem('alarms', JSON.stringify(alarms.value))
}

// 闹钟检查器
const startAlarmChecker = () => {
  checkInterval = window.setInterval(() => {
    const now = new Date()
    const currentDay = now.getDay()
    const currentTimeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const currentFullTime = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${currentTimeStr}`

    alarms.value.forEach(alarm => {
      if (!alarm.enabled) return

      if (alarm.time === currentTimeStr) {
        if (alarm.lastTriggered === currentFullTime) return

        let shouldTrigger = false
        if (alarm.days.length === 0) {
          shouldTrigger = true
        } else {
          if (alarm.days.includes(currentDay)) {
            shouldTrigger = true
          }
        }

        if (shouldTrigger) {
          triggerAlarm(alarm, currentFullTime)
        }
      }
    })
  }, 1000)
}

const triggerAlarm = (alarm: Alarm, triggerTime: string) => {
  alarm.lastTriggered = triggerTime
  sendNotification(alarm.label || '闹钟响了', `时间到了：${alarm.time}`)

  if (alarm.days.length === 0) {
    alarm.enabled = false
  }

  saveToStorage()
}

const sendNotification = (title: string, body: string) => {
  if (!("Notification" in window)) {
    alert("当前浏览器不支持桌面通知")
    return
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png',
      requireInteraction: true
    })
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, {
          body: body,
          icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png',
          requireInteraction: true
        })
      } else {
        showPermissionBannerMsg(body)
      }
    })
  } else {
    showPermissionBannerMsg(body)
  }
}

const testNotification = () => {
  if (!("Notification" in window)) {
    alert("当前浏览器不支持桌面通知")
  } else if (Notification.permission === "granted") {
    new Notification('测试成功', {
      body: '测试 Windows 系统原生通知效果',
      icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png'
    })
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification('测试成功', {
          body: '测试 Windows 系统原生通知效果',
          icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png'
        })
      }
    })
  } else {
    alert('通知权限已被拒绝。请在浏览器地址栏左侧点击锁形图标或设置图标，重置通知权限。')
  }
}
</script>

<style scoped>
/* 样式已迁移到 style.scss，这里只保留组件特定的样式如果需要 */
.app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>