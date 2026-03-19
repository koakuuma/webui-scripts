<template>
  <main
    class="vscode-shell"
    :class="{
      'is-editor-focused': activePane === 'editor',
      'is-preview-focused': activePane === 'preview',
      'theme-light': theme === 'light',
      'theme-dark': theme === 'dark'
    }"
  >
    <header class="titlebar">
      <div class="window-controls" aria-hidden="true">
        <span class="window-dot close"></span>
        <span class="window-dot minimize"></span>
        <span class="window-dot maximize"></span>
      </div>
      <div class="titlebar-center">
        <span class="title-text">{{ titleText }}</span>
      </div>
      <div class="titlebar-actions">
        <button class="theme-button" type="button" @click="toggleTheme">{{ theme === 'dark' ? 'Light' : 'Dark' }}</button>
      </div>
    </header>

    <section class="workbench" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
      <aside class="sidebar">
        <div class="sidebar-header">
          <span>Explorer</span>
          <button class="sidebar-button icon-button" type="button" aria-label="New Markdown file" @click="startCreateFile">+</button>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">MARKDOWN FILES</div>

          <form v-if="isCreatingFile" class="create-form" @submit.prevent="confirmCreateFile">
            <input
              ref="createInput"
              v-model.trim="newFileName"
              class="create-input"
              type="text"
              placeholder="example"
              maxlength="64"
              @keydown.esc.prevent="cancelCreateFile"
            />
            <div class="create-actions">
              <button class="create-action primary" type="submit">Create</button>
              <button class="create-action" type="button" @click="cancelCreateFile">Cancel</button>
            </div>
          </form>

          <div v-if="files.length" class="file-list">
            <button
              v-for="file in files"
              :key="file.id"
              class="file-item"
              :class="{ 'is-active': file.id === activeFileId }"
              type="button"
              @click="selectFile(file.id)"
              @contextmenu.prevent="openFileContextMenu($event, file.id)"
            >
              <span class="file-icon">M</span>
              <span class="file-name">{{ file.name }}</span>
              <span v-if="file.dirty" class="file-dirty"></span>
            </button>
          </div>

          <div v-else class="empty-state">
            <p>No Markdown files yet.</p>
            <p>Create your first `.md` file to start writing.</p>
          </div>
        </div>
      </aside>

      <div class="sidebar-splitter" aria-hidden="true" @mousedown.prevent="startSidebarResize"></div>

      <section class="editor-area">
        <div class="editor-tabs">
          <div class="editor-tab is-active">
            <span class="file-icon">M</span>
            <span class="tab-title">{{ activeFile?.name ?? 'No file open' }}</span>
            <span v-if="activeFile?.dirty" class="tab-dirty"></span>
          </div>
          <div class="editor-tab preview-tab">
            <span class="preview-icon">PV</span>
            <span class="tab-title">Markdown Preview</span>
          </div>
        </div>

        <div ref="editorGrid" class="editor-grid" :style="{ '--preview-width': `${previewWidth}px` }">
          <section class="pane pane-editor">
            <header class="pane-header">
              <div class="pane-title">
                <span>{{ activeFile?.name ?? 'Untitled' }}</span>
              </div>
              <div class="pane-tools">
                <span>Markdown</span>
              </div>
            </header>
            <div class="pane-body pane-body-editor" @mousedown="setActivePane('editor')">
              <div v-if="!activeFile" class="pane-placeholder">
                Create a Markdown file from the sidebar to start editing.
              </div>
              <div v-show="!!activeFile" ref="editorHost" class="monaco-host"></div>
            </div>
          </section>

          <div class="splitter" aria-hidden="true" @mousedown.prevent="startPreviewResize">
            <span class="splitter-grip"></span>
          </div>

          <section class="pane pane-preview">
            <header class="pane-header">
              <div class="pane-title">
                <span class="preview-icon">PV</span>
                <span>Preview</span>
              </div>
              <div class="pane-tools">
                <span>{{ wordCount }} words</span>
                <span>{{ readingTime }}</span>
              </div>
            </header>
            <div class="pane-body pane-body-preview" @mousedown="setActivePane('preview')">
              <div v-if="!activeFile" class="pane-placeholder">
                The preview will appear here after you create a `.md` file.
              </div>
              <div
                v-show="!!activeFile"
                ref="previewScrollContainer"
                class="preview-scroll-container"
                @scroll="handlePreviewScroll"
              >
                <article id="preview" ref="preview" class="markdown-preview" v-html="renderedContent"></article>
              </div>
            </div>
          </section>
        </div>
      </section>
    </section>

    <footer class="status-bar">
      <div class="status-left">
        <span>Markdown</span>
        <span>{{ cursorStatus }}</span>
        <span>{{ lineCount }} lines</span>
      </div>
      <div class="status-right">
        <span>Ctrl+S</span>
        <span>{{ activeFile?.dirty ? 'Unsaved' : 'Saved' }}</span>
      </div>
    </footer>

    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
    >
      <button class="context-menu-item" type="button" @click="clearContextFile">Clear File</button>
      <button class="context-menu-item danger" type="button" @click="deleteContextFile">Delete File</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render'

type MarkdownFileRecord = {
  id: string
  name: string
  content: string
  updatedAt: number
  dirty?: boolean
}

const DB_NAME = 'markdown-editor-workspace'
const DB_VERSION = 1
const STORE_NAME = 'files'
const ACTIVE_FILE_KEY = 'markdown-editor-active-file-id'
const THEME_KEY = 'markdown-editor-theme'
const DEFAULT_FILE_NAME = 'example.md'
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 520
const MIN_PREVIEW_WIDTH = 280
const DEFAULT_NEW_FILE_CONTENT = `# Markdown Example

Welcome to your Markdown workspace.

## Basic Formatting

- Bold: **important**
- Italic: *note*
- Inline code: \`npm run dev\`

## Checklist

- [x] Live preview
- [x] Ctrl+S save
- [x] IndexedDB persistence

## Code Block

\`\`\`ts
export function greet(name: string) {
  return \`Hello, \${name}\`
}
\`\`\`

## Quote

> Markdown lets you focus on writing.

## Table

| Section | Status |
| --- | --- |
| Editor | Ready |
| Preview | Synced |
`

const editorHost = ref<HTMLElement | null>(null)
const previewScrollContainer = ref<HTMLElement | null>(null)
const preview = ref<HTMLElement | null>(null)
const createInput = ref<HTMLInputElement | null>(null)
const editorGrid = ref<HTMLElement | null>(null)
const editorInstance = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

const files = ref<MarkdownFileRecord[]>([])
const activeFileId = ref('')
const activePane = ref<'editor' | 'preview'>('editor')
const renderedContent = ref('')
const isCreatingFile = ref(false)
const newFileName = ref('')
const cursorLine = ref(1)
const cursorColumn = ref(1)
const sidebarWidth = ref(280)
const previewWidth = ref(440)
const theme = ref<'dark' | 'light'>('dark')

let dbPromise: Promise<IDBDatabase> | null = null
let syncingEditor = false
let syncingPreview = false
let scrollMap: number[] = []
let suppressEditorChange = false
let isResizingSidebar = false
let isResizingPreview = false
let previewSyncFrame = 0
let editorSyncFrame = 0

const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) ?? null)
const activeContent = computed(() => activeFile.value?.content ?? '')
const lineCount = computed(() => (activeContent.value ? activeContent.value.split('\n').length : 0))
const wordCount = computed(() => {
  const matches = activeContent.value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .match(/[A-Za-z0-9_\u4e00-\u9fa5]+/g)

  return matches?.length ?? 0
})
const readingTime = computed(() => `${Math.max(1, Math.ceil(wordCount.value / 220))} min read`)
const cursorStatus = computed(() => `Ln ${cursorLine.value}, Col ${cursorColumn.value}`)
const titleText = computed(() => activeFile.value?.name ?? 'No File')

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: (source, language) => {
    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(source, { language }).value
      } catch {
      }
    }

    try {
      return hljs.highlightAuto(source).value
    } catch {
      return md.utils.escapeHtml(source)
    }
  }
})

function injectLineNumbers(tokens: any, idx: number, options: any, env: any, slf: any) {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  if (line !== null) {
    tokens[idx].attrJoin('data-source-line', String(line + 1))
  }
  return slf.renderToken(tokens, idx, options, env, slf)
}

function renderCodeBlock(source: string, language: string, line: number | null, highlighted = true) {
  const html = highlighted
    ? (md.options.highlight?.(source, language, '') || md.utils.escapeHtml(source))
    : md.utils.escapeHtml(source)
  const lineAttr = line !== null ? ` data-source-line="${line + 1}"` : ''
  const languageClass = language ? `language-${md.utils.escapeHtml(language)}` : 'language-plaintext'
  const languageLabel = language ? md.utils.escapeHtml(language) : 'plaintext'

  return `<div class="code-block"${lineAttr}><div class="code-block-header">${languageLabel}</div><pre><code class="hljs ${languageClass}">${html}</code></pre></div>\n`
}

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = handler(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAllFiles() {
  const result = await withStore<MarkdownFileRecord[]>('readonly', (store) => store.getAll())
  return result.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function putFile(file: MarkdownFileRecord) {
  await withStore<IDBValidKey>('readwrite', (store) => store.put({
    id: file.id,
    name: file.name,
    content: file.content,
    updatedAt: file.updatedAt
  }))
}

function createFileRecord(name: string): MarkdownFileRecord {
  return {
    id: crypto.randomUUID(),
    name,
    content: DEFAULT_NEW_FILE_CONTENT,
    updatedAt: Date.now(),
    dirty: true
  }
}

function normalizeFileName(name: string) {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, '')
  if (!trimmed) return ''
  const baseName = trimmed.replace(/\.md$/i, '').trim()
  return baseName ? `${baseName}.md` : ''
}

function configureMonacoEnvironment() {
  ;(globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    }
  }
}

function defineMonacoTheme() {
  monaco.editor.defineTheme('vscode-markdown-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.lineHighlightBackground': '#2a2d2e',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorCursor.foreground': '#aeafad',
      'editorIndentGuide.background1': '#404040',
      'editorIndentGuide.activeBackground1': '#707070'
    }
  })

  monaco.editor.defineTheme('vscode-markdown-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: 'AF00DB' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#24292e',
      'editorLineNumber.foreground': '#a0a1a7',
      'editorLineNumber.activeForeground': '#4f525d',
      'editor.lineHighlightBackground': '#f6f8fa',
      'editor.selectionBackground': '#add6ff',
      'editor.inactiveSelectionBackground': '#e5ebf1',
      'editorCursor.foreground': '#24292e',
      'editorIndentGuide.background1': '#d0d7de',
      'editorIndentGuide.activeBackground1': '#8c959f'
    }
  })
}

function createEditor() {
  if (!editorHost.value) return

  editorInstance.value = monaco.editor.create(editorHost.value, {
    value: '',
    language: 'markdown',
    theme: theme.value === 'dark' ? 'vscode-markdown-dark' : 'vscode-markdown-light',
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    glyphMargin: false,
    folding: false,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    renderLineHighlight: 'line',
    lineDecorationsWidth: 12,
    lineNumbersMinChars: 4,
    padding: { top: 12, bottom: 24 },
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 22,
    roundedSelection: false,
    readOnly: true,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      alwaysConsumeMouseWheel: false,
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  })

  editorInstance.value.onDidFocusEditorText(() => {
    activePane.value = 'editor'
  })

  editorInstance.value.onDidChangeCursorPosition((event) => {
    cursorLine.value = event.position.lineNumber
    cursorColumn.value = event.position.column
  })

  editorInstance.value.onDidChangeModelContent(() => {
    if (suppressEditorChange || !activeFile.value) return

    const nextValue = editorInstance.value?.getValue() ?? ''
    const file = activeFile.value
    file.content = nextValue
    file.updatedAt = Date.now()
    file.dirty = true
    files.value = [...files.value]
  })

  editorInstance.value.onDidScrollChange(() => {
    handleEditorScroll()
  })
}

function syncThemeToEditor() {
  monaco.editor.setTheme(theme.value === 'dark' ? 'vscode-markdown-dark' : 'vscode-markdown-light')
  localStorage.setItem(THEME_KEY, theme.value)
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function syncEditorWithActiveFile() {
  if (!editorInstance.value) return

  const currentValue = activeFile.value?.content ?? ''
  suppressEditorChange = true
  editorInstance.value.setValue(currentValue)
  editorInstance.value.updateOptions({ readOnly: !activeFile.value })
  cursorLine.value = 1
  cursorColumn.value = 1
  editorInstance.value.setScrollTop(0)
  editorInstance.value.setScrollLeft(0)
  suppressEditorChange = false

  if (activeFile.value) {
    window.setTimeout(() => editorInstance.value?.focus(), 0)
  }
}

function renderMarkdown() {
  renderedContent.value = activeFile.value ? md.render(activeFile.value.content) : ''

  nextTick(() => {
    if (!preview.value) return

    renderMathInElement(preview.value, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    })

    const images = preview.value.querySelectorAll('img')
    images.forEach((image) => {
      image.addEventListener('load', buildScrollMap, { once: true })
    })

    buildScrollMap()
  })
}

function buildScrollMap() {
  if (!preview.value || !activeFile.value) {
    scrollMap = []
    return
  }

  const lines = activeFile.value.content.split('\n')
  const nextScrollMap: number[] = []
  const nonEmptyLines: number[] = []
  const elements = preview.value.querySelectorAll('[data-source-line]')
  const offsetMap: Record<number, number> = {}

  elements.forEach((element) => {
    const line = parseInt(element.getAttribute('data-source-line') || '0', 10)
    if (!Number.isNaN(line)) {
      offsetMap[line] = (element as HTMLElement).offsetTop
    }
  })

  let position = 0
  for (let index = 0; index < lines.length; index++) {
    if (offsetMap[index + 1] !== undefined) {
      position = offsetMap[index + 1]
      nonEmptyLines.push(index)
    }
    nextScrollMap.push(position)
  }

  nonEmptyLines.push(lines.length)
  nextScrollMap.push(preview.value.scrollHeight)

  let pointer = 0
  for (let index = 0; index < lines.length; index++) {
    if (index === nonEmptyLines[pointer]) {
      pointer++
      continue
    }

    const startLine = nonEmptyLines[pointer - 1]
    const endLine = nonEmptyLines[pointer]
    const startOffset = nextScrollMap[startLine] ?? 0
    const endOffset = nextScrollMap[endLine] ?? startOffset
    const distance = endLine - startLine || 1

    nextScrollMap[index] = startOffset + (endOffset - startOffset) * (index - startLine) / distance
  }

  scrollMap = nextScrollMap
}

function animateScroll(
  getTop: () => number,
  setTop: (value: number) => void,
  targetTop: number,
  onComplete: () => void,
  kind: 'preview' | 'editor'
) {
  const startTop = getTop()
  const delta = targetTop - startTop

  if (Math.abs(delta) < 1) {
    setTop(targetTop)
    onComplete()
    return
  }

  const startedAt = performance.now()
  const duration = 110

  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    setTop(startTop + delta * eased)

    if (progress < 1) {
      if (kind === 'preview') {
        previewSyncFrame = window.requestAnimationFrame(step)
      } else {
        editorSyncFrame = window.requestAnimationFrame(step)
      }
      return
    }

    onComplete()
  }

  if (kind === 'preview') {
    window.cancelAnimationFrame(previewSyncFrame)
    previewSyncFrame = window.requestAnimationFrame(step)
  } else {
    window.cancelAnimationFrame(editorSyncFrame)
    editorSyncFrame = window.requestAnimationFrame(step)
  }
}

function handleEditorScroll() {
  if (!editorInstance.value || !previewScrollContainer.value || syncingEditor || !activeFile.value) return

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
  const targetTop = base + (next - base) * safeRatio

  animateScroll(
    () => previewScrollContainer.value?.scrollTop ?? 0,
    (value) => {
      if (previewScrollContainer.value) {
        previewScrollContainer.value.scrollTop = value
      }
    },
    targetTop,
    () => {
      syncingPreview = false
    },
    'preview'
  )
}

function handlePreviewScroll() {
  if (!previewScrollContainer.value || !editorInstance.value || syncingPreview || !activeFile.value) return

  syncingEditor = true
  activePane.value = 'preview'

  const top = previewScrollContainer.value.scrollTop
  let lineIndex = Math.max(0, scrollMap.length - 1)

  for (let index = 0; index < scrollMap.length; index++) {
    if (scrollMap[index] > top) {
      lineIndex = index
      break
    }
  }
  const targetTop = editorInstance.value.getTopForLineNumber(Math.max(1, lineIndex + 1))

  animateScroll(
    () => editorInstance.value?.getScrollTop() ?? 0,
    (value) => {
      editorInstance.value?.setScrollTop(value)
    },
    targetTop,
    () => {
      syncingEditor = false
    },
    'editor'
  )
}

function setActivePane(pane: 'editor' | 'preview') {
  activePane.value = pane
  if (pane === 'editor') {
    editorInstance.value?.focus()
  }
}

function startCreateFile() {
  isCreatingFile.value = true
  newFileName.value = ''
  nextTick(() => createInput.value?.focus())
}

function cancelCreateFile() {
  isCreatingFile.value = false
  newFileName.value = ''
}

async function confirmCreateFile() {
  const normalizedName = normalizeFileName(newFileName.value)
  if (!normalizedName) return
  if (files.value.some((file) => file.name.toLowerCase() === normalizedName.toLowerCase())) return

  const file = createFileRecord(normalizedName)
  files.value = [file, ...files.value]
  activeFileId.value = file.id
  localStorage.setItem(ACTIVE_FILE_KEY, file.id)
  cancelCreateFile()
  syncEditorWithActiveFile()
  renderMarkdown()
  await saveActiveFile()
}

function selectFile(fileId: string) {
  activeFileId.value = fileId
  localStorage.setItem(ACTIVE_FILE_KEY, fileId)
}

async function saveActiveFile() {
  const file = activeFile.value
  if (!file) return

  file.updatedAt = Date.now()
  file.dirty = false
  await putFile(file)
  files.value = [...files.value].sort((a, b) => b.updatedAt - a.updatedAt)
}

async function loadWorkspace() {
  files.value = await getAllFiles()
  if (!files.value.length) {
    const defaultFile = createFileRecord(DEFAULT_FILE_NAME)
    defaultFile.dirty = false
    await putFile(defaultFile)
    files.value = [defaultFile]
  }
  const lastActiveId = localStorage.getItem(ACTIVE_FILE_KEY) || ''
  activeFileId.value = files.value.some((file) => file.id === lastActiveId)
    ? lastActiveId
    : (files.value[0]?.id ?? '')
}

function startSidebarResize() {
  isResizingSidebar = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function startPreviewResize() {
  isResizingPreview = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handlePointerMove(event: MouseEvent) {
  if (isResizingSidebar) {
    const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, event.clientX))
    sidebarWidth.value = nextWidth
    return
  }

  if (!isResizingPreview || !editorGrid.value) return

  const bounds = editorGrid.value.getBoundingClientRect()
  const nextWidth = bounds.right - event.clientX
  const maxWidth = Math.max(MIN_PREVIEW_WIDTH, bounds.width - MIN_PREVIEW_WIDTH)
  previewWidth.value = Math.max(MIN_PREVIEW_WIDTH, Math.min(maxWidth, nextWidth))
}

function stopSidebarResize() {
  if (!isResizingSidebar && !isResizingPreview) return
  isResizingSidebar = false
  isResizingPreview = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function handleResize() {
  editorInstance.value?.layout()
  buildScrollMap()
}

async function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    await saveActiveFile()
  }
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
  const language = info ? info.split(/\s+/g)[0] : ''
  const line = token.map ? token.map[0] : null
  return renderCodeBlock(token.content, language, line)
}

onMounted(async () => {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme
  }
  configureMonacoEnvironment()
  defineMonacoTheme()
  syncThemeToEditor()
  await loadWorkspace()
  await nextTick()
  createEditor()
  syncEditorWithActiveFile()
  renderMarkdown()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', stopSidebarResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopSidebarResize)
  window.cancelAnimationFrame(previewSyncFrame)
  window.cancelAnimationFrame(editorSyncFrame)
  editorInstance.value?.dispose()
})

watch(activeFileId, async () => {
  await nextTick()
  syncEditorWithActiveFile()
  renderMarkdown()
})

watch(activeContent, () => {
  renderMarkdown()
})

watch(theme, () => {
  syncThemeToEditor()
})
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.vscode-shell {
  --vscode-titlebar: #181818;
  --vscode-side-bar: #252526;
  --vscode-editor-group: #1e1e1e;
  --vscode-tab-active: #1e1e1e;
  --vscode-tab-inactive: #2d2d2d;
  --vscode-border: #2b2b2b;
  --vscode-border-strong: #3c3c3c;
  --vscode-text: #cccccc;
  --vscode-text-muted: #9d9d9d;
  --vscode-text-faint: #6f6f6f;
  --vscode-accent: #007acc;
  --vscode-statusbar: #007acc;
  --vscode-preview-bg: #1e1e1e;
  --vscode-preview-code: #161616;
  --vscode-editor-bg: #1e1e1e;
  --vscode-hover-bg: #2a2d2e;
  --vscode-panel-bg: #1f1f1f;
  --vscode-inline-code: rgba(110, 118, 129, 0.22);
  display: grid;
  grid-template-rows: 35px minmax(0, 1fr) 24px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--vscode-text);
  background: #1e1e1e;
  font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
}

.theme-light {
  --vscode-titlebar: #f3f3f3;
  --vscode-side-bar: #f8f8f8;
  --vscode-editor-group: #ffffff;
  --vscode-tab-active: #ffffff;
  --vscode-tab-inactive: #ececec;
  --vscode-border: #d8dee4;
  --vscode-border-strong: #c8d1dc;
  --vscode-text: #24292e;
  --vscode-text-muted: #57606a;
  --vscode-text-faint: #6e7781;
  --vscode-accent: #0969da;
  --vscode-statusbar: #0969da;
  --vscode-preview-bg: #ffffff;
  --vscode-preview-code: #f6f8fa;
  --vscode-editor-bg: #ffffff;
  --vscode-hover-bg: #eef2f6;
  --vscode-panel-bg: #f6f8fa;
  --vscode-inline-code: rgba(175, 184, 193, 0.2);
  background: #ffffff;
}

.titlebar {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 180px;
  align-items: center;
  height: 35px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vscode-border);
  background: var(--vscode-titlebar);
  user-select: none;
}

.window-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.window-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.window-dot.close {
  background: #ff5f57;
}

.window-dot.minimize {
  background: #febc2e;
}

.window-dot.maximize {
  background: #28c840;
}

.titlebar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titlebar-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: 12px;
}

.theme-button {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--vscode-border-strong);
  background: var(--vscode-panel-bg);
  color: var(--vscode-text);
  font-size: 11px;
  cursor: pointer;
}

.theme-button:hover {
  background: var(--vscode-hover-bg);
}

.workbench {
  display: grid;
  grid-template-columns: var(--sidebar-width, 280px) 4px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--vscode-side-bar);
  border-right: 1px solid var(--vscode-border);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 35px;
  padding: 0 14px;
  color: var(--vscode-text-muted);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sidebar-button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid #454545;
  background: var(--vscode-panel-bg);
  color: var(--vscode-text);
  font-size: 11px;
  cursor: pointer;
}

.icon-button {
  width: 24px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}

.sidebar-button:hover,
.create-action:hover {
  background: var(--vscode-hover-bg);
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  overflow: auto;
}

.sidebar-label {
  color: var(--vscode-text-faint);
  font-size: 11px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--vscode-border-strong);
  background: var(--vscode-panel-bg);
}

.create-input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid #3c3c3c;
  outline: none;
  background: var(--vscode-editor-bg);
  color: var(--vscode-text);
}

.create-input:focus {
  border-color: var(--vscode-accent);
}

.create-actions {
  display: flex;
  gap: 8px;
}

.create-action {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #454545;
  background: var(--vscode-panel-bg);
  color: var(--vscode-text);
  font-size: 12px;
  cursor: pointer;
}

.create-action.primary {
  border-color: #0e639c;
  background: #0e639c;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
}

.file-item:hover {
  background: var(--vscode-hover-bg);
}

.file-item.is-active {
  background: color-mix(in srgb, var(--vscode-accent) 14%, var(--vscode-editor-group));
}

.file-icon,
.preview-icon {
  color: #519aba;
  font-size: 11px;
  font-weight: 700;
}

.file-name,
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-dirty,
.tab-dirty {
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-radius: 50%;
  background: #e2c08d;
}

.empty-state,
.pane-placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-height: 140px;
  color: var(--vscode-text-muted);
  font-size: 13px;
}

.empty-state {
  padding: 8px 10px;
}

.pane-placeholder {
  align-items: center;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.editor-area {
  display: grid;
  grid-template-rows: 35px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--vscode-editor-group);
}

.editor-tabs {
  display: flex;
  overflow: hidden;
  background: var(--vscode-panel-bg);
  border-bottom: 1px solid var(--vscode-border);
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
  padding: 0 14px;
  border-right: 1px solid var(--vscode-border);
  background: var(--vscode-tab-inactive);
  color: var(--vscode-text-muted);
  font-size: 13px;
}

.editor-tab.is-active,
.preview-tab {
  background: var(--vscode-tab-active);
  color: var(--vscode-text);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4px minmax(320px, var(--preview-width, 440px));
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane {
  display: grid;
  grid-template-rows: 35px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--vscode-border);
  background: var(--vscode-panel-bg);
  font-size: 12px;
}

.pane-title,
.pane-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pane-tools {
  color: var(--vscode-text-faint);
}

.pane-body {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-body-editor,
.pane-body-preview {
  height: 100%;
}

.monaco-host,
.preview-scroll-container {
  width: 100%;
  height: 100%;
}

.preview-scroll-container {
  overflow: auto;
}

.sidebar-splitter {
  position: relative;
  width: 4px;
  cursor: col-resize;
  background: var(--vscode-panel-bg);
}

.sidebar-splitter::before {
  content: "";
  position: absolute;
  inset: 0 1px;
  background: var(--vscode-border-strong);
}

.sidebar-splitter:hover::before {
  background: var(--vscode-accent);
}

.splitter {
  cursor: col-resize;
  background: var(--vscode-panel-bg);
}

.splitter::before {
  content: "";
  display: block;
  width: 2px;
  height: 100%;
  margin: 0 auto;
  background: var(--vscode-border-strong);
}

.splitter:hover::before {
  background: var(--vscode-accent);
}

.markdown-preview {
  width: min(100%, 920px);
  min-height: 100%;
  margin: 0 auto;
  padding: 32px 40px 56px;
  color: var(--vscode-text);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.vscode-shell :deep(.monaco-editor),
.vscode-shell :deep(.overflow-guard),
.vscode-shell :deep(.monaco-editor-background),
.vscode-shell :deep(.margin),
.vscode-shell :deep(.monaco-scrollable-element),
.vscode-shell :deep(.inputarea.ime-input) {
  background: var(--vscode-editor-bg) !important;
}

.vscode-shell :deep(.monaco-editor .view-lines) {
  color: var(--vscode-text) !important;
}

.vscode-shell :deep(.monaco-editor .current-line),
.vscode-shell :deep(.monaco-editor .current-line-margin) {
  border-color: var(--vscode-border) !important;
}

.vscode-shell :deep(.monaco-editor .line-numbers) {
  color: var(--vscode-text-faint) !important;
}

.vscode-shell :deep(.monaco-editor .line-numbers.active-line-number) {
  color: var(--vscode-text-muted) !important;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-preview :deep(h1) {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--vscode-border);
  font-size: 2em;
}

.markdown-preview :deep(h2) {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--vscode-border);
  font-size: 1.5em;
}

.markdown-preview :deep(h3) {
  font-size: 1.25em;
}

.markdown-preview :deep(p),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol),
.markdown-preview :deep(blockquote),
.markdown-preview :deep(table),
.markdown-preview :deep(.code-block) {
  margin: 0 0 16px;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 2em;
}

.markdown-preview :deep(a) {
  color: var(--vscode-accent);
  text-decoration: none;
}

.markdown-preview :deep(a:hover) {
  text-decoration: underline;
}

.markdown-preview :deep(blockquote) {
  padding: 0 16px;
  border-left: 4px solid var(--vscode-border-strong);
  color: var(--vscode-text-muted);
}

.markdown-preview :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 3px;
  background: var(--vscode-inline-code);
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.95em;
}

.markdown-preview :deep(.code-block) {
  border: 1px solid var(--vscode-border);
  background: var(--vscode-preview-code);
}

.markdown-preview :deep(.code-block-header) {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vscode-border);
  color: var(--vscode-text-muted);
  font-size: 12px;
  text-transform: lowercase;
}

.markdown-preview :deep(pre) {
  margin: 0;
  padding: 14px 16px;
  overflow: auto;
  background: transparent;
}

.markdown-preview :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.45;
}

.markdown-preview :deep(.hljs) {
  color: var(--vscode-text);
}

.markdown-preview :deep(.hljs-comment),
.markdown-preview :deep(.hljs-quote) {
  color: #6a9955;
}

.markdown-preview :deep(.hljs-keyword),
.markdown-preview :deep(.hljs-selector-tag),
.markdown-preview :deep(.hljs-literal),
.markdown-preview :deep(.hljs-section),
.markdown-preview :deep(.hljs-link) {
  color: #c586c0;
}

.markdown-preview :deep(.hljs-string),
.markdown-preview :deep(.hljs-title),
.markdown-preview :deep(.hljs-name),
.markdown-preview :deep(.hljs-type),
.markdown-preview :deep(.hljs-attribute),
.markdown-preview :deep(.hljs-symbol),
.markdown-preview :deep(.hljs-bullet),
.markdown-preview :deep(.hljs-addition) {
  color: #ce9178;
}

.markdown-preview :deep(.hljs-number),
.markdown-preview :deep(.hljs-meta),
.markdown-preview :deep(.hljs-built_in),
.markdown-preview :deep(.hljs-builtin-name) {
  color: #b5cea8;
}

.markdown-preview :deep(.hljs-function),
.markdown-preview :deep(.hljs-title.function_) {
  color: #dcdcaa;
}

.markdown-preview :deep(.hljs-variable),
.markdown-preview :deep(.hljs-template-variable),
.markdown-preview :deep(.hljs-params) {
  color: #9cdcfe;
}

.markdown-preview :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  border-collapse: collapse;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  padding: 6px 13px;
  border: 1px solid var(--vscode-border-strong);
}

.markdown-preview :deep(tr:nth-child(2n)) {
  background: color-mix(in srgb, var(--vscode-border) 18%, transparent);
}

.markdown-preview :deep(hr) {
  height: 1px;
  margin: 24px 0;
  border: 0;
  background: var(--vscode-border);
}

.markdown-preview :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 0;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px;
  min-width: 0;
  height: 24px;
  background: var(--vscode-statusbar);
  color: #ffffff;
  font-size: 12px;
  line-height: 24px;
  overflow: hidden;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  white-space: nowrap;
}

.is-editor-focused .pane-editor,
.is-preview-focused .pane-preview {
  box-shadow: inset 0 0 0 1px var(--vscode-accent);
}

@media (max-width: 960px) {
  .workbench {
    grid-template-columns: minmax(200px, 220px) 4px minmax(0, 1fr);
  }

  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(280px, 1fr) 1px minmax(240px, 1fr);
  }

  .splitter {
    height: 1px;
  }
}

@media (max-width: 720px) {
  .titlebar {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .titlebar-actions {
    display: none;
  }

  .workbench {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    display: none;
  }

  .sidebar-splitter {
    display: none;
  }

  .markdown-preview {
    padding: 24px 20px 40px;
  }
}
</style>
