<template>
  <div class="tracking-check">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">埋点校验</span>
            <p class="card-sub">
              从 Wiki 读取埋点表，对照你上传的 Kibana JSON，检查指定版本 / element_name 是否已上报
            </p>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="120px" style="max-width: 860px">
        <el-form-item label="埋点 Wiki URL" required>
          <el-input
            v-model="form.wikiUrl"
            placeholder="https://wiki.shdev.net/pages/viewpage.action?pageId=74142172" />
        </el-form-item>
        <el-form-item label="版本号" required>
          <el-input v-model="form.version" placeholder="如：v4.9" style="max-width: 240px" />
        </el-form-item>
        <el-form-item label="element_name">
          <el-input
            v-model="form.elementName"
            placeholder="可选；如 DL模式切换。留空则校验该版本全部埋点" />
        </el-form-item>
        <el-form-item label="Kibana JSON" required>
          <div class="upload-row">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".json,.txt,application/json"
              :on-change="onFileChange"
            >
              <el-button>上传 kibana_data.json</el-button>
            </el-upload>
            <span v-if="fileName" class="file-name">{{ fileName }}（{{ form.kibanaJson.length }} 字符）</span>
          </div>
          <el-input
            v-model="form.kibanaJson"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 16 }"
            placeholder='粘贴或上传。支持单条 {"ip","log","timestamp"}、数组、NDJSON、Kibana hits 导出'
            style="margin-top: 8px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="doVerify">开始校验</el-button>
          <el-button @click="resetResult" :disabled="loading">清空结果</el-button>
        </el-form-item>
      </el-form>

      <template v-if="result">
        <el-alert
          :type="result.missingCount === 0 ? 'success' : 'warning'"
          :closable="false"
          show-icon
          :title="result.message"
          style="margin-bottom: 12px" />
        <p class="meta">
          Wiki：{{ result.wikiTitle || result.wikiPageId }}
          · 版本 {{ result.version }}
          · Wiki 行 {{ result.wikiRowCount }}
          · Kibana 日志 {{ result.kibanaLogCount }}
          · 命中 {{ result.foundCount }} / 缺失 {{ result.missingCount }}
        </p>

        <el-table :data="result.results" stripe border style="width: 100%">
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="expected.elementId" label="element_id" width="100" />
          <el-table-column prop="expected.elementName" label="element_name" min-width="140" />
          <el-table-column prop="expected.elementClassName" label="element_class_name" min-width="140" />
          <el-table-column label="OS" width="160">
            <template #default="{ row }">
              <template v-if="row.matchedOs?.length">
                <el-tag
                  v-for="os in row.matchedOs"
                  :key="os"
                  size="small"
                  :type="osTagType(os)"
                  style="margin-right: 4px"
                >{{ os }}</el-tag>
              </template>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="expected.value" label="value" min-width="160" show-overflow-tooltip />
          <el-table-column prop="expected.sectionTitle" label="板块" min-width="120" show-overflow-tooltip />
          <el-table-column label="说明" min-width="200">
            <template #default="{ row }">
              <div>{{ row.message }}</div>
              <div v-for="(c, i) in row.valueChecks || []" :key="i" class="value-check">{{ c }}</div>
            </template>
          </el-table-column>
          <el-table-column label="命中日志" min-width="280">
            <template #default="{ row }">
              <el-collapse v-if="row.matchedLogs?.length">
                <el-collapse-item :title="`共 ${row.matchedLogs.length} 条`" name="logs">
                  <pre class="log-pre">{{ formatJson(row.matchedLogs) }}</pre>
                </el-collapse-item>
              </el-collapse>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>

        <el-collapse v-if="result.logs?.length" style="margin-top: 12px">
          <el-collapse-item title="执行日志" name="run">
            <pre class="log-pre">{{ (result.logs || []).join('\n') }}</pre>
          </el-collapse-item>
        </el-collapse>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { apiClient } from '@/api'

const form = reactive({
  wikiUrl: 'https://wiki.shdev.net/pages/viewpage.action?pageId=74142172',
  version: 'v4.9',
  elementName: '',
  kibanaJson: ''
})

const loading = ref(false)
const fileName = ref('')
const result = ref<any>(null)

function statusType(s: string) {
  if (s === 'found') return 'success'
  if (s === 'partial') return 'warning'
  return 'danger'
}
function statusLabel(s: string) {
  if (s === 'found') return '已找到'
  if (s === 'partial') return '部分'
  return '缺失'
}
function osTagType(os: string) {
  if (os === 'iOS') return 'primary'
  if (os === 'Android') return 'success'
  if (os === 'H5') return 'warning'
  return 'info'
}

function formatJson(v: unknown) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

async function onFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return
  fileName.value = raw.name
  form.kibanaJson = await raw.text()
  ElMessage.success(`已读取 ${raw.name}`)
}

async function doVerify() {
  if (!form.wikiUrl.trim() || !form.version.trim()) {
    ElMessage.warning('请填写 Wiki URL 和版本号')
    return
  }
  if (!form.kibanaJson.trim()) {
    ElMessage.warning('请上传或粘贴 Kibana JSON')
    return
  }
  loading.value = true
  result.value = null
  try {
    result.value = await apiClient.trackingCheckVerify({
      wikiUrl: form.wikiUrl.trim(),
      version: form.version.trim(),
      elementName: form.elementName.trim() || undefined,
      kibanaJson: form.kibanaJson
    })
    if (result.value?.missingCount === 0) {
      ElMessage.success(result.value.message || '校验通过')
    } else {
      ElMessage.warning(result.value?.message || '存在缺失埋点')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '校验失败')
  } finally {
    loading.value = false
  }
}

function resetResult() {
  result.value = null
}
</script>

<style scoped>
.tracking-check {
  padding: 4px;
}
.card-title {
  font-size: 18px;
  font-weight: 600;
}
.card-sub {
  margin: 6px 0 0;
  color: var(--app-text-regular);
  font-size: 13px;
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-name {
  color: var(--app-text-regular);
  font-size: 13px;
}
.meta {
  margin: 0 0 12px;
  color: #555;
  font-size: 13px;
}
.log-pre {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
}
.value-check {
  color: #888;
  font-size: 12px;
}
.muted {
  color: #bbb;
}
</style>
