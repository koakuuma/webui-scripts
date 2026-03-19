import { defineComponent, computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render'

export default defineComponent({
  name: 'MarkdownEditorApp',
  setup() {

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
const DEFAULT_FILE_NAME = 'Markdown Example.md'
const DEFAULT_UNTITLED_PREFIX = 'Untitled'
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 520
const MIN_PREVIEW_WIDTH = 280
const PROJECT_URL = 'https://github.com/koakuuma/webui-scripts'
const DEFAULT_NEW_FILE_CONTENT = `# Markdown Example

Welcome to this Markdown workspace.
欢迎使用这个 Markdown 工作区。
## Basic Formatting
## 基础格式

- Bold: **important**
- 加粗：**important**
- Italic: *note*
- 斜体：*note*
- Inline code: \`npm run dev\`
- 行内代码：\`npm run dev\`

## Checklist
## 检查清单
- [x] Live preview
- [x] 实时预览
- [x] Ctrl+S save
- [x] Ctrl+S 保存
- [x] IndexedDB persistence
- [x] IndexedDB 持久化
## Code Block
## 代码块
\`\`\`ts
export function greet(name: string) {
  return \`Hello, \${name}\`
}
\`\`\`

## Quote
## 引用

> Markdown lets you focus on writing.
> Markdown 让你更专注于写作。
## Table
## 表格

| Section | Status |
| --- | --- |
| Editor | Ready |
| Preview | Synced |

| 项目 | 状态 |
| --- | --- |
| 编辑器 | 就绪 |
| 预览区 | 已同步 |
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
const editorContextMenu = ref({
  visible: false,
  x: 0,
  y: 0
})
const middleScrollState = ref<{
  target: 'editor' | 'preview'
  startY: number
  startTop: number
} | null>(null)

let dbPromise: Promise<IDBDatabase> | null = null
let syncingEditor = false
let syncingPreview = false
let suppressEditorChange = false
let isResizingSidebar = false
let isResizingPreview = false
let previewSyncFrame = 0
let editorSyncFrame = 0
let renderTimer = 0
let renderVersion = 0
let untypedFenceDecorations: string[] = []
let nativeContextMenuArmed: { scope: 'editor' | 'file'; key: string } | null = null

const activeFile = computed(() => files.value.find((file) => file.id === activeFileId.value) ?? null)
const activeContent = computed(() => activeFile.value?.content ?? '')
const lineCount = computed(() => (activeContent.value ? activeContent.value.split('\n').length : 0))
const cursorStatus = computed(() => `Ln ${cursorLine.value}, Col ${cursorColumn.value}`)
const titleText = computed(() => activeFile.value?.name ?? 'No File')
const markdownUtils = new MarkdownIt().utils
const escapeHtml = (source: string) => markdownUtils.escapeHtml(source)

const md: MarkdownIt = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: (source: string, language: string): string => {
    if (!language) {
      return escapeHtml(source)
    }

    if (hljs.getLanguage(language)) {
      try {
        return hljs.highlight(source, { language }).value
      } catch {
      }
    }

    return escapeHtml(source)
  }
})

function setRenameInput(element: Element | import('vue').ComponentPublicInstance | null) {
  renameInput.value = element instanceof HTMLInputElement ? element : null
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
    ? (md.options.highlight?.(source, language, '') || escapeHtml(source))
    : escapeHtml(source)
  const lineAttr = line !== null ? ` data-source-line="${line + 1}"` : ''
  const languageClass = language ? `language-${escapeHtml(language)}` : 'language-plaintext'
  const languageLabel = language ? escapeHtml(language) : 'plaintext'

  return `<div class="code-block"${lineAttr}><div class="code-block-header">${languageLabel}</div><pre><code class="hljs ${languageClass}">${html}</code></pre></div>\n`
}

function enhanceTaskListTokens(state: any) {
  const tokens = state.tokens as any[]

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== 'list_item_open') continue

    let inlineToken: any = null
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const current = tokens[cursor]
      if (current.type === 'list_item_close') break
      if (current.type === 'inline') {
        inlineToken = current
        break
      }
    }

    if (!inlineToken || typeof inlineToken.content !== 'string') continue

    const match = inlineToken.content.match(/^\[( |x|X)\]\s+/)
    if (!match) continue

    const checked = /x/i.test(match[1])
    token.attrJoin('class', 'task-list-item')
    inlineToken.content = inlineToken.content.slice(match[0].length)

    const checkboxToken = new state.Token('html_inline', '', 0)
    checkboxToken.content = `<span class="task-list-checkbox${checked ? ' is-checked' : ''}" aria-hidden="true"></span>`

    if (!Array.isArray(inlineToken.children) || inlineToken.children.length === 0) {
      inlineToken.children = [checkboxToken]
      continue
    }

    const firstTextToken = inlineToken.children.find((child: any) => child.type === 'text' && typeof child.content === 'string')
    if (firstTextToken) {
      firstTextToken.content = firstTextToken.content.replace(/^\[( |x|X)\]\s+/, '')
    }

    inlineToken.children.unshift(checkboxToken)
  }
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
    contextmenu: false,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'hidden',
      alwaysConsumeMouseWheel: false,
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  })

  editorInstance.value.onDidFocusEditorText(() => {
    activePane.value = 'editor'
  })

  editorInstance.value.onDidChangeCursorPosition((event: monaco.editor.ICursorPositionChangedEvent) => {
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
    updateUntypedFenceDecorations()
  })

  editorInstance.value.onDidScrollChange(() => {
    handleEditorScroll()
  })

  editorInstance.value.onContextMenu((event: monaco.editor.IEditorMouseEvent) => {
    if (!editorInstance.value) return

    const position = event.target.position
    if (position) {
      editorInstance.value.setPosition(position)
    }

    editorInstance.value.focus()
    openEditorContextMenu(event.event.browserEvent)
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
  updateUntypedFenceDecorations()

  if (activeFile.value) {
    window.setTimeout(() => editorInstance.value?.focus(), 0)
  }
}

function updateUntypedFenceDecorations() {
  if (!editorInstance.value) return

  const lines = activeContent.value.split('\n')
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  let fenceStart = -1
  let hasLanguage = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fenceMatch = line.match(/^```(.*)$/)

    if (!fenceMatch) continue

    if (fenceStart === -1) {
      fenceStart = index
      hasLanguage = fenceMatch[1].trim().length > 0
      continue
    }

    if (!hasLanguage && index > fenceStart + 1) {
      decorations.push({
        range: new monaco.Range(fenceStart + 2, 1, index, 1),
        options: {
          isWholeLine: true,
          className: 'untyped-fence-line'
        }
      })
    }

    fenceStart = -1
    hasLanguage = false
  }

  untypedFenceDecorations = editorInstance.value.deltaDecorations(untypedFenceDecorations, decorations)
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
  if (!preview.value || !activeFile.value) return

  handleEditorScroll()
}

function handleEditorScroll() {
  if (!editorInstance.value || !previewScrollContainer.value || syncingEditor || !activeFile.value) return
  const editorMaxScroll = Math.max(0, editorInstance.value.getScrollHeight() - editorInstance.value.getLayoutInfo().height)
  const previewMaxScroll = Math.max(0, previewScrollContainer.value.scrollHeight - previewScrollContainer.value.clientHeight)
  const currentTop = editorInstance.value.getScrollTop()
  const progress = editorMaxScroll > 0 ? currentTop / editorMaxScroll : 0
  const targetTop = previewMaxScroll * Math.max(0, Math.min(1, progress))

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
  const previewMaxScroll = Math.max(0, previewScrollContainer.value.scrollHeight - previewScrollContainer.value.clientHeight)
  const editorMaxScroll = Math.max(0, editorInstance.value.getScrollHeight() - editorInstance.value.getLayoutInfo().height)
  const progress = previewMaxScroll > 0 ? top / previewMaxScroll : 0
  const targetTop = editorMaxScroll * Math.max(0, Math.min(1, progress))

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
  if (shouldAllowNativeContextMenu('file', fileId)) {
    closeContextMenu(false)
    return
  }

  event.preventDefault()
  closeEditorContextMenu(false)
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    fileId
  }
}

function closeContextMenu(resetNativeContextMenu = true) {
  contextMenu.value.visible = false
  if (resetNativeContextMenu) {
    nativeContextMenuArmed = null
  }
}

function openEditorContextMenu(event: MouseEvent) {
  if (shouldAllowNativeContextMenu('editor', activeFileId.value || 'editor')) {
    closeEditorContextMenu(false)
    return
  }

  event.preventDefault()
  closeContextMenu(false)
  editorContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY
  }
}

function closeEditorContextMenu(resetNativeContextMenu = true) {
  editorContextMenu.value.visible = false
  if (resetNativeContextMenu) {
    nativeContextMenuArmed = null
  }
}

function shouldAllowNativeContextMenu(scope: 'editor' | 'file', key: string) {
  const sameTarget = nativeContextMenuArmed?.scope === scope && nativeContextMenuArmed?.key === key
  nativeContextMenuArmed = sameTarget ? null : { scope, key }
  return sameTarget
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
  closeEditorContextMenu()
}

function getEditorSelectionText() {
  if (!editorInstance.value) return ''
  const selection = editorInstance.value.getSelection()
  if (!selection || selection.isEmpty()) return ''
  const model = editorInstance.value.getModel()
  return model?.getValueInRange(selection) ?? ''
}

async function copyFromEditor() {
  const selectedText = getEditorSelectionText()
  if (!selectedText) {
    closeEditorContextMenu()
    return
  }

  try {
    await navigator.clipboard.writeText(selectedText)
  } catch {
    editorInstance.value?.trigger('editor-context-menu', 'editor.action.clipboardCopyAction', null)
  }
  closeEditorContextMenu()
}

async function cutFromEditor() {
  if (!editorInstance.value) return

  const selection = editorInstance.value.getSelection()
  const selectedText = getEditorSelectionText()
  if (!selection || selection.isEmpty() || !selectedText) {
    closeEditorContextMenu()
    return
  }

  try {
    await navigator.clipboard.writeText(selectedText)
    editorInstance.value.executeEdits('editor-context-cut', [{
      range: selection,
      text: '',
      forceMoveMarkers: true
    }])
  } catch {
    editorInstance.value.trigger('editor-context-menu', 'editor.action.clipboardCutAction', null)
  }
  closeEditorContextMenu()
}

async function pasteIntoEditor() {
  if (!editorInstance.value) return

  try {
    const clipboardText = await navigator.clipboard.readText()
    const selection = editorInstance.value.getSelection()
    if (!selection) {
      closeEditorContextMenu()
      return
    }

    editorInstance.value.executeEdits('editor-context-paste', [{
      range: selection,
      text: clipboardText,
      forceMoveMarkers: true
    }])
    editorInstance.value.focus()
  } catch {
    editorInstance.value.trigger('editor-context-menu', 'editor.action.clipboardPasteAction', null)
  } finally {
    closeEditorContextMenu()
  }
}

function handlePointerMove(event: MouseEvent) {
  if (middleScrollState.value) {
    const { target, startY, startTop } = middleScrollState.value
    const nextTop = Math.max(0, startTop + (event.clientY - startY) * 5)

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
md.core.ruler.after('inline', 'task-list-items', enhanceTaskListTokens)
md.renderer.rules.code_block = (tokens: any[], idx: number) => {
  const line = tokens[idx].map ? tokens[idx].map[0] : null
  return renderCodeBlock(tokens[idx].content, '', line, false)
}
md.renderer.rules.fence = (tokens: any[], idx: number) => {
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

    return {
      activePane,
      titleText,
      sidebarWidth,
      startCreateFile,
      files,
      renamingFileId,
      activeFileId,
      selectFile,
      openFileContextMenu,
      setRenameInput,
      renameFileName,
      confirmRenameFile,
      cancelRenameFile,
      editorGrid,
      previewWidth,
      activeFile,
      setActivePane,
      startMiddleScroll,
      editorHost,
      startPreviewResize,
      previewScrollContainer,
      handlePreviewScroll,
      renderedContent,
      cursorStatus,
      lineCount,
      contextMenu,
      editorContextMenu,
      beginRenameFromContext,
      deleteContextFile,
      copyFromEditor,
      pasteIntoEditor,
      cutFromEditor,
      startSidebarResize,
      saveAndCloseCurrentFile,
      openProjectLink,
    }
  }
})

