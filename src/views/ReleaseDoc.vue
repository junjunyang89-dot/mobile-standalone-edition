<template>
  <div class="release-doc">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">发版文档与邮件管理</span>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card" class="release-tabs">
        <el-tab-pane label="发版文档" name="doc">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            title="开发备注格式因人而异，自动抽取无法 100% 准确。请先「预览抽取」，在表格里直接改分支/SQL/配置/备注，确认后再「生成发版文档」。"
            style="margin-bottom: 16px" />

          <el-form :model="form" label-width="120px" style="max-width: 720px">
            <el-form-item label="发版文档标题" required>
              <el-input
                v-model="form.title"
                placeholder="如：7月13日 PogPog1.2.9客户端版本"
                maxlength="200"
                show-word-limit />
            </el-form-item>
            <el-form-item label="本次版本" required>
              <el-input
                v-model="form.version"
                placeholder="与 Wiki 汇总页标题一致，如：7.20 海外H5"
                maxlength="100" />
            </el-form-item>
            <el-form-item>
              <el-button :loading="previewing" @click="doPreview">预览抽取</el-button>
              <el-button type="primary" :loading="generating" :disabled="!rows.length" @click="doGenerate">
                生成发版文档
              </el-button>
              <el-button
                v-if="result?.wikiPageUrl"
                type="success"
                plain
                @click="goMailTab"
              >
                去发版邮件
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider v-if="result || rows.length" content-position="left">校对表格（可直接编辑）</el-divider>
          <template v-if="rows.length">
            <p v-if="result?.message" class="result-msg">{{ result.message }}</p>
            <p v-if="result?.wikiPageUrl">
              Wiki 页面：
              <a :href="result.wikiPageUrl" target="_blank" rel="noopener">{{ result.wikiPageUrl }}</a>
            </p>
            <el-table :data="rows" stripe border style="width: 100%; margin-top: 12px">
              <el-table-column label="任务" min-width="220">
                <template #default="{ row }">
                  <a v-if="row.issueUrl" :href="row.issueUrl" target="_blank" rel="noopener">{{ row.summary }}</a>
                  <span v-else>{{ row.summary }}</span>
                </template>
              </el-table-column>
              <el-table-column label="上线分支" min-width="200">
                <template #default="{ row }">
                  <el-input v-model="row.branches" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" />
                </template>
              </el-table-column>
              <el-table-column label="DB变更" min-width="200">
                <template #default="{ row }">
                  <el-input v-model="row.dbChanges" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" />
                </template>
              </el-table-column>
              <el-table-column label="配置变更" min-width="160">
                <template #default="{ row }">
                  <el-input v-model="row.configChanges" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
                </template>
              </el-table-column>
              <el-table-column label="QA" width="110">
                <template #default="{ row }">
                  <el-input v-model="row.qaAssignee" />
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="180">
                <template #default="{ row }">
                  <div v-if="row.remarks && String(row.remarks).includes('【需确认】')" class="remark-warn">
                    需和开发确认（缺库名等）
                  </div>
                  <el-input
                    v-model="row.remarks"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    :class="{ 'remark-warn-input': row.remarks && String(row.remarks).includes('【需确认】') }"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-collapse v-if="result?.logs?.length" style="margin-top: 12px">
              <el-collapse-item title="执行日志" name="logs">
                <pre class="logs">{{ (result.logs || []).join('\n') }}</pre>
              </el-collapse-item>
            </el-collapse>
          </template>
        </el-tab-pane>

        <el-tab-pane label="发版邮件" name="mail">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="建议先在「发版文档」生成 Wiki。生成草稿与发送前都会重新拉取 Wiki 最新表格，Wiki 改过后再发也不会用旧内容。"
            style="margin-bottom: 16px" />

          <el-form :model="mailForm" label-width="120px" style="max-width: 900px">
            <el-form-item label="发版文档标题" required>
              <el-input v-model="mailForm.title" placeholder="与 Wiki 标题一致，如：7月20日 PogPog H5&服务端版本" />
            </el-form-item>
            <el-form-item label="Wiki 页面地址" required>
              <el-input v-model="mailForm.wikiPageUrl" placeholder="新建发版文档的完整 Wiki URL" />
            </el-form-item>
            <el-form-item label="收件人" required>
              <el-input v-model="mailForm.to" placeholder="多个用英文逗号分隔" />
            </el-form-item>
            <el-form-item label="抄送">
              <el-input v-model="mailForm.cc" placeholder="可选，多个用英文逗号分隔" />
            </el-form-item>
            <el-form-item label="主题" required>
              <el-input v-model="mailForm.subject" placeholder="点「生成邮件草稿」后自动填充，也可手改" />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="drafting"
                :disabled="!canDraft"
                @click="doMailDraft"
              >
                生成邮件草稿
              </el-button>
              <el-button type="success" :loading="sending" :disabled="!mailForm.htmlBody" @click="doMailSend">
                发送邮件
              </el-button>
              <span v-if="!canDraft" class="mail-hint">请填写发版文档标题和 Wiki 页面地址</span>
              <span v-else-if="!mailForm.htmlBody" class="mail-hint">请先点「生成邮件草稿」，出现正文预览后即可发送</span>
            </el-form-item>
          </el-form>

          <template v-if="mailForm.htmlBody">
            <el-divider content-position="left">正文预览</el-divider>
            <div class="mail-preview" v-html="mailForm.htmlBody" />
            <el-divider content-position="left">正文 HTML（可改）</el-divider>
            <el-input
              v-model="mailForm.htmlBody"
              type="textarea"
              :autosize="{ minRows: 8, maxRows: 20 }"
              class="mail-html-editor" />
          </template>
          <el-empty v-else description="填写标题与 Wiki 地址后点「生成邮件草稿」（每次都会从 Wiki 拉最新表格）" />
        </el-tab-pane>
      </el-tabs>

      <el-dialog
        v-model="deferredDialogVisible"
        title="疑似不跟本版本 — 请确认"
        width="780px"
        :close-on-click-modal="false"
        destroy-on-close
      >
        <p class="deferred-hint">
          以下单在标题或备注里写了「不跟版本 / 对外时间待定」等。默认<strong>不跟</strong>本版本。
          勾选后点确认，会记入校对表格并随本版本生成 Wiki。
        </p>
        <el-table
          ref="deferredTableRef"
          :data="deferredCandidates"
          stripe
          border
          max-height="420"
          @selection-change="onDeferredSelectionChange"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column label="任务" min-width="240">
            <template #default="{ row }">
              <a v-if="row.issueUrl" :href="row.issueUrl" target="_blank" rel="noopener">{{ row.summary }}</a>
              <span v-else>{{ row.summary }}</span>
              <div v-if="row.issueKey" class="deferred-key">{{ row.issueKey }}</div>
            </template>
          </el-table-column>
          <el-table-column label="命中话术" min-width="200" prop="deferredReason" />
          <el-table-column label="QA" width="100" prop="qaAssignee" />
        </el-table>
        <template #footer>
          <el-button @click="skipAllDeferred">都不跟本版本</el-button>
          <el-button type="primary" @click="confirmDeferredSelection">
            确认（勾选 {{ deferredSelected.length }} 单跟本版本）
          </el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'

const activeTab = ref('doc')

const form = reactive({
  title: '',
  version: ''
})
const previewing = ref(false)
const generating = ref(false)
const result = ref<any>(null)
const rows = ref<any[]>([])
const deferredDialogVisible = ref(false)
const deferredCandidates = ref<any[]>([])
const deferredSelected = ref<any[]>([])
const deferredTableRef = ref<any>(null)

const mailForm = reactive({
  title: '',
  wikiPageUrl: '',
  to: 'yangjunjun@pwrd.com',
  cc: '',
  subject: '',
  htmlBody: ''
})
const drafting = ref(false)
const sending = ref(false)

const canDraft = computed(
  () => !!(mailForm.title.trim() && mailForm.wikiPageUrl.trim())
)

function validateDoc() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写发版文档标题')
    return false
  }
  if (!form.version.trim()) {
    ElMessage.warning('请填写本次版本（需与 Wiki 上标题一致）')
    return false
  }
  return true
}

async function doPreview() {
  if (!validateDoc()) return
  previewing.value = true
  try {
    result.value = await apiClient.previewReleaseDoc({
      title: form.title.trim(),
      version: form.version.trim()
    })
    rows.value = (result.value?.rows || []).map((r: any) => ({ ...r }))
    mailForm.title = form.title.trim()
    const deferred = (result.value?.deferredCandidates || []).map((r: any) => ({ ...r }))
    deferredCandidates.value = deferred
    deferredSelected.value = []
    if (deferred.length > 0) {
      deferredDialogVisible.value = true
      ElMessage.success(
        `预览完成 ${rows.value.length} 条；另有 ${deferred.length} 单疑似不跟版本，请在弹窗中确认`
      )
    } else {
      ElMessage.success(`预览完成，共 ${rows.value.length} 条，请校对后再生成`)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '预览失败')
  } finally {
    previewing.value = false
  }
}

function onDeferredSelectionChange(sel: any[]) {
  deferredSelected.value = sel || []
}

function markFollowVersion(row: any) {
  const reason = row.deferredReason ? `（原：${row.deferredReason}）` : ''
  const note = `【人工确认】跟本版本上线${reason}`
  const remarks = (row.remarks || '').trim()
  return {
    ...row,
    deferredCandidate: false,
    deferredReason: undefined,
    remarks: !remarks || remarks === '无' ? note : `${note}\n${remarks}`
  }
}

function confirmDeferredSelection() {
  const picked = deferredSelected.value.map(markFollowVersion)
  if (picked.length) {
    const keys = new Set(rows.value.map((r: any) => r.issueKey).filter(Boolean))
    for (const r of picked) {
      if (r.issueKey && keys.has(r.issueKey)) continue
      rows.value.push(r)
    }
    ElMessage.success(`已纳入 ${picked.length} 单跟本版本，请继续校对表格`)
  } else {
    ElMessage.info('未勾选任何单，均不跟本版本')
  }
  deferredDialogVisible.value = false
  deferredCandidates.value = []
  deferredSelected.value = []
}

function skipAllDeferred() {
  deferredDialogVisible.value = false
  deferredCandidates.value = []
  deferredSelected.value = []
  ElMessage.info('已跳过疑似不跟版本的单')
}

async function doGenerate() {
  if (!validateDoc()) return
  if (!rows.value.length) {
    ElMessage.warning('请先预览抽取，并校对表格')
    return
  }
  await ElMessageBox.confirm(
    `将用当前校对后的 ${rows.value.length} 行表格，在 Wiki 创建「${form.title.trim()}」。确认？`,
    '生成发版文档',
    { type: 'warning' }
  )
  generating.value = true
  try {
    result.value = await apiClient.generateReleaseDoc({
      title: form.title.trim(),
      version: form.version.trim(),
      rows: rows.value
    })
    mailForm.title = form.title.trim()
    if (result.value?.wikiPageUrl) {
      mailForm.wikiPageUrl = result.value.wikiPageUrl
    }
    ElMessage.success(result.value?.message || '已生成')
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

function goMailTab() {
  mailForm.title = form.title.trim() || mailForm.title
  if (result.value?.wikiPageUrl) {
    mailForm.wikiPageUrl = result.value.wikiPageUrl
  }
  activeTab.value = 'mail'
}

async function doMailDraft() {
  if (!mailForm.title.trim()) {
    ElMessage.warning('请填写发版文档标题')
    return
  }
  if (!mailForm.wikiPageUrl.trim()) {
    ElMessage.warning('请填写 Wiki 页面地址（可先在发版文档 Tab 生成）')
    return
  }
  drafting.value = true
  try {
    const draft = await apiClient.previewReleaseMail({
      title: mailForm.title.trim(),
      wikiPageUrl: mailForm.wikiPageUrl.trim()
    })
    mailForm.subject = draft?.subject || `【发版通知】${mailForm.title.trim()}`
    mailForm.htmlBody = draft?.htmlBody || ''
    if (draft?.defaultTo && !mailForm.to) {
      mailForm.to = draft.defaultTo
    }
    ElMessage.success(draft?.message || '草稿已生成')
  } catch (e: any) {
    ElMessage.error(e?.message || '生成草稿失败')
  } finally {
    drafting.value = false
  }
}

async function doMailSend() {
  if (!mailForm.to.trim()) {
    ElMessage.warning('请填写收件人')
    return
  }
  if (!mailForm.subject.trim()) {
    ElMessage.warning('请填写主题')
    return
  }
  if (!mailForm.htmlBody.trim()) {
    ElMessage.warning('请先生成邮件草稿')
    return
  }
  await ElMessageBox.confirm(
    `发送前会再从 Wiki 拉取最新表格，然后发到 ${mailForm.to.trim()}。确认？`,
    '发送邮件',
    { type: 'warning' }
  )
  sending.value = true
  try {
    const res = await apiClient.sendReleaseMail({
      to: mailForm.to.trim(),
      cc: mailForm.cc.trim() || undefined,
      subject: mailForm.subject.trim(),
      htmlBody: mailForm.htmlBody,
      title: mailForm.title.trim(),
      wikiPageUrl: mailForm.wikiPageUrl.trim()
    })
    if (res?.htmlBody) {
      mailForm.htmlBody = res.htmlBody
    }
    ElMessage.success(res?.message || '已发送')
  } catch (e: any) {
    ElMessage.error(e?.message || '发送失败')
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-weight: normal;
}
.result-msg {
  color: var(--app-text);
}
.logs {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  color: var(--app-text-secondary);
}
.release-tabs :deep(.el-tabs__content) {
  padding: 16px;
}
.mail-preview {
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 16px;
  background: #fff;
  overflow-x: auto;
  max-height: 420px;
}
.mail-html-editor {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
.mail-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--app-warning);
}
.remark-warn {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #d93025;
}
.remark-warn-input :deep(textarea) {
  color: #d93025;
  font-weight: 600;
}
.deferred-hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text-secondary);
}
.deferred-key {
  margin-top: 2px;
  font-size: 12px;
  color: var(--app-text-secondary);
}
</style>
