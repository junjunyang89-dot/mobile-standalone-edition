<template>
  <div class="kafka-tool">
    <div class="kt-head">
      <div class="kt-head-left">
        <h2 class="kt-title">Kafka 查询</h2>
        <el-select
          v-model="connId"
          class="kt-conn"
          placeholder="选一个连接"
          :loading="loadingConns"
          no-data-text="还没有连接，点右边「新建连接」"
          @change="onConnChange"
        >
          <el-option v-for="c in connections" :key="c.id" :label="c.name" :value="c.id">
            <span class="kt-opt">
              <el-tag size="small" :type="c.environment === 'TEST' ? 'success' : 'danger'" effect="plain">
                {{ c.environment === 'TEST' ? '测试' : '生产' }}
              </el-tag>
              <span class="kt-opt-name">{{ c.name }}</span>
              <span class="kt-opt-addr">{{ firstServer(c.bootstrapServers) }}</span>
            </span>
          </el-option>
        </el-select>
        <template v-if="current">
          <el-tag v-if="readOnly" type="danger" effect="light">生产 · 只能看</el-tag>
          <el-tag v-else type="success" effect="light">测试环境 · 可发消息</el-tag>
          <span v-if="probe?.ok" class="kt-probe ok">
            <i class="dot" />{{ probe.brokers }} 个 broker · {{ probe.topicCount }} 个 topic · {{ probe.elapsedMs }}ms
          </span>
          <span v-else-if="probe" class="kt-probe bad"><i class="dot" />{{ probe.message }}</span>
        </template>
      </div>
      <div class="kt-head-right">
        <el-button v-if="current" :loading="probing" @click="ping">测试连接</el-button>
        <el-button v-if="current" :disabled="!canWrite" @click="openEdit(current)">编辑</el-button>
        <el-button v-if="current" :disabled="!canDelete" :title="canDelete ? '' : '需要管理员权限'" @click="removeConn(current)">删除</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openEdit(null)">新建连接</el-button>
      </div>
    </div>

    <el-empty v-if="!loadingConns && !connections.length" description="还没有 Kafka 连接">
      <el-button type="primary" :disabled="!canWrite" @click="openEdit(null)">新建连接</el-button>
    </el-empty>

    <div v-else class="kt-body">
      <!-- 左：topic 列表 -->
      <el-card class="kt-left" shadow="never">
        <div class="kt-search">
          <el-input v-model="topicKeyword" clearable placeholder="搜 topic 名" :disabled="!current" @keyup.enter="loadTopics">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button :loading="loadingTopics" :disabled="!current" @click="loadTopics">查询</el-button>
        </div>
        <div class="kt-list-bar">
          <span class="kt-count">
            <template v-if="topicsLoaded">{{ topicTotal }} 个{{ topicTruncated ? `，只列前 ${topics.length} 个` : '' }}</template>
          </span>
          <el-checkbox v-model="includeInternal" size="small" @change="loadTopics">含内部 topic</el-checkbox>
        </div>
        <div v-loading="loadingTopics" class="kt-list">
          <div
            v-for="t in topics"
            :key="t.name"
            class="kt-row"
            :class="{ active: t.name === activeTopic }"
            @click="openTopic(t.name)"
          >
            <span class="kt-topic" :title="t.name">{{ t.name }}</span>
            <span class="kt-parts">{{ t.partitions ?? '—' }} 分区</span>
          </div>
          <div v-if="topicsLoaded && !topics.length && !loadingTopics" class="kt-none">没有匹配的 topic</div>
        </div>
      </el-card>

      <!-- 右：topic 详情 -->
      <el-card class="kt-right" shadow="never">
        <div v-if="!activeTopic" class="kt-placeholder">
          <el-icon :size="34"><Message /></el-icon>
          <div>左边选一个 topic，看它最近的消息、谁在消费</div>
        </div>

        <div v-else class="kt-detail">
          <div class="kt-d-head">
            <code class="kt-d-topic">{{ activeTopic }}</code>
            <el-button link type="primary" size="small" @click="copy(activeTopic)">复制</el-button>
            <el-button link size="small" :loading="loadingDetail" @click="loadDetail">刷新</el-button>
            <span class="kt-spacer" />
            <template v-if="detail">
              <span class="kt-stat">{{ detail.partitions.length }} 个分区</span>
              <span class="kt-stat">留存 {{ detail.messageCount.toLocaleString() }} 条</span>
              <span class="kt-stat" :class="{ warn: totalLag > 0 }">
                {{ detail.groups.length }} 个消费组{{ totalLag > 0 ? ` · 积压 ${totalLag.toLocaleString()}` : '' }}
              </span>
            </template>
          </div>

          <el-tabs v-model="tab" class="kt-tabs">
            <!-- 消息 -->
            <el-tab-pane label="消息" name="messages">
              <div class="kt-query">
                <el-select v-model="q.partition" class="kt-q-part" placeholder="全部分区" clearable>
                  <el-option v-for="p in partitionOptions" :key="p" :label="`分区 ${p}`" :value="p" />
                </el-select>
                <el-radio-group v-model="q.mode" size="default">
                  <el-radio-button value="LATEST">最近</el-radio-button>
                  <el-radio-button value="TIME">从时间</el-radio-button>
                  <el-radio-button value="OFFSET">从 offset</el-radio-button>
                </el-radio-group>
                <el-date-picker
                  v-if="q.mode === 'TIME'"
                  v-model="q.time"
                  type="datetime"
                  placeholder="起始时间"
                  class="kt-q-time"
                />
                <el-input-number v-if="q.mode === 'OFFSET'" v-model="q.offset" :min="0" :controls="false" placeholder="offset" class="kt-q-offset" />
                <el-select v-model="q.limit" class="kt-q-limit">
                  <el-option v-for="n in [20, 50, 100, 200]" :key="n" :label="`${n} 条`" :value="n" />
                </el-select>
                <el-input v-model="q.keyword" clearable placeholder="key / 内容包含…" class="kt-q-kw" @keyup.enter="loadMessages" />
                <el-button type="primary" :loading="loadingMessages" @click="loadMessages">查询</el-button>
              </div>
              <div v-if="msgResult" class="kt-msg-info">
                <template v-if="msgResult.keyword">往回翻了 {{ msgResult.scanned.toLocaleString() }} 条，包含「{{ msgResult.keyword }}」的 {{ msgResult.matched }} 条</template>
                <template v-else>共 {{ msgResult.messages.length }} 条</template>
                <span v-if="q.mode === 'LATEST'">，新的在上</span>
              </div>

              <el-table
                v-loading="loadingMessages"
                :data="msgResult?.messages || []"
                size="small"
                border
                row-key="rowKey"
                class="kt-msgs"
                empty-text="没有消息"
              >
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <div class="kt-expand">
                      <div class="kt-expand-bar">
                        <el-tag v-if="row.value" size="small" effect="plain" :type="formatTag(row.value.format)">{{ formatLabel(row.value.format) }}</el-tag>
                        <el-tag v-if="row.value?.gzip" size="small" effect="plain" type="warning">gzip 已解压</el-tag>
                        <span v-if="row.value?.truncated" class="kt-warn">消息太大，只显示前一部分</span>
                        <span class="kt-spacer" />
                        <el-button size="small" @click="copy(row.value?.text || '')">复制内容</el-button>
                        <el-button v-if="!readOnly" size="small" type="primary" plain :disabled="!canWrite || !row.value?.editable" @click="useAsTemplate(row)">
                          用它当模板发一条
                        </el-button>
                      </div>
                      <div v-if="row.headers.length" class="kt-headers">
                        <span v-for="h in row.headers" :key="h.key" class="kt-header"><b>{{ h.key }}</b>: {{ h.value }}</span>
                      </div>
                      <pre class="kt-pre" :class="{ json: row.value?.format === 'JSON' }">{{ row.value?.text ?? '(null)' }}</pre>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="160">
                  <template #default="{ row }">{{ fmtTime(row.timestamp) }}</template>
                </el-table-column>
                <el-table-column label="分区" width="56" align="center" prop="partition" />
                <el-table-column label="offset" width="96" prop="offset" />
                <el-table-column label="key" width="140" show-overflow-tooltip>
                  <template #default="{ row }"><code v-if="row.key" class="kt-key">{{ row.key }}</code><span v-else class="kt-muted">—</span></template>
                </el-table-column>
                <el-table-column label="内容">
                  <template #default="{ row }">
                    <span class="kt-preview">{{ preview(row) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="大小" width="80" align="right">
                  <template #default="{ row }">{{ row.value ? formatBytes(row.value.bytes) : '—' }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 消费组 -->
            <el-tab-pane name="groups">
              <template #label>消费组 <span class="kt-n">{{ detail?.groups.length ?? 0 }}</span></template>
              <el-table v-loading="loadingDetail" :data="detail?.groups || []" size="small" border empty-text="没有消费组提交过这个 topic 的位点">
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <el-table :data="row.partitions" size="small" class="kt-sub">
                      <el-table-column label="分区" prop="partition" width="80" />
                      <el-table-column label="已消费到" prop="committed" />
                      <el-table-column label="最新" prop="end" />
                      <el-table-column label="积压">
                        <template #default="{ row: p }"><span :class="{ 'kt-lag': p.lag }">{{ p.lag ?? '—' }}</span></template>
                      </el-table-column>
                    </el-table>
                  </template>
                </el-table-column>
                <el-table-column label="消费组" prop="group" min-width="240" show-overflow-tooltip />
                <el-table-column label="状态" width="130">
                  <template #default="{ row }">
                    <el-tag size="small" effect="plain" :type="row.state === 'STABLE' ? 'success' : row.state === 'EMPTY' ? 'info' : 'warning'">
                      {{ stateLabel(row.state) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="在线实例" prop="members" width="90" align="center" />
                <el-table-column label="积压" width="110" align="right">
                  <template #default="{ row }"><span :class="{ 'kt-lag': row.lag > 0 }">{{ row.lag.toLocaleString() }}</span></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 分区 -->
            <el-tab-pane label="分区" name="partitions">
              <el-table v-loading="loadingDetail" :data="detail?.partitions || []" size="small" border>
                <el-table-column label="分区" prop="partition" width="70" />
                <el-table-column label="leader" width="80">
                  <template #default="{ row }">{{ row.leader ?? '无' }}</template>
                </el-table-column>
                <el-table-column label="副本 / 同步中">
                  <template #default="{ row }">
                    {{ row.replicas.join(',') }} / <span :class="{ 'kt-lag': row.isr.length < row.replicas.length }">{{ row.isr.join(',') }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="最早 offset" prop="begin" />
                <el-table-column label="最新 offset" prop="end" />
                <el-table-column label="留存条数" prop="count" />
              </el-table>
            </el-tab-pane>

            <!-- 发消息 -->
            <el-tab-pane v-if="!readOnly" label="发消息" name="produce">
              <el-form label-width="64px" class="kt-produce">
                <el-form-item label="分区">
                  <el-select v-model="send.partition" placeholder="自动（按 key 分配）" clearable style="width: 200px">
                    <el-option v-for="p in partitionOptions" :key="p" :label="`分区 ${p}`" :value="p" />
                  </el-select>
                </el-form-item>
                <el-form-item label="key">
                  <el-input v-model="send.key" placeholder="选填；同一个 key 会进同一个分区" />
                </el-form-item>
                <el-form-item label="内容">
                  <div class="kt-value-wrap">
                    <div class="kt-value-bar">
                      <el-button size="small" @click="formatSendValue">格式化 JSON</el-button>
                      <span v-if="sendJsonError" class="kt-warn">{{ sendJsonError }}</span>
                    </div>
                    <el-input v-model="send.value" type="textarea" :autosize="{ minRows: 8, maxRows: 24 }" class="kt-editor" placeholder="消息内容，原样发出" />
                  </div>
                </el-form-item>
                <el-form-item label="headers">
                  <div class="kt-hdrs">
                    <div v-for="(h, i) in send.headers" :key="i" class="kt-hdr">
                      <el-input v-model="h.key" placeholder="名" />
                      <el-input v-model="h.value" placeholder="值" />
                      <el-button link type="danger" @click="send.headers.splice(i, 1)">删</el-button>
                    </div>
                    <el-button link type="primary" @click="send.headers.push({ key: '', value: '' })">+ 加一个 header</el-button>
                  </div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :disabled="!canWrite" :loading="sending" @click="produce">发送到 {{ activeTopic }}</el-button>
                  <span v-if="sent" class="kt-sent">
                    已发到分区 {{ sent.partition }}，offset {{ sent.offset }}
                    <el-button link type="primary" @click="viewSent">去看这条</el-button>
                  </span>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-card>
    </div>

    <!-- 连接 -->
    <el-dialog v-model="connDialog" :title="form.id ? '编辑连接' : '新建 Kafka 连接'" width="560px" destroy-on-close>
      <el-form label-width="84px">
        <el-form-item label="环境">
          <el-radio-group v-model="form.environment" :disabled="!!form.id">
            <el-radio-button value="TEST">测试环境</el-radio-button>
            <el-radio-button value="PROD">生产环境（只能看）</el-radio-button>
          </el-radio-group>
          <span v-if="form.id" class="kt-form-tip">建好后不能改</span>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="32" placeholder="如 数据组 Kafka（second）" />
        </el-form-item>
        <el-form-item label="集群地址" required>
          <el-input
            v-model="form.bootstrapServers"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="host:port，多个用逗号分隔；可直接粘配置文件里的 bootstrap 地址"
          />
        </el-form-item>
        <el-form-item label="安全协议">
          <el-select v-model="form.securityProtocol" style="width: 200px">
            <el-option label="无（PLAINTEXT）" value="PLAINTEXT" />
            <el-option label="SASL_PLAINTEXT" value="SASL_PLAINTEXT" />
            <el-option label="SASL_SSL" value="SASL_SSL" />
            <el-option label="SSL" value="SSL" />
          </el-select>
          <span class="kt-form-tip">配置文件里没写 security.protocol 就是无</span>
        </el-form-item>
        <template v-if="(form.securityProtocol || '').startsWith('SASL')">
          <el-form-item label="认证方式">
            <el-select v-model="form.saslMechanism" style="width: 200px">
              <el-option label="PLAIN" value="PLAIN" />
              <el-option label="SCRAM-SHA-256" value="SCRAM-SHA-256" />
              <el-option label="SCRAM-SHA-512" value="SCRAM-SHA-512" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户名" required>
            <el-input v-model="form.username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
        </template>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="选填，如 对应配置里的 kafka.second" />
        </el-form-item>
      </el-form>
      <div v-if="draftProbe" class="kt-draft-probe" :class="draftProbe.ok ? 'ok' : 'bad'">
        {{ draftProbe.ok ? `连上了：${draftProbe.brokers} 个 broker · ${draftProbe.topicCount} 个 topic · ${draftProbe.elapsedMs}ms` : draftProbe.message }}
      </div>
      <template #footer>
        <el-button :loading="draftProbing" @click="probeDraft">测试连接</el-button>
        <el-button @click="connDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingConn" @click="saveConn">保存</el-button>
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
  type KafkaConnection,
  type KafkaMessage,
  type KafkaMessagesResult,
  type KafkaProbe,
  type KafkaTopicDetail,
  type KafkaTopicRow
} from '@/api'
import { canDelete, canWrite } from '@/stores/auth'
import { formatBytes } from '@/utils/redisKey'
import { prettyJsonText } from '@/utils/jsonText'

const LAST_CONN = 'kafka-tool:last-conn'
const route = useRoute()

const connections = ref<KafkaConnection[]>([])
const loadingConns = ref(false)
const connId = ref('')
const current = computed(() => connections.value.find(c => c.id === connId.value) || null)
const readOnly = computed(() => current.value?.environment !== 'TEST')
const probe = ref<KafkaProbe | null>(null)
const probing = ref(false)

const topicKeyword = ref('')
const includeInternal = ref(false)
const topics = ref<KafkaTopicRow[]>([])
const topicTotal = ref(0)
const topicTruncated = ref(false)
const topicsLoaded = ref(false)
const loadingTopics = ref(false)

const activeTopic = ref('')
const detail = ref<KafkaTopicDetail | null>(null)
const loadingDetail = ref(false)
const tab = ref('messages')

const q = reactive({
  partition: null as number | null,
  mode: 'LATEST' as 'LATEST' | 'OFFSET' | 'TIME',
  time: null as Date | null,
  offset: null as number | null,
  limit: 20,
  keyword: ''
})
const msgResult = ref<(KafkaMessagesResult & { messages: Array<KafkaMessage & { rowKey: string }> }) | null>(null)
const loadingMessages = ref(false)

const send = reactive({
  partition: null as number | null,
  key: '',
  value: '',
  headers: [] as Array<{ key: string; value: string }>
})
const sendJsonError = ref('')
const sending = ref(false)
const sent = ref<{ partition: number; offset: number } | null>(null)

const partitionOptions = computed(() => (detail.value?.partitions || []).map(p => p.partition))
const totalLag = computed(() => (detail.value?.groups || []).reduce((s, g) => s + (g.lag || 0), 0))

const FORMAT_LABELS: Record<string, string> = { TEXT: '文本', JSON: 'JSON', JAVA_SERIALIZED: 'Java 序列化', BINARY: '二进制' }
const formatLabel = (f: string) => FORMAT_LABELS[f] || f
const formatTag = (f: string) => (f === 'JSON' ? 'success' : f === 'TEXT' ? 'info' : 'warning')
const STATE_LABELS: Record<string, string> = {
  STABLE: '正常消费',
  EMPTY: '没有实例在线',
  PREPARING_REBALANCE: '重平衡中',
  COMPLETING_REBALANCE: '重平衡中',
  DEAD: '已失效'
}
const stateLabel = (s: string | null) => (s ? STATE_LABELS[s] || s : '—')

const firstServer = (s: string) => {
  const parts = (s || '').split(',')
  return parts.length > 1 ? `${parts[0]} 等 ${parts.length} 个` : parts[0]
}

function fmtTime(ms: number) {
  if (!ms || ms < 0) return '—'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function preview(m: KafkaMessage) {
  if (!m.value) return '(null)'
  const t = m.value.format === 'JSON' ? m.value.text.replace(/\s*\n\s*/g, ' ') : m.value.text
  return t.length > 200 ? `${t.slice(0, 200)}…` : t
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
    connections.value = await apiClient.listKafkaConnections()
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

function resetTopic() {
  activeTopic.value = ''
  detail.value = null
  msgResult.value = null
  sent.value = null
}

function onConnChange() {
  localStorage.setItem(LAST_CONN, connId.value)
  probe.value = null
  topics.value = []
  topicsLoaded.value = false
  resetTopic()
  ping()
  loadTopics()
}

async function ping() {
  if (!current.value) return
  probing.value = true
  try {
    probe.value = await apiClient.pingKafkaConnection(current.value.id)
  } catch (e: any) {
    probe.value = { ok: false, message: e.message || '连不上' }
  } finally {
    probing.value = false
  }
}

const connDialog = ref(false)
const savingConn = ref(false)
const draftProbing = ref(false)
const draftProbe = ref<KafkaProbe | null>(null)
const emptyForm = (): Partial<KafkaConnection> => ({
  environment: 'TEST',
  name: '',
  bootstrapServers: '',
  securityProtocol: 'PLAINTEXT',
  saslMechanism: 'PLAIN',
  username: '',
  password: '',
  remark: ''
})
const form = reactive<Partial<KafkaConnection>>(emptyForm())

function openEdit(c: KafkaConnection | null) {
  Object.assign(form, emptyForm(), c ? { ...c, securityProtocol: c.securityProtocol || 'PLAINTEXT', saslMechanism: c.saslMechanism || 'PLAIN' } : { id: undefined })
  draftProbe.value = null
  connDialog.value = true
}

async function probeDraft() {
  draftProbing.value = true
  try {
    draftProbe.value = await apiClient.probeKafkaConnection({ ...form })
  } catch (e: any) {
    draftProbe.value = { ok: false, message: e.message || '连不上' }
  } finally {
    draftProbing.value = false
  }
}

async function saveConn() {
  savingConn.value = true
  try {
    const saved = await apiClient.saveKafkaConnection({ ...form })
    connDialog.value = false
    ElMessage.success('已保存')
    await loadConnections()
    connId.value = saved.id
    onConnChange()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    savingConn.value = false
  }
}

async function removeConn(c: KafkaConnection) {
  try {
    await ElMessageBox.confirm(`删除连接「${c.name}」？只删这里的配置，不影响 Kafka 本身。`, '删除连接', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteKafkaConnection(c.id)
    connId.value = ''
    probe.value = null
    topics.value = []
    resetTopic()
    await loadConnections()
    if (connId.value) onConnChange()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

// ---------- 查 ----------

async function loadTopics() {
  if (!current.value) return
  loadingTopics.value = true
  try {
    const r = await apiClient.listKafkaTopics(current.value.id, topicKeyword.value.trim(), includeInternal.value)
    topics.value = r.topics
    topicTotal.value = r.total
    topicTruncated.value = r.truncated
    topicsLoaded.value = true
  } catch (e: any) {
    ElMessage.error(e.message || '加载 topic 失败')
  } finally {
    loadingTopics.value = false
  }
}

async function openTopic(name: string) {
  if (activeTopic.value !== name) {
    resetTopic()
    activeTopic.value = name
    q.partition = null
    q.mode = 'LATEST'
    q.keyword = ''
    send.partition = null
    if (tab.value === 'produce' && readOnly.value) tab.value = 'messages'
  }
  await Promise.all([loadDetail(), loadMessages()])
}

async function loadDetail() {
  if (!current.value || !activeTopic.value) return
  loadingDetail.value = true
  try {
    detail.value = await apiClient.getKafkaTopic(current.value.id, activeTopic.value)
  } catch (e: any) {
    ElMessage.error(e.message || '加载 topic 详情失败')
  } finally {
    loadingDetail.value = false
  }
}

async function loadMessages() {
  if (!current.value || !activeTopic.value) return
  if (q.mode === 'TIME' && !q.time) {
    ElMessage.warning('选一下起始时间')
    return
  }
  if (q.mode === 'OFFSET' && q.offset == null) {
    ElMessage.warning('填一下起始 offset')
    return
  }
  loadingMessages.value = true
  try {
    const r = await apiClient.readKafkaMessages(current.value.id, {
      topic: activeTopic.value,
      partition: q.partition,
      mode: q.mode,
      offset: q.mode === 'OFFSET' ? q.offset : null,
      timeMs: q.mode === 'TIME' && q.time ? q.time.getTime() : null,
      limit: q.limit,
      keyword: q.keyword.trim() || null
    })
    msgResult.value = { ...r, messages: r.messages.map(m => ({ ...m, rowKey: `${m.partition}-${m.offset}` })) }
  } catch (e: any) {
    msgResult.value = null
    ElMessage.error(e.message || '读消息失败')
  } finally {
    loadingMessages.value = false
  }
}

// ---------- 发 ----------

function useAsTemplate(m: KafkaMessage) {
  send.key = m.key || ''
  send.value = m.value?.text || ''
  send.headers = m.headers.map(h => ({ key: h.key, value: h.value || '' }))
  send.partition = null
  sent.value = null
  sendJsonError.value = ''
  tab.value = 'produce'
}

function formatSendValue() {
  const r = prettyJsonText(send.value)
  if (r.ok) {
    send.value = r.text
    sendJsonError.value = ''
  } else {
    sendJsonError.value = r.error
  }
}

async function produce() {
  if (!current.value || !activeTopic.value) return
  if (!send.value) {
    ElMessage.warning('内容不能为空')
    return
  }
  try {
    await ElMessageBox.confirm(
      `往测试环境的「${activeTopic.value}」发一条消息？消费这个 topic 的服务会真的处理它。`,
      '发消息',
      { type: 'warning', confirmButtonText: '发送' }
    )
  } catch {
    return
  }
  sending.value = true
  try {
    const r = await apiClient.produceKafkaMessage(current.value.id, {
      topic: activeTopic.value,
      key: send.key || null,
      value: send.value,
      partition: send.partition,
      headers: send.headers.filter(h => h.key.trim())
    })
    sent.value = { partition: r.partition, offset: r.offset }
    ElMessage.success('已发送')
  } catch (e: any) {
    ElMessage.error(e.message || '发送失败')
  } finally {
    sending.value = false
  }
}

function viewSent() {
  if (!sent.value) return
  q.partition = sent.value.partition
  q.mode = 'OFFSET'
  q.offset = sent.value.offset
  q.keyword = ''
  tab.value = 'messages'
  loadMessages()
  loadDetail()
}

watch(
  () => (route.query.topic || '') as string,
  t => {
    if (t && t !== activeTopic.value && current.value) openTopic(t)
  }
)

onMounted(async () => {
  await loadConnections()
  if (current.value) {
    ping()
    await loadTopics()
    const t = (route.query.topic || '') as string
    if (t) openTopic(t)
  }
})
</script>

<style scoped>
.kafka-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
}
.kt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.kt-head-left,
.kt-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.kt-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.kt-conn {
  width: 260px;
}
.kt-opt {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kt-opt-name {
  font-weight: 500;
}
.kt-opt-addr {
  margin-left: auto;
  color: #9ca3af;
  font-size: 12px;
}
.kt-probe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.kt-probe .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
}
.kt-probe.bad {
  color: #dc2626;
}
.kt-probe.bad .dot {
  background: #dc2626;
}

.kt-body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  flex: 1;
  min-height: 0;
}
.kt-left :deep(.el-card__body),
.kt-right :deep(.el-card__body) {
  padding: 14px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.kt-search {
  display: flex;
  gap: 8px;
}
.kt-list-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 6px;
  border-bottom: 1px solid #f0f0f0;
}
.kt-count {
  font-size: 12px;
  color: #6b7280;
}
.kt-list {
  flex: 1;
  overflow-y: auto;
  min-height: 160px;
  max-height: calc(100vh - 280px);
}
.kt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.kt-row:hover {
  background: #f5f7fa;
}
.kt-row.active {
  background: #ecf5ff;
}
.kt-topic {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1f2937;
}
.kt-parts {
  flex: none;
  font-size: 12px;
  color: #9ca3af;
}
.kt-none {
  padding: 28px 12px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}

.kt-placeholder {
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
.kt-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.kt-d-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kt-d-topic {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  word-break: break-all;
}
.kt-spacer {
  flex: 1;
}
.kt-stat {
  font-size: 12px;
  color: #6b7280;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 10px;
}
.kt-stat.warn {
  color: #b45309;
  background: #fef3c7;
}
.kt-tabs {
  margin-top: 6px;
}
.kt-n {
  margin-left: 2px;
  padding: 0 6px;
  font-size: 11px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
}
.kt-query {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kt-q-part {
  width: 120px;
}
.kt-q-time {
  width: 200px;
}
.kt-q-offset {
  width: 130px;
}
.kt-q-limit {
  width: 90px;
}
.kt-q-kw {
  width: 200px;
}
.kt-msg-info {
  margin: 8px 0 6px;
  font-size: 12px;
  color: #6b7280;
}
.kt-msgs {
  margin-top: 6px;
}
.kt-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.kt-muted {
  color: #c0c4cc;
}
.kt-preview {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #374151;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.kt-expand {
  padding: 6px 14px 10px 48px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kt-expand-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kt-headers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kt-header {
  font-size: 12px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.kt-warn {
  font-size: 12px;
  color: #d97706;
}
.kt-pre {
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
  max-height: 460px;
  overflow: auto;
}
.kt-pre.json {
  color: #a5f3fc;
}
.kt-lag {
  color: #dc2626;
  font-weight: 600;
}
.kt-sub {
  margin: 4px 0 4px 48px;
  width: calc(100% - 48px);
}
.kt-produce {
  max-width: 860px;
  padding-top: 4px;
}
.kt-value-wrap {
  width: 100%;
}
.kt-value-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.kt-editor :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}
.kt-hdrs {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.kt-hdr {
  display: flex;
  gap: 8px;
  width: 100%;
}
.kt-sent {
  margin-left: 12px;
  font-size: 13px;
  color: #047857;
}
.kt-form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #9ca3af;
}
.kt-draft-probe {
  margin: 0 0 4px 84px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}
.kt-draft-probe.ok {
  background: #ecfdf5;
  color: #047857;
}
.kt-draft-probe.bad {
  background: #fef2f2;
  color: #b91c1c;
}
</style>
