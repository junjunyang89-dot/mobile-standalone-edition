<template>
  <div class="special-report">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">版本质量卡</span>
            <p class="card-sub">
              这个版本比上个版本，哪些指标退步了。<strong>绝对值给不出结论</strong> ——
              冷启动 1.2 秒是好是坏没人知道，「上版 0.9 秒、这版 1.2 秒」才是能拿去问开发的。
            </p>
          </div>
        </div>
      </template>

      <div class="filters">
        <el-select
          v-model="packageName"
          filterable
          allow-create
          placeholder="包名"
          style="width: 280px"
          @change="onPackageChange"
        >
          <el-option v-for="p in packages" :key="p.packageName" :label="`${p.name}（${p.packageName}）`" :value="p.packageName" />
        </el-select>
        <el-select v-model="platform" style="width: 120px" @change="loadVersions">
          <el-option label="Android" value="ANDROID" />
          <el-option label="iOS" value="IOS" />
        </el-select>
        <!-- allow-create：还没留过档时下拉是空的，不让手填就只能干瞪眼 -->
        <el-select
          v-model="versionName"
          filterable
          allow-create
          default-first-option
          :placeholder="versions.length ? '版本' : '还没有留档数据'"
          style="width: 180px"
          @change="load"
        >
          <el-option v-for="v in versions" :key="v" :label="v" :value="v" />
        </el-select>
        <el-select v-model="deviceModel" clearable placeholder="机型（不选=不区分）" style="width: 220px" @change="load">
          <el-option v-for="d in devices" :key="d.id" :label="d.name" :value="d.name" />
        </el-select>
        <el-button type="primary" :loading="loading" :disabled="!packageName || !versionName" @click="load">
          查询
        </el-button>
      </div>

      <!--
        下拉空 + 按钮灰，而且不说为什么，是最容易让人卡住的组合。
        直接把「为什么空、怎么才会有」讲清楚。
      -->
      <el-alert
        v-if="packageName && !versions.length && !loading"
        type="warning"
        :closable="false"
        class="tip"
        title="这个包还没有留档的版本"
      >
        <div class="empty-why">
          指标是<strong>跑性能测试时自动留档</strong>的，所以要先跑过至少一次才有版本可选。<br />
          版本号从设备上真实安装的包里读（<code>dumpsys package</code>），读不到就不留档 ——
          记成 unknown 的话，几次之后基线会指向一个混了好几个版本的 unknown，结论全是错的。<br />
          去「性能测试 → 安卓性能测试」跑一轮，回来这里就有了。
        </div>
      </el-alert>

      <el-alert type="info" :closable="false" class="tip">
        指标是<strong>跑性能测试时自动留档</strong>的，不用单独操作。第一次测某个版本会显示「首次采集」，
        第二个版本开始才有对比。机型不选就是混着比 ——
        不同机型的 CPU、帧率不是一个量级，跨机型比出来的百分比没有意义，<strong>建议选定一台</strong>。
      </el-alert>

      <el-empty
        v-if="!loading && !rows.length"
        :description="packageName && versionName
          ? '这个版本还没有留档数据。跑一次性能测试就会有'
          : '选包名和版本'"
      />

      <template v-if="rows.length">
        <div class="verdict" :class="verdictClass">
          <span class="verdict-num">{{ worseCount }}</span>
          <span class="verdict-text">
            <template v-if="worseCount">项指标比上个版本差，下面红色的几条建议拿去问开发</template>
            <template v-else>项指标退步 —— 这个版本在已采集的指标上没有劣化</template>
          </span>
        </div>

        <div v-for="r in rows" :key="r.metricKey" class="metric-row" :class="levelClass(r.level)">
          <div class="metric-head">
            <span class="metric-label">{{ r.label }}</span>
            <el-tag size="small" :type="tagType(r.level)" effect="plain">{{ levelText(r.level) }}</el-tag>
            <span v-if="r.deltaPercent != null" class="metric-delta" :class="levelClass(r.level)">
              {{ r.deltaPercent > 0 ? '+' : '' }}{{ r.deltaPercent }}%
            </span>
            <span class="metric-spacer" />
            <span v-if="r.deviceModel" class="metric-device">{{ r.deviceModel }}</span>
          </div>
          <div class="metric-summary">{{ r.summary }}</div>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

/**
 * 专项测试的版本质量卡。
 *
 * 只做「读」：指标是跑性能测试时自动留档的，这里不触发任何执行。
 * 把采集和展示分开，是因为专项跑一次要几十分钟，而看结论是随时的事。
 */

const packages = ref<any[]>([])
const devices = ref<any[]>([])
const versions = ref<string[]>([])
const rows = ref<any[]>([])

const packageName = ref('')
const platform = ref('ANDROID')
const versionName = ref('')
const deviceModel = ref('')
const loading = ref(false)

const worseCount = computed(() => rows.value.filter((r) => r.level === 'WORSE').length)
const verdictClass = computed(() => (worseCount.value ? 'is-bad' : 'is-good'))

function levelClass(level: string) {
  if (level === 'WORSE') return 'is-worse'
  if (level === 'BETTER') return 'is-better'
  if (level === 'NO_BASELINE') return 'is-none'
  return 'is-stable'
}

function levelText(level: string) {
  if (level === 'WORSE') return '变差'
  if (level === 'BETTER') return '变好'
  if (level === 'NO_BASELINE') return '无基线'
  return '稳定'
}

function tagType(level: string) {
  if (level === 'WORSE') return 'danger'
  if (level === 'BETTER') return 'success'
  if (level === 'NO_BASELINE') return 'info'
  return 'info'
}

async function loadRefs() {
  try {
    const [apps, devs] = await Promise.all([
      apiClient.getApplicationsByPlatform(platform.value),
      apiClient.getDevices()
    ])
    // 同一个包在多台设备上会各有一条记录，按包名去重，否则下拉里全是重复项
    const seen = new Set<string>()
    packages.value = (apps || []).filter((a: any) => {
      if (!a.packageName || seen.has(a.packageName)) return false
      seen.add(a.packageName)
      return true
    })
    devices.value = devs || []
  } catch {
    // 参考数据拉不到不挡主流程，包名可以手填
  }
}

async function loadVersions() {
  versions.value = []
  versionName.value = ''
  if (!packageName.value) return
  try {
    versions.value = await apiClient.getPerfBaselineVersions(packageName.value, platform.value)
    if (versions.value.length) {
      versionName.value = versions.value[0]
      await load()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载版本失败')
  }
}

function onPackageChange() {
  loadVersions()
}

async function load() {
  if (!packageName.value || !versionName.value) return
  loading.value = true
  try {
    rows.value = await apiClient.comparePerfBaseline({
      packageName: packageName.value,
      platform: platform.value,
      versionName: versionName.value,
      deviceModel: deviceModel.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadRefs)
</script>

<style scoped>
.special-report {
  padding: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tip {
  margin-bottom: 18px;
}
.empty-why {
  font-size: 13px;
  line-height: 1.8;
  margin-top: 4px;
}
.empty-why code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
}
.verdict {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 20px;
  border-radius: 10px;
  margin-bottom: 16px;
}
.verdict.is-bad {
  background: var(--el-color-danger-light-9);
}
.verdict.is-good {
  background: var(--el-color-success-light-9);
}
.verdict-num {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
}
.verdict.is-bad .verdict-num {
  color: var(--el-color-danger);
}
.verdict.is-good .verdict-num {
  color: var(--el-color-success);
}
.verdict-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.metric-row {
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
}
.metric-row.is-worse {
  border-left-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.metric-row.is-better {
  border-left-color: var(--el-color-success);
}
.metric-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.metric-label {
  font-size: 14px;
  font-weight: 600;
}
.metric-delta {
  font-size: 13px;
  font-weight: 700;
}
.metric-delta.is-worse {
  color: var(--el-color-danger);
}
.metric-delta.is-better {
  color: var(--el-color-success);
}
.metric-spacer {
  flex: 1;
}
.metric-device {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.metric-summary {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
</style>
