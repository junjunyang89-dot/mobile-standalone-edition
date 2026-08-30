<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span>抓包</span>
          <span class="head-sub">
            抓一遍真实操作，看这个需求实际走了哪些接口 —— 和需求文档说的一对比，多出来的那个就是漏测点
          </span>
        </div>
      </template>

      <el-form label-width="104px" class="cap-form">
        <div class="cap-grid">
          <el-form-item label="设备" class="cap-field">
            <div class="cap-field-body">
              <el-select
                v-model="form.deviceId"
                filterable
                :placeholder="devices.length ? '选一台已连接的设备' : '没有已连接的设备'"
                class="cap-control"
              >
                <el-option
                  v-for="d in devices"
                  :key="d.id"
                  :label="deviceLabel(d)"
                  :value="d.id"
                >
                  <span>{{ d.name || d.id }}</span>
                  <span class="opt-dim">{{ d.platform }} · {{ shortId(d.id) }}</span>
                </el-option>
              </el-select>
              <p class="cap-hint">
                只列已连接设备；同名手机按尾号区分。
              </p>
            </div>
          </el-form-item>

          <el-form-item label="域名白名单" class="cap-field">
            <div class="cap-field-body">
              <el-input v-model="form.hosts" placeholder="留空用默认，如 arca42.com,wmpvp.com" class="cap-control" />
              <p class="cap-hint">
                只抓这几个域名，避免埋点/图片刷屏；海外包域名不同，抓不到先看下方诊断。
              </p>
            </div>
          </el-form-item>

          <el-form-item label="挂到需求单" class="cap-field">
            <div class="cap-field-body">
              <el-input v-model="form.requirementNo" placeholder="如 APP-9059（可留空，留空就只看不挂）" class="cap-control" />
              <p class="cap-hint">结束抓包时可挂到该需求单，便于用例集合里按单查看。</p>
            </div>
          </el-form-item>

          <el-form-item label="归属项目" class="cap-field">
            <div class="cap-field-body">
              <div class="cap-proj">
                <el-select
                  v-model="form.project"
                  filterable
                  clearable
                  placeholder="选项目"
                  class="cap-control cap-proj-select"
                >
                  <el-option
                    v-for="p in projects"
                    :key="p.code"
                    :label="`${p.name}（${p.code}）`"
                    :value="p.code"
                  />
                </el-select>
                <el-button link type="primary" @click="newProjVisible = true">+ 新建项目</el-button>
              </div>
              <p class="cap-hint">
                抓到的接口归入该项目；不选则无法生成用例。
              </p>
            </div>
          </el-form-item>
        </div>
      </el-form>

      <div class="cap-actions-bar">
        <div v-if="!running" key="cap-idle">
          <el-button
            type="success"
            :loading="starting"
            :disabled="!form.deviceId"
            @click="start"
          >
            开始抓包
          </el-button>
        </div>
        <div v-else key="cap-live" class="cap-actions-live">
          <span class="cap-live">● 抓包中</span>
          <el-tag v-if="hostsDirty" type="warning" size="small" effect="plain">
            白名单改过了，要结束后重新开始才生效
          </el-tag>
          <span class="cap-count">命中 {{ count }} 条</span>
          <span class="cap-seen">代理上共 {{ seenTotal }} 个请求</span>
          <el-button type="danger" :loading="stopping" @click="stop">结束抓包</el-button>
        </div>
      </div>

      <div class="cap-alerts">
        <el-alert
          v-if="tip"
          key="cap-tip"
          type="warning"
          :closable="false"
          show-icon
          class="cap-tip"
          :title="tip"
        />

        <!--
          白名单外的握手失败是噪音：第三方 SDK（QQ 埋点、华为云）自己在做证书校验，
          和你要测的接口没关系。折叠起来、不用红色——
          和真故障并排喊红的话，抓包明明成功了（命中 19/19）满屏还是红的
        -->
        <div v-if="failedOutOfScope.length > 0" class="cap-noise">
          <span class="cap-noise-toggle" @click="noiseOpen = !noiseOpen">
            {{ noiseOpen ? '▾' : '▸' }}
            另有 {{ failedOutOfScope.length }} 个白名单外的域名握手失败（第三方 SDK，通常不用管）
          </span>
          <div v-show="noiseOpen" class="cap-noise-body">
            <el-tag v-for="f in failedOutOfScope" :key="f.host" size="small" type="info" effect="plain">
              {{ f.host }}
            </el-tag>
          </div>
        </div>

        <el-alert
          v-if="failedInScope.length > 0"
          key="cap-failed"
          type="error"
          :closable="false"
          show-icon
          class="cap-tip"
        >
        <template #title>
          {{ failedInScope.length }} 个<b>白名单内</b>的域名连不上，这些抓不到
        </template>
        <div class="cap-diag">
          <div class="cap-diag-hosts">
            <el-tag v-for="f in failedInScope" :key="f.host" size="small" type="danger">
              {{ f.host }} × {{ f.count }}
            </el-tag>
          </div>
          <b>先读标签里的错误码，它直接指向原因：</b>
          <ul class="cap-steps">
            <li>
              <code>unknown ca</code> / <code>certificate unknown</code>
              —— <b>手机不信任这张证书</b>。装证书、或让 App 信任用户证书（见下）
            </li>
            <li>
              <code>bad certificate</code> / <code>certificate revoked</code>
              —— 证书本身没问题却被拒，这才是 <b>App 固定了证书（pinning）</b>
            </li>
            <li>
              <code>handshake failure</code> / <code>protocol version</code>
              —— TLS 版本或加密套件对不上，和证书无关
            </li>
          </ul>
          <b>不信任证书的话，按这个顺序处理：</b>
          <ol class="cap-steps">
            <li>
              <b>安卓 7 以上：App 默认不信任你装的证书。</b>
              这是最常见的一条，而且不是 pinning。装进「用户凭据」只有浏览器认
              （所以 <code>mitm.it</code> 打得开），App 一律不认。
              要开发在 debug 包的 <code>network_security_config.xml</code> 里加
              <code>&lt;certificates src="user" /&gt;</code> —— 三行的事，比关 pinning 容易得多。
            </li>
            <li>
              <b>iOS：装完还要手动信任。</b>
              设置 → 通用 → 关于本机 → <b>证书信任设置</b>，把 mitmproxy 那一项打开。
              只装描述文件不打开这个开关，等于没装。
            </li>
            <li>
              <b>确认上游本身是好的。</b>
              上面两步都做了还失败，才轮到 pinning —— 这时要开发出一个关掉 pinning 的包。
            </li>
          </ol>
          <div class="cap-note">
            <b>想确认是不是第 1 条，30 秒就能试出来：</b>
            手机<b>浏览器</b>打开任意 https 网站。浏览器的请求抓得到、App 的抓不到 ——
            那就是它（浏览器信用户证书，App 不信），不用再往 pinning 上想。
            两边都抓不到，说明证书压根没装好。
          </div>
          <div class="cap-note">
            写着「server closed connection」的是另一回事：那是<b>电脑连不到</b>这个地址，
            或者它根本不是 HTTP 服务（游戏长连接之类）。
            安卓走 USB 时代理跑在电脑上，电脑连不到的内网地址，手机也就走不通 ——
            先在电脑上 <code>curl</code> 一下那个地址确认。
          </div>
        </div>
      </el-alert>

      <el-alert
        v-if="(running || flows.length > 0) && missedHosts.length > 0"
        key="cap-missed"
        type="warning"
        :closable="false"
        show-icon
        class="cap-tip"
      >
        <template #title>
          代理上还见到 {{ missedTotal }} 个请求没进来（{{ missedHosts.length }} 个域名不在白名单）
        </template>
        <div class="cap-diag">
          <div class="cap-diag-hosts">
            <el-tag
              v-for="h in missedHosts"
              :key="h.host"
              size="small"
              class="cap-host"
              @click="addHost(h.host)"
            >
              {{ h.host }} × {{ h.count }}
            </el-tag>
          </div>
          点一下域名就加进白名单（当前：{{ form.hosts || '默认' }}）。加完要<b>重新开始</b>才生效。
          <br />
          <b>只抓到一两条时先看这里</b> —— 同一个 App 常常有好几个网关域名，
          白名单里少一个，那一整块的接口就全不见了。
        </div>
      </el-alert>

      <el-alert
        v-if="running && count === 0"
        key="cap-empty"
        :type="seenTotal > 0 ? 'warning' : 'info'"
        :closable="false"
        show-icon
        class="cap-tip"
      >
        <template #title>
          {{ seenTotal > 0 ? '代理通了，但这些域名都不在白名单里' : '代理还没有任何流量经过' }}
        </template>
        <div v-if="seenTotal > 0" key="cap-seen-hosts" class="cap-diag">
          <div class="cap-diag-hosts">
            <el-tag
              v-for="(n, h) in seenHosts"
              :key="h"
              size="small"
              class="cap-host"
              @click="addHost(String(h))"
            >
              {{ h }} × {{ n }}
            </el-tag>
          </div>
          点一下域名就加进白名单（当前：{{ form.hosts || '默认' }}）。加完要<b>重新开始</b>才生效。
        </div>
        <div v-else key="cap-no-traffic" class="cap-diag">
          按顺序查这三件事：<br />
          1. <b>手机代理设了没</b> —— iOS 看上面那条黄色提示，安卓插 USB 会自动设<br />
          2. <b>mitmproxy 的证书装了没</b> —— 手机浏览器打开
          <code>mitm.it</code> 下载安装；<b>iOS 还要去 设置 → 通用 → 关于本机 → 证书信任设置 里手动打开完全信任</b>。
          你原来手机上那个抓包工具是它自己的证书，和这个不是同一张<br />
          3. 手机上真的操作了没 —— 打开 App 点几下
        </div>
      </el-alert>

      <el-alert
        v-if="linkWarn"
        key="cap-link-warn"
        type="warning"
        :closable="false"
        show-icon
        class="cap-tip"
        :title="linkWarn"
      />
      </div>

      <div v-if="flows.length" key="cap-result" class="cap-result">
        <div class="cap-result-head">
          <b>{{ flows.length }} 个接口</b>
          <!-- 「1 个接口」孤零零摆着看不出正常与否；带上分母才知道是不是漏了 -->
          <span class="cap-ratio">
            代理上共 {{ seenGrandTotal }} 个请求，命中白名单 {{ seenGrandTotal - missedTotal }}
          </span>
          <span v-if="lastLinked > 0" class="cap-linked">
            已挂到 {{ linkedTo }}（{{ lastLinked }} 个）
          </span>
          <!--
            抓之前经常还不知道该挂哪个单——抓一遍看到走了什么接口，
            才想起来「这是 APP-9059 的」。所以补挂要放在结果这里
          -->
          <div class="cap-link-box">
            <el-input
              v-model="linkNo"
              size="small"
              placeholder="挂到需求单，如 APP-9059"
              style="width: 180px"
            />
            <el-select
              v-model="form.project"
              key="cap-link-project"
              size="small"
              filterable
              placeholder="项目"
              style="width: 170px"
            >
              <el-option v-for="p in projects" :key="p.code" :label="p.name" :value="p.code" />
            </el-select>
            <el-button size="small" type="primary" :loading="linking" @click="linkNow">
              挂到需求单
            </el-button>
            <!--
              挂上去只是「知道它被调了」，还没有任何东西在验它。
              生成用例和上传文档都放在这儿，人才会顺手做完——
              跳去另一个页面找入口，十次有九次不会去
            -->
            <el-button
              size="small"
              type="success"
              plain
              :loading="genning"
              :disabled="!lastLinked"
              @click="genCases"
            >
              生成用例
            </el-button>
            <el-button size="small" plain :disabled="!form.project" @click="docVisible = true">
              上传接口文档
            </el-button>
            <!--
              用例里不写死 token：它会过期，写死的话过期那天所有用例集体变红，
              而红的原因和接口毫无关系。存到环境上，一处改、全部生效
            -->
            <el-button size="small" plain :loading="savingToken" @click="saveToken">
              用这次的 token
            </el-button>
          </div>
        </div>
        <el-table :data="flows" size="small" style="width: 100%">
          <el-table-column label="方法" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="methodType(row.method)">{{ row.method }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="路径" min-width="260">
            <template #default="{ row }">
              <div class="cap-path">{{ row.path }}</div>
              <div class="cap-host-sub">{{ row.host }}</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <span :class="{ bad: row.status >= 400 }">{{ row.status }}</span>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="90">
            <template #default="{ row }">{{ row.durationMs }} ms</template>
          </el-table-column>
          <el-table-column label="traceId" min-width="150">
            <template #default="{ row }">
              <span v-if="row.traceId" class="cap-trace">{{ row.traceId }}</span>
              <span v-else class="opt-dim">—</span>
            </template>
          </el-table-column>
          <el-table-column label="大小" min-width="168" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="cap-sz">{{ fmtSize(row.reqBytes) }} / {{ fmtSize(row.respBytes) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="详情" width="86">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!anyTrace" class="cap-hint" style="margin-top: 8px">
          没有一条带 traceId。响应头里没有 <code>pwrd-request-id</code> 的话，
          出问题时只能拿时间戳去日志里捞 —— 那是碰运气。可以让后端加上。
        </div>
      </div>
    </el-card>

    <el-dialog v-model="newProjVisible" title="新建项目" width="480px">
      <el-form label-width="90px">
        <el-form-item label="项目代号">
          <el-input v-model="newProj.code" placeholder="英文短代号，如 gld-domestic" />
        </el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="newProj.name" placeholder="如 国内接口" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newProjVisible = false">取消</el-button>
        <el-button type="primary" :loading="projSaving" @click="createProj">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="docVisible" title="上传接口文档" width="540px">
      <p class="cap-doc-tip">
        文档补的是抓包补不了的那一半：<b>必填、默认值、枚举回落、边界、哪些字段可空</b>。
        <br />
        只有抓包的话，用例就是把这次调用重放一遍 —— 边界一条都验不到；
        更要紧的是它会给文档写明「可空」的字段生成非空断言，那种用例正常情况下也会红。
      </p>
      <input ref="docInput" type="file" accept=".docx" style="display: none" @change="onDocPicked" />
      <el-button plain @click="docInput?.click()">选择 .docx（Confluence 导出）</el-button>
      <span v-if="docFile" class="cap-doc-file">{{ docFile.name }}</span>
      <div v-if="docResult" class="cap-doc-result">
        <div>写入接口清单 <b>{{ docResult.matched }}</b> 个</div>
        <div v-if="docResult.unmatched?.length" class="cap-doc-warn">
          文档里有、清单里没有的 {{ docResult.unmatched.length }} 个：
          {{ docResult.unmatched.slice(0, 3).join('、') }}
          <br />这些多半是<b>这次没抓到</b>的接口 —— 那就是漏测点。
        </div>
        <div v-if="docResult.aliasApplied?.length" class="cap-doc-dim">
          另有 {{ docResult.aliasApplied.length }} 条按<b>同名透传</b>推断着套过去了
          （如 GLD 直连和 DC 编排是同一个契约）：{{ docResult.aliasApplied.slice(0, 2).join('；') }}
          <br />这是推断不是文档写的，不对的话在接口清单里改。
        </div>
      </div>
      <template #footer>
        <el-button @click="docVisible = false">关闭</el-button>
        <el-button type="primary" :loading="docUploading" @click="submitDoc">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bodyVisible" :title="bodyTitle" width="820px" top="6vh">
      <div v-loading="bodyLoading">
        <el-alert
          v-if="bodyErr"
          type="info"
          :closable="false"
          show-icon
          :title="bodyErr"
        />
        <template v-else>
          <el-alert
            v-if="bodyTruncated"
            type="warning"
            :closable="false"
            show-icon
            class="cap-tip"
            title="响应太大，只留了前 256 KB"
          />
          <el-tabs v-model="bodyTab">
            <!-- 对着手机抓包工具的 General 页排的，两边好对照 -->
            <el-tab-pane label="概览" name="general">
              <el-descriptions :column="1" border size="small" class="cap-gen">
                <el-descriptions-item label="Request URL">
                  <span class="cap-mono">{{ cur?.url || '—' }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="Request Method">{{ cur?.method }}</el-descriptions-item>
                <el-descriptions-item label="Protocol">{{ cur?.httpVersion || '—' }}</el-descriptions-item>
                <el-descriptions-item label="Status Code">
                  <span :class="{ bad: (cur?.status || 0) >= 400 }">
                    {{ cur?.status }} {{ cur?.reason }}
                  </span>
                </el-descriptions-item>
                <el-descriptions-item label="Remote Address">
                  {{ cur?.remote || '—（连接复用时拿不到）' }}
                </el-descriptions-item>
                <el-descriptions-item label="Request Time">{{ fmtTime(cur?.at) }}</el-descriptions-item>
                <el-descriptions-item label="Duration">{{ cur?.durationMs }} ms</el-descriptions-item>
                <el-descriptions-item label="Request Content-Type">
                  {{ cur?.reqContentType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="Response Content-Type">
                  {{ cur?.respContentType || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="Request Package">{{ fmtSize(cur?.reqBytes) }}</el-descriptions-item>
                <el-descriptions-item label="Response Package">{{ fmtSize(cur?.respBytes) }}</el-descriptions-item>
                <el-descriptions-item label="traceId">
                  <span v-if="cur?.traceId" class="cap-mono">{{ cur.traceId }}</span>
                  <span v-else class="opt-dim" style="margin: 0">
                    响应头里没有 request-id —— 出问题时对不上服务端日志
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
            <el-tab-pane label="响应体" name="resp">
              <el-alert
                v-if="detail?.bodyNote"
                type="info"
                :closable="false"
                show-icon
                class="cap-tip"
                :title="detail.bodyNote"
              />
              <template v-else>
                <div class="cap-body-toolbar">
                  <el-input
                    v-model="respSearch"
                    clearable
                    placeholder="搜索响应体内容"
                    class="cap-body-search"
                    @keydown.enter.prevent="scrollRespMatch(1)"
                  />
                  <span v-if="respSearch.trim()" class="cap-search-meta">
                    {{ respMatchCount ? `${respMatchCount} 处匹配` : '无匹配' }}
                  </span>
                  <el-button
                    v-if="respMatchCount > 1"
                    size="small"
                    plain
                    @click="scrollRespMatch(-1)"
                  >
                    上一个
                  </el-button>
                  <el-button
                    v-if="respMatchCount > 1"
                    size="small"
                    plain
                    @click="scrollRespMatch(1)"
                  >
                    下一个
                  </el-button>
                </div>
                <pre ref="respBodyRef" class="cap-body" v-html="respHighlightedHtml" />
              </template>
            </el-tab-pane>
            <el-tab-pane label="请求体" name="req">
              <pre class="cap-body">{{ reqText || '（没有请求体）' }}</pre>
            </el-tab-pane>
            <el-tab-pane label="请求头" name="reqh">
              <pre class="cap-body">{{ headerText(detail?.reqHeaders) }}</pre>
            </el-tab-pane>
            <el-tab-pane label="响应头" name="resph">
              <pre class="cap-body">{{ headerText(detail?.respHeaders) }}</pre>
            </el-tab-pane>
            <el-tab-pane label="Cookies" name="cookie">
              <pre class="cap-body">{{ cookieText || '（没有 Cookie）' }}</pre>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
      <template #footer>
        <el-button v-if="!bodyErr" @click="copyCurrent">复制当前内容</el-button>
        <el-button type="primary" @click="bodyVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const devices = ref<any[]>([])
const form = reactive({ deviceId: '', hosts: '', requirementNo: '', project: '' })
const projects = ref<any[]>([])
const newProjVisible = ref(false)
const projSaving = ref(false)
const newProj = reactive({ code: '', name: '' })

const running = ref(false)
const starting = ref(false)
const stopping = ref(false)
const sessionId = ref('')
const count = ref(0)
const seenHosts = ref<Record<string, number>>({})
const seenTotal = ref(0)
const failedHosts = ref<Record<string, number>>({})
/** 这一场抓包启动时用的白名单。输入框改了不等于生效 */
const runningHosts = ref('')
const HOSTS_KEY = 'packet-capture:hosts'

/**
 * 记住上次用的白名单。
 * 每次都要重新打一遍域名，打漏一个就是一场白抓——而漏掉的表现是「抓得少」，
 * 不是报错，人不会第一时间想到是白名单。
 */
function rememberHosts(v: string) {
  try {
    if (v && v.trim()) localStorage.setItem(HOSTS_KEY, v.trim())
  } catch {
    /* 隐私模式下写不了，不影响抓包本身 */
  }
}

function recallHosts(): string {
  try {
    return localStorage.getItem(HOSTS_KEY) || ''
  } catch {
    return ''
  }
}
const hostsDirty = computed(() => running.value && form.hosts.trim() !== runningHosts.value.trim())
const tip = ref('')
const flows = ref<any[]>([])
const lastLinked = ref(0)
const linkedTo = ref('')
const linkNo = ref('')
const linking = ref(false)
const linkWarn = ref('')

const bodyVisible = ref(false)
const bodyLoading = ref(false)
const bodyErr = ref('')
const bodyTitle = ref('')
const bodyTab = ref('resp')
const bodyTruncated = ref(false)
const detail = ref<any>(null)
/** 当前点开的那一条。概览页的字段都来自它，不用再请求一次 */
const cur = ref<any>(null)
const respSearch = ref('')
const respBodyRef = ref<HTMLElement | null>(null)
const respMatchIndex = ref(0)

let poll: ReturnType<typeof setInterval> | null = null

const anyTrace = computed(() => flows.value.some((f) => f.traceId))

/** 白名单命中判断和插件里的后缀匹配保持一致，否则这里会把已命中的也算成漏掉的 */
function hostMatched(host: string) {
  const wanted = form.hosts
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (!wanted.length) return true
  const h = host.toLowerCase()
  return wanted.some((w) => h === w || h.endsWith('.' + w))
}

/** 代理上见过、但没进白名单的域名。抓得少的头号原因就是它 */
const missedHosts = computed(() =>
  Object.entries(seenHosts.value)
    .filter(([h]) => !hostMatched(h))
    .map(([host, count]) => ({ host, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
)

const missedTotal = computed(() => missedHosts.value.reduce((n, h) => n + h.count, 0))

/**
 * 失败的域名分两拨，混在一起说等于没说。
 * <p>
 * 白名单<b>外</b>的域名握手失败，是第三方 SDK（QQ 埋点、华为云）在自己做证书校验——
 * 和你要测的接口毫无关系。把它们和真正的故障并排喊成红色，
 * 结果就是抓包明明成功了（命中 19/19），满屏还是红的，人第一反应以为出事了。
 */
function hostOfLabel(label: string) {
  // 标签形如「host（原因）」，取前面的 host 部分
  const i = label.indexOf('（')
  return (i < 0 ? label : label.slice(0, i)).trim()
}

const failedInScope = computed(() =>
  failedList.value.filter((f) => hostMatched(hostOfLabel(f.host)))
)

const failedOutOfScope = computed(() =>
  failedList.value.filter((f) => !hostMatched(hostOfLabel(f.host)))
)

const noiseOpen = ref(false)

const genning = ref(false)
const savingToken = ref(false)

/** 把这次抓包的 token 存到测试环境，用例执行时自动注入 */
async function saveToken() {
  savingToken.value = true
  try {
    const r = await apiClient.saveCaptureToken(sessionId.value || 'last', 'TEST')
    ElMessage.success(r.message)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingToken.value = false
  }
}
const docVisible = ref(false)
const docUploading = ref(false)
const docInput = ref<HTMLInputElement>()
const docFile = ref<File | null>(null)
const docResult = ref<any>(null)

function onDocPicked(e: Event) {
  docFile.value = (e.target as HTMLInputElement).files?.[0] || null
  docResult.value = null
}

/** 给这一单下所有涉及接口一次性生成用例 */
async function genCases() {
  const no = linkNo.value.trim() || form.requirementNo.trim()
  if (!no) {
    ElMessage.warning('先挂到需求单')
    return
  }
  genning.value = true
  try {
    const r = await apiClient.generateCasesForRequirement(no, {
      // 抓包页没有版本选择框；版本由生成器按需求单已有的集合决定
    })
    const parts: string[] = []
    if (r.created) parts.push(`新建 ${r.created} 条`)
    // 复用的也要说：不说的话人会以为没生成，然后再点一次
    if (r.reused) parts.push(`复用已有 ${r.reused} 条`)
    ElMessage.success(
      (parts.join('，') || '没有可生成的接口') +
        (r.cases[0]?.collectionName ? `，归入集合「${r.cases[0].collectionName}」` : '')
    )
    if (r.failed?.length) {
      ElMessage.warning(`${r.failed.length} 个没生成：${r.failed[0]}`)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    genning.value = false
  }
}

async function submitDoc() {
  if (!docFile.value) {
    ElMessage.warning('先选一个 .docx 文件')
    return
  }
  docUploading.value = true
  try {
    const r = await apiClient.importInterfaceDoc(form.project, docFile.value)
    // 不关弹窗：未匹配的接口要留给人看——那是漏测点，关掉就没人再想起来
    docResult.value = r
    ElMessage.success(`已写入 ${r.matched} 个接口的文档约束`)
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    docUploading.value = false
  }
}

const failedList = computed(() =>
  Object.entries(failedHosts.value)
    .map(([host, count]) => ({ host, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
)

const seenGrandTotal = computed(() =>
  Object.values(seenHosts.value).reduce((n, v) => n + Number(v), 0)
)

/** JSON 格式化一下再显示——一整行挤在一起的响应，看和不看没区别 */
function pretty(raw: string) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const respText = computed(() => pretty(detail.value?.respBody || ''))
const reqText = computed(() => pretty(detail.value?.reqBody || ''))

const respMatchCount = computed(() => countMatches(respText.value, respSearch.value.trim()))
const respHighlightedHtml = computed(() => highlightText(respText.value, respSearch.value.trim()))

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countMatches(text: string, query: string) {
  if (!query) return 0
  return text.match(new RegExp(escapeRegExp(query), 'gi'))?.length ?? 0
}

function highlightText(text: string, query: string) {
  const escaped = escapeHtml(text)
  if (!query) return escaped
  return escaped.replace(new RegExp(escapeRegExp(query), 'gi'), (m) => `<mark class="cap-hl">${m}</mark>`)
}

async function scrollRespMatch(step: number) {
  await nextTick()
  const root = respBodyRef.value
  if (!root) return
  const marks = root.querySelectorAll('mark.cap-hl')
  if (!marks.length) return
  if (step === 0) {
    respMatchIndex.value = 0
  } else {
    respMatchIndex.value = (respMatchIndex.value + step + marks.length) % marks.length
  }
  marks[respMatchIndex.value]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  marks.forEach((m, i) => m.classList.toggle('cap-hl-active', i === respMatchIndex.value))
}

watch(respSearch, async () => {
  respMatchIndex.value = 0
  await nextTick()
  if (!respSearch.value.trim()) return
  await scrollRespMatch(0)
})

const cookieText = computed(() => {
  const req = headerText(detail.value?.reqCookies)
  const resp = headerText(detail.value?.respCookies)
  const parts: string[] = []
  if (req) parts.push(`# 请求\n${req}`)
  if (resp) parts.push(`# 响应 Set-Cookie\n${resp}`)
  return parts.join('\n\n')
})

/** 和抓包工具的 Package 一个口径 */
function fmtSize(n?: number) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} K`
  return `${(n / 1024 / 1024).toFixed(2)} M`
}

function fmtTime(ms?: number) {
  if (!ms) return '—'
  const d = new Date(ms)
  const p = (x: number, w = 2) => String(x).padStart(w, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
  )
}

function headerText(h?: Record<string, string>) {
  if (!h) return ''
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

async function openDetail(row: any) {
  bodyVisible.value = true
  bodyLoading.value = true
  bodyErr.value = ''
  detail.value = null
  cur.value = row
  respSearch.value = ''
  respMatchIndex.value = 0
  // 默认落在概览：点开详情多半是想先看这条到底是什么，再决定看不看 body
  bodyTab.value = 'general'
  bodyTitle.value = `${row.method} ${row.path}`
  bodyTruncated.value = !!row.respTruncated
  try {
    // 抓完之后 session 已经结束了，用 last 取上一场
    const r = await apiClient.captureDetail(sessionId.value || 'last', row.seq)
    if (!r.available) {
      bodyErr.value = r.message || '这条没有留详情'
    } else {
      detail.value = r.detail
    }
  } catch (e: any) {
    bodyErr.value = e?.message || '读取失败'
  } finally {
    bodyLoading.value = false
  }
}

async function copyCurrent() {
  const map: Record<string, string> = {
    general: cur.value?.url || '',
    resp: respText.value,
    req: reqText.value,
    reqh: headerText(detail.value?.reqHeaders),
    resph: headerText(detail.value?.respHeaders),
    cookie: cookieText.value
  }
  try {
    await navigator.clipboard.writeText(map[bodyTab.value] || '')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，手动选中复制吧')
  }
}

async function createProj() {
  const code = newProj.code.trim()
  const name = newProj.name.trim()
  if (!code || !name) {
    ElMessage.warning('代号和名称都要填')
    return
  }
  projSaving.value = true
  try {
    await apiClient.createApiProject({ code, name, enabled: true })
    projects.value = await apiClient.getApiProjects({ enabledOnly: true })
    form.project = code
    newProjVisible.value = false
    newProj.code = ''
    newProj.name = ''
    ElMessage.success(`已创建项目 ${name}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建项目失败')
  } finally {
    projSaving.value = false
  }
}

async function linkNow() {
  const no = linkNo.value.trim()
  if (!no) {
    ElMessage.warning('先填需求单号')
    return
  }
  if (!form.project) {
    ElMessage.warning('先选接口归哪个项目——接口清单按项目分，不选就生不成用例')
    return
  }
  linking.value = true
  try {
    const r = await apiClient.linkCapturedFlows({
      requirementNo: no,
      project: form.project,
      sessionId: 'last',
      flows: flows.value.map((f) => ({
        method: f.method,
        path: f.path,
        host: f.host,
        seq: f.seq
      }))
    })
    lastLinked.value = r.linked
    linkedTo.value = no
    linkWarn.value = ''
    const extra = r.fieldsExtracted ? `，已解析 ${r.fieldsExtracted} 条响应字段` : ''
    ElMessage.success(`已挂 ${r.linked} 个接口到 ${no}${extra}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '挂载失败')
  } finally {
    linking.value = false
  }
}

function shortId(id: string) {
  return String(id || '').slice(-6)
}

/** 同名手机按尾号区分——一台手机在设备表里可能有好几条历史记录 */
function deviceLabel(d: any) {
  return `${d.name || d.id}（${d.platform} · ${shortId(d.id)}）`
}

function methodType(m: string) {
  if (m === 'GET') return 'success'
  if (m === 'DELETE') return 'danger'
  if (m === 'POST') return 'warning'
  return 'info'
}

function addHost(h: string) {
  const cur = form.hosts.split(',').map((x) => x.trim()).filter(Boolean)
  if (!cur.includes(h)) {
    cur.push(h)
    form.hosts = cur.join(',')
    // 点标签加的域名也要记住：不记的话下次进来又得重新点一遍
    rememberHosts(form.hosts)
    ElMessage.success(`已加入白名单：${h}，重新开始抓包后生效`)
  }
}

/**
 * 每 3 秒看一次。
 * 没有这个实时数字，你操作完点结束才发现一条都没抓到——而那时已经白操作一遍了。
 * 同时拉「代理上见到的域名」，抓到 0 条时它直接说明是哪种原因
 */
function startPoll() {
  stopPoll()
  poll = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const r = await apiClient.peekCapture(sessionId.value)
      // 一次赋值，避免轮询时多个 alert 同时 patch 导致 Vue 卸载异常
      count.value = r.total
      seenTotal.value = r.seenTotal || 0
      seenHosts.value = { ...(r.seenHosts || {}) }
      failedHosts.value = { ...(r.failedHosts || {}) }
    } catch {
      /* 轮询失败不打断抓包 */
    }
  }, 3000)
}

function stopPoll() {
  if (poll) {
    clearInterval(poll)
    poll = null
  }
}

async function start() {
  const dev = devices.value.find((d) => d.id === form.deviceId)
  starting.value = true
  flows.value = []
  lastLinked.value = 0
  try {
    const r = await apiClient.startCapture({
      deviceId: form.deviceId,
      platform: String(dev?.platform || 'ANDROID'),
      requirementNo: form.requirementNo.trim() || undefined,
      hosts: form.hosts.trim() || undefined
    })
    running.value = true
    sessionId.value = r.sessionId
    form.hosts = r.hosts || form.hosts
    runningHosts.value = form.hosts
    rememberHosts(form.hosts)
    count.value = 0
    seenHosts.value = {}
    seenTotal.value = 0
    tip.value = r.manualProxyTip || ''
    startPoll()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动抓包失败')
  } finally {
    starting.value = false
  }
}

async function stop() {
  stopping.value = true
  try {
    const r = await apiClient.stopCapture(sessionId.value, {
      requirementNo: form.requirementNo.trim() || undefined,
      project: form.project || undefined
    })
    flows.value = r.flows || []
    linkWarn.value = r.linkWarn || ''
    lastLinked.value = r.linked || 0
    linkedTo.value = r.linked ? form.requirementNo.trim() : ''
    linkNo.value = form.requirementNo.trim()
    seenHosts.value = r.seenHosts || {}
    failedHosts.value = r.failedHosts || {}
    ElMessage.success(
      `抓到 ${r.total} 条请求，去重后 ${r.distinct} 个接口` +
        (r.linked ? `，已挂到 ${form.requirementNo}` : '') +
        (r.fieldsExtracted ? `，解析 ${r.fieldsExtracted} 条响应字段` : '')
    )
    stopPoll()
    running.value = false
    sessionId.value = ''
    tip.value = ''
  } catch (e: any) {
    ElMessage.error(e?.message || '结束抓包失败')
  } finally {
    stopping.value = false
  }
}

onMounted(async () => {
  // 上次用过的白名单优先于配置默认值：加过的域名不该每次重打
  const saved = recallHosts()
  if (saved) form.hosts = saved
  try {
    projects.value = await apiClient.getApiProjects({ enabledOnly: true })
  } catch {
    projects.value = []
  }
  try {
    const all = await apiClient.getDevices()
    // 只列已连接的：离线设备选了也抓不了，而设备表里离线的占大多数
    devices.value = (all || []).filter(
      (d: any) => String(d.status || '').toUpperCase() === 'CONNECTED'
    )
  } catch {
    devices.value = []
  }
  try {
    const cur = await apiClient.currentCapture()
    if (cur.running && cur.sessionId) {
      running.value = true
      sessionId.value = cur.sessionId
      // 不恢复设备的话，刷新后设备框是空的，看着像「没选设备也在抓」
      form.deviceId = cur.deviceId || ''
      form.hosts = cur.hosts || ''
      runningHosts.value = cur.hosts || ''
      form.requirementNo = cur.requirementNo || ''
      startPoll()
    }
  } catch {
    /* 拿不到就当没在抓 */
  }
})

onBeforeUnmount(() => {
  // 只停轮询，不结束抓包——离开页面不代表抓完了
  stopPoll()
})
</script>

<style scoped>
.page {
  padding: 16px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.head-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cap-form :deep(.el-form-item__label) {
  white-space: nowrap;
  line-height: 32px;
}

.cap-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 28px;
  align-items: start;
}

.cap-field {
  margin-bottom: 0;
}

.cap-form :deep(.cap-field.el-form-item) {
  margin-bottom: 0;
}

.cap-control {
  width: 100%;
}

.cap-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.cap-field-body {
  width: 100%;
}

.cap-actions-live {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cap-actions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.cap-alerts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.cap-live {
  color: var(--el-color-danger);
  font-weight: 600;
}

.cap-count,
.cap-seen {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.cap-tip {
  margin: 0;
}

.cap-diag {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.9;
}

.cap-diag-hosts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.cap-host {
  cursor: pointer;
}

.cap-result-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}

.cap-proj {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.cap-proj-select {
  flex: 1;
  min-width: 0;
}

.cap-link-box {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.cap-gen :deep(.el-descriptions__label) {
  width: 190px;
  white-space: nowrap;
}

.cap-mono,
.cap-sz {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}

.cap-sz {
  white-space: nowrap;
}

.cap-body-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.cap-body-search {
  flex: 1;
  max-width: 320px;
}

.cap-search-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.cap-body :deep(mark.cap-hl) {
  background: #ffe58f;
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}

.cap-body :deep(mark.cap-hl-active) {
  background: #ffc53d;
  outline: 1px solid #faad14;
}

.cap-body {
  margin: 0;
  max-height: 56vh;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.cap-linked {
  font-size: 12px;
  color: var(--el-color-success);
}

.cap-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.cap-host-sub,
.opt-dim {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.opt-dim {
  margin-left: 10px;
}

.cap-trace {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}

.bad {
  color: var(--el-color-danger);
  font-weight: 600;
}

code {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--el-fill-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.cap-ratio {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.cap-steps {
  margin: 6px 0;
  padding-left: 20px;
  line-height: 1.9;
}

.cap-steps li {
  margin-bottom: 4px;
}

.cap-note {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--el-border-color);
  line-height: 1.8;
}

@media (max-width: 960px) {
  .cap-grid {
    grid-template-columns: 1fr;
  }
}

.cap-noise {
  margin-bottom: 10px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.cap-noise-toggle {
  cursor: pointer;
}

.cap-noise-body {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.cap-doc-tip {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
}

.cap-doc-file {
  margin-left: 10px;
  font-size: 12.5px;
}

.cap-doc-result {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12.5px;
  line-height: 1.9;
}

.cap-doc-warn {
  color: var(--el-color-warning);
}

.cap-doc-dim {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

</style>
