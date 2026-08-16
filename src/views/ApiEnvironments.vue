<template>
  <div class="api-envs">
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">环境变量</span>
            <p class="card-sub">
              <strong>接口自动化和 APP UI 自动化共用这一套。</strong>
              用例/流程里写 <code v-pre>{{变量名}}</code>（UI 流程也认 <code v-pre>${变量名}</code>），
              执行时换成这里的真值。
              <b>baseUrl 不在这里</b> —— 它归「资产管理 · URL 管理」，那边能按项目配多个网关，比这里全。
              同一个东西两个地方能改，迟早对不上。
            </p>
          </div>
        </div>
      </template>

      <!-- 环境切页签，跟顶栏的执行环境是同一套 TEST/PROD -->
      <div class="env-tabs">
        <button
          v-for="e in envs"
          :key="e.environment"
          class="env-tab"
          :class="{ active: current === e.environment, prod: e.environment === 'PROD' }"
          @click="switchEnv(e.environment)"
        >
          <span class="dot" />
          <span class="env-name">{{ envLabel(e) }}</span>
          <el-tag v-if="current === e.environment" size="small" type="primary" effect="plain">当前</el-tag>
        </button>
      </div>

      <div class="base-block">
        <span class="base-label">当前 baseUrl</span>
        <code class="base-value">{{ currentEnv.baseUrl || '（未配置）' }}</code>
        <el-button link type="primary" @click="$router.push('/api-urls')">去 URL 管理修改</el-button>
        <span class="base-hint">用例默认拼在它后面；用例上选了具体 URL 时以那个为准</span>
      </div>

      <div class="section-head">
        <span class="section-name">{{ envLabel(currentEnv) }} 变量</span>
        <el-button link type="primary" @click="openAdd">+ 新增变量</el-button>
      </div>

      <el-table :data="variables" v-loading="loading" size="default" class="var-table">
        <el-table-column width="56" align="center">
          <template #default="{ row }">
            <!-- 关掉相当于没配这个变量，用来临时试「不传会怎样」而不用删掉重配 -->
            <el-checkbox
              :model-value="row.enabled !== false"
              @change="(v: any) => toggleEnabled(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="变量" min-width="200">
          <template #default="{ row }">
            <span class="var-name">
              <el-icon v-if="row.secret" class="key-icon"><Key /></el-icon>
              {{ row.name }}
            </span>
            <div v-if="row.description" class="var-desc">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column label="值" min-width="280">
          <template #default="{ row }">
            <span :class="{ masked: row.secret }">{{ row.value || '（空）' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="引用" width="200">
          <template #default="{ row }">
            <code class="ref-code">{{ refOf(row.name) }}</code>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeVar(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-tip">
            还没有变量。最常见的是 <code>token</code> —— 建议不要在这里填死值，
            让登录用例执行后自动抽出来（见下方说明）。
          </div>
        </template>
      </el-table>

      <!-- 内置变量：每次求值都不同，造数据时用 -->
      <div class="builtin-block">
        <div class="builtin-head">内置变量</div>
        <p class="builtin-sub">
          不用配，任何环境都能直接用。每次求值都给新值 —— 造数据时手机号/昵称不能重复，
          写死一个跑第二遍就唯一键冲突。
        </p>
        <div class="builtin-grid">
          <div v-for="b in BUILTINS" :key="b.name" class="builtin-item" @click="copy(b.ref)">
            <code>{{ b.ref }}</code>
            <span class="builtin-desc">{{ b.desc }}</span>
          </div>
        </div>
      </div>

      <!-- 用法说明默认收起：常驻占一整屏，配过的人每次进来都要滚过去 -->
      <div class="howto" :class="{ open: howtoOpen }">
        <button type="button" class="howto-toggle" @click="howtoOpen = !howtoOpen">
          <span class="howto-toggle-title">token 别在这里填死</span>
          <span class="howto-toggle-hint">{{ howtoOpen ? '收起' : '点击展开：登录抽 token、UI 流程怎么用变量' }}</span>
        </button>
        <div v-show="howtoOpen" class="howto-body">
          填死的 token 一过期，几百条用例集体变红，你得回来手动粘一个新的 —— 那就成了每次都要人管的事。
          正确做法是让登录用例把它抽出来：
          <ol>
            <li>建一条登录用例，在「执行后抽变量」里填 <code>{{ '{"token":"$.result.token"}' }}</code></li>
            <li>把它排在最前面（sortOrder 最小）</li>
            <li>其余用例的请求头写 <code v-pre>token: {{token}}</code></li>
          </ol>
          抽出来的值只在<strong>本次执行</strong>内有效，下一轮重新登录取新的。
          <div class="howto-ui">
            <strong>APP UI 自动化同理。</strong>用例两边一样、<strong>数据两边不一样</strong>——
            测试环境和线上的登录手机号、搜索关键词、比赛 ID 都不是同一份。
            把它们配成变量（如 <code>phone</code>、<code>keyword</code>），流程里写
            <code v-pre>${phone}</code>，一条流程就能既跑线上包又跑测试包，流程本身一个字不用改。
          </div>
        </div>
      </div>
    </el-card>

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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key } from '@element-plus/icons-vue'
import { apiClient } from '../api'

/**
 * 接口测试的环境与变量。
 *
 * 只管变量。baseUrl 归「URL 管理」（api_url_entries，按项目可配多个网关），这里只读地显示一下——
 * 同一个值有两个入口能改，迟早对不上，那种不一致查起来极其费时。
 */

const howtoOpen = ref(false)

const BUILTINS = [
  { name: '$timestamp', ref: '{{$timestamp}}', desc: '13 位毫秒时间戳' },
  { name: '$timestampSec', ref: '{{$timestampSec}}', desc: '10 位秒级时间戳' },
  { name: '$randomInt', ref: '{{$randomInt}}', desc: '0 ~ 999999 随机整数' },
  { name: '$guid', ref: '{{$guid}}', desc: 'UUID，造唯一数据用' }
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

/** 模板里写不了字面的 }}，统一在这儿拼 */
function refOf(name: string) {
  return `{{${name}}}`
}

/**
 * 把人顺手带上的括号去掉。
 *
 * 说明里写着「用例里写 {{变量名}}」，于是很多人会把 {{phone}} 整个粘进变量名框，
 * 然后收到一句「变量名只能是字母/数字…」——意图完全清楚，却要人自己去猜哪里多打了字。
 * 能确定意图的就直接接住，不要制造这种来回。
 */
function stripBraces(v: string) {
  return String(v || '')
    .trim()
    .replace(/^\$?\{+\s*/, '')
    .replace(/\s*\}+$/, '')
    .trim()
}

function envLabel(e: any) {
  if (!e?.environment) return ''
  return e.environment === 'PROD' ? '线上（PROD）' : '测试（TEST）'
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
    variables.value = await apiClient.getApiTestVariables(current.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载变量失败')
  } finally {
    loading.value = false
  }
}

function switchEnv(env: string) {
  current.value = env
  loadVariables()
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
    // 传掩码回去后端会保留原值，所以这里不用先取真值
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
  await loadVariables()
})
</script>

<style scoped>
.api-envs {
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.env-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.env-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-primary);
  transition: all 0.15s;
}
.env-tab:hover {
  border-color: var(--el-color-primary-light-5);
}
.env-tab.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
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
  font-weight: 500;
}
.base-block {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  margin-bottom: 20px;
}
.base-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
.base-value {
  font-size: 13px;
  color: var(--el-color-primary);
}
.base-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-name {
  font-size: 14px;
  font-weight: 600;
}
.var-table {
  margin-bottom: 24px;
}
.var-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 13px;
}
.key-icon {
  color: var(--el-color-warning);
  font-size: 13px;
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
.ref-code {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}
.empty-tip {
  padding: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}
.builtin-block {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 16px;
}
.builtin-head {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.builtin-sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.builtin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.builtin-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  font-size: 12px;
}
.builtin-item:hover {
  background: var(--el-fill-color);
}
.builtin-item code {
  color: var(--el-color-primary);
  white-space: nowrap;
}
.builtin-desc {
  color: var(--el-text-color-secondary);
}
.howto {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-info) 6%, var(--el-bg-color));
}
.howto.open {
  background: color-mix(in srgb, var(--el-color-info) 8%, var(--el-bg-color));
}
.howto-toggle {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.howto-toggle:hover .howto-toggle-title {
  color: var(--el-color-primary);
}
.howto-toggle-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
.howto-toggle-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.howto-body {
  font-size: 13px;
  line-height: 1.8;
  padding: 0 16px 14px;
  color: var(--el-text-color-regular);
}
.howto-body ol {
  margin: 8px 0 4px;
  padding-left: 20px;
}
.howto-body code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
}
.howto-ui {
  margin-top: 10px;
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
</style>
