<template>
  <div class="ui-flows">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">流程编排</span>
            <p class="card-sub">支持启动应用、点击输入，以及「元素存在判断」分支（存在 / 不存在走不同步骤）</p>
          </div>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>
            新建流程
          </el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-form :inline="true">
          <el-form-item label="应用">
            <el-select v-model="filterAppId" clearable filterable placeholder="选择应用" style="width: 220px">
              <el-option
                v-for="a in appOptions"
                :key="a.id"
                :label="`${a.nameZh} (${a.id})`"
                :value="a.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filterPlatform" clearable style="width: 140px">
              <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="场景">
            <el-select v-model="filterCatalog" clearable style="width: 140px">
              <el-option label="两边共用" value="SHARED" />
              <el-option label="自动化" value="AUTOMATION" />
              <el-option label="测试" value="ONLINE" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅组件">
            <el-switch v-model="componentOnly" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table v-loading="loading" :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#f5f7fa' }">
        <el-table-column prop="name" label="流程名称" min-width="140" />
        <el-table-column label="步骤数" width="80" align="center">
          <template #default="{ row }">{{ stepCount(row.steps) }}</template>
        </el-table-column>
        <el-table-column label="组件" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isComponent" size="small" type="success">是</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="catalog" label="目录" width="100" />
        <el-table-column prop="platform" label="平台" width="110">
          <template #default="{ row }">{{ row.platform || '通用' }}</template>
        </el-table-column>
        <el-table-column label="应用" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ appLabel(row.appId) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无流程，可新建一条「登录」试编排" />
    </el-card>

    <el-drawer v-model="drawerVisible" :title="editingId ? '编辑流程' : '新建流程'" size="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如 登录" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="应用">
          <el-select v-model="form.appId" clearable filterable placeholder="可选" style="width: 100%">
            <el-option
              v-for="a in appOptions"
              :key="a.id"
              :label="`${a.nameZh} (${a.id})`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="form.platform" clearable placeholder="通用" style="width: 100%">
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景">
          <el-select v-model="form.catalog" style="width: 100%">
            <el-option label="两边共用" value="SHARED" />
            <el-option label="自动化" value="AUTOMATION" />
            <el-option label="测试" value="ONLINE" />
          </el-select>
        </el-form-item>
        <el-form-item label="存为组件">
          <el-switch v-model="form.isComponent" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-divider content-position="left">步骤（从上到下执行）</el-divider>

        <div class="steps-toolbar">
          <el-select v-model="addKeywordCode" placeholder="选择关键字" filterable style="width: 240px">
            <el-option
              v-for="k in keywords"
              :key="k.code"
              :label="`${k.nameZh} (${k.code})`"
              :value="k.code" />
          </el-select>
          <el-button type="primary" @click="addStep">添加步骤</el-button>
        </div>
        <div class="keyword-quick">
          <span class="keyword-quick-label">常用：</span>
          <el-button
            v-for="k in quickKeywords"
            :key="k.code"
            size="small"
            round
            @click="quickAdd(k.code)"
          >
            {{ k.nameZh }}
          </el-button>
        </div>

        <div v-if="steps.length === 0" class="steps-empty">暂无步骤，请从上方添加关键字</div>

        <div
          v-for="(step, idx) in steps"
          :key="idx"
          class="step-card"
          :class="{ 'step-card-if': step.keywordCode === 'IF_ELEMENT_EXISTS' }"
        >
          <div class="step-head">
            <span class="step-idx">{{ idx + 1 }}</span>
            <el-tag size="small" :type="step.keywordCode === 'IF_ELEMENT_EXISTS' ? 'warning' : 'primary'">
              {{ keywordName(step.keywordCode) }}
            </el-tag>
            <el-tag size="small" type="info" effect="plain">{{ step.keywordCode }}</el-tag>
            <span class="step-spacer" />
            <el-button link size="small" :disabled="idx === 0" @click="moveStep(idx, -1)">上移</el-button>
            <el-button link size="small" :disabled="idx === steps.length - 1" @click="moveStep(idx, 1)">下移</el-button>
            <el-button type="danger" link size="small" @click="steps.splice(idx, 1)">删除</el-button>
          </div>

          <el-form label-width="90px" class="step-form">
            <el-form-item v-if="needsElement(step.keywordCode)" :label="step.keywordCode === 'IF_ELEMENT_EXISTS' ? '判断元素' : '元素英文名'">
              <el-select
                v-model="step.elementKey"
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="从元素库选或手输 nameEn"
                style="width: 100%"
              >
                <el-option
                  v-for="el in elementOptions"
                  :key="el.nameEn"
                  :label="`${el.nameZh} (${el.nameEn})`"
                  :value="el.nameEn" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'IF_ELEMENT_EXISTS'" label="探测超时秒">
              <el-input-number v-model="step.params.timeoutSec" :min="1" :max="60" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'LAUNCH_APP'" label="包名/Bundle">
              <el-input v-model="step.params.packageName" placeholder="可选；空则用流程所选应用字典中的包名" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'LAUNCH_APP'" label="Activity">
              <el-input v-model="step.params.activity" placeholder="Android 可选，如 .LauncherActivity" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'INPUT'" label="输入内容">
              <el-input v-model="step.params.text" placeholder="如手机号或验证码" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'WAIT'" label="延迟毫秒">
              <el-input-number v-model="step.params.durationMs" :min="0" :step="500" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'WAIT_ELEMENT'" label="等待类型">
              <el-select v-model="step.params.waitType" style="width: 100%">
                <el-option label="Presence" value="Presence" />
                <el-option label="Visible" value="Visible" />
                <el-option label="Clickable" value="Clickable" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'WAIT_ELEMENT'" label="超时秒">
              <el-input-number v-model="step.params.timeoutSec" :min="1" :max="120" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'SWIPE'" label="方向">
              <el-select v-model="step.params.direction" style="width: 100%">
                <el-option label="up" value="up" />
                <el-option label="down" value="down" />
                <el-option label="left" value="left" />
                <el-option label="right" value="right" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'ASSERT_TEXT'" label="期望文案">
              <el-input v-model="step.params.expected" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'CALL_COMPONENT'" label="组件流程ID">
              <el-input v-model="step.params.flowId" placeholder="其它流程的 id" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'SCREENSHOT'" label="备注">
              <el-input v-model="step.params.label" />
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'RETURN_MESSAGE'" label="提示文案">
              <el-input
                v-model="step.params.message"
                type="textarea"
                :rows="2"
                maxlength="500"
                show-word-limit
                placeholder="手动输入要返回的提示" />
            </el-form-item>
          </el-form>

          <!-- 元素存在判断：存在 / 不存在 两支 -->
          <template v-if="step.keywordCode === 'IF_ELEMENT_EXISTS'">
            <div class="branch-box then">
              <div class="branch-title">存在时执行</div>
              <p class="branch-tip">元素找到后走这里（例如点击关闭弹窗）</p>
              <div class="branch-toolbar">
                <el-select
                  :model-value="branchCode(idx, 'then')"
                  filterable
                  style="width: 200px"
                  @update:model-value="(v: string) => setBranchCode(idx, 'then', v)"
                >
                  <el-option
                    v-for="k in branchKeywords"
                    :key="k.code"
                    :label="`${k.nameZh} (${k.code})`"
                    :value="k.code" />
                </el-select>
                <el-button size="small" type="primary" @click="addBranchStep(step, 'thenSteps', branchCode(idx, 'then'))">
                  添加
                </el-button>
              </div>
              <div v-if="!(step.params.thenSteps || []).length" class="branch-empty">暂无步骤</div>
              <div
                v-for="(bs, bi) in step.params.thenSteps || []"
                :key="'t-' + bi"
                class="branch-step"
              >
                <div class="branch-step-head">
                  <span class="branch-idx">{{ bi + 1 }}</span>
                  <el-tag size="small" type="primary">{{ keywordName(bs.keywordCode) }}</el-tag>
                  <span class="step-spacer" />
                  <el-button link size="small" :disabled="bi === 0" @click="moveBranch(step, 'thenSteps', bi, -1)">上移</el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="bi === (step.params.thenSteps || []).length - 1"
                    @click="moveBranch(step, 'thenSteps', bi, 1)"
                  >
                    下移
                  </el-button>
                  <el-button type="danger" link size="small" @click="step.params.thenSteps.splice(bi, 1)">删除</el-button>
                </div>
                <BranchStepFields :step="bs" :element-options="elementOptions" :needs-element="needsElement(bs.keywordCode)" />
              </div>
            </div>

            <div class="branch-box else">
              <div class="branch-title">不存在时执行</div>
              <p class="branch-tip">可直接填写返回提示；或再添加其它步骤（如点击、输入）</p>
              <el-form label-width="100px" class="step-form else-msg-form">
                <el-form-item label="返回提示">
                  <el-input
                    v-model="step.params.elseMessage"
                    type="textarea"
                    :rows="2"
                    maxlength="500"
                    show-word-limit
                    placeholder="例如：未找到登录按钮，请检查页面是否已登录" />
                </el-form-item>
              </el-form>
              <div class="branch-toolbar">
                <el-select
                  :model-value="branchCode(idx, 'else')"
                  filterable
                  style="width: 200px"
                  @update:model-value="(v: string) => setBranchCode(idx, 'else', v)"
                >
                  <el-option
                    v-for="k in branchKeywords"
                    :key="k.code"
                    :label="`${k.nameZh} (${k.code})`"
                    :value="k.code" />
                </el-select>
                <el-button size="small" type="primary" @click="addBranchStep(step, 'elseSteps', branchCode(idx, 'else'))">
                  添加步骤
                </el-button>
              </div>
              <div v-if="!(step.params.elseSteps || []).length" class="branch-empty">暂无额外步骤（仅返回提示也可）</div>
              <div
                v-for="(bs, bi) in step.params.elseSteps || []"
                :key="'e-' + bi"
                class="branch-step"
              >
                <div class="branch-step-head">
                  <span class="branch-idx">{{ bi + 1 }}</span>
                  <el-tag size="small" type="primary">{{ keywordName(bs.keywordCode) }}</el-tag>
                  <span class="step-spacer" />
                  <el-button link size="small" :disabled="bi === 0" @click="moveBranch(step, 'elseSteps', bi, -1)">上移</el-button>
                  <el-button
                    link
                    size="small"
                    :disabled="bi === (step.params.elseSteps || []).length - 1"
                    @click="moveBranch(step, 'elseSteps', bi, 1)"
                  >
                    下移
                  </el-button>
                  <el-button type="danger" link size="small" @click="step.params.elseSteps.splice(bi, 1)">删除</el-button>
                </div>
                <BranchStepFields :step="bs" :element-options="elementOptions" :needs-element="needsElement(bs.keywordCode)" />
              </div>
            </div>
          </template>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存流程</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import BranchStepFields from './BranchStepFields.vue'

interface FlowStep {
  keywordCode: string
  elementKey?: string
  params: Record<string, any>
}

const QUICK_CODES = [
  'LAUNCH_APP',
  'IF_ELEMENT_EXISTS',
  'RETURN_MESSAGE',
  'CLICK',
  'INPUT',
  'WAIT',
  'WAIT_ELEMENT',
  'SWIPE',
  'BACK',
  'SCREENSHOT'
]

const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' },
  { value: 'POG_ANDROID', label: 'Pog-Android' },
  { value: 'POG_IOS', label: 'Pog-iOS' }
]

const filterAppId = ref('')
const filterPlatform = ref('')
const filterCatalog = ref('SHARED')
const componentOnly = ref(false)
const loading = ref(false)
const list = ref<any[]>([])
const keywords = ref<any[]>([])
const elementOptions = ref<any[]>([])
const appOptions = ref<any[]>([])

const quickKeywords = computed(() => {
  const map = new Map(keywords.value.map((k) => [k.code, k]))
  return QUICK_CODES.map((code) => map.get(code)).filter(Boolean) as any[]
})

const branchKeywords = computed(() =>
  keywords.value.filter((k) => k.code !== 'IF_ELEMENT_EXISTS')
)

/** 每个顶层 IF 步骤对应的分支添加下拉选中值 */
const branchAddCodes = ref<Array<{ then: string; else: string }>>([])

function syncBranchAddCodes() {
  const def = branchKeywords.value[0]?.code || 'CLICK'
  while (branchAddCodes.value.length < steps.value.length) {
    branchAddCodes.value.push({ then: def, else: def })
  }
  if (branchAddCodes.value.length > steps.value.length) {
    branchAddCodes.value.length = steps.value.length
  }
}

function branchCode(idx: number, which: 'then' | 'else') {
  syncBranchAddCodes()
  return branchAddCodes.value[idx]?.[which] || branchKeywords.value[0]?.code || 'CLICK'
}

function setBranchCode(idx: number, which: 'then' | 'else', v: string) {
  syncBranchAddCodes()
  if (!branchAddCodes.value[idx]) {
    const def = branchKeywords.value[0]?.code || 'CLICK'
    branchAddCodes.value[idx] = { then: def, else: def }
  }
  branchAddCodes.value[idx][which] = v
}

function appLabel(id: string) {
  if (!id) return '—'
  const hit = appOptions.value.find((a) => a.id === id)
  return hit ? hit.nameZh : id
}

function stepCount(stepsRaw: string | any[]) {
  try {
    const arr = typeof stepsRaw === 'string' ? JSON.parse(stepsRaw || '[]') : stepsRaw
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function keywordName(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  return k?.nameZh || code
}

function needsElement(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  return !!k?.needsElement
}

function createStep(code: string): FlowStep {
  const params: Record<string, any> = {}
  if (code === 'LAUNCH_APP') {
    params.packageName = ''
    params.activity = ''
  }
  if (code === 'WAIT') params.durationMs = 1000
  if (code === 'WAIT_ELEMENT') {
    params.waitType = 'Visible'
    params.timeoutSec = 10
  }
  if (code === 'SWIPE') params.direction = 'up'
  if (code === 'IF_ELEMENT_EXISTS') {
    params.timeoutSec = 3
    params.elseMessage = ''
    params.thenSteps = []
    params.elseSteps = []
  }
  if (code === 'RETURN_MESSAGE') {
    params.message = ''
  }
  return { keywordCode: code, elementKey: '', params }
}

function parseStep(s: any): FlowStep {
  const params = { ...(s?.params || {}), ...(s?.text != null ? { text: s.text } : {}) }
  if (Array.isArray(params.thenSteps)) params.thenSteps = params.thenSteps.map(parseStep)
  if (Array.isArray(params.elseSteps)) params.elseSteps = params.elseSteps.map(parseStep)
  if ((s?.keywordCode || s?.action) === 'IF_ELEMENT_EXISTS') {
    if (!Array.isArray(params.thenSteps)) params.thenSteps = []
    if (!Array.isArray(params.elseSteps)) params.elseSteps = []
    if (params.timeoutSec == null) params.timeoutSec = 3
  }
  return {
    keywordCode: s?.keywordCode || s?.action || 'CLICK',
    elementKey: s?.elementKey || s?.element || '',
    params
  }
}

function parseSteps(raw: string | any[]): FlowStep[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    if (!Array.isArray(arr)) return []
    return arr.map(parseStep)
  } catch {
    return []
  }
}

function serializeStep(s: FlowStep): any {
  const params: Record<string, any> = { ...(s.params || {}) }
  if (Array.isArray(params.thenSteps)) params.thenSteps = params.thenSteps.map(serializeStep)
  if (Array.isArray(params.elseSteps)) params.elseSteps = params.elseSteps.map(serializeStep)
  return {
    keywordCode: s.keywordCode,
    elementKey: s.elementKey || undefined,
    params
  }
}

async function loadList() {
  loading.value = true
  try {
    list.value = await apiClient.getUiFlows({
      appId: filterAppId.value.trim() || undefined,
      platform: filterPlatform.value || undefined,
      catalog: filterCatalog.value || undefined,
      componentOnly: componentOnly.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行 schema_ui_assets.sql）')
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    appOptions.value = await apiClient.getUiApps({ enabledOnly: true })
  } catch {
    appOptions.value = []
  }
  try {
    keywords.value = await apiClient.getUiKeywords({ enabledOnly: true })
  } catch {
    keywords.value = []
  }
  try {
    elementOptions.value = await apiClient.getUiElements({ catalogs: 'AUTOMATION,ONLINE,SHARED' })
  } catch {
    elementOptions.value = []
  }
}

const drawerVisible = ref(false)
const editingId = ref('')
const saving = ref(false)
const formRef = ref<FormInstance>()
const addKeywordCode = ref('CLICK')
const steps = ref<FlowStep[]>([])
const form = reactive({
  name: '',
  description: '',
  appId: '',
  platform: '',
  catalog: 'SHARED',
  isComponent: false,
  enabled: true
})
const rules: FormRules = {
  name: [{ required: true, message: '必填', trigger: 'blur' }]
}

watch(steps, () => syncBranchAddCodes(), { deep: true })

function openAdd() {
  editingId.value = ''
  Object.assign(form, {
    name: '',
    description: '',
    appId: filterAppId.value || '',
    platform: filterPlatform.value || '',
    catalog: filterCatalog.value || 'SHARED',
    isComponent: false,
    enabled: true
  })
  steps.value = []
  branchAddCodes.value = []
  addKeywordCode.value =
    keywords.value.find((k) => k.code === 'IF_ELEMENT_EXISTS')?.code ||
    keywords.value.find((k) => k.code === 'LAUNCH_APP')?.code ||
    keywords.value[0]?.code ||
    'CLICK'
  drawerVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name || '',
    description: row.description || '',
    appId: row.appId || '',
    platform: row.platform || '',
    catalog: row.catalog || 'SHARED',
    isComponent: !!row.isComponent,
    enabled: row.enabled !== false
  })
  steps.value = parseSteps(row.steps)
  syncBranchAddCodes()
  drawerVisible.value = true
}

function addStep() {
  const code = addKeywordCode.value
  if (!code) {
    ElMessage.warning('请先选择关键字')
    return
  }
  steps.value.push(createStep(code))
  syncBranchAddCodes()
}

function quickAdd(code: string) {
  addKeywordCode.value = code
  steps.value.push(createStep(code))
  syncBranchAddCodes()
}

function addBranchStep(step: FlowStep, which: 'thenSteps' | 'elseSteps', code: string) {
  if (!code) {
    ElMessage.warning('请选择分支关键字')
    return
  }
  if (!Array.isArray(step.params[which])) step.params[which] = []
  step.params[which].push(createStep(code))
}

function moveBranch(step: FlowStep, which: 'thenSteps' | 'elseSteps', idx: number, delta: number) {
  const arr = step.params[which] as FlowStep[]
  if (!arr) return
  const to = idx + delta
  if (to < 0 || to >= arr.length) return
  const t = arr[idx]
  arr[idx] = arr[to]
  arr[to] = t
}

function moveStep(idx: number, delta: number) {
  const to = idx + delta
  if (to < 0 || to >= steps.value.length) return
  const arr = steps.value
  const t = arr[idx]
  arr[idx] = arr[to]
  arr[to] = t
  const codes = branchAddCodes.value
  const c = codes[idx]
  codes[idx] = codes[to]
  codes[to] = c
}

async function submit() {
  await formRef.value?.validate().catch(() => Promise.reject())
  for (const s of steps.value) {
    if (s.keywordCode === 'IF_ELEMENT_EXISTS' && !s.elementKey?.trim()) {
      ElMessage.warning('「元素存在判断」必须选择要判断的元素')
      return
    }
  }
  saving.value = true
  try {
    const body = {
      ...form,
      platform: form.platform || null,
      appId: form.appId || null,
      steps: JSON.stringify(steps.value.map(serializeStep))
    }
    if (editingId.value) {
      await apiClient.updateUiFlow(editingId.value, body)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiFlow(body)
      ElMessage.success('已创建')
    }
    drawerVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除流程「${row.name}」？`, '删除', { type: 'warning' })
  try {
    await apiClient.deleteUiFlow(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadMeta()
  await loadList()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}
.filter-bar {
  margin-bottom: 12px;
}
.steps-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.keyword-quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.keyword-quick-label {
  font-size: 12px;
  color: #909399;
}
.steps-empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}
.step-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #fafafa;
}
.step-card-if {
  border-color: #f5dab1;
  background: #fffaf2;
}
.step-head,
.branch-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.step-idx {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.step-spacer {
  flex: 1;
}
.step-form {
  margin-top: 4px;
}
.branch-box {
  margin-top: 10px;
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed #dcdfe6;
  background: #fff;
}
.branch-box.then {
  border-color: #b3e19d;
  background: #f0f9eb;
}
.branch-box.else {
  border-color: #fab6b6;
  background: #fef0f0;
}
.else-msg-form {
  margin-bottom: 8px;
}
.branch-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}
.branch-tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}
.branch-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.branch-empty {
  font-size: 12px;
  color: #c0c4cc;
  padding: 4px 0;
}
.branch-step {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  background: #fff;
}
.branch-idx {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #909399;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
