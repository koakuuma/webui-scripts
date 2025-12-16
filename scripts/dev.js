import { spawn } from 'child_process'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const scriptsDir = join(rootDir, 'src/tools')

// 获取所有工具目录
function getAllTools() {
  if (!existsSync(scriptsDir)) {
    console.error('错误: src/tools 目录不存在')
    process.exit(1)
  }

  const tools = readdirSync(scriptsDir).filter(name => {
    const toolPath = join(scriptsDir, name)
    return statSync(toolPath).isDirectory() && existsSync(join(toolPath, 'index.ts'))
  })

  return tools
}

// 启动开发服务器
function startDevServer(toolName, port) {
  const toolPath = join(scriptsDir, toolName)
  
  console.log(`\n启动 ${toolName} 开发服务器 (端口: ${port})...`)
  
  const viteProcess = spawn(
    'npx',
    ['vite', '--port', port.toString()],
    {
      cwd: toolPath,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        TOOL_NAME: toolName
      }
    }
  )

  viteProcess.on('error', (error) => {
    console.error(`启动失败: ${error.message}`)
  })

  return viteProcess
}

// 主函数
async function main() {
  const tools = getAllTools()

  if (tools.length === 0) {
    console.log('没有找到任何工具')
    return
  }

  console.log('可用的工具:')
  tools.forEach((tool, index) => {
    console.log(`  ${index + 1}. ${tool}`)
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('\n请选择要开发的工具 (输入序号或名称): ', (answer) => {
    rl.close()

    let selectedTool
    const num = parseInt(answer)
    
    if (!isNaN(num) && num > 0 && num <= tools.length) {
      selectedTool = tools[num - 1]
    } else if (tools.includes(answer)) {
      selectedTool = answer
    } else {
      console.error('无效的选择')
      process.exit(1)
    }

    const port = 5173
    const devProcess = startDevServer(selectedTool, port)

    // 处理退出信号
    process.on('SIGINT', () => {
      console.log('\n正在关闭开发服务器...')
      devProcess.kill()
      process.exit(0)
    })
  })
}

main()