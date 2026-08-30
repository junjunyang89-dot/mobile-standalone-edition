<template>
  <div class="api-test">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">接口用例</span>
            <p class="sub">
              按<strong>项目 + 环境</strong>看用例。顶栏切换测试/线上会筛选对应用例（含「双环境」）。
              网关在「资产管理 → URL 管理」；用例可绑定 URL。列表已分页。
            </p>
          </div>
          <div class="header-actions">
            <el-radio-group v-model="runEnv" size="small" @change="onEnvChange">
              <el-radio-button value="TEST">测试</el-radio-button>
              <el-radio-button value="PROD">线上</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="openEnvDrawer">环境配置</el-button>
            <el-button
              type="primary"
              :loading="running"
              :disabled="!selected.length"
              @click="runSelected"
            >
              执行勾选
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb"
        :title="envHint"
      />

      <div class="toolbar">
        <el-select
          v-model="filterProject"
          clearable
          filterable
          placeholder="项目"
          style="width: 200px"
          @change="onFilterProjectChange"
        >
          <el-option
            v-for="p in projectList"
            :key="p.code"
            :label="`${p.name} (${p.code})`"
            :value="p.code"
          />
        </el-select>
        <el-select
          v-model="filterCollection"
          clearable
          filterable
          placeholder="集合"
          style="width: 180px"
          @change="loadCases"
        >
          <el-option label="未归组的" value="__none__" />
          <el-option
            v-for="c in collectionList"
            :key="c.id"
            :label="`${c.name}（${c.caseCount ?? 0}）`"
            :value="c.id"
          />
        </el-select>
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索名称/Controller/path"
          style="width: 240px"
          @keyup.enter="loadCases"
        />
        <el-checkbox v-model="enabledOnly">仅启用</el-checkbox>
        <el-button @click="loadCases">查询</el-button>
        <el-button type="primary" plain @click="openCreate">新建用例</el-button>
        <el-button
          plain
          :disabled="filterProject !== 'data-center'"
          @click="reimportDataCenter"
        >
          重导 data-center
        </el-button>
        <el-select
          v-model="runUrlId"
          clearable
          filterable
          placeholder="本次覆盖 URL（可选）"
          style="width: 220px; margin-left: auto"
        >
          <el-option
            v-for="u in urlsForRun"
            :key="u.id"
            :label="`${u.name} (${u.environment})`"
            :value="u.id"
          />
        </el-select>
        <el-input
          v-model="tokenOverride"
          clearable
          placeholder="本次覆盖 token（可选）"
          style="width: 220px"
          show-password
        />
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
        <el-table-column prop="name" label="用例" min-width="160" />
        <el-table-column prop="project" label="项目" width="110" />
        <el-table-column label="环境" width="80">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.environment === 'PROD' ? 'danger' : row.environment === 'TEST' ? 'warning' : 'info'"
            >
              {{ row.environment || 'ANY' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requirementRef" label="Controller" width="140" show-overflow-tooltip />
        <el-table-column label="方法" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="methodTag(row.method)">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="Path" min-width="220" show-overflow-tooltip />
        <el-table-column label="绑定 URL" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ urlLabel(row.urlId) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link type="success" @click="runOne(row)">执行</el-button>
            <el-button v-perm:delete size="small" link type="danger" @click="removeCase(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          small
          @size-change="onPageSizeChange"
          @current-change="loadCases"
        />
      </div>

      <div v-if="result" class="result-box">
        <div class="result-head">
          <el-tag :type="result.ok ? 'success' : 'danger'" size="small">
            {{ result.message }}
          </el-tag>
          <span class="muted">
            环境 {{ result.environment }} · 通过 {{ result.passed }}/{{ result.total }} ·
            {{ result.durationMs }}ms
          </span>
        </div>
        <el-table :data="result.cases || []" size="small" border class="mt">
          <el-table-column prop="name" label="用例" min-width="140" />
          <el-table-column prop="status" label="结果" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'PASSED' ? 'success' : 'danger'">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="httpStatus" label="HTTP" width="70" />
          <el-table-column prop="url" label="URL" min-width="200" show-overflow-tooltip />
          <el-table-column prop="error" label="错误" min-width="160" show-overflow-tooltip />
          <el-table-column label="断言" min-width="200">
            <template #default="{ row }">
              <div v-for="(a, i) in row.assertionResults || []" :key="i" class="assert-line">
                {{ a }}
              </div>
            </template>
          </el-table-column>
        </el-table>
        <!--
          光给一句「断言失败」，人还得自己猜发了什么、收到了什么，
          于是拿 Postman 再手工重放一遍——那一步正是这套东西本该省掉的
        -->
        <el-collapse v-if="hasBodyPreview" class="mt">
          <el-collapse-item
            v-for="row in (result.cases || []).filter((c: any) => c.bodyPreview || c.reqHeaders)"
            :key="row.id"
            :name="row.id"
          >
            <template #title>
              <span :class="row.status === 'PASSED' ? 'ok' : 'bad'">
                {{ row.status === 'PASSED' ? '✓' : '✗' }}
              </span>
              &nbsp;{{ row.name }}
              <span class="dim">&nbsp;{{ row.method }} {{ row.httpStatus }}</span>
            </template>
            <div class="detail-grid">
              <div v-if="row.url" class="detail-block">
                <div class="detail-label">请求 URL</div>
                <pre class="body-pre">{{ row.url }}</pre>
              </div>
              <div v-if="row.reqHeaders" class="detail-block">
                <div class="detail-label">请求头</div>
                <pre class="body-pre">{{ kvText(row.reqHeaders) }}</pre>
              </div>
              <div v-if="row.reqBody" class="detail-block">
                <div class="detail-label">请求体</div>
                <pre class="body-pre">{{ pretty(row.reqBody) }}</pre>
              </div>
              <div v-if="row.respHeaders" class="detail-block">
                <div class="detail-label">响应头</div>
                <pre class="body-pre">{{ kvText(row.respHeaders) }}</pre>
              </div>
              <div v-if="row.bodyPreview" class="detail-block">
                <div class="detail-label">响应体</div>
                <pre class="body-pre">{{ pretty(row.bodyPreview) }}</pre>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>

    <!-- 环境 -->
    <el-drawer v-model="envDrawer" title="环境配置（测试 / 线上）" size="480px" destroy-on-close>
      <div v-for="e in envs" :key="e.environment" class="env-block">
        <h4>{{ e.environment === 'TEST' ? '测试 TEST' : '线上 PROD' }} · {{ e.name }}</h4>
        <el-form label-width="100px" size="small">
          <el-form-item label="名称">
            <el-input v-model="e.name" />
          </el-form-item>
          <el-form-item label="Base URL">
            <el-input v-model="e.baseUrl" placeholder="https://gateway-qa.arca42.com" />
          </el-form-item>
          <el-form-item label="默认 Token">
            <el-input v-model="e.defaultToken" show-password placeholder="会写入 headers.token" />
          </el-form-item>
          <el-form-item label="默认 Headers">
            <el-input
              v-model="e.defaultHeaders"
              type="textarea"
              :rows="3"
              placeholder='{"Accept":"application/json"}'
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="e.enabled" />
          </el-form-item>
          <el-button type="primary" size="small" :loading="envSaving" @click="saveEnv(e)">
            保存 {{ e.environment }}
          </el-button>
        </el-form>
      </div>
    </el-drawer>

    <!-- 用例 -->
    <el-drawer
      v-model="drawer"
      :title="form.id ? '编辑接口用例' : '新建接口用例'"
      size="560px"
      destroy-on-close
    >
      <el-form label-width="100px" size="small">
        <el-form-item label="项目" required>
          <el-select v-model="form.project" filterable style="width: 220px" placeholder="从项目管理选择">
            <el-option
              v-for="p in projectList"
              :key="p.code"
              :label="`${p.name} (${p.code})`"
              :value="p.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="环境" required>
          <el-radio-group v-model="form.environment">
            <el-radio-button value="TEST">仅测试</el-radio-button>
            <el-radio-button value="PROD">仅线上</el-radio-button>
            <el-radio-button value="ANY">双环境</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="Controller">
          <el-input v-model="form.requirementRef" placeholder="来源代码类名，可选" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="方法" required>
          <el-select v-model="form.method" style="width: 140px">
            <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="Path" required>
          <el-input
            v-model="form.path"
            placeholder="/appdatacenter/deadlock/..."
          />
        </el-form-item>
        <el-form-item label="绑定 URL">
          <el-select v-model="form.urlId" clearable filterable placeholder="从 URL 管理选择" style="width: 100%">
            <el-option
              v-for="u in urlsForProject"
              :key="u.id"
              :label="`${u.name} · ${u.baseUrl}`"
              :value="u.id"
            />
          </el-select>
          <div class="form-tip">不选则执行时用环境默认 baseUrl，或用顶栏「本次覆盖 URL」</div>
        </el-form-item>
        <el-form-item label="Query JSON">
          <el-input v-model="form.query" type="textarea" :rows="2" placeholder='{"mode":"standard"}' />
        </el-form-item>
        <el-form-item label="Headers JSON">
          <el-input v-model="form.headers" type="textarea" :rows="2" placeholder="{}" />
        </el-form-item>
        <el-form-item label="Body">
          <el-input v-model="form.body" type="textarea" :rows="4" placeholder="POST/PUT JSON" />
        </el-form-item>
        <el-form-item label="断言 JSON">
          <el-input
            v-model="form.assertions"
            type="textarea"
            :rows="5"
            placeholder='[{"type":"status","equals":200},{"type":"jsonPath","path":"$.code","equals":0}]'
          />
          <div class="assert-tools">
            <span class="assert-tools-label">插入：</span>
            <el-button size="small" @click="insertAssert('jsonPath')">字段断言</el-button>
            <el-button size="small" @click="insertAssert('db')">数据库断言</el-button>
            <el-button size="small" @click="insertAssert('dbDelta')">数据库增量</el-button>
          </div>
          <div class="form-tip">
            支持 status / bodyIncludes / header / responseTime / jsonPath（$.a.b、$.list[0].id）
            / <b>db</b> / <b>dbDelta</b>。
            算子写在 <code>op</code> 里：
            <code>eq ne gt gte lt lte contains notContains exists notEmpty matches</code>（matches 是正则）。
            <br />
            <strong>db / dbDelta 是查库断言</strong> —— 「接口返回 200」不等于「数据对了」，
            最常见的漏测就是接口报成功但没写库、或者状态没流转。
            <code>dbDelta</code> 会在发请求<b>之前</b>先查一次基线，比的是前后差值（比如「关注后应该多 1 条」）。
            库连接在<el-link type="primary" :underline="false" @click="$router.push('/api-environments')">环境变量</el-link>里按环境配，
            只放行单条 SELECT。
            <br />
            <strong>项目里配了业务成功码时会自动追加一条</strong>（如 $.code == 0）——
            这几个后端业务失败也是 HTTP 200，只断言 status 等于没测。
            想刻意测某个错误码，自己写一条同路径的断言即可覆盖
          </div>
        </el-form-item>
        <el-form-item label="执行后抽变量">
          <el-input
            v-model="form.extractJson"
            type="textarea"
            :rows="2"
            placeholder='{"token":"$.result.token"}'
          />
          <div class="form-tip">
            从这条用例的响应里抽值，本次执行的后续用例可以用 <code v-pre>{{token}}</code> 引用。
            登录用例抽 token 是最常见的用法 —— 这样 token 不用写死在环境里等它过期
          </div>
        </el-form-item>
        <el-form-item label="字段说明">
          <el-input
            v-model="form.fieldNotes"
            type="textarea"
            :rows="3"
            placeholder='{"winRate":"胜率","matches":"总场次"}'
          />
          <div class="form-tip">仅文档，不参与断言；方便后人认字段</div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :step="10" />
        </el-form-item>
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
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const route = useRoute()

const loading = ref(false)
const running = ref(false)
const saving = ref(false)
const envSaving = ref(false)
const cases = ref<any[]>([])
const selected = ref<any[]>([])
const envs = ref<any[]>([])
const projects = ref<string[]>([])
const projectList = ref<Array<{ code: string; name: string }>>([])
const urlEntries = ref<any[]>([])
const filterProject = ref('data-center')
const filterCollection = ref('')
const collectionList = ref<any[]>([])
const keyword = ref('')
const enabledOnly = ref(false)
const runEnv = ref<'TEST' | 'PROD'>('TEST')
const runUrlId = ref('')
const tokenOverride = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const result = ref<any>(null)
const drawer = ref(false)
const envDrawer = ref(false)

const form = reactive({
  id: '',
  project: 'data-center',
  environment: 'ANY',
  name: '',
  description: '',
  requirementRef: '',
  method: 'GET',
  path: '',
  urlId: '' as string,
  query: '{}',
  headers: '{}',
  body: '',
  assertions: '[{"type":"status","equals":200}]',
  extractJson: '',
  fieldNotes: '{}',
  enabled: true,
  sortOrder: 100
})

const urlsForProject = computed(() =>
  urlEntries.value.filter((u) => !form.project || u.project === form.project)
)
const urlsForRun = computed(() =>
  urlEntries.value.filter(
    (u) =>
      (!filterProject.value || u.project === filterProject.value) &&
      (u.environment === runEnv.value || u.environment === 'ANY')
  )
)

const envHint = computed(() => {
  const e = envs.value.find((x) => x.environment === runEnv.value)
  if (!e) return `当前执行环境：${runEnv.value}（尚未加载环境配置）`
  return `当前执行：${runEnv.value} · ${e.baseUrl || '未配 baseUrl'}${
    e.defaultToken ? ' · 已配默认 token' : ' · 未配 token'
  }`
})

const hasBodyPreview = computed(() =>
  (result.value?.cases || []).some((c: any) => !!c.bodyPreview || !!c.reqHeaders)
)

function methodTag(m: string) {
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'warning'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

function onSelect(rows: any[]) {
  selected.value = rows
}

async function loadEnvs() {
  try {
    envs.value = await apiClient.getApiTestEnvs()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载环境失败')
  }
}

async function loadProjects() {
  try {
    projectList.value = await apiClient.getApiProjects({ enabledOnly: true })
    projects.value = projectList.value.map((p) => p.code)
  } catch {
    projectList.value = [{ code: 'data-center', name: 'data-center' }]
    projects.value = ['data-center']
  }
}

async function loadUrls() {
  try {
    urlEntries.value = await apiClient.getApiUrls({
      project: filterProject.value || undefined,
      enabledOnly: true
    })
  } catch {
    urlEntries.value = []
  }
}

function urlLabel(id?: string) {
  if (!id) return '—'
  const u = urlEntries.value.find((x) => x.id === id)
  return u ? u.name : id
}

async function loadCollections() {
  try {
    collectionList.value = await apiClient.getApiTestCollections(
      filterProject.value ? { project: filterProject.value } : undefined
    )
  } catch {
    // 集合是可选的组织方式，拿不到就当没有，不该挡住用例列表
    collectionList.value = []
  }
}

async function loadCases() {
  loading.value = true
  try {
    await loadUrls()
    const res = (await apiClient.getApiTestCases({
      project: filterProject.value || undefined,
      collectionId: filterCollection.value || undefined,
      environment: runEnv.value,
      enabledOnly: enabledOnly.value || undefined,
      keyword: keyword.value || undefined,
      page: page.value,
      size: pageSize.value
    })) as {
      content: any[]
      totalElements: number
      totalPages: number
      page: number
      size: number
    }
    cases.value = res.content || []
    total.value = res.totalElements || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载用例失败')
  } finally {
    loading.value = false
  }
}

function onEnvChange() {
  page.value = 1
  selected.value = []
  loadCases()
}

function onFilterProjectChange() {
  page.value = 1
  // 集合是挂在项目下的，换项目后旧的集合选项已经不适用，留着会筛出空列表
  filterCollection.value = ''
  loadCollections()
  loadCases()
}

function onPageSizeChange() {
  page.value = 1
  loadCases()
}

async function reimportDataCenter() {
  await ElMessageBox.confirm(
    '将删除 data-center 下种子导入的用例并重新从内置清单导入（手工新建的不会删）。继续？',
    '重导 data-center',
    { type: 'warning' }
  )
  try {
    const r = await apiClient.reimportApiTestProject('data-center')
    ElMessage.success(`已导入 ${r.imported} 条`)
    await loadProjects()
    await loadCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '重导失败')
  }
}

function openEnvDrawer() {
  envDrawer.value = true
  loadEnvs()
}

async function saveEnv(e: any) {
  envSaving.value = true
  try {
    await apiClient.saveApiTestEnv(e.environment, {
      name: e.name,
      baseUrl: e.baseUrl,
      defaultHeaders: e.defaultHeaders,
      defaultToken: e.defaultToken,
      enabled: e.enabled
    })
    ElMessage.success(`已保存 ${e.environment}`)
    await loadEnvs()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存环境失败')
  } finally {
    envSaving.value = false
  }
}

/**
 * 往断言里插一条模板。
 *
 * 数据库断言的 SQL 要写在 JSON 字符串里，手写很容易漏引号——
 * 而写错的结果是「断言解析异常」，看不出是哪一条错了。给个能跑的骨架最省事。
 */
function insertAssert(kind: 'jsonPath' | 'db' | 'dbDelta') {
  const tpl: Record<string, any> = {
    jsonPath: { type: 'jsonPath', path: '$.data.total', op: 'gte', value: '1' },
    db: { type: 'db', sql: 'SELECT COUNT(*) FROM 表名 WHERE 条件', op: 'eq', value: '1' },
    dbDelta: { type: 'dbDelta', sql: 'SELECT COUNT(*) FROM 表名 WHERE 条件', op: 'eq', value: '1' }
  }
  let list: any[] = []
  try {
    const parsed = JSON.parse(form.assertions || '[]')
    list = Array.isArray(parsed) ? parsed : []
  } catch {
    // 原来的内容不是合法 JSON 就不动它——直接覆盖会把人写了一半的东西弄丢
    ElMessage.warning('当前断言不是合法 JSON，先修好再插入')
    return
  }
  list.push(tpl[kind])
  form.assertions = JSON.stringify(list, null, 2)
}

function kvText(h?: Record<string, string>) {
  if (!h) return ''
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

/** JSON 格式化一下再看——一整行挤在一起的响应，看和不看没区别 */
function pretty(raw?: string) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function resetForm() {
  form.id = ''
  form.project = filterProject.value || 'data-center'
  form.environment = runEnv.value === 'PROD' ? 'PROD' : 'ANY'
  form.name = ''
  form.description = ''
  form.requirementRef = ''
  form.method = 'GET'
  form.path = ''
  form.urlId = ''
  form.query = '{}'
  form.headers = '{}'
  form.body = ''
  form.assertions = '[{"type":"status","equals":200}]'
  form.extractJson = ''
  form.fieldNotes = '{}'
  form.enabled = true
  form.sortOrder = 100
}

function openCreate() {
  resetForm()
  drawer.value = true
}

function openEdit(row: any) {
  form.id = row.id
  form.project = row.project || 'data-center'
  form.environment = row.environment || 'ANY'
  form.name = row.name || ''
  form.description = row.description || ''
  form.requirementRef = row.requirementRef || ''
  form.method = row.method || 'GET'
  form.path = row.path || ''
  form.urlId = row.urlId || ''
  form.query = row.query || '{}'
  form.headers = row.headers || '{}'
  form.body = row.body || ''
  form.assertions = row.assertions || '[{"type":"status","equals":200}]'
  form.extractJson = row.extractJson || ''
  form.fieldNotes = row.fieldNotes || '{}'
  form.enabled = row.enabled !== false
  form.sortOrder = row.sortOrder ?? 100
  drawer.value = true
}

async function saveForm() {
  if (!form.name.trim() || !form.path.trim()) {
    ElMessage.warning('名称和 Path 必填')
    return
  }
  for (const [label, raw] of [
    ['Query', form.query],
    ['Headers', form.headers],
    ['断言', form.assertions],
    ['字段说明', form.fieldNotes]
  ] as const) {
    try {
      if (raw && raw.trim()) JSON.parse(raw)
    } catch {
      ElMessage.warning(`${label} 不是合法 JSON`)
      return
    }
  }
  saving.value = true
  try {
    const body = {
      project: form.project || 'data-center',
      environment: form.environment || 'ANY',
      name: form.name.trim(),
      description: form.description,
      requirementRef: form.requirementRef,
      method: form.method,
      path: form.path.trim(),
      urlId: form.urlId || null,
      query: form.query,
      headers: form.headers,
      body: form.body,
      assertions: form.assertions,
      extractJson: form.extractJson,
      fieldNotes: form.fieldNotes,
      enabled: form.enabled,
      sortOrder: form.sortOrder
    }
    if (form.id) await apiClient.updateApiTestCase(form.id, body)
    else await apiClient.createApiTestCase(body)
    ElMessage.success('已保存')
    drawer.value = false
    await loadProjects()
    await loadCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeCase(row: any) {
  await ElMessageBox.confirm(`删除用例「${row.name}」？`, '确认', { type: 'warning' })
  await apiClient.deleteApiTestCase(row.id)
  ElMessage.success('已删除')
  await loadCases()
}

async function doRun(ids: string[]) {
  if (runEnv.value === 'PROD') {
    await ElMessageBox.confirm(
      '即将对【线上 PROD】发真实请求，确认已核对用例且同意继续？',
      '线上环境确认',
      { type: 'warning', confirmButtonText: '确认跑线上' }
    )
  }
  running.value = true
  result.value = null
  try {
    result.value = await apiClient.runApiTest({
      caseIds: ids,
      environment: runEnv.value,
      tokenOverride: tokenOverride.value || undefined,
      urlIdOverride: runUrlId.value || undefined,
      confirmProd: runEnv.value === 'PROD'
    })
    if (result.value?.ok) ElMessage.success(result.value.message)
    else ElMessage.warning(result.value?.message || '有失败项')
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

function runSelected() {
  // 按 sortOrder 排一遍再发。执行顺序现在有意义了：登录用例把 token 抽进上下文，
  // 后面的用例才引用得到。el-table 的 selection 不保证按行序返回，
  // 万一登录排到了后面，失败信息会是「变量 token 取不到」——指向的是被连累的那条，不是真正的原因
  const ids = [...selected.value]
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
    .map((r) => r.id)
  doRun(ids)
}

function runOne(row: any) {
  doRun([row.id])
}

onMounted(async () => {
  const q = String(route.query.project || '').trim()
  if (q) {
    filterProject.value = q
  }
  // 从「用例集合」页点「看用例」跳过来，带着集合 id——不接住的话会落到一个没筛选的全量列表，
  // 人以为集合里有几百条
  filterCollection.value = String(route.query.collectionId || '').trim()

  await loadEnvs()
  await loadProjects()
  await loadUrls()
  await loadCollections()
  await loadCases()
})
</script>

<style scoped>
.api-test {
  padding: 0;
}
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 10px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.result-box {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
}
.result-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.muted {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.assert-line {
  font-size: 12px;
  line-height: 1.4;
}
.body-pre {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  background: var(--app-surface);
  padding: 8px;
  border-radius: 4px;
  max-height: 240px;
  overflow: auto;
}
.env-block {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border);
}
.env-block h4 {
  margin: 0 0 12px;
}
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
  line-height: 1.4;
}
.assert-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 6px;
}

.assert-tools-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-label {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.ok {
  color: var(--el-color-success);
}

.bad {
  color: var(--el-color-danger);
}

</style>
