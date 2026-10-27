import { computed, ref } from 'vue'
import { apiClient } from '../api'

/**
 * 登录态。
 *
 * 角色规则<b>全部由后端下发</b>，这里不写第二份判断。
 * 两份规则迟早对不上，而对不上的表现极难查：后端拦了、前端没禁用，
 * 用户看到的只是一句「操作失败」，根本想不到是权限问题。
 */

const TOKEN_KEY = 'platform-auth-token'

export interface CurrentUser {
  /** 平台还一个账号都没有——这时候鉴权整体不生效 */
  bootstrapping: boolean
  id?: string
  username: string
  displayName?: string
  role: string
  roleLabel: string
  canWrite?: boolean
  canDelete?: boolean
  canManageUsers?: boolean
  /** 后端算好的「这个角色 / 模块看不到的路由」，菜单和路由守卫都用它 */
  hiddenRoutes: string[]
  /** 模块目录里看得见的路由；和 hiddenRoutes 一起按最长匹配判断 */
  visibleRoutes?: string[]
  /** 管理员给这个账号限了功能模块 */
  moduleRestricted?: boolean
}

const token = ref<string>(readToken())
const currentUser = ref<CurrentUser | null>(null)
const loaded = ref(false)

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(value: string) {
  token.value = value || ''
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function getToken() {
  return token.value
}

export const user = computed(() => currentUser.value)
export const isLoggedIn = computed(() => !!currentUser.value)

/** 权限没生效时（还没建账号）一律放行，否则菜单会空掉，看起来像平台坏了 */
export const canWrite = computed(
  () => !currentUser.value || currentUser.value.bootstrapping || !!currentUser.value.canWrite
)
export const canDelete = computed(
  () => !currentUser.value || currentUser.value.bootstrapping || !!currentUser.value.canDelete
)
export const canManageUsers = computed(
  () => !!currentUser.value && (currentUser.value.bootstrapping || !!currentUser.value.canManageUsers)
)

/**
 * 这个路由当前账号能不能进。
 * <p>
 * 用最长匹配：勾了「性能报告」{@code /reports/esports/performance}、没勾「APP UI测试报告」{@code /reports}
 * 时，不能因为父路径在隐藏清单里就把子页面也挡掉。
 */
export function canVisit(path: string): boolean {
  const u = currentUser.value
  if (!u || u.bootstrapping) return true
  const p = path.startsWith('/') ? path : `/${path}`
  if (p === '/home' || p.startsWith('/home/')) return true

  let best = ''
  let allowed = true
  for (const r of u.visibleRoutes || []) {
    if ((p === r || p.startsWith(`${r}/`)) && r.length >= best.length) {
      best = r
      allowed = true
    }
  }
  for (const r of u.hiddenRoutes || []) {
    if ((p === r || p.startsWith(`${r}/`)) && r.length > best.length) {
      best = r
      allowed = false
    }
  }
  // 目录里没有的路由（工作台以外的落地页、重定向）默认放行；真正边界在后端
  if (!best) {
    return !(u.hiddenRoutes || []).some((r) => p === r || p.startsWith(`${r}/`))
  }
  return allowed
}

/**
 * 拉当前登录人。
 *
 * 拿不到就当未登录，不抛异常——它会在路由守卫里被调用，
 * 抛出去的结果是整个应用白屏，而不是跳到登录页。
 */
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  try {
    const me = await apiClient.fetchCurrentUser()
    currentUser.value = me
  } catch {
    currentUser.value = null
  }
  loaded.value = true
  return currentUser.value
}

export function isLoaded() {
  return loaded.value
}

export async function login(username: string, password: string) {
  const res = await apiClient.login(username, password)
  setToken(res.token)
  currentUser.value = res.user
  loaded.value = true
  return res.user
}

export async function bootstrapAdmin(username: string, displayName: string, password: string) {
  const res = await apiClient.bootstrapAdmin(username, displayName, password)
  setToken(res.token)
  currentUser.value = res.user
  loaded.value = true
  return res.user
}

export function logout() {
  setToken('')
  currentUser.value = null
  loaded.value = false
}

/**
 * 令牌失效时由 api 层通过事件通知。
 *
 * 直接改 location 而不是用 router：这个模块被 api 层引用，
 * 反过来再引 router 会绕成循环依赖，而循环依赖在打包后的表现是某个模块变成 undefined，
 * 报错位置和真正的原因隔着十万八千里。
 */
function onUnauthorized() {
  if (!token.value && !currentUser.value) return
  logout()
  if (!window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login'
  }
}

window.addEventListener('platform-unauthorized', onUnauthorized)
