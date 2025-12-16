import { execSync } from 'child_process'
import { readdirSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const scriptsDir = join(rootDir, 'src/tools')

// 获取命令行参数（工具名称）
const toolName = process.argv[2]

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

// 构建单个工具
function buildTool(name) {
  console.log(`\n正在编译工具: ${name}`)
  
  const toolPath = join(scriptsDir, name)
  const outDir = join(rootDir, 'docs', name)
  
  try {
    execSync(
      `npx vite build --config vite.config.ts --outDir ${outDir}`,
      {
        stdio: 'inherit',
        cwd: toolPath,
        env: {
          ...process.env,
          TOOL_NAME: name
        }
      }
    )
    console.log(`✓ ${name} 编译完成`)
  } catch (error) {
    console.error(`✗ ${name} 编译失败`)
    throw error
  }
}

// 主函数
function main() {
  const tools = getAllTools()

  if (tools.length === 0) {
    console.log('没有找到任何工具')
    return
  }

  if (toolName) {
    // 编译指定工具
    if (!tools.includes(toolName)) {
      console.error(`错误: 工具 "${toolName}" 不存在`)
      console.log('可用的工具:', tools.join(', '))
      process.exit(1)
    }
    buildTool(toolName)
  } else {
    // 编译所有工具
    console.log(`找到 ${tools.length} 个工具，开始编译...\n`)
    let successCount = 0
    let failCount = 0

    for (const tool of tools) {
      try {
        buildTool(tool)
        successCount++
      } catch (error) {
        failCount++
      }
    }

    console.log(`\n编译完成: 成功 ${successCount} 个, 失败 ${failCount} 个`)
    
    if (failCount > 0) {
      process.exit(1)
    }
  }
}

main()