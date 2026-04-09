<template>
  <div class="rhythm-pad-app">
    <header class="page-actions">
      <button class="traffic-light close" type="button" aria-label="刷新页面" @click="reloadPage"></button>
      <button class="traffic-light minimize" type="button" aria-label="打开 GitHub" @click="openGithub"></button>
      <button class="traffic-light maximize" type="button" aria-label="打开 GitHub" @click="openGithub"></button>
    </header>

    <main class="stage-shell">
      <section class="pad-frame" aria-label="Rhythm Pads">
        <button
          v-for="pad in pads"
          :key="pad.id"
          type="button"
          class="pad-tile"
          :class="{
            active: activePadId === pad.id,
            hovered: hoveredPadId === pad.id
          }"
          @mouseenter="hoveredPadId = pad.id"
          @mouseleave="clearHover(pad.id)"
          @focus="hoveredPadId = pad.id"
          @blur="clearHover(pad.id)"
          @click="triggerPad(pad.id)"
        >
          <span class="pad-index">{{ String(pad.index).padStart(2, '0') }}</span>
          <strong>{{ pad.id }}</strong>
        </button>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'

type PadInfo = {
  id: string
  index: number
  audioSrc: string
}

const GITHUB_URL = 'https://github.com/koakuuma/webui-scripts'
const PAD_TRIGGER_LIMIT = 4
const PAD_TRIGGER_WINDOW = 1000
const ACTIVE_FLASH_MS = 180

const pads = Array.from({ length: 16 }, (_, index) => {
  const padNumber = index + 1
  return {
    id: `PAD${padNumber}`,
    index: padNumber,
    audioSrc: `${import.meta.env.BASE_URL}audio/pad/${padNumber}.mp3`
  } satisfies PadInfo
})

const hoveredPadId = ref('')
const activePadId = ref('')
const playHistory = reactive<Record<string, number[]>>({})
const audioMap = new Map<string, HTMLAudioElement>()
const activeTimerMap = new Map<string, number>()

pads.forEach((pad) => {
  playHistory[pad.id] = []
  const audio = new Audio(pad.audioSrc)
  audio.preload = 'auto'
  audioMap.set(pad.id, audio)
})

const reloadPage = () => {
  window.location.reload()
}

const openGithub = () => {
  window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
}

const clearHover = (padId: string) => {
  if (hoveredPadId.value === padId) {
    hoveredPadId.value = ''
  }
}

const flashPad = (padId: string) => {
  activePadId.value = padId

  const existingTimer = activeTimerMap.get(padId)
  if (existingTimer) {
    window.clearTimeout(existingTimer)
  }

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
  if (!sourceAudio) return

  const audio = sourceAudio.cloneNode() as HTMLAudioElement
  audio.currentTime = 0
  void audio.play().catch(() => undefined)
}

const triggerPad = (padId: string) => {
  if (!canPlayPad(padId)) return

  playHistory[padId].push(Date.now())
  hoveredPadId.value = padId
  flashPad(padId)
  playPadAudio(padId)
}
</script>

<style scoped lang="scss">
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

:global(*) {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

:global(body) {
  background: #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}

button {
  font: inherit;
  user-select: none;
  -webkit-user-select: none;
}

.rhythm-pad-app {
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.page-actions {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.traffic-light {
  width: 12px;
  height: 12px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  appearance: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.close {
  background: #ff5f57;
}

.minimize {
  background: #febc2e;
}

.maximize {
  background: #28c840;
}

.stage-shell {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.pad-frame {
  width: min(calc(100vw - 24px), calc(100dvh - 52px));
  height: min(calc(100vw - 24px), calc(100dvh - 52px));
  max-width: 920px;
  max-height: 920px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding: 14px;
  border: 1px solid #d2d2d7;
  border-radius: 22px;
  overflow: hidden;
  background: #f5f5f7;
}

.pad-tile {
  min-width: 0;
  min-height: 0;
  border: 1px solid #d2d2d7;
  border-radius: 20px;
  background: #fbfbfd;
  color: #1d1d1f;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(12px, 2vw, 18px);
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.14s ease, color 0.14s ease, border-color 0.14s ease,
    transform 0.14s ease;
}

.pad-index {
  font-size: clamp(12px, 1.5vw, 14px);
  color: #86868b;
  line-height: 1;
}

.pad-tile strong {
  font-size: clamp(20px, 3vw, 30px);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.pad-tile.hovered {
  background: #f0f0f2;
}

.pad-tile.active {
  background: #1d1d1f;
  color: #f5f5f7;
  border-color: #1d1d1f;
}

.pad-tile.active .pad-index {
  color: #d2d2d7;
}

@media (max-width: 640px) {
  .rhythm-pad-app {
    padding: 10px;
  }

  .page-actions {
    height: 24px;
    gap: 7px;
  }

  .pad-frame {
    width: min(calc(100vw - 20px), calc(100dvh - 44px));
    height: min(calc(100vw - 20px), calc(100dvh - 44px));
    gap: 10px;
    padding: 10px;
    border-radius: 16px;
  }

  .pad-tile {
    border-radius: 16px;
  }
}
</style>
