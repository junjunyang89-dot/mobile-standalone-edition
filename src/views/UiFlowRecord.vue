<template>
  <div class="ui-record">
    <div class="page-topbar">
      <el-button link class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回流程编排
      </el-button>
    </div>
    <template v-if="!session">
      <div class="start-card">
        <div class="start-lead">
          在模拟器截图上点，平台记下这一步再驱动设备点一下。录出来的是测试环境自动化草稿，
          元素先当待审候选，真机和生产回归都不会被占用。
        </div>
        <div class="chip-row">
          <span class="chip-label">产品</span>
          <div class="chip-list">
            <button
              v-for="p in PRODUCTS"
              :key="p.id"
              type="button"
              class="app-chip"
              :class="{ active: product === p.id }"
              @click="selectProduct(p.id)"
            >{{ p.label }}</button>
          </div>
        </div>
        <div class="chip-row">
          <span class="chip-label">平台</span>
          <div class="chip-list">
            <button
              v-for="p in visiblePlatforms"
              :key="p.value"
              type="button"
              class="plat-chip"
              :class="{ active: platform === p.value }"
              @click="selectPlatform(p.value)"
            >{{ p.label }}</button>
          </div>
        </div>
        <el-form label-position="top" class="start-form" @submit.prevent="start">
          <el-form-item label="流程名称">
            <el-input v-model="name" maxlength="80" placeholder="录完会落成自动化草稿" />
          </el-form-item>
          <el-form-item label="模拟器">
            <el-select
              v-model="deviceId"
              filterable
              :loading="loadingDevices"
              placeholder="只列出已连接的模拟器"
              style="width: 100%"
            >
              <el-option
                v-for="d in emulators"
                :key="d.id"
                :label="emulatorLabel(d)"
                :value="d.id"
              />
            </el-select>
            <div class="start-hint">
              真机不出现在这里。没开机的模拟器请先到设备池启动。
              <el-button link type="primary" @click="loadEmulators">刷新</el-button>
              <el-button link @click="router.push('/devices')">去设备池</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="starting" :disabled="!canWrite" @click="start">
              开始录制
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </template>

    <template v-else>
      <div class="rec-session">
      <div class="rec-toolbar">
        <div class="rec-title">
          <b>{{ session.name || '未命名录制' }}</b>
          <span class="rec-meta">{{ platformUiLabel(session.platform) }} · {{ session.deviceId }} · 已录 {{ session.steps.length }} 步</span>
        </div>
        <div class="rec-actions">
          <el-button :loading="loadingShot" @click="refreshShot">刷新截图</el-button>
          <el-button :disabled="!session.steps.length || busy" @click="undo">撤销一步</el-button>
          <el-button type="primary" :loading="finishing" :disabled="!session.steps.length || busy" @click="finish">
            保存草稿
          </el-button>
          <el-button :disabled="busy" @click="abandon">放弃</el-button>
        </div>
      </div>

      <el-alert
        class="undo-alert"
        type="warning"
        :closable="false"
        show-icon
        title="撤销只撤记录，设备上已经点过的操作不会回退。界面还停在原处，必要时先在手机上退回去再接着录。"
      />
      <el-alert
        class="undo-alert"
        type="info"
        :closable="false"
        show-icon
        title="左边截图会自动跟上。点、按住拖动都在这张图上做。桌面要打开应用列表：从下半屏往上拖，或点右边「上滑」。不要只在模拟器窗口上滑。"
      />

      <div class="rec-body">
        <div
          ref="wrapRef"
          class="shot-wrap"
          v-loading="loadingShot || tapping"
          :element-loading-text="tapping ? '正在点模拟器…' : '正在截图…'"
        >
          <div v-if="!shotUrl" class="shot-empty">截图还没出来，点「刷新截图」</div>
          <div v-else class="shot-stage">
            <img
              ref="imgRef"
              :src="shotUrl"
              class="shot"
              alt="模拟器截图"
              draggable="false"
              :style="shotFit"
              @load="fitShot"
              @pointerdown="onShotPointerDown"
              @pointerup="onShotPointerUp"
              @pointercancel="clearShotGesture"
            />
            <div
              v-if="mark"
              class="shot-mark"
              :style="{ left: mark.left + 'px', top: mark.top + 'px' }"
            />
          </div>
        </div>

        <div class="side">
          <div class="side-title">已录步骤</div>
          <div v-if="!session.steps.length" class="side-empty">
            在左边截图上点一下或按住拖动。桌面往上滑才能看到「完美世界电竞」，点图标会打开别的应用。
          </div>
          <ol v-else class="step-list">
            <li v-for="st in session.steps" :key="st.index" class="step-item">
              <div class="step-head">
                <span class="step-no">{{ st.index }}</span>
                <b>{{ stepTitle(st) }}</b>
              </div>
              <div v-if="st.locatorValue" class="step-loc">
                {{ st.locatorType }} · {{ st.locatorValue }}
              </div>
              <div class="step-tags">
                <el-tag v-if="st.existingElementId" size="small" type="success" effect="plain">复用</el-tag>
                <el-tag
                  v-else-if="st.elementKey && st.locatorType !== 'coordinate'"
                  size="small"
                  type="warning"
                  effect="plain"
                >新建待审</el-tag>
                <el-tag
                  v-if="(st.matchCount || 0) > 1"
                  size="small"
                  type="danger"
                >命中 {{ st.matchCount }} 个</el-tag>
                <el-tag v-if="st.locatorType === 'coordinate'" size="small" type="danger" effect="plain">
                  坐标兜底
                </el-tag>
              </div>
            </li>
          </ol>

          <div class="manual">
            <div class="side-title">补一步（不是点一下的操作）</div>
            <div class="manual-hint">输入：先在左边点输入框，再填内容点「输入」。平台会写到模拟器上并刷新截图。</div>
            <div class="manual-row">
              <el-input
                v-model="inputText"
                size="small"
                placeholder="要输入的内容，如账号 / 密码"
                @keyup.enter="addInput"
              />
              <el-button size="small" type="primary" :disabled="busy || !inputText" @click="addInput">
                输入
              </el-button>
            </div>
            <div class="manual-row">
              <el-input-number v-model="waitMs" :min="200" :max="60000" :step="500" size="small" />
              <el-button size="small" :disabled="busy" @click="addWait">等待</el-button>
              <el-button size="small" :disabled="busy" @click="addSwipeUp">上滑</el-button>
              <el-button size="small" :disabled="busy" @click="addBack">返回</el-button>
            </div>
            <div class="manual-row">
              <el-input v-model="assertKey" size="small" placeholder="断言元素 key，如 login_btn" />
              <el-button size="small" :disabled="busy || !assertKey.trim()" @click="addAssert">
                断言存在
              </el-button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { apiClient, type UiRecordingSession, type UiRecordingStep } from '@/api'
import { isEmulatorDevice } from '@/utils/deviceKind'
import { platformUiLabel } from '@/utils/platform'
import { canWrite } from '@/stores/auth'

type ProductId = 'ESPORTS' | 'POGPOG'
const PRODUCTS: { id: ProductId; label: string; platforms: string[] }[] = [
  { id: 'ESPORTS', label: '完美电竞', platforms: ['ANDROID', 'IOS', 'HARMONYOS'] },
  { id: 'POGPOG', label: 'POGPOG', platforms: ['ANDROID', 'IOS'] }
]
const PLATFORMS = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' }
]
const SESSION_KEY = 'ui-recording-id'

const route = useRoute()
const router = useRouter()

const product = ref<ProductId>('ESPORTS')
const platform = ref('ANDROID')
const name = ref('')
const deviceId = ref('')
const emulators = ref<Array<Record<string, any>>>([])
const loadingDevices = ref(false)
const starting = ref(false)

const session = ref<UiRecordingSession | null>(null)
const shotUrl = ref('')
const wrapRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const shotFit = ref<Record<string, string>>({})
let wrapObserver: ResizeObserver | null = null

function fitShot() {
  const wrap = wrapRef.value
  const img = imgRef.value
  if (!wrap || !img || !img.naturalWidth || !img.naturalHeight) return
  const maxW = Math.max(80, wrap.clientWidth - 16)
  const maxH = Math.max(80, wrap.clientHeight - 16)
  const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
  shotFit.value = {
    width: `${Math.floor(img.naturalWidth * s)}px`,
    height: `${Math.floor(img.naturalHeight * s)}px`
  }
}

function bindWrapObserver() {
  wrapObserver?.disconnect()
  if (!wrapRef.value) return
  wrapObserver = new ResizeObserver(() => fitShot())
  wrapObserver.observe(wrapRef.value)
}

watch(session, async (s) => {
  if (!s) {
    stopShotPoll()
    wrapObserver?.disconnect()
    wrapObserver = null
    return
  }
  await nextTick()
  bindWrapObserver()
  fitShot()
  scheduleShotPoll()
})
const mark = ref<{ left: number; top: number } | null>(null)
const loadingShot = ref(false)
const tapping = ref(false)
const finishing = ref(false)
const waitMs = ref(2000)
const assertKey = ref('')
const inputText = ref('')
let skipLeaveAsk = false

const busy = computed(() => tapping.value || loadingShot.value || finishing.value)

const visiblePlatforms = computed(() => {
  const allowed = PRODUCTS.find((p) => p.id === product.value)?.platforms || []
  return PLATFORMS.filter((p) => allowed.includes(p.value))
})

function resolveAppId(p: ProductId, plat: string) {
  if (p === 'POGPOG') return 'OVERSEAS_POGPOG'
  if (String(plat || '').toUpperCase() === 'HARMONYOS') return 'DOMESTIC_ESPORTS_HARMONY'
  return 'DOMESTIC_ESPORTS'
}

function selectProduct(id: ProductId) {
  product.value = id
  const allowed = PRODUCTS.find((p) => p.id === id)?.platforms || []
  if (!allowed.includes(platform.value)) platform.value = allowed[0] || 'ANDROID'
  void loadEmulators()
}

function selectPlatform(value: string) {
  platform.value = value
  void loadEmulators()
}

function emulatorLabel(d: Record<string, any>) {
  const n = String(d.name || d.id || '').replace(/（模拟器）$/, '').trim()
  return `${n} · ${platformUiLabel(d.platform)}`
}

function stepTitle(st: UiRecordingStep) {
  if (st.keywordCode === 'WAIT') {
    const ms = Number(st.params?.durationMs || 0)
    return ms ? `等待 ${ms}ms` : '等待'
  }
  if (st.keywordCode === 'BACK') return '返回'
  if (st.keywordCode === 'INPUT' || st.keywordCode === 'INPUT_EDITTEXT') {
    return `输入 ${st.elementNameZh || st.elementKey || ''}`.trim()
  }
  if (st.keywordCode === 'ASSERT_ELEMENTS_EXIST') return `断言 ${st.elementKey || ''} 存在`
  if (st.keywordCode === 'SWIPE') return st.elementNameZh || '滑动'
  return st.elementNameZh || st.elementKey || st.keywordCode
}

function applySession(s: UiRecordingSession) {
  session.value = s
  if (s.recordingId) sessionStorage.setItem(SESSION_KEY, s.recordingId)
  if (s.appId) {
    product.value = String(s.appId).toUpperCase().includes('POGPOG') ? 'POGPOG' : 'ESPORTS'
  }
  if (s.platform) platform.value = s.platform
  if (s.deviceId) deviceId.value = s.deviceId
  if (s.name) name.value = s.name
}

function revokeShot() {
  if (shotUrl.value.startsWith('blob:')) URL.revokeObjectURL(shotUrl.value)
  shotUrl.value = ''
}

async function loadShot(devId: string, silent = false) {
  if (!silent) loadingShot.value = true
  try {
    const next = await apiClient.fetchDeviceInspectScreenshotObjectUrl(devId, String(Date.now()))
    const prev = shotUrl.value
    shotUrl.value = next
    if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    if (!silent) mark.value = null
    await nextTick()
    fitShot()
  } catch (e: any) {
    if (!silent) ElMessage.warning(e?.message || '截图加载失败')
  } finally {
    if (!silent) loadingShot.value = false
  }
}

let shotTimer: number | undefined

function stopShotPoll() {
  if (shotTimer != null) {
    window.clearTimeout(shotTimer)
    shotTimer = undefined
  }
}

/** 会话开着就隔两秒补一帧。点、输入时停，避免和点击抢截图。 */
function scheduleShotPoll() {
  stopShotPoll()
  shotTimer = window.setTimeout(async () => {
    const rec = session.value
    if (rec && !busy.value && document.visibilityState === 'visible') {
      try {
        await apiClient.refreshUiRecording(rec.recordingId)
        if (session.value?.recordingId === rec.recordingId && !busy.value) {
          await loadShot(rec.deviceId, true)
        }
      } catch {
        /* 自动刷失败不弹窗，下一轮再试 */
      }
    }
    if (session.value) scheduleShotPoll()
  }, 2000)
}

async function loadEmulators() {
  loadingDevices.value = true
  try {
    const pool = await apiClient.getDevicePool()
    const plat = platform.value.toUpperCase()
    emulators.value = (pool.devices || []).filter((d) => {
      if (d.catalogOnly && String(d.avd?.state || '').toUpperCase() !== 'READY') return false
      if (!isEmulatorDevice(d) && !d.avd) return false
      if (String(d.id || '').startsWith('avd:')) return false
      if (String(d.platform || '').toUpperCase() !== plat) return false
      return String(d.status || '').toUpperCase() === 'CONNECTED'
        || String(d.avd?.state || '').toUpperCase() === 'READY'
    })
    const qid = typeof route.query.deviceId === 'string' ? route.query.deviceId : ''
    if (qid && emulators.value.some((d) => d.id === qid)) {
      deviceId.value = qid
    } else if (deviceId.value && !emulators.value.some((d) => d.id === deviceId.value)) {
      deviceId.value = emulators.value[0]?.id || ''
    } else if (!deviceId.value) {
      deviceId.value = emulators.value[0]?.id || ''
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '设备池加载失败')
  } finally {
    loadingDevices.value = false
  }
}

function selectedEmulator() {
  return emulators.value.find((d) => d.id === deviceId.value)
}

async function start() {
  if (!canWrite.value) {
    ElMessage.warning('当前账号不能改数据')
    return
  }
  const picked = selectedEmulator()
  if (!deviceId.value || !picked) {
    ElMessage.warning('先选一台已连接的模拟器')
    return
  }
  if (!isEmulatorDevice(picked) && !picked.avd) {
    ElMessage.warning('录制只用模拟器。真机留给生产和回归，别占')
    return
  }
  starting.value = true
  try {
    const s = await apiClient.startUiRecording({
      deviceId: deviceId.value,
      appId: resolveAppId(product.value, platform.value),
      platform: platform.value,
      name: name.value.trim() || undefined
    })
    applySession(s)
    await loadShot(s.deviceId)
  } catch (e: any) {
    ElMessage.error(e?.message || '开始录制失败')
  } finally {
    starting.value = false
  }
}

function shotPoint(ev: PointerEvent) {
  const img = imgRef.value
  if (!img) return null
  const dispW = img.clientWidth || img.getBoundingClientRect().width
  const dispH = img.clientHeight || img.getBoundingClientRect().height
  if (dispW <= 0 || dispH <= 0) return null
  const rect = img.getBoundingClientRect()
  const ox = Math.min(Math.max(ev.clientX - rect.left, 0), dispW)
  const oy = Math.min(Math.max(ev.clientY - rect.top, 0), dispH)
  return {
    ox,
    oy,
    dispW,
    dispH,
    xRatio: Math.min(1, Math.max(0, ox / dispW)),
    yRatio: Math.min(1, Math.max(0, oy / dispH))
  }
}

type ShotGesture = { xRatio: number; yRatio: number; ox: number; oy: number; t: number }
let shotGesture: ShotGesture | null = null

function onShotPointerDown(ev: PointerEvent) {
  if (busy.value || !session.value) return
  const p = shotPoint(ev)
  if (!p) return
  ev.preventDefault()
  ;(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)
  shotGesture = { xRatio: p.xRatio, yRatio: p.yRatio, ox: p.ox, oy: p.oy, t: Date.now() }
}

function clearShotGesture() {
  shotGesture = null
}

async function onShotPointerUp(ev: PointerEvent) {
  const start = shotGesture
  shotGesture = null
  const rec = session.value
  const p = shotPoint(ev)
  if (!start || !p || !rec || busy.value) return
  const dist = Math.hypot(p.ox - start.ox, p.oy - start.oy)
  const threshold = Math.max(28, Math.min(p.dispW, p.dispH) * 0.06)
  mark.value = { left: p.ox - 6, top: p.oy - 6 }
  if (dist >= threshold) {
    const durationMs = Math.max(280, Math.min(800, Date.now() - start.t))
    await sendSwipe(start.xRatio, start.yRatio, p.xRatio, p.yRatio, durationMs)
    return
  }
  await sendTap(p.xRatio, p.yRatio)
}

async function sendTap(xRatio: number, yRatio: number) {
  const rec = session.value
  if (!rec) return
  tapping.value = true
  try {
    const res = await apiClient.tapUiRecording(rec.recordingId, { xRatio, yRatio })
    if (res.step) {
      session.value = {
        ...rec,
        steps: [...rec.steps, res.step],
        screenshotUrl: res.screenshotUrl || rec.screenshotUrl
      }
    }
    await loadShot(rec.deviceId)
  } catch (e: any) {
    ElMessage.error(e?.message || '这一步没记上')
  } finally {
    tapping.value = false
  }
}

async function sendSwipe(
  x1Ratio: number,
  y1Ratio: number,
  x2Ratio: number,
  y2Ratio: number,
  durationMs?: number
) {
  const rec = session.value
  if (!rec) return
  tapping.value = true
  try {
    const res = await apiClient.swipeUiRecording(rec.recordingId, {
      x1Ratio,
      y1Ratio,
      x2Ratio,
      y2Ratio,
      durationMs
    })
    if (res.step) {
      session.value = {
        ...rec,
        steps: [...rec.steps, res.step],
        screenshotUrl: res.screenshotUrl || rec.screenshotUrl
      }
    }
    await loadShot(rec.deviceId)
  } catch (e: any) {
    ElMessage.error(e?.message || '这一下滑没记上')
  } finally {
    tapping.value = false
  }
}

async function refreshShot() {
  const rec = session.value
  if (!rec) return
  try {
    const s = await apiClient.refreshUiRecording(rec.recordingId)
    applySession({ ...rec, ...s, steps: s.steps || rec.steps })
    await loadShot(rec.deviceId)
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  }
}

async function undo() {
  const rec = session.value
  if (!rec) return
  try {
    const res = await apiClient.undoUiRecording(rec.recordingId)
    session.value = { ...rec, steps: rec.steps.slice(0, -1) }
    ElMessage.warning(res.message || '已撤销记录。设备上那一步不会回退')
  } catch (e: any) {
    ElMessage.error(e?.message || '撤销失败')
  }
}

async function addManual(keywordCode: string, elementKey?: string, params?: Record<string, unknown>) {
  const rec = session.value
  if (!rec) return
  tapping.value = true
  try {
    const res = await apiClient.addUiRecordingStep(rec.recordingId, { keywordCode, elementKey, params })
    if (res.step) {
      session.value = {
        ...rec,
        steps: [...rec.steps, res.step],
        screenshotUrl: res.screenshotUrl || rec.screenshotUrl
      }
    }
    if (res.screenshotUrl || keywordCode === 'INPUT' || keywordCode === 'BACK') {
      await loadShot(rec.deviceId)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '补这一步失败')
  } finally {
    tapping.value = false
  }
}

function addInput() {
  const text = inputText.value
  if (!text) return
  const last = [...(session.value?.steps || [])]
    .reverse()
    .find((st) => st.locatorValue && st.locatorType !== 'coordinate')
  if (!last) {
    ElMessage.warning('先在左边截图上点一下输入框，再点输入')
    return
  }
  return addManual('INPUT', last.elementKey, { text })
}

function addWait() {
  return addManual('WAIT', undefined, { durationMs: waitMs.value })
}

function addSwipeUp() {
  return sendSwipe(0.5, 0.84, 0.5, 0.28, 400)
}

function addBack() {
  return addManual('BACK')
}

function addAssert() {
  const key = assertKey.value.trim()
  if (!key) return
  return addManual('ASSERT_ELEMENTS_EXIST', key)
}

function clearSession() {
  session.value = null
  sessionStorage.removeItem(SESSION_KEY)
  revokeShot()
  mark.value = null
}

async function finish() {
  const rec = session.value
  if (!rec) return
  if (!rec.steps.length) {
    ElMessage.warning('一步都没录，没什么可保存的')
    return
  }
  finishing.value = true
  try {
    const res = await apiClient.finishUiRecording(rec.recordingId, rec.name || name.value || undefined)
    const recApp = rec.appId
    const recPlat = rec.platform
    skipLeaveAsk = true
    clearSession()
    ElMessage.success(res.message || '已生成流程草稿')
    if (res.warnings?.length) {
      ElMessage.warning(res.warnings.slice(0, 3).join('；'))
    }
    try {
      await ElMessageBox.confirm(
        `流程「${res.flowName}」已落成测试环境自动化草稿（${res.steps} 步）。新建 ${res.elementsCreated} 个待审元素，复用 ${res.elementsReused} 个。`,
        '录制已保存',
        { confirmButtonText: '去审元素', cancelButtonText: '回流程编排', type: 'success' }
      )
      await router.push({
        path: '/ui-elements',
        query: { source: 'RECORDED', status: 'CANDIDATE', appId: recApp, platform: recPlat }
      })
    } catch {
      await router.push('/ui-flows')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    finishing.value = false
  }
}

async function abandon() {
  const rec = session.value
  if (!rec) return
  try {
    await ElMessageBox.confirm('放弃后步骤不会落库，设备会立刻释放。', '放弃这次录制', {
      type: 'warning',
      confirmButtonText: '放弃',
      cancelButtonText: '继续录'
    })
  } catch {
    return
  }
  try {
    const res = await apiClient.cancelUiRecording(rec.recordingId)
    skipLeaveAsk = true
    clearSession()
    ElMessage.success(res.message || '已放弃这次录制')
  } catch (e: any) {
    ElMessage.error(e?.message || '放弃失败')
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!session.value) return
  e.preventDefault()
  e.returnValue = ''
}

function goBack() {
  router.push('/ui-flows')
}

onBeforeRouteLeave(async () => {
  if (skipLeaveAsk || !session.value) return true
  try {
    await ElMessageBox.confirm('这次录制还没保存。保存成草稿，还是放弃？', '离开录制', {
      distinguishCancelAndClose: true,
      confirmButtonText: '保存草稿',
      cancelButtonText: '放弃',
      type: 'warning'
    })
    try {
      await apiClient.finishUiRecording(
        session.value.recordingId,
        session.value.name || name.value || undefined
      )
      clearSession()
      return true
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败，还停在这一页')
      return false
    }
  } catch (action) {
    if (action === 'cancel') {
      try {
        await apiClient.cancelUiRecording(session.value.recordingId)
        clearSession()
        return true
      } catch (e: any) {
        ElMessage.error(e?.message || '放弃失败')
        return false
      }
    }
    return false
  }
})

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  const qPlat = typeof route.query.platform === 'string' ? route.query.platform.trim().toUpperCase() : ''
  if (qPlat === 'HARMONYOS' || qPlat === 'IOS' || qPlat === 'ANDROID') {
    platform.value = qPlat
    if (qPlat === 'HARMONYOS') product.value = 'ESPORTS'
  }
  await loadEmulators()
  const saved = sessionStorage.getItem(SESSION_KEY)
  if (!saved) return
  try {
    const s = await apiClient.getUiRecording(saved)
    applySession(s)
    await loadShot(s.deviceId)
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
  }
})

onBeforeUnmount(() => {
  stopShotPoll()
  window.removeEventListener('beforeunload', onBeforeUnload)
  wrapObserver?.disconnect()
  wrapObserver = null
  revokeShot()
})
</script>

<style scoped>
.ui-record {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}
.rec-session {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.page-topbar {
  display: flex;
  align-items: center;
}
.back-btn {
  padding: 0;
  font-size: 14px;
  color: var(--app-text-regular);
}
.back-btn:hover {
  color: var(--el-color-primary);
}
.start-card,
.rec-toolbar {
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
}
.start-lead {
  font-size: 13px;
  color: var(--app-text-regular);
  line-height: 1.7;
  margin-bottom: 14px;
}
.chip-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.chip-label {
  width: 36px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.app-chip,
.plat-chip {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--app-text-regular);
  cursor: pointer;
}
.app-chip.active {
  color: var(--el-color-primary);
  font-weight: 600;
  background: var(--el-color-primary-light-9);
}
.plat-chip {
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
}
.plat-chip.active {
  border-color: var(--el-color-success);
  background: var(--el-color-success);
  color: #fff;
  font-weight: 600;
}
.start-form {
  max-width: 520px;
  margin-top: 8px;
}
.start-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rec-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rec-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rec-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rec-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.undo-alert {
  margin: 0;
}
.rec-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  gap: 16px;
}
.shot-wrap {
  position: relative;
  background: #1d1d1d;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.shot-stage {
  position: relative;
  line-height: 0;
}
.shot {
  display: block;
  cursor: crosshair;
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
}
.shot-empty {
  padding: 48px;
  color: var(--el-text-color-disabled);
}
.shot-mark {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--el-color-danger);
  background: rgba(245, 108, 108, 0.25);
  pointer-events: none;
}
.side {
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  min-height: 0;
  overflow: auto;
}
.side-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.side-empty {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}
.step-list {
  margin: 0 0 16px;
  padding-left: 0;
  list-style: none;
}
.step-item {
  padding: 8px 0;
  border-bottom: 1px solid #f2f6fc;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.step-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-loc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.step-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.manual {
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color);
}
.manual-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}
.manual-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
