<template>
  <el-drawer
    :model-value="modelValue"
    title="真机点选采集"
    size="92%"
    destroy-on-close
    append-to-body
    :z-index="5000"
    :close-on-click-modal="true"
    @update:model-value="onVisibleChange"
  >
    <div class="inspector-toolbar">
      <!--
        teleported=false：本抽屉写死了 z-index:5000，而 el-select 的下拉浮层默认 teleport 到 body、
        z-index 从 2000 起递增，会被抽屉整个盖住——表现就是「点开下拉什么都看不到，
        只剩输入框里那一个已选设备名」。渲染进抽屉内部就跟着它自己的层叠上下文走。
      -->
      <el-select
        v-model="deviceId"
        filterable
        :teleported="false"
        placeholder="选择已连接设备"
        style="width: 320px"
        :loading="loadingDevices"
      >
        <el-option
          v-for="d in devices"
          :key="d.id"
          :label="deviceOptionLabel(d)"
          :value="d.id" />
      </el-select>
      <el-button :loading="loadingDevices" @click="loadDevices">刷新设备</el-button>
      <el-button type="primary" :loading="loadingShot" :disabled="!deviceId" @click="refreshShot">
        刷新截图
      </el-button>
      <el-button @click="close">关闭</el-button>
      <span class="inspector-hint">
        已连接 {{ devices.length }} 台
        <template v-if="props.platform">（优先 {{ props.platform }}）</template>
        ；点选后列出 id / text / xpath / className / 坐标 等全部方案，点选切换即可。手机滑动后请再点「刷新截图」。
      </span>
    </div>
    <div class="inspector-body">
      <div class="inspector-shot-wrap">
        <div v-if="!shotUrl" class="inspector-shot-empty">请选择设备并刷新截图</div>
        <div v-else class="inspector-shot-inner">
          <img
            ref="imgRef"
            :src="shotUrl"
            class="inspector-shot"
            alt="设备截图"
            draggable="false"
            @error="onShotLoadError"
            @click="onShotClick"
          />
          <div
            v-if="boundsBox"
            class="inspector-bounds"
            :style="boundsBox"
          />
          <div
            v-if="mark"
            class="inspector-mark"
            :style="{ left: mark.left + 'px', top: mark.top + 'px' }"
          />
        </div>
      </div>
      <div class="inspector-side">
        <div v-loading="hitting" class="inspector-candidates">
          <div class="inspector-side-title">定位方案（点选切换）</div>
          <el-alert
            v-if="h5ShellHint"
            class="cand-h5-alert"
            type="warning"
            :closable="false"
            show-icon
            title="当前点在 WebView/H5 内容区：原生树看不到帖子卡片。请用「H5坐标点选」，或点上方「动态/评论」等原生 Tab。"
          />
          <!--
            这一类问题在候选列表里表达不出来：候选回答的是「这个节点怎么定位」，
            而它要说的是「库里那条元素坏了」——另一个话题，得单独摆出来。
          -->
          <el-alert
            v-for="(w, i) in warnings"
            :key="'warn-' + i"
            class="cand-warn-alert"
            type="error"
            :closable="false"
            show-icon
            title="元素库里有条定位指向了别的控件"
          >
            <div class="cand-warn-text">{{ w }}</div>
          </el-alert>

          <el-empty v-if="!candidates.length && !hitting" description="点击截图上的控件" :image-size="64" />
          <div
            v-for="(c, idx) in candidates"
            :key="idx"
            class="inspector-cand"
            :class="{ active: selectedIdx === idx }"
            @click="selectCandidate(idx)"
          >
            <div class="cand-title">
              <el-tag size="small" :type="locatorTagType(c.locatorType)" effect="plain">{{ c.locatorType }}</el-tag>
              <span>{{ c.suggestedNameZh || c.resourceId || c.className || `方案 ${idx + 1}` }}</span>
            </div>
            <div class="cand-meta">{{ c.locatorValue }}</div>
            <!--
              命中数是这个面板里最该显示、以前却唯独没显示的一条。
              「命中 3 个」意味着执行时 Appium 取第 1 个，而第 1 个未必是你要的那个——
              这正是「元素找得到、点击也成功、界面没反应」的来源。
            -->
            <div v-if="c.matchCount !== undefined && c.matchCount !== null" class="cand-count" :class="countClass(c)">
              {{ countText(c) }}
            </div>
            <div v-if="c.visualHint" class="cand-hint">{{ c.visualHint }}</div>
            <div v-if="c.matchedElementId" class="cand-match">
              已匹配：{{ c.matchedNameZh }} / {{ c.matchedNameEn }}（{{ c.matchedStatus }}）
            </div>
          </div>
        </div>
        <div v-if="selected" class="inspector-form">
          <div class="inspector-side-title">写入元素库</div>
          <el-alert
            v-if="formNotice"
            class="form-notice"
            :title="formNotice.title"
            :type="formNotice.type"
            :closable="true"
            show-icon
            @close="formNotice = null"
          >
            <p class="form-notice-msg">{{ formNotice.message }}</p>
            <div v-if="formNotice.existing" class="form-notice-actions">
              <el-button type="warning" size="small" :loading="saving" @click="confirmUseExisting">
                选用已有「{{ formNotice.existing.nameEn }}」
              </el-button>
            </div>
          </el-alert>
          <el-form label-width="88px" size="small">
            <el-form-item label="中文名">
              <el-input v-model="form.nameZh" />
            </el-form-item>
            <el-form-item label="英文名">
              <el-input v-model="form.nameEn" />
            </el-form-item>
            <el-form-item label="视觉说明">
              <el-input v-model="form.visualHint" />
            </el-form-item>
            <el-form-item label="归属页面">
              <div class="page-pick-row">
                <el-select
                  v-model="form.pageId"
                  filterable
                  clearable
                  :teleported="false"
                  placeholder="选择页面（留空＝暂不归属）"
                  class="page-pick-select"
                >
                  <el-option
                    v-for="pg in pageOptions"
                    :key="pg.pageId"
                    :label="pageOptionLabel(pg)"
                    :value="pg.pageId"
                  />
                </el-select>
                <el-button size="small" @click="openNewPage">新建页面</el-button>
              </div>
              <div v-if="!pageOptions.length" class="page-pick-hint">
                该应用还没建过页面，点「新建页面」建一个（如「通知授权弹窗」）
              </div>
            </el-form-item>
            <el-form-item label="定位方式">
              <el-select
                :model-value="form.locatorType + '|' + form.locatorValue"
                style="width: 100%"
                @change="onLocatorTypePicked"
              >
                <el-option
                  v-for="opt in locatorOptions"
                  :key="opt.type + '|' + opt.value"
                  :label="`${opt.type} · ${truncate(opt.value, 48)}`"
                  :value="opt.type + '|' + opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="定位值">
              <el-input v-model="form.locatorValue" type="textarea" :rows="2" />
            </el-form-item>
          </el-form>

          <!-- 新建页面：就地建完直接选上，不用跑回元素管理页 -->
          <el-dialog
            v-model="newPageVisible"
            title="新建页面"
            width="420px"
            append-to-body
            :z-index="6000"
            destroy-on-close
          >
            <el-form label-width="88px" size="small">
              <el-form-item label="中文名" required>
                <el-input v-model="newPageNameZh" placeholder="如 通知授权弹窗" />
              </el-form-item>
              <el-form-item label="页面编码" required>
                <el-input v-model="newPageId" placeholder="如 SYS_NOTIF_PERMISSION" />
                <div class="page-pick-hint">按中文名自动生成，可改。统一大写下划线，避免同一个页面存成两条</div>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button size="small" @click="newPageVisible = false">取消</el-button>
              <el-button size="small" type="primary" :loading="creatingPage" @click="submitNewPage">
                创建并选用
              </el-button>
            </template>
          </el-dialog>
          <div class="inspector-actions">
            <el-button
              v-if="selected.matchedElementId"
              type="success"
              :loading="saving"
              @click="promoteMatched"
            >选用已匹配</el-button>
            <el-button type="primary" :loading="saving" @click="createElement(false)">新建候选</el-button>
            <el-button :loading="saving" @click="createElement(true)">新建并选用</el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { normalizePlatform } from '@/utils/platform'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import { normalizePageId, pageOptionLabel, suggestPageId } from '@/utils/uiPage'

const props = defineProps<{
  modelValue: boolean
  appId: string
  platform: string
  pageId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [payload: { nameEn: string; nameZh: string; promoted: boolean }]
}>()

const devices = ref<any[]>([])
const deviceId = ref('')
const loadingDevices = ref(false)
const loadingShot = ref(false)
const hitting = ref(false)
const saving = ref(false)
const shotUrl = ref('')
const imgRef = ref<HTMLImageElement | null>(null)
const mark = ref<{ left: number; top: number } | null>(null)
const candidates = ref<any[]>([])
const warnings = ref<string[]>([])
const selectedIdx = ref(-1)
/** 抽屉内提示条：Message/MessageBox 会被本抽屉盖住，故不用全局弹窗 */
const formNotice = ref<{
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  existing?: any | null
} | null>(null)
const form = reactive({
  nameZh: '',
  nameEn: '',
  visualHint: '',
  pageId: '',
  locatorType: 'id',
  locatorValue: ''
})

function showFormNotice(
  type: 'success' | 'warning' | 'error' | 'info',
  title: string,
  message: string,
  existing?: any | null
) {
  formNotice.value = { type, title, message, existing: existing || null }
}

const selected = computed(() =>
  selectedIdx.value >= 0 ? candidates.value[selectedIdx.value] : null
)

const locatorOptions = computed(() =>
  (candidates.value || [])
    .filter((c) => c?.locatorType && c?.locatorValue)
    .map((c) => ({ type: String(c.locatorType), value: String(c.locatorValue) }))
)

const h5ShellHint = computed(() => {
  const list = candidates.value || []
  if (!list.length) return false
  const top = list[0]
  const hint = String(top?.visualHint || '')
  return (
    String(top?.locatorType || '').toLowerCase() === 'coordinate' &&
    (hint.includes('WebView') || hint.includes('H5') || String(top?.suggestedNameZh || '').includes('H5'))
  )
})

function truncate(s: string, n: number) {
  const t = String(s || '')
  return t.length > n ? t.slice(0, n) + '…' : t
}

function locatorTagType(t: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  const x = String(t || '').toLowerCase()
  if (x === 'id') return 'success'
  if (x === 'text' || x === 'accessibilityid' || x === 'accessibility-id') return 'warning'
  if (x === 'coordinate' || x === 'coord' || x === 'tap' || x === 'point') return 'danger'
  if (x === 'xpath') return 'info'
  // className 等：ElTag 不允许 type=""
  return 'primary'
}

function onLocatorTypePicked(key: string) {
  const idx = candidates.value.findIndex(
    (c) => `${c.locatorType}|${c.locatorValue}` === key
  )
  if (idx >= 0) {
    selectCandidate(idx)
    return
  }
  const pipe = String(key || '').indexOf('|')
  if (pipe > 0) {
    form.locatorType = key.slice(0, pipe)
    form.locatorValue = key.slice(pipe + 1)
  }
}

/** 把候选 bounds（截图像素）映射到当前展示尺寸，画红框便于发现「穿透」到背后列表 */
const boundsBox = computed(() => {
  const c = selected.value
  const img = imgRef.value
  const b = c?.bounds
  if (!c || !img || !b) return null
  const natW = img.naturalWidth || 0
  const natH = img.naturalHeight || 0
  const dispW = img.clientWidth || 0
  const dispH = img.clientHeight || 0
  if (natW <= 0 || natH <= 0 || dispW <= 0 || dispH <= 0) return null
  const l = Number(b.left)
  const t = Number(b.top)
  const r = Number(b.right)
  const bottom = Number(b.bottom)
  if (![l, t, r, bottom].every((n) => Number.isFinite(n))) return null
  const sx = dispW / natW
  const sy = dispH / natH
  return {
    left: l * sx + 'px',
    top: t * sy + 'px',
    width: Math.max(1, (r - l) * sx) + 'px',
    height: Math.max(1, (bottom - t) * sy) + 'px'
  }
})

function close() {
  emit('update:modelValue', false)
}

function onVisibleChange(v: boolean) {
  emit('update:modelValue', v)
}

function revokeShotUrl() {
  if (shotUrl.value.startsWith('blob:')) URL.revokeObjectURL(shotUrl.value)
  shotUrl.value = ''
}

function resetPanel() {
  revokeShotUrl()
  candidates.value = []
  selectedIdx.value = -1
  mark.value = null
}

function deviceOptionLabel(d: any) {
  const name = d?.name || d?.id || '未知设备'
  const platform = d?.platform || ''
  return platform ? `${name} (${platform})` : String(name)
}

// ==================== 归属页面 ====================

const pageOptions = ref<any[]>([])
const newPageVisible = ref(false)
const newPageNameZh = ref('')
const newPageId = ref('')
const creatingPage = ref(false)

async function loadPages() {
  if (!props.appId) {
    pageOptions.value = []
    return
  }
  try {
    const rows = await apiClient.getUiPages({ appId: props.appId, enabledOnly: true })
    pageOptions.value = Array.isArray(rows) ? rows : []
  } catch {
    // 拉不到页面不该挡住采集：页面留空也能先存成候选，回头再归属
    pageOptions.value = []
  }
}

function openNewPage() {
  if (!props.appId) {
    ElMessage.warning('未指定应用，无法新建页面')
    return
  }
  // 采集到的元素中文名往往就是页面上的文案，拿它当默认名比空着强
  newPageNameZh.value = ''
  newPageId.value = ''
  newPageVisible.value = true
}

watch(newPageNameZh, (n) => {
  if (!newPageVisible.value) return
  // 人手改过编码就别再覆盖；只在还是自动生成的占位时跟着变
  if (!newPageId.value || newPageId.value.startsWith('PAGE_')) {
    newPageId.value = suggestPageId(n || '')
  }
})

async function submitNewPage() {
  const nameZh = newPageNameZh.value.trim()
  const pid = normalizePageId(newPageId.value)
  if (!nameZh) {
    ElMessage.warning('请填写中文名')
    return
  }
  if (!pid) {
    ElMessage.warning('请填写页面编码')
    return
  }
  creatingPage.value = true
  try {
    // ensure 而不是 create：编码撞上已有页面时复用它，别建出重复页
    const pg = await apiClient.ensureUiPage({ appId: props.appId!, pageId: pid, nameZh })
    await loadPages()
    form.pageId = pg?.pageId || pid
    newPageVisible.value = false
    ElMessage.success(`已创建页面「${pg?.nameZh || nameZh}」并选用`)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建页面失败')
  } finally {
    creatingPage.value = false
  }
}

async function loadDevices() {
  loadingDevices.value = true
  try {
    // 与设备管理一致：先扫描刷新连接状态，再取已连接列表
    try {
      await apiClient.scanDevices()
    } catch {
      /* 扫描失败仍继续拉列表 */
    }
    let list: any[] = []
    try {
      const summary = await apiClient.getConnectedSummary()
      list = Array.isArray(summary?.devices) ? summary.devices : []
    } catch {
      const all = await apiClient.getDevices()
      list = Array.isArray(all) ? all : []
    }
    const seen = new Set<string>()
    const connected = list.filter((d: any) => {
      if (!d?.id || seen.has(d.id)) return false
      const st = String(d.status || '').toUpperCase()
      if (st && st !== 'CONNECTED' && st !== 'ONLINE') return false
      // connected-summary 已是已连接；getDevices 回退时再按状态筛
      seen.add(d.id)
      return true
    })
    const prefer = String(props.platform || '').toUpperCase()
    connected.sort((a, b) => {
      const ap = platformMatches(a.platform, prefer) ? 0 : 1
      const bp = platformMatches(b.platform, prefer) ? 0 : 1
      return ap - bp
    })
    devices.value = connected
    const stillValid = connected.some((d) => d.id === deviceId.value)
    if (!stillValid) {
      const preferred = connected.find((d) => platformMatches(d.platform, prefer))
      deviceId.value = preferred?.id || connected[0]?.id || ''
    }
    if (!connected.length) {
      ElMessage.warning('当前没有已连接设备，请先在设备管理中连接')
    }
  } catch {
    devices.value = []
  } finally {
    loadingDevices.value = false
  }
}

function platformMatches(devicePlatform: string | undefined, prefer: string) {
  const p = String(devicePlatform || '').toUpperCase()
  if (!prefer) return false
  // 平台已去掉产品线维度，归一后直接比较即可
  if (prefer === 'ANDROID') return normalizePlatform(p) === 'ANDROID'
  if (prefer === 'IOS') return normalizePlatform(p) === 'IOS'
  return p === prefer
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    resetPanel()
    // 页面列表整个抽屉期间不变，开一次拉一次就够——放在点选回调里会变成每点一下拉一次
    loadPages()
    await loadDevices()
  }
)

function onShotLoadError() {
  ElMessage.error('截图显示失败，请再点「刷新截图」')
  revokeShotUrl()
}

async function refreshShot() {
  if (!deviceId.value) {
    ElMessage.warning('请选择设备')
    return
  }
  loadingShot.value = true
  candidates.value = []
  warnings.value = []
  selectedIdx.value = -1
  mark.value = null
  try {
    const snap = await apiClient.getDeviceInspectSnapshot(deviceId.value)
    const t = String(snap.screenshotUrl || '').split('t=')[1] || String(Date.now())
    const next = await apiClient.fetchDeviceInspectScreenshotObjectUrl(deviceId.value, t)
    revokeShotUrl()
    shotUrl.value = next
    ElMessage.success('截图已刷新，请点击控件')
  } catch (e: any) {
    const msg = e?.message || '截图失败'
    ElMessage({
      type: 'error',
      message: msg,
      duration: Math.min(12000, Math.max(4500, msg.length * 40)),
      showClose: true
    })
    revokeShotUrl()
  } finally {
    loadingShot.value = false
  }
}

async function onShotClick(ev: MouseEvent) {
  const img = imgRef.value
  if (!img || !deviceId.value) return
  // 用相对 img 的 offset，避免外层 overflow 滚动条导致 getBoundingClientRect 点选错位
  const dispW = img.clientWidth || img.getBoundingClientRect().width
  const dispH = img.clientHeight || img.getBoundingClientRect().height
  if (dispW <= 0 || dispH <= 0) return
  let ox = ev.offsetX
  let oy = ev.offsetY
  // 部分浏览器点到子层时 offset 相对错误目标；回退到相对 img 的坐标
  if (ev.target !== img) {
    const rect = img.getBoundingClientRect()
    ox = ev.clientX - rect.left
    oy = ev.clientY - rect.top
  }
  ox = Math.min(Math.max(ox, 0), dispW)
  oy = Math.min(Math.max(oy, 0), dispH)
  const xRatio = Math.min(1, Math.max(0, ox / dispW))
  const yRatio = Math.min(1, Math.max(0, oy / dispH))
  const natW = img.naturalWidth || 0
  const natH = img.naturalHeight || 0
  const px = natW > 0 ? Math.round(xRatio * (natW - 1)) : undefined
  const py = natH > 0 ? Math.round(yRatio * (natH - 1)) : undefined
  mark.value = {
    left: ox - 6,
    top: oy - 6
  }
  hitting.value = true
  try {
    const res = await apiClient.postDeviceInspectHitTest(deviceId.value, {
      xRatio,
      yRatio,
      x: px,
      y: py,
      appId: props.appId || undefined
    })
    candidates.value = res.candidates || []
    warnings.value = res.warnings || []
    if (!candidates.value.length) {
      ElMessage.warning('未命中控件：可换个位置再点；若刚在手机上滑动过，请先「刷新截图」')
      selectedIdx.value = -1
    } else {
      selectCandidate(0)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '命中失败')
    candidates.value = []
    warnings.value = []
  } finally {
    hitting.value = false
  }
}

/**
 * 命中数怎么读给人听。
 * 「唯一」是结论不是数字，所以正常情况只说一句「本屏唯一」；
 * 出问题的时候才把数字摆出来，并且直接说后果，不让人自己去推。
 */
function countText(c: any) {
  const n = Number(c?.matchCount)
  if (!Number.isFinite(n) || n < 0) return '本屏唯一性未知（这类定位没法在控件树上校验）'
  if (n === 0) return '本屏一个都没命中：这条定位现在是失效的'
  if (n === 1) return '本屏唯一'
  return `本屏命中 ${n} 个 · 执行时只会用第 1 个，未必是你要的这个`
}

function countClass(c: any) {
  const n = Number(c?.matchCount)
  if (!Number.isFinite(n) || n < 0) return 'is-unknown'
  if (n === 1) return 'is-unique'
  return 'is-dup'
}

function selectCandidate(idx: number) {
  selectedIdx.value = idx
  formNotice.value = null
  const c = candidates.value[idx]
  if (!c) return
  form.nameZh = c.suggestedNameZh || c.matchedNameZh || ''
  form.nameEn = c.suggestedNameEn || c.matchedNameEn || ''
  form.visualHint = c.visualHint || ''
  form.pageId = props.pageId || ''
  form.locatorType = c.locatorType || 'id'
  form.locatorValue = c.locatorValue || ''
}

async function promoteMatched() {
  const c = selected.value
  if (!c?.matchedElementId) return
  formNotice.value = null
  saving.value = true
  try {
    await apiClient.updateUiElement(c.matchedElementId, { status: 'ACTIVE' })
    emit('saved', {
      nameEn: String(c.matchedNameEn || form.nameEn || ''),
      nameZh: String(c.matchedNameZh || form.nameZh || ''),
      promoted: true
    })
    close()
  } catch (e: any) {
    showFormNotice('error', '选用失败', String(e?.message || '选用失败'))
  } finally {
    saving.value = false
  }
}

async function findExistingByNameEn(nameEn: string) {
  const list = (await apiClient.getUiElements({
    appId: props.appId,
    platform: props.platform || 'ANDROID',
    keyword: nameEn,
    source: 'HUMAN_AI'
  })) as any[]
  return (Array.isArray(list) ? list : []).find((el) => String(el?.nameEn || '') === nameEn) || null
}

async function useExistingElement(hit: any) {
  if (!hit?.id) return
  saving.value = true
  try {
    if (String(hit.status || '').toUpperCase() !== 'ACTIVE') {
      await apiClient.updateUiElement(hit.id, { status: 'ACTIVE' })
    }
    emit('saved', {
      nameEn: String(hit.nameEn || form.nameEn.trim()),
      nameZh: String(hit.nameZh || form.nameZh.trim()),
      promoted: true
    })
    close()
  } catch (e: any) {
    showFormNotice('error', '选用失败', String(e?.message || '选用失败'))
  } finally {
    saving.value = false
  }
}

async function confirmUseExisting() {
  const hit = formNotice.value?.existing
  if (!hit) return
  await useExistingElement(hit)
}

async function createElement(promote: boolean) {
  formNotice.value = null
  if (!form.locatorValue.trim() || !form.nameEn.trim() || !form.nameZh.trim()) {
    showFormNotice('warning', '信息不完整', '请填写中文名、英文名和定位值')
    return
  }
  if (!props.appId) {
    showFormNotice('warning', '缺少应用', '请先选择应用')
    return
  }
  const matched = selected.value
  if (matched?.matchedElementId
      && matched.matchedNameEn
      && matched.matchedNameEn === form.nameEn.trim()) {
    showFormNotice('info', '已有同名元素', '库中已匹配到同名元素，改为直接选用')
    await promoteMatched()
    return
  }

  const nameEn = form.nameEn.trim()
  try {
    const existing = await findExistingByNameEn(nameEn)
    if (existing?.id) {
      showFormNotice(
        'warning',
        '英文名已存在',
        `库中已有「${existing.nameZh || existing.nameEn}」（状态：${existing.status || '-'}）。无需再建，可点下方按钮直接选用。`,
        existing
      )
      return
    }
  } catch (e: any) {
    console.warn('查重失败', e)
  }

  saving.value = true
  try {
    await apiClient.createUiElement({
      catalog: 'SHARED',
      appId: props.appId,
      platform: props.platform || 'ANDROID',
      source: 'HUMAN_AI',
      status: promote ? 'ACTIVE' : 'CANDIDATE',
      nameZh: form.nameZh.trim(),
      nameEn: nameEn,
      visualHint: form.visualHint.trim() || null,
      // 下拉清空时 el-select 给的是 undefined，直接 .trim() 会炸
      pageId: String(form.pageId || '').trim() || null,
      locatorType: form.locatorType.trim(),
      locatorValue: form.locatorValue.trim(),
      enabled: true,
      defaultTimeoutSec: 10
    })
    emit('saved', {
      nameEn,
      nameZh: form.nameZh.trim(),
      promoted: promote
    })
    close()
  } catch (e: any) {
    saving.value = false
    const msg = String(e?.message || e?.error || '保存失败')
    if (msg.includes('英文名已存在')) {
      try {
        const hit = await findExistingByNameEn(nameEn)
        if (hit?.id) {
          showFormNotice(
            'warning',
            '英文名已存在',
            `库中已有「${hit.nameZh || hit.nameEn}」（状态：${hit.status || '-'}）。无需再建，可点下方按钮直接选用。`,
            hit
          )
          return
        }
      } catch {
        /* ignore */
      }
    }
    showFormNotice('error', '保存失败', msg)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.inspector-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.inspector-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.inspector-body {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  min-height: 70vh;
}
.inspector-shot-wrap {
  position: relative;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  max-height: 78vh;
}
.inspector-shot-inner {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
}
.inspector-shot {
  max-width: 100%;
  height: auto;
  cursor: crosshair;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}
.inspector-shot-empty {
  padding: 48px;
  color: var(--el-text-color-placeholder);
}
.inspector-mark {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--app-danger);
  border: 2px solid #fff;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
  z-index: 2;
}
.inspector-bounds {
  position: absolute;
  border: 2px solid var(--app-danger);
  background: rgba(245, 108, 108, 0.12);
  pointer-events: none;
  box-sizing: border-box;
  z-index: 1;
}
.inspector-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.inspector-side-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.inspector-candidates {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
  max-height: 40vh;
  overflow: auto;
}
.cand-h5-alert {
  margin-bottom: 8px;
}
.inspector-cand {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  margin-bottom: 6px;
  background: #fafafa;
}
.inspector-cand:hover,
.inspector-cand.active {
  border-color: var(--app-primary);
  background: var(--el-color-primary-light-9);
}
.cand-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cand-meta {
  font-size: 12px;
  color: var(--app-text-secondary);
  word-break: break-all;
  margin-top: 2px;
}
.cand-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
}
.cand-match {
  font-size: 12px;
  color: var(--app-success);
  margin-top: 4px;
}
/* 命中数用颜色分级：唯一是常态、灰着就行；不唯一必须扎眼，它是要人现在就处理的 */
.cand-count {
  font-size: 12px;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.cand-count.is-unique {
  color: var(--app-text-secondary);
}
.cand-count.is-unknown {
  color: var(--el-text-color-placeholder);
}
.cand-count.is-dup {
  color: var(--el-color-danger);
  font-weight: 600;
}
.cand-warn-alert {
  margin-bottom: 8px;
}
.cand-warn-text {
  font-size: 12px;
  line-height: 1.7;
}
.inspector-form {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
}
.form-notice {
  margin-bottom: 12px;
}
.form-notice-msg {
  margin: 4px 0 0;
  line-height: 1.5;
  white-space: pre-wrap;
}
.form-notice-actions {
  margin-top: 8px;
}
.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 960px) {
  .inspector-body {
    grid-template-columns: 1fr;
  }
}
.page-pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.page-pick-select {
  flex: 1;
  min-width: 0;
}

.page-pick-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}

</style>
