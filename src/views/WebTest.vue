<template>
  <div class="web-test">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">Web 端测试</span>
            <p class="sub">
              在页面编排用例步骤（打开 / 点击 / 断言文案 / 等接口），点执行即可。员工无需改代码。小程序暂占位。
            </p>
          </div>
          <div class="header-actions">
            <el-tag :type="statusTagType" size="small">{{ statusText }}</el-tag>
            <el-button size="small" @click="refreshAll">刷新</el-button>
            <el-button type="primary" :loading="running" :disabled="!canRun" @click="runSelected">
              执行勾选用例
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb"
        title="用法：新建用例 → 填需求号/页面 URL/鉴权 → 添加步骤（点选关键字）→ 勾选执行。Token 可写在用例里或执行时临时覆盖。"
      />

      <el-alert
        v-if="status && !status.nodeModulesPresent"
        type="warning"
        :closable="false"
        show-icon
        class="mb"
        :title="status.message || 'Playwright 依赖未就绪'"
      />

      <div class="toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索名称/需求号/URL"
          style="width: 240px"
          @keyup.enter="loadCases"
        />
        <el-select v-model="filterChannel" clearable placeholder="渠道" style="width: 120px" @change="loadCases">
          <el-option label="H5" value="H5" />
          <el-option label="网站" value="WEB" />
        </el-select>
        <el-button @click="loadCases">查询</el-button>
        <el-button type="primary" plain @click="openCreate">新建用例</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="cases"
        size="small"
        border
        stripe
        @selection-change="onSelect"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="name" label="用例" min-width="180" />
        <el-table-column prop="requirementRef" label="需求" width="140" show-overflow-tooltip />
        <el-table-column prop="channel" label="渠道" width="80" />
        <el-table-column prop="pageUrl" label="页面 URL" min-width="220" show-overflow-tooltip />
        <el-table-column label="步骤数" width="80">
          <template #default="{ row }">{{ stepCount(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link type="success" @click="runOne(row)">执行</el-button>
            <el-button v-perm:delete size="small" link type="danger" @click="removeCase(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="selected.length" class="run-bar">
        <span>已选 {{ selected.length }} 条</span>
        <el-input
          v-model="tokenOverride"
          size="small"
          type="password"
          show-password
          placeholder="执行时临时覆盖 token（可选）"
          style="width: 280px"
        />
      </div>

      <template v-if="result">
        <el-divider content-position="left">执行结果</el-divider>
        <el-alert
          :type="result.ok ? 'success' : 'error'"
          :closable="false"
          show-icon
          class="mb"
          :title="result.message"
          :description="`耗时 ${(result.durationMs / 1000).toFixed(1)}s · 通过 ${result.passed} / 失败 ${result.failed} / 跳过 ${result.skipped}`"
        />
        <el-table :data="result.cases || []" size="small" border>
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.status === 'passed' ? 'success' : row.status === 'skipped' ? 'info' : 'danger'"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="用例" min-width="160" />
          <el-table-column prop="requirementRef" label="需求" width="120" show-overflow-tooltip />
          <el-table-column prop="error" label="错误" min-width="220" show-overflow-tooltip />
        </el-table>
        <el-collapse v-if="result.logTail" class="mt">
          <el-collapse-item title="日志摘要" name="log">
            <pre class="log">{{ result.logTail }}</pre>
          </el-collapse-item>
        </el-collapse>
      </template>
    </el-card>

    <el-drawer v-model="drawer" :title="form.id ? '编辑用例' : '新建用例'" size="640px" destroy-on-close>
      <el-form label-width="96px" size="small">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：周报页展示本周数据" />
        </el-form-item>
        <el-form-item label="需求号">
          <el-input v-model="form.requirementRef" placeholder="Jira / Wiki / 需求编号" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="form.channel" style="width: 160px">
            <el-option label="H5" value="H5" />
            <el-option label="网站" value="WEB" />
            <el-option label="小程序(暂不可跑)" value="MINIPROGRAM" />
          </el-select>
        </el-form-item>
        <el-form-item label="页面 URL">
          <el-input v-model="form.pageUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="鉴权">
          <el-select v-model="form.authMode" style="width: 160px">
            <el-option label="无" value="none" />
            <el-option label="URL ?token=" value="query" />
            <el-option label="localStorage" value="localStorage" />
            <el-option label="cookie" value="cookie" />
            <el-option label="bearer" value="bearer" />
          </el-select>
        </el-form-item>
        <el-form-item label="Token">
          <el-input v-model="form.authToken" type="password" show-password placeholder="可选，存本地库" />
        </el-form-item>

        <el-divider content-position="left">步骤（点选关键字，不写代码）</el-divider>
        <div class="kw-bar">
          <el-select v-model="pickKeyword" placeholder="添加步骤" style="width: 220px" filterable>
            <el-option
              v-for="k in keywords"
              :key="k.code"
              :label="`${k.nameZh}（${k.code}）`"
              :value="k.code"
            />
          </el-select>
          <el-button type="primary" plain @click="addStep">添加</el-button>
        </div>
        <div v-for="(s, idx) in form.steps" :key="idx" class="step-card">
          <div class="step-head">
            <strong>{{ idx + 1 }}. {{ keywordLabel(s.keywordCode) }}</strong>
            <div>
              <el-button size="small" link :disabled="idx === 0" @click="moveStep(idx, -1)">上移</el-button>
              <el-button
                size="small"
                link
                :disabled="idx === form.steps.length - 1"
                @click="moveStep(idx, 1)"
              >
                下移
              </el-button>
              <el-button v-perm:delete size="small" link type="danger" @click="form.steps.splice(idx, 1)">删</el-button>
            </div>
          </div>
          <p class="step-hint">{{ keywordDesc(s.keywordCode) }}</p>
          <template v-if="needsSelector(s.keywordCode)">
            <el-input
              v-model="s.params.selector"
              placeholder="定位：text=登录 或 #id 或 .class"
              class="mb-xs"
            />
          </template>
          <template v-if="s.keywordCode === 'FILL'">
            <el-input v-model="s.params.value" placeholder="输入内容" class="mb-xs" />
          </template>
          <template v-if="s.keywordCode === 'WAIT_MS'">
            <el-input-number v-model="s.params.ms" :min="100" :step="500" />
          </template>
          <template v-if="s.keywordCode === 'WAIT_TEXT' || s.keywordCode === 'ASSERT_TEXT'">
            <el-input v-model="s.params.text" placeholder="期望出现的文案" />
          </template>
          <template v-if="s.keywordCode === 'ASSERT_URL'">
            <el-input v-model="s.params.contains" placeholder="URL 应包含的片段" />
          </template>
          <template v-if="s.keywordCode === 'ASSERT_HTML_MIN'">
            <el-input-number v-model="s.params.minLength" :min="50" :step="50" />
          </template>
          <template v-if="s.keywordCode === 'WAIT_RESPONSE'">
            <el-input v-model="s.params.urlIncludes" placeholder="接口 URL 包含" class="mb-xs" />
            <el-input-number v-model="s.params.status" placeholder="状态码" :min="100" :max="599" />
          </template>
          <template v-if="s.keywordCode === 'API_GET'">
            <el-input v-model="s.params.url" placeholder="完整接口 URL" class="mb-xs" />
            <el-input-number v-model="s.params.expectStatus" :min="100" :max="599" class="mb-xs" />
            <el-input v-model="s.params.expectBodyIncludes" placeholder="响应体应包含（可选）" />
          </template>
          <template v-if="s.keywordCode === 'OPEN_URL'">
            <el-input
              v-model="s.params.url"
              placeholder="可留空=用上面「页面 URL」；也可单独覆盖"
            />
          </template>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="drawer = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

type Step = { keywordCode: string; params: Record<string, any> }

const status = ref<any>(null)
const loading = ref(false)
const running = ref(false)
const saving = ref(false)
const cases = ref<any[]>([])
const selected = ref<any[]>([])
const keywords = ref<Array<{ code: string; nameZh: string; category: string; description: string }>>([])
const keyword = ref('')
const filterChannel = ref('')
const tokenOverride = ref('')
const result = ref<any>(null)
const drawer = ref(false)
const pickKeyword = ref('')

const form = reactive({
  id: '',
  name: '',
  description: '',
  requirementRef: '',
  channel: 'H5',
  pageUrl: '',
  authMode: 'none',
  authToken: '',
  authQueryKey: 'token',
  steps: [] as Step[]
})

const statusText = computed(() => {
  if (!status.value) return '未知'
  if (!status.value.projectReady) return '工程缺失'
  if (!status.value.nodeModulesPresent) return '未安装依赖'
  return '就绪'
})
const statusTagType = computed(() => {
  if (!status.value?.projectReady) return 'danger'
  if (!status.value?.nodeModulesPresent) return 'warning'
  return 'success'
})
const canRun = computed(
  () =>
    !running.value &&
    selected.value.length > 0 &&
    status.value?.projectReady &&
    status.value?.nodeModulesPresent
)

function stepCount(row: any) {
  try {
    const s = typeof row.steps === 'string' ? JSON.parse(row.steps || '[]') : row.steps
    return Array.isArray(s) ? s.length : 0
  } catch {
    return 0
  }
}

function keywordLabel(code: string) {
  return keywords.value.find((k) => k.code === code)?.nameZh || code
}
function keywordDesc(code: string) {
  return keywords.value.find((k) => k.code === code)?.description || ''
}
function needsSelector(code: string) {
  return code === 'CLICK' || code === 'FILL'
}

function onSelect(rows: any[]) {
  selected.value = rows
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadKeywords(), loadCases()])
}

async function loadStatus() {
  try {
    status.value = await apiClient.webTestStatus()
  } catch (e: any) {
    status.value = null
    ElMessage.error(e?.message || '状态获取失败，请重启后端')
  }
}

async function loadKeywords() {
  try {
    keywords.value = (await apiClient.webTestKeywords()) || []
  } catch {
    keywords.value = []
  }
}

async function loadCases() {
  loading.value = true
  try {
    cases.value = await apiClient.getWebTestCases({
      channel: filterChannel.value || undefined,
      keyword: keyword.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载用例失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.description = ''
  form.requirementRef = ''
  form.channel = 'H5'
  form.pageUrl = ''
  form.authMode = 'none'
  form.authToken = ''
  form.authQueryKey = 'token'
  form.steps = [{ keywordCode: 'OPEN_URL', params: {} }]
}

function openCreate() {
  resetForm()
  drawer.value = true
}

function openEdit(row: any) {
  form.id = row.id
  form.name = row.name || ''
  form.description = row.description || ''
  form.requirementRef = row.requirementRef || ''
  form.channel = row.channel || 'H5'
  form.pageUrl = row.pageUrl || ''
  form.authMode = row.authMode || 'none'
  form.authToken = row.authToken || ''
  form.authQueryKey = row.authQueryKey || 'token'
  try {
    const s = typeof row.steps === 'string' ? JSON.parse(row.steps || '[]') : row.steps || []
    form.steps = (s as any[]).map((x) => ({
      keywordCode: x.keywordCode,
      params: { ...(x.params || {}) }
    }))
  } catch {
    form.steps = []
  }
  if (!form.steps.length) form.steps = [{ keywordCode: 'OPEN_URL', params: {} }]
  drawer.value = true
}

function addStep() {
  if (!pickKeyword.value) {
    ElMessage.warning('请先选择关键字')
    return
  }
  const code = pickKeyword.value
  const params: Record<string, any> = {}
  if (code === 'WAIT_MS') params.ms = 1000
  if (code === 'ASSERT_HTML_MIN') params.minLength = 200
  if (code === 'API_GET') params.expectStatus = 200
  if (code === 'WAIT_RESPONSE') params.status = 200
  form.steps.push({ keywordCode: code, params })
  pickKeyword.value = ''
}

function moveStep(idx: number, delta: number) {
  const j = idx + delta
  if (j < 0 || j >= form.steps.length) return
  const t = form.steps[idx]
  form.steps[idx] = form.steps[j]
  form.steps[j] = t
}

async function saveForm() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写用例名称')
    return
  }
  if (!form.steps.length) {
    ElMessage.warning('请至少添加一步')
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      description: form.description,
      requirementRef: form.requirementRef,
      channel: form.channel,
      pageUrl: form.pageUrl,
      authMode: form.authMode,
      authToken: form.authToken || null,
      authQueryKey: form.authQueryKey || 'token',
      steps: JSON.stringify(form.steps),
      enabled: true
    }
    if (form.id) await apiClient.updateWebTestCase(form.id, body)
    else await apiClient.createWebTestCase(body)
    ElMessage.success('已保存')
    drawer.value = false
    await loadCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeCase(row: any) {
  await ElMessageBox.confirm(`删除用例「${row.name}」？`, '确认', { type: 'warning' })
  await apiClient.deleteWebTestCase(row.id)
  ElMessage.success('已删除')
  await loadCases()
}

async function runOne(row: any) {
  selected.value = [row]
  await runSelected()
}

async function runSelected() {
  if (!selected.value.length) {
    ElMessage.warning('请先勾选用例')
    return
  }
  running.value = true
  result.value = null
  try {
    result.value = await apiClient.webTestRun({
      caseIds: selected.value.map((r) => r.id),
      tokenOverride: tokenOverride.value || undefined
    })
    if (result.value?.ok) ElMessage.success(result.value.message)
    else ElMessage.warning(result.value?.message || '执行结束')
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

onMounted(() => refreshAll())
</script>

<style scoped>
.web-test {
  max-width: 1200px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.run-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--app-text-secondary);
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
.mb-xs {
  margin-bottom: 6px;
}
.kw-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.step-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  background: #fafafa;
}
.step-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.step-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.log {
  white-space: pre-wrap;
  font-size: 12px;
  max-height: 280px;
  overflow: auto;
  background: var(--app-surface);
  padding: 8px;
  border-radius: 4px;
}
</style>
