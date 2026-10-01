<template>
  <div class="env-setup">
    <div class="stepper-card">
      <el-steps :active="wizardStep" align-center finish-status="success">
        <el-step title="填写配置" description="当前步骤" />
        <el-step title="生成 k8s-config" description="约 1～几分钟" />
        <el-step title="查看并修改" description="人工确认" />
        <el-step title="Docker 部署" description="后续支持" />
      </el-steps>
    </div>

    <el-card class="main-card" shadow="never">
      <div class="card-header">
        <div class="header-text">
          <h2 class="card-title">环境搭建</h2>
          <p class="card-sub">
            当前仅支持 K8s 测试环境：分析本机 Java/SpringBoot 源码，按 k8s-java-test-deploy
            技能生成部署文件并写入 k8s-config。纯后端对照 app-activity，前后端对照
            app-admin。生成后可在下方 Tab 查看并人工修改。GitLab testing 分支需自行创建。
          </p>
        </div>
        <span class="status-pill" :class="status?.configured ? 'ok' : 'warn'">
          <i class="dot" />
          {{ status?.configured ? 'Cursor 就绪' : '未就绪' }}
        </span>
      </div>

      <el-alert
        v-if="status && !status.configured"
        type="warning"
        :closable="false"
        show-icon
        class="mb"
        :title="status.hint || '请先配置 cursor.ask（API Key + scripts/cursor-ask npm install）'"
      />

      <el-form label-position="top" class="form" @submit.prevent>
        <el-form-item label="部署方式">
          <el-radio-group model-value="k8s" class="plain-radios">
            <el-radio value="k8s">K8s（当前）</el-radio>
            <el-radio value="docker" disabled>Docker（后续）</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item required>
          <template #label>
            <span>服务源码路径</span>
          </template>
          <el-input
            v-model="servicePath"
            placeholder="例如 /Users/你/projects/qa_coding/app_coding/app-activity"
            clearable
          />
          <div class="field-hint">
            本机绝对路径；需能读到 pom.xml / 启动类；前后端项目还需有 frontend/ 子目录
          </div>
        </el-form-item>

        <div class="form-row">
          <el-form-item required class="form-col">
            <template #label>业务线</template>
            <el-radio-group v-model="bizLine" class="inline-choice">
              <el-radio value="app">
                <span class="inline-choice-main">
                  <span class="choice-title">app</span>
                  <span class="choice-desc">→ k8s-config/app/test/…</span>
                </span>
              </el-radio>
              <el-radio value="pvp">
                <span class="inline-choice-main">
                  <span class="choice-title">pvp</span>
                  <span class="choice-desc">→ k8s-config/pvp/test/…</span>
                </span>
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item required class="form-col">
            <template #label>服务形态</template>
            <el-radio-group v-model="serviceKind" class="inline-choice">
              <el-radio value="backend">
                <span class="inline-choice-main">
                  <span class="choice-title">纯后端（5 件套）</span>
                  <span class="choice-desc">对照 app-activity</span>
                </span>
              </el-radio>
              <el-radio value="fullstack">
                <span class="inline-choice-main">
                  <span class="choice-title">前端 + 后端（6 件套含 Ingress）</span>
                  <span class="choice-desc">对照 app-admin</span>
                </span>
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </div>

        <div class="form-row">
          <el-form-item class="form-col" label="服务名">
            <el-input
              v-model="serviceName"
              placeholder="默认取目录名，如 app-activity"
              clearable
            />
            <div class="field-hint">留空则自动从路径末段提取</div>
          </el-form-item>
          <el-form-item class="form-col" label="NodePort">
            <el-input
              v-model="nodePort"
              placeholder="可选；不填则对照同类服务自行选未占用端口"
              clearable
            />
          </el-form-item>
        </div>

        <el-form-item v-if="serviceKind === 'fullstack'" label="Ingress Host">
          <el-input
            v-model="ingressHost"
            placeholder="可选，如 appadmin-staging.wmpvp.com；不填则占位并标待确认"
            clearable
          />
        </el-form-item>

        <el-form-item label="补充说明">
          <el-input
            v-model="extraNote"
            type="textarea"
            :rows="3"
            placeholder="可选：特殊端口、依赖中间件、已有镜像仓库前缀等"
          />
        </el-form-item>

        <div class="form-actions">
          <el-button
            type="primary"
            :loading="running"
            :disabled="!canRun"
            @click="runGenerate"
          >
            生成并写入 k8s-config
          </el-button>
          <el-button :loading="filesLoading" :disabled="!resolvedServiceName" @click="loadFiles">
            加载已有文件
          </el-button>
          <el-button :disabled="running" @click="resetSession">新开一轮</el-button>
          <span class="busy-hint">首次约 1～几分钟，会改 k8s-config 下文件（不 commit）</span>
        </div>
      </el-form>
    </el-card>

    <el-card v-if="fileTabs.length" class="files-card" shadow="never" v-loading="filesLoading">
      <div class="files-header">
        <div>
          <h3 class="card-title sm">查看并修改</h3>
          <p class="card-sub files-path">{{ filesDir || '—' }}</p>
        </div>
        <div class="files-actions">
          <el-button size="small" :loading="filesLoading" @click="loadFiles">刷新</el-button>
          <el-button
            type="primary"
            size="small"
            :loading="saving"
            :disabled="!activeDirty"
            @click="saveActive"
          >
            保存当前
          </el-button>
          <el-button
            type="success"
            size="small"
            plain
            :loading="saving"
            :disabled="!anyDirty"
            @click="saveAllDirty"
          >
            保存全部改动
          </el-button>
        </div>
      </div>
      <el-tabs v-model="activeFile" type="card" class="file-tabs">
        <el-tab-pane
          v-for="f in fileTabs"
          :key="f.name"
          :name="f.name"
          :label="tabLabel(f)"
        >
          <el-input
            v-model="f.content"
            type="textarea"
            class="file-editor"
            :rows="22"
            spellcheck="false"
            @input="markDirty(f.name)"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card v-else-if="filesLoadedEmpty" class="files-card" shadow="never">
      <el-empty description="该目录还没有可展示的部署文件，先生成或检查服务名 / 业务线" />
    </el-card>

    <el-card v-if="messages.length" class="result-card" shadow="never">
      <h3 class="card-title sm">执行结果</h3>
      <div class="log">
        <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
          <div class="role">{{ m.role === 'user' ? '你' : 'Agent' }}</div>
          <pre class="body">{{ m.text }}</pre>
        </div>
      </div>
      <div class="follow">
        <el-input
          v-model="followUp"
          type="textarea"
          :rows="2"
          placeholder="继续追问，例如：NodePort 改成 30xxx、filebeat 日志路径不对…"
          :disabled="running"
          @keydown.ctrl.enter="sendFollowUp"
        />
        <el-button
          type="primary"
          class="follow-btn"
          :loading="running"
          :disabled="!followUp.trim()"
          @click="sendFollowUp"
        >
          发送
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

type FileTab = { name: string; content: string; saved: string }

const status = ref<Awaited<ReturnType<typeof apiClient.cursorAskStatus>> | null>(null)
const servicePath = ref('')
const bizLine = ref<'app' | 'pvp'>('app')
const serviceKind = ref<'backend' | 'fullstack'>('backend')
const serviceName = ref('')
const nodePort = ref('')
const ingressHost = ref('')
const extraNote = ref('')
const followUp = ref('')
const running = ref(false)
const sessionId = ref(`env-${Date.now()}`)
const messages = ref<{ role: 'user' | 'assistant'; text: string }[]>([])

const fileTabs = ref<FileTab[]>([])
const activeFile = ref('')
const filesDir = ref('')
const filesLoading = ref(false)
const saving = ref(false)
const filesLoadedEmpty = ref(false)
const dirtyNames = ref<Set<string>>(new Set())

const resolvedServiceName = computed(() => {
  const named = serviceName.value.trim()
  if (named) return named
  return deriveName(servicePath.value.trim())
})

const canRun = computed(
  () => !!status.value?.configured && !!servicePath.value.trim() && !running.value
)

const activeDirty = computed(() => dirtyNames.value.has(activeFile.value))
const anyDirty = computed(() => dirtyNames.value.size > 0)

/** 0 填写配置 → 1 生成中 → 2 查看并修改；Docker 永远是第 4 步占位 */
const wizardStep = computed(() => {
  if (running.value) return 1
  if (fileTabs.value.length > 0) return 2
  return 0
})

function deriveName(path: string) {
  const parts = path.replace(/[/\\]+$/, '').split(/[/\\]/)
  return parts[parts.length - 1] || ''
}

function tabLabel(f: FileTab) {
  return dirtyNames.value.has(f.name) ? `${f.name} *` : f.name
}

function markDirty(name: string) {
  const tab = fileTabs.value.find((t) => t.name === name)
  if (!tab) return
  const next = new Set(dirtyNames.value)
  if (tab.content !== tab.saved) next.add(name)
  else next.delete(name)
  dirtyNames.value = next
}

function buildPrompt() {
  const path = servicePath.value.trim()
  const name = resolvedServiceName.value
  const kind = serviceKind.value
  const sampleRel =
    kind === 'fullstack'
      ? 'app_coding/k8s-config/app/test/app-admin/'
      : 'app_coding/k8s-config/app/test/app-activity/'
  const files =
    kind === 'fullstack'
      ? [
          'Dockerfile',
          'Jenkinsfile（须含 Node 前端构建 + Maven）',
          `${name}-test-filebeat.yaml（或与样例一致的 *-filebeat.yaml 命名）`,
          'application-test.properties',
          'deploy.yaml',
          `${name}-ingress.yaml`,
        ]
      : [
          'Dockerfile',
          'Jenkinsfile（仅 Maven，无 Node）',
          `${name}-test-filebeat.yaml（或与样例一致的 *-filebeat.yaml 命名）`,
          'application-test.properties',
          'deploy.yaml',
        ]

  const lines = [
    `请使用技能 k8s-java-test-deploy，为以下服务生成 **K8s** 测试环境部署文件并写入磁盘。`,
    `本期只要 K8s，不要做 Docker 部署方案。`,
    ``,
    `- 部署方式：k8s`,
    `- 服务形态：${kind === 'fullstack' ? 'fullstack（前端+后端）' : 'backend（纯后端）'}`,
    `- 服务源码目录：${path}`,
    `- 业务线：${bizLine.value}`,
    `- 服务名（落盘目录名）：${name}`,
    `- 目标目录：app_coding/k8s-config/${bizLine.value}/test/${name}/`,
    `- 强制对照样例：${sampleRel}`,
    `- 必写文件（${files.length}）：`,
    ...files.map((f) => `  - ${f}`),
  ]
  if (nodePort.value.trim()) {
    lines.push(`- NodePort：${nodePort.value.trim()}`)
  }
  if (kind === 'fullstack') {
    if (ingressHost.value.trim()) {
      lines.push(`- Ingress Host：${ingressHost.value.trim()}`)
    } else {
      lines.push(
        `- Ingress Host：未提供；请按同类服务习惯给占位域名，并在结果中标明「待确认」`
      )
    }
  }
  if (extraNote.value.trim()) {
    lines.push(`- 补充：${extraNote.value.trim()}`)
  }
  lines.push(
    ``,
    `要求：先读技能与上述样例全部文件，再按形态写齐并落盘；不要 commit；最后汇总变量表、已写路径、与样例差异、Jenkins Script Path。`
  )
  return lines.join('\n')
}

async function loadStatus() {
  try {
    status.value = await apiClient.cursorAskStatus()
  } catch (e: any) {
    status.value = { configured: false, hint: e?.message || '状态检查失败' }
  }
}

async function loadFiles() {
  const name = resolvedServiceName.value
  if (!name) {
    ElMessage.warning('请先填服务名或源码路径')
    return
  }
  filesLoading.value = true
  filesLoadedEmpty.value = false
  try {
    const res = await apiClient.listEnvSetupK8sFiles(bizLine.value, name)
    filesDir.value = res.dir || ''
    const list = (res.files || []).map((f) => ({
      name: f.name,
      content: f.content ?? '',
      saved: f.content ?? '',
    }))
    fileTabs.value = list
    dirtyNames.value = new Set()
    if (list.length) {
      const keep = list.some((f) => f.name === activeFile.value)
      activeFile.value = keep ? activeFile.value : list[0].name
      filesLoadedEmpty.value = false
    } else {
      activeFile.value = ''
      filesLoadedEmpty.value = true
      if (!res.exists) {
        ElMessage.info('目录尚不存在，生成后会自动创建')
      }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载文件失败')
  } finally {
    filesLoading.value = false
  }
}

async function saveOne(tab: FileTab) {
  await apiClient.saveEnvSetupK8sFile({
    bizLine: bizLine.value,
    serviceName: resolvedServiceName.value,
    fileName: tab.name,
    content: tab.content,
  })
  tab.saved = tab.content
  const next = new Set(dirtyNames.value)
  next.delete(tab.name)
  dirtyNames.value = next
}

async function saveActive() {
  const tab = fileTabs.value.find((t) => t.name === activeFile.value)
  if (!tab || !activeDirty.value) return
  saving.value = true
  try {
    await saveOne(tab)
    ElMessage.success(`已保存 ${tab.name}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function saveAllDirty() {
  const dirty = fileTabs.value.filter((t) => dirtyNames.value.has(t.name))
  if (!dirty.length) return
  saving.value = true
  try {
    for (const tab of dirty) {
      await saveOne(tab)
    }
    ElMessage.success(`已保存 ${dirty.length} 个文件`)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function callAgent(message: string) {
  running.value = true
  messages.value.push({ role: 'user', text: message })
  try {
    const res = await apiClient.cursorAskChat({
      message,
      sessionId: sessionId.value,
      mode: 'k8s',
    })
    const text = res.answer || res.error || '（无返回）'
    messages.value.push({ role: 'assistant', text })
    if (!res.ok) {
      ElMessage.error(res.error || '生成失败')
    } else {
      ElMessage.success('完成')
      await loadFiles()
    }
  } catch (e: any) {
    const msg = e?.message || '调用失败'
    messages.value.push({ role: 'assistant', text: msg })
    ElMessage.error(msg)
  } finally {
    running.value = false
  }
}

async function runGenerate() {
  if (!canRun.value) return
  await callAgent(buildPrompt())
}

async function sendFollowUp() {
  const t = followUp.value.trim()
  if (!t || running.value) return
  followUp.value = ''
  await callAgent(t)
}

async function resetSession() {
  try {
    await apiClient.cursorAskReset(sessionId.value, 'k8s')
  } catch {
    /* ignore */
  }
  sessionId.value = `env-${Date.now()}`
  messages.value = []
  followUp.value = ''
  ElMessage.success('已新开一轮')
}

onMounted(loadStatus)
</script>

<style scoped>
.env-setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 28px;
  max-width: 1080px;
}

.stepper-card,
.main-card,
.result-card,
.files-card {
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
}

.stepper-card {
  padding: 20px 28px 12px;
}

.stepper-card :deep(.el-step__title) {
  font-size: 14px;
  font-weight: 600;
}

.stepper-card :deep(.el-step__description) {
  font-size: 12px;
}

.main-card,
.files-card,
.result-card {
  padding: 22px 28px 26px;
}

.main-card :deep(.el-card__body),
.files-card :deep(.el-card__body),
.result-card :deep(.el-card__body) {
  padding: 0;
}

.card-header,
.files-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.header-text {
  min-width: 0;
  flex: 1;
}

.card-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.card-title.sm {
  font-size: 16px;
  margin-bottom: 4px;
}

.card-sub {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.65;
  max-width: 760px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.status-pill.ok {
  color: #067647;
  background: #ecfdf3;
  border-color: #abeFC6;
}

.status-pill.ok .dot {
  background: #17b26a;
}

.status-pill.warn {
  color: #b54708;
  background: #fffaeb;
  border-color: #fedf89;
}

.status-pill.warn .dot {
  background: #f79009;
}

.form {
  max-width: none;
}

.form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.form :deep(.el-form-item__label) {
  color: #344054;
  font-weight: 600;
  margin-bottom: 6px !important;
  line-height: 1.4;
  padding: 0;
}

.plain-radios {
  display: flex;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-col {
  min-width: 0;
}

.inline-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 28px;
  width: 100%;
}

.inline-choice :deep(.el-radio) {
  height: auto;
  align-items: flex-start;
  margin-right: 0;
  white-space: normal;
}

.inline-choice :deep(.el-radio__label) {
  padding-left: 8px;
  line-height: 1.35;
}

.inline-choice-main {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.choice-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.choice-desc {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}

.field-hint {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

.busy-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mb {
  margin-bottom: 16px;
}

.files-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.files-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
  max-width: 640px;
}

.file-tabs {
  margin-top: 4px;
}

.file-tabs :deep(.el-tabs__content) {
  padding-top: 8px;
}

.file-editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
}

.log {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 52vh;
  overflow: auto;
  margin-top: 12px;
}

.msg .role {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.msg .body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  background: var(--el-fill-color-lighter);
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.msg.user .body {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-8);
}

.follow {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.follow .el-textarea {
  flex: 1;
}

.follow-btn {
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .main-card,
  .files-card,
  .result-card,
  .stepper-card {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
