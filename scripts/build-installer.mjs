import { cpSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { networkInterfaces } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const backendRoot = resolve(frontendRoot, '../mobile-standalone-backend')
const target = (process.argv[2] || 'mac').toLowerCase()

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: process.env })
  if (r.status !== 0) {
    process.exit(r.status || 1)
  }
}

function resolveMvn() {
  const candidates = [
    process.env.MVN_PATH,
    'mvn',
    '/opt/homebrew/bin/mvn',
    '/usr/local/bin/mvn',
    '/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn'
  ].filter(Boolean)
  for (const c of candidates) {
    if (c === 'mvn') {
      const r = spawnSync('which', ['mvn'], { encoding: 'utf8' })
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim()
      continue
    }
    if (existsSync(c)) return c
  }
  return null
}

if (!existsSync(join(backendRoot, 'pom.xml'))) {
  console.error('找不到后端目录:', backendRoot)
  process.exit(1)
}

const mvn = resolveMvn()
if (!mvn) {
  console.error('找不到 mvn。请安装 Maven，或设置 MVN_PATH')
  process.exit(1)
}
if (!process.env.JAVA_HOME && existsSync('/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home')) {
  process.env.JAVA_HOME = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'
}
run(mvn, ['-DskipTests', 'package'], backendRoot)

const jarName = 'mobile-standalone-backend-1.0.0.jar'
const jarSrc = join(backendRoot, 'target', jarName)
if (!existsSync(jarSrc)) {
  console.error('后端 jar 未生成:', jarSrc)
  process.exit(1)
}

const destDir = join(frontendRoot, 'resources', 'backend')
mkdirSync(destDir, { recursive: true })
cpSync(jarSrc, join(destDir, jarName))
console.log('已放入安装包资源:', join(destDir, jarName))

function detectLanIp() {
  const fromEnv = process.env.CONTROL_PLANE_URL
  if (fromEnv) {
    try {
      const href = fromEnv.includes('://') ? fromEnv : `http://${fromEnv}`
      return new URL(href).hostname
    } catch {
      return fromEnv.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
    }
  }
  const nets = networkInterfaces()
  const skip = (addr) =>
    !addr ||
    addr.internal ||
    addr.family === 'IPv6' ||
    addr.family === 6 ||
    String(addr.address).startsWith('169.254.') ||
    String(addr.address).startsWith('198.18.')
  const preferred = ['en0', 'en1', 'eth0', 'Ethernet', 'Wi-Fi', 'WiFi', 'WLAN']
  for (const name of preferred) {
    for (const a of nets[name] || []) {
      if (!skip(a) && (a.family === 'IPv4' || a.family === 4)) return a.address
    }
  }
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      if (!skip(a) && (a.family === 'IPv4' || a.family === 4)) return a.address
    }
  }
  return ''
}

function resolveControlPlaneUrl() {
  const env = (process.env.CONTROL_PLANE_URL || '').trim()
  if (env.includes('://')) {
    const s = env.replace(/\/+$/, '')
    return s.endsWith('/api') ? s : `${s}/api`
  }
  const ip = detectLanIp()
  if (!ip) {
    console.warn('无法探测局域网 IP，请设置 CONTROL_PLANE_URL，例如 http://192.168.10.5:3000/api')
    return 'http://192.168.10.5:3000/api'
  }
  return `http://${ip}:3000/api`
}

const controlPlaneUrl = resolveControlPlaneUrl()
writeFileSync(
  join(frontendRoot, 'resources', 'control-plane.json'),
  JSON.stringify({ controlPlaneUrl }, null, 2) + '\n'
)
process.env.VITE_CONTROL_PLANE_URL = controlPlaneUrl
console.log('安装包控制面地址:', controlPlaneUrl)

const builderArgs =
  target === 'win' ? ['--win', '--x64'] : target === 'linux' ? ['--linux'] : ['--mac']
run('npx', ['vite', 'build'], frontendRoot)
run('npx', ['electron-builder', ...builderArgs], frontendRoot)
console.log('\n安装包在:', join(frontendRoot, 'release'))
