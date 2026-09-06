<template>
  <div class="h5-pages">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">H5 页面汇总</span>
            <p class="sub">
              先维护 URL 目录；点击「打开」在右侧预览（内嵌 WebView/iframe）。登录态用本地 token（query），后续可逐步补全各业务 H5。
            </p>
          </div>
          <div class="header-actions">
            <el-select v-model="filterAppId" clearable placeholder="应用" style="width: 180px" @change="load">
              <el-option
                v-for="a in apps"
                :key="a.id"
                :label="a.nameZh || a.name || a.id"
                :value="a.id"
              />
            </el-select>
            <el-button @click="load">刷新</el-button>
            <el-button type="primary" @click="openCreate">新建 H5 页</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="pages" stripe @row-click="onRowClick">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="moduleTag" label="模块" width="100" />
        <el-table-column label="URL" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="url">{{ row.url }}</code>
          </template>
        </el-table-column>
        <el-table-column label="Token" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.authToken ? 'success' : 'info'">
              {{ row.authToken ? '已填' : '未填' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled === false ? 'info' : 'success'">
              {{ row.enabled === false ? '否' : '是' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="openViewer(row)">打开</el-button>
            <el-button link @click.stop="openEdit(row)">编辑</el-button>
            <el-button v-perm:delete type="danger" link @click.stop="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 预览抽屉：内嵌 iframe = WebView 体验 -->
    <el-drawer
      v-model="viewerVisible"
      :title="viewerTitle"
      size="88%"
      destroy-on-close
      append-to-body
      :z-index="4000"
    >
      <div class="viewer-toolbar">
        <el-input :model-value="openUrl" readonly>
          <template #prepend>预览URL</template>
        </el-input>
        <el-button @click="reloadFrame">刷新</el-button>
        <el-button @click="copyOpenUrl">复制链接</el-button>
        <el-button :loading="probing" @click="probeApi">接口验活</el-button>
        <el-button type="primary" @click="openExternal">系统浏览器打开</el-button>
      </div>
      <el-alert
        v-if="openNote"
        class="viewer-note"
        type="info"
        :title="openNote"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="probeMsg"
        class="viewer-note"
        :type="probeOk ? 'success' : 'error'"
        :title="probeMsg"
        show-icon
        closable
        @close="probeMsg = ''"
      />
      <el-alert
        class="viewer-note"
        type="warning"
        title="H5 壳页面 ≠ 业务接口。拉帖真实地址是 appengine.wmpvp.com/.../getPostById。内嵌空白时请先「接口验活」，或系统浏览器打开。"
        show-icon
        :closable="false"
      />
      <div class="viewer-frame-wrap">
        <iframe
          v-if="openUrl"
          :key="frameKey"
          class="viewer-frame"
          :src="openUrl"
          title="H5 Preview"
        />
      </div>
    </el-drawer>

    <!-- 新建/编辑 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑 H5 页' : '新建 H5 页'" width="640px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：社区帖详情" />
        </el-form-item>
        <el-form-item label="URL" required>
          <el-input v-model="form.url" type="textarea" :rows="2" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="应用">
          <el-select v-model="form.appId" clearable filterable style="width: 100%">
            <el-option
              v-for="a in apps"
              :key="a.id"
              :label="a.nameZh || a.name || a.id"
              :value="a.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="form.moduleTag" placeholder="社区 / 赛事 / 数据…" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="鉴权方式">
          <el-select v-model="form.authType" style="width: 100%">
            <el-option label="URL 拼 token（TOKEN_QUERY）" value="TOKEN_QUERY" />
            <el-option label="Cookie 登录态（TOKEN_COOKIE）" value="TOKEN_COOKIE" />
            <el-option label="无（NONE）" value="NONE" />
            <el-option label="手动浏览器登录（MANUAL）" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="Token 参数名">
          <el-input v-model="form.authKey" placeholder="默认 token" />
        </el-form-item>
        <el-form-item label="登录 Token">
          <el-input
            v-model="form.authToken"
            type="password"
            show-password
            placeholder="仅存本地库，勿提交 Git"
          />
        </el-form-item>
        <el-form-item v-if="form.authType === 'TOKEN_COOKIE'" label="Cookie 登录态">
          <el-input
            v-model="form.authCookies"
            type="textarea"
            :rows="3"
            placeholder='{"PVP_APP_TOKEN":"...","PVP_APP_STEAMID":"...","PVP_APP_USERID":"..."}'
          />
          <div class="tip">
            有些活动页的登录态在 Cookie 里而不是 URL 上，而且要好几个都在才认——
            只给 token 页面会停在「去登录」，且不报任何错。
            从已登录的 WebView 里拷，或抓包看请求头。
          </div>
        </el-form-item>
        <el-form-item v-if="form.authType === 'TOKEN_COOKIE'" label="Cookie 域">
          <el-input v-model="form.cookieDomain" placeholder="留空按页面域名自动推导" />
          <div class="tip">
            域不匹配时浏览器会直接丢弃 Cookie，表现同样是「未登录」且无报错。一般留空即可。
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'

const loading = ref(false)
const saving = ref(false)
const pages = ref<any[]>([])
const apps = ref<any[]>([])
const filterAppId = ref('DOMESTIC_ESPORTS')

const viewerVisible = ref(false)
const viewerTitle = ref('')
const viewerId = ref('')
const openUrl = ref('')
const openNote = ref('')
const frameKey = ref(0)
const probing = ref(false)
const probeMsg = ref('')
const probeOk = ref(false)

const formVisible = ref(false)
const form = reactive({
  id: '' as string,
  name: '',
  url: '',
  appId: 'DOMESTIC_ESPORTS',
  moduleTag: '',
  description: '',
  authType: 'TOKEN_QUERY',
  authKey: 'token',
  authToken: '',
  authCookies: '',
  cookieDomain: '',
  enabled: true,
  sortOrder: 100
})

async function loadApps() {
  try {
    apps.value = (await apiClient.getUiApps()) as any[]
  } catch {
    apps.value = []
  }
}

async function load() {
  loading.value = true
  try {
    pages.value = await apiClient.getUiH5Pages({
      appId: filterAppId.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
    pages.value = []
  } finally {
    loading.value = false
  }
}

function onRowClick(row: any) {
  openViewer(row)
}

async function openViewer(row: any) {
  viewerTitle.value = row.name || 'H5 预览'
  viewerId.value = row.id
  probeMsg.value = ''
  try {
    const info = await apiClient.getUiH5PageOpen(row.id)
    openUrl.value = String(info.openUrl || row.url || '')
    openNote.value = String(info.note || '')
    if (!info.hasToken && row.authType === 'TOKEN_QUERY') {
      ElMessage.warning('该页尚未配置 token，预览可能未登录')
    }
    frameKey.value += 1
    viewerVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '打开失败')
  }
}

async function probeApi() {
  if (!viewerId.value) return
  probing.value = true
  probeMsg.value = ''
  try {
    const r = await apiClient.probeUiH5Page(viewerId.value)
    probeOk.value = !!r.ok
    const title = r.postTitle ? `「${r.postTitle}」` : ''
    probeMsg.value = `${r.message}${title ? ' ' + title : ''}${r.apiUrl ? ' | ' + r.apiUrl : ''}`
  } catch (e: any) {
    probeOk.value = false
    probeMsg.value = e?.message || '验活失败'
  } finally {
    probing.value = false
  }
}

function reloadFrame() {
  frameKey.value += 1
}

async function copyOpenUrl() {
  if (!openUrl.value) return
  try {
    await navigator.clipboard.writeText(openUrl.value)
    ElMessage.success('已复制预览链接')
  } catch {
    ElMessage.warning('复制失败，请手动选中地址栏')
  }
}

function openExternal() {
  if (!openUrl.value) return
  window.open(openUrl.value, '_blank')
}

function openCreate() {
  Object.assign(form, {
    id: '',
    name: '',
    url: '',
    appId: filterAppId.value || 'DOMESTIC_ESPORTS',
    moduleTag: '',
    description: '',
    authType: 'TOKEN_QUERY',
    authKey: 'token',
    authToken: '',
    authCookies: '',
    cookieDomain: '',
    enabled: true,
    sortOrder: 100
  })
  formVisible.value = true
}

function openEdit(row: any) {
  Object.assign(form, {
    id: row.id,
    name: row.name || '',
    url: row.url || '',
    appId: row.appId || '',
    moduleTag: row.moduleTag || '',
    description: row.description || '',
    authType: row.authType || 'TOKEN_QUERY',
    authKey: row.authKey || 'token',
    authToken: row.authToken || '',
    authCookies: row.authCookies || '',
    cookieDomain: row.cookieDomain || '',
    enabled: row.enabled !== false,
    sortOrder: row.sortOrder ?? 100
  })
  formVisible.value = true
}

async function saveForm() {
  if (!form.name.trim() || !form.url.trim()) {
    ElMessage.warning('请填写名称和 URL')
    return
  }
  // 存之前就把格式问题挡住。存进去坏格式的话，症状是页面「未登录」——
  // 跟没配、跟 token 过期长得一模一样，回头得从头查一遍
  if (form.authType === 'TOKEN_COOKIE') {
    const raw = form.authCookies.trim()
    if (!raw) {
      ElMessage.warning('Cookie 登录态不能为空，否则页面会停在未登录')
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        ElMessage.warning('Cookie 登录态要是 JSON 对象，形如 {"PVP_APP_TOKEN":"..."}')
        return
      }
      if (!Object.keys(parsed).length) {
        ElMessage.warning('Cookie 登录态是空对象，等于没配')
        return
      }
    } catch {
      ElMessage.warning('Cookie 登录态不是合法 JSON，检查引号和逗号')
      return
    }
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      url: form.url.trim(),
      appId: form.appId || null,
      moduleTag: form.moduleTag.trim() || null,
      description: form.description.trim() || null,
      authType: form.authType,
      authKey: form.authKey.trim() || 'token',
      authToken: form.authToken.trim() || null,
      authCookies: form.authCookies.trim() || null,
      cookieDomain: form.cookieDomain.trim() || null,
      enabled: form.enabled,
      sortOrder: form.sortOrder
    }
    if (form.id) {
      await apiClient.updateUiH5Page(form.id, body)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiH5Page(body)
      ElMessage.success('已创建')
    }
    formVisible.value = false
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`删除 H5 页「${row.name}」？`, '删除', { type: 'warning' })
    await apiClient.deleteUiH5Page(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadApps()
  await load()
})
</script>

<style scoped>
.h5-pages {
  padding: 4px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
  max-width: 720px;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.url {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.viewer-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}
.viewer-toolbar .el-input {
  flex: 1;
}
.viewer-note {
  margin-bottom: 10px;
}
.viewer-frame-wrap {
  height: calc(100vh - 220px);
  min-height: 480px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--app-surface);
}
.viewer-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
</style>
