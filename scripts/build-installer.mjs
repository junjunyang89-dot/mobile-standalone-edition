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

/**
 * 安装包里烧进去的控制面地址。
 *
 * 必须显式给 CONTROL_PLANE_URL，拿不到就直接终止打包。
 *
 * 原先的行为是「探测打包机自己的局域网 IP」，那比打包失败糟得多：
 *   1. 它会产出一个<b>看起来正常</b>的安装包，装到 50 台机器上全都指向打包那台 MacBook；
 *   2. 那台机器的 DHCP 地址一变，50 个客户端同时失效，而症状只是「连不上后端」，
 *      没人会想到是打包时烧进去的地址。
 * 少一个包比发出去 50 个错包好，所以这里宁可 fail-fast。
 *
 * 端口是 3080。这里原先写的是 3000 —— 后端端口在 2026-08-30 从 3000 迁到 3080 时，
 * 前端代码全改了，唯独漏了这个打包脚本，于是打出来的包装上就连不上。
 * 端口写成常量并和后端注明关系，就是为了下次迁移时这里不会再被漏掉。
 */
const CONTROL_PLANE_PORT = 3080 // 必须与后端 application.yml 的 server.port 一致

function resolveControlPlaneUrl() {
  const env = (process.env.CONTROL_PLANE_URL || '').trim()
  if (!env) {
    console.error(
      '\n打包中止：没有设置 CONTROL_PLANE_URL。\n' +
        '  这是客户端要连的后端地址，会烧进安装包，装到每台机器上。\n' +
        `  例：CONTROL_PLANE_URL=http://mac-studio.内网域名:${CONTROL_PLANE_PORT}/api npm run build:installer\n` +
        '  建议用固定 IP 或内网域名，不要用会变的 DHCP 地址 ——\n' +
        '  地址一变，所有已装的客户端会同时连不上，而报错看不出原因。\n'
    )
    process.exit(1)
  }
  if (env.includes('://')) {
    const s = env.replace(/\/+$/, '')
    const url = s.endsWith('/api') ? s : `${s}/api`
    warnIfSuspicious(url)
    return url
  }
  // 只给了主机名/IP，补上协议和端口
  const host = env.replace(/^https?:\/\//, '').split('/')[0]
  const url = host.includes(':')
    ? `http://${host}/api`
    : `http://${host}:${CONTROL_PLANE_PORT}/api`
  warnIfSuspicious(url)
  return url
}

/** 不阻止打包，但把两个最容易出事的情况说出来 */
function warnIfSuspicious(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') {
      console.warn(
        `\n注意：控制面地址是 ${u.hostname} —— 装到别人机器上时，这指向的是「他自己那台机器」，\n` +
          '  不是你的后端。除非这个包只给本机用，否则请换成 Mac Studio 的固定 IP 或内网域名。\n'
      )
    }
    if (u.port && u.port !== String(CONTROL_PLANE_PORT)) {
      console.warn(
        `\n注意：端口是 ${u.port}，而后端当前是 ${CONTROL_PLANE_PORT}。确认这是你要的。\n`
      )
    }
  } catch {
    console.warn(`\n注意：控制面地址解析不了：${url}\n`)
  }
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
