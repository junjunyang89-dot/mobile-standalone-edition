<template>
  <el-dialog
    v-model="visible"
    title="AI 编排"
    width="800px"
    append-to-body
    :close-on-click-modal="!composing"
    :close-on-press-escape="!composing"
    :show-close="!composing"
    @open="onOpen"
  >
    <p class="ai-compose-lead">
      条件和页面先选好，再到「步骤」里把关键字和元素放到第几步。点一下或按住拖都可以。生成的是停用草稿。
    </p>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="92px" @submit.prevent>
      <el-tabs v-model="tab" class="compose-tabs">
        <el-tab-pane label="条件" name="base">
      <el-form-item label="应用" prop="appId">
        <el-select
          v-model="form.appId"
          filterable
          placeholder="选择应用"
          style="width: 100%"
          :disabled="composing"
          @change="onAppChange"
        >
          <el-option
            v-for="a in apps"
            :key="a.id"
            :label="appLabel(a)"
            :value="a.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="平台" prop="platform">
        <el-select v-model="form.platform" placeholder="选择平台" style="width: 100%" :disabled="composing">
          <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="环境">
        <el-select v-model="form.environment" style="width: 100%" :disabled="composing">
          <el-option label="测试" value="TEST" />
          <el-option label="生产" value="PROD" />
        </el-select>
      </el-form-item>
      <el-form-item label="用途">
        <el-select v-model="form.catalog" style="width: 100%" :disabled="composing">
          <el-option label="仅自动化" value="AUTOMATION" />
          <el-option label="仅回归" value="ONLINE" />
          <el-option label="回归+自动化" value="SHARED" />
          <el-option label="仅性能" value="PERFORMANCE" />
        </el-select>
      </el-form-item>
      <el-form-item label="功能阶段">
        <el-select v-model="form.releaseStage" style="width: 100%" :disabled="composing">
          <el-option label="本版新功能" value="TESTING" />
          <el-option label="已上线" value="ONLINE" />
        </el-select>
      </el-form-item>
      <el-form-item label="流程名称">
        <el-input v-model="form.flowName" placeholder="留空则自动生成" maxlength="80" :disabled="composing" />
      </el-form-item>
        </el-tab-pane>
        <el-tab-pane label="页面" name="pages">
      <el-form-item label="涉及页面" required :error="pageError">
        <el-select
          :key="pickKey"
          filterable
          placeholder="搜索页面并加入"
          style="width: 100%"
          :loading="pagesLoading"
          :disabled="!form.appId || composing"
          @change="addPage"
        >
          <el-option-group v-for="g in pageGroups" :key="g.tag" :label="g.tag">
            <el-option
              v-for="p in g.items"
              :key="p.pageId"
              :label="pageOptionLabel(p)"
              :value="p.pageId"
              :disabled="selectedIds.has(p.pageId)"
            />
          </el-option-group>
        </el-select>
        <p class="ai-compose-hint">拖动或用上移下移排顺序。这个顺序就是流程路径。点元素个数可预览，真正往步骤上放元素请到「步骤」。</p>
        <ul v-if="selected.length" class="page-order">
          <li
            v-for="(p, index) in selected"
            :key="p.pageId"
            draggable="true"
            :class="{ over: dragOver === index }"
            @dragstart="onDragStart(index, $event)"
            @dragover.prevent="dragOver = index"
            @drop="onDrop(index)"
            @dragend="dragOver = -1"
          >
            <span class="ord">{{ index + 1 }}</span>
            <span class="page-name">{{ p.nameZh || p.pageId }}</span>
            <button
              type="button"
              class="page-count"
              @mousedown.stop
              @click.stop="openElements(p)"
            >{{ countLabel(p) || '查看元素' }}</button>
            <span class="page-ops">
              <el-button link :disabled="composing || index === 0" @click="move(index, -1)">上移</el-button>
              <el-button link :disabled="composing || index === selected.length - 1" @click="move(index, 1)">下移</el-button>
              <el-button link type="danger" :disabled="composing" @click="removePage(index)">移除</el-button>
            </span>
          </li>
        </ul>
        <p v-else-if="form.appId && !pagesLoading && !pages.length" class="ai-compose-hint warn">
          这个应用还没有启用的页面。先去元素管理把页面建好。
        </p>
      </el-form-item>
        </el-tab-pane>
        <el-tab-pane label="步骤" name="steps">
          <p class="ai-compose-hint">
            左边点一下，放到右边标「当前」的那一步后面。若当前是「判断存在」这类可挂子步骤的，再点关键字就是 2.1、2.2。
            按住拖也可以。定位里有 ${'{'}变量{'}'} 的，会在步骤下出现输入框。
          </p>
          <p v-if="outlineError" class="ai-compose-hint warn">{{ outlineError }}</p>
          <div class="step-board">
            <div class="palette">
              <el-input v-model="keywordQuery" clearable placeholder="搜索关键字，如 冷启动、区域内滑动" :disabled="composing" />
              <div v-if="keywordHits.length" class="chip-row">
                <button
                  v-for="k in keywordHits"
                  :key="k.code"
                  type="button"
                  class="drag-chip"
                  :disabled="composing"
                  @pointerdown="onPress(keywordPayload(k), k.nameZh || k.code, $event)"
                >{{ k.nameZh }}</button>
              </div>
              <p v-else class="ai-compose-hint">先搜关键字。</p>
              <el-input
                v-model="elementQuery"
                clearable
                class="palette-gap"
                placeholder="筛选元素中文名"
                :disabled="composing || !selected.length"
              />
              <p v-if="!selected.length" class="ai-compose-hint">先到「页面」里把页面加进来。</p>
              <div v-else v-loading="paletteLoading" class="el-scroll">
                <button
                  v-for="el in elementHits"
                  :key="`${el.pageName}-${el.nameEn}`"
                  type="button"
                  class="el-pick"
                  :class="{ pending: !isActive(el) }"
                  :title="isActive(el) ? el.nameEn : '未审，模型不会用'"
                  :disabled="composing || !isActive(el)"
                  @pointerdown="onPress(elementPayload(el), el.nameZh || el.nameEn || '', $event)"
                >
                  <span>{{ el.nameZh || el.nameEn }}</span>
                  <span class="pick-page">{{ isActive(el) ? el.pageName : '未审' }}</span>
                </button>
                <p v-if="!paletteLoading && !elementHits.length" class="ai-compose-hint">这几页还没有元素。</p>
              </div>
            </div>
            <div>
              <ol class="outline">
                <template v-for="(step, index) in outline" :key="step.id">
                  <li
                    data-compose-step
                    :data-step-key="topKey(index)"
                    :class="{ over: outlineOver === topKey(index), active: activeKey === topKey(index) }"
                    @click="activeKey = topKey(index)"
                  >
                    <span
                      class="ord grip"
                      title="按住拖动，调整第几步"
                      @pointerdown.stop="onPress({ kind: 'step', key: topKey(index) }, step.nameZh, $event)"
                    >{{ index + 1 }}</span>
                    <div class="outline-body">
                      <div class="outline-title">
                        {{ step.nameZh }}
                        <span v-if="activeKey === topKey(index)" class="current-mark">当前</span>
                        <span v-if="step.nestThenKey" class="nest-tip">可挂子步骤</span>
                      </div>
                      <div
                        class="outline-el"
                        data-compose-slot
                        :data-step-key="topKey(index)"
                        :class="{ empty: step.needsElement && !step.elementKey, over: elementOver === topKey(index) }"
                      >
                        <template v-if="step.elementKey">{{ step.elementName || step.elementKey }}</template>
                        <template v-else>{{ step.needsElement ? '点左边元素，或拖到这里' : '这一步可以不放元素' }}</template>
                        <el-button
                          v-if="step.elementKey"
                          link
                          type="danger"
                          :disabled="composing"
                          @click.stop="clearElement(step)"
                        >去掉</el-button>
                      </div>
                      <div v-if="step.locatorVarNames.length" class="var-box" @click.stop>
                        <div class="var-title">定位变量</div>
                        <div v-for="name in step.locatorVarNames" :key="name" class="var-row">
                          <span class="var-name">${{ '{' + name + '}' }}</span>
                          <el-input
                            v-model="step.locatorParams[name]"
                            size="small"
                            :placeholder="varPlaceholder(name)"
                            :disabled="composing"
                          />
                        </div>
                      </div>
                      <div v-if="step.textParamDefs.length" class="var-box" @click.stop>
                        <div class="var-title">步骤参数</div>
                        <div v-for="p in step.textParamDefs" :key="p.name" class="var-row">
                          <span class="var-name">{{ p.label }}</span>
                          <el-input
                            v-model="step.textParams[p.name]"
                            size="small"
                            :placeholder="p.help || p.label"
                            :disabled="composing"
                          />
                        </div>
                      </div>
                      <div v-if="step.nestThenKey" class="nest-block" @click.stop>
                        <div class="nest-head">
                          <span>{{ nestLabel(step.nestThenKey) }}</span>
                          <el-button link type="primary" :disabled="composing" @click="armNest(index, 'then')">
                            点选后加子步骤
                          </el-button>
                        </div>
                        <ol v-if="step.thenChildren.length" class="nest-list">
                          <li
                            v-for="(child, ci) in step.thenChildren"
                            :key="child.id"
                            data-compose-step
                            :data-step-key="childKey(index, 'then', ci)"
                            :class="{ over: outlineOver === childKey(index, 'then', ci), active: activeKey === childKey(index, 'then', ci) }"
                            @click.stop="activeKey = childKey(index, 'then', ci)"
                          >
                            <span class="ord">{{ index + 1 }}.{{ ci + 1 }}</span>
                            <div class="outline-body">
                              <div class="outline-title">
                                {{ child.nameZh }}
                                <span v-if="activeKey === childKey(index, 'then', ci)" class="current-mark">当前</span>
                              </div>
                              <div
                                class="outline-el"
                                data-compose-slot
                                :data-step-key="childKey(index, 'then', ci)"
                                :class="{ empty: child.needsElement && !child.elementKey, over: elementOver === childKey(index, 'then', ci) }"
                              >
                                <template v-if="child.elementKey">{{ child.elementName || child.elementKey }}</template>
                                <template v-else>{{ child.needsElement ? '点左边元素' : '可不放元素' }}</template>
                                <el-button v-if="child.elementKey" link type="danger" :disabled="composing" @click.stop="clearElement(child)">去掉</el-button>
                              </div>
                              <div v-if="child.locatorVarNames.length" class="var-box">
                                <div v-for="name in child.locatorVarNames" :key="name" class="var-row">
                                  <span class="var-name">${{ '{' + name + '}' }}</span>
                                  <el-input v-model="child.locatorParams[name]" size="small" :placeholder="varPlaceholder(name)" :disabled="composing" />
                                </div>
                              </div>
                              <div v-if="child.textParamDefs.length" class="var-box">
                                <div v-for="p in child.textParamDefs" :key="p.name" class="var-row">
                                  <span class="var-name">{{ p.label }}</span>
                                  <el-input v-model="child.textParams[p.name]" size="small" :placeholder="p.help || p.label" :disabled="composing" />
                                </div>
                              </div>
                            </div>
                            <span class="page-ops">
                              <el-button link :disabled="composing || ci === 0" @click.stop="moveChild(index, 'then', ci, -1)">上移</el-button>
                              <el-button link :disabled="composing || ci === step.thenChildren.length - 1" @click.stop="moveChild(index, 'then', ci, 1)">下移</el-button>
                              <el-button link type="danger" :disabled="composing" @click.stop="removeChild(index, 'then', ci)">移除</el-button>
                            </span>
                          </li>
                        </ol>
                        <p v-else class="ai-compose-hint">还没有子步骤。选中本步后，再点左边关键字，就变成 {{ index + 1 }}.1</p>
                      </div>
                      <div v-if="step.nestElseKey" class="nest-block" @click.stop>
                        <div class="nest-head">
                          <span>{{ nestLabel(step.nestElseKey) }}</span>
                          <el-button link type="primary" :disabled="composing" @click="armNest(index, 'else')">
                            点选后加子步骤
                          </el-button>
                        </div>
                        <ol v-if="step.elseChildren.length" class="nest-list">
                          <li
                            v-for="(child, ci) in step.elseChildren"
                            :key="child.id"
                            data-compose-step
                            :data-step-key="childKey(index, 'else', ci)"
                            :class="{ over: outlineOver === childKey(index, 'else', ci), active: activeKey === childKey(index, 'else', ci) }"
                            @click.stop="activeKey = childKey(index, 'else', ci)"
                          >
                            <span class="ord">{{ index + 1 }}.否{{ ci + 1 }}</span>
                            <div class="outline-body">
                              <div class="outline-title">
                                {{ child.nameZh }}
                                <span v-if="activeKey === childKey(index, 'else', ci)" class="current-mark">当前</span>
                              </div>
                              <div
                                class="outline-el"
                                data-compose-slot
                                :data-step-key="childKey(index, 'else', ci)"
                                :class="{ empty: child.needsElement && !child.elementKey, over: elementOver === childKey(index, 'else', ci) }"
                              >
                                <template v-if="child.elementKey">{{ child.elementName || child.elementKey }}</template>
                                <template v-else>{{ child.needsElement ? '点左边元素' : '可不放元素' }}</template>
                                <el-button v-if="child.elementKey" link type="danger" :disabled="composing" @click.stop="clearElement(child)">去掉</el-button>
                              </div>
                              <div v-if="child.locatorVarNames.length" class="var-box">
                                <div v-for="name in child.locatorVarNames" :key="name" class="var-row">
                                  <span class="var-name">${{ '{' + name + '}' }}</span>
                                  <el-input v-model="child.locatorParams[name]" size="small" :placeholder="varPlaceholder(name)" :disabled="composing" />
                                </div>
                              </div>
                              <div v-if="child.textParamDefs.length" class="var-box">
                                <div v-for="p in child.textParamDefs" :key="p.name" class="var-row">
                                  <span class="var-name">{{ p.label }}</span>
                                  <el-input v-model="child.textParams[p.name]" size="small" :placeholder="p.help || p.label" :disabled="composing" />
                                </div>
                              </div>
                            </div>
                            <span class="page-ops">
                              <el-button link :disabled="composing || ci === 0" @click.stop="moveChild(index, 'else', ci, -1)">上移</el-button>
                              <el-button link :disabled="composing || ci === step.elseChildren.length - 1" @click.stop="moveChild(index, 'else', ci, 1)">下移</el-button>
                              <el-button link type="danger" :disabled="composing" @click.stop="removeChild(index, 'else', ci)">移除</el-button>
                            </span>
                          </li>
                        </ol>
                      </div>
                    </div>
                    <span class="page-ops">
                      <el-button link :disabled="composing || index === 0" @click.stop="moveOutline(index, -1)">上移</el-button>
                      <el-button link :disabled="composing || index === outline.length - 1" @click.stop="moveOutline(index, 1)">下移</el-button>
                      <el-button link type="danger" :disabled="composing" @click.stop="removeOutline(index)">移除</el-button>
                    </span>
                  </li>
                </template>
                <li
                  class="outline-end"
                  data-compose-end
                  :class="{ over: outlineOver === 'end' }"
                >拖到这里，作为第 {{ outline.length + 1 }} 步</li>
              </ol>
              <el-input
                v-model="form.intent"
                type="textarea"
                :rows="2"
                maxlength="2000"
                show-word-limit
                placeholder="补充，可选。例如：每个商城都上下滑两下。"
                :disabled="composing"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    <p v-if="composing" class="ai-compose-wait">正在编排，一般 10～40 秒。校验没过会自动再试一次，请先别关。</p>
    <template #footer>
      <el-button :disabled="composing" @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="composing" @click="submit">生成草稿</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="elementVisible"
    :title="elementTitle"
    width="440px"
    append-to-body
    class="ai-compose-elements"
  >
    <p class="ai-compose-hint">悬停中文名看定位。描述里写中文名。标成未审的，模型不会用。</p>
    <ul v-loading="elementLoading" class="element-list">
      <li v-for="el in elementRows" :key="el.nameEn || el.id">
        <el-tooltip placement="right-start" effect="light" :show-after="200" popper-class="ai-compose-element-tip">
          <template #content>
            <div class="tip-body">
              <div><b>{{ el.nameZh || el.nameEn }}</b></div>
              <div>英文 key：{{ el.nameEn || '—' }}</div>
              <div>状态：{{ statusLabel(el.status) }}</div>
              <div v-if="el.visualHint">看起来：{{ el.visualHint }}</div>
              <div v-if="el.description">说明：{{ el.description }}</div>
              <div class="tip-loc">{{ el.locatorType || '定位' }}：{{ el.locatorValue || '—' }}</div>
            </div>
          </template>
          <span class="zh-name">{{ el.nameZh || el.nameEn || '未命名' }}</span>
        </el-tooltip>
        <span class="el-status" :class="{ pending: !isActive(el) }">{{ statusLabel(el.status) }}</span>
      </li>
    </ul>
    <p v-if="!elementLoading && !elementRows.length" class="ai-compose-hint">这一页在当前平台没有元素。</p>
  </el-dialog>
  <div v-if="ghost" class="compose-ghost" :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }">{{ ghost.label }}</div>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { apiClient, type AiComposeResponse } from '@/api'
import { elementLocatorVars } from '@/utils/locatorVars'

type AppOption = {
  id: string
  nameZh?: string
  androidPackage?: string
  iosBundleId?: string
}

type PageOption = {
  pageId: string
  nameZh?: string
  moduleTag?: string
  elementCount?: number
  elementCountByPlatform?: Record<string, number>
}

const props = defineProps<{
  apps: AppOption[]
  defaultAppId?: string
  defaultPlatform?: string
}>()

const emit = defineEmits<{
  created: [payload: AiComposeResponse & { appId: string; platform: string; environment: string; catalog: string }]
}>()

const visible = defineModel<boolean>({ default: false })

const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' }
]

const formRef = ref<FormInstance>()
const form = reactive({
  appId: '',
  platform: 'ANDROID',
  environment: 'TEST',
  catalog: 'AUTOMATION',
  releaseStage: 'TESTING',
  intent: '',
  flowName: ''
})
const rules: FormRules = {
  appId: [{ required: true, message: '请选择应用', trigger: 'change' }],
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }]
}

const pages = ref<PageOption[]>([])
const pagesLoading = ref(false)
const selected = ref<PageOption[]>([])
const pageError = ref('')
const outlineError = ref('')
const composing = ref(false)
const keywordQuery = ref('')
const elementQuery = ref('')
const keywords = ref<KeywordRow[]>([])
const paletteElements = ref<ElementRow[]>([])
const paletteLoading = ref(false)
const outline = ref<OutlineStep[]>([])
const outlineOver = ref('')
const elementOver = ref('')
const dragging = ref<DragPayload | null>(null)
const tab = ref('base')
const activeKey = ref('')
const ghost = ref<{ x: number; y: number; label: string } | null>(null)
let outlineSeq = 0

type TextParamDef = { name: string; label: string; help?: string }
type KeywordRow = {
  code: string
  nameZh?: string
  needsElement?: boolean | number
  paramSchema?: string
}
type OutlineStep = {
  id: string
  code: string
  nameZh: string
  needsElement: boolean
  elementKey: string
  elementName: string
  nestThenKey: string
  nestElseKey: string
  thenChildren: OutlineStep[]
  elseChildren: OutlineStep[]
  locatorVarNames: string[]
  locatorParams: Record<string, string>
  textParamDefs: TextParamDef[]
  textParams: Record<string, string>
}
type DragPayload =
  | { kind: 'keyword'; code: string; nameZh: string; needsElement: boolean; nestThenKey: string; nestElseKey: string; textParamDefs: TextParamDef[] }
  | { kind: 'element'; nameEn: string; nameZh: string; locatorVarNames: string[] }
  | { kind: 'step'; key: string }
const pickKey = ref(0)
const dragOver = ref(-1)
const elementVisible = ref(false)
const elementLoading = ref(false)
const elementTitle = ref('页面元素')
const elementRows = ref<ElementRow[]>([])

type ElementRow = {
  id?: string
  nameZh?: string
  nameEn?: string
  pageName?: string
  status?: string
  locatorType?: string
  locatorValue?: string
  locatorFallbacks?: string
  visualHint?: string
  description?: string
}
let dragFrom = -1

const selectedIds = computed(() => new Set(selected.value.map((p) => p.pageId)))

const keywordHits = computed(() => {
  const q = keywordQuery.value.trim().toLowerCase()
  if (!q) return []
  return keywords.value
    .filter((k) => {
      const name = String(k.nameZh || '')
      const code = String(k.code || '')
      return name.toLowerCase().includes(q) || code.toLowerCase().includes(q)
    })
    .slice(0, 12)
})

const elementHits = computed(() => {
  const q = elementQuery.value.trim().toLowerCase()
  const list = paletteElements.value.filter((el) => {
    if (!q) return true
    const name = String(el.nameZh || '')
    const key = String(el.nameEn || '')
    const page = String(el.pageName || '')
    return name.toLowerCase().includes(q) || key.toLowerCase().includes(q) || page.toLowerCase().includes(q)
  })
  return list.slice(0, 80)
})

watch(
  () => [form.appId, form.platform, selected.value.map((p) => p.pageId).join('|')].join('\n'),
  () => { void loadPaletteElements() }
)

const pageGroups = computed(() => {
  const map = new Map<string, PageOption[]>()
  for (const p of pages.value) {
    const tag = String(p.moduleTag || '').trim() || '未分组'
    const list = map.get(tag) || []
    list.push(p)
    map.set(tag, list)
  }
  return [...map.entries()].map(([tag, items]) => ({ tag, items }))
})

function appLabel(a: AppOption) {
  const pkg = a.androidPackage || a.iosBundleId || ''
  return pkg ? `${a.nameZh || a.id} · ${pkg}` : (a.nameZh || a.id)
}

function countOf(p: PageOption) {
  const by = p.elementCountByPlatform?.[form.platform]
  if (typeof by === 'number') return by
  if (typeof p.elementCount === 'number') return p.elementCount
  return null
}

function countLabel(p: PageOption) {
  const n = countOf(p)
  if (n == null) return ''
  const plat = form.platform === 'IOS' ? 'iOS' : form.platform === 'HARMONYOS' ? '鸿蒙' : 'Android'
  return `${plat} ${n} 个元素`
}

function pageOptionLabel(p: PageOption) {
  const count = countLabel(p)
  const name = p.nameZh || p.pageId
  return count ? `${name}（${count}）` : name
}

function onOpen() {
  form.appId = props.defaultAppId || ''
  const plat = String(props.defaultPlatform || 'ANDROID').toUpperCase()
  form.platform = platforms.some((p) => p.value === plat) ? plat : 'ANDROID'
  form.environment = 'TEST'
  form.catalog = 'AUTOMATION'
  form.releaseStage = 'TESTING'
  form.intent = ''
  form.flowName = ''
  outline.value = []
  outlineError.value = ''
  keywordQuery.value = ''
  elementQuery.value = ''
  tab.value = 'base'
  activeKey.value = ''
  endPress()
  void loadKeywords()
  selected.value = []
  pageError.value = ''
  pages.value = []
  if (form.appId) void loadPages()
}

async function onAppChange() {
  selected.value = []
  pageError.value = ''
  await loadPages()
}

async function loadPages() {
  if (!form.appId) {
    pages.value = []
    return
  }
  pagesLoading.value = true
  try {
    const rows = await apiClient.getUiPages({ appId: form.appId, enabledOnly: true })
    pages.value = (Array.isArray(rows) ? rows : []).filter((p) => p && p.pageId)
  } catch (e: unknown) {
    pages.value = []
    const msg = e instanceof Error ? e.message : '页面列表加载失败'
    ElMessage.error(msg)
  } finally {
    pagesLoading.value = false
  }
}

function addPage(pageId: string) {
  const id = String(pageId || '').trim()
  if (!id || selectedIds.value.has(id)) return
  const page = pages.value.find((p) => p.pageId === id)
  if (!page) return
  selected.value = [...selected.value, page]
  pageError.value = ''
  pickKey.value += 1
}

function isActive(el: ElementRow) {
  return String(el.status || '').toUpperCase() === 'ACTIVE'
}

function statusLabel(status?: string) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? '已审' : '未审'
}

async function openElements(page: PageOption) {
  elementTitle.value = `${page.nameZh || page.pageId} 的元素`
  elementRows.value = []
  elementVisible.value = true
  elementLoading.value = true
  try {
    const rows = await apiClient.getUiElements({
      appId: form.appId,
      platform: form.platform,
      pageId: page.pageId
    })
    const list = (Array.isArray(rows) ? rows : []) as ElementRow[]
    list.sort((a, b) => {
      const rank = (el: ElementRow) => (isActive(el) ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return String(a.nameZh || a.nameEn || '').localeCompare(String(b.nameZh || b.nameEn || ''), 'zh')
    })
    elementRows.value = list
  } catch (e: unknown) {
    elementRows.value = []
    ElMessage.error(e instanceof Error ? e.message : '元素加载失败')
  } finally {
    elementLoading.value = false
  }
}

function removePage(index: number) {
  selected.value = selected.value.filter((_, i) => i !== index)
}

function move(index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= selected.value.length) return
  const next = selected.value.slice()
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  selected.value = next
}

function onDragStart(index: number, e: DragEvent) {
  dragFrom = index
  e.dataTransfer?.setData('text/plain', String(index))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  const from = dragFrom
  dragFrom = -1
  dragOver.value = -1
  if (from < 0 || from === index) return
  const next = selected.value.slice()
  const [item] = next.splice(from, 1)
  next.splice(index, 0, item)
  selected.value = next
}

async function loadKnownVars() {
  try {
    const [test, prod] = await Promise.all([
      apiClient.getApiTestVariables('TEST'),
      apiClient.getApiTestVariables('PROD')
    ])
    const names = new Set<string>()
    for (const v of [...(test || []), ...(prod || [])]) {
      if (v?.name && v.enabled !== false) names.add(String(v.name))
    }
    return [...names]
  } catch {
    return []
  }
}

function showNotes(res: AiComposeResponse) {
  const notes = Array.isArray(res.notes) ? res.notes.map((n) => String(n || '').trim()).filter(Boolean) : []
  const children = [
    h(
      'p',
      { style: 'margin: 0 0 8px; line-height: 1.6' },
      res.message || '已生成流程草稿（停用中），去流程编排里调通再启用'
    )
  ]
  if (notes.length) {
    children.push(
      h(
        'ul',
        { style: 'margin: 0; padding-left: 18px; line-height: 1.6' },
        notes.map((n) => h('li', { style: 'margin: 4px 0' }, n))
      )
    )
  }
  return ElMessageBox.alert(h('div', children), res.flowName || '草稿已生成', {
    confirmButtonText: '去调整'
  })
}

function showFailure(message: string) {
  return ElMessageBox.alert(
    h(
      'div',
      { style: 'white-space: pre-wrap; line-height: 1.6; max-height: 360px; overflow: auto' },
      message || '生成失败，请重试'
    ),
    '没能生成草稿',
    { confirmButtonText: '返回修改' }
  )
}

function wantsElement(k: KeywordRow) {
  return k.needsElement === true || k.needsElement === 1
}

function schemaParams(k: KeywordRow): Array<{ name?: string; label?: string; type?: string; required?: boolean; help?: string }> {
  try {
    const raw = JSON.parse(k.paramSchema || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function nestKeysOf(k: KeywordRow) {
  const steps = schemaParams(k).filter((p) => String(p.type || '').toLowerCase() === 'steps')
  const thenK = steps.find((p) => p.name === 'thenSteps') || steps[0]
  const elseK = steps.find((p) => p.name === 'elseSteps')
  return {
    nestThenKey: thenK?.name || '',
    nestElseKey: elseK?.name || ''
  }
}

const SKIP_TEXT = new Set([
  'elementKey', 'retryTimes', 'retryDelayMs', 'endStatus', 'elseMessage',
  'timeoutSec', 'direction', 'distance', 'distancePercent', 'requireScrollable'
])

function textParamDefsOf(k: KeywordRow): TextParamDef[] {
  return schemaParams(k)
    .filter((p) => {
      const type = String(p.type || '').toLowerCase()
      if (type !== 'string' && type !== 'textarea') return false
      if (!p.name || SKIP_TEXT.has(p.name)) return false
      return true
    })
    .map((p) => ({ name: String(p.name), label: String(p.label || p.name), help: p.help }))
}

function nestLabel(key: string) {
  if (key === 'thenSteps') return '存在时 · 子步骤'
  if (key === 'elseSteps') return '不存在时 · 子步骤'
  return '子步骤'
}

function varPlaceholder(name: string) {
  if (/text|title|label|name|tab/i.test(name)) return '如：赛事，或 1-5'
  return `填 ${name}，区间可写 1-5`
}

function topKey(index: number) {
  return String(index)
}

function childKey(parent: number, branch: 'then' | 'else', index: number) {
  return `${parent}.${branch}.${index}`
}

function parseKey(key: string): { parent: number; branch?: 'then' | 'else'; child?: number } | null {
  if (!key) return null
  const parts = key.split('.')
  if (parts.length === 1) return { parent: Number(parts[0]) }
  if (parts.length === 3 && (parts[1] === 'then' || parts[1] === 'else')) {
    return { parent: Number(parts[0]), branch: parts[1], child: Number(parts[2]) }
  }
  return null
}

function getStep(key: string): OutlineStep | null {
  const p = parseKey(key)
  if (!p || Number.isNaN(p.parent)) return null
  const parent = outline.value[p.parent]
  if (!parent) return null
  if (p.branch == null || p.child == null) return parent
  const list = p.branch === 'then' ? parent.thenChildren : parent.elseChildren
  return list[p.child] || null
}

function armNest(parent: number, branch: 'then' | 'else') {
  activeKey.value = topKey(parent)
  const step = outline.value[parent]
  if (!step) return
  ElMessage.info(branch === 'else'
    ? `已选中第 ${parent + 1} 步。再点左边关键字，会加到「不存在时」`
    : `已选中第 ${parent + 1} 步。再点左边关键字，会变成 ${parent + 1}.1`)
}

async function loadKeywords() {
  try {
    const rows = await apiClient.getUiKeywords({ enabledOnly: true })
    keywords.value = (Array.isArray(rows) ? rows : []).filter((k) => k && k.code && k.nameZh)
  } catch {
    keywords.value = []
  }
}

async function loadPaletteElements() {
  if (!form.appId || !selected.value.length) {
    paletteElements.value = []
    return
  }
  paletteLoading.value = true
  try {
    const batches = await Promise.all(selected.value.map((p) =>
      apiClient.getUiElements({
        appId: form.appId,
        platform: form.platform,
        pageId: p.pageId
      })
    ))
    const list: ElementRow[] = []
    batches.forEach((rows, i) => {
      const page = selected.value[i]
      const pageName = page?.nameZh || page?.pageId || ''
      for (const el of (Array.isArray(rows) ? rows : []) as ElementRow[]) {
        if (!el.nameEn) continue
        list.push({ ...el, pageName })
      }
    })
    list.sort((a, b) => {
      const rank = (el: ElementRow) => (isActive(el) ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      const page = String(a.pageName || '').localeCompare(String(b.pageName || ''), 'zh')
      if (page !== 0) return page
      return String(a.nameZh || a.nameEn || '').localeCompare(String(b.nameZh || b.nameEn || ''), 'zh')
    })
    paletteElements.value = list
  } catch {
    paletteElements.value = []
  } finally {
    paletteLoading.value = false
  }
}

function keywordPayload(k: KeywordRow): DragPayload {
  const nest = nestKeysOf(k)
  return {
    kind: 'keyword',
    code: k.code,
    nameZh: String(k.nameZh || k.code),
    needsElement: wantsElement(k),
    nestThenKey: nest.nestThenKey,
    nestElseKey: nest.nestElseKey,
    textParamDefs: textParamDefsOf(k)
  }
}

function elementPayload(el: ElementRow): DragPayload {
  return {
    kind: 'element',
    nameEn: String(el.nameEn || ''),
    nameZh: String(el.nameZh || el.nameEn || ''),
    locatorVarNames: elementLocatorVars(el)
  }
}

type Press = { x: number; y: number; payload: DragPayload; label: string; moved: boolean }
let press: Press | null = null

function unlisten() {
  window.removeEventListener('pointermove', onWinMove)
  window.removeEventListener('pointerup', onWinUp)
  window.removeEventListener('pointercancel', onWinUp)
}

function endPress() {
  unlisten()
  press = null
  dragging.value = null
  ghost.value = null
  outlineOver.value = ''
  elementOver.value = ''
}

function dropTarget(x: number, y: number): { key: string; end: boolean; slot: boolean } | null {
  const nodes = document.elementsFromPoint(x, y)
  for (const node of nodes) {
    if (!(node instanceof Element)) continue
    if (node.closest('[data-compose-end]')) {
      return { key: 'end', end: true, slot: false }
    }
    const slot = node.closest('[data-compose-slot]')
    if (slot) {
      return { key: String(slot.getAttribute('data-step-key') || ''), end: false, slot: true }
    }
    const step = node.closest('[data-compose-step]')
    if (step) {
      return { key: String(step.getAttribute('data-step-key') || ''), end: false, slot: false }
    }
  }
  return null
}

function onWinMove(e: PointerEvent) {
  if (!press) return
  const dx = e.clientX - press.x
  const dy = e.clientY - press.y
  if (!press.moved && dx * dx + dy * dy < 25) return
  press.moved = true
  dragging.value = press.payload
  ghost.value = { x: e.clientX + 12, y: e.clientY + 16, label: press.label }
  const target = dropTarget(e.clientX, e.clientY)
  if (!target || !target.key) {
    outlineOver.value = ''
    elementOver.value = ''
    return
  }
  if (press.payload.kind === 'element' && !target.end) {
    elementOver.value = target.key
    outlineOver.value = ''
  } else {
    elementOver.value = ''
    outlineOver.value = target.key
  }
}

function onWinUp(e: PointerEvent) {
  const current = press
  const target = current?.moved ? dropTarget(e.clientX, e.clientY) : null
  endPress()
  if (!current) return
  if (!current.moved) {
    if (current.payload.kind === 'step') activeKey.value = current.payload.key
    else placeByClick(current.payload)
    return
  }
  if (target) applyDrop(current.payload, target)
}

function onPress(payload: DragPayload, label: string, e: PointerEvent) {
  if (composing.value || e.button !== 0) return
  e.preventDefault()
  endPress()
  press = { x: e.clientX, y: e.clientY, payload, label, moved: false }
  window.addEventListener('pointermove', onWinMove)
  window.addEventListener('pointerup', onWinUp)
  window.addEventListener('pointercancel', onWinUp)
}

onBeforeUnmount(endPress)

function newStep(payload: Extract<DragPayload, { kind: 'keyword' }>): OutlineStep {
  const textParams: Record<string, string> = {}
  for (const p of payload.textParamDefs) textParams[p.name] = ''
  return {
    id: `s${++outlineSeq}`,
    code: payload.code,
    nameZh: payload.nameZh,
    needsElement: payload.needsElement,
    elementKey: '',
    elementName: '',
    nestThenKey: payload.nestThenKey,
    nestElseKey: payload.nestElseKey,
    thenChildren: [],
    elseChildren: [],
    locatorVarNames: [],
    locatorParams: {},
    textParamDefs: payload.textParamDefs,
    textParams
  }
}

function moveOutline(index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= outline.value.length) return
  const next = outline.value.slice()
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  outline.value = next
  const cur = parseKey(activeKey.value)
  if (cur && cur.branch == null) {
    if (cur.parent === index) activeKey.value = topKey(to)
    else if (cur.parent === to) activeKey.value = topKey(index)
  }
}

function removeOutline(index: number) {
  outline.value.splice(index, 1)
  activeKey.value = ''
}

function moveChild(parent: number, branch: 'then' | 'else', index: number, delta: number) {
  const step = outline.value[parent]
  if (!step) return
  const list = branch === 'then' ? step.thenChildren : step.elseChildren
  const to = index + delta
  if (to < 0 || to >= list.length) return
  const next = list.slice()
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  if (branch === 'then') step.thenChildren = next
  else step.elseChildren = next
  if (activeKey.value === childKey(parent, branch, index)) activeKey.value = childKey(parent, branch, to)
}

function removeChild(parent: number, branch: 'then' | 'else', index: number) {
  const step = outline.value[parent]
  if (!step) return
  const list = (branch === 'then' ? step.thenChildren : step.elseChildren).slice()
  list.splice(index, 1)
  if (branch === 'then') step.thenChildren = list
  else step.elseChildren = list
  if (activeKey.value === childKey(parent, branch, index)) activeKey.value = topKey(parent)
}

function clearElement(step: OutlineStep) {
  step.elementKey = ''
  step.elementName = ''
  step.locatorVarNames = []
  step.locatorParams = {}
}

function insertKeywordAtTop(index: number, payload: Extract<DragPayload, { kind: 'keyword' }>) {
  const next = outline.value.slice()
  next.splice(index, 0, newStep(payload))
  outline.value = next
  activeKey.value = topKey(index)
}

function insertKeywordAsChild(parent: number, branch: 'then' | 'else', payload: Extract<DragPayload, { kind: 'keyword' }>) {
  const step = outline.value[parent]
  if (!step) return
  const child = newStep(payload)
  if (branch === 'then') {
    step.thenChildren = [...step.thenChildren, child]
    activeKey.value = childKey(parent, 'then', step.thenChildren.length - 1)
  } else {
    step.elseChildren = [...step.elseChildren, child]
    activeKey.value = childKey(parent, 'else', step.elseChildren.length - 1)
  }
}

function attachElementTo(step: OutlineStep, payload: Extract<DragPayload, { kind: 'element' }>) {
  if (!payload.nameEn) return
  step.elementKey = payload.nameEn
  step.elementName = payload.nameZh
  step.locatorVarNames = payload.locatorVarNames.slice()
  const params: Record<string, string> = {}
  for (const name of step.locatorVarNames) params[name] = step.locatorParams[name] || ''
  step.locatorParams = params
}

function placeByClick(payload: DragPayload) {
  if (payload.kind === 'keyword') {
    const cur = parseKey(activeKey.value)
    if (cur && cur.branch == null) {
      const parent = outline.value[cur.parent]
      if (parent?.nestThenKey) {
        insertKeywordAsChild(cur.parent, 'then', payload)
        outlineError.value = ''
        return
      }
      insertKeywordAtTop(cur.parent + 1, payload)
      outlineError.value = ''
      return
    }
    if (cur?.branch != null && cur.child != null) {
      const parent = outline.value[cur.parent]
      if (parent) {
        const list = cur.branch === 'then' ? parent.thenChildren : parent.elseChildren
        const child = newStep(payload)
        const next = list.slice()
        next.splice(cur.child + 1, 0, child)
        if (cur.branch === 'then') parent.thenChildren = next
        else parent.elseChildren = next
        activeKey.value = childKey(cur.parent, cur.branch, cur.child + 1)
        outlineError.value = ''
        return
      }
    }
    insertKeywordAtTop(outline.value.length, payload)
    outlineError.value = ''
    return
  }
  if (payload.kind !== 'element') return
  let key = activeKey.value
  if (!key) {
    const miss = findMissingElementKey()
    if (miss) key = miss
  }
  const step = getStep(key)
  if (!step) {
    ElMessage.warning('先在右边点选一步，再点元素')
    return
  }
  attachElementTo(step, payload)
  activeKey.value = key
  outlineError.value = ''
}

function applyDrop(payload: DragPayload, target: { key: string; end: boolean; slot: boolean }) {
  if (payload.kind === 'element') {
    if (target.end) return
    const step = getStep(target.key)
    if (!step) return
    attachElementTo(step, payload)
    activeKey.value = target.key
    outlineError.value = ''
    return
  }
  if (payload.kind === 'keyword') {
    if (target.end) {
      insertKeywordAtTop(outline.value.length, payload)
      return
    }
    const p = parseKey(target.key)
    if (!p) return
    if (p.branch != null) {
      insertKeywordAsChild(p.parent, p.branch, payload)
      return
    }
    const parent = outline.value[p.parent]
    if (parent?.nestThenKey && !target.slot) {
      insertKeywordAsChild(p.parent, 'then', payload)
      return
    }
    insertKeywordAtTop(p.parent + 1, payload)
    return
  }
  // reorder only top-level for now
  if (payload.kind !== 'step' || target.end) return
  const from = parseKey(payload.key)
  const to = parseKey(target.key)
  if (!from || !to || from.branch || to.branch) return
  if (from.parent === to.parent) return
  const next = outline.value.slice()
  const [item] = next.splice(from.parent, 1)
  const dest = from.parent < to.parent ? to.parent - 1 : to.parent
  next.splice(Math.max(0, dest), 0, item)
  outline.value = next
  activeKey.value = topKey(Math.max(0, dest))
}

function findMissingElementKey(): string {
  for (let i = 0; i < outline.value.length; i++) {
    const s = outline.value[i]
    if (s.needsElement && !s.elementKey) return topKey(i)
    for (let j = 0; j < s.thenChildren.length; j++) {
      if (s.thenChildren[j].needsElement && !s.thenChildren[j].elementKey) return childKey(i, 'then', j)
    }
    for (let j = 0; j < s.elseChildren.length; j++) {
      if (s.elseChildren[j].needsElement && !s.elseChildren[j].elementKey) return childKey(i, 'else', j)
    }
  }
  return ''
}

function stepIntentLine(label: string, s: OutlineStep) {
  const bits = [`${label}. ${s.code} ${s.nameZh}`]
  if (s.elementKey) bits.push(`elementKey=${s.elementKey}（${s.elementName || s.elementKey}）`)
  for (const name of s.locatorVarNames) {
    const v = String(s.locatorParams[name] || '').trim()
    if (v) bits.push(`变量 ${name}=${v}`)
  }
  for (const p of s.textParamDefs) {
    const v = String(s.textParams[p.name] || '').trim()
    if (v) bits.push(`${p.name}=${v}`)
  }
  return bits.join('，')
}

function buildIntent() {
  const lines: string[] = []
  outline.value.forEach((s, i) => {
    lines.push(stepIntentLine(String(i + 1), s))
    if (s.thenChildren.length && s.nestThenKey) {
      lines.push(`  ${s.nestThenKey}：`)
      s.thenChildren.forEach((c, j) => lines.push('  ' + stepIntentLine(`${i + 1}.${j + 1}`, c)))
    }
    if (s.elseChildren.length && s.nestElseKey) {
      lines.push(`  ${s.nestElseKey}：`)
      s.elseChildren.forEach((c, j) => lines.push('  ' + stepIntentLine(`${i + 1}.否${j + 1}`, c)))
    }
  })
  const note = form.intent.trim()
  if (!lines.length) return note
  const head = '按下面序号编排。这些 keywordCode 和 elementKey 必须原样采用，顺序不许改。子步骤写进对应的 thenSteps/elseSteps。只补等待和缺的参数。定位变量已给出的必须写进 locatorParams。'
  return [head, ...lines, note ? `补充：${note}` : ''].filter(Boolean).join('\n')
}

function walkMissing(): string {
  for (let i = 0; i < outline.value.length; i++) {
    const s = outline.value[i]
    if (s.needsElement && !s.elementKey) return `第 ${i + 1} 步还没放元素`
    for (const name of s.locatorVarNames) {
      if (!String(s.locatorParams[name] || '').trim()) return `第 ${i + 1} 步还要填定位变量 ${name}`
    }
    for (let j = 0; j < s.thenChildren.length; j++) {
      const c = s.thenChildren[j]
      if (c.needsElement && !c.elementKey) return `第 ${i + 1}.${j + 1} 步还没放元素`
      for (const name of c.locatorVarNames) {
        if (!String(c.locatorParams[name] || '').trim()) return `第 ${i + 1}.${j + 1} 步还要填定位变量 ${name}`
      }
    }
    for (let j = 0; j < s.elseChildren.length; j++) {
      const c = s.elseChildren[j]
      if (c.needsElement && !c.elementKey) return `第 ${i + 1}.否${j + 1} 步还没放元素`
      for (const name of c.locatorVarNames) {
        if (!String(c.locatorParams[name] || '').trim()) return `第 ${i + 1}.否${j + 1} 步还要填定位变量 ${name}`
      }
    }
  }
  return ''
}

async function submit() {
  pageError.value = selected.value.length ? '' : '请至少选一个页面，并排好顺序'
  if (!outline.value.length && !form.intent.trim()) {
    outlineError.value = '先搜索关键字，点一下或拖成第 1 步、第 2 步'
  } else {
    outlineError.value = walkMissing()
  }
  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) {
    tab.value = 'base'
    return
  }
  if (pageError.value) {
    tab.value = 'pages'
    return
  }
  if (outlineError.value) {
    tab.value = 'steps'
    return
  }
  composing.value = true
  try {
    const knownVars = await loadKnownVars()
    const name = form.flowName.trim()
    const res = await apiClient.composeUiFlowByAi({
      appId: form.appId,
      platform: form.platform,
      environment: form.environment,
      catalog: form.catalog,
      releaseStage: form.releaseStage,
      pageIds: selected.value.map((p) => p.pageId),
      intent: buildIntent(),
      ...(name ? { flowName: name } : {}),
      ...(knownVars.length ? { knownVars } : {})
    })
    try {
      await showNotes(res)
    } catch {
      /* 关掉说明也继续打开草稿 */
    }
    const payload = {
      ...res,
      appId: form.appId,
      platform: form.platform,
      environment: form.environment,
      catalog: form.catalog
    }
    visible.value = false
    emit('created', payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '生成失败，请重试'
    try {
      await showFailure(msg)
    } catch {
      /* 关掉错误框即可 */
    }
  } finally {
    composing.value = false
  }
}
</script>

<style scoped>
.ai-compose-lead,
.ai-compose-hint,
.ai-compose-wait {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.ai-compose-hint {
  margin: 8px 0 0;
}
.ai-compose-hint.warn {
  color: var(--el-color-warning);
}
.ai-compose-wait {
  color: var(--el-color-primary);
}
.page-order {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  width: 100%;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.page-order li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: grab;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.page-order li:last-child {
  border-bottom: none;
}
.page-order li.over {
  background: var(--el-fill-color-lighter);
}
.ord {
  width: 18px;
  flex-shrink: 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.page-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-count {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}
.page-count:hover {
  text-decoration: underline;
}
.element-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.element-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.element-list li:last-child {
  border-bottom: none;
}
.zh-name {
  color: var(--el-text-color-primary);
  cursor: help;
  border-bottom: 1px dashed var(--el-border-color);
}
.el-status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-color-success);
}
.el-status.pending {
  color: var(--el-color-warning);
}
.page-ops {
  flex-shrink: 0;
}
.compose-tabs {
  min-height: 280px;
}
.step-board {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 12px;
  align-items: start;
}
.el-scroll {
  max-height: 280px;
  margin-top: 8px;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}
.el-pick {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: #fff;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: grab;
}
.el-pick:hover {
  background: var(--el-color-primary-light-9);
}
.el-pick.pending,
.el-pick:disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}
.pick-page {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.current-mark {
  margin-left: 6px;
  color: var(--el-color-primary);
  font-size: 12px;
}
.nest-tip {
  margin-left: 6px;
  color: var(--el-color-success);
  font-size: 12px;
}
.nest-block {
  margin-top: 8px;
  padding: 8px;
  border: 1px dashed var(--el-color-primary-light-8);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.nest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  color: var(--app-text-regular);
  font-size: 12px;
}
.nest-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.nest-list > li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
  padding: 6px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background: #fff;
}
.var-box {
  margin-top: 6px;
  padding: 6px 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.var-title {
  margin-bottom: 4px;
  color: var(--app-text-regular);
  font-size: 12px;
  font-weight: 600;
}
.var-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.var-name {
  flex: none;
  width: 110px;
  color: var(--el-color-primary);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
}
.compose-ghost {
  position: fixed;
  z-index: 10000;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  pointer-events: none;
}
.palette,
.outline {
  width: 100%;
}
.palette-gap {
  margin-top: 8px;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.drag-chip {
  padding: 2px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  line-height: 22px;
  cursor: grab;
}
.drag-chip.element {
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.outline {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}
.outline li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 6px;
}
.outline li.over,
.outline li.active,
.outline-el.over {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.outline {
  max-height: 320px;
  overflow: auto;
}
.outline-end {
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.outline-body {
  flex: 1;
  min-width: 0;
}
.outline-title {
  line-height: 22px;
}
.outline-el {
  margin-top: 4px;
  padding: 2px 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  color: var(--app-text-regular);
  font-size: 12px;
  line-height: 22px;
}
.outline-el.empty {
  color: var(--el-color-warning);
}
.grip {
  cursor: grab;
}
</style>

<style>
.ai-compose-element-tip {
  max-width: 440px;
}
.ai-compose-element-tip .tip-body {
  line-height: 1.55;
  font-size: 12px;
  color: var(--el-text-color-primary);
}
.ai-compose-element-tip .tip-loc {
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--app-text-regular);
}
</style>
