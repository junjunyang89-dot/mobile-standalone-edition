<template>
  <div class="performance">
    <el-row :gutter="16">
      <el-col :span="24">
        <el-card shadow="never" class="toolbar-card">
          <div class="toolbar">
            <div class="toolbar-left">
              <span class="title">性能监控 · 完美世界电竞</span>
              <el-select
                v-model="selectedTaskId"
                placeholder="选择性能任务查看结果"
                filterable
                clearable
                style="width: 360px"
                :loading="tasksLoading"
                @change="onTaskChange"
              >
                <el-option
                  v-for="t in taskOptions"
                  :key="t.id"
                  :label="taskOptionLabel(t)"
                  :value="t.id"
                />
              </el-select>
              <el-button :loading="tasksLoading" @click="loadTasks">刷新任务</el-button>
              <el-button type="primary" plain @click="router.push('/performance-baseline')">
                新建性能测试
              </el-button>
            </div>
            <div class="toolbar-right" v-if="selectedTask">
              <el-tag size="small" :type="statusTagType(selectedTask.status)">
                {{ statusText(selectedTask.status) }}
              </el-tag>
              <el-button
                v-if="report"
                type="warning"
                plain
                size="small"
                @click="analysisDialogVisible = true"
              >
                结果分析报告
              </el-button>
              <el-button link type="primary" @click="goOverview">任务详情报告</el-button>
              <el-button link type="primary" @click="router.push('/reports/esports/performance')">
                性能报告列表
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-alert
      v-if="report"
      class="read-guide"
      :type="verdict.alertType"
      :closable="false"
      show-icon
      style="margin-top: 16px"
    >
      <template #title>
        <div class="guide-title-row">
          <span>{{ verdict.title }}</span>
          <el-button type="primary" size="small" @click="analysisDialogVisible = true">
            打开结果分析报告
          </el-button>
        </div>
      </template>
      <div class="guide-body">
        <p>{{ verdict.summary }}</p>
        <ul>
          <li><b>问题合计为 0</b>：只表示自动规则没扫到「响应慢/卡顿/黑白块」这类标记，不等于体验完全正常。</li>
          <li><b>冷启动时 FPS 掉到很低</b>：启动闪屏阶段很常见；更要看墙钟耗时、内存是否暴涨、CPU 是否长时间顶满。</li>
          <li><b>怎么读曲线</b>：蓝=CPU，绿=内存，橙=FPS；内存一路爬升、FPS 长时间贴地才需要重点盯。</li>
        </ul>
      </div>
    </el-alert>

    <el-dialog
      v-model="analysisDialogVisible"
      title="结果分析报告"
      width="640px"
      append-to-body
      destroy-on-close
      class="analysis-dialog"
    >
      <template v-if="analysisReport">
        <el-alert
          :type="analysisReport.level"
          :closable="false"
          show-icon
          style="margin-bottom: 14px"
        >
          <template #title>{{ analysisReport.headline }}</template>
          {{ analysisReport.oneLiner }}
        </el-alert>

        <div class="analysis-section" v-for="sec in analysisReport.sections" :key="sec.title">
          <h4>{{ sec.title }}</h4>
          <ul>
            <li v-for="(line, i) in sec.lines" :key="i">{{ line }}</li>
          </ul>
        </div>

        <div class="analysis-section" v-if="stutterMoments.length">
          <h4>卡顿时刻明细</h4>
          <ul>
            <li v-for="(m, i) in stutterMoments" :key="i">
              第 {{ i + 1 }} 次：{{ m.timeText }}（{{ m.offsetText }}），卡顿占比 {{ m.jankText }}，
              FPS {{ m.fpsText }}，落在「{{ m.opText }}」
            </li>
          </ul>
        </div>

        <div
          class="analysis-section analysis-next-steps"
          v-if="analysisReport.nextSteps.length"
        >
          <h4>建议下一步</h4>
          <ol>
            <li v-for="(line, i) in analysisReport.nextSteps" :key="i">{{ line }}</li>
          </ol>
        </div>
      </template>
      <template #footer>
        <el-button type="primary" @click="analysisDialogVisible = false">知道了</el-button>
      </template>
    </el-dialog>

    <el-row :gutter="16" style="margin-top: 16px" v-loading="reportLoading">
      <el-col :span="6" v-for="card in summaryCards" :key="card.label">
        <el-card shadow="hover" class="metric-card" :class="card.tone">
          <div class="metric-label">{{ card.label }}</div>
          <div class="metric-value">{{ card.value }}</div>
          <div class="metric-sub">{{ card.sub }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="24">
        <el-card shadow="never" class="chart-card">
          <template #header>
            <div class="chart-header">
              <span class="chart-title">资源曲线</span>
              <el-radio-group v-model="chartMode" size="small" @change="renderCharts">
                <el-radio-button value="overview">总览</el-radio-button>
                <el-radio-button value="cpu">CPU</el-radio-button>
                <el-radio-button value="memory">内存</el-radio-button>
                <el-radio-button value="fps">FPS</el-radio-button>
                <el-radio-button value="temp">温度</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div v-if="!selectedTaskId" class="empty-hint">请选择一次已完成的性能任务，或先去创建并执行测试。</div>
          <div v-else-if="reportError" class="empty-hint">{{ reportError }}</div>
          <div v-else ref="chartContainer" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px" v-if="report">
      <el-col :span="12">
        <el-card shadow="never" class="panel-card issues-card">
          <template #header>
            <span class="panel-title">问题统计</span>
            <el-tag size="small" :type="issueTotal > 0 ? 'danger' : 'success'" effect="dark">
              {{ issueTotal > 0 ? `发现 ${issueTotal} 项` : '自动规则未命中' }}
            </el-tag>
          </template>
          <el-descriptions :column="2" border size="small" class="issue-desc">
            <el-descriptions-item label="响应时延">{{ report.issueSummary?.responseDelayCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="完成时延">{{ report.issueSummary?.completionDelayCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="卡顿">{{ report.issueSummary?.stutterCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="黑白块">{{ report.issueSummary?.blackWhiteBlockCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="问题合计">
              <span :class="issueTotal > 0 ? 'num-bad' : 'num-ok'">{{ issueTotal }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="总操作">{{ report.totalOperations ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="采集引擎">{{ report.collectorEngineUsed || '-' }}</el-descriptions-item>
          </el-descriptions>
          <p class="conclusion">{{ report.conclusion || '暂无结论' }}</p>
          <div v-if="stutterMoments.length" class="stutter-block">
            <div class="stutter-title">卡顿时刻（共 {{ stutterMoments.length }} 次）</div>
            <p class="stutter-hint">
              判定规则：采样点卡顿占比 ≥ {{ jankThreshold }}% 计 1 次（与后端一致）。「对应操作」按时间落在哪一步上估算。
            </p>
            <el-table :data="stutterMoments" size="small" stripe max-height="220">
              <el-table-column type="index" label="#" width="44" />
              <el-table-column prop="timeText" label="时间" width="100" />
              <el-table-column prop="offsetText" label="相对开始" width="100" />
              <el-table-column prop="jankText" label="卡顿占比" width="90" />
              <el-table-column prop="fpsText" label="当时 FPS" width="90" />
              <el-table-column prop="opText" label="对应操作" min-width="140" show-overflow-tooltip />
            </el-table>
          </div>
          <el-alert
            v-if="report.metricKitSummary"
            type="success"
            :closable="false"
            show-icon
            style="margin-top: 12px"
            title="已收到 MetricKit 上报"
          >
            <pre class="metrickit-preview">{{ metricKitPreview }}</pre>
          </el-alert>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <span class="panel-title">资源汇总</span>
          </template>
          <el-table :data="resourceSummaryRows" size="small" stripe empty-text="暂无汇总" class="resource-table">
            <el-table-column prop="name" label="指标" width="110">
              <template #default="{ row }">
                <span class="metric-chip" :class="row.tone">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="peak" label="峰值" />
            <el-table-column prop="min" label="最小" />
            <el-table-column prop="avg" label="平均" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { apiClient } from '@/api'

type PerfReport = Awaited<ReturnType<typeof apiClient.getPerformanceReport>>

const router = useRouter()
const route = useRoute()

const tasksLoading = ref(false)
const reportLoading = ref(false)
const taskOptions = ref<any[]>([])
const selectedTaskId = ref('')
const report = ref<PerfReport | null>(null)
const reportError = ref('')
const chartMode = ref<'overview' | 'cpu' | 'memory' | 'fps' | 'temp'>('overview')
const chartContainer = ref<HTMLDivElement>()
const analysisDialogVisible = ref(false)
/** 每个任务只自动弹一次分析，避免轮询/刷新反复打断 */
const analysisAutoOpenedFor = ref('')
let chartInstance: echarts.ECharts | null = null
let pollTimer: number | null = null

const selectedTask = computed(() => taskOptions.value.find((t) => t.id === selectedTaskId.value))

const statusText = (s?: string) =>
  ({ PENDING: '待执行', RUNNING: '运行中', COMPLETED: '已完成', FAILED: '失败', STOPPED: '已停止' } as Record<string, string>)[
    s || ''
  ] || s || '-'

const statusTagType = (s?: string) =>
  ({ PENDING: 'info', RUNNING: 'warning', COMPLETED: 'success', FAILED: 'danger', STOPPED: 'info' } as Record<string, string>)[
    s || ''
  ] || 'info'

const taskOptionLabel = (t: any) => {
  const name = t.name || t.taskName || t.id
  const kind = t.taskType === 'SCENARIO_PERFORMANCE_TEST' ? '场景' : '遍历'
  const scene = t.scenarioKey ? `/${t.scenarioKey}` : ''
  return `${name} · ${kind}${scene} · ${statusText(t.status)}`
}

const fmt = (n?: number | null, digits = 1) => {
  if (n == null || Number.isNaN(n)) return '-'
  return Number(n).toFixed(digits)
}

const issueTotal = computed(() => Number(report.value?.issueSummary?.totalIssueCount ?? 0))

/** 与后端 performance.jank-percent-threshold 默认一致 */
const jankThreshold = 16

const formatClock = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 从 resourceSamples 还原「哪几次」卡顿 */
const stutterMoments = computed(() => {
  const r = report.value
  if (!r) return [] as Array<{
    timeText: string
    offsetText: string
    jankText: string
    fpsText: string
    opText: string
    timestampMs: number
  }>
  const samples = (r.resourceSamples || []) as Array<{
    timestampMs?: number | null
    jankPercent?: number | null
    fps?: number | null
  }>
  const ops = (r.operations || []) as Array<{
    type?: string
    actionLabel?: string
    pageName?: string
    startTimeMs?: number | null
    endTimeMs?: number | null
  }>
  const t0 =
    samples.find((s) => s.timestampMs != null)?.timestampMs ??
    ops.find((o) => o.startTimeMs != null)?.startTimeMs ??
    null

  const findOp = (ts: number) => {
    if (!ops.length) return '（无操作明细，多为整段流程采样）'
    let best: (typeof ops)[0] | null = null
    for (const op of ops) {
      const a = op.startTimeMs ?? 0
      const b = op.endTimeMs ?? a
      if (ts >= a && ts <= b + 500) {
        best = op
        break
      }
      if (ts >= a) best = op
    }
    if (!best) return '未匹配到操作'
    const label = best.actionLabel || best.type || '操作'
    const page = best.pageName ? ` @ ${best.pageName}` : ''
    return `${label}${page}`
  }

  return samples
    .filter((s) => s.jankPercent != null && s.jankPercent >= jankThreshold && s.timestampMs != null)
    .map((s) => {
      const ts = s.timestampMs as number
      const offsetSec = t0 != null ? (ts - t0) / 1000 : null
      return {
        timestampMs: ts,
        timeText: formatClock(ts),
        offsetText: offsetSec != null ? `+${offsetSec.toFixed(1)}s` : '-',
        jankText: `${Number(s.jankPercent).toFixed(1)}%`,
        fpsText: s.fps != null ? Number(s.fps).toFixed(1) : '-',
        opText: findOp(ts)
      }
    })
})

const metricKitPreview = computed(() => {
  const mk = (report.value as any)?.metricKitSummary
  if (!mk) return ''
  try {
    return JSON.stringify(mk, null, 2).slice(0, 1200)
  } catch {
    return String(mk)
  }
})

const wallClockMs = computed(() => {
  const text = report.value?.conclusion || ''
  const m =
    text.match(/wall-clock time\s*([\d,]+)\s*ms/i) ||
    text.match(/墙钟[^\d]*([\d,]+)\s*ms/i) ||
    text.match(/耗时\s*([\d,]+)\s*ms/i)
  if (!m) return null
  return Number(String(m[1]).replace(/,/g, ''))
})

/** 人话解读：问题数=0 不等于完全没问题 */
const verdict = computed(() => {
  const rs = report.value?.resourceSummary
  const fpsMin = rs?.fps?.min
  const memPeakMb = rs?.memoryPss?.peak != null ? (rs.memoryPss.peak || 0) / 1024 : null
  const cpuPeak = rs?.cpuApp?.peak
  const wall = wallClockMs.value
  const issues = issueTotal.value

  const notes: string[] = []
  if (wall != null && wall >= 8000) notes.push(`冷启动墙钟约 ${(wall / 1000).toFixed(1)} 秒，偏慢，建议和基线对比`)
  else if (wall != null) notes.push(`冷启动墙钟约 ${(wall / 1000).toFixed(1)} 秒`)
  if (fpsMin != null && fpsMin < 5) notes.push('启动过程中 FPS 曾掉到接近 0，闪屏阶段常见，看是否长时间贴地')
  if (memPeakMb != null && memPeakMb > 400) notes.push(`内存峰值 ${memPeakMb.toFixed(0)} MB，偏高`)
  if (cpuPeak != null && cpuPeak > 80) notes.push(`CPU 峰值 ${cpuPeak.toFixed(0)}%，偏高`)

  if (issues > 0) {
    return {
      alertType: 'error' as const,
      title: `自动检出 ${issues} 个体验问题，请优先看问题统计`,
      summary: notes.length ? notes.join('；') + '。' : '请结合曲线与操作明细进一步定位。'
    }
  }
  if (notes.some((n) => n.includes('偏慢') || n.includes('偏高'))) {
    return {
      alertType: 'warning' as const,
      title: '自动问题为 0，但指标上仍有值得留意的地方',
      summary: notes.join('；') + '。不等于「完全没问题」，建议建立基线后再比。'
    }
  }
  return {
    alertType: 'success' as const,
    title: '自动问题为 0，本次采样暂无明显红线',
    summary:
      (notes.length ? notes.join('；') + '。' : 'CPU/内存/温度看起来平稳。') +
      '问题合计只覆盖部分规则，冷启耗时仍建议人工看一眼。'
  }
})

/** 弹窗用：结构化结果分析（根据汇总 + 采样点趋势） */
const analysisReport = computed(() => {
  const r = report.value
  if (!r) return null
  const rs = r.resourceSummary
  const samples = (r.resourceSamples || []) as Array<{
    cpuPercent?: number | null
    memoryPssKb?: number | null
    fps?: number | null
  }>
  const wall = wallClockMs.value
  const wallSec = wall != null ? wall / 1000 : null
  const cpuPeak = rs?.cpuApp?.peak ?? null
  const cpuAvg = rs?.cpuApp?.avg ?? null
  const memPeakMb = rs?.memoryPss?.peak != null ? rs.memoryPss.peak / 1024 : null
  const memAvgMb = rs?.memoryPss?.avg != null ? rs.memoryPss.avg / 1024 : null
  const fpsAvg = rs?.fps?.avg ?? null
  const fpsMin = rs?.fps?.min ?? null
  const fpsPeak = rs?.fps?.peak ?? null
  const engine = (r as any).collectorEngineUsed || '-'
  const issues = issueTotal.value

  const cpuVals = samples.map((s) => s.cpuPercent).filter((v): v is number => v != null)
  const memVals = samples.map((s) => s.memoryPssKb).filter((v): v is number => v != null)
  let highCpuSecondsApprox = 0
  if (cpuVals.length >= 2) {
    // 粗估：连续高位采样点数 × 采样间隔约 2s
    const high = cpuVals.filter((v) => v >= 80).length
    highCpuSecondsApprox = high * 2
  }
  let memTrend = '样本偏少，趋势不明显'
  if (memVals.length >= 3) {
    const first = memVals.slice(0, Math.max(1, Math.floor(memVals.length / 3))).reduce((a, b) => a + b, 0) /
      Math.max(1, Math.floor(memVals.length / 3))
    const last =
      memVals.slice(-Math.max(1, Math.floor(memVals.length / 3))).reduce((a, b) => a + b, 0) /
      Math.max(1, Math.floor(memVals.length / 3))
    const deltaMb = (last - first) / 1024
    if (deltaMb > 30) memTrend = `后段内存明显高于前段（约 +${deltaMb.toFixed(0)} MB），符合启动加载资源`
    else if (deltaMb < -20) memTrend = `后段内存有回落（约 ${deltaMb.toFixed(0)} MB），说明高峰后有释放`
    else memTrend = '前后段内存变化不大，相对平稳'
  }

  const flags: string[] = []
  if (wallSec != null && wallSec >= 8) flags.push('wall_slow')
  if (cpuPeak != null && cpuPeak >= 150) flags.push('cpu_multi')
  else if (cpuPeak != null && cpuPeak >= 80) flags.push('cpu_high')
  if (memPeakMb != null && memPeakMb >= 400) flags.push('mem_high')
  if (fpsMin != null && fpsMin < 5) flags.push('fps_drop')
  if (fpsAvg != null && fpsMin != null && fpsPeak != null && fpsAvg >= 100 && fpsMin >= 100) {
    flags.push('fps_flat_high')
  }
  if (issues > 0) flags.push('auto_issues')

  let level: 'success' | 'warning' | 'error' | 'info' = 'success'
  let headline = '本次采样整体可解读，暂无明显红线'
  if (flags.includes('auto_issues')) {
    level = 'error'
    headline = `自动规则检出 ${issues} 个体验问题，请优先处理`
  } else if (flags.includes('wall_slow') || flags.includes('mem_high') || flags.includes('cpu_high') || flags.includes('cpu_multi')) {
    level = 'warning'
    headline = '自动问题为 0，但启动耗时/资源高峰值得留意'
  } else if (samples.length === 0) {
    level = 'info'
    headline = '有报告文案，但几乎没有资源采样点'
  }

  const oneLiner =
    wallSec != null
      ? `整段大约跑了 ${wallSec.toFixed(1)} 秒（墙钟）。以下从 CPU、内存、FPS 分项说明。`
      : '以下从 CPU、内存、FPS 分项说明；建议同机同包多跑几次建立基线。'

  const overviewLines = [
    `采集引擎：${engine}（实际生效，不是你下拉里选的「意向」）`,
    `采样点数：${samples.length} 个${samples.length < 3 ? '（偏少，曲线参考价值有限）' : ''}`,
    `自动体验问题：${issues}（为 0 只表示规则没命中，不等于体验完美）`,
    r.conclusion ? `系统结论：${r.conclusion}` : '系统结论：暂无'
  ]

  const wallLines: string[] = []
  if (wallSec == null) {
    wallLines.push('未解析到墙钟耗时；看上方「体验问题」卡片副标题或任务结论里是否有秒数。')
  } else if (wallSec >= 8) {
    wallLines.push(
      `墙钟约 ${wallSec.toFixed(1)} 秒：对冷启动来说偏慢，优先和上一版本/基线比，不要只看单次。`
    )
  } else if (wallSec >= 5) {
    wallLines.push(`墙钟约 ${wallSec.toFixed(1)} 秒：中等水平，建议固定机型多跑几次看波动。`)
  } else {
    wallLines.push(`墙钟约 ${wallSec.toFixed(1)} 秒：相对较快，可作基线参考。`)
  }

  const cpuLines: string[] = []
  if (cpuPeak == null) {
    cpuLines.push('没有 CPU 汇总数据。')
  } else {
    cpuLines.push(`峰值 ${fmt(cpuPeak)}%，平均 ${fmt(cpuAvg)}%。`)
    if (cpuPeak > 100) {
      cpuLines.push('超过 100% 通常表示多核合计（不是坏了），启动期冲高很常见。')
    }
    if (highCpuSecondsApprox >= 4) {
      cpuLines.push(`粗估有约 ${highCpuSecondsApprox} 秒处于高位（≥80%），关注「顶满持续多久」比单看峰值更有用。`)
    } else if (cpuPeak >= 80) {
      cpuLines.push('有明显高峰，但高位持续时间不长的话，冷启动阶段可以接受。')
    } else {
      cpuLines.push('CPU 高峰不突出。')
    }
  }

  const memLines: string[] = []
  if (memPeakMb == null) {
    memLines.push('没有内存汇总数据。')
  } else {
    memLines.push(`峰值约 ${memPeakMb.toFixed(1)} MB，平均约 ${memAvgMb != null ? memAvgMb.toFixed(1) : '-'} MB。`)
    memLines.push(memTrend + '。')
    if (memPeakMb >= 400) {
      memLines.push('峰值偏高，建议和同机历史对比；短任务里上涨不等于泄漏。')
    } else {
      memLines.push('冷启动后半段内存上涨多半是在加载资源，属常见形态。')
    }
  }

  const fpsLines: string[] = []
  if (fpsAvg == null) {
    fpsLines.push('没有 FPS 汇总；可看曲线是否为空。')
  } else {
    fpsLines.push(`平均 ${fmt(fpsAvg)}，最低 ${fmt(fpsMin)}，峰值 ${fmt(fpsPeak)}。`)
    if (flags.includes('fps_flat_high')) {
      fpsLines.push(
        '几乎一直贴在高帧（如 120），冷启动闪屏阶段本该更容易掉帧——更可能是采样口径偏乐观，别过度迷信这条 FPS。'
      )
      fpsLines.push('冷启动请优先看墙钟、CPU 高位时长、内存峰值。')
    } else if (flags.includes('fps_drop')) {
      fpsLines.push('出现过接近 0 的 FPS：闪屏阶段常见；若长时间贴地才需要重点盯。')
    } else {
      fpsLines.push('FPS 未见极端贴地，可结合曲线目视是否有明显凹陷。')
    }
  }

  const nextSteps = [
    '同机、同包、同流程再跑 2～3 次，看墙钟和峰值是否稳定。',
    '把本次墙钟 / CPU 峰值 / 内存峰值记下来，和下个版本对比。',
    '若要看业务路径性能，再加「仅性能测试」流程（例如进首页后再停几秒），比纯冷启动更有说服力。'
  ]
  if (engine === 'NONE' || samples.length === 0) {
    nextSteps.unshift('当前几乎无采样：Android 检查 SoloX/ADB；iOS 检查 Tidevice 是否已安装且系统版本支持。')
  }

  return {
    level,
    headline,
    oneLiner,
    sections: [
      { title: '一、总览', lines: overviewLines },
      { title: '二、墙钟（你体感等多久）', lines: wallLines },
      { title: '三、CPU', lines: cpuLines },
      { title: '四、内存', lines: memLines },
      { title: '五、FPS', lines: fpsLines }
    ],
    nextSteps
  }
})

const summaryCards = computed(() => {
  const rs = report.value?.resourceSummary
  const issues = issueTotal.value
  return [
    {
      label: 'CPU 峰值',
      value: rs?.cpuApp?.peak != null ? `${fmt(rs.cpuApp.peak)}%` : '-',
      sub: `平均 ${fmt(rs?.cpuApp?.avg)}%`,
      tone: 'tone-cpu'
    },
    {
      label: '内存峰值',
      value: rs?.memoryPss?.peak != null ? `${fmt((rs.memoryPss.peak || 0) / 1024, 1)} MB` : '-',
      sub: `平均 ${rs?.memoryPss?.avg != null ? fmt((rs.memoryPss.avg || 0) / 1024, 1) : '-'} MB`,
      tone: 'tone-mem'
    },
    {
      label: 'FPS 平均',
      value: rs?.fps?.avg != null ? fmt(rs.fps.avg, 1) : '-',
      sub: `最低 ${fmt(rs?.fps?.min)} / 峰值 ${fmt(rs?.fps?.peak)}`,
      tone: 'tone-fps'
    },
    {
      label: '体验问题',
      value: String(issues),
      sub:
        wallClockMs.value != null
          ? `卡顿 ${report.value?.issueSummary?.stutterCount ?? 0} · 墙钟 ${(wallClockMs.value / 1000).toFixed(1)}s`
          : `卡顿 ${report.value?.issueSummary?.stutterCount ?? 0}`,
      tone: issues > 0 ? 'tone-issue-bad' : 'tone-issue-ok'
    }
  ]
})

const resourceSummaryRows = computed(() => {
  const rs = report.value?.resourceSummary
  if (!rs) return []
  const rows: Array<{ name: string; peak: string; min: string; avg: string; tone: string }> = []
  if (rs.cpuApp) {
    rows.push({
      name: 'CPU(%)',
      peak: fmt(rs.cpuApp.peak),
      min: fmt(rs.cpuApp.min),
      avg: fmt(rs.cpuApp.avg),
      tone: 'tone-cpu'
    })
  }
  if (rs.memoryPss) {
    rows.push({
      name: '内存(MB)',
      peak: fmt((rs.memoryPss.peak || 0) / 1024, 1),
      min: fmt((rs.memoryPss.min || 0) / 1024, 1),
      avg: fmt((rs.memoryPss.avg || 0) / 1024, 1),
      tone: 'tone-mem'
    })
  }
  if (rs.fps) {
    rows.push({
      name: 'FPS',
      peak: fmt(rs.fps.peak),
      min: fmt(rs.fps.min),
      avg: fmt(rs.fps.avg),
      tone: 'tone-fps'
    })
  }
  if (rs.temperature) {
    rows.push({
      name: '温度(℃)',
      peak: fmt(rs.temperature.peak),
      min: fmt(rs.temperature.min),
      avg: fmt(rs.temperature.avg),
      tone: 'tone-temp'
    })
  }
  return rows
})

const COLOR = {
  cpu: '#2563eb',
  mem: '#16a34a',
  fps: '#ea580c',
  jank: '#dc2626',
  temp: '#db2777'
}

const lineSeries = (name: string, color: string, data: (number | null)[], yAxisIndex = 0, withArea = false) => ({
  name,
  type: 'line' as const,
  smooth: true,
  symbol: 'circle',
  symbolSize: 7,
  lineStyle: { width: 3, color },
  itemStyle: { color },
  areaStyle: withArea
    ? {
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: color + '66' },
            { offset: 1, color: color + '08' }
          ]
        }
      }
    : undefined,
  data,
  yAxisIndex
})

const ensureChart = async () => {
  await nextTick()
  if (!chartContainer.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartContainer.value)
  }
}

const renderCharts = async () => {
  const samples = report.value?.resourceSamples || []
  if (!samples.length) {
    chartInstance?.clear()
    return
  }
  await ensureChart()
  if (!chartInstance) return

  const xData = samples.map((s) => new Date(s.timestampMs).toLocaleTimeString())
  const cpu = samples.map((s) => (s.cpuPercent != null ? Number(s.cpuPercent.toFixed(1)) : null))
  const memMb = samples.map((s) =>
    s.memoryPssKb != null ? Number((s.memoryPssKb / 1024).toFixed(1)) : null
  )
  const fps = samples.map((s) => (s.fps != null ? Number(s.fps.toFixed(1)) : null))
  const temp = samples.map((s) =>
    s.temperatureTenthsC != null ? Number((s.temperatureTenthsC / 10).toFixed(1)) : null
  )

  const jankMarkPoints = samples
    .map((s, idx) => ({
      idx,
      jank: s.jankPercent,
      time: xData[idx]
    }))
    .filter((x) => x.jank != null && (x.jank as number) >= jankThreshold)
    .map((x) => ({
      name: '卡顿',
      coord: [x.time, cpu[x.idx] != null ? cpu[x.idx] : fps[x.idx] != null ? fps[x.idx] : 0],
      value: `${Number(x.jank).toFixed(0)}%`,
      itemStyle: { color: COLOR.jank }
    }))

  const mode = chartMode.value
  let series: EChartsOption['series'] = []
  let yAxis: EChartsOption['yAxis'] = { type: 'value' }
  let legend: string[] = []

  if (mode === 'overview') {
    legend = ['CPU(%)', '内存(MB)', 'FPS']
    yAxis = [
      { type: 'value', name: 'CPU/FPS', position: 'left', splitLine: { lineStyle: { color: '#eef2f7' } } },
      { type: 'value', name: '内存(MB)', position: 'right', splitLine: { show: false } }
    ]
    const cpuSeries = {
      ...lineSeries('CPU(%)', COLOR.cpu, cpu, 0, true),
      markPoint:
        jankMarkPoints.length > 0
          ? {
              symbol: 'pin',
              symbolSize: 42,
              label: { color: '#fff', fontSize: 10 },
              data: jankMarkPoints
            }
          : undefined
    }
    series = [
      cpuSeries,
      lineSeries('内存(MB)', COLOR.mem, memMb, 1, true),
      lineSeries('FPS', COLOR.fps, fps, 0, false)
    ]
  } else if (mode === 'cpu') {
    legend = ['CPU(%)']
    series = [lineSeries('CPU(%)', COLOR.cpu, cpu, 0, true)]
  } else if (mode === 'memory') {
    legend = ['内存(MB)']
    series = [lineSeries('内存(MB)', COLOR.mem, memMb, 0, true)]
  } else if (mode === 'fps') {
    legend = ['FPS', '卡顿占比(%)']
    const jank = samples.map((s) => (s.jankPercent != null ? Number(s.jankPercent.toFixed(1)) : null))
    yAxis = [
      { type: 'value', name: 'FPS', position: 'left', splitLine: { lineStyle: { color: '#eef2f7' } } },
      { type: 'value', name: '卡顿%', position: 'right', splitLine: { show: false } }
    ]
    const jankPins = samples
      .map((s, idx) => ({ idx, jank: s.jankPercent }))
      .filter((x) => x.jank != null && (x.jank as number) >= jankThreshold)
      .map((x) => ({
        name: '卡顿',
        coord: [xData[x.idx], Number(x.jank)],
        value: `${Number(x.jank).toFixed(0)}%`,
        itemStyle: { color: COLOR.jank }
      }))
    const jankSeries = {
      ...lineSeries('卡顿占比(%)', COLOR.jank, jank, 1, false),
      markPoint:
        jankPins.length > 0
          ? { symbol: 'pin', symbolSize: 40, label: { color: '#fff', fontSize: 10 }, data: jankPins }
          : undefined
    }
    series = [lineSeries('FPS', COLOR.fps, fps, 0, true), jankSeries]
  } else {
    legend = ['温度(℃)']
    series = [lineSeries('温度(℃)', COLOR.temp, temp, 0, true)]
  }

  const option: EChartsOption = {
    color: [COLOR.cpu, COLOR.mem, COLOR.fps, COLOR.jank, COLOR.temp],
    backgroundColor: '#fafcff',
    tooltip: { trigger: 'axis' },
    legend: {
      data: legend,
      textStyle: { color: '#334155', fontWeight: 600 }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLine: { lineStyle: { color: '#94a3b8' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis,
    series
  }
  chartInstance.setOption(option, true)
}

const loadReport = async (taskId: string) => {
  if (!taskId) {
    report.value = null
    reportError.value = ''
    chartInstance?.clear()
    return
  }
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await apiClient.getPerformanceReport(taskId)
    await renderCharts()
    const st = selectedTask.value?.status
    if (
      (st === 'COMPLETED' || st === 'FAILED' || st === 'STOPPED') &&
      analysisAutoOpenedFor.value !== taskId
    ) {
      analysisAutoOpenedFor.value = taskId
      analysisDialogVisible.value = true
    }
  } catch (e: any) {
    report.value = null
    analysisDialogVisible.value = false
    const msg = e?.message || '暂无性能报告'
    reportError.value =
      selectedTask.value?.status === 'RUNNING'
        ? '任务运行中，完成后自动刷新曲线…'
        : selectedTask.value?.status === 'PENDING'
          ? '任务尚未执行，请先运行测试'
          : msg.includes('404')
            ? '暂无性能报告数据（任务未完成或非性能测试）'
            : msg
    chartInstance?.clear()
  } finally {
    reportLoading.value = false
  }
}

const stopPoll = () => {
  if (pollTimer != null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

const startPollIfNeeded = () => {
  stopPoll()
  const st = selectedTask.value?.status
  if (st === 'RUNNING' || st === 'PENDING') {
    pollTimer = window.setInterval(async () => {
      await loadTasks(false)
      if (selectedTaskId.value) await loadReport(selectedTaskId.value)
      const cur = selectedTask.value?.status
      if (cur && cur !== 'RUNNING' && cur !== 'PENDING') stopPoll()
    }, 5000)
  }
}

const onTaskChange = async () => {
  await loadReport(selectedTaskId.value)
  startPollIfNeeded()
}

const loadTasks = async (autoSelect = true) => {
  tasksLoading.value = true
  try {
    const [scenario, baseline] = await Promise.all([
      apiClient.getTasks({ taskType: 'SCENARIO_PERFORMANCE_TEST' }, { page: 1, size: 50 }),
      apiClient.getTasks({ taskType: 'PERFORMANCE_BASELINE_TEST' }, { page: 1, size: 50 })
    ])
    const merged = [...(scenario?.content || []), ...(baseline?.content || [])]
    merged.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return tb - ta
    })
    taskOptions.value = merged
    if (autoSelect) {
      const qid = typeof route.query.taskId === 'string' ? route.query.taskId : ''
      if (qid && taskOptions.value.some((t) => t.id === qid)) {
        selectedTaskId.value = qid
      } else if (!selectedTaskId.value) {
        const preferred =
          taskOptions.value.find((t) => t.status === 'COMPLETED') ||
          taskOptions.value.find((t) => t.status === 'RUNNING') ||
          taskOptions.value[0]
        if (preferred) selectedTaskId.value = preferred.id
      }
      if (selectedTaskId.value) {
        await loadReport(selectedTaskId.value)
        startPollIfNeeded()
      }
    }
  } catch (e) {
    console.error(e)
    taskOptions.value = []
  } finally {
    tasksLoading.value = false
  }
}

const goOverview = () => {
  if (!selectedTaskId.value) return
  router.push({ name: 'TaskOverview', params: { id: selectedTaskId.value } })
}

const onResize = () => chartInstance?.resize()

onMounted(async () => {
  await loadTasks(true)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  stopPoll()
  window.removeEventListener('resize', onResize)
  chartInstance?.dispose()
  chartInstance = null
})

watch(
  () => route.query.taskId,
  async (qid) => {
    if (typeof qid === 'string' && qid && qid !== selectedTaskId.value) {
      selectedTaskId.value = qid
      await loadReport(qid)
      startPollIfNeeded()
    }
  }
)
</script>

<style scoped>
.performance {
  width: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  margin-right: 4px;
}

.read-guide :deep(.el-alert__content) {
  width: 100%;
}

.guide-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.guide-body {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
}

.analysis-section {
  margin-bottom: 14px;
}

.analysis-section h4 {
  margin: 0 0 6px;
  font-size: 14px;
  color: #0f172a;
}

.analysis-section ul,
.analysis-section ol {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}

.analysis-section li {
  margin: 3px 0;
}

.analysis-next-steps {
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%);
  border-left: 4px solid #f59e0b;
  box-shadow: inset 0 0 0 1px #fcd34d;
}

.analysis-next-steps h4 {
  color: #b45309;
}

.analysis-next-steps ol {
  color: #92400e;
}

.analysis-next-steps li::marker {
  color: #d97706;
  font-weight: 700;
}

.guide-body p {
  margin: 0 0 6px;
}

.guide-body ul {
  margin: 0;
  padding-left: 18px;
}

.guide-body li {
  margin: 2px 0;
}

.metric-card {
  min-height: 118px;
  border: none;
  border-radius: 12px;
  overflow: hidden;
}

.metric-card :deep(.el-card__body) {
  padding: 16px 18px;
}

.metric-card.tone-cpu {
  background: linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%);
  box-shadow: inset 0 0 0 1px #93c5fd;
}

.metric-card.tone-mem {
  background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%);
  box-shadow: inset 0 0 0 1px #86efac;
}

.metric-card.tone-fps {
  background: linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%);
  box-shadow: inset 0 0 0 1px #fdba74;
}

.metric-card.tone-issue-ok {
  background: linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%);
  box-shadow: inset 0 0 0 1px #6ee7b7;
}

.metric-card.tone-issue-bad {
  background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%);
  box-shadow: inset 0 0 0 1px #fca5a5;
}

.metric-label {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.metric-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
}

.tone-cpu .metric-value {
  color: #1d4ed8;
}

.tone-mem .metric-value {
  color: #15803d;
}

.tone-fps .metric-value {
  color: #c2410c;
}

.tone-issue-ok .metric-value {
  color: #047857;
}

.tone-issue-bad .metric-value {
  color: #b91c1c;
}

.metric-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.chart-card,
.panel-card {
  border-radius: 12px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-title,
.panel-title {
  font-weight: 700;
  color: #0f172a;
}

.issues-card :deep(.el-card__header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-box {
  width: 100%;
  height: 420px;
}

.empty-hint {
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.conclusion {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border-left: 4px solid #3b82f6;
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
}
.stutter-block {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.stutter-title {
  font-size: 13px;
  font-weight: 600;
  color: #b91c1c;
  margin-bottom: 4px;
}

.stutter-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
}

.num-ok {
  color: #047857;
  font-weight: 700;
}

.num-bad {
  color: #b91c1c;
  font-weight: 700;
}

.metric-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.metric-chip.tone-cpu {
  background: #dbeafe;
  color: #1d4ed8;
}

.metric-chip.tone-mem {
  background: #dcfce7;
  color: #15803d;
}

.metric-chip.tone-fps {
  background: #ffedd5;
  color: #c2410c;
}

.metric-chip.tone-temp {
  background: #fce7f3;
  color: #be185d;
}
</style>
