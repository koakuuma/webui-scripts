<template>
  <div class="app">
    <header class="header">
      <h1>🛠️ 示例工具</h1>
      <p class="subtitle">这是一个使用 Vue 3 + TypeScript 开发的示例工具</p>
    </header>

    <main class="main">
      <div class="card">
        <h2>计数器示例</h2>
        <div class="counter">
          <button @click="decrement" class="btn">-</button>
          <span class="count">{{ count }}</span>
          <button @click="increment" class="btn">+</button>
        </div>
        <button @click="reset" class="btn-reset">重置</button>
      </div>

      <div class="card">
        <h2>输入示例</h2>
        <input v-model="message" type="text" placeholder="输入一些文字..." class="input" />
        <p class="message" v-if="message">你输入了: {{ message }}</p>
      </div>

      <div class="card">
        <h2>列表示例</h2>
        <ul class="list">
          <li v-for="item in items" :key="item.id" class="list-item">
            {{ item.text }}
          </li>
        </ul>
      </div>
    </main>

    <footer class="footer">
      <p>使用 Vue 3 + TypeScript + Vite 构建</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface ListItem {
  id: number
  text: string
}

const count = ref(0)
const message = ref('')
const items = ref<ListItem[]>([
  { id: 1, text: '这是第一个列表项' },
  { id: 2, text: '这是第二个列表项' },
  { id: 3, text: '这是第三个列表项' }
])

const increment = () => {
  count.value++
}

const decrement = () => {
  count.value--
}

const reset = () => {
  count.value = 0
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
}

.main {
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card h2 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.count {
  font-size: 3rem;
  font-weight: bold;
  color: #667eea;
  min-width: 100px;
  text-align: center;
}

.btn {
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  background: #667eea;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  background: #764ba2;
  transform: scale(1.1);
}

.btn:active {
  transform: scale(0.95);
}

.btn-reset {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: #f0f0f0;
  color: #333;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: #e0e0e0;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.message {
  margin-top: 1rem;
  padding: 1rem;
  background: #f0f0f0;
  border-radius: 8px;
  color: #333;
}

.list {
  list-style: none;
  padding: 0;
}

.list-item {
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.footer {
  background: #f8f9fa;
  padding: 2rem;
  text-align: center;
  color: #666;
}
</style>