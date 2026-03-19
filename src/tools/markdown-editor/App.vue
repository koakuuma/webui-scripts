<template>
  <main
    class="vscode-shell"
    :class="{
      'is-editor-focused': activePane === 'editor',
      'is-preview-focused': activePane === 'preview'
    }"
  >
    <header class="titlebar">
      <div class="window-controls">
        <button class="window-dot close" type="button" aria-label="Save and close current file" @click="saveAndCloseCurrentFile"></button>
        <button class="window-dot minimize" type="button" aria-label="Open repository" @click="openProjectLink"></button>
        <button class="window-dot maximize" type="button" aria-label="Open repository in a new tab" @click="openProjectLink"></button>
      </div>
      <div class="titlebar-center">
        <span class="title-text">{{ titleText }}</span>
      </div>
      <div class="titlebar-actions" aria-hidden="true"></div>
    </header>

    <section class="workbench" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
      <aside class="sidebar" @mousedown="setActivePane('sidebar')">
        <div class="sidebar-header">
          <span>Explorer</span>
          <button class="sidebar-button icon-button" type="button" aria-label="New Markdown file" @click="startCreateFile">+</button>
        </div>

        <div class="sidebar-section">
          <div v-if="files.length" class="file-list">
            <template v-for="file in files" :key="file.id">
              <button
                v-if="renamingFileId !== file.id"
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
              <form
                v-else
                class="rename-form"
                @submit.prevent="confirmRenameFile"
              >
                <span class="file-icon">M</span>
                <input
                  :ref="setRenameInput"
                  v-model.trim="renameFileName"
                  class="rename-input"
                  type="text"
                  maxlength="64"
                  @blur="confirmRenameFile"
                  @keydown.esc.prevent="cancelRenameFile"
                />
              </form>
            </template>
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
        </div>

        <div ref="editorGrid" class="editor-grid" :style="{ '--preview-width': `${previewWidth}px` }">
          <section class="pane pane-editor">
            <div
              class="pane-body pane-body-editor"
              @mousedown="setActivePane('editor')"
              @mousedown.middle.prevent="startMiddleScroll('editor', $event)"
            >
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
            <div
              class="pane-body pane-body-preview"
              @mousedown="setActivePane('preview')"
              @mousedown.middle.prevent="startMiddleScroll('preview', $event)"
            >
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
      <button class="context-menu-item" type="button" @click="beginRenameFromContext">Rename File</button>
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
  manualName?: boolean
}

const DB_NAME = 'markdown-editor-workspace'
const DB_VERSION = 2
const STORE_NAME = 'files'
const SETTINGS_STORE = 'settings'
const ACTIVE_FILE_KEY = 'markdown-editor-active-file-id'
const WORKSPACE_INIT_KEY = 'markdown-editor-workspace-initialized'
const DEFAULT_FILE_NAME = 'example.md'
const DEFAULT_UNTITLED_PREFIX = 'Untitled'
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 520
const MIN_PREVIEW_WIDTH = 280
const PROJECT_URL = 'https://github.com/koakuuma/webui-scripts'
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
const renameInput = ref<HTMLInputElement | null>(null)
const editorGrid = ref<HTMLElement | null>(null)
const editorInstance = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

const files = ref<MarkdownFileRecord[]>([])
const activeFileId = ref('')
const activePane = ref<'editor' | 'preview' | 'sidebar'>('editor')
const renderedContent = ref('')
const renamingFileId = ref('')
const renameFileName = ref('')
const cursorLine = ref(1)
const cursorColumn = ref(1)
const sidebarWidth = ref(280)
const previewWidth = ref(440)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  fileId: ''
})
const middleScrollState = ref<{
  target: 'editor' | 'preview'
  startY: number
  startTop: number
} | null>(null)

let dbPromise: Promise<IDBDatabase> | null = null
let syncingEditor = false
let syncingPreview = false
let scrollMap: number[] = []
let suppressEditorChange = false
let isResizingSidebar = false
let isResizingPreview = false
let previewSyncFrame = 0
let editorSyncFrame = 0
let renderTimer = 0
let renderVersion = 0

const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) ?? null)
const activeContent = computed(() => activeFile.value?.content ?? '')
const lineCount = computed(() => (activeContent.value ? activeContent.value.split('\n').length : 0))
const cursorStatus = computed(() => `Ln ${cursorLine.value}, Col ${cursorColumn.value}`)
const titleText = computed(() => activeFile.value?.name ?? 'No File')

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: (source, language) => {
    if (!language) {
      return md.utils.escapeHtml(source)
    }

    if (hljs.getLanguage(language)) {
      try {
        return hljs.highlight(source, { language }).value
      } catch {
      }
    }

    return md.utils.escapeHtml(source)
  }
})

function setRenameInput(element: Element | null) {
  renameInput.value = element as HTMLInputElement | null
}

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
        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
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
    updatedAt: file.updatedAt,
    manualName: file.manualName ?? false
  }))
}

async function deleteFile(id: string) {
  await withStore<undefined>('readwrite', (store) => store.delete(id))
}

async function getSetting<T>(key: string) {
  const database = await openDatabase()

  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE, 'readonly')
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.get(key)

    request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function putSetting<T>(key: string, value: T) {
  const database = await openDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE, 'readwrite')
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.put({ key, value })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function createFileRecord(name: string): MarkdownFileRecord {
  return {
    id: crypto.randomUUID(),
    name,
    content: DEFAULT_NEW_FILE_CONTENT,
    updatedAt: Date.now(),
    dirty: true,
    manualName: false
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
      { token: 'type', foreground: '4EC9B0' },
      { token: 'tag', foreground: 'D4D4D4' },
      { token: 'tag.html', foreground: 'D4D4D4' },
      { token: 'delimiter.html', foreground: 'D4D4D4' },
      { token: 'metatag', foreground: 'D4D4D4' },
      { token: 'attribute.name', foreground: 'D4D4D4' },
      { token: 'attribute.value', foreground: 'D4D4D4' },
      { token: 'attribute.name.html', foreground: 'D4D4D4' },
      { token: 'attribute.value.html', foreground: 'D4D4D4' },
      { token: 'string.html', foreground: 'D4D4D4' },
      { token: 'delimiter.angle', foreground: 'D4D4D4' },
      { token: 'tag-name', foreground: 'D4D4D4' },
      { token: 'source', foreground: 'D4D4D4' },
      { token: 'text', foreground: 'D4D4D4' }
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
}

function createEditor() {
  if (!editorHost.value) return

  editorInstance.value = monaco.editor.create(editorHost.value, {
    value: '',
    language: 'markdown',
    theme: 'vscode-markdown-dark',
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
    fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
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
    applyAutoFileName(file)
    files.value = [...files.value]
  })

  editorInstance.value.onDidScrollChange(() => {
    handleEditorScroll()
  })
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

function extractPrimaryHeading(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() ?? ''
}

function sanitizeHeadingToFileName(heading: string) {
  const cleaned = heading
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)

  return cleaned ? `${cleaned}.md` : ''
}

function makeUniqueFileName(proposedName: string, excludeId = '') {
  const normalized = normalizeFileName(proposedName)
  if (!normalized) return ''

  const lowerSet = new Set(
    files.value
      .filter((file) => file.id !== excludeId)
      .map((file) => file.name.toLowerCase())
  )

  if (!lowerSet.has(normalized.toLowerCase())) {
    return normalized
  }

  const baseName = normalized.replace(/\.md$/i, '')
  let index = 2
  let candidate = `${baseName} ${index}.md`

  while (lowerSet.has(candidate.toLowerCase())) {
    index++
    candidate = `${baseName} ${index}.md`
  }

  return candidate
}

function generateUntitledFileName() {
  const lowerSet = new Set(files.value.map((file) => file.name.toLowerCase()))
  let index = 1
  let candidate = `${DEFAULT_UNTITLED_PREFIX}-${index}.md`

  while (lowerSet.has(candidate.toLowerCase())) {
    index++
    candidate = `${DEFAULT_UNTITLED_PREFIX}-${index}.md`
  }

  return candidate
}

function applyAutoFileName(file: MarkdownFileRecord) {
  if (file.manualName) return

  const heading = extractPrimaryHeading(file.content)
  if (!heading) return

  const nextName = makeUniqueFileName(sanitizeHeadingToFileName(heading), file.id)
  if (nextName && nextName !== file.name) {
    file.name = nextName
  }
}

function renderMarkdownNow(version: number) {
  const file = activeFile.value
  renderedContent.value = file ? md.render(file.content) : ''

  nextTick(() => {
    if (version !== renderVersion) return
    if (!preview.value) return

    preview.value.querySelectorAll('li').forEach((item) => {
      const html = item.innerHTML
      const unchecked = html.match(/^\s*\[\s\]\s*/)
      const checked = html.match(/^\s*\[(x|X)\]\s*/)

      if (!unchecked && !checked) return

      item.classList.add('task-list-item')
      item.innerHTML = `${checked ? '<input class="task-list-checkbox" type="checkbox" disabled checked>' : '<input class="task-list-checkbox" type="checkbox" disabled>'}${html.replace(/^\s*\[( |x|X)\]\s*/, '')}`
    })

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

function scheduleRenderMarkdown(delay = 40) {
  renderVersion += 1
  const currentVersion = renderVersion
  window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(() => {
    renderMarkdownNow(currentVersion)
  }, delay)
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

function handleEditorScroll() {
  if (!editorInstance.value || !previewScrollContainer.value || syncingEditor || !activeFile.value) return

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

  syncingPreview = true
  window.cancelAnimationFrame(previewSyncFrame)
  previewSyncFrame = window.requestAnimationFrame(() => {
    if (previewScrollContainer.value) {
      previewScrollContainer.value.scrollTop = targetTop
    }

    window.requestAnimationFrame(() => {
      syncingPreview = false
    })
  })
}

function handlePreviewScroll() {
  if (!previewScrollContainer.value || !editorInstance.value || syncingPreview || !activeFile.value) return

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

  syncingEditor = true
  window.cancelAnimationFrame(editorSyncFrame)
  editorSyncFrame = window.requestAnimationFrame(() => {
    editorInstance.value?.setScrollTop(targetTop)

    window.requestAnimationFrame(() => {
      syncingEditor = false
    })
  })
}

function setActivePane(pane: 'editor' | 'preview' | 'sidebar') {
  activePane.value = pane
  if (pane === 'editor') {
    editorInstance.value?.focus()
  }
}

async function startCreateFile() {
  closeContextMenu()
  cancelRenameFile()
  const file = createFileRecord(generateUntitledFileName())
  files.value = [file, ...files.value]
  activeFileId.value = file.id
  localStorage.setItem(ACTIVE_FILE_KEY, file.id)
  syncEditorWithActiveFile()
  scheduleRenderMarkdown(0)
  await saveActiveFile()
}

function selectFile(fileId: string) {
  activePane.value = 'sidebar'
  activeFileId.value = fileId
  localStorage.setItem(ACTIVE_FILE_KEY, fileId)
}

async function saveActiveFile() {
  const file = activeFile.value
  if (!file) return

  applyAutoFileName(file)
  file.updatedAt = Date.now()
  file.dirty = false
  await putFile(file)
  files.value = [...files.value].sort((a, b) => b.updatedAt - a.updatedAt)
}

async function persistLayout() {
  await putSetting('layout', {
    sidebarWidth: sidebarWidth.value,
    previewWidth: previewWidth.value
  })
}

async function loadWorkspace() {
  files.value = await getAllFiles()
  const savedLayout = await getSetting<{ sidebarWidth: number, previewWidth: number }>('layout')
  if (savedLayout) {
    sidebarWidth.value = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, savedLayout.sidebarWidth))
    previewWidth.value = Math.max(MIN_PREVIEW_WIDTH, savedLayout.previewWidth)
  }
  if (!files.value.length && !localStorage.getItem(WORKSPACE_INIT_KEY)) {
    const defaultFile = createFileRecord(DEFAULT_FILE_NAME)
    defaultFile.dirty = false
    await putFile(defaultFile)
    files.value = [defaultFile]
    localStorage.setItem(WORKSPACE_INIT_KEY, '1')
  }
  const lastActiveId = localStorage.getItem(ACTIVE_FILE_KEY) || ''
  activeFileId.value = files.value.some((file) => file.id === lastActiveId)
    ? lastActiveId
    : (files.value[0]?.id ?? '')
}

function startSidebarResize() {
  closeContextMenu()
  isResizingSidebar = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function startPreviewResize() {
  closeContextMenu()
  isResizingPreview = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function startMiddleScroll(target: 'editor' | 'preview', event: MouseEvent) {
  closeContextMenu()
  const startTop = target === 'editor'
    ? (editorInstance.value?.getScrollTop() ?? 0)
    : (previewScrollContainer.value?.scrollTop ?? 0)

  middleScrollState.value = {
    target,
    startY: event.clientY,
    startTop
  }

  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

async function saveAndCloseCurrentFile() {
  if (activeFile.value?.dirty) {
    await saveActiveFile()
  }

  activeFileId.value = ''
  localStorage.removeItem(ACTIVE_FILE_KEY)
  renderedContent.value = ''
}

function openProjectLink() {
  window.open(PROJECT_URL, '_blank', 'noopener,noreferrer')
}

function openFileContextMenu(event: MouseEvent, fileId: string) {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    fileId
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function startRenameFile(fileId: string) {
  const file = files.value.find((item) => item.id === fileId)
  if (!file) return

  renamingFileId.value = fileId
  renameFileName.value = file.name.replace(/\.md$/i, '')
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function cancelRenameFile() {
  renamingFileId.value = ''
  renameFileName.value = ''
}

async function confirmRenameFile() {
  const file = files.value.find((item) => item.id === renamingFileId.value)
  if (!file) {
    cancelRenameFile()
    return
  }

  const nextName = makeUniqueFileName(renameFileName.value, file.id)
  if (nextName) {
    file.name = nextName
    file.manualName = true
    file.updatedAt = Date.now()
    await putFile(file)
    files.value = [...files.value]
  }

  cancelRenameFile()
}

function beginRenameFromContext() {
  const fileId = contextMenu.value.fileId
  closeContextMenu()
  startRenameFile(fileId)
}

async function deleteContextFile() {
  const fileId = contextMenu.value.fileId
  if (!fileId) return

  await deleteFile(fileId)
  files.value = files.value.filter((item) => item.id !== fileId)

  if (activeFileId.value === fileId) {
    activeFileId.value = files.value[0]?.id ?? ''
    localStorage.setItem(ACTIVE_FILE_KEY, activeFileId.value)
  }

  closeContextMenu()
  scheduleRenderMarkdown(0)
}

function handleGlobalPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.context-menu')) return
  closeContextMenu()
}

function handlePointerMove(event: MouseEvent) {
  if (middleScrollState.value) {
    const { target, startY, startTop } = middleScrollState.value
    const nextTop = Math.max(0, startTop + (event.clientY - startY) * 2.2)

    if (target === 'editor') {
      editorInstance.value?.setScrollTop(nextTop)
    } else if (previewScrollContainer.value) {
      previewScrollContainer.value.scrollTop = nextTop
    }
    return
  }

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
  if (middleScrollState.value) {
    middleScrollState.value = null
  }

  if (!isResizingSidebar && !isResizingPreview && !middleScrollState.value) {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    return
  }

  void persistLayout()
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
  const target = event.target as HTMLElement | null
  const isTypingTarget = !!target?.closest('input, textarea, [contenteditable="true"]')

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    await saveActiveFile()
    return
  }

  if (event.key === 'Delete' && !isTypingTarget && activePane.value === 'sidebar' && activeFile.value) {
    event.preventDefault()
    contextMenu.value.fileId = activeFile.value.id
    await deleteContextFile()
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
  configureMonacoEnvironment()
  defineMonacoTheme()
  await loadWorkspace()
  await nextTick()
  createEditor()
  syncEditorWithActiveFile()
  scheduleRenderMarkdown(0)
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', stopSidebarResize)
  window.addEventListener('mousedown', handleGlobalPointerDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mousemove', handlePointerMove)
  window.removeEventListener('mouseup', stopSidebarResize)
  window.removeEventListener('mousedown', handleGlobalPointerDown)
  window.clearTimeout(renderTimer)
  window.cancelAnimationFrame(previewSyncFrame)
  window.cancelAnimationFrame(editorSyncFrame)
  editorInstance.value?.dispose()
})

watch(activeFileId, async () => {
  await nextTick()
  syncEditorWithActiveFile()
  scheduleRenderMarkdown(0)
})

watch(activeContent, () => {
  scheduleRenderMarkdown()
})

watch(titleText, (value) => {
  document.title = value
}, { immediate: true })
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
  --vscode-code-comment: #6a9955;
  --vscode-code-keyword: #c586c0;
  --vscode-code-string: #ce9178;
  --vscode-code-number: #b5cea8;
  --vscode-code-function: #dcdcaa;
  --vscode-code-variable: #9cdcfe;
  display: grid;
  grid-template-rows: 35px minmax(0, 1fr) 24px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--vscode-text);
  background: #1e1e1e;
  font-family: "Segoe WPC", "Segoe UI", "Microsoft YaHei UI", sans-serif;
  transition: background-color 180ms ease, color 180ms ease;
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
  border: 0;
  padding: 0;
  cursor: pointer;
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

.sidebar-button:hover {
  background: var(--vscode-hover-bg);
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  overflow: auto;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  transition: background-color 140ms ease, transform 140ms ease;
}

.file-item:hover {
  background: var(--vscode-hover-bg);
  transform: translateX(1px);
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

.rename-form {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--vscode-accent) 12%, var(--vscode-editor-group));
}

.rename-input {
  width: 100%;
  height: 22px;
  border: 1px solid var(--vscode-accent);
  outline: none;
  background: #111111;
  color: var(--vscode-text);
  font-size: 12px;
  padding: 0 6px;
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
  transition: background-color 140ms ease, color 140ms ease;
}

.editor-tab.is-active,
.preview-tab {
  background: var(--vscode-tab-active);
  color: var(--vscode-text);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8px minmax(320px, var(--preview-width, 440px));
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  transition: box-shadow 160ms ease;
}

.pane-body {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-body-editor,
.pane-body-preview {
  height: 100%;
  background: var(--vscode-editor-bg);
}

.monaco-host,
.preview-scroll-container {
  width: 100%;
  height: 100%;
}

.preview-scroll-container {
  overflow: auto;
  scrollbar-width: auto;
  scrollbar-color: #5a5a5a #1f1f1f;
  direction: rtl;
}

.preview-scroll-container::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.preview-scroll-container::-webkit-scrollbar-track {
  background: #1f1f1f;
}

.preview-scroll-container::-webkit-scrollbar-thumb {
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  background: #5a5a5a;
}

.sidebar-splitter {
  position: relative;
  width: 8px;
  cursor: col-resize;
  background: var(--vscode-panel-bg);
}

.sidebar-splitter::before {
  content: "";
  position: absolute;
  inset: 0 3px;
  background: var(--vscode-border-strong);
}

.sidebar-splitter:hover::before {
  background: var(--vscode-accent);
}

.splitter {
  cursor: col-resize;
  background: var(--vscode-panel-bg);
  position: relative;
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

.splitter-grip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 42px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background:
    linear-gradient(to right,
      transparent 0,
      transparent 4px,
      var(--vscode-text-faint) 4px,
      var(--vscode-text-faint) 5px,
      transparent 5px,
      transparent 7px,
      var(--vscode-text-faint) 7px,
      var(--vscode-text-faint) 8px,
      transparent 8px,
      transparent 10px,
      var(--vscode-text-faint) 10px,
      var(--vscode-text-faint) 11px,
      transparent 11px);
  opacity: 0.8;
  transition: opacity 140ms ease, transform 140ms ease;
}

.splitter:hover .splitter-grip {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.04);
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
  font-family: "Segoe WPC", "Segoe UI", "Microsoft YaHei UI", sans-serif;
  direction: ltr;
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

.vscode-shell :deep(.monaco-scrollable-element > .scrollbar.vertical),
.vscode-shell :deep(.monaco-scrollable-element > .scrollbar.horizontal) {
  opacity: 1 !important;
}

.vscode-shell :deep(.monaco-scrollable-element > .scrollbar.vertical) {
  width: 12px !important;
}

.vscode-shell :deep(.monaco-scrollable-element > .scrollbar.horizontal) {
  height: 12px !important;
}

.vscode-shell :deep(.monaco-scrollable-element > .scrollbar > .slider) {
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  background: #5a5a5a !important;
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

.markdown-preview :deep(.task-list-item) {
  list-style: none;
}

.markdown-preview :deep(.task-list-checkbox) {
  margin: 0 10px 0 -1.6em;
  vertical-align: middle;
  accent-color: var(--vscode-accent);
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
  font-family: Consolas, "Cascadia Mono", "Courier New", monospace;
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
  font-family: Consolas, "Cascadia Mono", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.45;
}

.markdown-preview :deep(.hljs) {
  color: var(--vscode-text);
}

.markdown-preview :deep(.hljs-comment),
.markdown-preview :deep(.hljs-quote) {
  color: var(--vscode-code-comment);
}

.markdown-preview :deep(.hljs-keyword),
.markdown-preview :deep(.hljs-selector-tag),
.markdown-preview :deep(.hljs-literal),
.markdown-preview :deep(.hljs-section),
.markdown-preview :deep(.hljs-link) {
  color: var(--vscode-code-keyword);
}

.markdown-preview :deep(.hljs-string),
.markdown-preview :deep(.hljs-title),
.markdown-preview :deep(.hljs-name),
.markdown-preview :deep(.hljs-type),
.markdown-preview :deep(.hljs-attribute),
.markdown-preview :deep(.hljs-symbol),
.markdown-preview :deep(.hljs-bullet),
.markdown-preview :deep(.hljs-addition) {
  color: var(--vscode-code-string);
}

.markdown-preview :deep(.hljs-number),
.markdown-preview :deep(.hljs-meta),
.markdown-preview :deep(.hljs-built_in),
.markdown-preview :deep(.hljs-builtin-name) {
  color: var(--vscode-code-number);
}

.markdown-preview :deep(.hljs-function),
.markdown-preview :deep(.hljs-title.function_) {
  color: var(--vscode-code-function);
}

.markdown-preview :deep(.hljs-variable),
.markdown-preview :deep(.hljs-template-variable),
.markdown-preview :deep(.hljs-params) {
  color: var(--vscode-code-variable);
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

.context-menu {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  padding: 6px 0;
  border: 1px solid var(--vscode-border-strong);
  background: var(--vscode-panel-bg);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
  animation: menu-in 120ms ease-out;
}

.context-menu-item {
  height: 30px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--vscode-text);
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.context-menu-item:hover {
  background: var(--vscode-hover-bg);
}

.context-menu-item.danger {
  color: #e5534b;
}

@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.is-editor-focused .pane-editor,
.is-preview-focused .pane-preview {
  box-shadow: inset 0 0 0 1px var(--vscode-accent);
}

@media (max-width: 960px) {
  .workbench {
    grid-template-columns: minmax(200px, 220px) 8px minmax(0, 1fr);
  }

  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(280px, 1fr) 1px minmax(240px, 1fr);
  }

  .splitter {
    height: 1px;
  }

  .splitter-grip {
    display: none;
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
