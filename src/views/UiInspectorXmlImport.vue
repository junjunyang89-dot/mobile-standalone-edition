<template>
  <div class="inspector-import">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span class="card-title">Inspector XML 导入</span>
          <span class="card-sub">
            粘贴 Appium Inspector XML → 归属到「页面/弹窗」→ 多定位写入元素库；元素管理可按页折叠查看
          </span>
        </div>
      </template>

      <el-form label-width="110px" class="form">
        <el-form-item label="应用" required>
          <el-select v-model="appId" filterable placeholder="选择应用" style="width: 320px" @change="onAppChange">
            <el-option
              v-for="a in apps"
              :key="a.id"
              :label="a.nameZh || a.nameEn || a.id"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" required>
          <el-radio-group v-model="platform">
            <el-radio-button value="IOS">iOS</el-radio-button>
            <el-radio-button value="ANDROID">Android</el-radio-button>
            <el-radio-button value="H5">H5</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="归属页面" required>
          <div class="page-block">
            <div class="page-row">
              <el-select
                v-model="pageId"
                filterable
                placeholder="选择已有页面"
                style="width: 320px"
                @change="onPageSelect"
              >
                <el-option
                  v-for="p in pages"
                  :key="p.pageId"
                  :label="`${p.nameZh} (${p.pageId})`"
                  :value="p.pageId"
                />
              </el-select>
              <el-button type="primary" plain @click="openNewPage">+ 新建页面</el-button>
            </div>
            <p class="page-hint">
              导入不同 XML 时先「新建页面」或下拉切换。当前：
              <b>{{ pageNameZh || '未选' }}</b>
              <template v-if="pageId">（{{ pageId }}）</template>
            </p>
            <div class="page-row quick">
              <span class="quick-label">快捷：</span>
              <el-button size="small" @click="quickPrivacy">温馨提示弹窗</el-button>
              <el-button size="small" @click="quickLoginPhone">输入手机号</el-button>
              <el-button size="small" @click="quickDiscover">CS-发现页</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="入库状态">
          <el-radio-group v-model="importStatus">
            <el-radio value="CANDIDATE">候选</el-radio>
            <el-radio value="ACTIVE">直接选用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="XML" required>
          <el-input
            v-model="xml"
            type="textarea"
            :rows="11"
            placeholder="从 Appium Inspector 复制 Source XML 粘贴到这里…"
          />
          <div class="upload-row">
            <input ref="fileInput" type="file" accept=".xml,text/xml,application/xml,text/plain" hidden @change="onFile" />
            <el-button @click="fileInput?.click()">上传 XML 文件</el-button>
            <el-button type="primary" :loading="parsing" :disabled="!xml.trim()" @click="doParse">解析</el-button>
          </div>
        </el-form-item>
      </el-form>

      <div v-if="candidates.length" class="result">
        <div class="result-toolbar">
          <span>解析到 {{ candidates.length }} 个控件，已勾选 {{ selectedRows.length }} 个</span>
          <div>
            <el-button size="small" @click="selectSuggested">勾选建议项</el-button>
            <el-button size="small" @click="selectAll">全选</el-button>
            <el-button size="small" @click="clearSelect">清空</el-button>
            <el-button type="primary" size="small" :loading="importing" :disabled="!selectedRows.length" @click="doImport">
              写入元素库
            </el-button>
          </div>
        </div>
        <el-table
          ref="tableRef"
          :data="candidates"
          row-key="rowKey"
          max-height="480"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" />
          <el-table-column prop="nameZh" label="中文名" min-width="100" />
          <el-table-column prop="nameEn" label="英文名" min-width="110" />
          <el-table-column label="主定位" min-width="180">
            <template #default="{ row }">
              <el-select
                :model-value="primaryKey(row)"
                size="small"
                style="width: 100%"
                @change="(v: string) => setPrimary(row, v)"
              >
                <el-option
                  v-for="(o, i) in row.locatorOptions || []"
                  :key="i"
                  :label="`${o.label || o.locatorType}`"
                  :value="optionKey(o)"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="定位值" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.locatorValue }}</template>
          </el-table-column>
          <el-table-column label="备用" min-width="200">
            <template #default="{ row }">
              <div class="fb-list">
                <el-tag
                  v-for="(o, i) in fallbacksOf(row)"
                  :key="i"
                  size="small"
                  type="info"
                  :title="o.locatorValue"
                >
                  {{ o.label || o.locatorType }}
                </el-tag>
                <span v-if="!fallbacksOf(row).length" class="muted">无</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="elementType" label="类型" min-width="140" show-overflow-tooltip />
        </el-table>
      </div>
    </el-card>

    <el-dialog v-model="newPageVisible" title="新建归属页面" width="440px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="中文名" required>
          <el-input v-model="newPageNameZh" placeholder="如 CS-发现页、输入手机号" />
        </el-form-item>
        <el-form-item label="页面编码" required>
          <el-input v-model="newPageId" placeholder="英文大写，如 CS_DISCOVER" />
          <p class="page-hint">仅字母数字下划线；写入后会出现在下拉列表里，供以后导入复用。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newPageVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingPage" @click="submitNewPage">创建并选用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'

type LocatorOption = { locatorType: string; locatorValue: string; label?: string }

const apps = ref<{ id: string; nameZh?: string; nameEn?: string }[]>([])
const pages = ref<{ pageId: string; nameZh: string }[]>([])
const appId = ref('')
const platform = ref<'IOS' | 'ANDROID' | 'H5'>('IOS')
const pageId = ref('')
const pageNameZh = ref('')
const importStatus = ref<'CANDIDATE' | 'ACTIVE'>('CANDIDATE')
const xml = ref('')
const parsing = ref(false)
const importing = ref(false)
const candidates = ref<any[]>([])
const selectedRows = ref<any[]>([])
const tableRef = ref<any>()
const fileInput = ref<HTMLInputElement | null>(null)
const newPageVisible = ref(false)
const newPageId = ref('')
const newPageNameZh = ref('')
const creatingPage = ref(false)

onMounted(async () => {
  try {
    apps.value = (await apiClient.getUiApps({ enabledOnly: true })) as any[]
    const prefer = apps.value.find(
      (a) =>
        (a.nameZh && a.nameZh.includes('完美世界电竞')) ||
        (a.nameEn && /esport|wmzq|steam/i.test(a.nameEn)) ||
        (a.id && /esport|wmzq/i.test(a.id))
    )
    appId.value = prefer?.id || apps.value[0]?.id || ''
    await loadPages()
    if (pages.value.length) {
      pageId.value = pages.value[0].pageId
      pageNameZh.value = pages.value[0].nameZh
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载应用失败')
  }
})

function onPageSelect(id: string) {
  const hit = pages.value.find((p) => p.pageId === id)
  if (hit?.nameZh) pageNameZh.value = hit.nameZh
}

watch(pageId, (id) => {
  const hit = pages.value.find((p) => p.pageId === id)
  if (hit?.nameZh) pageNameZh.value = hit.nameZh
})

async function loadPages() {
  if (!appId.value) {
    pages.value = []
    return
  }
  try {
    pages.value = (await apiClient.getUiPages({ appId: appId.value, enabledOnly: true })) as any[]
  } catch {
    pages.value = []
  }
}

async function onAppChange() {
  await loadPages()
  pageId.value = pages.value[0]?.pageId || ''
  pageNameZh.value = pages.value[0]?.nameZh || ''
}

function suggestPageId(nameZh: string) {
  const map: Record<string, string> = {
    温馨提示: 'PRIVACY_WARM_TIP',
    输入手机号: 'LOGIN_PHONE',
    验证码: 'LOGIN_SMS',
    发现: 'CS_DISCOVER',
    社区: 'CS_COMMUNITY',
    我的: 'MINE'
  }
  for (const [k, v] of Object.entries(map)) {
    if (nameZh.includes(k)) return v
  }
  // 只保留英文数字，避免中文被替换成多个 _
  const ascii = nameZh
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
  if (ascii && /^[A-Z][A-Z0-9_]{0,60}$/.test(ascii)) return ascii
  return 'PAGE_' + Date.now().toString(36).toUpperCase()
}

function openNewPage() {
  newPageNameZh.value = ''
  newPageId.value = ''
  newPageVisible.value = true
}

watch(newPageNameZh, (n) => {
  if (!newPageVisible.value) return
  if (!newPageId.value || newPageId.value.startsWith('PAGE_')) {
    newPageId.value = suggestPageId(n || '')
  }
})

async function submitNewPage() {
  if (!appId.value) {
    ElMessage.warning('请先选择应用')
    return
  }
  if (!newPageNameZh.value.trim()) {
    ElMessage.warning('请填写中文名')
    return
  }
  if (!newPageId.value.trim()) {
    ElMessage.warning('请填写页面编码')
    return
  }
  creatingPage.value = true
  try {
    const p = await apiClient.ensureUiPage({
      appId: appId.value,
      pageId: newPageId.value.trim().toUpperCase().replace(/-/g, '_'),
      nameZh: newPageNameZh.value.trim()
    })
    await loadPages()
    pageId.value = p.pageId
    pageNameZh.value = p.nameZh
    newPageVisible.value = false
    ElMessage.success(`已创建页面「${p.nameZh}」`)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    creatingPage.value = false
  }
}

function quickPrivacy() {
  pageId.value = 'PRIVACY_WARM_TIP'
  pageNameZh.value = '温馨提示弹窗'
  void ensureQuickPage()
}

function quickLoginPhone() {
  pageId.value = 'LOGIN_PHONE'
  pageNameZh.value = '输入手机号'
  void ensureQuickPage()
}

function quickDiscover() {
  pageId.value = 'CS_DISCOVER'
  pageNameZh.value = 'CS-发现页'
  void ensureQuickPage()
}

async function ensureQuickPage() {
  if (!appId.value || !pageId.value) return
  try {
    await apiClient.ensureUiPage({
      appId: appId.value,
      pageId: pageId.value,
      nameZh: pageNameZh.value
    })
    await loadPages()
  } catch {
    /* 写入导入时仍会 ensure */
  }
}

function optionKey(o: LocatorOption) {
  return `${o.locatorType}|||${o.locatorValue}`
}
function primaryKey(row: any) {
  return optionKey({ locatorType: row.locatorType, locatorValue: row.locatorValue })
}
function setPrimary(row: any, key: string) {
  const opts: LocatorOption[] = row.locatorOptions || []
  const found = opts.find((o) => optionKey(o) === key)
  if (!found) return
  row.locatorType = found.locatorType
  row.locatorValue = found.locatorValue
  row.locatorFallbacks = opts.filter((o) => optionKey(o) !== key)
}
function fallbacksOf(row: any): LocatorOption[] {
  if (Array.isArray(row.locatorFallbacks) && row.locatorFallbacks.length) return row.locatorFallbacks
  const opts: LocatorOption[] = row.locatorOptions || []
  return opts.filter((o) => !(o.locatorType === row.locatorType && o.locatorValue === row.locatorValue))
}

function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    xml.value = String(reader.result || '')
    ElMessage.success('已读入文件')
  }
  reader.readAsText(file)
  input.value = ''
}

async function doParse() {
  if (!xml.value.trim()) {
    ElMessage.warning('请粘贴 XML')
    return
  }
  parsing.value = true
  selectedRows.value = []
  try {
    const res = await apiClient.parseInspectorXml({ platform: platform.value, xml: xml.value })
    const list = (res?.candidates || []).map((c: any, i: number) => {
      const opts = c.locatorOptions || []
      return {
        ...c,
        rowKey: `${c.locatorType}|${c.locatorValue}|${i}`,
        locatorOptions: opts,
        locatorFallbacks: c.locatorFallbacks?.length
          ? c.locatorFallbacks
          : opts.filter(
              (o: LocatorOption) =>
                !(o.locatorType === c.locatorType && o.locatorValue === c.locatorValue)
            )
      }
    })
    candidates.value = list
    // XML 里常夹带「温馨提示」文案，解析会标 pageId=PRIVACY_WARM_TIP；
    // 绝不能覆盖用户已选的归属页（用户协议弹窗也会被改回去）。
    // 仅在尚未选择归属页时，才用暗示帮填一次。
    if (!pageId.value?.trim()) {
      const hinted = list.find((c: any) => c.pageId)?.pageId
      if (hinted === 'PRIVACY_WARM_TIP') quickPrivacy()
    }
    await nextTick()
    selectSuggested()
    ElMessage.success(`解析完成：${list.length} 个`)
  } catch (e: any) {
    ElMessage.error(e?.message || '解析失败')
  } finally {
    parsing.value = false
  }
}

function onSelectionChange(rows: any[]) {
  selectedRows.value = rows
}
function selectSuggested() {
  const table = tableRef.value
  if (!table) return
  table.clearSelection()
  candidates.value.forEach((row) => {
    if (row.selected) table.toggleRowSelection(row, true)
  })
}
function selectAll() {
  tableRef.value?.clearSelection()
  candidates.value.forEach((row) => tableRef.value?.toggleRowSelection(row, true))
}
function clearSelect() {
  tableRef.value?.clearSelection()
}

async function doImport() {
  if (!appId.value) {
    ElMessage.warning('请选择应用')
    return
  }
  if (!pageId.value?.trim()) {
    ElMessage.warning('请选择或填写归属页面')
    return
  }
  if (!pageNameZh.value?.trim()) {
    ElMessage.warning('请填写页面中文名')
    return
  }
  if (!selectedRows.value.length) {
    ElMessage.warning('请勾选要入库的元素')
    return
  }
  importing.value = true
  try {
    const items = selectedRows.value.map((row) => ({
      ...row,
      locatorFallbacks: fallbacksOf(row),
      pageId: pageId.value.trim()
    }))
    const res = await apiClient.importInspectorXml({
      appId: appId.value,
      platform: platform.value,
      status: importStatus.value,
      pageId: pageId.value.trim(),
      pageNameZh: pageNameZh.value.trim(),
      items
    })
    const n = res?.createdCount ?? res?.created?.length ?? 0
    const skipped = res?.skippedCount ?? res?.skipped?.length ?? 0
    const errs = res?.errors || []
    const created = res?.created || []
    // 跨页同名时后端会把 cancel 写成 cancel_pw_user_agreement_popup，把实际 key 告诉用户
    const tips = created
      .map((el: any) => {
        const zh = el?.nameZh || ''
        const en = el?.nameEn || ''
        return zh && en ? `${zh}→${en}` : en
      })
      .filter(Boolean)
      .slice(0, 3)

    await loadPages()
    if (errs.length) {
      ElMessage.warning(`写入 ${n} 个，跳过 ${skipped} 个，失败 ${errs.length} 个：${errs[0]}`)
    } else if (skipped > 0) {
      ElMessage.success(
        `新写入 ${n} 个；跳过 ${skipped} 个（仅本页同定位才算重复）。${res?.skipped?.[0] || ''}`
      )
      if (res?.skipped?.[0]) {
        console.info('[inspector-import] skipped:', res.skipped)
      }
    } else if (tips.length) {
      ElMessage.success(`已写入「${pageNameZh.value}」下 ${n} 个元素（${tips.join('，')}${n > 3 ? '…' : ''}）`)
    } else {
      ElMessage.success(`已写入「${pageNameZh.value}」下 ${n} 个元素`)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.inspector-import { padding: 4px; }
.card-head { display: flex; flex-direction: column; gap: 4px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.page-block {
  width: 100%;
}
.page-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: 100%;
}
.page-row.quick {
  margin-top: 8px;
}
.quick-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.page-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
.page-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: 100%;
}
.upload-row { margin-top: 8px; display: flex; gap: 8px; }
.result { margin-top: 8px; }
.result-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; gap: 12px; flex-wrap: wrap;
}
.fb-list { display: flex; flex-wrap: wrap; gap: 4px; }
.muted { color: var(--el-text-color-placeholder); font-size: 12px; }
</style>
