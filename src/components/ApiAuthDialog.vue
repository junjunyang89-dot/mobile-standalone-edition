<template>
  <el-dialog
    :model-value="modelValue"
    width="760px"
    class="auth-dialog"
    :show-close="false"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <template #header="{ close }">
      <div class="dlg-head">
        <div class="dlg-title">登录配置 · {{ project.toUpperCase() }}</div>
        <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="停用" />
        <button type="button" class="dlg-close" aria-label="关闭" @click="close">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div v-loading="loading" class="body">
      <div class="facts">
        <div class="fact">
          <span class="fact-num">{{ authRequired || !authUnknown ? authRequired : '—' }}</span>
          <span class="fact-label">个接口要登录<template v-if="total"> / 共 {{ total }}</template></span>
        </div>
        <div class="fact">
          <span class="fact-label">token 放在</span>
          <code v-for="h in headerList" :key="h" class="fact-code">{{ h }}</code>
          <span v-if="!headerList.length" class="fact-label">—</span>
        </div>
      </div>

      <div class="svc-bar">
        <span class="svc-label">登录服务</span>
        <el-select
          v-model="loginProject"
          filterable
          placeholder="选项目"
          class="svc-select"
          @change="onLoginProjectChange"
        >
          <el-option v-for="p in projectOptions" :key="p.code" :label="p.name || p.code" :value="p.code">
            <span>{{ p.name || p.code }}</span>
            <span v-if="p.name && p.name !== p.code" class="var-val">{{ p.code }}</span>
          </el-option>
        </el-select>
        <span v-for="e in envs" :key="e.value" class="svc-host" :class="{ empty: !svcHosts[e.value] }">
          <i class="seg-dot" :class="`is-${e.value.toLowerCase()}`" />
          <span class="svc-host-text">{{ svcHosts[e.value] || '未配' }}</span>
        </span>
        <el-button link type="primary" :disabled="!loginProject" @click="urlsVisible = true">配置地址 ›</el-button>
      </div>

      <div class="sec-head">
        <span class="sec-title">token 从哪来</span>
        <el-button link type="primary" size="small" :loading="detecting" @click="detect">
          <el-icon><Search /></el-icon>{{ candidates.length ? '重新识别' : '自动识别' }}
        </el-button>
      </div>
      <div v-if="candidates.length" class="cands">
        <button
          v-for="c in candidates"
          :key="c.repo + c.httpMethod + c.path"
          type="button"
          class="cand"
          :class="{ active: picked === c.repo + c.path, dim: !c.automatable }"
          @click="pick(c)"
        >
          <div class="cand-line">
            <span class="cand-repo">{{ c.repo }}</span>
            <span class="method" :class="`is-${c.httpMethod.toLowerCase()}`">{{ c.httpMethod }}</span>
            <span class="cand-path">{{ c.path }}</span>
            <span v-if="!c.automatable" class="cand-tag">需人工</span>
          </div>
          <div class="cand-sub">
            <span v-if="c.summary">{{ c.summary }}</span>
            <span v-if="c.callerRepos.length">客户端在调：{{ c.callerRepos.join('、') }}</span>
            <span v-else>客户端没在调</span>
          </div>
        </button>
      </div>

      <div class="form-grid">
        <label class="f-label">登录接口</label>
        <div class="f-row">
          <el-select v-model="form.loginMethod" class="f-method">
            <el-option label="POST" value="POST" />
            <el-option label="GET" value="GET" />
          </el-select>
          <div class="seg">
            <button
              v-for="e in envs"
              :key="e.value"
              type="button"
              class="seg-item"
              :class="{ active: env === e.value }"
              @click="env = e.value"
            >
              <i class="seg-dot" :class="`is-${e.value.toLowerCase()}`" />{{ e.label }}
            </button>
          </div>
        </div>

        <label class="f-label">{{ envLabel }}地址</label>
        <el-input
          v-if="env === 'TEST'"
          v-model="form.loginUrlTest"
          class="mono"
          placeholder="http://host:port/account/login"
        />
        <el-input v-else v-model="form.loginUrlProd" class="mono" placeholder="https://host/account/login" />

        <label class="f-label">{{ envLabel }}账号</label>
        <div class="f-row">
          <el-input v-model="creds[env].account" class="mono" placeholder="账号 / 手机号">
            <template #append>
              <el-dropdown trigger="click" max-height="280px" @command="(n: string) => (creds[env].account = ref$(n))">
                <span class="var-btn">变量<el-icon><ArrowDown /></el-icon></span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="v in varOptions" :key="v.name" :command="v.name">
                      <span class="var-name">{{ v.name }}</span>
                      <span class="var-val">{{ v.preview }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!varOptions.length" disabled>{{ envLabel }}环境没有变量</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-input>
          <el-input
            v-model="creds[env].secret"
            class="mono"
            :type="isRef(creds[env].secret) ? 'text' : 'password'"
            :show-password="!isRef(creds[env].secret)"
            placeholder="密码 / 验证码"
            @focus="clearMask"
          >
            <template #append>
              <el-dropdown trigger="click" max-height="280px" @command="(n: string) => (creds[env].secret = ref$(n))">
                <span class="var-btn">变量<el-icon><ArrowDown /></el-icon></span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="v in varOptions" :key="v.name" :command="v.name">
                      <span class="var-name">{{ v.name }}</span>
                      <span class="var-val">{{ v.preview }}</span>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!varOptions.length" disabled>{{ envLabel }}环境没有变量</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-input>
        </div>

        <label class="f-label">请求体</label>
        <el-input v-model="form.loginBody" type="textarea" :rows="5" class="mono" />

        <label class="f-label">token 头</label>
        <el-input v-model="form.tokenHeaders" class="mono" placeholder="token,accessToken" />

        <label class="f-label">token 位置</label>
        <el-input v-model="form.tokenPath" class="mono" placeholder="留空自动找" />
      </div>

      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'is-ok' : 'is-fail'">
        <template v-if="testResult.ok">
          拿到 token <code>{{ testResult.token }}</code>
          <span v-if="testResult.path" class="faint">（{{ testResult.path }}）</span>
        </template>
        <template v-else>{{ testResult.message }}</template>
      </div>
    </div>

    <template #footer>
      <div class="foot">
        <el-button :loading="testing" @click="testLogin">试一下{{ envLabel }}登录</el-button>
        <span class="foot-space" />
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button v-perm:write type="primary" :loading="saving" @click="save(true)">保存</el-button>
      </div>
    </template>
  </el-dialog>

  <ProjectUrlsDialog
    v-model="urlsVisible"
    :project="loginProject ? { code: loginProject, name: loginProjectName } : null"
    @changed="onUrlsChanged"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, Close, Search } from '@element-plus/icons-vue'
import { apiClient, type ApiLoginCandidate } from '../api'
import ProjectUrlsDialog from './ProjectUrlsDialog.vue'

const MASK = '••••••••••'

const props = defineProps<{
  modelValue: boolean
  project: string
  /** 全量扫描时填的源码目录；识别登录接口时搜它的上一级 */
  sourceDir?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const envs = [
  { value: 'TEST', label: '测试' },
  { value: 'PROD', label: '生产' }
] as const
type Env = (typeof envs)[number]['value']

const loading = ref(false)
const detecting = ref(false)
const saving = ref(false)
const testing = ref(false)
const env = ref<Env>('TEST')
const authRequired = ref(0)
const authUnknown = ref(0)
const total = ref(0)
const candidates = ref<ApiLoginCandidate[]>([])
const picked = ref('')
const testResult = ref<{ ok: boolean; token?: string; path?: string; message?: string } | null>(null)

const form = reactive({
  enabled: true,
  loginMethod: 'POST',
  loginUrlTest: '',
  loginUrlProd: '',
  loginBody: '',
  tokenHeaders: '',
  tokenPath: ''
})
const creds = reactive<Record<Env, { account: string; secret: string }>>({
  TEST: { account: '', secret: '' },
  PROD: { account: '', secret: '' }
})

const envLabel = computed(() => (env.value === 'TEST' ? '测试' : '生产'))

const LOGIN_PROJECT_KEY = 'apiAuth.loginProject'
const projectOptions = ref<Array<{ code: string; name: string }>>([])
const loginProject = ref('')
const urlsVisible = ref(false)
const svcHosts = reactive<Record<Env, string>>({ TEST: '', PROD: '' })
const loginProjectName = computed(
  () => projectOptions.value.find((p) => p.code === loginProject.value)?.name || loginProject.value
)

/** 登录配置自己存的那两个不列：选它等于自己引用自己 */
const OWN_VARS = new Set(['loginAccount', 'loginSecret'])
const vars = reactive<Record<Env, Array<{ name: string; preview: string }>>>({ TEST: [], PROD: [] })
const varOptions = computed(() => vars[env.value])

async function loadVars() {
  for (const e of ['TEST', 'PROD'] as Env[]) {
    try {
      const rows = await apiClient.getApiTestVariables(e, props.project)
      vars[e] = (rows || [])
        .filter((v) => v.enabled !== false && !OWN_VARS.has(v.name))
        .map((v) => ({ name: v.name, preview: v.secret ? '••••' : String(v.value ?? '').slice(0, 24) }))
    } catch {
      vars[e] = []
    }
  }
}

function ref$(name: string) {
  return `{{${name}}}`
}

function isRef(v: string) {
  return /^\{\{\s*[\w.\-$]+\s*\}\}$/.test((v || '').trim())
}
const headerList = computed(() =>
  form.tokenHeaders
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
)

async function onOpen() {
  testResult.value = null
  candidates.value = []
  picked.value = ''
  env.value = 'TEST'
  loadVars()
  const projectsReady = loadProjects()
  loading.value = true
  try {
    const r = await apiClient.getApiAuth(props.project)
    const p = r.profile || {}
    form.enabled = p.enabled !== false
    form.loginMethod = p.loginMethod || 'POST'
    form.loginUrlTest = p.loginUrlTest || ''
    form.loginUrlProd = p.loginUrlProd || ''
    form.loginBody = p.loginBody || ''
    form.tokenHeaders = p.tokenHeaders || ''
    form.tokenPath = p.tokenPath || ''
    for (const e of ['TEST', 'PROD'] as Env[]) {
      creds[e].account = r.credentials?.[e]?.account || ''
      creds[e].secret = r.credentials?.[e]?.secret || ''
    }
    authRequired.value = r.authRequired || 0
    authUnknown.value = r.authUnknown || 0
    total.value = r.total || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
  await projectsReady
  loginProject.value = await resolveLoginProject()
  await applyHosts(false)
  if (!form.loginUrlTest && !form.loginUrlProd) detect()
}

async function detect() {
  detecting.value = true
  try {
    const r = await apiClient.detectApiLogin(props.project, props.sourceDir)
    candidates.value = r.candidates || []
    if (!form.tokenHeaders && r.tokenHeaders) form.tokenHeaders = r.tokenHeaders
    const best = candidates.value[0]
    if (best?.automatable && !form.loginUrlTest && !form.loginUrlProd) await pick(best)
    if (!candidates.value.length) ElMessage.info(`在 ${r.searched} 下没找到登录接口`)
  } catch (e: any) {
    ElMessage.error(e?.message || '识别失败')
  } finally {
    detecting.value = false
  }
}

const HOST_RE = /^https?:\/\/[^/]+/i

function hostOf(url: string) {
  return (url || '').trim().match(HOST_RE)?.[0].toLowerCase() || ''
}

function withHost(url: string, host: string) {
  if (!host) return url
  const path = (url || '').trim().replace(HOST_RE, '')
  return host + (!path || path.startsWith('/') ? path : '/' + path)
}

function baseOf(u: any) {
  return String(u?.baseUrl || '').trim().replace(/\/+$/, '')
}

async function loadProjects() {
  try {
    projectOptions.value = (await apiClient.getApiProjects()) || []
  } catch {
    projectOptions.value = []
  }
}

function projectForRepo(repo: string) {
  const r = repo.toLowerCase()
  const codes = projectOptions.value.map((p) => p.code)
  return (
    codes.find((c) => c.toLowerCase() === r) ||
    codes.find((c) => c.toLowerCase().endsWith('-' + r) || c.toLowerCase().startsWith(r + '-')) ||
    codes.find((c) => c.toLowerCase().includes(r)) ||
    ''
  )
}

/** 登录接口所在服务按页面项目记住；没记过就拿地址里的域名反查 */
async function resolveLoginProject() {
  const stored = readLoginProjects()[props.project]
  if (stored) return stored
  const hosts = [hostOf(form.loginUrlTest), hostOf(form.loginUrlProd)].filter(Boolean)
  if (!hosts.length) return ''
  try {
    const rows = await apiClient.getApiUrls({ enabledOnly: true })
    const hit = (rows || []).find((u) => u.project && hosts.includes(hostOf(baseOf(u))))
    return hit?.project || ''
  } catch {
    return ''
  }
}

function readLoginProjects(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_PROJECT_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function rememberLoginProject(code: string) {
  const all = readLoginProjects()
  if (code) all[props.project] = code
  else delete all[props.project]
  localStorage.setItem(LOGIN_PROJECT_KEY, JSON.stringify(all))
}

/** 同环境的优先，其次通用；overwrite=false 只给还没域名的地址补上 */
async function applyHosts(overwrite: boolean) {
  svcHosts.TEST = ''
  svcHosts.PROD = ''
  if (!loginProject.value) return
  try {
    const rows = ((await apiClient.getApiUrls({ project: loginProject.value, enabledOnly: true })) || [])
      .filter((u) => baseOf(u))
      .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
    for (const e of ['TEST', 'PROD'] as Env[]) {
      const row = rows.find((u) => u.environment === e) || rows.find((u) => u.environment === 'ANY')
      svcHosts[e] = baseOf(row)
    }
  } catch {
    return
  }
  if (svcHosts.TEST && (overwrite || !hostOf(form.loginUrlTest))) {
    form.loginUrlTest = withHost(form.loginUrlTest, svcHosts.TEST)
  }
  if (svcHosts.PROD && (overwrite || !hostOf(form.loginUrlProd))) {
    form.loginUrlProd = withHost(form.loginUrlProd, svcHosts.PROD)
  }
}

function onLoginProjectChange(code: string) {
  rememberLoginProject(code)
  applyHosts(true)
}

function onUrlsChanged() {
  applyHosts(true)
}

async function pick(c: ApiLoginCandidate) {
  picked.value = c.repo + c.path
  form.loginMethod = c.httpMethod === 'GET' ? 'GET' : 'POST'
  form.loginBody = c.bodyTemplate
  form.tokenPath = ''
  form.loginUrlTest = c.path
  form.loginUrlProd = c.path
  const code = projectForRepo(c.repo)
  if (code) {
    loginProject.value = code
    rememberLoginProject(code)
  }
  await applyHosts(true)
}

function clearMask() {
  if (creds[env.value].secret === MASK) creds[env.value].secret = ''
}

async function save(close: boolean) {
  saving.value = true
  try {
    await apiClient.saveApiAuth(props.project, {
      ...form,
      credentials: {
        TEST: { account: creds.TEST.account, secret: creds.TEST.secret === MASK ? '' : creds.TEST.secret },
        PROD: { account: creds.PROD.account, secret: creds.PROD.secret === MASK ? '' : creds.PROD.secret }
      }
    })
    emit('saved')
    if (close) {
      ElMessage.success('已保存')
      emit('update:modelValue', false)
    }
    return true
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
    return false
  } finally {
    saving.value = false
  }
}

async function testLogin() {
  testResult.value = null
  if (!(await save(false))) return
  testing.value = true
  try {
    const r = await apiClient.testApiLogin(props.project, env.value)
    testResult.value = { ok: true, token: r.token, path: r.tokenPath }
    if (r.tokenPath && !form.tokenPath) form.tokenPath = r.tokenPath
  } catch (e: any) {
    testResult.value = { ok: false, message: e?.message || '登录失败' }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.dlg-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dlg-title {
  flex: 1;
  font-size: 17px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.dlg-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}
.dlg-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.facts {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}
.fact {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.fact-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.fact-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.fact-code,
.test-result code {
  padding: 1px 6px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.svc-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -6px 0 18px;
}
.svc-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.svc-select {
  width: 200px;
}
.svc-host {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.svc-host-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.svc-host.empty .svc-host-text {
  font-family: inherit;
  color: var(--el-text-color-placeholder);
}

.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cands {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 188px;
  overflow: auto;
  margin-bottom: 18px;
}
.cand {
  text-align: left;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: #fff;
  cursor: pointer;
}
.cand:hover {
  border-color: var(--el-color-primary-light-5);
}
.cand.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.cand.dim {
  opacity: 0.6;
}
.cand-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cand-repo {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cand-path {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cand-tag {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.cand-sub {
  display: flex;
  gap: 12px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.method {
  display: inline-block;
  min-width: 40px;
  padding: 0 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
.method.is-get {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.method.is-post {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.form-grid {
  display: grid;
  grid-template-columns: 84px 1fr;
  align-items: center;
  gap: 12px 14px;
}
.f-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: right;
}
.f-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.f-method {
  width: 100px;
}
.f-row > .el-input {
  flex: 1;
}
.var-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.var-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}
.var-val {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mono :deep(input),
.mono :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}
.seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.seg-item.active {
  background: #fff;
  color: var(--el-text-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.seg-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.seg-dot.is-test {
  background: var(--el-color-success);
}
.seg-dot.is-prod {
  background: var(--el-color-danger);
}

.test-result {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  word-break: break-all;
}
.test-result.is-ok {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
  border: 1px solid #c6ecd5;
}
.test-result.is-fail {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger-dark-2);
  border: 1px solid var(--el-color-danger-light-7);
}
.faint {
  color: var(--el-text-color-secondary);
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.foot-space {
  flex: 1;
}
</style>

<style>
.auth-dialog.el-dialog {
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
}
.auth-dialog .el-dialog__header {
  padding: 20px 20px 16px 24px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.auth-dialog .el-dialog__body {
  padding: 18px 24px 8px;
}
.auth-dialog .el-dialog__footer {
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
</style>
