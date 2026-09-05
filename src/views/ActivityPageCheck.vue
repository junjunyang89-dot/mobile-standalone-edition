<template>
  <div class="act-check">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">活动页体检</span>
            <p class="sub">
              活动页每期换皮、前端全改，但接口结构、奖励优先级不变。这里比的是这些「不变的东西」——
              换皮打不穿。三件事：奖励顺序是否按优先级、接口结构相对基线有没有回归、给接口算签名。
            </p>
          </div>
        </div>
      </template>

      <el-tabs v-model="tab">
        <!-- ========== 奖励顺序校验 ========== -->
        <el-tab-pane label="奖励顺序" name="order">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
            把页面上一个任务里的奖品名按展示顺序填进去（一行一个），看是否符合需求文档的优先级。
            换皮不影响——比的是规则，不是具体奖品。
          </el-alert>
          <el-form label-width="96px">
            <el-form-item label="优先级阶梯">
              <el-input
                v-model="ladderText"
                type="textarea"
                :rows="3"
                placeholder="一行一级，高到低；同级用 = 连接。如：大会员&#10;改名卡&#10;动态头像=其他"
              />
            </el-form-item>
            <el-form-item label="页面奖品">
              <el-input
                v-model="rewardsText"
                type="textarea"
                :rows="5"
                placeholder="一行一个，按页面上的展示顺序。如：大会员(31天)&#10;ROLL房好运券x1&#10;神马币x200"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="checkOrder">校验顺序</el-button>
            </el-form-item>
          </el-form>

          <div v-if="orderResult">
            <el-alert
              v-if="orderResult.ok"
              type="success"
              :closable="false"
              show-icon
              title="顺序符合优先级"
            />
            <el-alert
              v-for="(v, i) in orderResult.violations"
              :key="i"
              type="error"
              :closable="false"
              show-icon
              :title="v"
              style="margin-bottom: 6px"
            />
            <el-alert
              v-if="orderResult.unmatched.length"
              type="warning"
              :closable="false"
              show-icon
              style="margin-top: 6px"
              :title="`这些奖品没匹配到优先级类目，已按「其他」排：${orderResult.unmatched.join('、')}`"
            />
          </div>
        </el-tab-pane>

        <!-- ========== 响应快照 ========== -->
        <el-tab-pane label="接口结构基线" name="snapshot">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
            上线前把一场抓包提升成基线，换皮后再抓一场和它比结构——少字段、奖品数量变、类型漂移，
            都能看出来。完全不碰页面，换皮打不穿。
          </el-alert>

          <div class="snap-actions">
            <el-button @click="loadSnapshots">刷新基线</el-button>
            <el-button type="primary" @click="promoteOpen = true">从抓包新建基线</el-button>
          </div>

          <el-table :data="snapshots" size="small" border style="margin-top: 10px">
            <el-table-column prop="name" label="基线" />
            <el-table-column prop="requirement_no" label="需求单" width="120" />
            <el-table-column prop="entry_count" label="接口数" width="80" />
            <el-table-column prop="created_at" label="建立时间" width="170" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDiff(row)">与抓包对比</el-button>
                <el-button link type="danger" @click="removeSnapshot(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="diffResult" class="diff-result">
            <el-divider>对比结果</el-divider>
            <el-alert
              :type="diffResult.driftedCount ? 'error' : 'success'"
              :closable="false"
              show-icon
              :title="diffResult.hint"
              style="margin-bottom: 10px"
            />
            <div v-for="(d, i) in diffResult.drifted" :key="i" class="drift">
              <div class="drift-ep">{{ d.method }} {{ d.path }}</div>
              <el-table :data="d.diffs" size="small" border>
                <el-table-column prop="path" label="字段" />
                <el-table-column prop="kind" label="变化" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="kindType(row.kind)">{{ kindLabel(row.kind) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="baseline" label="基线" width="120" />
                <el-table-column prop="current" label="本次" width="120" />
              </el-table>
            </div>
            <el-alert
              v-if="diffResult.onlyInBaseline.length"
              type="warning"
              :closable="false"
              :title="`基线里有、这次没抓到（可能漏测）：${diffResult.onlyInBaseline.join('，')}`"
              style="margin-top: 8px"
            />
          </div>
        </el-tab-pane>

        <!-- ========== 接口签名 ========== -->
        <el-tab-pane label="接口签名" name="sign">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
            给 PVP 接口算签名，让平台能直接调接口。APP KEY 从「环境变量」取（记得勾 secret），这里不填。
            用抓包那条请求的 r/t 和参数验证：算出的 s 和抓到的一致就说明对了。
          </el-alert>
          <el-form label-width="96px">
            <el-form-item label="环境">
              <el-radio-group v-model="signEnv">
                <el-radio label="TEST">测试</el-radio>
                <el-radio label="PROD">生产</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="r 随机数">
              <el-input v-model="signR" placeholder="如 123456" />
            </el-form-item>
            <el-form-item label="t 时间戳">
              <el-input v-model="signT" placeholder="unix 秒" />
            </el-form-item>
            <el-form-item label="业务参数">
              <el-input
                v-model="signParams"
                type="textarea"
                :rows="4"
                placeholder='JSON，如 {"category":"task_1","access_token":"..."}'
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doSign">算签名</el-button>
            </el-form-item>
          </el-form>
          <div v-if="signResult">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="s 签名">
                <code>{{ signResult.s }}</code>
              </el-descriptions-item>
              <el-descriptions-item label="被签名的串">
                <code class="wrap">{{ signResult.signedRequest }}</code>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新建基线 -->
    <el-dialog v-model="promoteOpen" title="从抓包新建基线" width="520px">
      <el-form label-width="90px">
        <el-form-item label="抓包会话">
          <el-select v-model="promoteSession" filterable placeholder="选一场已完成的抓包" style="width: 100%">
            <el-option
              v-for="c in captureSessions"
              :key="c.id"
              :label="`${c.id}（${c.flow_count || 0} 条 · ${c.requirement_no || '无单号'}）`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="基线名称">
          <el-input v-model="promoteName" placeholder="如 国服战令 9.3 基线" />
        </el-form-item>
        <el-form-item label="需求单">
          <el-input v-model="promoteReq" placeholder="选填，如 APP-9000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="promoteOpen = false">取消</el-button>
        <el-button type="primary" @click="doPromote">建立基线</el-button>
      </template>
    </el-dialog>

    <!-- 选抓包对比 -->
    <el-dialog v-model="diffOpen" title="选一场抓包与基线对比" width="520px">
      <el-select v-model="diffSession" filterable placeholder="选一场抓包" style="width: 100%">
        <el-option
          v-for="c in captureSessions"
          :key="c.id"
          :label="`${c.id}（${c.flow_count || 0} 条）`"
          :value="c.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="diffOpen = false">取消</el-button>
        <el-button type="primary" @click="doDiff">开始对比</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const tab = ref('order')

// ---- 奖励顺序（纯前端算，规则简单，不必往返后端） ----
const ladderText = ref(
  '大会员\n改名卡\n赛季重置卡\n天梯双倍卡\n段位保护盾\n击杀特效\n进房音效\n个人主页背景\n天梯房间背景\n赛季房间卡背景\n动态头像=其他'
)
const rewardsText = ref('')
const orderResult = ref<{ ok: boolean; violations: string[]; unmatched: string[] } | null>(null)

function normalize(raw: string): string {
  let t = (raw || '').trim().replace(/[（(\[][^）)\]]*[）)\]]/g, '')
  const m = t.match(/^(.*?)[xX*×]\s*\d+$/)
  if (m) t = m[1]
  return t.trim()
}
function checkOrder() {
  const tiers = ladderText.value.split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split('=').map((x) => x.trim()))
  const rewards = rewardsText.value.split('\n').map((l) => l.trim()).filter(Boolean)
  const fallback = tiers.length - 1
  const categoryOf = (raw: string) => {
    const norm = normalize(raw)
    let best: string | null = null
    tiers.forEach((tier) => tier.forEach((cat) => {
      if (cat !== '其他' && norm.includes(cat) && (!best || cat.length > best.length)) best = cat
    }))
    return best
  }
  const tierOf = (cat: string | null) => cat ? tiers.findIndex((t) => t.includes(cat)) : fallback
  const items = rewards.map((r) => { const c = categoryOf(r); return { raw: r, cat: c, tier: tierOf(c) } })
  const violations: string[] = []
  const unmatched: string[] = []
  items.forEach((it) => { if (!it.cat) unmatched.push(it.raw) })
  for (let i = 1; i < items.length; i++) {
    let worst: typeof items[0] | null = null
    for (let j = 0; j < i; j++) if (items[j].tier > items[i].tier && (!worst || items[j].tier > worst.tier)) worst = items[j]
    if (worst) {
      const nm = (x: typeof items[0]) => x.cat || `${x.raw}(未匹配，按其他)`
      violations.push(`「${items[i].raw}」应排在「${worst.raw}」前面——按优先级：${nm(items[i])} > ${nm(worst)}`)
    }
  }
  orderResult.value = { ok: violations.length === 0, violations, unmatched }
}

// ---- 响应快照 ----
const snapshots = ref<any[]>([])
const captureSessions = ref<any[]>([])
const diffResult = ref<any | null>(null)
const promoteOpen = ref(false)
const promoteSession = ref('')
const promoteName = ref('')
const promoteReq = ref('')
const diffOpen = ref(false)
const diffSession = ref('')
const diffSnapshotId = ref('')

async function loadSnapshots() {
  try {
    snapshots.value = await apiClient.getResponseSnapshots()
    captureSessions.value = await apiClient.getCaptureSessions()
  } catch (e: any) { ElMessage.error(e?.message || '加载失败') }
}
async function doPromote() {
  if (!promoteSession.value || !promoteName.value.trim()) { ElMessage.warning('选抓包会话并填基线名'); return }
  try {
    await apiClient.promoteResponseSnapshot({
      sessionId: promoteSession.value, name: promoteName.value.trim(), requirementNo: promoteReq.value.trim() || undefined
    })
    ElMessage.success('基线已建立'); promoteOpen.value = false; loadSnapshots()
  } catch (e: any) { ElMessage.error(e?.message || '建立失败') }
}
function openDiff(row: any) { diffSnapshotId.value = row.id; diffSession.value = ''; diffResult.value = null; diffOpen.value = true }
async function doDiff() {
  if (!diffSession.value) { ElMessage.warning('选一场抓包'); return }
  try {
    diffResult.value = await apiClient.diffResponseSnapshot(diffSnapshotId.value, diffSession.value)
    diffOpen.value = false
  } catch (e: any) { ElMessage.error(e?.message || '对比失败') }
}
async function removeSnapshot(row: any) {
  try { await apiClient.deleteResponseSnapshot(row.id); loadSnapshots() }
  catch (e: any) { ElMessage.error(e?.message || '删除失败') }
}
function kindType(k: string) { return { REMOVED: 'danger', TYPE_CHANGED: 'danger', ARRAY_SIZE: 'warning', ADDED: 'info' }[k] || 'info' }
function kindLabel(k: string) { return { REMOVED: '少了字段', ADDED: '多了字段', TYPE_CHANGED: '类型变了', ARRAY_SIZE: '数量变了' }[k] || k }

// ---- 签名 ----
const signEnv = ref('TEST')
const signR = ref('')
const signT = ref('')
const signParams = ref('')
const signResult = ref<any | null>(null)
async function doSign() {
  let params: Record<string, string> = {}
  if (signParams.value.trim()) {
    try { params = JSON.parse(signParams.value) } catch { ElMessage.warning('业务参数不是合法 JSON'); return }
  }
  try {
    signResult.value = await apiClient.pvpSign({ environment: signEnv.value, r: signR.value, t: signT.value, params })
  } catch (e: any) { ElMessage.error(e?.message || '签名失败') }
}

onMounted(loadSnapshots)
</script>

<style scoped>
.title { font-size: 16px; font-weight: 600; }
.sub { margin: 4px 0 0; color: #909399; font-size: 12px; max-width: 760px; }
.snap-actions { display: flex; gap: 8px; }
.drift { margin-bottom: 12px; }
.drift-ep { font-family: monospace; font-size: 13px; margin-bottom: 4px; color: #303133; }
code.wrap { word-break: break-all; }
</style>
