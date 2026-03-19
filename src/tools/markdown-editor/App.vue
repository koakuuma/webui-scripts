<template>
  <div class="container">
    <div class="header">
      <div class="title-group">
        <div class="title">Markdown 编辑预览器</div>
      </div>
      <div class="controls">
        <div class="sync-control">
          <span class="control-label">滚动同步</span>
          <label><input v-model="syncMode" type="radio" value="none"> 不同步</label>
          <label><input v-model="syncMode" type="radio" value="to-preview"> 同步右侧</label>
          <label><input v-model="syncMode" type="radio" value="to-editor"> 同步左侧</label>
        </div>
        <button class="btn" @click="saveContent">保存<span class="shortcut-hint">Ctrl+S</span></button>
        <button class="btn" @click="exportMarkdown">导出文件</button>
        <select v-model="currentTheme" class="theme-selector">
          <option v-for="(theme, key) in themes" :key="key" :value="key">{{ theme.name }}</option>
        </select>
      </div>
    </div>

    <div class="editor-container">
      <section class="pane editor-pane">
        <div class="pane-toolbar">
          <span class="pane-label">编辑器</span>
          <span class="pane-meta">{{ lineCount }} 行</span>
        </div>
        <div ref="editorHost" class="monaco-host"></div>
      </section>

      <div class="splitter" aria-hidden="true"></div>

      <section class="pane preview-pane">
        <div class="pane-toolbar">
          <span class="pane-label">预览</span>
        </div>
        <div ref="previewScrollContainer" class="preview-scroll-container" @scroll="handlePreviewScroll">
          <article id="preview" ref="preview" class="markdown-preview" v-html="renderedContent"></article>
        </div>
      </section>
    </div>

    <div class="status-bar">
      <span>{{ lineCount }} 行</span>
      <span>{{ wordCount }} 词</span>
      <span>{{ currentThemeLabel }}</span>
    </div>
  </div>

  <div class="tooltip" :class="{ show: tooltip.show }">{{ tooltip.message }}</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render'

interface Theme {
  name: string
  vars: Record<string, string>
}

const themes: Record<string, Theme> = {
  'vscode-dark': {
    name: 'VS Code - 暗色',
    vars: {
      '--app-bg': '#181a1f',
      '--surface-bg': '#1f2430',
      '--surface-elevated': '#252b39',
      '--editor-bg': '#1e1e1e',
      '--preview-bg': '#1f2430',
      '--text-color': '#d4d4d4',
      '--text-muted': '#8b949e',
      '--k-color-primary': '#569cd6',
      '--accent-soft': 'rgba(86, 156, 214, 0.18)',
      '--border-color': 'rgba(255, 255, 255, 0.08)',
      '--divider-color': 'rgba(255, 255, 255, 0.12)',
      '--line-number-bg-color': '#1e1e1e',
      '--line-number-text-color': '#5c6370',
      '--tooltip-bg-color': '#0d1117',
      '--tooltip-text-color': '#e6edf3',
      '--scrollbar-thumb': 'rgba(110, 118, 129, 0.55)',
      '--scrollbar-track': 'rgba(255, 255, 255, 0.03)',
      '--button-bg': '#2d333b',
      '--button-hover-bg': '#39414c',
      '--button-active-bg': '#454f5d',
      '--button-border': 'rgba(255, 255, 255, 0.1)',
      '--input-bg': '#111827',
      '--input-border': 'rgba(255, 255, 255, 0.12)',
      '--code-bg': '#0c111b',
      '--inline-code-bg': 'rgba(110, 118, 129, 0.18)',
      '--blockquote-bg': 'rgba(86, 156, 214, 0.08)',
      '--blockquote-border': '#569cd6',
      '--table-header-bg': 'rgba(255, 255, 255, 0.04)',
      '--shadow-color': 'rgba(0, 0, 0, 0.35)',
      '--selection-bg': 'rgba(86, 156, 214, 0.2)',
      '--code-text': '#d4d4d4'
    }
  },
  'vscode-light': {
    name: 'VS Code - 亮色',
    vars: {
      '--app-bg': '#f3f6fb',
      '--surface-bg': '#ffffff',
      '--surface-elevated': '#f7f9fc',
      '--editor-bg': '#ffffff',
      '--preview-bg': '#fbfcfe',
      '--text-color': '#24292f',
      '--text-muted': '#6b7280',
      '--k-color-primary': '#0b69c7',
      '--accent-soft': 'rgba(11, 105, 199, 0.12)',
      '--border-color': 'rgba(15, 23, 42, 0.09)',
      '--divider-color': 'rgba(15, 23, 42, 0.12)',
      '--line-number-bg-color': '#ffffff',
      '--line-number-text-color': '#94a3b8',
      '--tooltip-bg-color': '#0f172a',
      '--tooltip-text-color': '#f8fafc',
      '--scrollbar-thumb': 'rgba(100, 116, 139, 0.45)',
      '--scrollbar-track': 'rgba(15, 23, 42, 0.05)',
      '--button-bg': '#f8fafc',
      '--button-hover-bg': '#eef2f7',
      '--button-active-bg': '#e2e8f0',
      '--button-border': 'rgba(15, 23, 42, 0.1)',
      '--input-bg': '#ffffff',
      '--input-border': 'rgba(15, 23, 42, 0.12)',
      '--code-bg': '#f6f8fa',
      '--inline-code-bg': 'rgba(2, 6, 23, 0.06)',
      '--blockquote-bg': 'rgba(11, 105, 199, 0.05)',
      '--blockquote-border': '#0b69c7',
      '--table-header-bg': 'rgba(15, 23, 42, 0.04)',
      '--shadow-color': 'rgba(15, 23, 42, 0.08)',
      '--selection-bg': 'rgba(11, 105, 199, 0.14)',
      '--code-text': '#24292f'
    }
  },
  'graphite-dark': {
    name: 'Graphite - 暗色',
    vars: {
      '--app-bg': '#111317',
      '--surface-bg': '#191d24',
      '--surface-elevated': '#21262f',
      '--editor-bg': '#161a21',
      '--preview-bg': '#1a1f27',
      '--text-color': '#dbe2ea',
      '--text-muted': '#91a0b3',
      '--k-color-primary': '#7dd3fc',
      '--accent-soft': 'rgba(125, 211, 252, 0.16)',
      '--border-color': 'rgba(255, 255, 255, 0.08)',
      '--divider-color': 'rgba(125, 211, 252, 0.2)',
      '--line-number-bg-color': '#161a21',
      '--line-number-text-color': '#566274',
      '--tooltip-bg-color': '#0b0d11',
      '--tooltip-text-color': '#e5edf6',
      '--scrollbar-thumb': 'rgba(145, 160, 179, 0.45)',
      '--scrollbar-track': 'rgba(255, 255, 255, 0.04)',
      '--button-bg': '#232a35',
      '--button-hover-bg': '#2a3340',
      '--button-active-bg': '#334051',
      '--button-border': 'rgba(255, 255, 255, 0.1)',
      '--input-bg': '#11151c',
      '--input-border': 'rgba(255, 255, 255, 0.12)',
      '--code-bg': '#0f141b',
      '--inline-code-bg': 'rgba(125, 211, 252, 0.12)',
      '--blockquote-bg': 'rgba(125, 211, 252, 0.08)',
      '--blockquote-border': '#7dd3fc',
      '--table-header-bg': 'rgba(255, 255, 255, 0.05)',
      '--shadow-color': 'rgba(0, 0, 0, 0.3)',
      '--selection-bg': 'rgba(125, 211, 252, 0.16)',
      '--code-text': '#dbe2ea'
    }
  },
  'paper-light': {
    name: 'Paper - 浅色',
    vars: {
      '--app-bg': '#f4efe7',
      '--surface-bg': '#fffdf9',
      '--surface-elevated': '#faf5ee',
      '--editor-bg': '#fffdf9',
      '--preview-bg': '#fffaf3',
      '--text-color': '#3a3127',
      '--text-muted': '#8a7866',
      '--k-color-primary': '#9d5c2f',
      '--accent-soft': 'rgba(157, 92, 47, 0.12)',
      '--border-color': 'rgba(92, 61, 38, 0.12)',
      '--divider-color': 'rgba(157, 92, 47, 0.18)',
      '--line-number-bg-color': '#fffdf9',
      '--line-number-text-color': '#c0ae9a',
      '--tooltip-bg-color': '#3a3127',
      '--tooltip-text-color': '#fffaf3',
      '--scrollbar-thumb': 'rgba(138, 120, 102, 0.45)',
      '--scrollbar-track': 'rgba(92, 61, 38, 0.05)',
      '--button-bg': '#f8efe4',
      '--button-hover-bg': '#f0e3d2',
      '--button-active-bg': '#e9d6be',
      '--button-border': 'rgba(92, 61, 38, 0.12)',
      '--input-bg': '#fffaf3',
      '--input-border': 'rgba(92, 61, 38, 0.14)',
      '--code-bg': '#f4ede2',
      '--inline-code-bg': 'rgba(92, 61, 38, 0.06)',
      '--blockquote-bg': 'rgba(157, 92, 47, 0.05)',
      '--blockquote-border': '#9d5c2f',
      '--table-header-bg': 'rgba(92, 61, 38, 0.05)',
      '--shadow-color': 'rgba(92, 61, 38, 0.08)',
      '--selection-bg': 'rgba(157, 92, 47, 0.12)',
      '--code-text': '#3a3127'
    }
  }
}

const content = ref('')
const renderedContent = ref('')
const currentTheme = ref('vscode-dark')
const syncMode = ref('to-preview')
const tooltip = ref({ show: false, message: '' })

const editorHost = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
const preview = ref<HTMLElement | null>(null)
const editorInstance = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

const lineCount = computed(() => content.value.split('\n').length)
const wordCount = computed(() => {
  const matches = content.value.trim().match(/[\u4e00-\u9fa5]|[A-Za-z0-9_]+/g)
  return matches ? matches.length : 0
})
const currentThemeLabel = computed(() => themes[currentTheme.value]?.name ?? '')

let syncingEditor = false
let syncingPreview = false
let scrollMap: number[] = []

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (_) {
      }
    }

    try {
      return hljs.highlightAuto(str).value
    } catch (_) {
      return MarkdownIt().utils.escapeHtml(str)
    }
  }
})

function injectLineNumbers(tokens: any, idx: any, options: any, env: any, slf: any) {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  if (line !== null) {
    tokens[idx].attrJoin('data-source-line', String(line + 1))
  }
  return slf.renderToken(tokens, idx, options, env, slf)
}

function renderCodeBlock(contentValue: string, languageName: string, line: number | null, enableHighlight = true) {
  const highlighted = enableHighlight
    ? (languageName
      ? (md.options.highlight?.(contentValue, languageName, '') || md.utils.escapeHtml(contentValue))
      : (md.options.highlight?.(contentValue, '', '') || md.utils.escapeHtml(contentValue)))
    : md.utils.escapeHtml(contentValue)
  const lineAttr = line !== null ? ` data-source-line="${line + 1}"` : ''
  const languageClass = languageName ? `language-${md.utils.escapeHtml(languageName)}` : 'language-plaintext'
  return `<div class="code-block"${lineAttr}><pre><code class="hljs ${languageClass}">${highlighted}</code></pre></div>\n`
}

function configureMonacoEnvironment() {
  ;(globalThis as any).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    }
  }
}

function getMonacoThemeName(themeName: string) {
  return themeName.includes('light') ? 'vs' : 'vs-dark'
}

function createEditor() {
  if (!editorHost.value) return

  editorInstance.value = monaco.editor.create(editorHost.value, {
    value: content.value,
    language: 'markdown',
    theme: getMonacoThemeName(currentTheme.value),
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    renderLineHighlight: 'line',
    overviewRulerBorder: false,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, monospace',
    fontSize: 14,
    lineHeight: 25,
    padding: {
      top: 16,
      bottom: 24
    },
    scrollbar: {
      vertical: 'hidden',
      horizontal: 'hidden',
      alwaysConsumeMouseWheel: false,
      useShadows: false
    }
  })

  editorInstance.value.onDidChangeModelContent(() => {
    const nextValue = editorInstance.value?.getValue() ?? ''
    if (nextValue !== content.value) {
      content.value = nextValue
    }
  })

  editorInstance.value.onDidScrollChange(() => {
    handleEditorScroll()
  })
}

md.renderer.rules.heading_open = injectLineNumbers
md.renderer.rules.paragraph_open = injectLineNumbers
md.renderer.rules.list_item_open = injectLineNumbers
md.renderer.rules.table_open = injectLineNumbers
md.renderer.rules.blockquote_open = injectLineNumbers
md.renderer.rules.code_block = (tokens, idx) => {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  return renderCodeBlock(tokens[idx].content, '', line, false)
}
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  const languageName = info ? info.split(/\s+/g)[0] : ''
  const line = token.map ? token.map[0] : null
  return renderCodeBlock(token.content, languageName, line)
}

onMounted(async () => {
  configureMonacoEnvironment()

  const savedTheme = localStorage.getItem('markdown-editor-theme')
  if (savedTheme && themes[savedTheme]) {
    currentTheme.value = savedTheme
  }

  const savedSyncMode = localStorage.getItem('markdown-editor-sync-mode')
  if (savedSyncMode) {
    syncMode.value = savedSyncMode
  }

  const savedContent = localStorage.getItem('markdown-editor-content')
  content.value = savedContent || '# Markdown 编辑预览器\n\n## 语法示例\n\n### 代码块\n\n```ts\nfunction greet(name: string) {\n  console.log(`Hello, ${name}`)\n}\n\ngreet("world")\n```\n\n### 表格\n\n| 名称 | 描述 |\n| --- | --- |\n| Markdown | 轻量级标记语言 |\n| KaTeX | 数学公式渲染 |\n| highlight.js | 代码高亮 |\n\n### 数学公式\n\n行内公式: $E=mc^2$\n\n行间公式:\n\n$\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)$\n\n### 分隔线\n\n---\n\n### 引用\n\n> 这是一个引用示例。\n\n### 任务列表\n\n- [x] 已完成任务\n- [ ] 未完成任务\n'

  applyTheme(currentTheme.value)
  renderMarkdown()

  await nextTick()
  createEditor()

  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)

  setTimeout(() => {
    buildScrollMap()
  }, 500)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  editorInstance.value?.dispose()
})

watch(currentTheme, (newTheme) => {
  applyTheme(newTheme)
  localStorage.setItem('markdown-editor-theme', newTheme)
  showTooltip('主题已更改')
})

watch(syncMode, (newMode) => {
  localStorage.setItem('markdown-editor-sync-mode', newMode)
  showTooltip('滚动同步模式已更改')
})

watch(content, () => {
  renderMarkdown()
  saveContentToStorage()
})

const renderMarkdown = () => {
  renderedContent.value = md.render(content.value)

  nextTick(() => {
    if (!preview.value) return

    renderMathInElement(preview.value, {
      delimiters: [
        { left: '$', right: '$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    })

    const images = preview.value.querySelectorAll('img')
    images.forEach(img => {
      img.addEventListener('load', buildScrollMap)
    })

    buildScrollMap()
  })
}

const handleResize = () => {
  editorInstance.value?.layout()
  buildScrollMap()
}

const applyTheme = (themeName: string) => {
  const theme = themes[themeName]
  if (!theme) return

  Object.keys(theme.vars).forEach(key => {
    document.documentElement.style.setProperty(key, theme.vars[key])
  })

  document.body.classList.remove('theme-light', 'theme-dark')
  document.body.classList.add(themeName.includes('light') ? 'theme-light' : 'theme-dark')
  monaco.editor.setTheme(getMonacoThemeName(themeName))
}

const buildScrollMap = () => {
  if (!preview.value) return

  const lines = content.value.split('\n')
  const nextScrollMap: number[] = []
  const nonEmptyList: number[] = []
  const elements = preview.value.querySelectorAll('[data-source-line]')
  const offsetMap: Record<number, number> = {}

  elements.forEach((el) => {
    const line = parseInt(el.getAttribute('data-source-line') || '0')
    if (!isNaN(line)) {
      offsetMap[line] = (el as HTMLElement).offsetTop
    }
  })

  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    if (offsetMap[i + 1] !== undefined) {
      pos = offsetMap[i + 1]
      nonEmptyList.push(i)
    }
    nextScrollMap.push(pos)
  }

  nonEmptyList.push(lines.length)
  nextScrollMap.push(preview.value.scrollHeight)

  let posIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (i === nonEmptyList[posIndex]) {
      posIndex++
      continue
    }

    const startLine = nonEmptyList[posIndex - 1]
    const endLine = nonEmptyList[posIndex]
    const startPos = nextScrollMap[startLine]
    const endPos = nextScrollMap[endLine]

    nextScrollMap[i] = startPos + (endPos - startPos) * (i - startLine) / (endLine - startLine)
  }

  scrollMap = nextScrollMap
}

const handleEditorScroll = () => {
  if (!editorInstance.value || !previewScrollContainer.value) return
  if (syncingEditor || syncMode.value !== 'to-preview') return

  syncingPreview = true

  const visibleRange = editorInstance.value.getVisibleRanges()[0]
  const lineNumber = visibleRange?.startLineNumber ?? 1
  const currentTop = editorInstance.value.getScrollTop()
  const lineTop = editorInstance.value.getTopForLineNumber(lineNumber)
  const nextLineTop = editorInstance.value.getTopForLineNumber(lineNumber + 1)
  const ratio = nextLineTop > lineTop ? (currentTop - lineTop) / (nextLineTop - lineTop) : 0
  const safeRatio = Math.max(0, Math.min(1, ratio))
  const base = scrollMap[lineNumber - 1] ?? 0
  const next = scrollMap[lineNumber] ?? base

  previewScrollContainer.value.scrollTo({
    top: base + (next - base) * safeRatio,
    behavior: 'auto'
  })

  setTimeout(() => {
    syncingPreview = false
  }, 50)
}

const handlePreviewScroll = () => {
  if (!previewScrollContainer.value || !editorInstance.value) return
  if (syncingPreview || syncMode.value !== 'to-editor') return

  syncingEditor = true

  const scrollTop = previewScrollContainer.value.scrollTop
  let lineIndex = 0
  for (let i = 0; i < scrollMap.length; i++) {
    if (scrollMap[i] > scrollTop) {
      lineIndex = i
      break
    }
  }

  editorInstance.value.setScrollTop(editorInstance.value.getTopForLineNumber(Math.max(1, lineIndex + 1)))

  setTimeout(() => {
    syncingEditor = false
  }, 50)
}

const saveContentToStorage = () => {
  localStorage.setItem('markdown-editor-content', content.value)
}

const saveContent = () => {
  saveContentToStorage()
  showTooltip('内容已保存')
}

const exportMarkdown = () => {
  if (content.value.trim().length === 0) {
    showTooltip('你还什么都没写呢，不给你存~')
    return
  }

  const blob = new Blob([content.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const fileName = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}.md`

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showTooltip('文件已导出')
}

const showTooltip = (message: string) => {
  tooltip.value = { show: true, message }
  setTimeout(() => {
    tooltip.value.show = false
  }, 2000)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    saveContent()
  }
}
</script>

<style scoped>
</style>
