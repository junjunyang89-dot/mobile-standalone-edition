<template>
  <div class="change-review">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">本周改动 / 漏测看板</span>
            <p class="card-sub">
              白盒：本地多仓 <code>base...head</code> 真实 diff · 黑盒：对照必测清单与人工标记 ·
              与「发版文档」互补（发版看需求备注，本页看代码改动）
            </p>
          </div>
          <el-button type="primary" :loading="loading" @click="runDiff">扫描改动</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb"
        title="后端需与仓库在同一台机器。请先本地 clone 并 fetch 本周分支。标记保存在浏览器本地，便于周四对照。"
      />

      <el-form label-width="100px" class="mb">
        <el-form-item label="本周标识">
          <el-input v-model="weekLabel" placeholder="如：2026-08-07 周四发版" style="max-width: 420px" />
        </el-form-item>
      </el-form>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="项目配置" name="projects">
          <div class="toolbar">
            <el-button size="small" type="primary" plain @click="addProject">添加项目</el-button>
            <el-button size="small" @click="saveConfig">保存配置</el-button>
            <el-button size="small" @click="loadConfig">重新加载</el-button>
          </div>
          <div v-for="(p, idx) in projects" :key="idx" class="project-card">
            <div class="project-card-head">
              <el-tag size="small">{{ p.type || 'OTHER' }}</el-tag>
              <span class="project-name">{{ p.name || `项目 ${idx + 1}` }}</span>
              <el-button v-perm:delete size="small" link type="danger" @click="projects.splice(idx, 1)">删除</el-button>
            </div>
            <el-form label-width="88px" size="small">
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="名称">
                    <el-input v-model="p.name" placeholder="完美电竞 Android" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="类型">
                    <el-select v-model="p.type" style="width: 100%">
                      <el-option label="APP" value="APP" />
                      <el-option label="H5" value="H5" />
                      <el-option label="Java" value="JAVA" />
                      <el-option label="Golang" value="GOLANG" />
                      <el-option label="数据库" value="DB" />
                      <el-option label="其他" value="OTHER" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="基线">
                    <el-input v-model="p.baseRef" placeholder="master" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="本周分支">
                <el-input v-model="p.headRef" placeholder="feature/xxx 或 release/20260807" />
              </el-form-item>
              <el-form-item label="本地路径">
                <el-input v-model="p.path" placeholder="/Users/you/projects/xxx" />
              </el-form-item>
              <el-form-item label="pathspecs">
                <el-input
                  v-model="p.pathspecsText"
                  placeholder="可选，空格分隔，如 db/ migration/（限制 diff 范围）"
                />
              </el-form-item>
            </el-form>
          </div>
          <el-empty v-if="!projects.length" description="先添加 APP / H5 / Java / Golang / DB 项目" :image-size="64" />
        </el-tab-pane>

        <el-tab-pane label="必测清单" name="checklist">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="mb"
            title="粘贴你的手写必测项（每行一条）。可选：标题 | 关键字1,关键字2 | 项目类型。扫描后会标出「有改动未命中清单」的模块。"
          />
          <el-input
            v-model="checklistText"
            type="textarea"
            :rows="12"
            placeholder="登录退出 | 登录,logout,账号 | APP&#10;赛事当天页 | 赛事,match,schedule | APP&#10;活动页 | 活动,activity&#10;装包卸包 | install,uninstall,渠道"
          />
          <div class="toolbar">
            <el-button size="small" type="primary" @click="parseChecklist">解析清单</el-button>
            <el-button size="small" @click="saveConfig">保存</el-button>
            <span class="hint">已解析 {{ checklist.length }} 条</span>
          </div>
          <el-table v-if="checklist.length" :data="checklist" size="small" border stripe class="mt">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="title" label="必测项" min-width="180" />
            <el-table-column prop="keywords" label="关键字" min-width="160" />
            <el-table-column prop="projectType" label="类型" width="100" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="发版文档带入" name="release">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="mb"
            title="用发版文档的标题/版本预览抽取，把「上线分支」「DB变更」带入本页（仍需你补本地路径）。"
          />
          <el-form label-width="120px" style="max-width: 640px">
            <el-form-item label="发版文档标题">
              <el-input v-model="releaseTitle" placeholder="与发版文档页一致" />
            </el-form-item>
            <el-form-item label="本次版本">
              <el-input v-model="releaseVersion" placeholder="如：8.7 国内客户端" />
            </el-form-item>
            <el-form-item>
              <el-button :loading="importing" type="primary" @click="importFromReleaseDoc">预览并解析分支</el-button>
            </el-form-item>
          </el-form>
          <el-form-item label="DB 备注汇总" label-width="100px">
            <el-input v-model="releaseDbNotes" type="textarea" :rows="6" placeholder="可从发版文档自动汇总，也可手贴" />
          </el-form-item>
          <el-table v-if="parsedBranches.length" :data="parsedBranches" size="small" border class="mt">
            <el-table-column prop="repoHint" label="仓库提示" width="140" />
            <el-table-column prop="branch" label="分支" min-width="180" />
            <el-table-column prop="suggestedType" label="建议类型" width="100" />
            <el-table-column prop="fromSummary" label="来自需求" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="applyParsedBranch(row)">加入配置</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="扫描结果" name="result">
          <div v-if="!result" class="hint">配置项目后点右上角「扫描改动」</div>
          <template v-else>
            <el-alert
              v-if="result.dbCompare"
              :type="dbAlertType"
              :closable="false"
              show-icon
              class="mb"
              :title="result.dbCompare.summary"
            />

            <h4 v-if="result.gaps?.length" class="section-title">漏测 / 待确认</h4>
            <el-table v-if="result.gaps?.length" :data="result.gaps" size="small" border class="mb">
              <el-table-column prop="severity" label="级别" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.severity === 'warn' ? 'warning' : 'info'">{{ row.severity }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="kind" label="类型" width="160" />
              <el-table-column prop="projectName" label="项目" width="140" />
              <el-table-column prop="title" label="说明" min-width="220" />
              <el-table-column prop="detail" label="细节" min-width="200" show-overflow-tooltip />
            </el-table>

            <div v-for="proj in result.projects" :key="proj.name + proj.path" class="result-block">
              <div class="result-head">
                <el-tag :type="proj.ok ? 'success' : 'danger'" size="small">{{ proj.ok ? 'OK' : '失败' }}</el-tag>
                <strong>{{ proj.name }}</strong>
                <el-tag size="small" effect="plain">{{ proj.type }}</el-tag>
                <span class="muted">
                  {{ proj.baseRef }}...{{ proj.headRef }}
                  · 文件 {{ proj.filesChanged || 0 }}
                  · +{{ proj.insertions || 0 }}/-{{ proj.deletions || 0 }}
                </span>
              </div>
              <p v-if="!proj.ok" class="err">{{ proj.message }}</p>
              <template v-else>
                <h5>模块聚合</h5>
                <el-table :data="proj.modules || []" size="small" border class="mb">
                  <el-table-column prop="module" label="模块" min-width="160" />
                  <el-table-column prop="fileCount" label="文件数" width="80" />
                  <el-table-column label="类别" width="160">
                    <template #default="{ row }">{{ (row.categories || []).join(', ') }}</template>
                  </el-table-column>
                  <el-table-column label="清单命中" width="90">
                    <template #default="{ row }">
                      <el-tag size="small" :type="row.checklistHit ? 'success' : 'info'">
                        {{ row.checklistHit ? '是' : '否' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="人工标记" width="200">
                    <template #default="{ row }">
                      <el-select
                        size="small"
                        :model-value="getMark(proj.name, 'module:' + row.module)"
                        placeholder="标记"
                        clearable
                        @change="(v) => setMark(proj.name, 'module:' + row.module, String(v || ''))"
                      >
                        <el-option label="必测" value="must" />
                        <el-option label="已覆盖" value="covered" />
                        <el-option label="可忽略" value="ignore" />
                      </el-select>
                    </template>
                  </el-table-column>
                </el-table>

                <h5>文件明细</h5>
                <el-table :data="proj.files || []" size="small" border max-height="360">
                  <el-table-column prop="status" label="状态" width="60" />
                  <el-table-column prop="category" label="类别" width="80">
                    <template #default="{ row }">
                      <el-tag size="small" :type="categoryTag(row.category)">{{ row.category }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="path" label="路径" min-width="260" show-overflow-tooltip />
                  <el-table-column label="+/-" width="90">
                    <template #default="{ row }">+{{ row.insertions }}/-{{ row.deletions }}</template>
                  </el-table-column>
                  <el-table-column label="清单" width="70">
                    <template #default="{ row }">
                      <span>{{ row.checklistHit ? '✓' : '' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="人工标记" width="160">
                    <template #default="{ row }">
                      <el-select
                        size="small"
                        :model-value="getMark(proj.name, 'file:' + row.path)"
                        placeholder="标记"
                        clearable
                        @change="(v) => setMark(proj.name, 'file:' + row.path, String(v || ''))"
                      >
                        <el-option label="必测" value="must" />
                        <el-option label="已覆盖" value="covered" />
                        <el-option label="可忽略" value="ignore" />
                      </el-select>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
            </div>

            <template v-if="result.dbCompare && (result.dbCompare.sqlFilesInDiff?.length || releaseDbNotes)">
              <h4 class="section-title">数据库对照</h4>
              <el-row :gutter="16">
                <el-col :span="12">
                  <p class="hint">diff 中的 SQL 文件</p>
                  <el-tag
                    v-for="f in result.dbCompare.sqlFilesInDiff || []"
                    :key="f"
                    class="tag-gap"
                    size="small"
                    effect="plain"
                  >{{ f }}</el-tag>
                  <el-empty v-if="!(result.dbCompare.sqlFilesInDiff || []).length" :image-size="40" description="无" />
                </el-col>
                <el-col :span="12">
                  <p class="hint">可能未写入发版备注的 SQL</p>
                  <el-tag
                    v-for="f in result.dbCompare.sqlFilesMissingInNotes || []"
                    :key="f"
                    class="tag-gap"
                    size="small"
                    type="warning"
                  >{{ f }}</el-tag>
                  <el-empty
                    v-if="!(result.dbCompare.sqlFilesMissingInNotes || []).length"
                    :image-size="40"
                    description="无缺口"
                  />
                </el-col>
              </el-row>
            </template>
          </template>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const STORAGE_CONFIG = 'change-review-config-v1'
const STORAGE_MARKS = 'change-review-marks-v1'

type ProjectForm = {
  name: string
  type: string
  path: string
  baseRef: string
  headRef: string
  pathspecsText: string
}

type ChecklistRow = {
  id: string
  title: string
  keywords: string
  projectType: string
}

const activeTab = ref('projects')
const weekLabel = ref('')
const loading = ref(false)
const importing = ref(false)
const projects = ref<ProjectForm[]>([])
const checklistText = ref('')
const checklist = ref<ChecklistRow[]>([])
const releaseTitle = ref('')
const releaseVersion = ref('')
const releaseDbNotes = ref('')
const parsedBranches = ref<any[]>([])
const result = ref<any>(null)
const marks = ref<Record<string, string>>({})

const dbAlertType = computed(() => {
  const c = result.value?.dbCompare
  if (!c) return 'info'
  if ((c.sqlFilesMissingInNotes || []).length) return 'warning'
  if (c.summary?.includes('未扫到')) return 'warning'
  return 'success'
})

function addProject() {
  projects.value.push({
    name: '',
    type: 'APP',
    path: '',
    baseRef: 'master',
    headRef: '',
    pathspecsText: ''
  })
}

function parseChecklist() {
  const rows: ChecklistRow[] = []
  const lines = checklistText.value.split(/\n/)
  let i = 0
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    i += 1
    const parts = t.split('|').map((s) => s.trim())
    rows.push({
      id: `c${i}`,
      title: parts[0] || t,
      keywords: parts[1] || parts[0] || '',
      projectType: (parts[2] || '').toUpperCase()
    })
  }
  checklist.value = rows
  ElMessage.success(`已解析 ${rows.length} 条必测项`)
}

function markKey(projectName: string, itemKey: string) {
  return `${weekLabel.value || 'default'}::${projectName}::${itemKey}`
}

function getMark(projectName: string, itemKey: string) {
  return marks.value[markKey(projectName, itemKey)] || ''
}

function setMark(projectName: string, itemKey: string, value: string) {
  const k = markKey(projectName, itemKey)
  if (!value) delete marks.value[k]
  else marks.value[k] = value
  localStorage.setItem(STORAGE_MARKS, JSON.stringify(marks.value))
}

function categoryTag(c: string) {
  if (c === 'UI') return 'primary'
  if (c === 'API') return 'success'
  if (c === 'SQL') return 'warning'
  if (c === 'CONFIG') return 'info'
  return ''
}

function saveConfig() {
  localStorage.setItem(
    STORAGE_CONFIG,
    JSON.stringify({
      weekLabel: weekLabel.value,
      projects: projects.value,
      checklistText: checklistText.value,
      checklist: checklist.value,
      releaseTitle: releaseTitle.value,
      releaseVersion: releaseVersion.value,
      releaseDbNotes: releaseDbNotes.value
    })
  )
  ElMessage.success('已保存到浏览器本地')
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG)
    if (!raw) return
    const cfg = JSON.parse(raw)
    weekLabel.value = cfg.weekLabel || ''
    projects.value = cfg.projects || []
    checklistText.value = cfg.checklistText || ''
    checklist.value = cfg.checklist || []
    releaseTitle.value = cfg.releaseTitle || ''
    releaseVersion.value = cfg.releaseVersion || ''
    releaseDbNotes.value = cfg.releaseDbNotes || ''
  } catch {
    /* ignore */
  }
  try {
    const m = localStorage.getItem(STORAGE_MARKS)
    if (m) marks.value = JSON.parse(m)
  } catch {
    marks.value = {}
  }
}

async function runDiff() {
  if (!projects.value.length) {
    ElMessage.warning('请先添加项目')
    return
  }
  for (const p of projects.value) {
    if (!p.path?.trim() || !p.headRef?.trim()) {
      ElMessage.warning(`请完善项目「${p.name || '未命名'}」的路径与本周分支`)
      return
    }
  }
  if (checklistText.value.trim() && !checklist.value.length) {
    parseChecklist()
  }
  loading.value = true
  try {
    saveConfig()
    result.value = await apiClient.changeReviewDiff({
      weekLabel: weekLabel.value || undefined,
      projects: projects.value.map((p) => ({
        name: p.name || p.path,
        type: p.type,
        path: p.path.trim(),
        baseRef: p.baseRef || 'master',
        headRef: p.headRef.trim(),
        pathspecs: p.pathspecsText
          ? p.pathspecsText.split(/[\s,]+/).filter(Boolean)
          : undefined
      })),
      checklist: checklist.value.map((c) => ({
        id: c.id,
        title: c.title,
        keywords: c.keywords,
        projectType: c.projectType || undefined
      })),
      releaseDbNotes: releaseDbNotes.value || undefined
    })
    activeTab.value = 'result'
    ElMessage.success('扫描完成')
  } catch (e: any) {
    ElMessage.error(e?.message || '扫描失败')
  } finally {
    loading.value = false
  }
}

async function importFromReleaseDoc() {
  if (!releaseTitle.value.trim() || !releaseVersion.value.trim()) {
    ElMessage.warning('请填写发版文档标题和版本')
    return
  }
  importing.value = true
  try {
    const preview = await apiClient.previewReleaseDoc({
      title: releaseTitle.value.trim(),
      version: releaseVersion.value.trim()
    })
    const rows = preview?.rows || preview?.data?.rows || []
    if (!rows.length) {
      ElMessage.warning(preview?.message || '未抽到需求行，请先在发版文档页校对')
      return
    }
    const parsed = await apiClient.changeReviewImportBranches({
      rows: rows.map((r: any) => ({
        summary: r.summary,
        branches: r.branches,
        dbChanges: r.dbChanges
      }))
    })
    parsedBranches.value = parsed?.items || []
    if (parsed?.releaseDbNotes) {
      releaseDbNotes.value = parsed.releaseDbNotes
    }
    ElMessage.success(`解析到 ${parsedBranches.value.length} 条分支提示`)
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

function applyParsedBranch(row: any) {
  const exist = projects.value.find(
    (p) => p.headRef === row.branch && (!row.repoHint || p.name.includes(row.repoHint))
  )
  if (exist) {
    ElMessage.info('已有相同分支配置，请补本地路径')
    activeTab.value = 'projects'
    return
  }
  projects.value.push({
    name: row.repoHint || row.fromSummary || row.branch,
    type: row.suggestedType || 'OTHER',
    path: '',
    baseRef: 'master',
    headRef: row.branch || '',
    pathspecsText: row.suggestedType === 'DB' ? '' : ''
  })
  activeTab.value = 'projects'
  ElMessage.success('已加入项目配置，请填写本地路径')
}

onMounted(() => {
  loadConfig()
  if (!projects.value.length) {
    addProject()
  }
})
</script>

<style scoped>
.change-review {
  max-width: 1280px;
}
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
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.project-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-lighter);
}
.project-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.project-name {
  font-weight: 600;
  flex: 1;
}
.result-block {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}
.result-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.muted {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.err {
  color: var(--app-danger);
}
.section-title {
  margin: 8px 0 10px;
}
.tag-gap {
  margin: 0 6px 6px 0;
}
h5 {
  margin: 8px 0;
  font-size: 13px;
  color: var(--app-text-secondary);
}
</style>
