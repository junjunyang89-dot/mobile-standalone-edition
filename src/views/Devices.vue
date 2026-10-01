<template>
  <div class="devices">
    <Teleport v-if="paneActive" to="#page-header-actions">
      <el-button type="primary" plain :loading="poolLoading" @click="refreshDevices">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </Teleport>

    <div class="pool-panel">
      <div class="pool-filters">
        <div class="filter-row">
          <span class="filter-label">状态</span>
          <div class="seg">
            <button
              v-for="s in statusOptions"
              :key="s.value"
              type="button"
              class="seg-item"
              :class="[`is-${s.value.toLowerCase()}`, { on: poolFilter === s.value }]"
              @click="poolFilter = s.value"
            >
              {{ s.label }} <b>{{ s.count }}</b>
            </button>
          </div>
          <div class="filter-meta">
            <span :class="{ full: emuAtCap }">
              模拟器运行中 <b>{{ emuOverview.runningCount }}</b> / {{ emuOverview.maxRunning }}
            </span>
            <span class="meta-sep" />
            <span>显示 <b>{{ visibleDevices.length }}</b> / {{ poolRows.length }} 台</span>
          </div>
        </div>

        <div class="filter-row">
          <span class="filter-label">平台</span>
          <button type="button" class="chip" :class="{ on: !platformFilter }" @click="platformFilter = ''">
            全部 <b>{{ scopeCounts.platformAll }}</b>
          </button>
          <button
            v-for="p in deviceClassOptions"
            :key="p.value"
            type="button"
            class="chip"
            :class="{ on: platformFilter === p.value }"
            @click="togglePlatform(p.value)"
          >
            {{ p.label }} <b>{{ scopeCounts[p.value] }}</b>
          </button>
        </div>

        <div class="filter-row">
          <span class="filter-label">类型</span>
          <button type="button" class="chip" :class="{ on: !kindFilter }" @click="kindFilter = ''">
            全部 <b>{{ scopeCounts.kindAll }}</b>
          </button>
          <button type="button" class="chip" :class="{ on: kindFilter === 'REAL' }" @click="toggleKind('REAL')">
            真机 <b>{{ scopeCounts.real }}</b>
          </button>
          <button type="button" class="chip" :class="{ on: kindFilter === 'EMU' }" @click="toggleKind('EMU')">
            模拟器 <b>{{ scopeCounts.emu }}</b>
          </button>
        </div>

        <el-alert
          v-if="emuOverview.hint || !emuOverview.emulatorCliAvailable"
          class="emu-hint"
          type="warning"
          :closable="false"
          :title="emuOverview.hint || '主控机没有 emulator 命令，平台管不了启停。雷电/夜神请在那台机器上自己开。'"
        />
        <div v-if="emuUnmatched.length" class="emu-unmatched">
          在跑但问不出 AVD 名（雷电/夜神这类）：{{ emuUnmatched.join('、') }}。能跑用例，只是这里管不了开关。
        </div>
        <div v-if="kindFilter === 'EMU'" class="emu-find">
          安卓官方模拟器没开机时叫
          <b>{{ androidAvdNames.length ? androidAvdNames.join('、') : 'AVD 名（如 Medium_Phone）' }}</b>，右侧才有「启动」。
          开机后 adb 会改叫 sdk_gphone64_arm64，是同一台。绿色「已连接」那行若没有窗口，是上次留下的幽灵，不要点它。
        </div>
      </div>

      <el-table
        :data="pagedDevices"
        v-loading="poolLoading && !poolRows.length"
        empty-text="暂无设备"
        class="pool-table"
        style="width: 100%"
        :header-cell-style="{ background: '#f7f8fa', color: '#86909c', fontWeight: 500 }"
        @row-click="onRowClick"
      >
        <el-table-column prop="name" label="设备名称" min-width="220">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="dev-icon" :class="{ emu: isEmuRow(row) }">
                <el-icon><Monitor v-if="isEmuRow(row)" /><Iphone v-else /></el-icon>
              </span>
              <div class="name-main">
                <div class="dev-name">
                  {{ displayName(row) }}
                  <span v-if="row.disabled" class="off-tag">已停用</span>
                </div>
                <div v-if="avdAlias(row)" class="emu-id">AVD {{ avdAlias(row) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="150">
          <template #default="{ row }">
            <!--
              模拟器必须一眼看得出来。它跟真机混在同一个列表里，
              而「这台是模拟器」会改变你对结果的解读：跑挂了未必是缺陷，
              跑过了也未必代表真机上过得去。
            -->
            <div class="plat-cell">
              <span class="plat-tag" :class="platClass(row.platform)">{{ platformLabel(row.platform) }}</span>
              <span v-if="isEmuRow(row)" class="emu-tag">模拟器</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="version-cell">{{ row.version || '—' }}</span>
          </template>
        </el-table-column>
        <!--
          环境绑在设备上：一台手机装的就是某个环境的包，不会一会儿线上一会儿测试。
          四台机同时跑（两台线上两台测试）时不用每次去勾一遍。
        -->
        <el-table-column label="环境" width="140">
          <template #default="{ row }">
            <el-select
              :model-value="row.environment || ''"
              size="small"
              class="env-select"
              placeholder="执行时再定"
              :disabled="!!row.catalogOnly"
              @click.stop
              @change="(v: string) => saveEnvironment(row, v)"
            >
              <el-option label="执行时再定" value="" />
              <el-option label="测试" value="TEST" />
              <el-option label="线上" value="PROD" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tooltip :content="statusTip(row)" :disabled="!statusTip(row)" placement="top">
              <span class="status-pill" :class="`is-${rowStatusType(row)}`">
                <i class="dot" />{{ rowStatusText(row) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <!--
          占用列：设备池共用之后，「这台现在归谁」比「最后可见时间」重要得多。
          跑任务和被人借走走的是同一把锁，所以这一列同时能看到两种占用。
        -->
        <el-table-column label="占用" width="130">
          <template #default="{ row }">
            <el-tooltip
              v-if="!row.catalogOnly && occupancyOf(row.id)"
              :content="occTip(row.id)"
              placement="top"
            >
              <span class="occ-tag" :class="occClass(row.id)">{{ occupancyOf(row.id)!.kindLabel }}</span>
            </el-tooltip>
            <span v-else class="occ-tag is-idle">空闲</span>
          </template>
        </el-table-column>
        <el-table-column v-if="canWrite" label="操作" width="230" align="right" fixed="right">
          <template #default="{ row }">
            <div class="row-ops" @click.stop>
              <template v-if="row.avd">
                <template v-if="avdState(row.avd) === 'NOT_RUNNING' || avdState(row.avd) === 'FAILED'">
                  <el-button link type="primary" size="small" :loading="isAvdBusy(row.avd.name)" :disabled="emuAtCap" @click="startAvd(row.avd, false)">
                    {{ avdState(row.avd) === 'FAILED' ? '重试' : '启动' }}
                  </el-button>
                  <el-button link size="small" class="op-strong" :loading="isAvdBusy(row.avd.name)" :disabled="emuAtCap" @click="startAvd(row.avd, true)">
                    清数据启动
                  </el-button>
                </template>
                <template v-else-if="avdState(row.avd) === 'BOOTING'">
                  <el-button link size="small" :loading="isAvdBusy(row.avd.name)" @click="stopAvd(row.avd)">中止</el-button>
                </template>
                <template v-else>
                  <el-tooltip :content="row.avd.busy ? '正被占用，不能清数据' : '恢复出厂再开机，比关机干净，也比关机快'" placement="top">
                    <el-button link type="primary" size="small" :disabled="!!row.avd.busy" :loading="isAvdBusy(row.avd.name)" @click="wipeAvd(row.avd)">
                      清数据
                    </el-button>
                  </el-tooltip>
                  <el-button v-if="isMine(row.id)" link type="danger" size="small" @click="giveBack(row)">归还</el-button>
                  <el-button v-else-if="canBorrow(row)" link type="primary" size="small" @click="borrow(row)">借用</el-button>
                </template>
              </template>
              <template v-else-if="!row.catalogOnly">
                <el-button v-if="!isConnected(row.status)" link type="primary" size="small" @click="connectDevice(row.id)">
                  连接
                </el-button>
                <el-button v-else link type="primary" size="small" @click="disconnectDevice(row.id)">
                  断开
                </el-button>
                <el-button v-if="isMine(row.id)" link type="danger" size="small" @click="giveBack(row)">归还</el-button>
                <el-button v-else-if="canBorrow(row)" link type="primary" size="small" @click="borrow(row)">借用</el-button>
                <el-button v-else-if="!occupancyOf(row.id)" link size="small" disabled>归还</el-button>
              </template>
              <el-dropdown trigger="click" @command="(c: string) => onMore(row, c)">
                <span class="more-btn"><el-icon><MoreFilled /></el-icon></span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="isMine(row.id)" command="renew">续借</el-dropdown-item>
                    <el-dropdown-item v-if="canRecord(row)" command="record">录制</el-dropdown-item>
                    <el-dropdown-item
                      v-if="row.avd && avdState(row.avd) === 'READY'"
                      command="stopAvd"
                      :disabled="!!row.avd.busy"
                    >
                      关闭模拟器
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!row.catalogOnly" command="detail">设备详情</el-dropdown-item>
                    <el-dropdown-item v-if="!row.catalogOnly" command="toggle" divided>
                      {{ row.disabled ? '恢复调度' : '停用（不再派任务）' }}
                    </el-dropdown-item>
                    <el-dropdown-item v-if="row.catalogOnly" disabled>未启动，开机后才有更多操作</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="visibleDevices.length > 0" class="pool-pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="visibleDevices.length"
          layout="total, sizes, prev, pager, next"
          size="small"
          @size-change="page = 1"
        />
      </div>
    </div>

    <el-dialog
      v-model="wipeVisible"
      class="wipe-confirm-dlg"
      width="480px"
      align-center
      append-to-body
      destroy-on-close
    >
      <template #header>
        <div class="wipe-head">
          <span class="wipe-head-mark" aria-hidden="true">
            <el-icon><WarningFilled /></el-icon>
          </span>
          <span class="wipe-head-title">清数据启动</span>
        </div>
      </template>
      <div v-if="wipeTarget" class="wipe-body">
        <div class="wipe-device">
          <span class="wipe-device-icon" aria-hidden="true">
            <el-icon><Iphone /></el-icon>
          </span>
          <div class="wipe-device-main">
            <div class="wipe-device-name">{{ wipeTarget.name }}</div>
            <div class="wipe-device-sub">{{ wipePlatformLabel }} · 执行设备</div>
          </div>
          <div class="wipe-device-eta">
            <div class="wipe-eta-num">{{ wipeEta }}</div>
            <div class="wipe-eta-cap">预计耗时</div>
          </div>
        </div>
        <div class="wipe-banner">
          <el-icon class="wipe-banner-icon"><WarningFilled /></el-icon>
          <p>
            设备将<strong>恢复出厂设置并重启</strong>，所有 App 数据会被清除
          </p>
        </div>
        <ul class="wipe-points">
          <li>适合需要完全干净环境的场景，比关机再开更彻底</li>
          <li>开完机后这台会重新进入设备池，可以接着派任务或借用</li>
          <li>此操作<strong>不可撤销</strong>，请确认设备上无重要测试数据</li>
        </ul>
      </div>
      <template #footer>
        <el-button @click="wipeVisible = false">取消</el-button>
        <el-button type="primary" :loading="wipeConfirming" @click="confirmWipe">
          <el-icon class="wipe-confirm-ico"><RefreshRight /></el-icon>
          确认清数据启动
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Iphone, Monitor, MoreFilled, Refresh, RefreshRight, WarningFilled } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { usePagePaneActive } from '@/utils/pagePane'
import { isSupportedDevicePlatform, normalizePlatform, platformUiLabel } from '@/utils/platform'
import { isEmulatorDevice } from '@/utils/deviceKind'
import { useDeviceOccupancy } from '@/composables/useDeviceOccupancy'
import { canWrite } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const paneActive = usePagePaneActive()
const platformFilter = ref('')
const kindFilter = ref<'' | 'REAL' | 'EMU'>('')
const poolLoading = ref(false)

const { of: occupancyOf, isMine, remainText, load: loadOccupancy, start: startOccupancy } =
  useDeviceOccupancy()

type AvdRow = {
  name: string
  state: string
  deviceId?: string | null
  startedAt?: string | null
  elapsedSeconds?: number | null
  message?: string | null
  busy?: boolean
  occupiedBy?: string | null
  platform?: string
  version?: string | null
}

const emuOverview = ref({
  emulatorCliAvailable: true,
  runningCount: 0,
  maxRunning: 4,
  hint: '' as string | null,
  avds: [] as AvdRow[]
})
const emuUnmatched = ref<string[]>([])
const avdActing = ref<Record<string, boolean>>({})
let emuTimer: number | undefined

const emuAtCap = computed(
  () => emuOverview.value.runningCount >= emuOverview.value.maxRunning
)

type PoolRow = {
  id: string
  name: string
  platform: string
  version?: string
  status: string
  lastSeen?: string | number
  environment?: string
  isEmulator?: boolean
  emulator?: boolean
  disabled?: boolean
  avd?: AvdRow
  catalogOnly?: boolean
}

const poolDevices = ref<PoolRow[]>([])
const poolRows = computed<PoolRow[]>(() => poolDevices.value)

function rowStatusText(row: PoolRow) {
  const s = row.avd ? avdState(row.avd) : ''
  if (s === 'BOOTING') return '开机中'
  if (s === 'FAILED') return '启动失败'
  return isConnected(row.status) || s === 'READY' ? '已连接' : '未连接'
}

function rowStatusType(row: PoolRow): 'success' | 'warning' | 'danger' | 'info' {
  const s = row.avd ? avdState(row.avd) : ''
  if (s === 'BOOTING') return 'warning'
  if (s === 'FAILED') return 'danger'
  return isConnected(row.status) || s === 'READY' ? 'success' : 'info'
}

function displayName(row: PoolRow) {
  return String(row.name || row.id || '').replace(/（模拟器）$/, '').trim()
}

/** 开机后列表名变成 sdk_gphone64，把 AVD 名挂在下面，免得以为是两台 */
function avdAlias(row: PoolRow) {
  const name = String(row.avd?.name || '').trim()
  if (!name || name === displayName(row)) return ''
  return name
}

function isAvdBusy(name: string) {
  return !!avdActing.value[name]
}

function avdState(avd: AvdRow) {
  return String(avd.state || 'NOT_RUNNING').toUpperCase()
}

function asPoolRow(raw: Record<string, any>): PoolRow {
  const avd = raw.avd && typeof raw.avd === 'object' ? (raw.avd as AvdRow) : undefined
  return {
    id: String(raw.id || ''),
    name: raw.name || raw.id || '',
    platform: raw.platform || '',
    version: raw.version || raw.avd?.version,
    status: raw.status || 'DISCONNECTED',
    lastSeen: raw.lastSeen,
    environment: raw.environment,
    isEmulator: raw.isEmulator === true || raw.emulator === true,
    emulator: raw.emulator,
    disabled: raw.disabled === true,
    avd,
    catalogOnly: raw.catalogOnly === true
  }
}

async function loadPool() {
  try {
    const res = await apiClient.getDevicePool()
    const rows = Array.isArray(res.devices) ? res.devices.map(asPoolRow) : []
    poolDevices.value = rows
    const avds = rows.map((r) => r.avd).filter((a): a is AvdRow => !!a)
    emuOverview.value = {
      emulatorCliAvailable: res.emulatorCliAvailable !== false,
      runningCount: res.runningCount || 0,
      maxRunning: res.maxRunning || 4,
      hint: res.hint || '',
      avds
    }
    emuUnmatched.value = Array.isArray(res.runningUnmatched) ? res.runningUnmatched : []
  } catch {
    /* 主控机没有模拟器命令时别挡整页 */
  } finally {
    poolLoading.value = false
  }
}

function scheduleEmuPoll() {
  if (emuTimer) window.clearTimeout(emuTimer)
  const booting = emuOverview.value.avds.some((a) => avdState(a) === 'BOOTING')
  emuTimer = window.setTimeout(async () => {
    await loadPool()
    scheduleEmuPoll()
  }, booting ? 3000 : 10000)
}

const wipeVisible = ref(false)
const wipeConfirming = ref(false)
const wipeTarget = ref<AvdRow | null>(null)
const wipeMode = ref<'start' | 'restart'>('start')

const wipePlatformLabel = computed(() => {
  const p = String(wipeTarget.value?.platform || '').toUpperCase()
  if (p === 'IOS') return 'iOS 模拟器'
  return 'Android 模拟器'
})

const wipeEta = computed(() => {
  const p = String(wipeTarget.value?.platform || '').toUpperCase()
  return p === 'IOS' ? '20~40s' : '30~60s'
})

function openWipeDialog(avd: AvdRow, mode: 'start' | 'restart') {
  wipeTarget.value = avd
  wipeMode.value = mode
  wipeVisible.value = true
}

async function confirmWipe() {
  const avd = wipeTarget.value
  if (!avd) return
  wipeConfirming.value = true
  try {
    wipeVisible.value = false
    if (wipeMode.value === 'restart') {
      await runWipeRestart(avd)
    } else {
      await runStartAvd(avd, true)
    }
  } finally {
    wipeConfirming.value = false
  }
}

async function startAvd(avd: AvdRow, wipeData: boolean) {
  if (wipeData) {
    openWipeDialog(avd, 'start')
    return
  }
  await runStartAvd(avd, false)
}

async function runStartAvd(avd: AvdRow, wipeData: boolean) {
  avdActing.value = { ...avdActing.value, [avd.name]: true }
  try {
    const res = await apiClient.startEmulator(avd.name, wipeData)
    ElMessage.success(res.message || '已开始启动，开完机会自己出现在设备池里')
    await loadPool()
    scheduleEmuPoll()
  } catch (e: any) {
    ElMessage.warning(e?.message || '启动失败')
  } finally {
    avdActing.value = { ...avdActing.value, [avd.name]: false }
  }
}

async function stopAvd(avd: AvdRow) {
  if (avdState(avd) === 'READY') {
    try {
      await ElMessageBox.confirm(
        `关掉「${avd.name}」之后，排队任务就看不见它了，下次冷启动要 30～60 秒。只在腾内存或卡死时关。`,
        '关闭模拟器',
        { type: 'warning', confirmButtonText: '关闭', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  avdActing.value = { ...avdActing.value, [avd.name]: true }
  try {
    const res = await apiClient.stopEmulator(avd.name)
    ElMessage.success(res.message || '已关闭')
    await loadPool()
  } catch (e: any) {
    ElMessage.warning(e?.message || '关闭失败')
  } finally {
    avdActing.value = { ...avdActing.value, [avd.name]: false }
  }
}

async function wipeAvd(avd: AvdRow) {
  openWipeDialog(avd, 'restart')
}

async function runWipeRestart(avd: AvdRow) {
  avdActing.value = { ...avdActing.value, [avd.name]: true }
  try {
    if (avdState(avd) === 'READY' || avdState(avd) === 'BOOTING') {
      await apiClient.stopEmulator(avd.name)
    }
    const res = await apiClient.startEmulator(avd.name, true)
    ElMessage.success(res.message || '已开始清数据启动')
    await loadPool()
    scheduleEmuPoll()
  } catch (e: any) {
    ElMessage.warning(e?.message || '清数据失败')
  } finally {
    avdActing.value = { ...avdActing.value, [avd.name]: false }
  }
}

type PoolFilter = 'ALL' | 'IDLE' | 'BUSY' | 'MINE'
const poolFilter = ref<PoolFilter>('ALL')

const deviceClassOptions = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' }
] as const

function isEmuRow(d: PoolRow) {
  return isEmulatorDevice(d) || !!d.avd || !!d.catalogOnly
}

function matchesPoolFilter(d: PoolRow) {
  if (poolFilter.value === 'IDLE') {
    return !d.catalogOnly && isConnected(d.status) && !d.disabled && !occupancyOf(d.id)
  }
  if (poolFilter.value === 'BUSY') return !d.catalogOnly && !!occupancyOf(d.id)
  if (poolFilter.value === 'MINE') return !d.catalogOnly && isMine(d.id)
  return true
}

function matchesPlatform(d: PoolRow) {
  return !platformFilter.value || normalizePlatform(d.platform) === platformFilter.value
}

function matchesKind(d: PoolRow) {
  if (kindFilter.value === 'REAL') return !isEmuRow(d)
  if (kindFilter.value === 'EMU') return isEmuRow(d)
  return true
}

function togglePlatform(p: string) {
  platformFilter.value = platformFilter.value === p ? '' : p
}

function toggleKind(k: 'REAL' | 'EMU') {
  kindFilter.value = kindFilter.value === k ? '' : k
}

function platClass(p: string) {
  const n = normalizePlatform(p)
  if (n === 'ANDROID') return 'is-android'
  if (n === 'HARMONYOS') return 'is-harmony'
  return 'is-ios'
}

function occClass(deviceId: string) {
  const k = occupancyOf(deviceId)?.kind
  if (k === 'MANUAL') return 'is-warn'
  if (k === 'RECORD') return 'is-ok'
  return 'is-info'
}

function occTip(deviceId: string) {
  const o = occupancyOf(deviceId)
  if (!o) return ''
  const who = o.label || o.refId || ''
  const remain = remainText(deviceId)
  return [o.describe || who, remain].filter(Boolean).join(' · ')
}

function statusTip(row: PoolRow) {
  if (row.avd?.state === 'BOOTING' && row.avd.elapsedSeconds != null) {
    return '已开机 ' + row.avd.elapsedSeconds + ' 秒'
  }
  if (row.catalogOnly) return ''
  const seen = formatLastSeen(row.lastSeen)
  return seen === '—' ? '' : '最后可见 ' + seen
}

function canBorrow(row: PoolRow) {
  return !row.catalogOnly && isConnected(row.status) && !row.disabled && !occupancyOf(row.id)
}

function onMore(row: PoolRow, cmd: string) {
  if (cmd === 'renew') void renew(row)
  else if (cmd === 'record') goRecord(row)
  else if (cmd === 'stopAvd' && row.avd) void stopAvd(row.avd)
  else if (cmd === 'detail') onRowClick(row)
  else if (cmd === 'toggle') {
    row.disabled = !row.disabled
    void toggleDisabled(row, row.disabled)
  }
}

function canRecord(row: PoolRow) {
  if (!row.id || String(row.id).startsWith('avd:')) return false
  const ready = !!row.avd && avdState(row.avd) === 'READY'
  if (row.catalogOnly && !ready) return false
  if (!isEmulatorDevice(row) && !row.avd) return false
  return isConnected(row.status) || ready
}

function goRecord(row: PoolRow) {
  router.push({
    path: '/ui-record',
    query: { deviceId: row.id, platform: row.platform }
  })
}

const scopedRows = computed(() => poolRows.value.filter((d) => matchesPlatform(d) && matchesKind(d)))

const poolCounts = computed(() => {
  let idle = 0
  let busy = 0
  let mine = 0
  for (const d of scopedRows.value) {
    if (d.catalogOnly) continue
    if (isMine(d.id)) mine += 1
    if (occupancyOf(d.id)) busy += 1
    else if (isConnected(d.status) && !d.disabled) idle += 1
  }
  return { idle, busy, mine }
})

const statusOptions = computed<{ value: PoolFilter; label: string; count: number }[]>(() => [
  { value: 'ALL', label: '全部', count: scopedRows.value.length },
  { value: 'IDLE', label: '空闲', count: poolCounts.value.idle },
  { value: 'BUSY', label: '占用中', count: poolCounts.value.busy },
  { value: 'MINE', label: '我借的', count: poolCounts.value.mine }
])

/** 平台和真机/模拟器两组可叠加；每组的数字只受另一组和状态影响，点了不会把自己数成 0 */
const scopeCounts = computed(() => {
  const counts = { platformAll: 0, kindAll: 0, ANDROID: 0, IOS: 0, HARMONYOS: 0, real: 0, emu: 0 }
  for (const d of poolRows.value) {
    if (!matchesPoolFilter(d)) continue
    if (matchesKind(d)) {
      counts.platformAll += 1
      const p = normalizePlatform(d.platform)
      if (p === 'ANDROID' || p === 'IOS' || p === 'HARMONYOS') counts[p] += 1
    }
    if (matchesPlatform(d)) {
      counts.kindAll += 1
      if (isEmuRow(d)) counts.emu += 1
      else counts.real += 1
    }
  }
  return counts
})

const androidAvdNames = computed(() => {
  const names = new Set<string>()
  for (const r of poolDevices.value) {
    if (normalizePlatform(r.platform) !== 'ANDROID') continue
    if (r.avd?.name) names.add(r.avd.name)
  }
  return [...names]
})

const visibleDevices = computed(() => scopedRows.value.filter(matchesPoolFilter))

const page = ref(1)
const pageSize = ref(10)

const pagedDevices = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return visibleDevices.value.slice(start, start + pageSize.value)
})

watch([poolFilter, platformFilter, kindFilter], () => {
  page.value = 1
})

/** 轮询刷新后行数变少时，别停在一页空白上 */
watch(
  () => visibleDevices.value.length,
  (n) => {
    const last = Math.max(1, Math.ceil(n / pageSize.value))
    if (page.value > last) page.value = last
  }
)

async function borrow(row: any) {
  try {
    const res = await apiClient.reserveDevice(row.id)
    ElMessage.success(res?.message || '已借用。可在流程编排里用这台做真机点选。')
  } catch (e: any) {
    ElMessage.warning(e?.message || '借用失败')
  } finally {
    await loadOccupancy()
  }
}

async function giveBack(row: any) {
  try {
    const res = await apiClient.releaseDevice(row.id)
    ElMessage[res?.released ? 'success' : 'warning'](res?.message || '已归还')
  } catch (e: any) {
    ElMessage.error(e?.message || '归还失败')
  } finally {
    await loadOccupancy()
  }
}

async function renew(row: any) {
  try {
    const res = await apiClient.renewDevice(row.id)
    ElMessage[res?.renewed ? 'success' : 'warning'](res?.message || '已续借')
  } catch (e: any) {
    ElMessage.error(e?.message || '续借失败')
  } finally {
    await loadOccupancy()
  }
}

async function toggleDisabled(row: any, disabled: boolean) {
  try {
    const res = await apiClient.setDeviceDisabled(row.id, disabled)
    ElMessage.success(res?.message || (disabled ? '已停用' : '已恢复'))
  } catch (e: any) {
    row.disabled = !disabled
    ElMessage.error(e?.message || '操作失败')
  }
}

/**
 * 保存设备绑定的环境。
 *
 * 就地改 row 而不是整表刷新：刷新会重排/闪一下，人刚点完就被打断。
 * 保存失败再回滚——乐观更新的代价必须是「失败要退回去」，否则界面会跟数据库不一致。
 */
async function saveEnvironment(row: any, value: string) {
  const before = row.environment || ''
  row.environment = value
  try {
    await apiClient.setDeviceEnvironment(row.id, value)
    ElMessage.success(value ? `已绑定到${value === 'PROD' ? '线上' : '测试'}` : '已取消绑定')
  } catch (e: any) {
    row.environment = before
    ElMessage.error(e?.message || '保存失败')
  }
}

function platformLabel(p: string) {
  return platformUiLabel(p)
}

function isConnected(status: string) {
  return (status || '').toUpperCase() === 'CONNECTED'
}

function deviceStatusText(status: string) {
  return isConnected(status) ? '已连接' : '未连接'
}

function deviceStatusType(status: string) {
  return isConnected(status) ? 'success' : 'info'
}

function formatLastSeen(val: string | number | undefined) {
  if (val == null || val === '') return '—'
  const date = typeof val === 'string' ? new Date(val) : new Date(Number(val))
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

function onRowClick(row: PoolRow) {
  if (!row?.id || row.catalogOnly) return
  router.push({ name: 'DeviceDetail', params: { id: row.id } })
}

onMounted(() => {
  const platform = route.query.platform as string
  const u = platform?.toUpperCase() || ''
  if (u && isSupportedDevicePlatform(u)) {
    platformFilter.value = u
  }
  startOccupancy()
  poolLoading.value = true
  void loadPool().then(scheduleEmuPoll)
})

onBeforeUnmount(() => {
  if (emuTimer) window.clearTimeout(emuTimer)
})

/** 刷新：先触发后端扫描，再拉设备池页那一张表 */
const refreshDevices = async () => {
  poolLoading.value = true
  try {
    try {
      await apiClient.scanDevices()
    } catch (e) {
      console.warn('Scan devices failed:', e)
    }
    await Promise.all([loadOccupancy(), loadPool()])
    ElMessage.success('刷新成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  } finally {
    poolLoading.value = false
  }
}

const connectDevice = async (deviceId: string) => {
  try {
    await apiClient.connectDevice(deviceId)
    await loadPool()
    ElMessage.success('连接成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '连接失败')
  }
}

const disconnectDevice = async (deviceId: string) => {
  try {
    await apiClient.disconnectDevice(deviceId)
    await loadPool()
    ElMessage.success('断开成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '断开失败')
  }
}
</script>

<style scoped>
.devices {
  width: 100%;
}

.pool-panel {
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}
.pool-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.filter-label {
  width: 28px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: none;
}

.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.seg-item {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 12px;
  font: inherit;
  font-size: 13px;
  color: var(--app-text-regular);
  cursor: pointer;
}
.seg-item b {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color-dark);
  color: var(--app-text-regular);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.seg-item.is-idle b {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.seg-item.on {
  background: #fff;
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.seg-item.on b {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.seg-item.is-idle.on b {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.filter-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.filter-meta b {
  color: var(--app-text);
}
.filter-meta .full,
.filter-meta .full b {
  color: var(--el-color-warning);
  font-weight: 600;
}
.meta-sep {
  width: 1px;
  height: 12px;
  background: var(--el-fill-color-dark);
}

.chip {
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  border-radius: 999px;
  padding: 3px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--app-text-regular);
  cursor: pointer;
}
.chip b {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color-dark);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.chip.on {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.chip.on b {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}
.emu-hint {
  margin: 0;
}
.emu-unmatched {
  font-size: 12px;
  color: var(--el-color-warning);
  line-height: 1.5;
}
.emu-find {
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.6;
}
.emu-find b {
  color: var(--app-text-primary);
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dev-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 15px;
}
.dev-icon.emu {
  background: #f5e8ff;
  color: #722ed1;
}
.name-main {
  min-width: 0;
}
.dev-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.off-tag {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-size: 11px;
  font-weight: 400;
}
.emu-id {
  margin-top: 2px;
  font-size: 11px;
  color: var(--app-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.plat-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.plat-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--el-fill-color-light);
  color: var(--app-text-regular);
}
.plat-tag.is-android {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.plat-tag.is-harmony {
  background: #f5e8ff;
  color: #722ed1;
}
.emu-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.version-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--app-text-regular);
}

.env-select {
  width: 110px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}
.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-pill.is-success {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.status-pill.is-warning {
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.status-pill.is-danger {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.occ-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
.occ-tag.is-warn {
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.occ-tag.is-ok {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.occ-tag.is-info {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.row-ops {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.row-ops .el-button + .el-button {
  margin-left: 6px;
}
.op-strong {
  color: var(--app-text);
}
.more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.more-btn:hover {
  background: var(--el-fill-color-light);
  color: var(--app-text);
}

.pool-pager {
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table .cell) {
  line-height: 23px;
}

.pool-table :deep(.el-table__cell) {
  padding: 10px 0;
}
.pool-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
</style>

<style>
.wipe-confirm-dlg.el-dialog {
  border-radius: 16px;
  overflow: hidden;
}
.wipe-confirm-dlg .el-dialog__header {
  margin: 0;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.wipe-confirm-dlg .el-dialog__body {
  padding: 16px 20px 8px;
}
.wipe-confirm-dlg .el-dialog__footer {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.wipe-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 28px;
}
.wipe-head-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff4e5;
  color: var(--el-color-warning);
  font-size: 18px;
  flex: none;
}
.wipe-head-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.wipe-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wipe-device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}
.wipe-device-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 20px;
  flex: none;
}
.wipe-device-main {
  min-width: 0;
  flex: 1;
}
.wipe-device-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wipe-device-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.wipe-device-eta {
  flex: none;
  text-align: right;
}
.wipe-eta-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-warning);
  font-variant-numeric: tabular-nums;
}
.wipe-eta-cap {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.wipe-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  color: #c47b0a;
  font-size: 13px;
  line-height: 1.6;
}
.wipe-banner-icon {
  margin-top: 2px;
  font-size: 16px;
  flex: none;
}
.wipe-banner p {
  margin: 0;
}
.wipe-banner strong {
  font-weight: 700;
}
.wipe-points {
  margin: 0;
  padding: 0 0 0 18px;
  color: var(--app-text-regular);
  font-size: 13px;
  line-height: 1.8;
}
.wipe-points strong {
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.wipe-confirm-ico {
  margin-right: 4px;
}
</style>
