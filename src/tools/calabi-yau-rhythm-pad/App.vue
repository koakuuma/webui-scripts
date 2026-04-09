<template>
  <div class="rhythm-pad-app" :class="{ started: hasStarted }">
    <div v-if="!hasStarted" class="landing-screen">
      <section class="hero-card">
        <p class="eyebrow">CalabiYau Rhythm Pad</p>
        <h1>卡拉彼丘节奏打击垫</h1>
        <p class="subtitle">
          从原始 HTML Demo 迁移而来，改为 Vue 重写版本，保留 16 宫格音垫与 FPS 风格准心交互，去掉 Three.js 依赖，改成更轻量的 2D 科技面板。
        </p>

        <div class="control-panel">
          <label class="slider-field">
            <span>鼠标灵敏度</span>
            <input v-model="sensitivity" type="range" min="0.4" max="2.4" step="0.1" />
            <strong>{{ sensitivity.toFixed(1) }}x</strong>
          </label>

          <button class="start-button" type="button" @click="startExperience">
            点击开始
          </button>
        </div>

        <ul class="feature-list">
          <li>中心准心跟随鼠标，在面板中移动时自动高亮当前音垫</li>
          <li>左键点击或键盘触发，单个音垫限制为每秒最多 4 次</li>
          <li>支持 16 个独立音效，资源已迁移到当前工具目录</li>
          <li>增加键盘模式，默认支持数字键与字母键双映射</li>
        </ul>
      </section>
    </div>

    <div v-else class="experience-screen">
      <header class="top-bar">
        <div>
          <p class="eyebrow">沉浸练习模式</p>
          <h2>CalabiYau Rhythm Pad</h2>
        </div>

        <div class="toolbar">
          <label class="slider-field compact">
            <span>灵敏度</span>
            <input v-model="sensitivity" type="range" min="0.4" max="2.4" step="0.1" />
            <strong>{{ sensitivity.toFixed(1) }}x</strong>
          </label>
          <button class="ghost-button" type="button" @click="resetCrosshair">
            准心归中
          </button>
          <button class="ghost-button" type="button" @click="stopExperience">
            退出
          </button>
        </div>
      </header>

      <section class="status-row">
        <div class="status-card status-ok">
          <span class="status-label">状态</span>
          <strong>{{ statusText }}</strong>
        </div>
        <div class="status-card">
          <span class="status-label">当前悬停</span>
          <strong>{{ hoveredPadId || '无' }}</strong>
        </div>
        <div class="status-card">
          <span class="status-label">最近触发</span>
          <strong>{{ lastPlayedPadId || '无' }}</strong>
        </div>
      </section>

      <section
        ref="arenaRef"
        class="pad-arena"
        @mousemove="handleArenaMouseMove"
        @mouseleave="handleArenaMouseLeave"
        @click="handleArenaClick"
      >
        <div class="arena-grid">
          <button
            v-for="pad in pads"
            :key="pad.id"
            type="button"
            class="pad-tile"
            :class="{
              hovered: hoveredPadId === pad.id,
              active: activePadId === pad.id
            }"
            @mouseenter="hoveredPadId = pad.id"
            @focus="hoveredPadId = pad.id"
            @click.stop="triggerPad(pad.id)"
          >
            <span class="pad-index">{{ pad.index }}</span>
            <strong>{{ pad.id }}</strong>
            <small>{{ pad.keyHint }}</small>
          </button>
        </div>

        <div class="crosshair" :style="crosshairStyle">
          <span></span>
          <span></span>
        </div>
      </section>

      <section class="tips-panel">
        <article>
          <h3>操作说明</h3>
          <ul>
            <li>移动鼠标可在练习面板中移动准心，当前音垫会自动高亮</li>
            <li>点击鼠标左键可触发当前高亮音垫</li>
            <li>键盘映射：1-8、Q-I、A-K 三排共 16 个键位</li>
            <li>按 <kbd>R</kbd> 重置准心，按 <kbd>Esc</kbd> 或点击退出按钮结束体验</li>
          </ul>
        </article>
        <article>
          <h3>改进说明</h3>
          <ul>
            <li>由原始单页 HTML 改为 Vue 组件化结构</li>
            <li>移除远程音频地址，改为本地静态资源</li>
            <li>保留频率限制和视觉反馈，并增加键盘直达触发</li>
            <li>更适合作为当前工具箱内的独立项目长期维护</li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

type PadInfo = {
  id: string
  index: number
  audioSrc: string
  keyHint: string
}

const PAD_TRIGGER_LIMIT = 4
const PAD_TRIGGER_WINDOW = 1000
const ACTIVE_FLASH_MS = 180

const keySequence = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'U', 'I', 'J', 'K']

const pads = Array.from({ length: 16 }, (_, index) => {
  const padNumber = index + 1
  return {
    id: `PAD${padNumber}`,
    index: padNumber,
    audioSrc: `${import.meta.env.BASE_URL}audio/pad/${padNumber}.mp3`,
    keyHint: keySequence[index]
  } satisfies PadInfo
})

const keyToPadId = pads.reduce<Record<string, string>>((mapping, pad) => {
  mapping[pad.keyHint.toLowerCase()] = pad.id
  return mapping
}, {})

const arenaRef = ref<HTMLElement | null>(null)
const hasStarted = ref(false)
const sensitivity = ref(1)
const statusText = ref('等待开始')
const hoveredPadId = ref('')
const activePadId = ref('')
const lastPlayedPadId = ref('')
const crosshairPosition = reactive({ x: 50, y: 50 })

const playHistory = reactive<Record<string, number[]>>({})
const audioMap = new Map<string, HTMLAudioElement>()
const activeTimerMap = new Map<string, number>()

pads.forEach((pad) => {
  playHistory[pad.id] = []
})

const crosshairStyle = computed(() => ({
  left: `${crosshairPosition.x}%`,
  top: `${crosshairPosition.y}%`
}))

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const updateStatus = (message: string) => {
  statusText.value = message
}

const preloadAudio = () => {
  pads.forEach((pad) => {
    if (!audioMap.has(pad.id)) {
      const audio = new Audio(pad.audioSrc)
      audio.preload = 'auto'
      audioMap.set(pad.id, audio)
    }
  })
}

const resetCrosshair = () => {
  crosshairPosition.x = 50
  crosshairPosition.y = 50
  updateHoveredPadByCrosshair()
}

const updateHoveredPadByCrosshair = () => {
  if (!arenaRef.value) return

  const buttons = Array.from(arenaRef.value.querySelectorAll<HTMLButtonElement>('.pad-tile'))
  const arenaRect = arenaRef.value.getBoundingClientRect()
  const pointX = arenaRect.left + (crosshairPosition.x / 100) * arenaRect.width
  const pointY = arenaRect.top + (crosshairPosition.y / 100) * arenaRect.height

  const matchedButton = buttons.find((button) => {
    const rect = button.getBoundingClientRect()
    return pointX >= rect.left && pointX <= rect.right && pointY >= rect.top && pointY <= rect.bottom
  })

  hoveredPadId.value = matchedButton?.dataset.padId || ''
}

const flashPad = (padId: string) => {
  activePadId.value = padId

  const existingTimer = activeTimerMap.get(padId)
  if (existingTimer) window.clearTimeout(existingTimer)

  const timer = window.setTimeout(() => {
    if (activePadId.value === padId) {
      activePadId.value = ''
    }
    activeTimerMap.delete(padId)
  }, ACTIVE_FLASH_MS)

  activeTimerMap.set(padId, timer)
}

const canPlayPad = (padId: string) => {
  const now = Date.now()
  playHistory[padId] = playHistory[padId].filter((timestamp) => now - timestamp < PAD_TRIGGER_WINDOW)
  return playHistory[padId].length < PAD_TRIGGER_LIMIT
}

const playPadAudio = (padId: string) => {
  const sourceAudio = audioMap.get(padId)
  if (!sourceAudio) {
    updateStatus(`${padId} 音频未就绪`)
    return
  }

  const audio = sourceAudio.cloneNode() as HTMLAudioElement
  audio.currentTime = 0
  void audio.play().catch(() => {
    updateStatus(`${padId} 播放失败，请重试`)
  })
}

const triggerPad = (padId: string) => {
  if (!hasStarted.value) return

  if (!canPlayPad(padId)) {
    updateStatus(`${padId} 播放过于频繁，请稍候`)
    return
  }

  playHistory[padId].push(Date.now())
  lastPlayedPadId.value = padId
  hoveredPadId.value = padId
  updateStatus(`${padId} 已触发`)
  flashPad(padId)
  playPadAudio(padId)
}

const handleArenaMouseMove = (event: MouseEvent) => {
  if (!arenaRef.value) return

  const rect = arenaRef.value.getBoundingClientRect()
  const deltaX = (event.movementX / rect.width) * 100 * sensitivity.value
  const deltaY = (event.movementY / rect.height) * 100 * sensitivity.value

  crosshairPosition.x = clamp(crosshairPosition.x + deltaX, 4, 96)
  crosshairPosition.y = clamp(crosshairPosition.y + deltaY, 4, 96)
  updateHoveredPadByCrosshair()
}

const handleArenaMouseLeave = () => {
  hoveredPadId.value = ''
}

const handleArenaClick = () => {
  if (hoveredPadId.value) {
    triggerPad(hoveredPadId.value)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!hasStarted.value) return

  if (event.key === 'Escape') {
    stopExperience()
    return
  }

  if (event.key.toLowerCase() === 'r') {
    resetCrosshair()
    updateStatus('准心已归中')
    return
  }

  const matchedPadId = keyToPadId[event.key.toLowerCase()]
  if (matchedPadId) {
    event.preventDefault()
    triggerPad(matchedPadId)
  }
}

const startExperience = async () => {
  preloadAudio()
  hasStarted.value = true
  resetCrosshair()
  updateStatus('已进入练习模式')

  const firstAudio = audioMap.get('PAD1')
  if (firstAudio) {
    try {
      firstAudio.muted = true
      await firstAudio.play()
      firstAudio.pause()
      firstAudio.currentTime = 0
      firstAudio.muted = false
    } catch {
      firstAudio.muted = false
    }
  }
}

const stopExperience = () => {
  hasStarted.value = false
  hoveredPadId.value = ''
  activePadId.value = ''
  updateStatus('已退出练习模式')
}

onMounted(() => {
  preloadAudio()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)

  activeTimerMap.forEach((timer) => {
    window.clearTimeout(timer)
  })
})
</script>

<style scoped lang="scss">
:global(body) {
  margin: 0;
  background:
    radial-gradient(circle at top, rgba(69, 120, 255, 0.18), transparent 35%),
    linear-gradient(180deg, #060816 0%, #03040b 100%);
  color: #edf2f7;
  font-family: Inter, 'Microsoft YaHei', sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

button,
input {
  font: inherit;
}

.rhythm-pad-app {
  min-height: 100vh;
  padding: 24px;
}

.landing-screen,
.experience-screen {
  width: min(1200px, 100%);
  margin: 0 auto;
}

.hero-card,
.top-bar,
.status-card,
.pad-arena,
.tips-panel article {
  backdrop-filter: blur(20px);
  background: rgba(11, 18, 36, 0.72);
  border: 1px solid rgba(124, 145, 255, 0.18);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.hero-card {
  padding: 36px;
  border-radius: 28px;
  margin-top: 6vh;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 13px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #7dd3fc;
}

h1,
h2,
h3,
p,
ul {
  margin-top: 0;
}

h1 {
  margin-bottom: 16px;
  font-size: clamp(32px, 5vw, 56px);
  line-height: 1.05;
}

h2 {
  margin-bottom: 0;
  font-size: 28px;
}

.subtitle {
  max-width: 820px;
  margin-bottom: 28px;
  color: #bfdbfe;
  font-size: 16px;
  line-height: 1.8;
}

.control-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  margin-bottom: 28px;
}

.slider-field {
  min-width: 260px;
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(148, 163, 184, 0.08);
}

.slider-field span {
  color: #cbd5e1;
  font-size: 14px;
}

.slider-field strong {
  color: #fef08a;
}

.slider-field input {
  width: 100%;
}

.start-button,
.ghost-button {
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.start-button {
  padding: 16px 26px;
  border-radius: 18px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  font-weight: 700;
  box-shadow: 0 16px 32px rgba(59, 130, 246, 0.3);
}

.start-button:hover,
.ghost-button:hover,
.pad-tile:hover {
  transform: translateY(-2px);
}

.feature-list,
.tips-panel ul {
  padding-left: 18px;
  line-height: 1.8;
  color: #cbd5e1;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 22px 24px;
  border-radius: 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: end;
}

.compact {
  min-width: 220px;
  padding: 12px 14px;
}

.ghost-button {
  padding: 12px 18px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}

.status-row {
  margin-top: 18px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.status-card {
  padding: 18px 20px;
  border-radius: 20px;
}

.status-card strong {
  font-size: 18px;
}

.status-ok {
  border-color: rgba(74, 222, 128, 0.3);
}

.status-label {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  color: #94a3b8;
}

.pad-arena {
  position: relative;
  margin-top: 18px;
  padding: 28px;
  border-radius: 28px;
  min-height: 560px;
  overflow: hidden;
}

.pad-arena::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
}

.arena-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  height: 100%;
}

.pad-tile {
  min-height: 112px;
  border-radius: 22px;
  border: 1px solid rgba(96, 165, 250, 0.26);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.22), rgba(15, 23, 42, 0.95));
  color: #eff6ff;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px;
  text-align: left;
  position: relative;
  z-index: 1;
}

.pad-tile.hovered {
  border-color: rgba(125, 211, 252, 0.9);
  box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.2), 0 12px 30px rgba(14, 165, 233, 0.18);
}

.pad-tile.active {
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.45), rgba(22, 101, 52, 0.92));
  border-color: rgba(134, 239, 172, 0.9);
  box-shadow: 0 0 28px rgba(74, 222, 128, 0.28);
}

.pad-index {
  font-size: 12px;
  color: #93c5fd;
}

.pad-tile strong {
  font-size: 24px;
}

.pad-tile small {
  color: #cbd5e1;
}

.crosshair {
  position: absolute;
  z-index: 2;
  width: 26px;
  height: 26px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.crosshair span {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.45);
}

.crosshair span:first-child {
  left: 50%;
  top: 0;
  width: 2px;
  height: 100%;
  transform: translateX(-50%);
}

.crosshair span:last-child {
  top: 50%;
  left: 0;
  width: 100%;
  height: 2px;
  transform: translateY(-50%);
}

.tips-panel {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.tips-panel article {
  padding: 22px;
  border-radius: 24px;
}

kbd {
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.25);
}

@media (max-width: 960px) {
  .status-row,
  .tips-panel,
  .arena-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .rhythm-pad-app {
    padding: 14px;
  }

  .hero-card,
  .top-bar,
  .pad-arena,
  .tips-panel article {
    border-radius: 20px;
  }

  .top-bar,
  .status-row,
  .tips-panel,
  .arena-grid {
    grid-template-columns: 1fr;
  }

  .top-bar {
    align-items: stretch;
  }

  .toolbar {
    justify-content: stretch;
  }
}
</style>
