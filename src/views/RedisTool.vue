<template>
  <div class="redis-tool">
    <div class="rt-head">
      <div class="rt-head-left">
        <h2 class="rt-title">Redis 查询</h2>
        <el-select
          v-model="connId"
          class="rt-conn"
          placeholder="选一个连接"
          :loading="loadingConns"
          no-data-text="还没有连接，点右边「新建连接」"
          @change="onConnChange"
        >
          <el-option v-for="c in connections" :key="c.id" :label="c.name" :value="c.id">
            <span class="rt-opt">
              <el-tag size="small" :type="c.environment === 'TEST' ? 'success' : 'danger'" effect="plain">
                {{ c.environment === 'TEST' ? '测试' : '生产' }}
              </el-tag>
              <span class="rt-opt-name">{{ c.name }}</span>
              <span class="rt-opt-addr">{{ c.host }}:{{ c.port || 6379 }}{{ c.dbIndex ? ` / db${c.dbIndex}` : '' }}</span>
            </span>
          </el-option>
        </el-select>
        <template v-if="current">
          <el-tag v-if="readOnly" type="danger" effect="light">生产 · 只读</el-tag>
          <el-tag v-else type="success" effect="light">测试环境 · 可改</el-tag>
          <span v-if="probe?.ok" class="rt-probe ok">
            <i class="dot" />Redis {{ probe.version }} · {{ modeLabel(probe.mode) }} · {{ probe.dbSize }} 个 key · {{ probe.elapsedMs }}ms
          </span>
          <span v-else-if="probe" class="rt-probe bad"><i class="dot" />{{ probe.message }}</span>
        </template>
      </div>
      <div class="rt-head-right">
        <el-button v-if="current" :loading="probing" @click="ping">测试连接</el-button>
        <el-button v-if="current" :disabled="!canWrite" @click="openEdit(current)">编辑</el-button>
        <el-button v-if="current" :disabled="!canDelete" :title="canDelete ? '' : '需要管理员权限'" @click="removeConn(current)">删除</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openEdit(null)">新建连接</el-button>
      </div>
    </div>

    <el-empty v-if="!loadingConns && !connections.length" description="还没有 Redis 连接">
      <el-button type="primary" :disabled="!canWrite" @click="openEdit(null)">新建连接</el-button>
    </el-empty>

    <div v-else class="rt-body">
      <!-- 左：按 key / 前缀查 -->
      <el-card class="rt-left" shadow="never">
        <div class="rt-search">
          <el-input
            v-model="pattern"
            clearable
            placeholder="key 或前缀，如 user:info:*"
            :disabled="!current"
            @keyup.enter="search()"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" :loading="scanning" :disabled="!current" @click="search()">查询</el-button>
        </div>
        <div class="rt-search-tip">带 <code>*</code> 按模式扫，不带就按精确 key 查</div>

        <div v-if="scanned" class="rt-list-bar">
          <el-checkbox
            v-if="!readOnly && keys.length"
            :model-value="allChecked"
            :indeterminate="checked.size > 0 && !allChecked"
            @change="toggleAll"
          />
          <span class="rt-count">
            {{ keys.length ? `找到 ${keys.length} 个` : '没找到' }}{{ cursor ? '，还没扫完' : '' }}
          </span>
          <el-button
            v-if="!readOnly && checked.size"
            size="small"
            type="danger"
            plain
            :disabled="!canWrite"
            :loading="deleting"
            @click="deleteChecked"
          >删除选中 {{ checked.size }}</el-button>
        </div>

        <div v-loading="scanning && !keys.length" class="rt-list">
          <div
            v-for="k in keys"
            :key="k.key"
            class="rt-row"
            :class="{ active: k.key === activeKey }"
            @click="open(k.key)"
          >
            <el-checkbox
              v-if="!readOnly"
              :model-value="checked.has(k.key)"
              @click.stop
              @change="(v: any) => toggle(k.key, !!v)"
            />
            <span class="rt-type" :class="`t-${k.type}`">{{ typeLabel(k.type) }}</span>
            <span class="rt-key" :title="k.key">{{ k.key }}</span>
            <span class="rt-ttl" :class="{ forever: k.ttlMs === -1 }">{{ shortTtl(k.ttlMs) }}</span>
          </div>
          <div v-if="scanned && !keys.length && !scanning" class="rt-none">
            {{ lastExact ? '这个 key 不存在：可能已经过期，或还没写进缓存——先调一次接口再查' : '没有匹配的 key' }}
          </div>
          <el-button v-if="cursor" class="rt-more" text type="primary" :loading="scanning" @click="search(true)">
            继续扫
          </el-button>
        </div>
      </el-card>

      <!-- 右：看值 -->
      <el-card class="rt-right" shadow="never">
        <div v-if="!activeKey" class="rt-placeholder">
          <el-icon :size="34"><Coin /></el-icon>
          <div>左边查到 key 后点一下，这里看值</div>
        </div>

        <div v-else v-loading="inspecting" class="rt-detail">
          <div class="rt-d-head">
            <code class="rt-d-key">{{ activeKey }}</code>
            <el-button link type="primary" size="small" @click="copy(activeKey)">复制</el-button>
            <el-button link size="small" :loading="inspecting" @click="open(activeKey)">刷新</el-button>
          </div>

          <template v-if="detail && !detail.exists">
            <el-empty description="key 不存在，可能刚过期或被删了" :image-size="80" />
          </template>

          <template v-else-if="detail">
            <div class="rt-meta">
              <span class="rt-type big" :class="`t-${detail.type}`">{{ typeLabel(detail.type) }}</span>
              <span class="rt-meta-item">过期：<b>{{ formatTtl(detail.ttlMs) }}</b>
                <el-button v-if="!readOnly" link type="primary" size="small" :disabled="!canWrite" @click="openTtl">改</el-button>
              </span>
              <span v-if="detail.type !== 'string'" class="rt-meta-item">共 <b>{{ detail.size }}</b> 条</span>
              <span v-else-if="detail.value" class="rt-meta-item">大小 <b>{{ formatBytes(detail.value.bytes) }}</b></span>
              <span v-if="detail.memoryBytes" class="rt-meta-item">内存 {{ formatBytes(detail.memoryBytes) }}</span>
              <span class="rt-spacer" />
              <el-button v-if="!readOnly" size="small" type="danger" plain :disabled="!canWrite" @click="deleteOne(activeKey)">删除 key</el-button>
            </div>

            <el-alert v-if="detail.unsupported" type="info" :closable="false" :title="detail.unsupported" />

            <!-- string -->
            <template v-if="detail.type === 'string' && detail.value">
              <div class="rt-val-bar">
                <el-tag size="small" effect="plain" :type="formatTag(detail.value.format)">{{ formatLabel(detail.value.format) }}</el-tag>
                <el-tag v-if="detail.value.gzip" size="small" effect="plain" type="warning">gzip 已解压</el-tag>
                <span v-if="detail.value.truncated" class="rt-warn">值太大，只显示前一部分</span>
                <span class="rt-spacer" />
                <el-button size="small" @click="copy(detail.value.text)">复制值</el-button>
                <el-tooltip
                  v-if="!readOnly"
                  :disabled="detail.value.editable"
                  :content="notEditableReason(detail.value)"
                  placement="top"
                >
                  <span>
                    <el-button size="small" type="primary" plain :disabled="!canWrite || !detail.value.editable" @click="startEdit">编辑</el-button>
                  </span>
                </el-tooltip>
              </div>
              <template v-if="editing">
                <el-input v-model="editText" type="textarea" :autosize="{ minRows: 8, maxRows: 26 }" class="rt-editor" />
                <div class="rt-edit-bar">
                  <el-checkbox v-model="keepTtl" :disabled="!(detail.ttlMs && detail.ttlMs > 0)">保留剩余过期时间</el-checkbox>
                  <span class="rt-spacer" />
                  <el-button size="small" @click="editing = false">取消</el-button>
                  <el-button size="small" type="primary" :loading="saving" @click="saveString">保存</el-button>
                </div>
              </template>
              <pre v-else class="rt-pre" :class="{ json: detail.value.format === 'JSON' }">{{ detail.value.text }}</pre>
            </template>

            <!-- 集合类 -->
            <template v-else-if="detail.items">
              <div class="rt-val-bar">
                <span v-if="detail.itemsTruncated" class="rt-warn">只显示前 {{ detail.items.length }} 条，共 {{ detail.size }} 条</span>
                <span class="rt-spacer" />
                <el-button v-if="detail.type === 'hash' && !readOnly" size="small" type="primary" plain :disabled="!canWrite" @click="openField(null)">
                  新增 field
                </el-button>
              </div>
              <el-table :data="detail.items" size="small" border max-height="560" class="rt-items">
                <el-table-column v-if="detail.type === 'list'" label="#" width="60" align="center">
                  <template #default="{ row }">{{ row.index }}</template>
                </el-table-column>
                <el-table-column v-if="detail.type === 'stream'" label="ID" width="170">
                  <template #default="{ row }"><code>{{ row.id }}</code></template>
                </el-table-column>
                <el-table-column v-if="detail.type === 'hash'" label="field" min-width="160">
                  <template #default="{ row }"><code class="rt-field">{{ row.field }}</code></template>
                </el-table-column>
                <el-table-column label="value" min-width="300">
                  <template #default="{ row }">
                    <div class="rt-cell">
                      <el-tag v-if="row.value.format !== 'TEXT'" size="small" effect="plain" :type="formatTag(row.value.format)">
                        {{ formatLabel(row.value.format) }}
                      </el-tag>
                      <pre class="rt-cell-pre">{{ row.value.text }}</pre>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column v-if="detail.type === 'zset'" label="score" width="120">
                  <template #default="{ row }">{{ row.score }}</template>
                </el-table-column>
                <el-table-column label="" :width="detail.type === 'hash' && !readOnly ? 140 : 70" align="right">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="copy(row.value.text)">复制</el-button>
                    <template v-if="detail.type === 'hash' && !readOnly">
                      <el-button link type="primary" size="small" :disabled="!canWrite || !row.value.editable" @click="openField(row)">改</el-button>
                      <el-button link type="danger" size="small" :disabled="!canWrite" @click="deleteField(row.field)">删</el-button>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
            </template>
          </template>
        </div>
      </el-card>
    </div>

    <!-- 连接 -->
    <el-dialog v-model="connDialog" :title="form.id ? '编辑连接' : '新建 Redis 连接'" width="520px" destroy-on-close>
      <el-form label-width="84px" class="rt-form">
        <el-form-item label="环境">
          <el-radio-group v-model="form.environment" :disabled="!!form.id">
            <el-radio-button value="TEST">测试环境</el-radio-button>
            <el-radio-button value="PROD">生产环境（只读）</el-radio-button>
          </el-radio-group>
          <span v-if="form.id" class="rt-form-tip">建好后不能改</span>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="32" placeholder="如 用户中心缓存" />
        </el-form-item>
        <el-form-item label="地址" required>
          <div class="rt-addr">
            <el-input v-model="form.host" placeholder="IP 或域名，也可直接粘 IP:端口" />
            <el-input-number v-model="form.port" :min="1" :max="65535" :controls="false" placeholder="6379" />
          </div>
        </el-form-item>
        <el-form-item label="库号">
          <el-input-number v-model="form.dbIndex" :min="0" :max="255" />
          <span class="rt-form-tip">集群模式只有 0 号库</span>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="Redis 6 以上开了 ACL 才需要，一般留空" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="没设密码就留空" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="选填" />
        </el-form-item>
      </el-form>
      <div v-if="draftProbe" class="rt-draft-probe" :class="draftProbe.ok ? 'ok' : 'bad'">
        {{ draftProbe.ok ? `连上了：Redis ${draftProbe.version} · ${modeLabel(draftProbe.mode)} · ${draftProbe.dbSize} 个 key · ${draftProbe.elapsedMs}ms` : draftProbe.message }}
      </div>
      <template #footer>
        <el-button :loading="draftProbing" @click="probeDraft">测试连接</el-button>
        <el-button @click="connDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingConn" @click="saveConn">保存</el-button>
      </template>
    </el-dialog>

    <!-- 过期时间 -->
    <el-dialog v-model="ttlDialog" title="改过期时间" width="400px">
      <el-radio-group v-model="ttlMode" class="rt-ttl-mode">
        <el-radio value="set">设为</el-radio>
        <el-radio value="persist">永不过期</el-radio>
      </el-radio-group>
      <div v-if="ttlMode === 'set'" class="rt-ttl-input">
        <el-input-number v-model="ttlValue" :min="1" />
        <el-select v-model="ttlUnit" style="width: 90px">
          <el-option label="秒" :value="1" />
          <el-option label="分钟" :value="60" />
          <el-option label="小时" :value="3600" />
          <el-option label="天" :value="86400" />
        </el-select>
        <span class="rt-form-tip">后过期</span>
      </div>
      <template #footer>
        <el-button @click="ttlDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTtl">确定</el-button>
      </template>
    </el-dialog>

    <!-- hash field -->
    <el-dialog v-model="fieldDialog" :title="fieldForm.isNew ? '新增 field' : '修改 field'" width="560px">
      <el-form label-width="60px">
        <el-form-item label="field">
          <el-input v-model="fieldForm.field" :disabled="!fieldForm.isNew" />
        </el-form-item>
        <el-form-item label="value">
          <el-input v-model="fieldForm.value" type="textarea" :autosize="{ minRows: 4, maxRows: 18 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fieldDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveField">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  apiClient,
  type RedisConnection,
  type RedisKeyDetail,
  type RedisKeyRow,
  type RedisProbe,
  type RedisValueView
} from '@/api'
import { canDelete, canWrite } from '@/stores/auth'
import { formatBytes, formatTtl } from '@/utils/redisKey'

const LAST_CONN = 'redis-tool:last-conn'
const route = useRoute()

const connections = ref<RedisConnection[]>([])
const loadingConns = ref(false)
const connId = ref<string>('')
const current = computed(() => connections.value.find(c => c.id === connId.value) || null)
const readOnly = computed(() => current.value?.environment !== 'TEST')

const probe = ref<RedisProbe | null>(null)
const probing = ref(false)

const pattern = ref('')
const keys = ref<RedisKeyRow[]>([])
const cursor = ref<string | null>(null)
const scanning = ref(false)
const scanned = ref(false)
const lastExact = ref(false)
const checked = ref(new Set<string>())
const deleting = ref(false)

const activeKey = ref('')
const detail = ref<RedisKeyDetail | null>(null)
const inspecting = ref(false)

const editing = ref(false)
const editText = ref('')
const keepTtl = ref(true)
const saving = ref(false)

const TYPE_LABELS: Record<string, string> = {
  string: 'STR',
  hash: 'HASH',
  list: 'LIST',
  set: 'SET',
  zset: 'ZSET',
  stream: 'STREAM'
}
const typeLabel = (t: string) => TYPE_LABELS[t] || t.toUpperCase()
const modeLabel = (m?: string) => (m === 'cluster' ? '集群' : m === 'sentinel' ? '哨兵' : '单机')

const FORMAT_LABELS: Record<string, string> = {
  TEXT: '文本',
  JSON: 'JSON',
  JAVA_SERIALIZED: 'Java 序列化',
  BINARY: '二进制'
}
const formatLabel = (f: string) => FORMAT_LABELS[f] || f
const formatTag = (f: string) => (f === 'JSON' ? 'success' : f === 'TEXT' ? 'info' : 'warning')

function notEditableReason(v: RedisValueView) {
  if (v.truncated) return '值太大只拿了一部分，改了会把后面的截掉'
  if (v.gzip) return '值是 gzip 压缩的，按文本存回去程序就读不出来了'
  if (v.format === 'JAVA_SERIALIZED') return 'Java 序列化对象改不了，要改得删掉 key 让程序重新写'
  return '二进制值不能按文本改'
}

function shortTtl(ms: number | null) {
  if (ms == null || ms === -1) return '∞'
  return formatTtl(ms).replace(/ (\d+) (秒|分)$/, '')
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

// ---------- 连接 ----------

async function loadConnections() {
  loadingConns.value = true
  try {
    connections.value = await apiClient.listRedisConnections()
    if (!current.value) {
      const last = localStorage.getItem(LAST_CONN)
      const pick = connections.value.find(c => c.id === last) || connections.value.find(c => c.environment === 'TEST') || connections.value[0]
      connId.value = pick?.id || ''
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载连接失败')
  } finally {
    loadingConns.value = false
  }
}

function resetResult() {
  keys.value = []
  cursor.value = null
  scanned.value = false
  checked.value = new Set()
  activeKey.value = ''
  detail.value = null
  editing.value = false
}

function onConnChange() {
  localStorage.setItem(LAST_CONN, connId.value)
  probe.value = null
  resetResult()
  ping()
}

async function ping() {
  if (!current.value) return
  probing.value = true
  try {
    probe.value = await apiClient.pingRedisConnection(current.value.id)
  } catch (e: any) {
    probe.value = { ok: false, message: e.message || '连不上' }
  } finally {
    probing.value = false
  }
}

const connDialog = ref(false)
const savingConn = ref(false)
const draftProbing = ref(false)
const draftProbe = ref<RedisProbe | null>(null)
const emptyForm = (): Partial<RedisConnection> => ({
  environment: 'TEST',
  name: '',
  host: '',
  port: 6379,
  dbIndex: 0,
  username: '',
  password: '',
  remark: ''
})
const form = reactive<Partial<RedisConnection>>(emptyForm())

function openEdit(c: RedisConnection | null) {
  Object.assign(form, emptyForm(), c ? { ...c } : { id: undefined })
  draftProbe.value = null
  connDialog.value = true
}

async function probeDraft() {
  draftProbing.value = true
  try {
    draftProbe.value = await apiClient.probeRedisConnection({ ...form })
  } catch (e: any) {
    draftProbe.value = { ok: false, message: e.message || '连不上' }
  } finally {
    draftProbing.value = false
  }
}

async function saveConn() {
  savingConn.value = true
  try {
    const saved = await apiClient.saveRedisConnection({ ...form })
    connDialog.value = false
    ElMessage.success('已保存')
    await loadConnections()
    if (connId.value !== saved.id) {
      connId.value = saved.id
    }
    onConnChange()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    savingConn.value = false
  }
}

async function removeConn(c: RedisConnection) {
  try {
    await ElMessageBox.confirm(`删除连接「${c.name}」？只删这里的配置，不影响 Redis 本身。`, '删除连接', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteRedisConnection(c.id)
    connId.value = ''
    probe.value = null
    resetResult()
    await loadConnections()
    if (connId.value) onConnChange()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

// ---------- 查 ----------

async function search(more = false) {
  if (!current.value) return
  const p = pattern.value.trim() || '*'
  if (!more) {
    keys.value = []
    cursor.value = null
    checked.value = new Set()
  }
  scanning.value = true
  try {
    const r = await apiClient.scanRedisKeys(current.value.id, p, more ? cursor.value : null)
    const seen = new Set(keys.value.map(k => k.key))
    keys.value = keys.value.concat(r.keys.filter(k => !seen.has(k.key)))
    cursor.value = r.cursor
    lastExact.value = r.exact
    scanned.value = true
    if (!more && keys.value.length === 1) {
      open(keys.value[0].key)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '查询失败')
  } finally {
    scanning.value = false
  }
}

async function open(key: string) {
  if (!current.value) return
  activeKey.value = key
  editing.value = false
  inspecting.value = true
  try {
    detail.value = await apiClient.inspectRedisKey(current.value.id, key)
  } catch (e: any) {
    detail.value = null
    ElMessage.error(e.message || '读取失败')
  } finally {
    inspecting.value = false
  }
}

const allChecked = computed(() => keys.value.length > 0 && checked.value.size === keys.value.length)
function toggle(key: string, on: boolean) {
  const s = new Set(checked.value)
  on ? s.add(key) : s.delete(key)
  checked.value = s
}
function toggleAll(v: any) {
  checked.value = v ? new Set(keys.value.map(k => k.key)) : new Set()
}

// ---------- 改 ----------

async function confirmDelete(list: string[]) {
  const preview = list.slice(0, 5).join('\n') + (list.length > 5 ? `\n…共 ${list.length} 个` : '')
  try {
    await ElMessageBox.confirm(preview, `删除 ${list.length} 个 key？`, {
      type: 'warning',
      confirmButtonText: '删除',
      customClass: 'rt-del-confirm'
    })
    return true
  } catch {
    return false
  }
}

async function removeKeys(list: string[]) {
  if (!current.value || !(await confirmDelete(list))) return
  deleting.value = true
  try {
    const r = await apiClient.deleteRedisKeys(current.value.id, list)
    ElMessage.success(`删了 ${r.deleted} 个`)
    const gone = new Set(list)
    keys.value = keys.value.filter(k => !gone.has(k.key))
    checked.value = new Set([...checked.value].filter(k => !gone.has(k)))
    if (gone.has(activeKey.value)) {
      activeKey.value = ''
      detail.value = null
    }
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

const deleteChecked = () => removeKeys([...checked.value])
const deleteOne = (key: string) => removeKeys([key])

function startEdit() {
  if (!detail.value?.value) return
  editText.value = detail.value.value.text
  keepTtl.value = !!(detail.value.ttlMs && detail.value.ttlMs > 0)
  editing.value = true
}

async function saveString() {
  if (!current.value || !detail.value) return
  saving.value = true
  try {
    const ttl = keepTtl.value && detail.value.ttlMs && detail.value.ttlMs > 0 ? Math.ceil(detail.value.ttlMs / 1000) : null
    await apiClient.setRedisString(current.value.id, activeKey.value, editText.value, ttl)
    ElMessage.success('已保存')
    await open(activeKey.value)
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const ttlDialog = ref(false)
const ttlMode = ref<'set' | 'persist'>('set')
const ttlValue = ref(10)
const ttlUnit = ref(60)

function openTtl() {
  const ms = detail.value?.ttlMs ?? -1
  ttlMode.value = 'set'
  if (ms > 0) {
    const s = Math.ceil(ms / 1000)
    ttlUnit.value = s >= 86400 ? 86400 : s >= 3600 ? 3600 : s >= 60 ? 60 : 1
    ttlValue.value = Math.max(1, Math.round(s / ttlUnit.value))
  } else {
    ttlUnit.value = 60
    ttlValue.value = 10
  }
  ttlDialog.value = true
}

async function saveTtl() {
  if (!current.value) return
  saving.value = true
  try {
    const sec = ttlMode.value === 'persist' ? -1 : ttlValue.value * ttlUnit.value
    await apiClient.expireRedisKey(current.value.id, activeKey.value, sec)
    ttlDialog.value = false
    ElMessage.success('已修改')
    await open(activeKey.value)
  } catch (e: any) {
    ElMessage.error(e.message || '修改失败')
  } finally {
    saving.value = false
  }
}

const fieldDialog = ref(false)
const fieldForm = reactive({ isNew: true, field: '', value: '' })

function openField(row: { field?: string; value: RedisValueView } | null) {
  fieldForm.isNew = !row
  fieldForm.field = row?.field || ''
  fieldForm.value = row?.value.text || ''
  fieldDialog.value = true
}

async function saveField() {
  if (!current.value) return
  if (!fieldForm.field) {
    ElMessage.warning('field 不能为空')
    return
  }
  saving.value = true
  try {
    await apiClient.setRedisHashField(current.value.id, activeKey.value, fieldForm.field, fieldForm.value)
    fieldDialog.value = false
    ElMessage.success('已保存')
    await open(activeKey.value)
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteField(field?: string) {
  if (!current.value || !field) return
  try {
    await ElMessageBox.confirm(`删除 field「${field}」？`, '删除 field', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteRedisHashField(current.value.id, activeKey.value, field)
    await open(activeKey.value)
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

watch(
  () => (route.query.pattern || route.query.key || '') as string,
  q => {
    if (!q || q === pattern.value) return
    pattern.value = q
    if (current.value) search()
  }
)

onMounted(async () => {
  const q = (route.query.pattern || route.query.key || '') as string
  if (q) pattern.value = q
  await loadConnections()
  if (current.value) {
    ping()
    if (q) search()
  }
})
</script>

<style scoped>
.redis-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}
.rt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.rt-head-left,
.rt-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rt-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.rt-conn {
  width: 240px;
}
.rt-opt {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rt-opt-name {
  font-weight: 500;
}
.rt-opt-addr {
  margin-left: auto;
  color: #9ca3af;
  font-size: 12px;
}
.rt-probe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.rt-probe .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
}
.rt-probe.bad {
  color: #dc2626;
}
.rt-probe.bad .dot {
  background: #dc2626;
}

.rt-body {
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  flex: 1;
}
.rt-left :deep(.el-card__body),
.rt-right :deep(.el-card__body) {
  padding: 14px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.rt-search {
  display: flex;
  gap: 8px;
}
.rt-search-tip {
  margin: 6px 0 10px;
  font-size: 12px;
  color: #9ca3af;
}
.rt-search-tip code {
  padding: 0 4px;
  background: #f3f4f6;
  border-radius: 3px;
  color: #374151;
}
.rt-list-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid #f0f0f0;
}
.rt-count {
  font-size: 12px;
  color: #6b7280;
  flex: 1;
}
.rt-list {
  flex: 1;
  overflow-y: auto;
  min-height: 160px;
  max-height: calc(100vh - 300px);
}
.rt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.rt-row:hover {
  background: #f5f7fa;
}
.rt-row.active {
  background: #ecf5ff;
}
.rt-type {
  flex: none;
  min-width: 40px;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  background: #f3f4f6;
  color: #4b5563;
}
.rt-type.big {
  font-size: 12px;
  padding: 2px 8px;
}
.t-string { background: #eef2ff; color: #4f46e5; }
.t-hash { background: #ecfdf5; color: #059669; }
.t-list { background: #fff7ed; color: #c2410c; }
.t-set { background: #fdf2f8; color: #be185d; }
.t-zset { background: #f5f3ff; color: #7c3aed; }
.t-stream { background: #f0f9ff; color: #0369a1; }
.rt-key {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1f2937;
}
.rt-ttl {
  flex: none;
  font-size: 12px;
  color: #d97706;
}
.rt-ttl.forever {
  color: #9ca3af;
}
.rt-none {
  padding: 28px 12px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.7;
}
.rt-more {
  width: 100%;
  margin-top: 6px;
}

.rt-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #9ca3af;
  font-size: 13px;
  min-height: 320px;
}
.rt-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}
.rt-d-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rt-d-key {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  word-break: break-all;
}
.rt-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  flex-wrap: wrap;
}
.rt-meta b {
  color: #111827;
  font-weight: 600;
}
.rt-spacer {
  flex: 1;
}
.rt-val-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rt-warn {
  font-size: 12px;
  color: #d97706;
}
.rt-pre {
  margin: 0;
  padding: 12px 14px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: calc(100vh - 380px);
  overflow: auto;
}
.rt-pre.json {
  color: #a5f3fc;
}
.rt-editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}
.rt-edit-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rt-field {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #059669;
}
.rt-cell {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.rt-cell-pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow: auto;
}

.rt-addr {
  display: flex;
  gap: 8px;
  width: 100%;
}
.rt-addr :deep(.el-input-number) {
  width: 100px;
  flex: none;
}
.rt-form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #9ca3af;
}
.rt-draft-probe {
  margin: 0 0 4px 84px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}
.rt-draft-probe.ok {
  background: #ecfdf5;
  color: #047857;
}
.rt-draft-probe.bad {
  background: #fef2f2;
  color: #b91c1c;
}
.rt-ttl-mode {
  margin-bottom: 12px;
}
.rt-ttl-input {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

<style>
.rt-del-confirm .el-message-box__message p {
  white-space: pre-line;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
