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
              <div class="alarm-meta-row">
                <span class="alarm-meta">{{ alarm.label || '闹钟' }} | {{ getRepeatText(alarm) }}</span>
                <span v-if="isAlarmSnoozed(alarm)" class="alarm-snooze-badge">{{ getSnoozeBadgeText(alarm) }}</span>
              </div>
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
          <div class="timer-wheel-picker-container">
            <div class="wheel-column timer-wheel" @wheel.prevent="handleWheel($event, 'timer-hour')"
              @mousedown.prevent="handleMouseDown($event, 'timer-hour')"
              @touchstart="handleTouchStart($event, 'timer-hour')" @touchmove="handleTouchMove($event, 'timer-hour')"
              @touchend="handleTouchEnd('timer-hour')">
              <div class="wheel-list" :style="{ transform: `translateY(${timerHourOffset}px)` }">
                <div v-for="h in timerHourList" :key="`timer-hour-${h}`" class="wheel-item" :class="{ active: h === timerSelectedHour }">
                  {{ h }}
                </div>
              </div>
              <span class="timer-wheel-label">时</span>
            </div>
            <div class="wheel-column timer-wheel" @wheel.prevent="handleWheel($event, 'timer-minute')"
              @mousedown.prevent="handleMouseDown($event, 'timer-minute')"
              @touchstart="handleTouchStart($event, 'timer-minute')" @touchmove="handleTouchMove($event, 'timer-minute')"
              @touchend="handleTouchEnd('timer-minute')">
              <div class="wheel-list" :style="{ transform: `translateY(${timerMinuteOffset}px)` }">
                <div v-for="m in timerMinuteList" :key="`timer-minute-${m}`" class="wheel-item" :class="{ active: m === timerSelectedMinute }">
                  {{ m }}
                </div>
              </div>
              <span class="timer-wheel-label">分</span>
            </div>
            <div class="wheel-column timer-wheel" @wheel.prevent="handleWheel($event, 'timer-second')"
              @mousedown.prevent="handleMouseDown($event, 'timer-second')"
              @touchstart="handleTouchStart($event, 'timer-second')" @touchmove="handleTouchMove($event, 'timer-second')"
              @touchend="handleTouchEnd('timer-second')">
              <div class="wheel-list" :style="{ transform: `translateY(${timerSecondOffset}px)` }">
                <div v-for="s in timerSecondList" :key="`timer-second-${s}`" class="wheel-item" :class="{ active: s === timerSelectedSecond }">
                  {{ s }}
                </div>
              </div>
              <span class="timer-wheel-label">秒</span>
            </div>
            <div class="wheel-highlight timer-wheel-highlight"></div>
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
            @mousedown.prevent="handleMouseDown($event, 'hour')"
            @touchstart="handleTouchStart($event, 'hour')" @touchmove="handleTouchMove($event, 'hour')"
            @touchend="handleTouchEnd('hour')">
            <div class="wheel-list" :style="{ transform: `translateY(${hourOffset}px)` }">
              <div v-for="h in hourList" :key="h" class="wheel-item" :class="{ active: h === selectedHour }">
                {{ h }}
              </div>
            </div>
          </div>
          <div class="wheel-column" @wheel.prevent="handleWheel($event, 'minute')"
            @mousedown.prevent="handleMouseDown($event, 'minute')"
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
          <div class="setting-item" @click="openRepeatModal">
            <span class="setting-label">重复</span>
            <div class="setting-value">
              {{ getRepeatText(form) }}
              <span class="arrow-right">›</span>
            </div>
          </div>
          <div class="setting-item" v-if="form.repeatMode === 'once'" @click="openDatePicker">
            <span class="setting-label">日期</span>
            <div class="setting-value">
              {{ formatSpecificDate(form.specificDate) }}
              <span class="arrow-right">›</span>
            </div>
          </div>
        </div>

        <div class="settings-list">
          <div class="setting-item" @click="openLabelModal">
            <span class="setting-label">闹钟名称</span>
            <div class="setting-value">
              {{ form.label || '闹钟' }}
              <span class="arrow-right">›</span>
            </div>
          </div>
        </div>

        <div class="settings-list">
          <div class="setting-item" @click="openSnoozeModal">
            <span class="setting-label">稍后提示</span>
            <div class="setting-value">
              {{ form.snoozeEnabled ? `${formatSnoozeIntervalLabel(form.snoozeInterval)}, ${form.snoozeCount}次` : '关闭' }}
              <span class="arrow-right">›</span>
            </div>
          </div>
        </div>

        <!-- 删除按钮 -->
        <div class="delete-section" v-if="editingId">
          <button class="btn-delete" @click="isDeleteConfirmActive = true">删除闹钟</button>
        </div>
      </div>

      <!-- 重复选择子页面 -->
      <div class="sub-page" :class="{ active: isRepeatModalActive }">
        <div class="edit-header">
          <button class="btn-cancel" @click="closeRepeatModal">返回</button>
          <span class="edit-title">重复</span>
          <div style="width: 40px;"></div>
        </div>
        <div class="list-container">
          <div v-for="mode in repeatModes" :key="mode.value" class="list-item repeat-mode-item"
            @click="selectRepeatMode(mode.value)">
            <div class="repeat-mode-text">
              <span class="repeat-mode-label">{{ mode.label }}</span>
              <span class="repeat-mode-desc" v-if="mode.desc">{{ mode.desc }}</span>
            </div>
            <span class="radio-check filled" v-if="form.repeatMode === mode.value"></span>
            <span class="radio-check" v-else></span>
          </div>
        </div>

        <!-- 自定义：选择重复日期 -->
        <div v-if="form.repeatMode === 'custom'" class="custom-days-section">
          <div class="section-header">选择重复日期</div>
          <div class="list-container" style="padding-top: 0;">
            <div v-for="day in weekDays" :key="day.value" class="list-item" @click="toggleDay(day.value)">
              <span>{{ day.label }}</span>
              <span class="check-icon" v-if="form.days.includes(day.value)">✓</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 日期选择子页面 -->
      <div class="sub-page" :class="{ active: isDatePickerActive }">
        <div class="edit-header">
          <button class="btn-cancel" @click="closeDatePicker">取消</button>
          <span class="edit-title">选择日期</span>
          <button class="btn-save" @click="confirmDatePicker">确定</button>
        </div>
        <div class="wheel-picker-container">
          <div class="wheel-column date-col"
            @wheel.prevent="handleDateWheel($event, 'year')"
            @touchstart="handleDateTouchStart($event, 'year')"
            @touchmove="handleDateTouchMove($event, 'year')"
            @touchend="handleDateTouchEnd('year')">
            <div class="wheel-list" :style="{ transform: `translateY(${yearOffset}px)` }">
              <div v-for="y in yearList" :key="y" class="wheel-item" :class="{ active: y === selectedYear }">{{ y }}年</div>
            </div>
          </div>
          <div class="wheel-column date-col"
            @wheel.prevent="handleDateWheel($event, 'month')"
            @touchstart="handleDateTouchStart($event, 'month')"
            @touchmove="handleDateTouchMove($event, 'month')"
            @touchend="handleDateTouchEnd('month')">
            <div class="wheel-list" :style="{ transform: `translateY(${monthOffset}px)` }">
              <div v-for="m in monthList" :key="m" class="wheel-item" :class="{ active: m === selectedMonth }">{{ String(m).padStart(2, '0') }}月</div>
            </div>
          </div>
          <div class="wheel-column date-col"
            @wheel.prevent="handleDateWheel($event, 'day')"
            @touchstart="handleDateTouchStart($event, 'day')"
            @touchmove="handleDateTouchMove($event, 'day')"
            @touchend="handleDateTouchEnd('day')">
            <div class="wheel-list" :style="{ transform: `translateY(${dayOffset}px)` }">
              <div v-for="d in dayList" :key="d" class="wheel-item" :class="{ active: d === selectedDay }">{{ String(d).padStart(2, '0') }}日</div>
            </div>
          </div>
          <div class="wheel-highlight"></div>
        </div>
      </div>


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
            <div v-for="option in snoozeIntervalOptions" :key="option.value" class="list-item"
              @click="form.snoozeInterval = option.value">
              <span>{{ option.label }}</span>
              <span class="check-icon" v-if="form.snoozeInterval === option.value">●</span>
              <span class="radio-icon" v-else>○</span>
            </div>
          </div>

          <div class="section-header">提示次数</div>
          <div class="list-container">
            <div v-for="count in snoozeCountOptions" :key="count" class="list-item" @click="form.snoozeCount = count">
              <span>{{ count }} 次</span>
              <span class="check-icon" v-if="form.snoozeCount === count">●</span>
              <span class="radio-icon" v-else>○</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 闹钟名称弹框 -->
    <div v-if="isLabelModalActive" class="dialog-overlay" @click.self="closeLabelModal">
      <div class="dialog-box">
        <div class="dialog-title">闹钟名称</div>
        <div class="dialog-input-wrap">
          <input ref="labelInputRef" type="text" v-model="labelInputTemp" class="dialog-input" placeholder="闹钟" maxlength="20">
          <button v-if="labelInputTemp" class="dialog-input-clear" @click="labelInputTemp = ''">&#x2715;</button>
        </div>
        <button class="dialog-confirm" @click="confirmLabel">确定</button>
        <button class="dialog-cancel-text" @click="closeLabelModal">取消</button>
      </div>
    </div>

    <!-- 删除确认弹框 -->
    <div v-if="isDeleteConfirmActive" class="dialog-overlay" @click.self="isDeleteConfirmActive = false">
      <div class="dialog-box">
        <div class="dialog-title">确定删除此闹钟吗？</div>
        <button class="dialog-confirm danger" @click="confirmDeleteAlarm">删除</button>
        <button class="dialog-cancel-text" @click="isDeleteConfirmActive = false">取消</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue'

// 类型定义
type RepeatMode = 'once' | 'daily' | 'workday' | 'holiday-weekend' | 'single-double' | 'shift' | 'custom'

interface Alarm {
  id: string
  time: string
  label: string
  repeatMode?: RepeatMode
  days: number[]
  specificDate?: string | null
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

const repeatModes: { value: RepeatMode; label: string; desc: string }[] = [
  { value: 'once', label: '仅一次', desc: '' },
  { value: 'daily', label: '每天', desc: '' },
  { value: 'custom', label: '自定义', desc: '' },
]

const snoozeIntervalOptions = [
  { value: 0.5, label: '30 秒' },
  { value: 1, label: '1 分钟' },
  { value: 3, label: '3 分钟' },
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' }
]

const snoozeCountOptions = [1, 2, 3, 5, 10]

// 状态
const currentTab = ref<Tab>('alarm')
const alarms = ref<Alarm[]>([])
const showPermissionBanner = ref(false)
const permissionBannerText = ref('点击开启通知权限')
const isModalActive = ref(false)
const isRepeatModalActive = ref(false)
const isSnoozeModalActive = ref(false)
const isDatePickerActive = ref(false)
const isLabelModalActive = ref(false)
const isDeleteConfirmActive = ref(false)
const labelInputTemp = ref('')
const editingId = ref<string | null>(null)
const nextAlarmTip = ref('')
const currentTick = ref(Date.now())
const snoozeAlarmId = ref<string | null>(null)

// 当前系统通知对应的状态，用于处理 SW 回调与稍后提醒
const activeNotification = ref<{ alarm: Alarm; snoozeRemaining: number } | null>(null)
let snoozeTimeoutId: number | null = null
let snoozeAlarmFireTime: number | null = null  // 稍后提醒的预期触发时间戳

// Service Worker 注册
let swRegistration: ServiceWorkerRegistration | null = null

// 表单数据
const form = reactive({
  time: '',
  label: '',
  repeatMode: 'once' as RepeatMode,
  days: [] as number[],
  specificDate: '',
  snoozeEnabled: true,
  snoozeInterval: 5,
  snoozeCount: 3
})

type PickerType = 'hour' | 'minute' | 'timer-hour' | 'timer-minute' | 'timer-second'

// 滚轮选择器相关
const ITEM_HEIGHT = 50
const VISIBLE_ITEMS = 5
const selectedHour = ref('00')
const selectedMinute = ref('00')
const hourOffset = ref(0)
const minuteOffset = ref(0)
const timerSelectedHour = ref('00')
const timerSelectedMinute = ref('05')
const timerSelectedSecond = ref('00')
const timerHourOffset = ref(0)
const timerMinuteOffset = ref(0)
const timerSecondOffset = ref(0)
let startY = 0
let currentY = 0
let isDragging = false
let draggingType: PickerType | null = null
// 鼠标拖拽相关
let mouseDragType: PickerType | null = null
let mouseDragStartY = 0
let mouseDragStartOffset = 0

// 生成小时和分钟列表 (为了实现无限滚动，前后各加一些)
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))
const hourList = computed(() => [...hours, ...hours, ...hours]) // 3倍长度
const minuteList = computed(() => [...minutes, ...minutes, ...minutes])
const timerHourList = computed(() => [...hours, ...hours, ...hours])
const timerMinuteList = computed(() => [...minutes, ...minutes, ...minutes])
const timerSecondList = computed(() => [...minutes, ...minutes, ...minutes])

// 日期选择器相关
const curYear = new Date().getFullYear()
const yearList = Array.from({ length: 8 }, (_, i) => curYear + i)
const monthList = Array.from({ length: 12 }, (_, i) => i + 1)
const selectedYear = ref(curYear)
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedDay = ref(new Date().getDate())
const yearOffset = ref(0)
const monthOffset = ref(0)
const dayOffset = ref(0)
let dateStartY = 0
let dateCurrentOffset = 0
let dateDragging = false
let dateDraggingType: 'year' | 'month' | 'day' | null = null

const daysInSelectedMonth = computed(() =>
  new Date(selectedYear.value, selectedMonth.value, 0).getDate()
)
const dayList = computed(() =>
  Array.from({ length: daysInSelectedMonth.value }, (_, i) => i + 1)
)

watch([selectedYear, selectedMonth], () => {
  const maxDay = daysInSelectedMonth.value
  if (selectedDay.value > maxDay) {
    selectedDay.value = maxDay
    dayOffset.value = -(maxDay - 1) * ITEM_HEIGHT + ITEM_HEIGHT * 2
  }
})

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
let tipIntervalMs = 0  // 当前刷新频率（ms），0 表示尚未初始化
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
  updateNextAlarmTip()  // 首次调用时会通过 _setTipInterval 自动设置刷新间隔
  startClock()
  initTimerWheel(timerInput.hours, timerInput.minutes, timerInput.seconds)

  // 注册 Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      swRegistration = reg
    }).catch(() => { /* 降级到内嵌通知 */ })

    // 监听 SW 发来的消息
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, alarmId } = event.data || {}
      if (type === 'DISMISS_ALARM') {
        if (activeNotification.value?.alarm.id === alarmId) dismissNotification()
      } else if (type === 'SNOOZE_ALARM') {
        const alarm = alarms.value.find(a => a.id === alarmId)
        if (alarm) triggerSnooze(alarm)
      }
    })
  }

  // 全局鼠标拖拽监听
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

onUnmounted(() => {
  if (checkInterval) clearInterval(checkInterval)
  if (tipInterval) clearInterval(tipInterval)
  if (clockInterval) clearInterval(clockInterval)
  if (stopwatchInterval) clearInterval(stopwatchInterval)
  if (timerInterval) clearInterval(timerInterval)
  if (snoozeTimeoutId) clearTimeout(snoozeTimeoutId)
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
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

const initTimerWheel = (hoursValue: number, minutesValue: number, secondsValue: number) => {
  timerSelectedHour.value = hoursValue.toString().padStart(2, '0')
  timerSelectedMinute.value = minutesValue.toString().padStart(2, '0')
  timerSelectedSecond.value = secondsValue.toString().padStart(2, '0')

  timerHourOffset.value = -(hoursValue + 24) * ITEM_HEIGHT + ITEM_HEIGHT * 2
  timerMinuteOffset.value = -(minutesValue + 60) * ITEM_HEIGHT + ITEM_HEIGHT * 2
  timerSecondOffset.value = -(secondsValue + 60) * ITEM_HEIGHT + ITEM_HEIGHT * 2
}

const getPickerOffset = (type: PickerType) => {
  switch (type) {
    case 'hour': return hourOffset.value
    case 'minute': return minuteOffset.value
    case 'timer-hour': return timerHourOffset.value
    case 'timer-minute': return timerMinuteOffset.value
    case 'timer-second': return timerSecondOffset.value
  }
}

const setPickerOffset = (type: PickerType, value: number) => {
  switch (type) {
    case 'hour':
      hourOffset.value = value
      break
    case 'minute':
      minuteOffset.value = value
      break
    case 'timer-hour':
      timerHourOffset.value = value
      break
    case 'timer-minute':
      timerMinuteOffset.value = value
      break
    case 'timer-second':
      timerSecondOffset.value = value
      break
  }
}

const getPickerItemCount = (type: PickerType) => type.includes('hour') ? 24 : 60

const handleWheel = (e: WheelEvent, type: PickerType) => {
  const delta = e.deltaY > 0 ? -ITEM_HEIGHT : ITEM_HEIGHT
  updateOffset(type, delta)
}

const handleTouchStart = (e: TouchEvent, type: PickerType) => {
  isDragging = true
  draggingType = type
  startY = e.touches[0].clientY
  currentY = getPickerOffset(type)
}

const handleTouchMove = (e: TouchEvent, type: PickerType) => {
  if (!isDragging || draggingType !== type) return
  const deltaY = e.touches[0].clientY - startY
  setPickerOffset(type, currentY + deltaY)
}

const handleTouchEnd = (type: PickerType) => {
  isDragging = false
  draggingType = null
  snapToGrid(type)
}

// 鼠标拖拽处理
const handleMouseDown = (e: MouseEvent, type: PickerType) => {
  mouseDragType = type
  mouseDragStartY = e.clientY
  mouseDragStartOffset = getPickerOffset(type)
}

const handleGlobalMouseMove = (e: MouseEvent) => {
  if (!mouseDragType) return
  const deltaY = e.clientY - mouseDragStartY
  setPickerOffset(mouseDragType, mouseDragStartOffset + deltaY)
}

const handleGlobalMouseUp = () => {
  if (!mouseDragType) return
  snapToGrid(mouseDragType)
  mouseDragType = null
}

const updateOffset = (type: PickerType, delta: number) => {
  setPickerOffset(type, getPickerOffset(type) + delta)
  snapToGrid(type)
}

const snapToGrid = (type: PickerType) => {
  const offset = getPickerOffset(type)
  const itemCount = getPickerItemCount(type)

  let index = Math.round((offset - ITEM_HEIGHT * 2) / -ITEM_HEIGHT)

  // 循环处理
  if (index < itemCount) {
    index += itemCount
  } else if (index >= itemCount * 2) {
    index -= itemCount
  }

  const newOffset = -index * ITEM_HEIGHT + ITEM_HEIGHT * 2

  setPickerOffset(type, newOffset)

  if (type === 'hour') {
    selectedHour.value = hours[index % 24]
  } else if (type === 'minute') {
    selectedMinute.value = minutes[index % 60]
  } else if (type === 'timer-hour') {
    timerSelectedHour.value = hours[index % 24]
  } else if (type === 'timer-minute') {
    timerSelectedMinute.value = minutes[index % 60]
  } else {
    timerSelectedSecond.value = minutes[index % 60]
  }

  if (type === 'hour' || type === 'minute') {
    form.time = `${selectedHour.value}:${selectedMinute.value}`
  } else {
    timerInput.hours = parseInt(timerSelectedHour.value, 10)
    timerInput.minutes = parseInt(timerSelectedMinute.value, 10)
    timerInput.seconds = parseInt(timerSelectedSecond.value, 10)
  }
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

const formatSpecificDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return `${tomorrow.getFullYear()}年${tomorrow.getMonth() + 1}月${tomorrow.getDate()}日`
  }
  const parts = dateStr.split('-').map(Number)
  const target = new Date(parts[0], parts[1] - 1, parts[2])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  target.setHours(0, 0, 0, 0)
  if (target.getTime() === today.getTime()) return '今天'
  if (target.getTime() === tomorrow.getTime()) return '明天'
  return `${parts[0]}年${parts[1]}月${parts[2]}日`
}

const getRepeatText = (obj: { repeatMode?: string; days?: number[]; specificDate?: string | null }) => {
  const mode = obj.repeatMode
  const days = obj.days || []
  if (!mode) {
    // 尚未迁移的旧格式闹钟
    if (days.length === 0) return '仅此一次'
    if (days.length === 7) return '每天'
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '工作日'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末'
    const weekMap: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
    return days.slice().sort().map(d => weekMap[d]).join(' ')
  }
  switch (mode) {
    case 'once': return formatSpecificDate(obj.specificDate)
    case 'daily': return '每天'
    case 'workday': return '法定工作日'
    case 'holiday-weekend': return '节假日及周末'
    case 'single-double': return '单双休工作日'
    case 'shift': return '轮班制工作日'
    case 'custom': {
      if (days.length === 0) return '自定义'
      if (days.length === 7) return '每天'
      if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '工作日'
      if (days.length === 2 && days.includes(0) && days.includes(6)) return '周末'
      const weekMap: Record<number, string> = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
      return days.slice().sort().map(d => weekMap[d]).join(' ')
    }
    default: return '仅一次'
  }
}

const formatSnoozeIntervalLabel = (value: number) => {
  if (value < 1) return `${Math.round(value * 60)}秒`
  if (Number.isInteger(value)) return `${value}分钟`
  return `${value}分钟`
}

const formatRemainingText = (ms: number) => {
  if (ms < 60000) return `${Math.max(1, Math.ceil(ms / 1000))}秒`

  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`
  if (hours > 0) return `${hours}小时`
  return `${totalMinutes}分钟`
}

const isAlarmSnoozed = (alarm: Alarm) => {
  currentTick.value
  return snoozeAlarmId.value === alarm.id && snoozeAlarmFireTime !== null && snoozeAlarmFireTime > currentTick.value
}

const getSnoozeBadgeText = (alarm: Alarm) => {
  if (!isAlarmSnoozed(alarm) || snoozeAlarmFireTime === null) return ''
  return `稍后会提醒 · ${formatRemainingText(snoozeAlarmFireTime - currentTick.value)}后`
}

// 自动调整倒计时刷新频率（近距离显示秒，远距离显示分钟）
const _setTipInterval = (ms: number) => {
  if (tipIntervalMs === ms && tipInterval !== null) return
  tipIntervalMs = ms
  if (tipInterval) clearInterval(tipInterval)
  tipInterval = window.setInterval(updateNextAlarmTip, ms)
}

const updateNextAlarmTip = () => {
  const enabledAlarms = alarms.value.filter(a => a.enabled)
  const now = new Date()
  currentTick.value = now.getTime()
  let minDiff = Infinity

  if (enabledAlarms.length > 0) {
    enabledAlarms.forEach(alarm => {
      const [h, m] = alarm.time.split(':').map(Number)
      const mode = alarm.repeatMode
      const isOneTime = !mode ? (alarm.days.length === 0) : (mode === 'once')

      if (isOneTime) {
        let alarmDate: Date
        if (mode === 'once' && alarm.specificDate) {
          const parts = alarm.specificDate.split('-').map(Number)
          alarmDate = new Date(parts[0], parts[1] - 1, parts[2], h, m, 0, 0)
        } else {
          alarmDate = new Date(now)
          alarmDate.setHours(h, m, 0, 0)
          if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1)
        }
        const diff = alarmDate.getTime() - now.getTime()
        if (diff > 0 && diff < minDiff) minDiff = diff
        return
      }

      // 重复闹钟：找下一个触发日
      let alarmDate = new Date(now)
      alarmDate.setHours(h, m, 0, 0)
      if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1)

      for (let i = 0; i < 7; i++) {
        const d = alarmDate.getDay()
        let valid = false
        const effectiveMode = mode || 'custom'
        switch (effectiveMode) {
          case 'daily': valid = true; break
          case 'workday': case 'single-double': case 'shift':
            valid = d >= 1 && d <= 5; break
          case 'holiday-weekend':
            valid = d === 0 || d === 6; break
          case 'custom':
          default:
            valid = alarm.days.includes(d); break
        }
        if (valid) break
        alarmDate.setDate(alarmDate.getDate() + 1)
      }

      const diff = alarmDate.getTime() - now.getTime()
      if (diff < minDiff) minDiff = diff
    })
  }

  // 纳入稍后提醒的剩余时间
  if (snoozeAlarmFireTime !== null) {
    const snoozeDiff = snoozeAlarmFireTime - now.getTime()
    if (snoozeDiff > 0 && snoozeDiff < minDiff) minDiff = snoozeDiff
  }

  if (minDiff === Infinity) {
    nextAlarmTip.value = ''
    _setTipInterval(60000)
    return
  }

  // 不足 60 秒时精确到秒，并加快刷新频率
  if (minDiff < 60000) {
    const secs = Math.max(1, Math.ceil(minDiff / 1000))
    nextAlarmTip.value = `${secs}秒`
    _setTipInterval(1000)
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
  _setTipInterval(60000)
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
    // 尚未迁移的旧格式自动识别 repeatMode
    if (alarm.repeatMode) {
      form.repeatMode = alarm.repeatMode
    } else {
      const d = alarm.days || []
      if (d.length === 0) form.repeatMode = 'once'
      else if (d.length === 7) form.repeatMode = 'daily'
      else if (d.length === 5 && !d.includes(0) && !d.includes(6)) form.repeatMode = 'workday'
      else form.repeatMode = 'custom'
    }
    form.days = alarm.days ? [...alarm.days] : []
    // 旧的 repeatMode 迁移到3选项
    if (form.repeatMode === 'workday') { form.repeatMode = 'custom'; form.days = [1, 2, 3, 4, 5] }
    else if (form.repeatMode === 'holiday-weekend') { form.repeatMode = 'custom'; form.days = [0, 6] }
    else if (form.repeatMode === 'single-double' || form.repeatMode === 'shift') { form.repeatMode = 'custom'; form.days = [] }
    form.specificDate = alarm.specificDate || ''
    form.snoozeEnabled = alarm.snoozeEnabled !== undefined ? alarm.snoozeEnabled : true
    form.snoozeInterval = alarm.snoozeInterval || 5
    form.snoozeCount = alarm.snoozeCount || 3
  } else {
    editingId.value = null
    const now = new Date()
    timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    form.label = ''
    form.repeatMode = 'once'
    form.days = []
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    form.specificDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
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
  isRepeatModalActive.value = false
  isSnoozeModalActive.value = false
  isDatePickerActive.value = false
}

const openRepeatModal = () => {
  isRepeatModalActive.value = true
}

const closeRepeatModal = () => {
  isRepeatModalActive.value = false
}

const selectRepeatMode = (mode: RepeatMode) => {
  form.repeatMode = mode
  if (mode !== 'custom') form.days = []
  if (mode === 'once' && !form.specificDate) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    form.specificDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  }
}

const openDatePicker = () => {
  initDatePicker(form.specificDate)
  isDatePickerActive.value = true
}

const closeDatePicker = () => {
  isDatePickerActive.value = false
}

const confirmDatePicker = () => {
  const m = String(selectedMonth.value).padStart(2, '0')
  const d = String(selectedDay.value).padStart(2, '0')
  form.specificDate = `${selectedYear.value}-${m}-${d}`
  isDatePickerActive.value = false
}

// 闹钟名称弹框
const labelInputRef = ref<HTMLInputElement | null>(null)

const openLabelModal = () => {
  labelInputTemp.value = form.label
  isLabelModalActive.value = true
  nextTick(() => labelInputRef.value?.focus())
}

const closeLabelModal = () => {
  isLabelModalActive.value = false
}

const confirmLabel = () => {
  form.label = labelInputTemp.value
  isLabelModalActive.value = false
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
    repeatMode: form.repeatMode,
    days: form.repeatMode === 'custom' ? [...form.days] : [],
    specificDate: form.repeatMode === 'once' ? form.specificDate : null,
    enabled: true,
    snoozeEnabled: form.snoozeEnabled,
    snoozeInterval: form.snoozeInterval,
    snoozeCount: form.snoozeCount
  }

  if (editingId.value) {
    const index = alarms.value.findIndex(a => a.id === editingId.value)
    if (index !== -1) {
      alarms.value[index] = {
        ...alarms.value[index],
        ...alarmData,
        lastTriggered: getCurrentMinuteTriggerMark(alarmData)
      }
    }
  } else {
    const newAlarm: Alarm = {
      id: Date.now().toString(),
      ...alarmData,
      lastTriggered: getCurrentMinuteTriggerMark(alarmData)
    }
    alarms.value.push(newAlarm)
  }

  saveToStorage()
  closeModal()
  updateNextAlarmTip()
}

const confirmDeleteAlarm = () => {
  if (editingId.value) {
    alarms.value = alarms.value.filter(a => a.id !== editingId.value)
    saveToStorage()
    isDeleteConfirmActive.value = false
    closeModal()
    updateNextAlarmTip()
  }
}

// 旧名存留备用
const deleteCurrentAlarm = confirmDeleteAlarm

const toggleAlarm = (id: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  const alarm = alarms.value.find(a => a.id === id)
  if (alarm) {
    if (snoozeAlarmId.value === alarm.id) {
      if (snoozeTimeoutId) {
        clearTimeout(snoozeTimeoutId)
        snoozeTimeoutId = null
      }
      if (activeNotification.value?.alarm.id === alarm.id) {
        activeNotification.value = null
      }
      snoozeAlarmFireTime = null
      snoozeAlarmId.value = null
    }

    alarm.enabled = checked
    alarm.lastTriggered = checked ? getCurrentMinuteTriggerMark(alarm) : null
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

const getCurrentMinuteInfo = () => {
  const now = new Date()
  const currentDay = now.getDay()
  const currentTimeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const currentFullTime = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${currentTimeStr}`
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { currentDay, currentTimeStr, currentFullTime, currentDateStr }
}

const getCurrentMinuteTriggerMark = (alarm: Pick<Alarm, 'time' | 'repeatMode' | 'days' | 'specificDate'>) => {
  const { currentDay, currentTimeStr, currentFullTime, currentDateStr } = getCurrentMinuteInfo()

  if (alarm.time !== currentTimeStr) return null

  const mode = alarm.repeatMode
  let shouldMark = false

  if (!mode) {
    shouldMark = alarm.days.length === 0 || alarm.days.includes(currentDay)
  } else {
    switch (mode) {
      case 'once':
        shouldMark = !alarm.specificDate || alarm.specificDate === currentDateStr
        break
      case 'daily':
        shouldMark = true
        break
      case 'workday': case 'single-double': case 'shift':
        shouldMark = currentDay >= 1 && currentDay <= 5
        break
      case 'holiday-weekend':
        shouldMark = currentDay === 0 || currentDay === 6
        break
      case 'custom':
        shouldMark = alarm.days.includes(currentDay)
        break
    }
  }

  return shouldMark ? currentFullTime : null
}

const startAlarmChecker = () => {
  checkInterval = window.setInterval(() => {
    const { currentDay, currentTimeStr, currentFullTime, currentDateStr } = getCurrentMinuteInfo()

    alarms.value.forEach(alarm => {
      if (!alarm.enabled) return
      if (alarm.time !== currentTimeStr) return
      if (alarm.lastTriggered === currentFullTime) return

      const mode = alarm.repeatMode
      let shouldTrigger = false

      if (!mode) {
        // 旧格式山容
        shouldTrigger = alarm.days.length === 0 || alarm.days.includes(currentDay)
      } else {
        switch (mode) {
          case 'once':
            shouldTrigger = !alarm.specificDate || alarm.specificDate === currentDateStr
            break
          case 'daily':
            shouldTrigger = true
            break
          case 'workday': case 'single-double': case 'shift':
            shouldTrigger = currentDay >= 1 && currentDay <= 5
            break
          case 'holiday-weekend':
            shouldTrigger = currentDay === 0 || currentDay === 6
            break
          case 'custom':
            shouldTrigger = alarm.days.includes(currentDay)
            break
        }
      }

      if (shouldTrigger) triggerAlarm(alarm, currentFullTime)
    })
  }, 1000)
}

const triggerAlarm = (alarm: Alarm, triggerTime: string) => {
  alarm.lastTriggered = triggerTime

  // 用带操作按钮的系统通知（经 SW）
  sendSwNotification(alarm)

  // 仅一次模式：触发后自动禁用
  const isOneTime = !alarm.repeatMode ? (alarm.days.length === 0) : (alarm.repeatMode === 'once')
  if (isOneTime) alarm.enabled = false

  saveToStorage()
  updateNextAlarmTip()
}

const sendSwNotification = (alarm: Alarm, snoozeRemaining?: number) => {
  const remaining = snoozeRemaining !== undefined
    ? snoozeRemaining
    : (alarm.snoozeEnabled ? alarm.snoozeCount : 0)

  const title = alarm.label || '闹钟响了'
  const body = `时间到了：${alarm.time}`
  const options: any = {
    body,
    icon: 'https://cdn-icons-png.flaticon.com/512/899/899054.png',
    requireInteraction: true,
    data: { alarmId: alarm.id },
    actions: [
      { action: 'dismiss', title: '知道啦' },
      ...(remaining > 0 ? [{ action: 'snooze', title: `稍后提醒（还可${remaining}次）` }] : [])
    ]
  }

  if (swRegistration && Notification.permission === 'granted') {
    swRegistration.showNotification(title, options)
  } else if (Notification.permission === 'granted') {
    // 降级：普通 Notification（无操作按钮）
    new Notification(title, { body, icon: options.icon, requireInteraction: true })
  }
  activeNotification.value = { alarm, snoozeRemaining: remaining }
}

const dismissNotification = () => {
  activeNotification.value = null
  if (snoozeTimeoutId) { clearTimeout(snoozeTimeoutId); snoozeTimeoutId = null }
  snoozeAlarmFireTime = null
  snoozeAlarmId.value = null
  updateNextAlarmTip()
}

// 供 SW 消息回调 & 页内按钮共用
const triggerSnooze = (alarm: Alarm) => {
  if (!activeNotification.value) return
  const remaining = activeNotification.value.snoozeRemaining - 1
  activeNotification.value = null
  if (snoozeTimeoutId) clearTimeout(snoozeTimeoutId)
  const delayMs = alarm.snoozeInterval * 60 * 1000
  snoozeAlarmId.value = alarm.id
  snoozeAlarmFireTime = Date.now() + delayMs
  snoozeTimeoutId = window.setTimeout(() => {
    sendSwNotification(alarm, remaining)
    snoozeTimeoutId = null
    snoozeAlarmFireTime = null
    snoozeAlarmId.value = null
  }, delayMs)
  updateNextAlarmTip()  // 立即更新倒计时为稍后提醒的剩余时间
}

// --- 日期选择器逻辑 ---
const initDatePicker = (dateStr: string | null | undefined) => {
  let d: Date
  if (dateStr) {
    const parts = dateStr.split('-').map(Number)
    d = new Date(parts[0], parts[1] - 1, parts[2])
  } else {
    d = new Date()
    d.setDate(d.getDate() + 1)
  }
  selectedYear.value = d.getFullYear()
  selectedMonth.value = d.getMonth() + 1
  selectedDay.value = d.getDate()

  const yearIndex = yearList.findIndex(y => y === selectedYear.value)
  yearOffset.value = -(Math.max(0, yearIndex)) * ITEM_HEIGHT + ITEM_HEIGHT * 2
  monthOffset.value = -(selectedMonth.value - 1) * ITEM_HEIGHT + ITEM_HEIGHT * 2
  dayOffset.value = -(selectedDay.value - 1) * ITEM_HEIGHT + ITEM_HEIGHT * 2
}

const handleDateWheel = (e: WheelEvent, type: 'year' | 'month' | 'day') => {
  const delta = e.deltaY > 0 ? -ITEM_HEIGHT : ITEM_HEIGHT
  updateDateOffset(type, delta)
}

const handleDateTouchStart = (e: TouchEvent, type: 'year' | 'month' | 'day') => {
  dateDragging = true
  dateDraggingType = type
  dateStartY = e.touches[0].clientY
  if (type === 'year') dateCurrentOffset = yearOffset.value
  else if (type === 'month') dateCurrentOffset = monthOffset.value
  else dateCurrentOffset = dayOffset.value
}

const handleDateTouchMove = (e: TouchEvent, type: 'year' | 'month' | 'day') => {
  if (!dateDragging || dateDraggingType !== type) return
  const deltaY = e.touches[0].clientY - dateStartY
  if (type === 'year') yearOffset.value = dateCurrentOffset + deltaY
  else if (type === 'month') monthOffset.value = dateCurrentOffset + deltaY
  else dayOffset.value = dateCurrentOffset + deltaY
}

const handleDateTouchEnd = (type: 'year' | 'month' | 'day') => {
  dateDragging = false
  dateDraggingType = null
  snapDateToGrid(type)
}

const updateDateOffset = (type: 'year' | 'month' | 'day', delta: number) => {
  if (type === 'year') yearOffset.value += delta
  else if (type === 'month') monthOffset.value += delta
  else dayOffset.value += delta
  snapDateToGrid(type)
}

const snapDateToGrid = (type: 'year' | 'month' | 'day') => {
  if (type === 'year') {
    let index = Math.round((yearOffset.value - ITEM_HEIGHT * 2) / -ITEM_HEIGHT)
    index = Math.max(0, Math.min(yearList.length - 1, index))
    yearOffset.value = -index * ITEM_HEIGHT + ITEM_HEIGHT * 2
    selectedYear.value = yearList[index]
  } else if (type === 'month') {
    let index = Math.round((monthOffset.value - ITEM_HEIGHT * 2) / -ITEM_HEIGHT)
    index = Math.max(0, Math.min(monthList.length - 1, index))
    monthOffset.value = -index * ITEM_HEIGHT + ITEM_HEIGHT * 2
    selectedMonth.value = monthList[index]
  } else {
    const maxDay = daysInSelectedMonth.value
    let index = Math.round((dayOffset.value - ITEM_HEIGHT * 2) / -ITEM_HEIGHT)
    index = Math.max(0, Math.min(maxDay - 1, index))
    dayOffset.value = -index * ITEM_HEIGHT + ITEM_HEIGHT * 2
    selectedDay.value = index + 1
  }
}


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
  timerInput.hours = Math.floor(seconds / 3600)
  timerInput.minutes = Math.floor((seconds % 3600) / 60)
  timerInput.seconds = seconds % 60
  initTimerWheel(timerInput.hours, timerInput.minutes, timerInput.seconds)
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
      if (Notification.permission === 'granted') {
        if (swRegistration) swRegistration.showNotification('计时结束', { body: '您的计时器已结束', requireInteraction: false })
        else new Notification('计时结束', { body: '您的计时器已结束' })
      }
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