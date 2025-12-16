<template>
  <div class="container">
    <div class="header">
      <div class="title">Markdown 编辑预览器</div>
      <div class="controls">
        <div class="sync-control">
          <span>滚动同步：</span>
          <label><input type="radio" v-model="syncMode" value="none"> 不同步</label>
          <label><input type="radio" v-model="syncMode" value="to-preview"> 同步右侧</label>
          <label><input type="radio" v-model="syncMode" value="to-editor"> 同步左侧</label>
        </div>
        <button @click="saveContent" class="btn">保存<span class="shortcut-hint">(Ctrl+S)</span></button>
        <button @click="exportMarkdown" class="btn">导出文件</button>
        <select v-model="currentTheme" class="theme-selector">
          <option v-for="(theme, key) in themes" :key="key" :value="key">{{ theme.name }}</option>
        </select>
      </div>
    </div>
    <div class="editor-container">
      <div class="editor-pane">
        <div class="editor-scroll-container" ref="editorScrollContainer" @scroll="handleEditorScroll">
          <div class="line-numbers" ref="lineNumbers" v-html="lineNumbersHTML"></div>
          <textarea id="editor" ref="editor" v-model="content" spellcheck="false" @input="handleInput"
            @scroll="handleTextareaScroll"></textarea>
        </div>
      </div>
      <div class="preview-pane">
        <div class="preview-scroll-container" ref="previewScrollContainer" @scroll="handlePreviewScroll">
          <div id="preview" ref="preview" v-html="renderedContent"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="tooltip" :class="{ show: tooltip.show }">{{ tooltip.message }}</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import katex from 'katex'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render'

// 类型定义
interface Theme {
  name: string
  vars: Record<string, string>
}

// 主题配置
const themes: Record<string, Theme> = {
  'coffee-dark': {
    name: '咖啡色 - 暗色',
    vars: {
      '--bg-color': '#231F1E',
      '--line-number-bg-color': '#292423',
      '--text-color': '#eee',
      '--k-color-primary': '#F09176',
      '--line-number-text-color': '#ccc',
      '--tooltip-bg-color': '#111',
      '--tooltip-text-color': '#eee',
      '--scrollbar-thumb': 'rgba(240, 145, 118, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.2)',
      '--button-bg': 'rgba(240, 145, 118, 0.2)',
      '--button-hover-bg': 'rgba(240, 145, 118, 0.4)',
      '--button-active-bg': 'rgba(240, 145, 118, 0.6)'
    }
  },
  'coffee-light': {
    name: '咖啡色 - 亮色',
    vars: {
      '--bg-color': '#EEE9E7',
      '--line-number-bg-color': '#E6DFDC',
      '--text-color': '#111',
      '--k-color-primary': '#D26A4C',
      '--line-number-text-color': '#555',
      '--tooltip-bg-color': '#333',
      '--tooltip-text-color': '#fff',
      '--scrollbar-thumb': 'rgba(210, 106, 76, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.1)',
      '--button-bg': 'rgba(210, 106, 76, 0.2)',
      '--button-hover-bg': 'rgba(210, 106, 76, 0.3)',
      '--button-active-bg': 'rgba(210, 106, 76, 0.5)'
    }
  },
  'ocean-dark': {
    name: '海洋色 - 暗色',
    vars: {
      '--bg-color': '#1B2B34',
      '--line-number-bg-color': '#223240',
      '--text-color': '#D8DEE9',
      '--k-color-primary': '#6699CC',
      '--line-number-text-color': '#A7ADBA',
      '--tooltip-bg-color': '#111',
      '--tooltip-text-color': '#eee',
      '--scrollbar-thumb': 'rgba(102, 153, 204, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.2)',
      '--button-bg': 'rgba(102, 153, 204, 0.2)',
      '--button-hover-bg': 'rgba(102, 153, 204, 0.4)',
      '--button-active-bg': 'rgba(102, 153, 204, 0.6)'
    }
  },
  'ocean-light': {
    name: '海洋色 - 亮色',
    vars: {
      '--bg-color': '#E7EEF4',
      '--line-number-bg-color': '#D9E2EB',
      '--text-color': '#1B2B34',
      '--k-color-primary': '#3B7EA6',
      '--line-number-text-color': '#65737E',
      '--tooltip-bg-color': '#333',
      '--tooltip-text-color': '#fff',
      '--scrollbar-thumb': 'rgba(59, 126, 166, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.1)',
      '--button-bg': 'rgba(59, 126, 166, 0.2)',
      '--button-hover-bg': 'rgba(59, 126, 166, 0.3)',
      '--button-active-bg': 'rgba(59, 126, 166, 0.5)'
    }
  },
  'pale-night-dark': {
    name: '暗夜色 - 暗色',
    vars: {
      '--bg-color': '#292D3E',
      '--line-number-bg-color': '#2E3248',
      '--text-color': '#D0D0D0',
      '--k-color-primary': '#C792EA',
      '--line-number-text-color': '#A7ADBA',
      '--tooltip-bg-color': '#111',
      '--tooltip-text-color': '#eee',
      '--scrollbar-thumb': 'rgba(199, 146, 234, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.2)',
      '--button-bg': 'rgba(199, 146, 234, 0.2)',
      '--button-hover-bg': 'rgba(199, 146, 234, 0.4)',
      '--button-active-bg': 'rgba(199, 146, 234, 0.6)'
    }
  },
  'solarized-dark': {
    name: 'Solarized - 暗色',
    vars: {
      '--bg-color': '#002B36',
      '--line-number-bg-color': '#073642',
      '--text-color': '#839496',
      '--k-color-primary': '#2AA198',
      '--line-number-text-color': '#586E75',
      '--tooltip-bg-color': '#073642',
      '--tooltip-text-color': '#93A1A1',
      '--scrollbar-thumb': 'rgba(42, 161, 152, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.2)',
      '--button-bg': 'rgba(42, 161, 152, 0.2)',
      '--button-hover-bg': 'rgba(42, 161, 152, 0.4)',
      '--button-active-bg': 'rgba(42, 161, 152, 0.6)'
    }
  },
  'solarized-light': {
    name: 'Solarized - 亮色',
    vars: {
      '--bg-color': '#FDF6E3',
      '--line-number-bg-color': '#EEE8D5',
      '--text-color': '#657B83',
      '--k-color-primary': '#2AA198',
      '--line-number-text-color': '#93A1A1',
      '--tooltip-bg-color': '#073642',
      '--tooltip-text-color': '#93A1A1',
      '--scrollbar-thumb': 'rgba(42, 161, 152, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.1)',
      '--button-bg': 'rgba(42, 161, 152, 0.2)',
      '--button-hover-bg': 'rgba(42, 161, 152, 0.3)',
      '--button-active-bg': 'rgba(42, 161, 152, 0.5)'
    }
  },
  'winter-dark': {
    name: '冬季色 - 暗色',
    vars: {
      '--bg-color': '#282C34',
      '--line-number-bg-color': '#21252B',
      '--text-color': '#ABB2BF',
      '--k-color-primary': '#56B6C2',
      '--line-number-text-color': '#636D83',
      '--tooltip-bg-color': '#111',
      '--tooltip-text-color': '#eee',
      '--scrollbar-thumb': 'rgba(86, 182, 194, 0.5)',
      '--scrollbar-track': 'rgba(0, 0, 0, 0.2)',
      '--button-bg': 'rgba(86, 182, 194, 0.2)',
      '--button-hover-bg': 'rgba(86, 182, 194, 0.4)',
      '--button-active-bg': 'rgba(86, 182, 194, 0.6)'
    }
  }
}

// 状态
const content = ref('')
const renderedContent = ref('')
const currentTheme = ref('pale-night-dark')
const syncMode = ref('to-preview')
const tooltip = ref({ show: false, message: '' })
const lineNumbersHTML = ref('')

// DOM 引用
const editor = ref<HTMLTextAreaElement | null>(null)
const editorScrollContainer = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
const lineNumbers = ref<HTMLElement | null>(null)
const preview = ref<HTMLElement | null>(null)

// 同步标志
let syncingEditor = false
let syncingPreview = false
let scrollMap: number[] = []

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) { }
    }
    return '' // use external default escaping
  }
})

// 注入行号插件
function injectLineNumbers(tokens: any, idx: any, options: any, env: any, slf: any) {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  if (line !== null) {
    tokens[idx].attrJoin('data-source-line', String(line + 1))
  }
  return slf.renderToken(tokens, idx, options, env, slf)
}

md.renderer.rules.heading_open = injectLineNumbers
md.renderer.rules.paragraph_open = injectLineNumbers
md.renderer.rules.list_item_open = injectLineNumbers
md.renderer.rules.table_open = injectLineNumbers
md.renderer.rules.blockquote_open = injectLineNumbers
md.renderer.rules.code_block = (tokens, idx, options, env, slf) => {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  if (line !== null) {
    return `<pre data-source-line="${line + 1}"><code>${md.utils.escapeHtml(tokens[idx].content)}</code></pre>\n`
  }
  return `<pre><code>${md.utils.escapeHtml(tokens[idx].content)}</code></pre>\n`
}
md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  let langName = ''
  let highlighted

  if (info) {
    langName = info.split(/\s+/g)[0]
  }

  if (options.highlight) {
    highlighted = options.highlight(token.content, langName, '') || md.utils.escapeHtml(token.content)
  } else {
    highlighted = md.utils.escapeHtml(token.content)
  }

  const line = token.map ? token.map[0] : null
  const lineAttr = line !== null ? ` data-source-line="${line + 1}"` : ''

  if (highlighted.indexOf('<pre') === 0) {
    return highlighted.replace('<pre', `<pre${lineAttr}`)
  }

  return `<pre${lineAttr}><code${langName ? ` class="${options.langPrefix}${langName}"` : ''}>${highlighted}</code></pre>\n`
}


// 初始化
onMounted(() => {
  // 加载保存的设置
  const savedTheme = localStorage.getItem('markdown-editor-theme')
  if (savedTheme && themes[savedTheme]) {
    currentTheme.value = savedTheme
  }

  const savedSyncMode = localStorage.getItem('markdown-editor-sync-mode')
  if (savedSyncMode) {
    syncMode.value = savedSyncMode
  }

  const savedContent = localStorage.getItem('markdown-editor-content')
  content.value = savedContent || '# Markdown 编辑预览器\n\n欢迎使用 Markdown 编辑预览器！这是一个简单的示例。\n\n## 特性\n\n- 实时预览\n- 语法高亮\n- 数学公式支持\n- 多种主题\n\n## 语法示例\n\n### 代码块\n\n```javascript\nfunction hello() {\n  console.log("Hello, world!");\n}\n```\n\n### 表格\n\n| 名称 | 描述 |\n| --- | --- |\n| Markdown | 轻量级标记语言 |\n| KaTeX | 数学公式渲染 |\n\n### 数学公式\n\n行内公式: $E=mc^2$\n\n行间公式:\n\n$\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)$\n\n### 引用\n\n> 这是一个引用示例。\n> \n> — 某人\n\n### 任务列表\n\n- [x] 已完成任务\n- [ ] 未完成任务\n\n'

  applyTheme(currentTheme.value)
  updateLineNumbers()
  renderMarkdown()
  adjustTextareaHeight()

  // 监听键盘快捷键
  document.addEventListener('keydown', handleKeydown)
})

// 监听变化
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
  updateLineNumbers()
  renderMarkdown()
  adjustTextareaHeight()
  saveContentToStorage()
})

// 方法
const handleInput = () => {
  // 触发 watch
}

const updateLineNumbers = () => {
  const lines = content.value.split('\n')
  let html = ''
  for (let i = 0; i < lines.length; i++) {
    html += (i + 1) + '<br>'
  }
  lineNumbersHTML.value = html
}

const renderMarkdown = () => {
  renderedContent.value = md.render(content.value)

  nextTick(() => {
    if (preview.value) {
      renderMathInElement(preview.value, {
        delimiters: [
          { left: '$', right: '$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      })
      buildScrollMap()
    }
  })
}

const adjustTextareaHeight = () => {
  if (!editor.value || !editorScrollContainer.value) return

  const currentScrollTop = editorScrollContainer.value.scrollTop
  const currentScrollLeft = editorScrollContainer.value.scrollLeft

  editor.value.style.height = 'auto'
  editor.value.style.height = (editor.value.scrollHeight) + 'px'

  editorScrollContainer.value.scrollTop = currentScrollTop
  editorScrollContainer.value.scrollLeft = currentScrollLeft
}

const applyTheme = (themeName: string) => {
  const theme = themes[themeName]
  if (theme) {
    Object.keys(theme.vars).forEach(key => {
      document.documentElement.style.setProperty(key, theme.vars[key])
    })

    document.body.classList.remove('theme-light', 'theme-dark')
    if (themeName.includes('light')) {
      document.body.classList.add('theme-light')
    } else {
      document.body.classList.add('theme-dark')
    }
  }
}

// 构建滚动映射
const buildScrollMap = () => {
  if (!editor.value || !preview.value) return

  const lineHeight = 22.4 // 假设行高，可以通过计算获取更准确的值
  const lines = content.value.split('\n')
  const _scrollMap: number[] = []
  const nonEmptyList: number[] = []

  // 查找所有带有 data-source-line 的元素
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
    _scrollMap.push(pos)
  }

  // 填充空缺
  nonEmptyList.push(lines.length)
  _scrollMap.push(preview.value.scrollHeight)

  let posIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (i === nonEmptyList[posIndex]) {
      posIndex++
      continue
    }

    const startLine = nonEmptyList[posIndex - 1]
    const endLine = nonEmptyList[posIndex]
    const startPos = _scrollMap[startLine]
    const endPos = _scrollMap[endLine]

    _scrollMap[i] = startPos + (endPos - startPos) * (i - startLine) / (endLine - startLine)
  }

  scrollMap = _scrollMap
}

const handleEditorScroll = () => {
  if (!editorScrollContainer.value || !lineNumbers.value) return

  // 同步行号
  lineNumbers.value.style.top = (20 - editorScrollContainer.value.scrollTop) + 'px'

  if (!syncingEditor && syncMode.value === 'to-preview' && previewScrollContainer.value && editor.value) {
    syncingPreview = true

    const lineHeight = 22.4 // 估计行高
    const scrollTop = editorScrollContainer.value.scrollTop
    const lineIndex = Math.floor(scrollTop / lineHeight)

    if (scrollMap && scrollMap.length > lineIndex) {
      const targetScrollTop = scrollMap[lineIndex]
      previewScrollContainer.value.scrollTop = targetScrollTop
    }

    setTimeout(() => {
      syncingPreview = false
    }, 50)
  }
}

const handleTextareaScroll = () => {
  // 确保 textarea 滚动时容器也滚动（如果需要）
  // 这里主要是为了处理 textarea 高度变化的情况
}

const handlePreviewScroll = () => {
  if (!previewScrollContainer.value || !editorScrollContainer.value) return

  if (!syncingPreview && syncMode.value === 'to-editor') {
    syncingEditor = true

    const scrollTop = previewScrollContainer.value.scrollTop

    // 查找对应的行
    let lineIndex = 0
    for (let i = 0; i < scrollMap.length; i++) {
      if (scrollMap[i] > scrollTop) {
        lineIndex = i
        break
      }
    }

    const lineHeight = 22.4
    editorScrollContainer.value.scrollTop = lineIndex * lineHeight

    setTimeout(() => {
      syncingEditor = false
    }, 50)
  }
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
/* 样式已迁移到 style.scss */
</style>