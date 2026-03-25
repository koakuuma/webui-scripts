<template>
  <div class="app-container">
    <div class="play-button" @click="handlePlayClick"></div>

    <div class="description">
      <p>播放按钮</p>
      <p>黑屏小工具，让你的屏幕保持纯黑色。</p>
    </div>

    <div
      ref="fullscreenDiv"
      class="fullscreen-container"
      :class="{
        active: isFullscreen,
        'show-cursor': showCursor,
        'show-message': showMessage
      }"
      @click="handleFullscreenClick"
      @mousemove="handleMouseMove"
    >
      <div class="fullscreen-message">
        点击鼠标退出全屏
        <br />
        <br />
        鼠标静止 <span class="countdown">{{ countdownValue }}</span> 秒后提示文本将消失
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

type BrowserKeyboardApi = {
  lock?: (keyCodes?: string[]) => Promise<void>
  unlock?: () => void
}

const fullscreenDiv = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const canEnterFullscreen = ref(true)
const showCursor = ref(false)
const showMessage = ref(false)
const countdownValue = ref(5)

const fullscreenCooldown = 500
const cursorHideDelay = 5000
const messageDisplayTime = 5000
const blockedKeyboardEvents = ['keydown', 'keypress', 'keyup', 'beforeinput'] as const

let hideCursorTimeout: number | null = null
let messageTimeout: number | null = null
let countdownInterval: number | null = null

const getKeyboardApi = () => {
  return (navigator as Navigator & { keyboard?: BrowserKeyboardApi }).keyboard
}

const suppressKeyboardInput = (event: Event) => {
  if (!isFullscreen.value) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

const addKeyboardBlockers = () => {
  blockedKeyboardEvents.forEach((eventName) => {
    document.addEventListener(eventName, suppressKeyboardInput, true)
  })
}

const removeKeyboardBlockers = () => {
  blockedKeyboardEvents.forEach((eventName) => {
    document.removeEventListener(eventName, suppressKeyboardInput, true)
  })
}

const lockKeyboardIfSupported = async () => {
  const keyboardApi = getKeyboardApi()

  if (!keyboardApi?.lock) return

  try {
    await keyboardApi.lock([
      'Escape',
      'Tab',
      'AltLeft',
      'AltRight',
      'MetaLeft',
      'MetaRight',
      'ControlLeft',
      'ControlRight'
    ])
  } catch {
    // Ignore unsupported keys or browsers that reject keyboard lock.
  }
}

const unlockKeyboardIfSupported = () => {
  getKeyboardApi()?.unlock?.()
}

const handlePlayClick = () => {
  if (canEnterFullscreen.value) {
    void enterFullscreen()
  }
}

const enterFullscreen = async () => {
  if (!fullscreenDiv.value) return

  const el = fullscreenDiv.value

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

  addKeyboardBlockers()

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen()
    } else if ((el as any).mozRequestFullScreen) {
      (el as any).mozRequestFullScreen()
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen()
    } else if ((el as any).msRequestFullscreen) {
      (el as any).msRequestFullscreen()
    }

    isFullscreen.value = true
    hideCursorAfterDelay()
    await lockKeyboardIfSupported()
  } catch {
    resetState()
  }
}

const exitFullscreen = () => {
  unlockKeyboardIfSupported()

  if (document.exitFullscreen) {
    void document.exitFullscreen()
  } else if ((document as any).mozCancelFullScreen) {
    (document as any).mozCancelFullScreen()
  } else if ((document as any).webkitExitFullscreen) {
    (document as any).webkitExitFullscreen()
  } else if ((document as any).msExitFullscreen) {
    (document as any).msExitFullscreen()
  }

  resetState()
}

const resetState = () => {
  isFullscreen.value = false
  canEnterFullscreen.value = false
  showCursor.value = false
  showMessage.value = false

  removeKeyboardBlockers()
  unlockKeyboardIfSupported()

  if (hideCursorTimeout) clearTimeout(hideCursorTimeout)
  if (messageTimeout) clearTimeout(messageTimeout)
  if (countdownInterval) clearInterval(countdownInterval)

  countdownValue.value = messageDisplayTime / 1000

  window.setTimeout(() => {
    canEnterFullscreen.value = true
  }, fullscreenCooldown)
}

const handleFullscreenClick = () => {
  if (isFullscreen.value) {
    exitFullscreen()
  }
}

const exitHandler = () => {
  const stillFullscreen = Boolean(
    document.fullscreenElement ||
      (document as any).webkitIsFullScreen ||
      (document as any).mozFullScreen ||
      (document as any).msFullscreenElement
  )

  if (!stillFullscreen) {
    resetState()
    return
  }

  isFullscreen.value = true
  addKeyboardBlockers()
  void lockKeyboardIfSupported()
}

const hideCursorAfterDelay = () => {
  if (hideCursorTimeout) clearTimeout(hideCursorTimeout)

  hideCursorTimeout = window.setTimeout(() => {
    showCursor.value = false
  }, cursorHideDelay)
}

const startCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)

  countdownValue.value = messageDisplayTime / 1000

  countdownInterval = window.setInterval(() => {
    countdownValue.value -= 1

    if (countdownValue.value <= 0 && countdownInterval) {
      clearInterval(countdownInterval)
    }
  }, 1000)
}

const handleMouseMove = () => {
  if (!isFullscreen.value) return

  showCursor.value = true
  showMessage.value = true

  if (hideCursorTimeout) clearTimeout(hideCursorTimeout)
  if (messageTimeout) clearTimeout(messageTimeout)
  if (countdownInterval) clearInterval(countdownInterval)

  countdownValue.value = messageDisplayTime / 1000
  hideCursorAfterDelay()
  startCountdown()

  messageTimeout = window.setTimeout(() => {
    showMessage.value = false
  }, messageDisplayTime)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', exitHandler)
  document.addEventListener('webkitfullscreenchange', exitHandler)
  document.addEventListener('mozfullscreenchange', exitHandler)
  document.addEventListener('MSFullscreenChange', exitHandler)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', exitHandler)
  document.removeEventListener('webkitfullscreenchange', exitHandler)
  document.removeEventListener('mozfullscreenchange', exitHandler)
  document.removeEventListener('MSFullscreenChange', exitHandler)

  removeKeyboardBlockers()
  unlockKeyboardIfSupported()

  if (hideCursorTimeout) clearTimeout(hideCursorTimeout)
  if (messageTimeout) clearTimeout(messageTimeout)
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
