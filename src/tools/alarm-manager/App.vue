<template>
  <div class="app-container">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="app-title">{{ currentTabName }}</div>
      <div class="top-actions">
        <button class="icon-btn" v-if="currentTab === 'alarm'" @click="openModal()">+</button>
        <button class="icon-btn" v-if="currentTab === 'world-clock'" @click="addWorldClock">+</button>
        <button class="icon-btn">⋮</button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 闹钟页面 -->
      <div v-if="currentTab === 'alarm'" class="tab-content">
        <div class="countdown-tip" v-if="nextAlarmTip">
          闹钟将在 <span class="highlight-time">{{ nextAlarmTip }}</span> 后响铃
        </div>

        <div v-if="showPermissionBanner" class="permission-banner" @click="requestPermission">
          <span>{{ permissionBannerText }}</span>
          <span style="color: var(--accent-color)">开启</span>
        </div>

        <ul class="alarm-list">
          <li v-for="alarm in sortedAlarms" :key="alarm.id" class="alarm-card" @click="editAlarm(alarm)">
            <div class="alarm-info">
              <span class="alarm-time" :class="{ active: alarm.enabled }">{{ alarm.time }}</span>
              <span class="alarm-meta">{{ alarm.label || '闹钟' }} | {{ getRepeatText(alarm.days) }}</span>
            </div>
            <label class="switch" @click.stop>
              <input type="checkbox" :checked="alarm.enabled" @change="toggleAlarm(alarm.id, $event)">
              <span class="slider"></span>
            </label>
          </li>
        </ul>
      </div>

      <!-- 世界时钟页面 -->
      <div v-if="currentTab === 'world-clock'" class="tab-content centered-content">
        <div class="clock-face">
          <div class="clock-center"></div>
          <div class="clock-hand hour-hand" :style="{ transform: `rotate(${clockHands.hour}deg)` }"></div>
          <div class="clock-hand minute-hand" :style="{ transform: `rotate(${clockHands.minute}deg)` }"></div>
          <div class="clock-hand second-hand" :style="{ transform: `rotate(${clockHands.second}deg)` }"></div>
          <div class="digital-time">{{ currentTimeStr }}</div>
        </div>
        <div class="date-display">
          <div>中国标准时间</div>
          <div>{{ currentDateStr }}</div>
        </div>
      </div>

      <!-- 秒表页面 -->
      <div v-if="currentTab === 'stopwatch'" class="tab-content centered-content">
        <div class="stopwatch-display">{{ formatStopwatch(stopwatchTime) }}</div>
        <div class="stopwatch-controls">
          <button class="control-btn btn-reset" v-if="stopwatchRunning || stopwatchTime > 0" @click="resetStopwatch">
            {{ stopwatchRunning ? '计次' : '重设' }}
          </button>
          <button class="control-btn btn-start" :class="{ 'btn-stop': stopwatchRunning }" @click="toggleStopwatch">
            {{ stopwatchRunning ? '停止' : '启动' }}
          </button>
        </div>
        <ul class="lap-list" v-if="laps.length > 0">
          <li v-for="(lap, index) in laps" :key="index" class="lap-item">
            <span>计次 {{ laps.length - index }}</span>
            <span>{{ formatStopwatch(lap) }}</span>
          </li>
        </ul>
      </div>

      <!-- 计时器页面 -->
      <div v-if="currentTab === 'timer'" class="tab-content centered-content">
        <div class="timer-display" v-if="timerRunning || timerPaused">
          <div class="timer-circle">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="5" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent-color)" stroke-width="5"
                stroke-dasharray="283" :stroke-dashoffset="timerProgress" transform="rotate(-90 50 50)" />
            </svg>
            <div class="timer-text">{{ formatTimer(timerRemaining) }}</div>
          </div>
          <div class="timer-controls">
            <button class="control-btn btn-reset" @click="cancelTimer">取消</button>
            <button class="control-btn btn-start" :class="{ 'btn-stop': timerRunning }" @click="toggleTimer">
              {{ timerRunning ? '暂停' : '继续' }}
            </button>
          </div>
        </div>
        <div class="timer-setup" v-else>
          <div class="time-picker compact">
            <div class="time-display">
              <div class="time-unit">
                <input type="number" v-model="timerInput.hours" min="0" max="23" class="time-input">
                <span class="time-label">时</span>
              </div>
              <div class="time-unit">
                <input type="number" v-model="timerInput.minutes" min="0" max="59" class="time-input">
                <span class="time-label">分</span>
              </div>
              <div class="time-unit">
                <input type="number" v-model="timerInput.seconds" min="0" max="59" class="time-input">
                <span class="time-label">秒</span>
              </div>
            </div>
          </div>
          <button class="control-btn btn-start big-btn" @click="startTimer">启动</button>

          <div class="preset-timers">
            <div class="section-title">常用计时器</div>
            <div class="preset-list">
              <div class="preset-card" @click="startPresetTimer(5 * 60)">
                <div class="preset-time">00:05:00</div>
                <div class="preset-label">即食面</div>
                <button class="play-icon">▶</button>
              </div>
              <div class="preset-card" @click="startPresetTimer(15 * 60)">
                <div class="preset-time">00:15:00</div>
                <div class="preset-label">面膜</div>
                <button class="play-icon">▶</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="bottom-nav">
      <div class="nav-item" :class="{ active: currentTab === 'alarm' }" @click="currentTab = 'alarm'">
        <span class="icon">⏰</span>
        <span>闹钟</span>
      </div>
      <div class="nav-item" :class="{ active: currentTab === 'world-clock' }" @click="currentTab = 'world-clock'">
        <span class="icon">🌍</span>
        <span>世界时钟</span>
      </div>
      <div class="nav-item" :class="{ active: currentTab === 'stopwatch' }" @click="currentTab = 'stopwatch'">
        <span class="icon">⏱️</span>
        <span>秒表</span>
      </div>
      <div class="nav-item" :class="{ active: currentTab === 'timer' }" @click="currentTab = 'timer'">
        <span class="icon">⏳</span>
        <span>计时器</span>
      </div>
    </div>

    <!-- 编辑页面 (全屏覆盖) -->
    <div class="edit-page" :class="{ active: isModalActive }">
      <div class="edit-header">
        <button class="btn-cancel" @click="closeModal">取消</button>
        <span class="edit-title">{{ editingId ? '编辑闹钟' : '添加闹钟' }}</span>
        <button class="btn-save" @click="saveAlarm">完成</button>
      </div>

      <div class="edit-content">
        <!-- 滚轮时间选择器 -->
        <div class="wheel-picker-container">
          <div class="wheel-column" @wheel.prevent="handleWheel($event, 'hour')"
            @touchstart="handleTouchStart($event, 'hour')" @touchmove="handleTouchMove($event, 'hour')"
            @touchend="handleTouchEnd('hour')">
            <div class="wheel-list" :style="{ transform: `translateY(${hourOffset}px)` }">
              <div v-for="h in hourList" :key="h" class="wheel-item" :class="{ active: h === selectedHour }">
                {{ h }}
              </div>
            </div>
          </div>
          <div class="wheel-column" @wheel.prevent="handleWheel($event, 'minute')"
            @touchstart="handleTouchStart($event, 'minute')" @touchmove="handleTouchMove($event, 'minute')"
            @touchend="handleTouchEnd('minute')">
            <div class="wheel-list" :style="{ transform: `translateY(${minuteOffset}px)` }">
              <div v-for="m in minuteList" :key="m" class="wheel-item" :class="{ active: m === selectedMinute }">
                {{ m }}
              </div>
            </div>
          </div>
          <div class="wheel-highlight"></div>
        </div>

        <!-- 设置项列表 -->
        <div class="settings-list">
          <div class="setting-item">
            <span class="setting-label">闹钟名称</span>
            <div class="setting-value">
              <input type="text" v-model="form.label" placeholder="闹钟"
                style="text-align: right; background: transparent; border: none; color: inherit; outline: none;">
              <span class="arrow-right">›</span>
            </div>
          </div>
          <div class="setting-item" @click="openWeekModal">
            <span class="setting-label">重复</span>
            <div class="setting-value">
              {{ getRepeatText(form.days) }}
              <span class="arrow-right">›</span>
            </div>
          </div>
        </div>

        <div class="settings-list">
          <div class="setting-item" @click="openSnoozeModal">
            <span class="setting-label">稍后提示</span>
            <div class="setting-value">
              {{ form.snoozeEnabled ? `${form.snoozeInterval}分钟, ${form.snoozeCount}次` : '关闭' }}
              <span class="arrow-right">›</span>
            </div>
          </div>
        </div>

        <!-- 删除按钮 -->
        <div class="delete-section" v-if="editingId">
          <button class="btn-delete" @click="deleteCurrentAlarm">删除闹钟</button>
        </div>
      </div>

      <!-- 星期选择子页面 -->
      <div class="sub-page" :class="{ active: isWeekModalActive }">
        <div class="edit-header">
          <button class="btn-cancel" @click="closeWeekModal">返回</button>
          <span class="edit-title">重复</span>
          <div style="width: 40px;"></div>
        </div>
        <div class="list-container">
          <div v-for="day in weekDays" :key="day.value" class="list-item" @click="toggleDay(day.value)">
            <span>{{ day.label }}</span>
            <span class="check-icon" v-if="form.days.includes(day.value)">✓</span>
          </div>
        </div>
      </div>

      <!-- 稍后提示设置子页面 -->
      <div class="sub-page" :class="{ active: isSnoozeModalActive }">
        <div class="edit-header">
          <button class="btn-cancel" @click="closeSnoozeModal">返回</button>
          <span class="edit-title">稍后提示</span>
          <div style="width: 40px;"></div>
        </div>
        <div class="list-container">
          <div class="list-item">
            <span>稍后提示</span>
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="form.snoozeEnabled">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div v-if="form.snoozeEnabled">
          <div class="section-header">提示间隔</div>
          <div class="list-container">
            <div v-for="interval in [5, 10, 15, 30]" :key="interval" class="list-item"
              @click="form.snoozeInterval = interval">
              <span>{{ interval }} 分钟</span>
              <span class="check-icon" v-if="form.snoozeInterval === interval">●</span>
              <span class="radio-icon" v-else>○</span>
            </div>
          </div>

          <div class="section-header">提示次数</div>
          <div class="list-container">
            <div v-for="count in [2, 3, 5, 10]" :key="count" class="list-item" @click="form.snoozeCount = count">
              <span>{{ count }} 次</span>
              <span class="check-icon" v-if="form.snoozeCount === count">●</span>
              <span class="radio-icon" v-else>○</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'

// 类型定义
interface Alarm {
  id: string
  time: string
  label: string
  days: number[]
  enabled: boolean
  lastTriggered: string | null
  snoozeEnabled: boolean
  snoozeInterval: number
  snoozeCount: number
}

interface WeekDay {
  value: number
  label: string
}

type Tab = 'alarm' | 'world-clock' | 'stopwatch' | 'timer'

// 常量
const weekDays: WeekDay[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

// 状态
const currentTab = ref<Tab>('alarm')
const alarms = ref<Alarm[]>([])
const showPermissionBanner = ref(false)
const permissionBannerText = ref('点击开启通知权限')
const isModalActive = ref(false)
const isWeekModalActive = ref(false)
const isSnoozeModalActive = ref(false)
const editingId = ref<string | null>(null)
const nextAlarmTip = ref('')

// 表单数据
const form = reactive({
  time: '',
  label: '',
  days: [] as number[],
  snoozeEnabled: true,
  snoozeInterval: 5,
  snoozeCount: 3
})

// 滚轮选择器相关
const ITEM_HEIGHT = 50
const VISIBLE_ITEMS = 5
const selectedHour = ref('00')
const selectedMinute = ref('00')
const hourOffset = ref(0)
const minuteOffset = ref(0)
let startY = 0
let currentY = 0
let isDragging = false

// 生成小时和分钟列表 (为了实现无限滚动，前后各加一些)
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))
const hourList = computed(() => [...hours, ...hours, ...hours]) // 3倍长度
const minuteList = computed(() => [...minutes, ...minutes, ...minutes])

// 时钟相关
const currentTimeStr = ref('')
const currentDateStr = ref('')
const clockHands = reactive({ hour: 0, minute: 0, second: 0 })

// 秒表相关
const stopwatchTime = ref(0)
const stopwatchRunning = ref(false)
const laps = ref<number[]>([])
let stopwatchInterval: number | null = null
let stopwatchStartTime = 0
let stopwatchAccumulated = 0

// 计时器相关
const timerInput = reactive({ hours: 0, minutes: 5, seconds: 0 })
const timerTotal = ref(0)
const timerRemaining = ref(0)
const timerRunning = ref(false)
const timerPaused = ref(false)
let timerInterval: number | null = null

// 定时器引用
let checkInterval: number | null = null
let tipInterval: number | null = null
let clockInterval: number | null = null

// 计算属性
const currentTabName = computed(() => {
  const map: Record<Tab, string> = {
    'alarm': '闹钟',
    'world-clock': '世界时钟',
    'stopwatch': '秒表',
    'timer': '计时器'
  }
  return map[currentTab.value]
})

const sortedAlarms = computed(() => {
  return [...alarms.value].sort((a, b) => a.time.localeCompare(b.time))
})

const timerProgress = computed(() => {
  if (timerTotal.value === 0) return 0
  const circumference = 2 * Math.PI * 45
  return circumference * (1 - timerRemaining.value / timerTotal.value)
})

// 初始化
onMounted(() => {
  const savedAlarms = localStorage.getItem('alarms')
  if (savedAlarms) {
    alarms.value = JSON.parse(savedAlarms)
  }

  checkPermission()
  startAlarmChecker()
  updateNextAlarmTip()
  startClock()

  tipInterval = window.setInterval(updateNextAlarmTip, 60000)
})

onUnmounted(() => {
  if (checkInterval) clearInterval(checkInterval)
  if (tipInterval) clearInterval(tipInterval)
  if (clockInterval) clearInterval(clockInterval)
  if (stopwatchInterval) clearInterval(stopwatchInterval)
  if (timerInterval) clearInterval(timerInterval)
})

// --- 滚轮选择器逻辑 ---
const initWheel = (time: string) => {
  const [h, m] = time.split(':')
  selectedHour.value = h
  selectedMinute.value = m

  // 初始定位到中间那组
  const hIndex = parseInt(h) + 24
  const mIndex = parseInt(m) + 60

  hourOffset.value = -hIndex * ITEM_HEIGHT + ITEM_HEIGHT * 2
  minuteOffset.value = -mIndex * ITEM_HEIGHT + ITEM_HEIGHT * 2
}

const handleWheel = (e: WheelEvent, type: 'hour' | 'minute') => {
  const delta = e.deltaY > 0 ? -ITEM_HEIGHT : ITEM_HEIGHT
  updateOffset(type, delta)
}

const handleTouchStart = (e: TouchEvent, type: 'hour' | 'minute') => {
  isDragging = true
  startY = e.touches[0].clientY
  currentY = type === 'hour' ? hourOffset.value : minuteOffset.value
}

const handleTouchMove = (e: TouchEvent, type: 'hour' | 'minute') => {
  if (!isDragging) return
  const deltaY = e.touches[0].clientY - startY
  if (type === 'hour') {
    hourOffset.value = currentY + deltaY
  } else {
    minuteOffset.value = currentY + deltaY
  }
}

const handleTouchEnd = (type: 'hour' | 'minute') => {
  isDragging = false
  snapToGrid(type)
}

const updateOffset = (type: 'hour' | 'minute', delta: number) => {
  if (type === 'hour') {
    hourOffset.value += delta
    snapToGrid('hour')
  } else {
    minuteOffset.value += delta
    snapToGrid('minute')
  }
}

const snapToGrid = (type: 'hour' | 'minute') => {
  const offset = type === 'hour' ? hourOffset.value : minuteOffset.value
  const itemCount = type === 'hour' ? 24 : 60
  const totalItems = itemCount * 3

  let index = Math.round((offset - ITEM_HEIGHT * 2) / -ITEM_HEIGHT)

  // 循环处理
  if (index < itemCount) {
    index += itemCount
  } else if (index >= itemCount * 2) {
    index -= itemCount
  }

  const newOffset = -index * ITEM_HEIGHT + ITEM_HEIGHT * 2

  if (type === 'hour') {
    hourOffset.value = newOffset
    selectedHour.value = hours[index % 24]
  } else {
    minuteOffset.value = newOffset
    selectedMinute.value = minutes[index % 60]
  }

  // 更新 form.time
  form.time = `${selectedHour.value}:${selectedMinute.value}`
}

// --- 闹钟功能 ---

const checkPermission = () => {
  if (Notification.permission !== 'granted') {
    showPermissionBanner.value = true
    permissionBannerText.value = '点击开启通知权限'
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

const getRepeatText = (days: number[]) => {
  if (days.length === 0) return '仅此一次'
  if (days.length === 7) return '每天'
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '工作日'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末'

  const weekMap: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
  return days.slice().sort().map(d => weekMap[d]).join(' ')
}

const updateNextAlarmTip = () => {
  const enabledAlarms = alarms.value.filter(a => a.enabled)
  if (enabledAlarms.length === 0) {
    nextAlarmTip.value = ''
    return
  }

  const now = new Date()
  let minDiff = Infinity

  enabledAlarms.forEach(alarm => {
    const [hours, minutes] = alarm.time.split(':').map(Number)
    let alarmDate = new Date(now)
    alarmDate.setHours(hours, minutes, 0, 0)

    if (alarmDate <= now) {
      alarmDate.setDate(alarmDate.getDate() + 1)
    }

    if (alarm.days.length > 0) {
      while (!alarm.days.includes(alarmDate.getDay())) {
        alarmDate.setDate(alarmDate.getDate() + 1)
      }
    }

    const diff = alarmDate.getTime() - now.getTime()
    if (diff < minDiff) {
      minDiff = diff
    }
  })

  if (minDiff === Infinity) {
    nextAlarmTip.value = ''
    return
  }

  const diffMinutes = Math.floor(minDiff / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const days = Math.floor(diffHours / 24)
  const remainingHours = diffHours % 24
  const remainingMinutes = diffMinutes % 60

  let tip = ''
  if (days > 0) tip += `${days}天 `
  if (remainingHours > 0) tip += `${remainingHours}小时 `
  tip += `${remainingMinutes}分钟`

  nextAlarmTip.value = tip
}

const openModal = (alarm: Alarm | null = null) => {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission()
  }

  let timeStr = ''
  if (alarm) {
    editingId.value = alarm.id
    timeStr = alarm.time
    form.label = alarm.label
    form.days = [...alarm.days]
    form.snoozeEnabled = alarm.snoozeEnabled !== undefined ? alarm.snoozeEnabled : true
    form.snoozeInterval = alarm.snoozeInterval || 5
    form.snoozeCount = alarm.snoozeCount || 3
  } else {
    editingId.value = null
    const now = new Date()
    timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    form.label = ''
    form.days = []
    form.snoozeEnabled = true
    form.snoozeInterval = 5
    form.snoozeCount = 3
  }

  form.time = timeStr
  initWheel(timeStr)
  isModalActive.value = true
}

const closeModal = () => {
  isModalActive.value = false
  isWeekModalActive.value = false
  isSnoozeModalActive.value = false
}

const openWeekModal = () => {
  isWeekModalActive.value = true
}

const closeWeekModal = () => {
  isWeekModalActive.value = false
}

const openSnoozeModal = () => {
  isSnoozeModalActive.value = true
}

const closeSnoozeModal = () => {
  isSnoozeModalActive.value = false
}

const toggleDay = (day: number) => {
  const index = form.days.indexOf(day)
  if (index === -1) {
    form.days.push(day)
  } else {
    form.days.splice(index, 1)
  }
}

const saveAlarm = () => {
  if (!form.time) return

  const alarmData = {
    time: form.time,
    label: form.label,
    days: [...form.days],
    enabled: true,
    snoozeEnabled: form.snoozeEnabled,
    snoozeInterval: form.snoozeInterval,
    snoozeCount: form.snoozeCount
  }

  if (editingId.value) {
    const index = alarms.value.findIndex(a => a.id === editingId.value)
    if (index !== -1) {
      alarms.value[index] = { ...alarms.value[index], ...alarmData }
    }
  } else {
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      ...alarmData,
      lastTriggered: null
    }
    alarms.value.push(newAlarm)
  }

  saveToStorage()
  closeModal()
  updateNextAlarmTip()
}

const deleteCurrentAlarm = () => {
  if (editingId.value) {
    alarms.value = alarms.value.filter(a => a.id !== editingId.value)
    saveToStorage()
    closeModal()
    updateNextAlarmTip()
  }
}

const toggleAlarm = (id: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const alarm = alarms.value.find(a => a.id === id)
  if (alarm) {
    alarm.enabled = checked
    if (checked) alarm.lastTriggered = null
    saveToStorage()
    updateNextAlarmTip()
  }
}

const editAlarm = (alarm: Alarm) => {
  openModal(alarm)
}

const saveToStorage = () => {
  localStorage.setItem('alarms', JSON.stringify(alarms.value))
}

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
  updateNextAlarmTip()
}

const sendNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return

  const options: NotificationOptions = {
    body: body,
    icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png',
    requireInteraction: true,
    // @ts-ignore
    actions: [
      { action: 'snooze', title: '稍后提醒' },
      { action: 'close', title: '不再提示' }
    ]
  }

  if (Notification.permission === "granted") {
    new Notification(title, options)
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, options)
      }
    })
  }
}

// --- 世界时钟功能 ---
const startClock = () => {
  const update = () => {
    const now = new Date()
    currentTimeStr.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    currentDateStr.value = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

    const seconds = now.getSeconds()
    const minutes = now.getMinutes()
    const hours = now.getHours()

    clockHands.second = seconds * 6
    clockHands.minute = minutes * 6 + seconds * 0.1
    clockHands.hour = (hours % 12) * 30 + minutes * 0.5
  }
  update()
  clockInterval = window.setInterval(update, 1000)
}

const addWorldClock = () => {
  alert('添加世界时钟功能开发中...')
}

// --- 秒表功能 ---
const formatStopwatch = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

const toggleStopwatch = () => {
  if (stopwatchRunning.value) {
    // 停止
    stopwatchRunning.value = false
    if (stopwatchInterval) clearInterval(stopwatchInterval)
    stopwatchAccumulated += Date.now() - stopwatchStartTime
  } else {
    // 启动
    stopwatchRunning.value = true
    stopwatchStartTime = Date.now()
    stopwatchInterval = window.setInterval(() => {
      stopwatchTime.value = stopwatchAccumulated + (Date.now() - stopwatchStartTime)
    }, 10)
  }
}

const resetStopwatch = () => {
  if (stopwatchRunning.value) {
    // 计次
    laps.value.unshift(stopwatchTime.value)
  } else {
    // 重设
    stopwatchTime.value = 0
    stopwatchAccumulated = 0
    laps.value = []
  }
}

// --- 计时器功能 ---
const formatTimer = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const startTimer = () => {
  const totalSeconds = timerInput.hours * 3600 + timerInput.minutes * 60 + timerInput.seconds
  if (totalSeconds <= 0) return

  timerTotal.value = totalSeconds
  timerRemaining.value = totalSeconds
  timerRunning.value = true
  timerPaused.value = false

  runTimer()
}

const startPresetTimer = (seconds: number) => {
  timerTotal.value = seconds
  timerRemaining.value = seconds
  timerRunning.value = true
  timerPaused.value = false
  runTimer()
}

const runTimer = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = window.setInterval(() => {
    if (timerRemaining.value > 0) {
      timerRemaining.value--
    } else {
      timerRunning.value = false
      timerPaused.value = false
      if (timerInterval) clearInterval(timerInterval)
      sendNotification('计时结束', '您的计时器已结束')
      alert('计时结束！')
    }
  }, 1000)
}

const toggleTimer = () => {
  if (timerRunning.value) {
    // 暂停
    timerRunning.value = false
    timerPaused.value = true
    if (timerInterval) clearInterval(timerInterval)
  } else {
    // 继续
    timerRunning.value = true
    timerPaused.value = false
    runTimer()
  }
}

const cancelTimer = () => {
  timerRunning.value = false
  timerPaused.value = false
  if (timerInterval) clearInterval(timerInterval)
}
</script>

<style scoped>
/* 样式已迁移到 style.scss */
</style>