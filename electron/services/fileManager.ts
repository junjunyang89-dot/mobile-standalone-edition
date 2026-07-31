import { readdir, readFile, stat, existsSync } from 'fs-extra'
import { join, basename, extname } from 'path'

export interface Report {
  id: string
  name: string
  path: string
  createdAt: number
  size: number
}

export class FileManager {
  private dataDir: string
  private reportsDir: string

  constructor(dataDir: string, reportsDir: string) {
    this.dataDir = dataDir
    this.reportsDir = reportsDir
  }

  async readProject(projectPath: string): Promise<any> {
    // 读取项目配置
    const configPath = join(projectPath, 'pom.xml') // Maven项目
    if (existsSync(configPath)) {
      const content = await readFile(configPath, 'utf-8')
      return {
        type: 'maven',
        path: projectPath,
        config: content
      }
    }

    const packageJsonPath = join(projectPath, 'package.json')
    if (existsSync(packageJsonPath)) {
      const content = await readFile(packageJsonPath, 'utf-8')
      return {
        type: 'node',
        path: projectPath,
        config: JSON.parse(content)
      }
    }

    return {
      type: 'unknown',
      path: projectPath
    }
  }

  async listReports(): Promise<Report[]> {
    try {
      if (!existsSync(this.reportsDir)) {
        return []
      }

      const files = await readdir(this.reportsDir)
      const reports: Report[] = []

      for (const file of files) {
        const filePath = join(this.reportsDir, file)
        const stats = await stat(filePath)
        
        if (stats.isDirectory()) {
          // 检查是否是Allure报告目录
          const indexPath = join(filePath, 'index.html')
          if (existsSync(indexPath)) {
            reports.push({
              id: file,
              name: file,
              path: filePath,
              createdAt: stats.birthtimeMs,
              size: stats.size
            })
          }
        } else if (extname(file) === '.html') {
          reports.push({
            id: file,
            name: basename(file, '.html'),
            path: filePath,
            createdAt: stats.birthtimeMs,
            size: stats.size
          })
        }
      }

      return reports.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('List reports error:', error)
      return []
    }
  }

  async getReport(reportId: string): Promise<Report | null> {
    const reports = await this.listReports()
    return reports.find(r => r.id === reportId) || null
  }
}
