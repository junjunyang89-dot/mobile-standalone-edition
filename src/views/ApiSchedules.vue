<template>
  <div class="api-schedules">
    <Teleport v-if="paneActive" to="#page-header-actions">
      <el-button type="primary" @click="openCreate">
        <el-icon class="el-icon--left"><Plus /></el-icon>
        新建定时任务
      </el-button>
    </Teleport>

    <div class="hint-banner">
      <el-icon><InfoFilled /></el-icon>
      <span>
        定时任务按 Cron 表达式自动跑测试集合。到点按集合顺序执行并共享变量，结果写进执行报告——
        提测期间每天早上跑一轮，接口挂了当天就知道。
      </span>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-icon is-blue"><el-icon><List /></el-icon></div>
        <div class="kpi-body">
          <div class="kpi-label">任务总数</div>
          <div class="kpi-value">{{ rows.length }}</div>
          <div class="kpi-sub">已启用 {{ stats.enabled }} · 已暂停 {{ stats.paused }}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon is-red"><el-icon><WarningFilled /></el-icon></div>
        <div class="kpi-body">
          <div class="kpi-label">今日失败</div>
          <div class="kpi-value" :class="{ 'is-danger': stats.todayFail > 0 }">{{ stats.todayFail }}</div>
          <div class="kpi-sub">{{ stats.todayFailHint }}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon is-green"><el-icon><CircleCheckFilled /></el-icon></div>
        <div class="kpi-body">
          <div class="kpi-label">近7天成功率</div>
          <div class="kpi-value" :class="stats.rateClass">{{ stats.rateText }}</div>
          <div class="kpi-sub">{{ stats.rateHint }}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon is-blue"><el-icon><Clock /></el-icon></div>
        <div class="kpi-body">
          <div class="kpi-label">下次执行</div>
          <div class="kpi-value">{{ stats.nextTime }}</div>
          <div class="kpi-sub">{{ stats.nextHint }}</div>
        </div>
      </div>
    </div>

    <div class="list-panel">
      <div class="list-head">
        <div class="list-title">
          任务列表
          <span class="list-count">共 {{ filtered.length }} 条</span>
        </div>
        <div class="filters">
          <button
            v-for="f in FILTERS"
            :key="f.key"
            type="button"
            class="filter-btn"
            :class="{ active: filter === f.key }"
            @click="filter = f.key"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <el-empty v-if="!loading && !rows.length" description="还没有定时任务">
        <el-button type="primary" @click="openCreate">新建第一条</el-button>
      </el-empty>
      <el-empty v-else-if="!loading && !filtered.length" description="没有符合条件的任务" />

      <div v-loading="loading" class="task-list">
        <div
          v-for="s in filtered"
          :key="s.id"
          class="task-card"
          :class="cardClass(s)"
        >
          <div class="task-accent" />
          <div class="task-play" :class="statusClass(s)">
            <el-icon><VideoPlay v-if="s.enabled" /><VideoPause v-else /></el-icon>
          </div>
          <div class="task-main">
            <div class="task-title">
              <span class="task-name">{{ s.name }}</span>
              <el-tag v-if="!s.enabled" size="small" type="info" effect="plain">已暂停</el-tag>
              <el-tag v-else-if="s.lastStatus" size="small" :type="tagType(s.lastStatus)">
                {{ statusText(s.lastStatus) }}
              </el-tag>
              <el-tag v-if="s.environment === 'PROD'" size="small" type="danger" effect="plain">线上</el-tag>
              <span v-if="recentDots(s).length" class="run-dots">
                <span class="run-dots-label">近{{ recentDots(s).length }}次</span>
                <i
                  v-for="(d, i) in recentDots(s)"
                  :key="i"
                  class="dot"
                  :class="d"
                  :title="d === 'ok' ? '通过' : d === 'bad' ? '失败' : '异常'"
                />
              </span>
            </div>
            <div class="task-meta">
              <span class="cron-human">{{ cronLabel(s.cron) }}</span>
              <code>{{ s.cron }}</code>
              <span>{{ s.collectionName || '全部用例' }} · {{ s.caseCount ?? 0 }} 条</span>
            </div>
            <div class="task-last">
              <template v-if="s.lastRunAt">
                <el-button
                  v-if="s.lastRunId"
                  link
                  type="primary"
                  class="last-run"
                  @click="openReport(s.lastRunId)"
                >
                  上次 {{ fmt(s.lastRunAt) }}
                </el-button>
                <span v-else>上次 {{ fmt(s.lastRunAt) }}</span>
                <button type="button" class="expand-btn" @click="toggleDetail(s)">
                  {{ expandedId === s.id ? '收起详情 ↑' : '展开详情 ↓' }}
                </button>
              </template>
              <span v-else class="never">从未执行</span>
            </div>
            <div v-if="s.lastStatus === 'ERROR' && s.lastMessage && expandedId !== s.id" class="task-error">
              {{ s.lastMessage }}
            </div>
            <div v-if="expandedId === s.id" class="task-detail">
              <div v-if="s.lastMessage" class="detail-msg">{{ s.lastMessage }}</div>
              <div v-if="!s.lastRunId" class="detail-empty">这次没有落执行报告</div>
              <template v-else>
                <div v-if="detailOf(s)?.loading" class="detail-empty">加载失败用例…</div>
                <div v-else-if="detailOf(s)?.error" class="task-error">{{ detailOf(s)?.error }}</div>
                <template v-else>
                  <div class="detail-sum">
                    {{ detailOf(s)?.run?.passed ?? 0 }} 通过
                    · {{ detailOf(s)?.run?.failed ?? 0 }} 失败
                    <el-button link type="primary" @click="openReport(s.lastRunId)">查看完整报告</el-button>
                  </div>
                  <div
                    v-for="c in failedCases(s)"
                    :key="c.id"
                    class="fail-row"
                  >
                    <span class="fail-name">{{ c.name || c.path || '未命名用例' }}</span>
                    <span class="fail-err">{{ c.error || c.status }}</span>
                  </div>
                  <div v-if="detailOf(s) && !failedCases(s).length && !detailOf(s)?.loading" class="detail-empty">
                    没有失败用例
                  </div>
                </template>
              </template>
            </div>
          </div>
          <div class="task-side">
            <div class="next-block">
              <div class="next-label">下次执行</div>
              <div v-if="s.enabled" class="next-time">
                {{ fmt(s.nextRunAt) || '—' }}
                <span v-if="fromNow(s.nextRunAt)" class="next-rel">（{{ fromNow(s.nextRunAt) }}）</span>
              </div>
              <div v-else class="next-time is-paused">已暂停 <span class="next-rel">（启用后恢复）</span></div>
            </div>
            <div class="task-actions">
              <el-switch :model-value="!!s.enabled" @change="(v: boolean) => toggle(s, !!v)" />
              <el-button size="small" :loading="runningId === s.id" @click="runNow(s)">立即运行</el-button>
              <el-button size="small" @click="openEdit(s)">编辑</el-button>
              <el-button v-perm:delete size="small" type="danger" plain @click="remove(s)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialog" :title="form.id ? '编辑定时任务' : '新建定时任务'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 每日冒烟" />
        </el-form-item>
        <el-form-item label="cron" required>
          <el-input v-model="form.cron" placeholder="0 0 8 * * ?" />
          <div class="tip">
            <b>6 段格式</b>（秒 分 时 日 月 周），跟 Linux crontab 的 5 段不一样，照抄会报错。
            <div class="preset-row">
              <el-tag
                v-for="p in PRESETS"
                :key="p.cron"
                size="small"
                class="preset"
                @click="form.cron = p.cron"
              >
                {{ p.label }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="范围">
          <el-select v-model="form.collectionId" clearable placeholder="全部用例" style="width: 100%">
            <el-option
              v-for="c in collections"
              :key="c.id"
              :label="`${c.name}（${c.caseCount ?? 0} 条）`"
              :value="c.id"
            />
          </el-select>
          <div class="tip">
            选集合的话会按集合内的顺序跑并共享变量；不选则跑该项目下全部启用用例
          </div>
        </el-form-item>
        <el-form-item label="项目">
          <el-select v-model="form.project" clearable placeholder="全部项目" style="width: 100%">
            <el-option v-for="p in projects" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="环境">
          <el-radio-group v-model="form.environment">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
          <div v-if="form.environment === 'PROD'" class="tip warn">
            定时跑线上：任务一旦建好就会自动执行，不会再弹确认框。确认这些接口都是只读的。
          </div>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheckFilled,
  Clock,
  InfoFilled,
  List,
  Plus,
  VideoPause,
  VideoPlay,
  WarningFilled
} from '@element-plus/icons-vue'
import { apiClient } from '../api'
import { usePagePaneActive } from '../utils/pagePane'

const router = useRouter()
const paneActive = usePagePaneActive()

const PRESETS = [
  { label: '每天 8 点', cron: '0 0 8 * * ?' },
  { label: '每半小时', cron: '0 0/30 * * * ?' },
  { label: '工作日 23 点', cron: '0 0 23 ? * MON-FRI' },
  { label: '每周日 2 点', cron: '0 0 2 ? * SUN' }
]

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'on', label: '已启用' },
  { key: 'off', label: '已暂停' },
  { key: 'fail', label: '有失败' }
] as const

type FilterKey = (typeof FILTERS)[number]['key']

const rows = ref<any[]>([])
const collections = ref<any[]>([])
const projects = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const runningId = ref('')
const filter = ref<FilterKey>('all')
const expandedId = ref('')
const detailMap = ref<Record<string, { loading: boolean; run?: any; cases?: any[]; error?: string }>>({})

const form = ref<any>({
  id: '',
  name: '',
  cron: '0 0 8 * * ?',
  collectionId: '',
  project: '',
  environment: 'TEST',
  enabled: true
})

const filtered = computed(() => {
  return rows.value.filter((s) => {
    if (filter.value === 'on') return !!s.enabled
    if (filter.value === 'off') return !s.enabled
    if (filter.value === 'fail') return isFail(s.lastStatus)
    return true
  })
})

const stats = computed(() => {
  const list = rows.value
  const enabled = list.filter((s) => s.enabled).length
  const paused = list.length - enabled
  const todayFails = list.filter((s) => isFail(s.lastStatus) && isToday(s.lastRunAt))
  const firstFail = todayFails[0]
  // 没跑成（服务挂了/连不上）的那几次不进分母，否则通过率掉下去，人会去查用例而不是看服务
  const week = weekRuns(list).filter((r) => r.status !== 'BLOCKED')
  const passed = week.filter((r) => r.status === 'PASSED').length
  const next = list
    .filter((s) => s.enabled && s.nextRunAt)
    .slice()
    .sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))[0]
  return {
    enabled,
    paused,
    todayFail: todayFails.length,
    todayFailHint: firstFail
      ? `${firstFail.name} · ${hm(firstFail.lastRunAt)} 执行`
      : '今天还没有失败',
    rateText: week.length ? `${Math.round((passed / week.length) * 100)}%` : '—',
    rateHint: week.length ? `${passed} / ${week.length} 通过` : '近 7 天还没有执行',
    rateClass: week.length ? (passed / week.length >= 0.8 ? 'is-ok' : 'is-danger') : '',
    nextTime: next ? hm(next.nextRunAt) : '—',
    nextHint: next ? `${dayHint(next.nextRunAt)} · ${next.name}` : '没有启用中的任务'
  }
})

function isFail(status?: string | null) {
  return status === 'FAILED' || status === 'ERROR'
}

function isToday(iso?: string | null) {
  const d = parseTime(iso)
  if (!d) return false
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function parseTime(iso?: string | null) {
  if (!iso) return null
  const d = new Date(String(iso).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function weekRuns(list: any[]) {
  const since = Date.now() - 7 * 86400000
  const out: Array<{ status: string }> = []
  for (const s of list) {
    const recents = Array.isArray(s.recentRuns) && s.recentRuns.length
      ? s.recentRuns
      : s.lastStatus
        ? [{ status: s.lastStatus, at: s.lastRunAt }]
        : []
    for (const r of recents) {
      const t = parseTime(r.at)
      if (t && t.getTime() < since) continue
      if (!r.status) continue
      out.push({ status: r.status })
    }
  }
  return out
}

function hm(iso?: string | null) {
  const d = parseTime(iso)
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayHint(iso?: string | null) {
  const d = parseTime(iso)
  if (!d) return ''
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - start.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmt(s?: string | null) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function fromNow(iso?: string | null) {
  const d = parseTime(iso)
  if (!d) return ''
  const mins = Math.round((d.getTime() - Date.now()) / 60000)
  if (mins <= 0) return '即将执行'
  if (mins < 60) return `约 ${mins} 分钟后`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `约 ${hrs} 小时后`
  return `约 ${Math.round(hrs / 24)} 天后`
}

function cronLabel(cron?: string) {
  if (!cron) return ''
  const p = cron.trim().split(/\s+/)
  if (p.length !== 6) return cron
  const [, min, hour, day, month, week] = p
  if (min.startsWith('0/') || min.startsWith('*/')) {
    return `每 ${min.replace(/^0\//, '').replace('*/', '')} 分钟`
  }
  if (hour.startsWith('0/') || hour.startsWith('*/')) {
    return `每 ${hour.replace(/^0\//, '').replace('*/', '')} 小时`
  }
  if (!/^\d+$/.test(hour) || !/^\d+$/.test(min)) return cron
  const hhmm = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
  if (day === '*' && month === '*' && (week === '?' || week === '*')) return `每天 ${hhmm}`
  if (week === 'MON-FRI') return `工作日 ${hhmm}`
  const weekNames: Record<string, string> = {
    SUN: '每周日',
    MON: '每周一',
    TUE: '每周二',
    WED: '每周三',
    THU: '每周四',
    FRI: '每周五',
    SAT: '每周六'
  }
  if (weekNames[week]) return `${weekNames[week]} ${hhmm}`
  return cron
}

function recentDots(s: any): Array<'ok' | 'bad' | 'warn'> {
  const recents = Array.isArray(s.recentRuns) && s.recentRuns.length
    ? s.recentRuns
    : s.lastStatus
      ? [{ status: s.lastStatus }]
      : []
  return recents
    .slice()
    .reverse()
    .map((r: any) => {
      if (r.status === 'PASSED') return 'ok'
      if (r.status === 'FAILED') return 'bad'
      return 'warn'
    })
}

function cardClass(s: any) {
  if (!s.enabled) return 'is-paused'
  if (isFail(s.lastStatus)) return 'is-fail'
  if (s.lastStatus === 'BLOCKED') return 'is-blocked'
  return 'is-ok'
}

function statusClass(s: any) {
  if (!s.enabled) return 'paused'
  if (isFail(s.lastStatus)) return 'bad'
  if (s.lastStatus === 'BLOCKED') return 'blocked'
  return 'good'
}

function tagType(status: string) {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'warning'
}

function statusText(status: string) {
  if (status === 'PASSED') return '通过'
  if (status === 'FAILED') return '有失败'
  if (status === 'BLOCKED') return '没跑成'
  return '执行异常'
}

function detailOf(s: any) {
  return s.lastRunId ? detailMap.value[s.lastRunId] : undefined
}

function failedCases(s: any) {
  const cases = detailOf(s)?.cases
  if (!Array.isArray(cases)) return []
  return cases.filter((c) => c.status && c.status !== 'PASSED').slice(0, 8)
}

async function toggleDetail(s: any) {
  if (expandedId.value === s.id) {
    expandedId.value = ''
    return
  }
  expandedId.value = s.id
  if (!s.lastRunId || detailMap.value[s.lastRunId]) return
  detailMap.value[s.lastRunId] = { loading: true }
  try {
    const d = await apiClient.getApiTestRunDetail(s.lastRunId)
    detailMap.value[s.lastRunId] = { loading: false, run: d.run, cases: d.cases }
  } catch (e: any) {
    detailMap.value[s.lastRunId] = { loading: false, error: e?.message || '加载失败' }
  }
}

async function load() {
  loading.value = true
  try {
    const list = await apiClient.getApiTestSchedules()
    rows.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function loadRefs() {
  try {
    projects.value = await apiClient.getApiTestProjects()
    collections.value = await apiClient.getApiTestCollections()
  } catch {
    // 参考数据加载失败不挡主流程，下拉留空即可
  }
}

function openCreate() {
  form.value = {
    id: '',
    name: '',
    cron: '0 0 8 * * ?',
    collectionId: '',
    project: '',
    environment: 'TEST',
    enabled: true
  }
  dialog.value = true
}

function openEdit(s: any) {
  form.value = {
    id: s.id,
    name: s.name,
    cron: s.cron,
    collectionId: s.collectionId || '',
    project: s.project || '',
    environment: s.environment || 'TEST',
    enabled: s.enabled !== false
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name.trim() || !form.value.cron.trim()) {
    ElMessage.warning('名称和 cron 必填')
    return
  }
  saving.value = true
  try {
    const saved = await apiClient.saveApiTestSchedule({ ...form.value, id: form.value.id || undefined })
    dialog.value = false
    ElMessage.success(saved?.nextRunAt ? `已保存，下次 ${fmt(saved.nextRunAt)}` : '已保存')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(s: any, enabled: boolean) {
  try {
    await apiClient.setApiTestScheduleEnabled(s.id, enabled)
    ElMessage.success(enabled ? '已启用' : '已暂停')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

function openReport(runId: string) {
  router.push({ path: '/api-reports', query: { runId } })
}

async function runNow(s: any) {
  runningId.value = s.id
  try {
    const r = await apiClient.runApiTestScheduleNow(s.id)
    ElMessage[r?.ok ? 'success' : 'warning'](r?.message || '执行完成')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningId.value = ''
  }
}

async function remove(s: any) {
  try {
    await ElMessageBox.confirm(`删除定时任务「${s.name}」？`, '确认删除', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestSchedule(s.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([load(), loadRefs()])
})
</script>

<style scoped>
.api-schedules {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hint-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: #3d5a80;
  font-size: 13px;
  line-height: 1.6;
}
.hint-banner .el-icon {
  margin-top: 3px;
  color: var(--app-primary);
  flex: none;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.kpi-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 10px;
}
.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: none;
}
.kpi-icon.is-blue {
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
}
.kpi-icon.is-red {
  background: var(--el-color-danger-light-9);
  color: var(--app-danger);
}
.kpi-icon.is-green {
  background: var(--el-color-success-light-9);
  color: var(--app-success);
}
.kpi-body {
  min-width: 0;
}
.kpi-label {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.kpi-value {
  margin-top: 2px;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--app-text);
}
.kpi-value.is-danger {
  color: var(--app-danger);
}
.kpi-value.is-ok {
  color: var(--app-success);
}
.kpi-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.list-panel {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 16px 18px 18px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.list-title {
  font-size: 15px;
  font-weight: 600;
}
.list-count {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--app-text-secondary);
}
.filters {
  display: flex;
  gap: 4px;
}
.filter-btn {
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}
.filter-btn.active {
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
  font-weight: 600;
}

.task-list {
  min-height: 80px;
}
.task-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 16px 16px 16px 18px;
  margin-bottom: 10px;
  overflow: hidden;
}
.task-card:last-child {
  margin-bottom: 0;
}
.task-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--app-success);
}
.task-card.is-fail {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.task-card.is-fail .task-accent {
  background: var(--app-danger);
}
.task-card.is-blocked {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}
.task-card.is-blocked .task-accent {
  background: var(--el-color-warning);
}
.task-card.is-paused {
  background: var(--el-fill-color-lighter);
}
.task-card.is-paused .task-accent {
  background: #c0c4cc;
}
.task-card.is-ok .task-accent {
  background: var(--app-primary);
}

.task-play {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: none;
  margin-top: 2px;
}
.task-play.good {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.task-play.bad {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.task-play.blocked {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.task-play.paused {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.task-main {
  flex: 1;
  min-width: 0;
}
.task-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.task-name {
  font-size: 15px;
  font-weight: 600;
}
.run-dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 4px;
  color: var(--app-text-secondary);
  font-size: 12px;
}
.run-dots-label {
  margin-right: 2px;
}
.run-dots .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d9d9d9;
}
.run-dots .dot.ok {
  background: var(--app-success);
}
.run-dots .dot.bad {
  background: var(--app-danger);
}
.run-dots .dot.warn {
  background: var(--app-warning);
}

.task-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cron-human {
  color: var(--app-text);
  font-weight: 500;
}
.task-meta code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: #667085;
}
.task-last {
  margin-top: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.last-run {
  padding: 0;
  height: auto;
  font-size: 12px;
}
.expand-btn {
  border: none;
  background: none;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.never {
  color: var(--app-text-secondary);
}
.task-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
  line-height: 1.5;
}
.task-detail {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--app-border);
}
.detail-msg {
  font-size: 12px;
  color: var(--app-text);
  margin-bottom: 6px;
}
.detail-sum {
  font-size: 12px;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-empty {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.fail-row {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
}
.fail-name {
  flex: none;
  font-weight: 500;
}
.fail-err {
  color: var(--app-danger);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 220px;
}
.next-block {
  text-align: right;
}
.next-label {
  font-size: 11px;
  color: var(--app-text-secondary);
}
.next-time {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
}
.next-time.is-paused {
  color: var(--app-text-secondary);
}
.next-rel {
  font-weight: 400;
  color: var(--app-text-secondary);
}
.task-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.tip.warn {
  color: var(--el-color-warning);
}
.preset-row {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.preset {
  cursor: pointer;
}

@media (max-width: 1100px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .task-card {
    flex-wrap: wrap;
  }
  .task-side {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }
}
</style>
