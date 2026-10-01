<template>
  <div class="env-page">
    <div class="env-switch">
      <div class="env-tabs">
        <button
          v-for="tab in ENV_TABS"
          :key="tab.environment"
          type="button"
          class="env-tab"
          :class="{ active: current === tab.environment, prod: tab.environment === 'PROD' }"
          @click="switchEnv(tab.environment)"
        >
          <span class="dot" />
          <span class="env-name">{{ tab.short }}</span>
          <span class="env-code">{{ tab.environment }}</span>
          <span v-if="current === tab.environment" class="now-badge">当前</span>
        </button>
      </div>
    </div>

    <div class="env-layout">
      <div class="env-main">
        <section class="panel">
          <div class="panel-head">
            <span class="panel-title">
              <el-icon><Link /></el-icon>
              兜底 baseUrl
            </span>
            <span class="env-chip" :class="current === 'PROD' ? 'is-prod' : 'is-test'">
              {{ current === 'PROD' ? 'PROD 环境' : 'TEST 环境' }}
            </span>
          </div>
          <div class="base-box">
            <span class="base-k">当前</span>
            <code class="base-v">{{ currentEnv.baseUrl || '（未配置）' }}</code>
          </div>
          <el-button type="primary" class="base-btn" @click="$router.push('/api-projects')">
            去项目管理改地址
          </el-button>
        </section>

        <section class="panel db-panel">
          <button type="button" class="collapse-head" @click="dbOpen = !dbOpen">
            <span class="panel-title">
              <el-icon><Coin /></el-icon>
              数据库断言连接
            </span>
            <span class="db-status" :class="{ ok: dbConfigured }">{{ dbConfigured ? '已配置' : '未配置' }}</span>
            <el-icon class="collapse-caret" :class="{ open: dbOpen }"><ArrowRight /></el-icon>
          </button>
          <div v-show="dbOpen" class="db-form">
            <el-input v-model="db.dbHost" placeholder="库地址，如 10.0.0.12" />
            <el-input v-model.number="db.dbPort" placeholder="3306" />
            <el-input v-model="db.dbName" placeholder="库名" />
            <el-input v-model="db.dbUser" placeholder="只读账号" />
            <el-input v-model="db.dbPassword" type="password" show-password placeholder="密码" />
            <el-button type="primary" :loading="dbSaving" @click="saveDb">保存</el-button>
            <el-button :loading="dbChecking" :disabled="!dbConfigured" @click="checkDb">测试连接</el-button>
          </div>
          <div v-if="dbOpen && dbMsg" class="db-msg" :class="{ bad: !dbOk }">{{ dbMsg }}</div>
        </section>

        <section class="var-card">
          <div class="var-card-head">
            <div class="var-card-title">
              <b>{{ current === 'PROD' ? '线上 (PROD)' : '测试 (TEST)' }} 变量</b>
              <span class="var-count">共 {{ variables.length }} 条</span>
            </div>
            <el-button type="primary" @click="openAdd">+ 新增变量</el-button>
          </div>
          <div v-loading="loading" class="var-list">
            <div v-if="!loading && !variables.length" class="empty-tip">
              还没有变量，点右上角新增。token 不要在这里填死。
            </div>
            <div v-else-if="variables.length" class="var-list-head">
              <span class="c-en">启用</span>
              <span class="c-name">变量名</span>
              <span class="c-val">值</span>
              <span class="c-ref">引用（点击复制）</span>
              <span class="c-ops">操作</span>
            </div>
            <div v-for="row in variables" :key="`${row.environment || ''}:${row.project || ''}:${row.name}`" class="var-row">
              <span class="c-en">
                <el-checkbox
                  :model-value="row.enabled !== false"
                  @change="(v: any) => toggleEnabled(row, v)"
                />
              </span>
              <span class="c-name">
                <span class="var-name">
                  <el-icon v-if="row.secret" class="key-icon"><Key /></el-icon>
                  {{ row.name }}
                </span>
                <div v-if="row.description" class="var-desc">{{ row.description }}</div>
              </span>
              <span class="c-val" :class="{ masked: row.secret }">{{ row.value || '（空）' }}</span>
              <span class="c-ref">
                <button type="button" class="ref-pill" @click="copy(refOf(row.name))">
                  {{ refOf(row.name) }}
                </button>
              </span>
              <span class="c-ops">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button v-perm:delete link type="danger" @click="removeVar(row)">删除</el-button>
              </span>
            </div>
          </div>
        </section>
      </div>

      <aside class="env-side">
        <section class="side-card">
          <button type="button" class="collapse-head" @click="builtinOpen = !builtinOpen">
            <span class="panel-title">
              <el-icon class="collapse-caret side-caret" :class="{ open: builtinOpen }"><ArrowRight /></el-icon>
              内置变量
            </span>
          </button>
          <div v-show="builtinOpen" class="chip-list">
            <button
              v-for="b in BUILTINS"
              :key="b.name"
              type="button"
              class="var-chip"
              :title="b.desc"
              @click="copy(b.ref)"
            >
              <code>{{ b.ref }}</code>
              <span>{{ b.desc }}</span>
            </button>
          </div>
          <p class="side-foot">点击 chip 可复制引用写法</p>
        </section>

        <section class="side-card token-card">
          <button type="button" class="collapse-head" @click="howtoOpen = !howtoOpen">
            <span class="panel-title">
              <el-icon class="token-ico"><WarningFilled /></el-icon>
              token 别在这里填死
            </span>
            <el-icon class="collapse-caret" :class="{ open: howtoOpen }"><ArrowRight /></el-icon>
          </button>
          <div v-show="howtoOpen" class="howto-body">
            填死的 token 一过期，用例会集体变红。让登录用例执行后抽出来：
            <ol>
              <li>登录用例「执行后抽变量」填 <code>{{ '{"token":"$.result.token"}' }}</code></li>
              <li>把它排在最前面</li>
              <li>其余用例请求头写 <code v-pre>token: {{token}}</code></li>
            </ol>
            抽出来的值只在本次执行内有效。
            <p>
              APP UI 同理：测试和线上数据不同，配成变量后流程里写
              <code v-pre>${phone}</code>，一条流程两边都能跑。
            </p>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="dialog" :title="editing ? '编辑变量' : '新增变量'" width="520px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="变量名" required>
          <el-input
            v-model="form.name"
            :disabled="editing"
            placeholder="如 token、phone_chen（不用带括号）"
            @blur="form.name = stripBraces(form.name)"
          />
          <div class="form-tip">
            用例里写 <code>{{ refOf(stripBraces(form.name) || '变量名') }}</code>。
            字母/数字/下划线，不能以数字开头，不能以 $ 开头（$ 是内置变量）
          </div>
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="form.value" type="textarea" :rows="2" />
          <div v-if="editing && form.secret" class="form-tip">
            当前显示的是掩码。不改就直接保存，原值不会被覆盖
          </div>
        </el-form-item>
        <el-form-item label="敏感值">
          <el-switch v-model="form.secret" />
          <span class="form-tip inline">开启后列表里打码，真值只在执行时用，不下发到浏览器</span>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" placeholder="给后人看的，比如「从哪拿的」" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, Coin, Key, Link } from '@element-plus/icons-vue'
import { apiClient } from '../api'

const ENV_TABS = [
  { environment: 'TEST', short: '测试' },
  { environment: 'PROD', short: '线上' }
]

const howtoOpen = ref(false)
const builtinOpen = ref(true)
const dbOpen = ref(false)

const BUILTINS = [
  { name: '$timestamp', ref: '{{$timestamp}}', desc: '13 位毫秒时间戳' },
  { name: '$timestampSec', ref: '{{$timestampSec}}', desc: '10 位秒级时间戳' },
  { name: '$randomInt', ref: '{{$randomInt}}', desc: '0 ~ 999999 随机整数' },
  { name: '$guid', ref: '{{$guid}}', desc: 'UUID' }
]

const envs = ref<any[]>([])
const current = ref('TEST')
const variables = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const editing = ref(false)

const form = ref<{ name: string; value: string; secret: boolean; description: string }>({
  name: '',
  value: '',
  secret: false,
  description: ''
})

const currentEnv = computed(() => envs.value.find((e) => e.environment === current.value) || {})

const db = reactive({ dbHost: '', dbPort: undefined as number | undefined, dbName: '', dbUser: '', dbPassword: '' })
const dbSaving = ref(false)
const dbChecking = ref(false)
const dbMsg = ref('')
const dbOk = ref(true)

const dbConfigured = computed(() => !!(db.dbHost && db.dbName))

function syncDbForm() {
  const e: any = currentEnv.value || {}
  db.dbHost = e.dbHost || ''
  db.dbPort = e.dbPort || undefined
  db.dbName = e.dbName || ''
  db.dbUser = e.dbUser || ''
  db.dbPassword = e.dbPassword || ''
  dbMsg.value = ''
}

async function saveDb() {
  const e: any = currentEnv.value || {}
  if (!e.baseUrl) {
    ElMessage.warning('这个环境还没有 baseUrl，先去「项目管理」点项目的「地址」配一个')
    return
  }
  dbSaving.value = true
  try {
    await apiClient.saveApiTestEnv(current.value, {
      name: e.name,
      baseUrl: e.baseUrl,
      defaultHeaders: e.defaultHeaders,
      defaultToken: e.defaultToken,
      enabled: e.enabled,
      dbHost: db.dbHost.trim() || undefined,
      dbPort: db.dbPort || undefined,
      dbName: db.dbName.trim() || undefined,
      dbUser: db.dbUser.trim() || undefined,
      dbPassword: db.dbPassword || undefined
    })
    await loadEnvs()
    syncDbForm()
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    dbSaving.value = false
  }
}

async function checkDb() {
  dbChecking.value = true
  dbMsg.value = ''
  try {
    const r = await apiClient.checkApiTestEnvDb(current.value)
    dbOk.value = r.ok
    dbMsg.value = r.message
  } catch (e: any) {
    dbOk.value = false
    dbMsg.value = e?.message || '连接测试失败'
  } finally {
    dbChecking.value = false
  }
}

function refOf(name: string) {
  return `{{${name}}}`
}

function stripBraces(v: string) {
  return String(v || '')
    .trim()
    .replace(/^\$?\{+\s*/, '')
    .replace(/\s*\}+$/, '')
    .trim()
}

async function loadEnvs() {
  try {
    envs.value = await apiClient.getApiTestEnvs()
    if (envs.value.length && !envs.value.some((e) => e.environment === current.value)) {
      current.value = envs.value[0].environment
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载环境失败')
  }
}

async function loadVariables() {
  loading.value = true
  try {
    const rows = await apiClient.getApiTestVariables(current.value)
    variables.value = Array.isArray(rows) ? rows : []
  } catch (e: any) {
    variables.value = []
    ElMessage.error(e?.message || '加载变量失败')
  } finally {
    loading.value = false
  }
}

function switchEnv(env: string) {
  current.value = env
  loadVariables()
  syncDbForm()
}

function openAdd() {
  editing.value = false
  form.value = { name: '', value: '', secret: false, description: '' }
  dialog.value = true
}

function openEdit(row: any) {
  editing.value = true
  form.value = {
    name: row.name,
    value: row.value || '',
    secret: !!row.secret,
    description: row.description || ''
  }
  dialog.value = true
}

async function save() {
  form.value.name = stripBraces(form.value.name)
  if (!form.value.name.trim()) {
    ElMessage.warning('变量名不能为空')
    return
  }
  saving.value = true
  try {
    await apiClient.saveApiTestVariable(current.value, {
      name: form.value.name.trim(),
      value: form.value.value,
      secret: form.value.secret,
      description: form.value.description,
      enabled: true
    })
    dialog.value = false
    ElMessage.success('已保存')
    await loadVariables()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: any, enabled: boolean) {
  try {
    await apiClient.saveApiTestVariable(current.value, { ...row, enabled })
    await loadVariables()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
    await loadVariables()
  }
}

async function removeVar(row: any) {
  try {
    await ElMessageBox.confirm(
      `删除变量 ${row.name}？引用了 {{${row.name}}} 的用例执行时会直接报错。`,
      '确认删除',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestVariable(current.value, row.name)
    ElMessage.success('已删除')
    await loadVariables()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制 ${text}`)
  } catch {
    ElMessage.warning('复制失败，请手动选中')
  }
}

onMounted(async () => {
  await loadEnvs()
  syncDbForm()
  await loadVariables()
})
</script>

<style scoped>
.env-page {
  padding: 20px 24px 32px;
  background: #f4f6f8;
  min-height: 100%;
}
.env-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.env-tabs {
  display: flex;
  gap: 10px;
}
.env-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  color: var(--el-text-color-primary);
}
.env-tab .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-success);
}
.env-tab.prod .dot {
  background: var(--el-color-danger);
}
.env-name {
  font-weight: 600;
  font-size: 14px;
}
.env-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.now-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
}
.env-tab.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}
.env-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}
.env-main,
.env-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel,
.var-card,
.side-card {
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 14px 16px;
}
.panel-head,
.collapse-head,
.var-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.collapse-head {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.env-chip {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.env-chip.is-prod {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.base-box {
  margin: 12px 0 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.base-k {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.base-v {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.db-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.db-status.ok {
  color: var(--el-color-success);
}
.collapse-caret {
  color: var(--el-text-color-disabled);
  transition: transform 0.15s;
}
.collapse-caret.open {
  transform: rotate(90deg);
}
.side-caret {
  margin-right: 2px;
}
.db-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.db-form :deep(.el-input) {
  width: 160px;
}
.db-msg {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-color-success);
}
.db-msg.bad {
  color: var(--el-color-danger);
}
.var-card {
  padding: 0;
}
.var-card-head {
  justify-content: space-between;
  padding: 14px 16px 10px;
}
.var-card-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.var-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.var-list {
  min-height: 48px;
  border-top: 1px solid var(--el-border-color);
}
.var-list-head,
.var-row {
  display: grid;
  grid-template-columns: 52px minmax(140px, 1.1fr) minmax(140px, 1.2fr) minmax(160px, 1fr) 110px;
  gap: 8px;
  align-items: center;
  padding: 10px 16px;
}
.var-list-head {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color);
}
.var-row {
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.var-row:last-child {
  border-bottom: none;
}
.var-row:hover {
  background: var(--el-color-primary-light-9);
}
.c-en {
  display: flex;
  justify-content: center;
}
.c-ops {
  text-align: right;
  white-space: nowrap;
}
.c-val {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.var-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
.key-icon {
  color: var(--el-color-warning);
}
.var-desc {
  margin-top: 3px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.masked {
  letter-spacing: 2px;
  color: var(--el-text-color-secondary);
}
.ref-pill {
  border: none;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: 999px;
  padding: 2px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  cursor: pointer;
}
.ref-pill:hover {
  background: var(--el-color-primary-light-8);
}
.empty-tip {
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.side-foot {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.chip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.var-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: #eef2ff;
  cursor: pointer;
  text-align: left;
}
.var-chip:hover {
  background: #e0e7ff;
}
.var-chip code {
  color: #4f46e5;
  font-size: 12px;
}
.var-chip span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.token-card {
  background: #fff8e6;
  border-color: var(--el-color-warning-light-7);
}
.token-ico {
  color: var(--el-color-warning);
}
.howto-body {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--app-text-regular);
}
.howto-body ol {
  margin: 8px 0;
  padding-left: 18px;
}
.howto-body code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #fff;
}
.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.form-tip.inline {
  margin-top: 0;
  margin-left: 10px;
}
@media (max-width: 1100px) {
  .env-layout {
    grid-template-columns: 1fr;
  }
}
</style>
