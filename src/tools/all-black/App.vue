<template>
  <div class="app-container">
    <div class="play-button" @click="handlePlayClick"></div>

    <div class="description">
      <p>播放按钮</p>
      <p>黑屏小工具，让你的屏幕保持纯黑色~~~</p>
    </div>

    <div ref="fullscreenDiv" class="fullscreen-container" :class="{
      'active': isFullscreen,
      'show-cursor': showCursor,
      'show-message': showMessage
    }" @click="handleFullscreenClick" @dblclick="handleFullscreenDoubleClick" @mousemove="handleMouseMove">
      <div class="fullscreen-message">
        双击或按下 ESC 退出全屏模式
        <br><br>
        静置鼠标 <span class="countdown">{{ countdownValue }}</span> 秒后 提示文本将消失...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const fullscreenDiv = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const isPaused = ref(false)
const canEnterFullscreen = ref(true)
const showCursor = ref(false)
const showMessage = ref(false)
const countdownValue = ref(5)

const fullscreenCooldown = 500
const cursorHideDelay = 5000
const messageDisplayTime = 5000

let hideCursorTimeout: number | null = null
let messageTimeout: number | null = null
let countdownInterval: number | null = null

const handlePlayClick = () => {
  if (canEnterFullscreen.value) {
    enterFullscreen()
  }
}

const enterFullscreen = () => {
  if (!fullscreenDiv.value) return

  const el = fullscreenDiv.value
  if (el.requestFullscreen) {
    el.requestFullscreen()
  } else if ((el as any).mozRequestFullScreen) {
    (el as any).mozRequestFullScreen()
  } else if ((el as any).webkitRequestFullscreen) {
    (el as any).webkitRequestFullscreen()
  } else if ((el as any).msRequestFullscreen) {
    (el as any).msRequestFullscreen()
  }

  isFullscreen.value = true
  hideCursorAfterDelay()
}

const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen()
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
  isPaused.value = false
  canEnterFullscreen.value = false
  showCursor.value = false
  showMessage.value = false

  if (hideCursorTimeout) clearTimeout(hideCursorTimeout)
  if (messageTimeout) clearTimeout(messageTimeout)
  if (countdownInterval) clearInterval(countdownInterval)

  countdownValue.value = messageDisplayTime / 1000

  setTimeout(() => {
    canEnterFullscreen.value = true
  }, fullscreenCooldown)
}

const handleFullscreenClick = () => {
  if (isFullscreen.value) {
    if (!isPaused.value) {
      isPaused.value = true
    } else {
      exitFullscreen()
    }
  }
}

const handleFullscreenDoubleClick = () => {
  if (isFullscreen.value) {
    exitFullscreen()
  }
}

const exitHandler = () => {
  if (!document.fullscreenElement && !(document as any).webkitIsFullScreen && !(document as any).mozFullScreen && !(document as any).msFullscreenElement) {
    resetState()
  }
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
    countdownValue.value--
    if (countdownValue.value <= 0) {
      if (countdownInterval) clearInterval(countdownInterval)
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