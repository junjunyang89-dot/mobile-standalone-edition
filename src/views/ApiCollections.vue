<template>
  <div class="collections-page">
    <div class="page-body" v-loading="loading">
      <!-- 左侧：环境 + 树 -->
      <aside class="nav-panel">
        <div class="scope-tabs">
          <button type="button" class="scope-tab" :class="{ active: scope === 'TEST' }" @click="switchScope('TEST')">
            分支用例
          </button>
          <button type="button" class="scope-tab" :class="{ active: scope === 'LIVE' }" @click="switchScope('LIVE')">
            master 用例
          </button>
        </div>
        <div class="nav-tree-wrap">
          <el-tree
            v-if="treeData.length"
            ref="treeRef"
            :data="treeData"
            node-key="nodeKey"
            :props="treeProps"
            highlight-current
            default-expand-all
            :expand-on-click-node="false"
            @node-click="onNodeClick"
          >
            <template #default="{ data }">
              <span class="tree-row" :class="{ 'tree-leaf-row': !data.isFolder }">
                <el-icon v-if="data.isFolder" class="tree-icon"><FolderOpened /></el-icon>
                <span class="tree-text" :title="data.kind === 'interface' ? data.path || data.label : data.label">
                  {{ data.label }}
                </span>
                <span v-if="data.statusTag" class="tree-status" :class="statusClass(data.statusTag)">
                  {{ data.statusTag }}
                </span>
                <span v-else-if="data.meta != null" class="tree-badge">{{ data.meta }}</span>
              </span>
            </template>
          </el-tree>
          <div v-else-if="!loading" class="nav-empty">暂无集合</div>
        </div>
      </aside>

      <!-- 右侧主区 -->
      <main class="detail-panel">
        <div class="main-topbar">
          <el-select
            v-if="scope === 'TEST'"
            v-model="appVersion"
            clearable
            placeholder="筛选版本"
            class="version-select"
            @change="loadTree"
          >
            <el-option v-for="v in versionOptions" :key="v" :label="v" :value="v" />
          </el-select>
          <el-checkbox v-model="includeArchived" @change="loadTree">已归档</el-checkbox>
          <el-button v-if="scope === 'TEST'" type="primary" @click="openCreate">
            <el-icon><Plus /></el-icon>新建集合
          </el-button>
        </div>

        <!-- 需求单 / 分支集合：先选接口，再看用例 -->
        <template v-if="selectedCollection">
          <div class="detail-head">
            <div class="head-left">
              <h2 v-if="selectedInterface">{{ selectedInterface.path }}</h2>
              <h2 v-else>{{ collectionTitle }}</h2>
              <span v-if="selectedInterface" class="method-tag" :class="methodClass(selectedInterface.method)">
                {{ selectedInterface.method }}
              </span>
              <span v-if="!selectedInterface && selectedCollection.requirementNo" class="pill pill-req">需求单接口</span>
              <span v-else-if="!selectedInterface && selectedCollection.sourceBranch" class="pill pill-req">分支涉及的接口用例</span>
              <span class="pill pill-env">{{ scope === 'TEST' ? '分支用例' : 'master 用例' }}</span>
              <span
                v-if="!selectedInterface && collectionStatusTag"
                class="pill"
                :class="collectionStatusTag === '已验证' ? 'pill-ok' : 'pill-run'"
              >
                {{ collectionStatusTag }}
              </span>
            </div>
            <el-button
              v-if="!selectedCollection.virtual && !selectedInterface"
              type="primary"
              @click="run(selectedCollection)"
            >
              <el-icon><VideoPlay /></el-icon>
              {{ selectedCollection.requirementNo ? '运行本需求单' : '执行集合' }}
            </el-button>
            <el-button v-else-if="selectedCollection.virtual && !selectedInterface" type="primary" @click="openCreateFromSelection">
              <el-icon><Plus /></el-icon>新建集合
            </el-button>
          </div>

          <div v-if="selectedCollection.requirementNo && !selectedInterface" class="progress-block">
            <div class="progress-label">
              <span>本单验证进度</span>
              <span>{{ progressStats.passed }}/{{ progressStats.total }} 条用例已启用</span>
            </div>
            <el-progress
              :percentage="progressStats.total ? Math.round((progressStats.passed / progressStats.total) * 100) : 0"
              :stroke-width="6"
              :show-text="false"
            />
            <div class="progress-chips">
              <span class="chip chip-pass">已启用 {{ progressStats.passed }}</span>
              <span class="chip chip-pending">已停用 {{ progressStats.disabled }}</span>
            </div>
          </div>

          <template v-if="selectedInterface">
            <div class="toolbar">
              <el-input
                v-model="caseKeyword"
                placeholder="搜索用例名称"
                clearable
                class="search-input"
              />
              <el-button type="primary" @click="openCreateCase">
                <el-icon><Plus /></el-icon>新建用例
              </el-button>
              <el-button plain :loading="generatingCase" @click="generateCaseForInterface">智能生成</el-button>
              <el-button plain @click="openImportDoc">导入接口文档</el-button>
              <el-button plain @click="refreshSelectedCases">刷新</el-button>
              <el-button
                plain
                :disabled="!selectedInterfaceCases.length"
                :loading="runningCase"
                @click="runInterfaceCases"
              >
                执行本接口
              </el-button>
            </div>

            <el-table v-if="interfaceCaseRows.length" :data="interfaceCaseRows" size="default" class="case-table">
              <el-table-column label="用例名称" min-width="220" show-overflow-tooltip prop="name" />
              <el-table-column label="说明" min-width="160" show-overflow-tooltip prop="description" />
              <el-table-column label="验证状态" width="120">
                <template #default="{ row }">
                  <span class="verify-tag" :class="row.enabled ? 'st-pass' : 'st-pending'">
                    {{ row.enabled ? '已启用' : '已停用' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openEditCase(row)">编辑</el-button>
                  <el-button link type="primary" @click="toggleCaseEnabled(row)">
                    {{ row.enabled ? '停用' : '启用' }}
                  </el-button>
                  <el-button link type="danger" @click="removeCase(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <div v-else class="detail-empty">展开左侧需求单，点击具体接口查看用例</div>
        </template>

        <!-- 生产 Controller -->
        <template v-else-if="selectedController">
          <div class="detail-head">
            <div class="head-left">
              <h2>{{ selectedController.label }}</h2>
              <span class="pill pill-ctrl">Controller · 生产环境</span>
              <span class="pill pill-live">已上线</span>
            </div>
            <el-button
              v-if="selectedController.runCollectionId"
              type="primary"
              @click="runLiveProject(selectedController)"
            >
              <el-icon><VideoPlay /></el-icon>执行
            </el-button>
          </div>
          <div class="stat-line">
            <span>接口总数</span>
            <div class="stat-bar"><div class="stat-fill" /></div>
            <span>{{ filteredCaseRows.length }} 个接口</span>
          </div>
          <div class="toolbar">
            <el-input v-model="caseKeyword" placeholder="搜索路径 / 说明" clearable class="search-input" />
            <el-button plain @click="loadLiveProjectCases(selectedController.code)">刷新</el-button>
          </div>
          <el-table v-if="filteredCaseRows.length" :data="filteredCaseRows" size="default" class="case-table">
            <el-table-column label="方法" width="88">
              <template #default="{ row }">
                <span class="method-tag" :class="methodClass(row.method)">{{ row.method }}</span>
              </template>
            </el-table-column>
            <el-table-column label="路径" min-width="300">
              <template #default="{ row }">
                <div class="path-main">{{ row.path }}</div>
                <div class="path-sub">[{{ projectShort(selectedController.code) }}] {{ row.method }} {{ row.path }}</div>
              </template>
            </el-table-column>
            <el-table-column label="Controller" width="180">
              <template #default="{ row }">{{ row.controller || selectedController.label }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default>
                <span class="verify-tag st-live">已上线</span>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <div v-else class="detail-empty">从左侧选择需求单、分支或 Controller</div>
      </main>
    </div>

    <el-dialog v-model="dialog" :title="editing ? '编辑集合' : '新建集合'" width="480px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item label="归属项目" required>
          <el-select v-model="form.project" style="width: 100%">
            <el-option v-for="p in projects" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 APP-GLOBAL-DATA" />
        </el-form-item>
        <el-form-item label="范围">
          <el-radio-group v-model="form.scope">
            <el-radio value="TEST">分支涉及的接口用例</el-radio>
            <el-radio value="LIVE">master 接口用例</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.scope === 'TEST'" label="需求单">
          <el-input v-model="form.requirementNo" placeholder="APP-xxxx（可留空）" />
        </el-form-item>
        <el-form-item v-if="form.scope === 'TEST'" label="版本">
          <el-input v-model="form.appVersion" placeholder="如 9.3 国内客户端" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="runDialog" title="执行集合" width="460px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="集合">
          <b>{{ runTarget?.name }}</b>（{{ runTarget?.caseCount ?? 0 }} 条）
        </el-form-item>
        <el-form-item label="环境">
          <el-radio-group v-model="runEnv">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="runEnv === 'PROD'">
          <el-checkbox v-model="confirmProd">我确认要在线上环境执行</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="running"
          :disabled="runEnv === 'PROD' && !confirmProd"
          @click="doRun"
        >
          开始执行
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="caseDrawer" :title="caseForm.id ? '编辑用例' : '新建用例'" size="560px">
      <el-form label-width="88px" size="small">
        <el-form-item label="名称" required>
          <el-input v-model="caseForm.name" />
        </el-form-item>
        <el-form-item label="方法">
          <el-select v-model="caseForm.method" style="width: 120px">
            <el-option v-for="m in httpMethods" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="Path">
          <el-input v-model="caseForm.path" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="caseForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <!--
        原来 Headers / 断言 是两个裸 JSON 文本框：少一个引号整条失效，
        而报错只说「断言解析异常」，不说是哪一行。改成键值行——
        这是 Postman 那套形式，好处不是好看，是<b>写不出语法错</b>
      -->
      <el-tabs v-model="editTab" class="kv-tabs">
        <el-tab-pane name="params">
          <template #label>Params <span class="kv-count">{{ activeCount(paramRows) }}</span></template>
          <KvTable v-model="paramRows" key-ph="参数名" val-ph="值" />
          <div class="kv-hint">URL 上的 query 参数。点行末「+」新增；取消勾选＝这次不传它。末尾空行保留</div>
        </el-tab-pane>

        <el-tab-pane name="headers">
          <template #label>Headers <span class="kv-count">{{ activeCount(headerRows) }}</span></template>
          <KvTable v-model="headerRows" key-ph="头名称" val-ph="值" />
          <div class="kv-hint">
            <b>token 不用填</b>：执行时按环境自动注入。在这里写死的话，过期那天所有用例集体变红
          </div>
        </el-tab-pane>

        <el-tab-pane label="Body" name="body">
          <el-input v-model="caseForm.body" type="textarea" :rows="8" placeholder="POST/PUT 的 JSON" />
          <el-button size="small" text type="primary" class="kv-hint" @click="formatBody">格式化</el-button>
        </el-tab-pane>

        <el-tab-pane name="assert">
          <template #label>断言 <span class="kv-count">{{ assertRows.length }}</span></template>
          <div v-if="!assertRaw">
            <div v-for="(a, i) in assertRows" :key="i" class="as-row">
              <el-select v-model="a.type" size="small" style="width: 108px" @change="onAssertType(a)">
                <el-option label="状态码" value="status" />
                <el-option label="字段" value="jsonPath" />
                <el-option label="响应含" value="bodyIncludes" />
                <el-option label="响应头" value="header" />
                <el-option label="查库" value="db" />
                <el-option label="查库增量" value="dbDelta" />
              </el-select>
              <el-input
                v-if="a.type === 'jsonPath'"
                v-model="a.path"
                size="small"
                placeholder="$.data.total"
                style="width: 168px"
              />
              <el-input
                v-else-if="a.type === 'header'"
                v-model="a.path"
                size="small"
                placeholder="content-type"
                style="width: 168px"
              />
              <el-input
                v-else-if="a.type === 'db' || a.type === 'dbDelta'"
                v-model="a.path"
                size="small"
                placeholder="SELECT COUNT(*) FROM 表 WHERE 条件"
                style="width: 168px"
              />
              <el-select
                v-if="a.type !== 'status' && a.type !== 'bodyIncludes'"
                v-model="a.op"
                size="small"
                style="width: 104px"
              >
                <el-option v-for="o in assertOps" :key="o.v" :label="o.l" :value="o.v" />
              </el-select>
              <el-input
                v-if="a.op !== 'exists' && a.op !== 'notEmpty'"
                v-model="a.value"
                size="small"
                placeholder="期望值"
                class="as-val"
              />
              <el-button size="small" text type="danger" @click="assertRows.splice(i, 1)">删</el-button>
            </div>
            <el-button size="small" text type="primary" @click="addAssert">+ 加一条断言</el-button>
            <div v-if="assertUnknown.length" class="kv-hint">
              另有 {{ assertUnknown.length }} 条这里编辑不了的断言，已原样保留（切「源码」查看）
            </div>
            <div class="kv-hint">
              <b>只断状态码等于没验</b>：接口返回 200 但 data 是空的，那种用例照样是绿的
            </div>
          </div>
          <el-input v-else v-model="caseForm.assertions" type="textarea" :rows="10" />
          <el-button size="small" text class="kv-hint" @click="toggleAssertRaw">
            {{ assertRaw ? '← 回到表格' : '源码…' }}
          </el-button>
        </el-tab-pane>
      </el-tabs>

      <el-form label-width="88px" size="small">
        <el-form-item label="启用">
          <el-switch v-model="caseForm.enabled" />
        </el-form-item>
      </el-form>
      <div class="drawer-footer">
        <el-button @click="caseDrawer = false">取消</el-button>
        <el-button type="primary" :loading="caseSaving" @click="saveCaseForm">保存</el-button>
      </div>
    </el-drawer>

    <el-dialog v-model="importDocVisible" title="导入接口文档" width="560px" destroy-on-close>
      <el-radio-group v-model="importDocMode" size="small" style="margin-bottom: 12px">
        <el-radio-button value="docx">上传 .docx（Confluence 导出）</el-radio-button>
        <el-radio-button value="openapi">粘贴 OpenAPI JSON</el-radio-button>
      </el-radio-group>

      <p class="import-tip">
        文档补的是抓包补不了的那一半：<b>必填、默认值、枚举回落、边界、哪些字段可空</b>。
        只有抓包的话，用例就是把这次调用重放一遍，边界一条都验不到；
        更要紧的是它会给文档写明「可空」的字段生成非空断言 —— 那种用例正常情况下也会红。
        <br />
        文档字段一律标「仅参考」，<b>不直接变成断言</b>。
      </p>

      <template v-if="importDocMode === 'docx'">
        <input ref="docFileInput" type="file" accept=".docx" style="display: none" @change="onDocFilePicked" />
        <el-button plain @click="docFileInput?.click()">选择 .docx 文件</el-button>
        <span v-if="docFile" class="import-file">{{ docFile.name }}</span>
      </template>
      <el-input
        v-else
        v-model="importDocContent"
        type="textarea"
        :rows="12"
        placeholder="粘贴 OpenAPI JSON…"
      />

      <div v-if="importResult" class="import-result">
        <div>写入接口清单 <b>{{ importResult.matched }}</b> 个</div>
        <div v-if="importResult.unmatched?.length" class="import-warn">
          文档里有、清单里没有的 {{ importResult.unmatched.length }} 个：
          {{ importResult.unmatched.slice(0, 3).join('、') }}
          <br />
          这些多半是<b>还没被抓包或对比分析覆盖到</b>的接口 —— 那就是漏测点。
        </div>
        <div v-if="importResult.aliasApplied?.length" class="cap-doc-dim">
          另有 {{ importResult.aliasApplied.length }} 条按<b>同名透传</b>推断着套过去了
          （如 GLD 直连和 DC 编排是同一个契约）：{{ importResult.aliasApplied.slice(0, 2).join('；') }}
          <br />这是推断不是文档写的，不对的话在接口清单里改。
        </div>
        <div v-if="importResult.branches?.length" class="import-dim">
          文档提到的分支：{{ importResult.branches.join('、') }}
        </div>
      </div>

      <template #footer>
        <el-button @click="importDocVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importingDoc" @click="submitImportDoc">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FolderOpened, Plus, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import KvTable, { type KvRow } from '../components/KvTable.vue'
import type { MustTestItem } from '../components/api-testing/MustTestBoard.vue'

type TreeNode = {
  nodeKey: string
  label: string
  meta?: string
  statusTag?: string
  method?: string
  isFolder?: boolean
  kind: 'category' | 'project' | 'branch-group' | 'req-group' | 'collection' | 'interface' | 'controller' | 'endpoint'
  collection?: any
  requirementNo?: string
  sourceBranch?: string
  project?: string
  projectLabel?: string
  runCollectionId?: string
  handler?: string
  code?: string
  path?: string
  linkId?: string
  endpointId?: string
  children?: TreeNode[]
}

const router = useRouter()
const route = useRoute()

const scope = ref<'TEST' | 'LIVE'>('TEST')
const appVersion = ref('')
const includeArchived = ref(false)
const versionOptions = ref<string[]>([])
const projects = ref<string[]>([])
const loading = ref(false)
const grouping = ref(false)
const saving = ref(false)
const running = ref(false)
const treeData = ref<TreeNode[]>([])
const treeRef = ref()
const collectionCases = ref<any[]>([])
const caseKeyword = ref('')
const selectedCollection = ref<any>(null)
const selectedInterface = ref<{
  method: string
  path: string
  label?: string
  linkId?: string
  endpointId?: string
} | null>(null)
const selectedController = ref<{
  label: string
  code: string
  handler: string
  runCollectionId?: string
} | null>(null)

const dialog = ref(false)
const runDialog = ref(false)
const editing = ref(false)
const runTarget = ref<any>(null)
const runEnv = ref('TEST')
const confirmProd = ref(false)
const autoGroupProject = ref('')

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const caseDrawer = ref(false)
const caseSaving = ref(false)
const generatingCase = ref(false)
const runningCase = ref(false)
const importDocVisible = ref(false)
const importDocContent = ref('')
const importingDoc = ref(false)
const importDocMode = ref<'docx' | 'openapi'>('docx')
const docFileInput = ref<HTMLInputElement>()
const docFile = ref<File | null>(null)
const importResult = ref<any>(null)

function onDocFilePicked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  docFile.value = f || null
  importResult.value = null
}
const editTab = ref('params')
const paramRows = ref<KvRow[]>([])
const headerRows = ref<KvRow[]>([])
const assertRaw = ref(false)

type AssertRow = { type: string; path: string; op: string; value: string }
const assertRows = ref<AssertRow[]>([])
/** 表格编辑不了的断言原样留着——编辑器不认识不等于它没用 */
const assertUnknown = ref<any[]>([])

const assertOps = [
  { v: 'eq', l: '等于' },
  { v: 'ne', l: '不等于' },
  { v: 'contains', l: '包含' },
  { v: 'notContains', l: '不包含' },
  { v: 'exists', l: '存在' },
  { v: 'notEmpty', l: '非空' },
  { v: 'gt', l: '大于' },
  { v: 'gte', l: '大于等于' },
  { v: 'lt', l: '小于' },
  { v: 'lte', l: '小于等于' },
  { v: 'matches', l: '匹配正则' }
]

function activeCount(rows: KvRow[]) {
  const n = rows.filter((r) => r.enabled && r.key.trim()).length
  return n ? `(${n})` : ''
}

function addAssert() {
  assertRows.value.push({ type: 'jsonPath', path: '', op: 'eq', value: '' })
}

function onAssertType(a: AssertRow) {
  if (a.type === 'status') {
    a.op = 'eq'
    a.path = ''
  }
}

function formatBody() {
  try {
    caseForm.value.body = JSON.stringify(JSON.parse(caseForm.value.body || '{}'), null, 2)
  } catch {
    ElMessage.warning('不是合法 JSON，没法格式化')
  }
}

/** query 串 ⇄ 行 */
function queryToRows(q?: string): KvRow[] {
  if (!q) return []
  return q
    .split('&')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('=')
      return {
        enabled: (i < 0 ? p : p.slice(0, i)).trim().length > 0,
        key: i < 0 ? p : p.slice(0, i),
        value: i < 0 ? '' : p.slice(i + 1)
      }
    })
}

function rowsToQuery(rows: KvRow[]) {
  const s = rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => `${r.key.trim()}=${r.value}`)
    .join('&')
  return s || undefined
}

function jsonToRows(json?: string): KvRow[] {
  try {
    const o = JSON.parse(json || '{}')
    if (!o || typeof o !== 'object') return []
    return Object.entries(o).map(([key, value]) => ({
      enabled: !!String(key || '').trim(),
      key,
      value: value == null ? '' : String(value)
    }))
  } catch {
    return []
  }
}

function rowsToJson(rows: KvRow[]) {
  const o: Record<string, string> = {}
  rows.filter((r) => r.enabled && r.key.trim()).forEach((r) => (o[r.key.trim()] = r.value))
  return JSON.stringify(o)
}

/**
 * 断言 JSON ⇄ 行。
 * 认不出来的原样收进 assertUnknown，保存时再拼回去——
 * 编辑器不认识不等于它没用，丢掉的话人下次打开就发现断言少了几条。
 */
function assertsToRows(json?: string) {
  assertRows.value = []
  assertUnknown.value = []
  let arr: any[] = []
  try {
    const p = JSON.parse(json || '[]')
    arr = Array.isArray(p) ? p : []
  } catch {
    return
  }
  for (const a of arr) {
    if (a?.type === 'status') {
      assertRows.value.push({ type: 'status', path: '', op: 'eq', value: String(a.equals ?? 200) })
    } else if (a?.type === 'jsonPath' || a?.type === 'header' || a?.type === 'db' || a?.type === 'dbDelta') {
      const path = a.path ?? a.name ?? a.sql ?? ''
      let op = a.op
      let value = a.value
      // 老写法：{path, equals} / {path, exists} / {path, contains}
      if (!op) {
        if (a.exists !== undefined) {
          op = a.exists ? 'exists' : 'ne'
          value = ''
        } else if (a.equals !== undefined) {
          op = 'eq'
          value = a.equals
        } else if (a.notEquals !== undefined) {
          op = 'ne'
          value = a.notEquals
        } else if (a.contains !== undefined) {
          op = 'contains'
          value = a.contains
        } else {
          op = 'exists'
          value = ''
        }
      }
      assertRows.value.push({
        type: a.type,
        path: String(path),
        op,
        value: value == null ? '' : String(value)
      })
    } else if (a?.type === 'bodyIncludes') {
      assertRows.value.push({ type: 'bodyIncludes', path: '', op: 'contains', value: String(a.value ?? '') })
    } else {
      assertUnknown.value.push(a)
    }
  }
}

function rowsToAsserts() {
  const out: any[] = []
  for (const a of assertRows.value) {
    if (a.type === 'status') {
      out.push({ type: 'status', equals: Number(a.value) || 200 })
    } else if (a.type === 'bodyIncludes') {
      out.push({ type: 'bodyIncludes', value: a.value })
    } else if (a.type === 'header') {
      out.push({ type: 'header', name: a.path, op: a.op, value: a.value })
    } else if (a.type === 'db' || a.type === 'dbDelta') {
      out.push({ type: a.type, sql: a.path, op: a.op, value: a.value })
    } else {
      out.push({ type: 'jsonPath', path: a.path, op: a.op, value: a.value })
    }
  }
  return JSON.stringify(out.concat(assertUnknown.value))
}

function toggleAssertRaw() {
  if (!assertRaw.value) {
    // 进源码前先把表格里的写回去，否则看到的是打开时的旧内容
    caseForm.value.assertions = rowsToAsserts()
  } else {
    assertsToRows(caseForm.value.assertions)
  }
  assertRaw.value = !assertRaw.value
}

/** 打开编辑器时把 JSON 拆成行 */
function loadEditorRows() {
  paramRows.value = queryToRows(caseForm.value.query)
  headerRows.value = jsonToRows(caseForm.value.headers)
  assertsToRows(caseForm.value.assertions)
  assertRaw.value = false
  editTab.value = 'params'
}

const caseForm = ref({
  id: '',
  query: '',
  project: '',
  environment: 'TEST',
  name: '',
  description: '',
  method: 'GET',
  path: '',
  headers: '{}',
  body: '',
  assertions: '[{"type":"status","equals":200}]',
  enabled: true,
  sortOrder: 100
})

const form = ref<any>({
  id: '',
  project: '',
  name: '',
  description: '',
  sortOrder: 100,
  enabled: true,
  scope: 'TEST',
  requirementNo: '',
  appVersion: ''
})

const treeProps = { children: 'children', label: 'label' }

const collectionTitle = computed(() => {
  const c = selectedCollection.value
  if (!c) return ''
  if (c.requirementNo) return c.requirementNo
  if (c.sourceBranch) return c.sourceBranch
  return collectionDisplayName(c)
})

const currentProject = computed(() => {
  const q = String(route.query.project || '').trim()
  return (
    selectedCollection.value?.project ||
    selectedController.value?.code ||
    q ||
    undefined
  )
})

async function onMustTestSelect(item: MustTestItem) {
  if (!item.path) return
  const node = findTreeNode((n) => {
    if (!n.path) return false
    const methodOk = !item.httpMethod || !n.method || n.method.toUpperCase() === item.httpMethod.toUpperCase()
    return methodOk && (n.path === item.path || n.path.endsWith(item.path) || item.path.endsWith(n.path))
  })
  if (node) {
    await selectTreeNode(node)
    return
  }
  ElMessage.info(`左侧树里还没有 ${item.httpMethod || ''} ${item.path}，先在清单生成用例或归入集合`)
}

const collectionStatusTag = computed(() => {
  const c = selectedCollection.value
  if (!c) return ''
  if (c.statusTag) return c.statusTag
  if (c.passRate != null && c.passRate >= 100) return '已验证'
  if (c.requirementNo) return '进行中'
  return c.sourceBranch ? '待测' : ''
})

const progressStats = computed(() => {
  let passed = 0
  let disabled = 0
  for (const row of collectionCases.value) {
    if (row.enabled) passed++
    else disabled++
  }
  return { passed, disabled, total: collectionCases.value.length }
})

const interfaceCaseRows = computed(() => {
  if (!selectedInterface.value) return []
  const { method, path } = selectedInterface.value
  let rows = collectionCases.value.filter(
    (r) => String(r.method || '').toUpperCase() === method.toUpperCase() && String(r.path || '') === path
  )
  const kw = caseKeyword.value.trim().toLowerCase()
  if (!kw) return rows
  return rows.filter(
    (r) =>
      String(r.name || '').toLowerCase().includes(kw) ||
      String(r.path || '').toLowerCase().includes(kw) ||
      String(r.description || '').toLowerCase().includes(kw)
  )
})

const selectedInterfaceCases = computed(() => interfaceCaseRows.value)

const liveCaseRows = ref<any[]>([])

const filteredCaseRows = computed(() => {
  let rows = liveCaseRows.value
  if (selectedController.value?.handler) {
    const h = selectedController.value.handler
    rows = rows.filter((r) => (r.controller || caseHostLabel(r)) === h)
  }
  const kw = caseKeyword.value.trim().toLowerCase()
  if (!kw) return rows
  return rows.filter(
    (r) =>
      String(r.path || '').toLowerCase().includes(kw) ||
      String(r.name || '').toLowerCase().includes(kw) ||
      String(r.controller || '').toLowerCase().includes(kw)
  )
})

function projectShort(code?: string) {
  if (!code) return '—'
  return code.replace(/^app-/, '').replace(/-/g, ' ')
}

function statusClass(tag: string) {
  if (tag === '已验证' || tag === '已上线') return 'ts-ok'
  if (tag === '进行中') return 'ts-run'
  return 'ts-pending'
}

function treeDisplayLabel(raw: string) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('APP-') || s.startsWith('app-')) {
    return s.replace(/^app-/i, 'APP-').toUpperCase()
  }
  return s.toUpperCase()
}

function collectionDisplayName(c: any) {
  return treeDisplayLabel(c?.name || c?.project || '')
}

function caseHostLabel(row: any) {
  const name = String(row?.name || '').trim()
  if (!name) return '—'
  const idx = name.indexOf('（')
  return idx > 0 ? name.slice(0, idx) : name
}

function caseMetaLabel(row: any) {
  const host = caseHostLabel(row)
  const status = row?.enabled ? '(待执行)' : '(已停用)'
  return `${host} ${status}`
}

function switchScope(next: 'TEST' | 'LIVE') {
  if (scope.value === next) return
  scope.value = next
  onScopeChange()
}

function methodClass(method: string) {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return 'm-get'
  if (m === 'POST') return 'm-post'
  if (m === 'PUT' || m === 'PATCH') return 'm-put'
  if (m === 'DELETE') return 'm-del'
  return 'm-other'
}

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

async function toggleCaseEnabled(row: any) {
  const next = !row.enabled
  try {
    await apiClient.updateApiTestCase(row.id, {
      name: row.name,
      method: row.method,
      path: row.path,
      enabled: next,
      project: selectedCollection.value?.project || selectedController.value?.code
    })
    row.enabled = next
    ElMessage.success(next ? '已启用' : '已停用')
    if (selectedCollection.value && selectedInterface.value) {
      const node = findTreeNode(
        (n) =>
          n.kind === 'interface' &&
          String(n.method || '').toUpperCase() === selectedInterface.value!.method.toUpperCase() &&
          String(n.path || '') === selectedInterface.value!.path
      )
      if (node) {
        const ifaceCases = collectionCases.value.filter(
          (c) =>
            String(c.method || '').toUpperCase() === selectedInterface.value!.method.toUpperCase() &&
            String(c.path || '') === selectedInterface.value!.path
        )
        node.statusTag = interfaceStatusTag(ifaceCases)
        node.meta = ifaceCases.length ? String(ifaceCases.length) : undefined
      }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

function onCollectionMore(cmd: string) {
  if (cmd === 'delete' && selectedCollection.value) {
    remove(selectedCollection.value)
  } else if (cmd === 'autoGroup') {
    autoGroup()
  }
}

function countGroupLeaves(groups: any[]): number {
  return (groups || []).reduce((sum, g) => sum + (g.collections || []).length, 0)
}

function categoryTreeLabel(cat: { key?: string; label?: string }) {
  if (cat.key === 'APP') return 'APP'
  if (cat.key === 'PVP') return 'PWA'
  if (cat.key === 'WEB') return 'WEB'
  return cat.label || cat.key || ''
}

function buildTree(categories: any[]): TreeNode[] {
  if (scope.value === 'LIVE') {
    return (categories || []).map((cat) => ({
      nodeKey: `cat:${cat.key}`,
      label: categoryTreeLabel(cat),
      kind: 'category' as const,
      isFolder: true,
      meta: String(cat.total ?? (cat.projects || []).reduce((s: number, p: any) => s + (p.caseCount ?? 0), 0)),
      children: (cat.projects || []).flatMap((proj: any) => {
        const projectNode: TreeNode = {
          nodeKey: `proj:${cat.key}:${proj.code}`,
          label: proj.code || proj.label,
          kind: 'project',
          isFolder: true,
          project: proj.code,
          meta: String(proj.caseCount ?? 0),
          children: (proj.controllers || []).map((ctrl: any) => ({
            nodeKey: `ctrl:${proj.code}:${ctrl.label}`,
            label: ctrl.label,
            kind: 'controller' as const,
            isFolder: true,
            project: proj.code,
            handler: ctrl.handler || ctrl.label,
            code: proj.code,
            runCollectionId: proj.runCollectionId,
            meta: String(ctrl.caseCount ?? 0),
            statusTag: ctrl.statusTag,
            children: (ctrl.previews || []).map((p: any, i: number) => ({
              nodeKey: `ep:${proj.code}:${ctrl.label}:${i}`,
              label: String(p.path || '').split('/').pop() || p.label,
              kind: 'endpoint' as const,
              method: p.method,
              project: proj.code,
              handler: ctrl.handler || ctrl.label
            }))
          }))
        }
        return [projectNode]
      })
    }))
  }

  return (categories || []).map((cat) => ({
    nodeKey: `cat:${cat.key}`,
    label: categoryTreeLabel(cat),
    kind: 'category' as const,
    isFolder: true,
    meta: String(cat.total ?? (cat.projects || []).reduce((s: number, p: any) => s + (p.collectionCount ?? 0), 0)),
    children: (cat.projects || []).map((proj: any) => ({
        nodeKey: `proj:${cat.key}:${proj.code}`,
        label: proj.code || proj.label,
        kind: 'project' as const,
        isFolder: true,
        project: proj.code,
        projectLabel: proj.label || proj.code,
        meta: String(proj.collectionCount ?? countGroupLeaves(proj.groups || [])),
        children: (proj.groups || []).flatMap((g: any) => {
          const groupNode: TreeNode = {
            nodeKey: g.key || `grp:${proj.code}:${g.label}`,
            label: g.label,
            kind: (g.kind || 'req-group') as TreeNode['kind'],
            isFolder: true,
            project: proj.code,
            meta: String((g.collections || []).length),
            children: (g.collections || []).map((col: any) => {
              const nodeKey = col.id
                ? `col:${col.id}`
                : `leaf:${proj.code}:${col.requirementNo || col.sourceBranch || col.label}`
              return {
                nodeKey,
                label: col.label || col.requirementNo || col.sourceBranch || col.name,
                kind: 'collection' as const,
                isFolder: true,
                children: interfaceNodesFromCol(col, proj.code, nodeKey),
                collection: col.id ? col : null,
                requirementNo: col.requirementNo,
                sourceBranch: col.sourceBranch,
                project: proj.code,
                projectLabel: proj.label || proj.code,
                statusTag: col.statusTag,
                meta:
                  col.interfaces?.length != null
                    ? String(col.interfaces.length)
                    : col.caseCount != null
                      ? String(col.caseCount)
                      : undefined
              }
            })
          }
          return [groupNode]
        })
      }))
    }))
}

async function loadTree() {
  loading.value = true
  try {
    const res = await apiClient.getApiTestCollectionTree({
      scope: scope.value,
      appVersion: scope.value === 'TEST' ? appVersion.value || undefined : undefined,
      includeArchived: includeArchived.value
    })
    treeData.value = buildTree(res.categories || [])
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = null
    collectionCases.value = []
    liveCaseRows.value = []
    caseKeyword.value = ''
  } catch (e: any) {
    treeData.value = []
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function refreshSelectedCases() {
  const c = selectedCollection.value
  if (!c) return
  const node = findTreeNode(
    (n) =>
      n.kind === 'collection' &&
      (n.collection?.id === c.id ||
        (c.virtual && (n.requirementNo === c.requirementNo || n.sourceBranch === c.sourceBranch)))
  )
  if (node) {
    await hydrateCollectionNode(node, c)
  } else if (c.id) {
    await loadCollectionCases(c.id)
  }
}

async function onNodeClick(data: TreeNode) {
  if (data.kind === 'category' || data.kind === 'branch-group' || data.kind === 'req-group' || data.kind === 'project') {
    return
  }
  if (data.kind === 'collection') {
    selectedController.value = null
    selectedInterface.value = null
    caseKeyword.value = ''
    const col = data.collection
    let collectionCtx: any
    if (col?.id) {
      collectionCtx = col
      selectedCollection.value = col
    } else {
      collectionCtx = {
        requirementNo: data.requirementNo || col?.requirementNo,
        sourceBranch: data.sourceBranch || col?.sourceBranch,
        project: data.project,
        name: data.label,
        statusTag: data.statusTag,
        virtual: true
      }
      selectedCollection.value = collectionCtx
    }
    if (collectionCtx?.id) {
      await loadCollectionCases(collectionCtx.id)
    }
    if (!data.children?.length) {
      await hydrateCollectionNode(data, collectionCtx)
    }
    return
  }
  if (data.kind === 'interface') {
    selectedController.value = null
    selectedInterface.value = {
      method: data.method || 'GET',
      path: data.path || '',
      label: data.label,
      linkId: data.linkId,
      endpointId: data.endpointId
    }
    if (data.collection) {
      selectedCollection.value = data.collection
      if (data.collection.id && !collectionCases.value.length) {
        await loadCollectionCases(data.collection.id)
      }
    }
    caseKeyword.value = ''
    return
  }
  if (data.kind === 'controller') {
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = {
      label: data.label,
      code: data.code || data.project || '',
      handler: data.handler || data.label,
      runCollectionId: data.runCollectionId
    }
    caseKeyword.value = ''
    await loadLiveProjectCases(data.code || data.project || '')
    return
  }
  if (data.kind === 'endpoint' && data.project && data.handler) {
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = {
      label: data.handler,
      code: data.project,
      handler: data.handler
    }
    await loadLiveProjectCases(data.project)
    if (data.method) {
      caseKeyword.value = String(data.path || '').split('/').pop() || ''
    }
  }
}

function openCreateFromSelection() {
  const c = selectedCollection.value
  form.value = {
    id: '',
    project: c?.project || '',
    name: c?.requirementNo || c?.sourceBranch || '',
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: 'TEST',
    requirementNo: c?.requirementNo || '',
    appVersion: appVersion.value || ''
  }
  editing.value = false
  dialog.value = true
}

function interfaceKey(method?: string, path?: string) {
  return `${String(method || '').toUpperCase()}:${String(path || '').trim()}`
}

function interfaceStatusTag(cases: any[]) {
  if (!cases.length) return '待测'
  const enabled = cases.filter((c) => c.enabled).length
  if (enabled === cases.length) return '已启用'
  if (enabled > 0) return '进行中'
  return '待测'
}

function collectionContext(col: any, projectCode: string) {
  if (col?.id) return col
  return {
    requirementNo: col.requirementNo,
    sourceBranch: col.sourceBranch,
    project: projectCode,
    name: col.label || col.requirementNo || col.sourceBranch || col.name,
    statusTag: col.statusTag,
    virtual: true
  }
}

function interfaceTreeLabel(path?: string) {
  const p = String(path || '').trim()
  return p || '—'
}

function interfaceNodesFromCol(col: any, projectCode: string, parentNodeKey: string): TreeNode[] {
  const ctx = collectionContext(col, projectCode)
  return (col.interfaces || [])
    .map((item: any) => {
      const path = String(item.path || '').trim()
      if (!path) return null
      const method = String(item.method || 'GET').toUpperCase()
      const caseCount = Number(item.caseCount ?? 0)
      return {
        nodeKey: `if:${parentNodeKey}:${interfaceKey(method, path)}`,
        label: interfaceTreeLabel(path),
        kind: 'interface' as const,
        isFolder: false,
        method,
        path,
        project: projectCode,
        collection: ctx,
        requirementNo: col.requirementNo,
        sourceBranch: col.sourceBranch,
        linkId: item.linkId,
        endpointId: item.endpointId,
        statusTag: item.statusTag || (caseCount > 0 ? '进行中' : '待测'),
        meta: caseCount > 0 ? String(caseCount) : undefined
      }
    })
    .filter(Boolean) as TreeNode[]
}

function patchTreeNode(nodeKey: string, patch: Partial<TreeNode> & { children?: TreeNode[] }): void {
  const node = findTreeNode((n) => n.nodeKey === nodeKey)
  if (!node) return
  if (patch.children) node.children = patch.children
  if (patch.isFolder != null) node.isFolder = patch.isFolder
  treeData.value = treeData.value.slice()
}

function buildInterfaceChildren(
  cases: any[],
  endpoints: any[],
  parent: TreeNode,
  collectionCtx: any
): TreeNode[] {
  const grouped = new Map<
    string,
    { method: string; path: string; cases: any[]; controller?: string; linkId?: string; endpointId?: string }
  >()
  for (const ep of endpoints) {
    const method = String(ep.httpMethod || ep.method || 'GET').toUpperCase()
    const path = String(ep.path || '').trim()
    if (!path) continue
    const key = interfaceKey(method, path)
    if (!grouped.has(key)) {
      grouped.set(key, {
        method,
        path,
        cases: [],
        linkId: ep.id,
        endpointId: ep.endpointId,
        controller: ep.summary?.split('·')?.[0]?.trim() || String(ep.handler || '').split('.')[0] || '—'
      })
    }
  }
  for (const c of cases) {
    const method = String(c.method || 'GET').toUpperCase()
    const path = String(c.path || '').trim()
    if (!path) continue
    const key = interfaceKey(method, path)
    const hit = grouped.get(key) || {
      method,
      path,
      cases: [],
      controller: c.controller || caseHostLabel(c)
    }
    hit.cases.push(c)
    if (!hit.controller || hit.controller === '—') hit.controller = c.controller || caseHostLabel(c)
    grouped.set(key, hit)
  }
  const parentKey = parent.nodeKey
  return [...grouped.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => ({
      nodeKey: `if:${parentKey}:${interfaceKey(item.method, item.path)}`,
      label: interfaceTreeLabel(item.path),
      kind: 'interface' as const,
      isFolder: false,
      method: item.method,
      path: item.path,
      project: parent.project,
      collection: collectionCtx,
      requirementNo: parent.requirementNo,
      sourceBranch: parent.sourceBranch,
      linkId: item.linkId,
      endpointId: item.endpointId,
      statusTag: interfaceStatusTag(item.cases),
      meta: item.cases.length ? String(item.cases.length) : undefined
    }))
}

async function fetchEndpointsForCollection(data: TreeNode) {
  if (data.requirementNo) {
    return apiClient.fetchRequirementEndpoints(data.requirementNo)
  }
  if (data.sourceBranch && data.project) {
    const res = await apiClient.fetchApiEndpoints({ project: data.project })
    return (res.items || []).filter(
      (ep: any) => String(ep.sourceBranch || '').trim() === data.sourceBranch
    )
  }
  return []
}

async function hydrateCollectionNode(data: TreeNode, collectionCtx: any) {
  try {
    const endpoints = await fetchEndpointsForCollection(data)
    let cases: any[] = collectionCases.value
    if (collectionCtx?.id) {
      cases = await apiClient.getApiTestCollectionCases(collectionCtx.id)
      collectionCases.value = cases
    }
    const children = buildInterfaceChildren(cases, endpoints, data, collectionCtx)
    patchTreeNode(data.nodeKey, { children, isFolder: true })
    await nextTick()
    treeRef.value?.getNode?.(data.nodeKey)?.expand?.()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载接口列表失败')
    collectionCases.value = []
    patchTreeNode(data.nodeKey, { children: [] })
  }
}

async function loadCollectionCases(collectionId: string) {
  try {
    collectionCases.value = await apiClient.getApiTestCollectionCases(collectionId)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载用例失败')
    collectionCases.value = []
  }
}

function findTreeNode(match: (n: TreeNode) => boolean): TreeNode | null {
  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (match(n)) return n
      if (n.children?.length) {
        const hit = walk(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(treeData.value)
}

async function selectTreeNode(data: TreeNode) {
  await nextTick()
  treeRef.value?.setCurrentKey?.(data.nodeKey)
  await onNodeClick(data)
}

async function loadLiveProjectCases(projectCode: string) {
  try {
    liveCaseRows.value = await apiClient.getApiTestProjectLiveCases(projectCode, {
      includeArchived: includeArchived.value
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载接口失败')
    liveCaseRows.value = []
  }
}

function onScopeChange() {
  if (scope.value === 'LIVE') {
    appVersion.value = ''
  }
  loadTree()
}

function runLiveProject(proj: { code: string; label?: string; runCollectionId?: string }) {
  if (!proj.runCollectionId) {
    ElMessage.warning('该项目暂无可执行的 master 集合')
    return
  }
  run({
    id: proj.runCollectionId,
    name: proj.label || proj.code,
    project: proj.code,
    scope: 'LIVE'
  })
}

async function loadProjects() {
  projects.value = await apiClient.getApiTestProjects()
  if (!autoGroupProject.value && projects.value.length) {
    autoGroupProject.value = projects.value[0]
  }
}

async function loadVersions() {
  try {
    const rows = await apiClient.listAiTestCaseVersions('app-release')
    versionOptions.value = (rows || []).map((r) => String(r.version || '')).filter(Boolean)
    const qv = String(route.query.appVersion || '')
    if (qv) appVersion.value = qv
    else if (versionOptions.value.length) {
      const hit = versionOptions.value.find((v) => v.includes('9.3')) || versionOptions.value[0]
      appVersion.value = hit
    }
  } catch {
    versionOptions.value = []
  }
}

async function autoGroup() {
  const p = autoGroupProject.value || selectedCollection.value?.project || projects.value[0]
  if (!p) {
    ElMessage.warning('没有可选项目')
    return
  }
  grouping.value = true
  try {
    const r = await apiClient.autoGroupApiTestCases(p)
    ElMessage.success(`新建 ${r.created} 个集合，归组 ${r.assigned} 条用例`)
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '归组失败')
  } finally {
    grouping.value = false
  }
}

function openCreate() {
  editing.value = false
  form.value = {
    id: '',
    project: autoGroupProject.value || projects.value[0] || '',
    name: '',
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: scope.value,
    requirementNo: '',
    appVersion: appVersion.value || ''
  }
  dialog.value = true
}

function openCreateForProject(projectCode: string) {
  editing.value = false
  form.value = {
    id: '',
    project: projectCode,
    name: treeDisplayLabel(projectCode),
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: scope.value,
    requirementNo: '',
    appVersion: appVersion.value || ''
  }
  dialog.value = true
}

function openEdit(c: any) {
  editing.value = true
  form.value = {
    id: c.id,
    project: c.project,
    name: c.name,
    description: c.description || '',
    sortOrder: c.sortOrder ?? 100,
    enabled: c.enabled !== false,
    scope: c.scope || 'LIVE',
    requirementNo: c.requirementNo || '',
    appVersion: c.appVersion || ''
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name.trim() || !form.value.project) {
    ElMessage.warning('项目和名称必填')
    return
  }
  saving.value = true
  try {
    const body = {
      project: form.value.project,
      name: form.value.name.trim(),
      description: form.value.description,
      sortOrder: form.value.sortOrder,
      enabled: form.value.enabled,
      scope: form.value.scope,
      requirementNo: form.value.requirementNo?.trim() || undefined,
      appVersion: form.value.appVersion?.trim() || undefined
    }
    if (editing.value) await apiClient.updateApiTestCollection(form.value.id, body)
    else await apiClient.createApiTestCollection(body)
    dialog.value = false
    ElMessage.success('已保存')
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(c: any) {
  try {
    await ElMessageBox.confirm(`删除集合「${c.name}」？用例会保留，只是移出集合。`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestCollection(c.id)
    ElMessage.success('已删除')
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function archiveCollection(c: any) {
  try {
    await apiClient.archiveApiTestCollection(c.id)
    ElMessage.success('已归档')
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '归档失败')
  }
}

async function releaseRequirement(requirementNo: string) {
  try {
    await ElMessageBox.confirm(
      `确认 ${requirementNo} 已上线？将归档该单的测试集合与「涉及接口」，默认不再展示（记录保留）。`,
      '本单已上线',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    const r = await apiClient.releaseApiTestRequirement(requirementNo)
    ElMessage.success(`已归档 ${r.collectionsArchived} 个集合、${r.endpointsArchived} 条涉及接口`)
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

function resetCaseForm() {
  const iface = selectedInterface.value
  const col = selectedCollection.value
  caseForm.value = {
    id: '',
    project: col?.project || '',
    environment: 'TEST',
    name: iface ? `${iface.method} ${iface.label || iface.path.split('/').pop()}` : '',
    description: '',
    method: iface?.method || 'GET',
    path: iface?.path || '',
    query: '',
    headers: '{}',
    body: '',
    assertions: '[{"type":"status","equals":200}]',
    enabled: false,
    sortOrder: 100
  }
}

function openCreateCase() {
  if (selectedCollection.value?.virtual) {
    ElMessage.warning('请先为本需求单新建集合，再添加用例')
    return
  }
  resetCaseForm()
  loadEditorRows()
  caseDrawer.value = true
}

function openEditCase(row: any) {
  caseForm.value = {
    id: row.id,
    project: row.project || selectedCollection.value?.project || '',
    environment: row.environment || 'TEST',
    name: row.name || '',
    description: row.description || '',
    method: row.method || 'GET',
    path: row.path || '',
    query: row.query || '',
    headers: row.headers || '{}',
    body: row.body || '',
    assertions: row.assertions || '[{"type":"status","equals":200}]',
    enabled: row.enabled !== false,
    sortOrder: row.sortOrder ?? 100
  }
  loadEditorRows()
  caseDrawer.value = true
}

async function saveCaseForm() {
  if (!caseForm.value.name.trim() || !caseForm.value.path.trim()) {
    ElMessage.warning('名称和 Path 必填')
    return
  }
  // 表格模式下由行拼出 JSON——人写不出语法错，这里也就不用再校验一遍。
  // 只有停在「源码」页时才是人手写的，那时才校验
  if (!assertRaw.value) {
    caseForm.value.assertions = rowsToAsserts()
  } else {
    try {
      JSON.parse(caseForm.value.assertions || '[]')
    } catch {
      ElMessage.warning('断言不是合法 JSON —— 切回表格模式就不会写错了')
      return
    }
  }
  caseForm.value.headers = rowsToJson(headerRows.value)
  caseForm.value.query = rowsToQuery(paramRows.value) || ''
  caseSaving.value = true
  try {
    const body = {
      project: caseForm.value.project || selectedCollection.value?.project,
      environment: caseForm.value.environment,
      name: caseForm.value.name.trim(),
      description: caseForm.value.description,
      method: caseForm.value.method,
      path: caseForm.value.path.trim(),
      query: caseForm.value.query || undefined,
      headers: caseForm.value.headers,
      body: caseForm.value.body,
      assertions: caseForm.value.assertions,
      enabled: caseForm.value.enabled,
      sortOrder: caseForm.value.sortOrder,
      requirementRef: selectedCollection.value?.requirementNo || undefined
    }
    if (caseForm.value.id) {
      await apiClient.updateApiTestCase(caseForm.value.id, body)
    } else {
      const saved = await apiClient.createApiTestCase(body)
      const colId = selectedCollection.value?.id
      if (colId && saved?.id) {
        const ids = [...collectionCases.value.map((c) => c.id), saved.id]
        await apiClient.assignApiTestCases(colId, ids)
      }
    }
    ElMessage.success('已保存')
    caseDrawer.value = false
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    caseSaving.value = false
  }
}

async function removeCase(row: any) {
  try {
    await ElMessageBox.confirm(`删除用例「${row.name}」？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestCase(row.id)
    ElMessage.success('已删除')
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function generateCaseForInterface() {
  const iface = selectedInterface.value
  if (!iface) return
  generatingCase.value = true
  try {
    let note = ''
    if (iface.linkId) {
      const r = await apiClient.generateCaseFromRequirementEndpoint(iface.linkId, {
        collectionId: selectedCollection.value?.id,
        appVersion: appVersion.value || undefined,
        sourceBranch: selectedCollection.value?.sourceBranch
      })
      note = r.note || ''
      if (r.collectionCreated) await loadTree()
    } else if (iface.endpointId) {
      const r = await apiClient.generateCaseFromEndpoint(iface.endpointId)
      note = r.note || ''
      const colId = selectedCollection.value?.id
      if (colId && r.case?.id) {
        const ids = [...collectionCases.value.map((c) => c.id), r.case.id]
        await apiClient.assignApiTestCases(colId, ids)
      }
    } else {
      ElMessage.warning('找不到接口关联记录，请刷新后重试')
      return
    }
    ElMessage.success(note || '已生成用例')
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generatingCase.value = false
  }
}

async function runInterfaceCases() {
  // 只跑启用的：停用的那些是「待补断言」，跑起来必然失败，
  // 而失败得毫无意义 —— 几次之后人就不再看执行结果了
  const runnable = selectedInterfaceCases.value.filter((c: any) => c.enabled)
  const ids = runnable.map((c: any) => c.id).filter(Boolean)
  if (!ids.length) {
    ElMessage.warning('这个接口下没有已启用的用例。停用的是「待补断言」，补完断言再启用')
    return
  }
  const skipped = selectedInterfaceCases.value.length - runnable.length
  runningCase.value = true
  try {
    const r = await apiClient.runApiTest({
      caseIds: ids,
      environment: scope.value === 'LIVE' ? 'PROD' : 'TEST'
    })
    ElMessage[r.ok ? 'success' : 'warning'](
      (r.message || '执行完成') + (skipped > 0 ? `（跳过 ${skipped} 条待补断言的）` : '')
    )
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningCase.value = false
  }
}

function openImportDoc() {
  importDocContent.value = ''
  importDocVisible.value = true
}

async function submitImportDoc() {
  const project = selectedCollection.value?.project
  if (!project) {
    ElMessage.warning('请先选择需求单/集合')
    return
  }
  if (importDocMode.value === 'docx') {
    if (!docFile.value) {
      ElMessage.warning('先选一个 .docx 文件')
      return
    }
    importingDoc.value = true
    try {
      const r = await apiClient.importInterfaceDoc(project, docFile.value)
      // 不关弹窗：未匹配的接口清单要留给人看——那是漏测点，关掉就没人再想起来
      importResult.value = r
      ElMessage.success(`已写入 ${r.matched} 个接口的文档约束`)
      await refreshSelectedCases()
    } catch (e: any) {
      ElMessage.error(e?.message || '导入失败')
    } finally {
      importingDoc.value = false
    }
    return
  }

  const content = importDocContent.value.trim()
  if (!content) {
    ElMessage.warning('先粘贴 OpenAPI JSON')
    return
  }
  importingDoc.value = true
  try {
    const r = await apiClient.importOpenApi(project, content)
    importDocVisible.value = false
    ElMessage.success(`已导入 ${r.imported} 个接口到接口清单（文档仅参考）`)
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importingDoc.value = false
  }
}

function run(c: any) {
  runTarget.value = c
  runEnv.value = scope.value === 'LIVE' ? 'PROD' : 'TEST'
  confirmProd.value = false
  runDialog.value = true
}

async function doRun() {
  running.value = true
  try {
    const r = await apiClient.runApiTest({
      collectionId: runTarget.value.id,
      environment: runEnv.value,
      confirmProd: confirmProd.value
    })
    runDialog.value = false
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await loadTree()
    if (selectedCollection.value) {
      await refreshSelectedCases()
    }
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  try {
    if (route.query.scope === 'LIVE') scope.value = 'LIVE'
    await loadProjects()
    await loadVersions()
    await loadTree()
    const reqNo = String(route.query.requirementNo || '').trim()
    if (reqNo && treeData.value.length) {
      const node = findTreeNode((n) => n.kind === 'collection' && (n.requirementNo === reqNo || n.label === reqNo))
      if (node) await selectTreeNode(node)
    }
    const qPath = String(route.query.path || '').trim()
    const qMethod = String(route.query.method || '').trim()
    if (qPath) {
      await onMustTestSelect({
        priority: '',
        kind: 'ENDPOINT',
        httpMethod: qMethod,
        path: qPath,
        title: '',
        why: '',
        notes: []
      })
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '页面初始化失败')
  }
})
</script>

<style scoped>
.collections-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.page-body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 0;
  height: 100%;
}

.scope-tabs {
  display: flex;
  gap: 24px;
  padding: 14px 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.scope-tab {
  border: none;
  background: none;
  padding: 0 0 12px;
  font-size: 14px;
  color: #595959;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.scope-tab.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
  font-weight: 500;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 16px 24px;
  overflow: auto;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.head-left h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bfbfbf;
  font-size: 14px;
  min-height: 200px;
}

.import-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #8c8c8c;
  line-height: 1.5;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}

.progress-block {
  margin-bottom: 20px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #595959;
  margin-bottom: 8px;
}

.progress-chips {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 13px;
}

.chip-pass { color: #52c41a; }
.chip-pending { color: #8c8c8c; }

.stat-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #595959;
}

.stat-bar {
  flex: 1;
  max-width: 200px;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
}

.stat-fill {
  width: 100%;
  height: 100%;
  background: #1890ff;
  border-radius: 2px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input {
  /* 不加上限的话搜索框会一路撑开，把「执行本接口」挤出可视区 */
  max-width: 300px;
  flex: 1;
  min-width: 240px;
  max-width: 480px;
}

.path-main {
  font-weight: 500;
  word-break: break-all;
}

.path-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #bfbfbf;
}

.verify-tag { font-size: 13px; }
.st-pass { color: #52c41a; }
.st-pending { color: #8c8c8c; }
.st-live { color: #1890ff; }

.tree-status {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 10px;
}

.ts-ok { background: #f6ffed; color: #52c41a; }
.ts-run { background: #fff7e6; color: #fa8c16; }
.ts-pending { background: #f5f5f5; color: #8c8c8c; }

.pill-ctrl { background: #e6fffb; color: #13c2c2; }
.pill-env { background: #f5f5f5; color: #595959; }
.pill-ok { background: #f6ffed; color: #52c41a; }
.pill-run { background: #fff7e6; color: #fa8c16; }

/* ---- 左侧 ---- */
.nav-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f0f0f0;
  background: #fff;
  min-height: 0;
}

.scope-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 12px 12px 0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}

.scope-btn {
  border: none;
  background: #fff;
  padding: 8px 0;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
}

.scope-btn + .scope-btn {
  border-left: 1px solid #d9d9d9;
}

.scope-btn.active {
  background: #1890ff;
  color: #fff;
}

.nav-toolbar {
  padding: 10px 12px 6px;
}

.nav-hint {
  padding: 0 14px 8px;
  font-size: 11px;
  color: #bfbfbf;
}

.nav-tree-wrap {
  flex: 1;
  overflow: auto;
  padding: 0 8px 12px;
  min-height: 0;
}

.nav-empty {
  padding: 24px 12px;
  font-size: 13px;
  color: #bfbfbf;
  text-align: center;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
}

.tree-leaf-row .tree-text {
  color: #595959;
}

.tree-dot {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #bfbfbf;
  margin-left: 2px;
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) .tree-dot {
  background: #1890ff;
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) .tree-text {
  color: #1890ff;
}

.tree-badge {
  flex-shrink: 0;
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #f5f5f5;
  color: #8c8c8c;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.nav-tree-wrap :deep(.el-tree) {
  background: transparent;
  --el-tree-node-hover-bg-color: #f5f5f5;
}

.nav-tree-wrap :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 4px;
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #e6f4ff !important;
}

.nav-tree-wrap :deep(.el-tree-node__expand-icon) {
  color: #8c8c8c;
  font-size: 12px;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #faad14;
}

.tree-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #262626;
}

.nav-pagination {
  padding: 8px 4px 4px;
  border-top: 1px solid #f0f0f0;
}

.nav-pagination :deep(.el-pagination) {
  justify-content: center;
  flex-wrap: wrap;
}

.nav-pagination :deep(.el-pager li) {
  min-width: 26px;
}

/* ---- 右侧 ---- */
.detail-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  background: #fff;
}

.main-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.version-select {
  width: 180px;
}

.coll-head {
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.coll-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.coll-title-line h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.pill {
  display: inline-block;
  padding: 0 8px;
  border-radius: 2px;
  font-size: 12px;
  line-height: 22px;
  border: 1px solid transparent;
}

.pill.sm {
  font-size: 11px;
  line-height: 20px;
}

.pill-test {
  background: #f6ffed;
  color: #52c41a;
  border-color: #b7eb8f;
}

.pill-live {
  background: #e6f7ff;
  color: #1890ff;
  border-color: #91d5ff;
}

.pill-req {
  background: #fff;
  color: #1890ff;
  border-color: #91d5ff;
}

.pill-online {
  background: #f6ffed;
  color: #52c41a;
  border-color: #b7eb8f;
  cursor: pointer;
}

.pill-online:hover {
  background: #d9f7be;
}

.coll-stats {
  margin-left: auto;
  font-size: 13px;
  color: #8c8c8c;
  white-space: nowrap;
}

.coll-action-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.coll-actions-left,
.coll-actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.more-btn {
  min-width: 32px;
  padding: 8px 10px;
  letter-spacing: 1px;
}

/* 用例列表 */
.case-rows {
  padding: 0 20px;
}

.case-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.case-row.is-disabled {
  opacity: 0.65;
}

.case-row.is-collection {
  cursor: pointer;
}

.case-row.is-collection:hover {
  background: #fafafa;
}

.collection-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.method-tag {
  flex-shrink: 0;
  min-width: 40px;
  padding: 0 6px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 20px;
}

.m-get {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.m-post {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.m-put {
  background: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
}

.m-del {
  background: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffa39e;
}

.m-other {
  background: #fafafa;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.case-path {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-meta {
  flex-shrink: 0;
  color: #bfbfbf;
  font-size: 12px;
  white-space: nowrap;
}

.case-toggle {
  flex-shrink: 0;
  border: none;
  background: none;
  color: #1890ff;
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}

.case-toggle:hover {
  color: #096dd9;
  text-decoration: underline;
}
.import-file {
  margin-left: 10px;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
}

.import-result {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12.5px;
  line-height: 1.9;
}

.import-warn {
  color: var(--el-color-warning);
}

.import-dim {
  color: var(--el-text-color-secondary);
}

.kv-tabs {
  padding: 0 20px 8px;
}

.kv-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.kv-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.as-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.as-val {
  flex: 1;
  min-width: 110px;
}

.cap-doc-dim {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

</style>
