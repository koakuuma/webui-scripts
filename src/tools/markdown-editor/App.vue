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
                @contextmenu="openFileContextMenu($event, file.id)"
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

      <div class="sidebar-splitter" aria-hidden="true" @mousedown.prevent="startSidebarResize">
        <span class="splitter-grip"></span>
      </div>

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

    <div
      v-if="editorContextMenu.visible"
      class="context-menu"
      :style="{ left: `${editorContextMenu.x}px`, top: `${editorContextMenu.y}px` }"
    >
      <button class="context-menu-item" type="button" @click="copyFromEditor">Copy</button>
      <button class="context-menu-item" type="button" @click="pasteIntoEditor">Paste</button>
      <button class="context-menu-item" type="button" @click="cutFromEditor">Cut</button>
    </div>
  </main>
</template>

<script lang="ts" src="./app.ts"></script>
<style scoped src="./App.scss"></style>
