<template>
  <div class="api-schedules">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">定时执行</span>
            <p class="card-sub">
              提测期间每天早上自动跑一轮，接口挂了当天就知道 ——
              而不是等到回归那天才发现，那时已经分不清是哪次改动引入的。
            </p>
          </div>
          <el-button type="primary" @click="openCreate">新建定时任务</el-button>
        </div>
      </template>

      <el-empty v-if="!loading && !rows.length" description="还没有定时任务">
        <el-button type="primary" @click="openCreate">新建第一条</el-button>
      </el-empty>

      <div v-loading="loading">
        <div v-for="s in rows" :key="s.id" class="sch-card" :class="{ off: !s.enabled }">
          <div class="sch-play" :class="statusClass(s)">
            <el-icon><VideoPlay v-if="s.enabled" /><VideoPause v-else /></el-icon>
          </div>
          <div class="sch-main">
            <div class="sch-title">
              <span class="sch-name">{{ s.name }}</span>
              <el-tag v-if="s.lastStatus" size="small" :type="tagType(s.lastStatus)">
                {{ statusText(s.lastStatus) }}
              </el-tag>
              <el-tag v-if="s.environment === 'PROD'" size="small" type="danger" effect="plain">线上</el-tag>
            </div>
            <div class="sch-meta">
              <code>{{ s.cron }}</code>
              <span class="dot">·</span>
              <span>{{ s.collectionName || '全部用例' }} · {{ s.caseCount ?? 0 }} 条</span>
              <span v-if="s.lastRunAt" class="dot">·</span>
              <el-button
                v-if="s.lastRunId"
                link
                type="primary"
                class="last-run"
                @click="openReport(s.lastRunId)"
              >
                上次 {{ fmt(s.lastRunAt) }}
              </el-button>
              <span v-else-if="s.lastRunAt">上次 {{ fmt(s.lastRunAt) }}</span>
            </div>
            <div v-if="s.lastStatus === 'ERROR' && s.lastMessage" class="sch-error">
              {{ s.lastMessage }}
            </div>
          </div>
          <div class="sch-next">
            <div class="next-label">下次执行</div>
            <div class="next-time">{{ s.enabled ? fmt(s.nextRunAt) || '—' : '已暂停' }}</div>
          </div>
          <div class="sch-actions">
            <el-switch :model-value="!!s.enabled" @change="(v) => toggle(s, !!v)" />
            <el-tooltip content="立即跑一次，不影响下次定时" placement="top">
              <el-button link type="primary" :loading="runningId === s.id" @click="runNow(s)">
                <el-icon><VideoPlay /></el-icon>
              </el-button>
            </el-tooltip>
            <el-button link type="primary" @click="openEdit(s)">编辑</el-button>
            <el-button link type="danger" @click="remove(s)">删</el-button>
          </div>
        </div>
      </div>
    </el-card>

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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoPlay, VideoPause } from '@element-plus/icons-vue'
import { apiClient } from '../api'

/**
 * 定时执行。对应参考页的 Schedules。
 *
 * 没做 webhook 触发那块：现在没有 CI 往这里打，做了也没人用。
 */

const router = useRouter()

const PRESETS = [
  { label: '每天 8 点', cron: '0 0 8 * * ?' },
  { label: '每半小时', cron: '0 0/30 * * * ?' },
  { label: '工作日 23 点', cron: '0 0 23 ? * MON-FRI' },
  { label: '每周日 2 点', cron: '0 0 2 ? * SUN' }
]

const rows = ref<any[]>([])
const collections = ref<any[]>([])
const projects = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const runningId = ref('')

const form = ref<any>({
  id: '',
  name: '',
  cron: '0 0 8 * * ?',
  collectionId: '',
  project: '',
  environment: 'TEST',
  enabled: true
})

function fmt(s?: string | null) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function statusClass(s: any) {
  if (!s.enabled) return 'paused'
  if (s.lastStatus === 'FAILED' || s.lastStatus === 'ERROR') return 'bad'
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
  return '执行异常'
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
  padding: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
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
.sch-card {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.sch-card.off {
  opacity: 0.6;
}
.sch-play {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: none;
}
.sch-play.good {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.sch-play.bad {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.sch-play.paused {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.sch-main {
  flex: 1;
  min-width: 0;
}
.sch-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sch-name {
  font-size: 14px;
  font-weight: 600;
}
.sch-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.sch-meta code {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
}
.dot {
  color: var(--el-text-color-placeholder);
}
.sch-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-danger);
  line-height: 1.5;
}
.sch-next {
  text-align: right;
  flex: none;
  min-width: 130px;
}
.next-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.next-time {
  font-size: 13px;
  font-weight: 600;
  margin-top: 2px;
}
.sch-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.last-run {
  padding: 0;
  height: auto;
  font-size: 12px;
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
</style>
