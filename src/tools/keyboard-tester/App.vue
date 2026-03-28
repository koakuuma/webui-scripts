<template>
  <main class="keyboard-tester">
    <div class="page-controls">
      <button class="traffic-light is-red" type="button" aria-label="刷新页面" title="刷新页面" @click="reloadPage"></button>
      <button class="traffic-light is-yellow" type="button" aria-label="刷新页面" title="刷新页面" @click="reloadPage"></button>
      <button
        class="traffic-light is-green"
        type="button"
        aria-label="打开 GitHub"
        title="打开 GitHub"
        @click="openGithub"
      ></button>
    </div>

    <section ref="viewportRef" class="keyboard-viewport" tabindex="-1" @pointerdown="focusViewport">
      <div class="keyboard-shell-frame">
        <div class="keyboard-scale" :style="scaleStyle">
          <div ref="deckRef" class="keyboard-deck">
            <div class="keyboard-grid">
              <div class="function-main">
                <template v-for="(item, itemIndex) in functionMainRow" :key="`fn-main-${itemIndex}`">
                  <div
                    v-if="item.type === 'spacer'"
                    class="row-spacer"
                    :style="getSpacerStyle(item.width)"
                    aria-hidden="true"
                  ></div>
                  <div
                    v-else
                    class="keycap"
                    :class="getKeyClasses(item.code, item.align, item.label, item.width)"
                    :style="getKeyStyle(item.width)"
                  >
                    <div class="keycap-content">
                      <span v-if="item.secondaryLabel" class="keycap-secondary">{{ item.secondaryLabel }}</span>
                      <span class="keycap-label">{{ item.label }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <div class="nav-top-block">
                <div
                  v-for="item in navTopRow"
                  :key="item.code"
                  class="keycap"
                  :class="getKeyClasses(item.code, item.align, item.label, item.width)"
                  :style="getKeyStyle(item.width)"
                >
                  <div class="keycap-content">
                    <span v-if="item.secondaryLabel" class="keycap-secondary">{{ item.secondaryLabel }}</span>
                    <span class="keycap-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>

              <div class="alpha-block">
                <div v-for="(row, rowIndex) in alphaRows" :key="`alpha-${rowIndex}`" class="alpha-row">
                  <template v-for="(item, itemIndex) in row" :key="`alpha-${rowIndex}-${itemIndex}`">
                    <div
                      v-if="item.type === 'spacer'"
                      class="row-spacer"
                      :style="getSpacerStyle(item.width)"
                      aria-hidden="true"
                    ></div>
                    <div
                      v-else
                      class="keycap"
                      :class="getKeyClasses(item.code, item.align, item.label, item.width)"
                      :style="getKeyStyle(item.width)"
                    >
                      <div class="keycap-content">
                        <span v-if="item.secondaryLabel" class="keycap-secondary">{{ item.secondaryLabel }}</span>
                        <span class="keycap-label">{{ item.label }}</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div class="nav-block">
                <div
                  v-for="item in navKeys"
                  :key="item.code"
                  class="keycap grid-key"
                  :class="getKeyClasses(item.code, item.align, item.label, item.width)"
                  :style="getGridKeyStyle(item)"
                >
                  <div class="keycap-content">
                    <span v-if="item.secondaryLabel" class="keycap-secondary">{{ item.secondaryLabel }}</span>
                    <span class="keycap-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>

              <div class="numpad-block">
                <div
                  v-for="item in numpadKeys"
                  :key="item.code"
                  class="keycap grid-key"
                  :class="getKeyClasses(item.code, item.align, item.label, item.width)"
                  :style="getGridKeyStyle(item)"
                >
                  <div class="keycap-content">
                    <span v-if="item.secondaryLabel" class="keycap-secondary">{{ item.secondaryLabel }}</span>
                    <span class="keycap-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  allKeys,
  alphaRows,
  functionRow,
  navKeys,
  numpadKeys,
  type GridKey,
  type RowItem,
  type RowKey
} from './keyboard-layout'

type KeyRuntime = {
  pressed: boolean
  tested: boolean
}

type LongPressAction = 'reload' | 'browser-reload' | 'browser-fullscreen' | 'browser-devtools'

const viewportRef = ref<HTMLElement | null>(null)
const deckRef = ref<HTMLElement | null>(null)
const scale = ref(1)

const keyStates = reactive<Record<string, KeyRuntime>>(
  Object.fromEntries(
    allKeys.map((key) => [
      key.code,
      {
        pressed: false,
        tested: false
      }
    ])
  )
)

const functionMainRow: RowItem[] = functionRow.slice(0, -4)
const navTopRow: RowKey[] = functionRow.slice(-3).filter((item): item is RowKey => item.type === 'key')

const scaleStyle = computed(() => ({
  transform: `scale(${scale.value})`
}))

let resizeObserver: ResizeObserver | null = null
let rafId = 0
const longPressTimers = new Map<string, number>()
const longPressTriggered = new Set<string>()
const longPressDelay = 3000
const githubUrl = 'https://github.com/koakuuma/webui-scripts'
const longPressActions: Partial<Record<string, LongPressAction>> = {
  Escape: 'reload',
  Space: 'reload',
  Enter: 'reload',
  NumpadEnter: 'reload',
  F5: 'browser-reload',
  F11: 'browser-fullscreen',
  F12: 'browser-devtools'
}

const scheduleScaleUpdate = () => {
  if (rafId) {
    cancelAnimationFrame(rafId)
  }

  rafId = requestAnimationFrame(() => {
    rafId = 0

    const viewport = viewportRef.value
    const deck = deckRef.value

    if (!viewport || !deck) {
      return
    }

    const widthScale = viewport.clientWidth / deck.offsetWidth
    const heightScale = viewport.clientHeight / deck.offsetHeight
    scale.value = Math.min(widthScale, heightScale, 1)
  })
}

const clearPressedStates = () => {
  allKeys.forEach((key) => {
    keyStates[key.code].pressed = false
  })
}

const clearLongPressTimer = (code: string) => {
  const timer = longPressTimers.get(code)

  if (timer) {
    window.clearTimeout(timer)
    longPressTimers.delete(code)
  }
}

const blockBrowserBehavior = (event: KeyboardEvent) => {
  event.preventDefault()
  event.stopPropagation()
}

const reloadPage = () => {
  window.location.reload()
}

const openGithub = () => {
  window.open(githubUrl, '_blank', 'noopener,noreferrer')
}

const toggleBrowserFullscreen = async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }

  await document.documentElement.requestFullscreen?.()
}

const runLongPressAction = async (code: string) => {
  const action = longPressActions[code]

  if (!action) {
    return
  }

  longPressTriggered.add(code)

  if (action === 'reload' || action === 'browser-reload') {
    reloadPage()
    return
  }

  if (action === 'browser-fullscreen') {
    await toggleBrowserFullscreen()
    return
  }

  if (action === 'browser-devtools') {
    // Browsers do not expose a safe API for opening DevTools programmatically.
    return
  }
}

const scheduleLongPress = (code: string) => {
  const action = longPressActions[code]

  if (!action || longPressTimers.has(code)) {
    return
  }

  const timer = window.setTimeout(() => {
    longPressTimers.delete(code)
    void runLongPressAction(code)
  }, longPressDelay)

  longPressTimers.set(code, timer)
}

const handleKeydown = (event: KeyboardEvent) => {
  const { code } = event

  if (!(code in keyStates)) {
    return
  }

  blockBrowserBehavior(event)
  scheduleLongPress(code)

  if (event.repeat || keyStates[code].pressed) {
    return
  }

  keyStates[code].pressed = true
  keyStates[code].tested = true
}

const handleKeyup = (event: KeyboardEvent) => {
  const { code } = event

  if (!(code in keyStates)) {
    return
  }

  blockBrowserBehavior(event)
  clearLongPressTimer(code)

  if (longPressTriggered.has(code)) {
    longPressTriggered.delete(code)
  }

  keyStates[code].pressed = false
}

const handleBlur = () => {
  clearPressedStates()
  longPressTimers.forEach((timer) => {
    window.clearTimeout(timer)
  })
  longPressTimers.clear()
  longPressTriggered.clear()
}

const focusViewport = () => {
  viewportRef.value?.focus()
}

const getKeyClasses = (code: string, align?: string, label = '', width = 1) => {
  const state = keyStates[code]
  const compact = label.length >= 5 || width <= 1
  const tight = label.length >= 7 || (width <= 1 && label.length >= 4)

  return {
    'is-pressed': state?.pressed,
    'is-tested': state?.tested && !state?.pressed,
    'align-left': align === 'left',
    'align-right': align === 'right',
    'is-compact': compact,
    'is-tight': tight
  }
}

const getKeyStyle = (width = 1) => ({
  '--units': String(width)
})

const getSpacerStyle = (width = 1) => ({
  '--units': String(width)
})

const getGridKeyStyle = (item: GridKey) => ({
  gridColumn: `${item.col} / span ${item.width ?? 1}`,
  gridRow: `${item.row} / span ${item.height ?? 1}`
})

onMounted(async () => {
  await nextTick()
  focusViewport()
  scheduleScaleUpdate()

  resizeObserver = new ResizeObserver(() => {
    scheduleScaleUpdate()
  })

  if (viewportRef.value) {
    resizeObserver.observe(viewportRef.value)
  }

  if (deckRef.value) {
    resizeObserver.observe(deckRef.value)
  }

  window.addEventListener('resize', scheduleScaleUpdate)
  window.addEventListener('keydown', handleKeydown, { capture: true })
  window.addEventListener('keyup', handleKeyup, { capture: true })
  window.addEventListener('blur', handleBlur)
  document.addEventListener('visibilitychange', handleBlur)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', scheduleScaleUpdate)
  window.removeEventListener('keydown', handleKeydown, { capture: true })
  window.removeEventListener('keyup', handleKeyup, { capture: true })
  window.removeEventListener('blur', handleBlur)
  document.removeEventListener('visibilitychange', handleBlur)

  if (rafId) {
    cancelAnimationFrame(rafId)
  }
})
</script>
