import express from 'express'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = join(rootDir, 'dist')

const app = express()
const PORT = process.env.PORT || 43001

// 获取所有已编译的工具
function getCompiledTools() {
  if (!existsSync(distDir)) {
    return []
  }

  return readdirSync(distDir).filter(name => {
    const toolPath = join(distDir, name)
    return statSync(toolPath).isDirectory() && 
           existsSync(join(toolPath, 'index.html'))
  })
}

// 生成工具列表页面
function generateIndexPage(tools) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebUI 工具箱</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 40px;
      font-size: 2.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }
    .tool-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .tool-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 12px rgba(0,0,0,0.15);
    }
    .tool-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .tool-path {
      font-size: 0.875rem;
      color: #666;
      font-family: 'Courier New', monospace;
    }
    .empty-state {
      text-align: center;
      color: white;
      padding: 60px 20px;
    }
    .empty-state h2 {
      font-size: 1.5rem;
      margin-bottom: 16px;
    }
    .empty-state p {
      font-size: 1rem;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛠️ WebUI 工具箱</h1>
    ${tools.length > 0 ? `
      <div class="tools-grid">
        ${tools.map(tool => `
          <a href="/${tool}/" class="tool-card">
            <div class="tool-name">${tool}</div>
            <div class="tool-path">/${tool}/</div>
          </a>
        `).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <h2>暂无可用工具</h2>
        <p>请先运行 <code>yarn build</code> 编译工具</p>
      </div>
    `}
  </div>
</body>
</html>
  `
}

// 启动服务器
function startServer() {
  const tools = getCompiledTools()

  // 静态文件服务 - 必须在路由之前
  app.use(express.static(distDir))

  // 首页 - 工具列表
  app.get('/', (req, res) => {
    res.send(generateIndexPage(tools))
  })

  app.listen(PORT, () => {
    console.log(`\n✓ 服务器已启动`)
    console.log(`\n  本地访问: http://localhost:${PORT}`)
    console.log(`  可用工具: ${tools.length} 个\n`)
    
    if (tools.length > 0) {
      console.log('  工具列表:')
      tools.forEach(tool => {
        console.log(`    - ${tool}: http://localhost:${PORT}/${tool}/`)
      })
      console.log('')
    } else {
      console.log('  提示: 请先运行 yarn build 编译工具\n')
    }
  })
}

startServer()