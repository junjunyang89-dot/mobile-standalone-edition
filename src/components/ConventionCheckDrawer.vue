<template>
  <el-drawer
    :model-value="modelValue"
    title="源码约定检查"
    size="760px"
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div v-loading="loading" class="convention">
      <el-alert type="info" :closable="false" show-icon class="convention-note">
        对着本机源码扫描，不用手机，几秒出结果。查的是咱们自己的约定（X5 入口只许减、两份 JSBridge 必须一致…），
        <b>产出的是风险，不是缺陷，不计入用例通过率</b>。
      </el-alert>

      <div class="convention-actions">
        <el-button type="primary" size="small" :loading="loading" @click="run">重新扫描</el-button>
        <el-button v-perm:write size="small" :loading="locking" @click="lock">锁定基准</el-button>
        <span v-if="report" class="convention-meta">
          <template v-for="(c, repo) in report.commits" :key="repo">{{ repo }} @ {{ c }}　</template>
          {{ formatTime(report.ranAt) }}
        </span>
      </div>

      <template v-if="report">
        <div :class="['convention-verdict', `verdict-${report.verdict.toLowerCase()}`]">
          <span class="verdict-title">{{ verdictText[report.verdict] }}</span>
          <span class="verdict-hint">{{ verdictHint[report.verdict] }}</span>
        </div>

        <div v-for="r in report.results" :key="r.id" class="rule-card">
          <div class="rule-head">
            <el-tag size="small" :type="statusTag[r.status]" effect="dark">{{ statusText[r.status] }}</el-tag>
            <span class="rule-title">{{ r.title }}</span>
            <span v-if="r.current != null" class="rule-count">
              现在 <b>{{ r.current }}</b>
              <template v-if="r.baseline != null"> / 基准 {{ r.baseline }}</template>
            </span>
          </div>
          <div class="rule-detail">{{ r.detail }}</div>
          <div class="rule-why">为什么管：{{ r.why }}</div>

          <div v-if="r.evidence?.grown?.length" class="rule-evidence">
            <div class="evidence-label">多出来的位置</div>
            <div v-for="g in r.evidence.grown" :key="g.file" class="evidence-line">
              <code>{{ shortPath(g.file) }}</code>
              <span>{{ g.before }} → {{ g.after }} 处，行 {{ g.lines.join(', ') }}</span>
            </div>
          </div>
          <div v-if="r.evidence?.onlyIn" class="rule-evidence">
            <div class="evidence-label">只在一份里有</div>
            <div v-for="(items, file) in r.evidence.onlyIn" :key="file" class="evidence-line">
              <code>{{ shortPath(String(file)) }}</code>
              <span>{{ items.length ? items.join('、') : '—' }}</span>
            </div>
          </div>
          <div v-if="r.evidence?.unregistered?.length" class="rule-evidence">
            <div class="evidence-label">没登记的开关</div>
            <div class="evidence-line"><span>{{ r.evidence.unregistered.join('、') }}</span></div>
          </div>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'
import type { ConventionReport, ConventionStatus } from '@/api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const report = ref<ConventionReport | null>(null)
const loading = ref(false)
const locking = ref(false)

const verdictText: Record<ConventionReport['verdict'], string> = {
  RISK: '有风险',
  INCOMPLETE: '不完整',
  CLEAN: '干净'
}
const verdictHint: Record<ConventionReport['verdict'], string> = {
  RISK: '有规则比基准变差了，见下面标红的那条',
  INCOMPLETE: '有规则没跑成或还没锁基准——不能当成「通过」',
  CLEAN: '所有规则都没比基准变差'
}
const statusText: Record<ConventionStatus, string> = {
  OK: '持平',
  IMPROVED: '变好了',
  REGRESSED: '变差了',
  NO_BASELINE: '未锁基准',
  SKIPPED: '没跑成'
}
const statusTag: Record<ConventionStatus, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
  OK: 'success',
  IMPROVED: 'primary',
  REGRESSED: 'danger',
  NO_BASELINE: 'warning',
  SKIPPED: 'info'
}

const onOpen = () => {
  if (!report.value) run()
}

const run = async () => {
  loading.value = true
  try {
    report.value = await apiClient.runConventionCheck()
  } catch (e: any) {
    ElMessage.error(e.message || '扫描失败')
  } finally {
    loading.value = false
  }
}

const lock = async () => {
  try {
    await ElMessageBox.confirm(
      '把现在的数锁成基准。以后只许比它少——变多就报「变差了」。基准只能往下锁，不能往上调。',
      '锁定基准',
      { type: 'warning', confirmButtonText: '锁定' }
    )
  } catch {
    return
  }
  locking.value = true
  try {
    const res = await apiClient.lockConventionBaseline()
    report.value = res.report
    if (res.refused.length) {
      ElMessage.warning({ message: res.refused.join('；'), duration: 8000 })
    } else {
      ElMessage.success(`已锁定：${res.locked.join('、') || '无'}`)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '锁定失败')
  } finally {
    locking.value = false
  }
}

const shortPath = (p: string) => p.replace(/^SteamESports\/app\/src\/main\/java\/com\/pwrd\/steam\/esports\//, '…/')

const formatTime = (s: string) => (s ? new Date(s).toLocaleString('zh-CN') : '')
</script>

<style scoped>
.convention {
  min-height: 200px;
  font-size: 13px;
}

.convention-note {
  margin-bottom: 12px;
}

.convention-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.convention-meta {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.convention-verdict {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 6px;
  border: 1px solid;
}

.verdict-title {
  font-size: 16px;
  font-weight: 600;
}

.verdict-hint {
  color: var(--app-text-regular);
}

.verdict-risk {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger-dark-2);
}

.verdict-incomplete {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
  color: var(--el-color-warning-dark-2);
}

.verdict-clean {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
  color: var(--el-color-success-dark-2);
}

.rule-card {
  padding: 10px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--app-border, var(--el-border-color));
  border-radius: 6px;
}

.rule-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.rule-count {
  margin-left: auto;
  color: var(--app-text-regular);
}

.rule-detail {
  margin-top: 6px;
  color: var(--el-text-color-primary);
}

.rule-why {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rule-evidence {
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.evidence-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}

.evidence-line {
  display: flex;
  gap: 10px;
  line-height: 1.8;
  word-break: break-all;
}

.evidence-line code {
  color: var(--el-color-danger-dark-2);
}
</style>
