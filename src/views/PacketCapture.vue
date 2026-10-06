<template>
  <div class="page">
    <section class="cap-panel">
      <header class="cap-top">
        <div class="cap-top-title">
          <span>抓包</span>
            <el-popover trigger="click" placement="bottom-start" :width="620" popper-class="cap-help-popper">
              <template #reference>
                <span class="cap-help" title="抓不到怎么排查">
                  <el-icon><QuestionFilled /></el-icon>
                </span>
              </template>
              <div class="fx-help">
                <div class="fx-help-head">
                  <span class="fx-title">抓不到怎么排查</span>
                  <span class="fx-sub">按顺序，从最可能到最不可能</span>
                </div>
                <div class="fx-body">
              <ol class="fx-steps">
                <li>
                  <span class="fx-num fx-num--danger">1</span>
                  <div>
                    <div class="fx-step-title">
                      安卓 7 以上：App 默认不信任你装的证书
                      <span class="fx-chip fx-chip--danger">最常见</span>
                    </div>
                    <p>
                      装进「用户凭据」只有浏览器认（所以 <code>mitm.it</code> 打得开），但 <b>App 一律不认</b>。
                      要开发在 debug 包的 <code>network_security_config</code> 里加三行：
                    </p>
                    <pre class="fx-code">&lt;certificates src="user" /&gt;</pre>
                    <p>这比关 pinning 容易得多，先查这条。</p>
                  </div>
                </li>
                  <li>
                    <span class="fx-num fx-num--danger">2</span>
                    <div>
                      <div class="fx-step-title">
                        30 秒确认是不是第 1 条
                        <span class="fx-chip fx-chip--info">自查</span>
                      </div>
                      <div class="fx-ok">
                        <span class="fx-ok-mark">✓</span>
                        <div>
                          手机浏览器打开<b>任意 https 网站</b>：浏览器的请求<b>抓得到</b>、App 的<b>抓不到</b> ——
                          那就是第 1 条（浏览器信用户证书，App 不信），<b>不用再往 pinning 上想</b>。
                          两边都抓不到，说明证书压根没装好。
                        </div>
                      </div>
                    </div>
                  </li>
                  <li>
                    <span class="fx-num fx-num--warning">3</span>
                    <div>
                      <div class="fx-step-title">iOS：装完还要手动信任</div>
                      <p>
                        <b>设置 → 通用 → 关于本机 → 证书信任设置</b>，把 mitmproxy 那一项打开。
                        只装描述文件不打开这个开关，等于没装。
                      </p>
                    </div>
                  </li>
                  <li>
                    <span class="fx-num fx-num--warning">4</span>
                    <div>
                      <div class="fx-step-title">
                        出现 Server closed connection
                        <span class="fx-chip fx-chip--info">和证书无关</span>
                      </div>
                      <p>
                        是<b>电脑连不到那个地址</b>，或者它根本不是 HTTP 服务（游戏长连接之类）。
                        安卓走 USB 时代理跑在电脑上，电脑连不到的内网地址，手机也就走不通。
                        先确认 <code>电脑能不能 ping 通 / 端口通不通</code>，再排查证书。
                      </p>
                    </div>
                  </li>
                  <li>
                    <span class="fx-num fx-num--muted">5</span>
                    <div>
                      <div class="fx-step-title">
                        以上都做了还失败
                        <span class="fx-chip fx-chip--muted">才轮到这一步</span>
                      </div>
                      <p>这时<b>确认上游本身是好的</b>，再找开发出一个关掉 pinning 的包。</p>
                    </div>
                  </li>
              </ol>
                </div>
              </div>
            </el-popover>
        </div>
        <div v-if="!running" key="cap-idle" class="cap-top-actions">
          <el-button type="primary" :loading="starting" :disabled="!form.deviceId" @click="start">
            <el-icon><VideoPlay /></el-icon>开始抓包
          </el-button>
          <el-button :loading="resetting" :disabled="!canReset" @click="reset">重置</el-button>
          <el-button @click="openImport">
            <el-icon><Upload /></el-icon>导入抓包文件
          </el-button>
        </div>
        <div v-else key="cap-live" class="cap-top-actions">
          <span class="cap-live">● 抓包中</span>
          <el-tag v-if="hostsDirty" type="warning" size="small" effect="plain">
            白名单改过了，要结束后重新开始才生效
          </el-tag>
          <span class="cap-count">命中 {{ count }} 条 · 代理上 {{ seenTotal }} 个请求</span>
          <el-button type="danger" :loading="stopping" @click="stop">结束抓包</el-button>
          <el-button :loading="resetting" @click="reset">重置</el-button>
        </div>
      </header>

      <div class="cap-setup">
        <div class="cap-setup-col cap-setup-col--device">
          <div class="cap-label">设备</div>
          <el-select
            v-model="form.deviceId"
            filterable
            :placeholder="devices.length ? '选一台已连接的设备' : '没有已连接的设备'"
            class="cap-device-select"
          >
            <template #prefix>
              <el-icon><Iphone /></el-icon>
            </template>
            <template #label="{ value }">
              <span>{{ deviceName(value) }}</span>
              <span class="cap-dim-tail">{{ deviceTail(value) }}</span>
            </template>
            <el-option v-for="d in devices" :key="d.id" :label="deviceLabel(d)" :value="d.id">
              <span>{{ d.name || d.id }}</span>
              <span class="opt-dim">{{ d.platform }} · {{ deviceTail(d.id) }}</span>
            </el-option>
          </el-select>
        </div>

        <div class="cap-setup-col">
          <div class="cap-label">
            域名白名单
            <span class="cap-label-side">
              <span>{{ hostList.length }} 个</span>
              <a v-if="hostList.length" class="cap-mini-link" @click="clearHosts">全部清空</a>
            </span>
          </div>
          <div class="cap-host-box" @click="startHostAdd">
            <span v-for="h in hostList" :key="h" class="cap-host-chip" :class="{ 'is-ip': isIpHost(h) }">
              {{ h }}<i class="cap-host-x" @click.stop="removeHost(h)">×</i>
            </span>
            <input
              v-if="hostAdding"
              ref="hostInputRef"
              v-model="hostDraft"
              class="cap-host-input"
              placeholder="输入域名，回车添加"
              @keydown.enter.prevent="commitHostDraft"
              @keydown.backspace="onHostBackspace"
              @blur="commitHostDraft(true)"
            />
            <span v-else class="cap-host-add">{{ hostList.length ? '+ 添加' : '+ 添加域名（留空用默认）' }}</span>
          </div>
        </div>
      </div>

      <div v-if="!running && history.length" class="cap-history">
        <span class="cap-history-label">最近抓包</span>
        <button
          v-for="h in history"
          :key="h.id"
          type="button"
          class="cap-hist-chip"
          :class="{ active: h.id === viewingId }"
          :disabled="loadingHistory === h.id"
          @click="openHistory(h)"
        >
          <code>{{ historyWhen(h) }}</code>
          <b>{{ h.flow_count }}</b>
          <span class="cap-dim-tail">{{ historyDevice(h) }}</span>
        </button>
        <el-popover trigger="click" placement="bottom-end" :width="380" @show="loadAllHistory">
          <template #reference>
            <a class="cap-mini-link cap-history-all">全部记录 ›</a>
          </template>
          <div class="cap-hist-all">
            <div v-if="!allHistory.length" class="opt-dim">没有更早的记录</div>
            <button
              v-for="h in allHistory"
              :key="h.id"
              type="button"
              class="cap-hist-row"
              :class="{ active: h.id === viewingId }"
              @click="openHistory(h)"
            >
              <code>{{ historyWhen(h) }}</code>
              <b>{{ h.flow_count }} 条</b>
              <span class="cap-dim-tail">{{ historyDevice(h) }}</span>
            </button>
          </div>
        </el-popover>
      </div>
    </section>

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
        在「没进白名单的请求」里把要测的域名加入白名单，加完要<b>重新开始</b>才生效。
      </div>
      <div v-else key="cap-no-traffic" class="cap-diag">
        按顺序查这三件事：<br />
        1. <b>手机代理设了没</b> —— iOS 看上面那条黄色提示，安卓插 USB 会自动设<br />
        2. <b>mitmproxy 的证书装了没</b> —— iOS <b>不要用 mitm.it</b>（直连常 404）。
        先把 WiFi 代理改成「关闭」，Safari 打开
        <code>http://电脑局域网IP:3080/api/packet-capture/mitm-ca</code> 安装；
        再到 设置 → 通用 → 关于本机 → <b>证书信任设置</b> 打开完全信任，
        再把代理改回手动。你原来抓包工具的证书和这个不是同一张<br />
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

    <section v-if="flows.length || diagKeys.length" class="cap-panel cap-panel--result">
      <el-tabs v-if="flows.length || diagKeys.length" v-model="mainTab" class="cap-tabs">
        <el-tab-pane name="flows">
          <template #label>
            抓到的接口<span class="cap-tab-num">{{ kindCount('api') }}</span>
          </template>
          <div v-if="flows.length" key="cap-result" class="cap-result">
            <el-alert
              v-if="viewingEnv === 'PROD'"
              type="warning"
              :closable="false"
              show-icon
              class="cap-prod-tip"
              title="这是导入的生产环境抓包"
              description="收录后 AI 只给 GET 查询接口生成用例（环境 = 生产）；POST 等写接口只收录、不生成，免得在生产上改数据。token 已打码，不会存进用例。"
            />
            <div class="cap-sum">
              <div class="cap-sum-left">
                <div class="cap-sum-main">
                  <b class="cap-sum-num">{{ kindCount('api') }}</b>
                  <span class="cap-sum-unit">个接口</span>
                  <span v-if="savedCount > 0" class="cap-pill cap-pill--ok">✓ 已收录 {{ savedCount }}</span>
                  <span v-if="pendingCount > 0" class="cap-pill cap-pill--warn">待收录 {{ pendingCount }}</span>
                  <span v-if="inboxCount" class="cap-pill cap-pill--warn">待归类 {{ inboxCount }}</span>
                </div>
                <!--
                  「4 个接口」孤零零摆着，人会以为抓漏了。
                  真实关系是「23 个请求 → 12 个命中白名单 → 去重后 4 个接口」，
                  中间那两步不写出来，少的那 19 个就成了悬案。
                  命中数必须用后端实际抓到的条数，不能拿「代理上见到的」去减——
                  见到不等于抓到：没等到响应的、被挡掉的，都在「见到」里
                -->
                <div class="cap-sum-sub">
                  代理上共 {{ seenGrandTotal }} 个请求<i>·</i>命中白名单 {{ capturedTotal }} 次<i>·</i>去重后
                  {{ flows.length }} 条
                </div>
              </div>
              <div class="cap-sum-actions">
                <el-button type="primary" :loading="saving" @click="openSaveDialog">收录到接口管理</el-button>
                <el-button :disabled="!inboxCount && !savedCount" @click="goEndpoints">
                  <template v-if="inboxCount">去接口管理归类（{{ inboxCount }}）</template>
                  <template v-else>去接口清单查看</template>
                </el-button>
                <el-button :disabled="!savedEndpointCount || saving" :loading="aiGenning" @click="aiGenFromCapture()">
                  {{ aiGenning ? aiProgress || 'AI 生成中…' : `✦ AI 生成用例${savedEndpointCount ? `（${savedEndpointCount}）` : ''}` }}
                </el-button>
                <el-button v-if="!viewingImported" :loading="savingToken" @click="saveToken">用这次的 token</el-button>
              </div>
            </div>
            <div class="cap-kind-bar">
              <button
                v-for="tab in kindTabs"
                :key="tab.id"
                type="button"
                class="cap-kind-tab"
                :class="{ active: kindTab === tab.id }"
                @click="kindTab = tab.id"
              >
                {{ tab.label }}<em>{{ tab.count }}</em>
              </button>
              <span v-if="kindTab === 'api' && staticCount" class="cap-kind-note">已过滤掉 {{ staticCount }} 个静态资源</span>
              <el-input
                v-model="flowKeyword"
                class="cap-flow-search"
                :class="{ 'is-pushed': !(kindTab === 'api' && staticCount) }"
                size="small"
                clearable
                placeholder="搜路径 / 域名 / 方法 / 项目"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <el-table
              :data="pagedFlows"
              class="cap-table"
              style="width: 100%"
              :empty-text="flowKeyword.trim() ? `没搜到「${flowKeyword.trim()}」` : '这一类没有请求'"
            >
              <el-table-column label="方法" width="96">
                <template #default="{ row }">
                  <span class="cap-method" :class="`cap-method--${String(row.method || '').toLowerCase()}`">
                    {{ row.method }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="路径" min-width="300">
                <template #default="{ row }">
                  <div class="cap-path">{{ row.path }}</div>
                  <div class="cap-path-sub">
                    <!-- 被调了几次直接标出来：轮询接口调七八次很常见，看不到次数就会以为抓重复了 -->
                    <span v-if="row.calls > 1" class="cap-calls">× {{ row.calls }}</span>
                    <span>{{ row.host }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column v-if="kindTab === 'api'" key="cap-catalog" label="接口管理" min-width="150">
                <template #default="{ row }">
                  <template v-if="row.endpointId">
                    <span v-if="row.project === 'capture-inbox'" class="cap-tag cap-tag--warn">待归类</span>
                    <span v-else class="cap-tag cap-tag--ok">✓ {{ projectName(row.project) }}</span>
                  </template>
                  <template v-else>
                    <span class="cap-tag cap-tag--warn" :title="row.catalogMessage || ''">未收录</span>
                    <a class="cap-mini-link cap-catalog-go" @click="openSaveDialog">收录</a>
                  </template>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <span class="cap-status" :class="{ bad: row.status >= 400 }">{{ row.status }}</span>
                </template>
              </el-table-column>
              <el-table-column label="耗时" width="96">
                <template #default="{ row }">
                  <span class="cap-dur">{{ row.durationMs }} ms</span>
                </template>
              </el-table-column>
              <el-table-column label="大小" min-width="150">
                <template #default="{ row }">
                  <span class="cap-sz">↑{{ fmtSize(row.reqBytes) }} / ↓{{ fmtSize(row.respBytes) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="详情" width="70" align="center">
                <template #default="{ row }">
                  <a class="cap-mini-link" @click.stop="openDetail(row)">详情</a>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="searchedFlows.length > FLOW_PAGE_SIZE" class="cap-pager">
              <span class="cap-kind-note">
                共 {{ searchedFlows.length }} 条<template v-if="flowKeyword.trim()">（搜索结果）</template>
              </span>
              <el-pagination
                v-model:current-page="flowPage"
                :page-size="FLOW_PAGE_SIZE"
                :total="searchedFlows.length"
                layout="prev, pager, next"
                small
                background
              />
            </div>
          </div>
          <div v-if="!flows.length" class="cap-tab-empty">还没抓到接口</div>
        </el-tab-pane>
        <el-tab-pane v-if="diagKeys.length" name="diag">
          <template #label>
            抓包诊断<span v-if="failedInScope.length" class="cap-tab-num cap-tab-num--danger">{{ failedInScope.length }}</span>
          </template>
          <div class="cap-alerts cap-diag-pane">
            <template v-if="failedInScope.length > 0">
              <section ref="failCardRef" key="cap-failed" class="fx-card">
                <header class="fx-head">
                  <span class="fx-icon fx-icon--danger">✕</span>
                  <span class="fx-title">连不上的域名</span>
                  <span class="fx-sub">白名单内但这几个抓不到</span>
                  <span class="fx-count">{{ failedInScope.length }} 条</span>
                </header>
                <div class="fx-body fx-hosts">
                  <div
                    v-for="f in failAllOpen ? failedRows : failedRows.slice(0, 1)"
                    :key="f.label"
                    class="fx-host"
                  >
                    <div class="fx-host-line">
                      <code class="fx-host-name">{{ f.host }}</code>
                      <span class="fx-badge" :class="`fx-badge--${f.tone}`">{{ f.kind }}</span>
                      <span v-if="!f.detail" class="fx-times">× {{ f.count }}</span>
                    </div>
                    <div v-if="f.detail" class="fx-host-detail">
                      <code :class="{ 'is-open': failOpen[f.label] }">{{ f.detail }}</code>
                      <span class="fx-link" @click="failOpen[f.label] = !failOpen[f.label]">
                        {{ failOpen[f.label] ? '收起' : '展开' }}
                      </span>
                    </div>
                  </div>
                  <div v-if="failedRows.length > 1" class="fx-more" @click="failAllOpen = !failAllOpen">
                    {{ failAllOpen ? '▴ 收起' : `▾ 展开其余 ${failedRows.length - 1} 条` }}
                  </div>
                </div>
              </section>

              <section key="cap-codes" class="fx-card">
                <header class="fx-head">
                  <span class="fx-icon fx-icon--warning">!</span>
                  <span class="fx-title">先对照错误码</span>
                  <span class="fx-sub">标签里的那句话直接指向原因</span>
                </header>
                <div class="fx-body">
                  <table class="fx-table">
                    <thead>
                      <tr><th>错误码</th><th>说明</th><th>怎么处理</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>unknown ca</code><small>certificate unknown</small></td>
                        <td>手机<b>不信任</b>这张证书 —— 证书装了但没被承认</td>
                        <td><span class="fx-chip fx-chip--danger">装证书</span>见标题旁 ? 提示第 1 / 3 条</td>
                      </tr>
                      <template v-if="codesOpen">
                      <tr>
                        <td><code>bad certificate</code><small>certificate revoked</small></td>
                        <td>证书本身没问题却被拒 —— 这是 <b>App 固定了证书（pinning）</b></td>
                        <td><span class="fx-chip fx-chip--warning">才轮到 pinning</span>要开发出一个关掉 pinning 的包</td>
                      </tr>
                      <tr>
                        <td><code>handshake failure</code><small>protocol version</small></td>
                        <td>TLS 版本或加密套件对不上，<b>和证书无关</b></td>
                        <td><span class="fx-chip fx-chip--info">查服务端</span>让后端确认 TLS 版本配置</td>
                      </tr>
                      <tr>
                        <td><code>server closed connection</code></td>
                        <td>电脑连不到这个地址，或它<b>根本不是 HTTP 服务</b></td>
                        <td><span class="fx-chip fx-chip--info">查网络</span>见标题旁 ? 提示第 4 条</td>
                      </tr>
                      </template>
                    </tbody>
                  </table>
                  <div class="fx-more fx-more--table" @click="codesOpen = !codesOpen">
                    {{ codesOpen ? '▴ 收起' : '▾ 展开其余 3 条' }}
                  </div>
                </div>
              </section>
            </template>

          <section
            v-if="(running || flows.length > 0) && missedHosts.length > 0"
            key="cap-missed"
            class="fx-card"
          >
            <header class="fx-head">
              <span class="fx-icon fx-icon--warning">!</span>
              <span class="fx-title">没进白名单的请求</span>
              <span class="fx-sub">
                只抓到一两条时先看这里：App 常有好几个网关域名，少加一个整块接口就不见了
              </span>
              <span class="fx-count">{{ missedHosts.length }} 个域名 · {{ missedTotal }} 次</span>
            </header>
            <div class="fx-body fx-hosts">
              <div
                v-for="h in missedOpen ? missedHosts : missedHosts.slice(0, MISSED_PREVIEW)"
                :key="h.host"
                class="fx-host"
              >
                <div class="fx-host-line">
                  <code class="fx-host-name">{{ h.host }}</code>
                  <span class="fx-times fx-times--push">× {{ h.count }}</span>
                  <span class="fx-link" @click="addHost(h.host)">加入白名单</span>
                </div>
              </div>
              <div class="fx-more-row">
                <span
                  v-if="missedHosts.length > MISSED_PREVIEW"
                  class="fx-more"
                  @click="missedOpen = !missedOpen"
                >
                  {{ missedOpen ? '▴ 收起' : `▾ 展开其余 ${missedHosts.length - MISSED_PREVIEW} 个` }}
                </span>
                <span class="fx-sub">加完要重新开始抓包才生效</span>
              </div>
            </div>
          </section>

            <!--
              白名单外的握手失败是噪音：第三方 SDK（QQ 埋点、华为云）自己在做证书校验，
              和你要测的接口没关系。折叠起来、不用红色——
              和真故障并排喊红的话，抓包明明成功了（命中 19/19）满屏还是红的
            -->
            <section v-if="failedOutOfScope.length > 0" key="cap-noise" class="fx-card">
              <header class="fx-head">
                <span class="fx-icon fx-icon--muted">–</span>
                <span class="fx-title">白名单外握手失败</span>
                <span class="fx-sub">第三方 SDK 自己在做证书校验，通常不用管</span>
                <span class="fx-count">{{ failedOutOfScope.length }} 条</span>
              </header>
              <div class="fx-body fx-hosts">
                <div
                  v-for="f in noiseOpen ? noiseRows : noiseRows.slice(0, 1)"
                  :key="f.label"
                  class="fx-host"
                >
                  <div class="fx-host-line">
                    <code class="fx-host-name">{{ f.host }}</code>
                    <span class="fx-badge fx-badge--muted">{{ f.kind }}</span>
                    <span v-if="!f.detail" class="fx-times">× {{ f.count }}</span>
                  </div>
                  <div v-if="f.detail" class="fx-host-detail">
                    <code :class="{ 'is-open': failOpen[f.label] }">{{ f.detail }}</code>
                    <span class="fx-link" @click="failOpen[f.label] = !failOpen[f.label]">
                      {{ failOpen[f.label] ? '收起' : '展开' }}
                    </span>
                  </div>
                </div>
                <div v-if="noiseRows.length > 1" class="fx-more" @click="noiseOpen = !noiseOpen">
                  {{ noiseOpen ? '▴ 收起' : `▾ 展开其余 ${noiseRows.length - 1} 条` }}
                </div>
              </div>
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="importVisible"
      title="导入抓包文件"
      width="560px"
      class="cap-import-dialog"
      append-to-body
      destroy-on-close
    >
      <div class="cap-import">
        <el-upload
          drag
          :auto-upload="false"
          :show-file-list="false"
          accept=".har,.txt,.json,.log"
          :on-change="onImportFile"
        >
          <div class="cap-import-drop">
            <span class="cap-import-icon" :class="{ done: importFile }">
              <el-icon v-if="importFile"><Document /></el-icon>
              <template v-else>↑</template>
            </span>
            <div class="cap-import-text">
              <div v-if="importFile" class="cap-import-title">
                <b>{{ importFile.name }}</b>
                <span class="cap-import-size">{{ importSize }}</span>
                <em>重新选择</em>
              </div>
              <div v-else class="cap-import-title">把文件拖到这里，或<em>点击选择</em></div>
              <div class="cap-import-sub">支持 HAR 和 Request/Response 文本 · 可含多段</div>
            </div>
          </div>
        </el-upload>
        <div class="cap-import-env">
          <span class="cap-import-env-label">这份包的环境</span>
          <div class="cap-seg">
            <button
              type="button"
              :class="{ on: importEnv === 'PROD' }"
              @click="importEnv = 'PROD'"
            >生产</button>
            <button
              type="button"
              :class="{ on: importEnv === 'TEST' }"
              @click="importEnv = 'TEST'"
            >测试</button>
          </div>
        </div>
        <p class="cap-import-note">
          <template v-if="importEnv === 'PROD'">生产包只给 GET 生成用例，写接口只收录；</template>
          <template v-else>测试包和手机现场抓的一样处理；</template>
          <code>token / Cookie</code> 导入即打码
        </p>
      </div>
      <template #footer>
        <div class="cap-import-foot">
          <span class="cap-import-foot-tip">
            {{ importFile ? `已选 1 个文件（${importSize}）` : '选文件后可导入' }}
          </span>
          <el-button @click="importVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!importFile" :loading="importing" @click="doImport">导入</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bodyVisible"
      :title="bodyTitle"
      width="960px"
      top="6vh"
      append-to-body
      destroy-on-close
      :z-index="6200"
      class="cap-detail-dialog"
    >
      <div v-loading="bodyLoading" class="cap-detail-body">
        <el-alert
          v-if="bodyErr"
          type="warning"
          :closable="false"
          show-icon
          :title="bodyErr"
        />
        <template v-else-if="!bodyLoading && detail">
          <el-alert
            v-if="bodyTruncated"
            type="warning"
            :closable="false"
            show-icon
            class="cap-tip"
            title="这场抓包时响应被截过。重新抓一次才能看到全文"
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
            <el-tab-pane label="源码体检" name="insight" lazy>
              <EndpointInsightPanel
                v-if="cur"
                :key="cur.seq"
                :project="insightProject"
                :method="String(cur.method || 'GET').toUpperCase()"
                :path="cur.path"
                :resp-sample="detail?.respBody || ''"
                :endpoint-id="cur.endpointId || undefined"
                :projects="projectOptions"
                auto
                @project="rememberInsightProject"
              />
            </el-tab-pane>
            <el-tab-pane label="字段对照" name="fields">
              <p class="cap-fields-tip">
                对照源是 App 战绩页（swift-sphere deadlock/matchDetail），不是猜的。
                「前端判断」是这一条 JSON 套进页面源码后会怎么走；字段表里「用法」写清直出还是算出来的。
              </p>
              <div v-if="matchJudgments?.length" class="cap-judge">
                <div class="cap-judge-head">这一条 · 前端判断</div>
                <el-table :data="matchJudgments" size="small" border class="cap-judge-table">
                  <el-table-column prop="title" label="看什么" width="120" />
                  <el-table-column label="前端怎么写" min-width="200">
                    <template #default="{ row }">
                      <span class="cap-mono">{{ row.code }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="本条后端值" min-width="180">
                    <template #default="{ row }">
                      <span class="cap-mono">{{ row.sample }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="outcome" label="页面会怎样" min-width="200" />
                </el-table>
              </div>
              <el-alert
                v-else-if="fieldRows.length"
                type="info"
                :closable="false"
                show-icon
                class="cap-tip"
                title="这条不是战绩详情（没有 result.players / demoStatus），下面只对字段名，没有判断演算。"
              />
              <div class="cap-body-toolbar">
                <el-input
                  v-model="fieldSearch"
                  clearable
                  placeholder="搜字段名 / 中文 / 路径 / 用法"
                  class="cap-body-search"
                />
                <el-radio-group v-model="fieldFilter" size="small">
                  <el-radio-button label="app">前端在用</el-radio-button>
                  <el-radio-button label="labeled">已有中文</el-radio-button>
                  <el-radio-button label="all">全部</el-radio-button>
                  <el-radio-button label="empty">未标注</el-radio-button>
                  <el-radio-button label="mismatch">文案不一致</el-radio-button>
                </el-radio-group>
                <span class="cap-search-meta">{{ fieldRowsView.length }} / {{ fieldRows.length }}</span>
              </div>
              <el-alert
                v-if="!fieldRows.length"
                type="info"
                :closable="false"
                show-icon
                class="cap-tip"
                title="这条响应不是 JSON，对不上字段"
              />
              <el-table
                v-else
                :data="fieldRowsView"
                size="small"
                border
                height="52vh"
                class="cap-fields-table"
              >
                <el-table-column label="路径" min-width="240">
                  <template #default="{ row }">
                    <span class="cap-path">{{ row.path }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="name" label="字段" width="160" />
                <el-table-column label="前端中文" min-width="180">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.zh"
                      size="small"
                      :placeholder="row.appZh || row.seed || '对得上再填'"
                      @change="onFieldLabelChange(row)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="用法" min-width="220">
                  <template #default="{ row }">
                    <div v-if="row.appNote || row.appUse" class="cap-use">
                      <el-tag v-if="row.appUse" size="small" effect="plain">{{ useLabel(row.appUse) }}</el-tag>
                      <span>{{ row.appNote }}</span>
                    </div>
                    <span v-else class="opt-dim" style="margin: 0">战绩页没用到</span>
                  </template>
                </el-table-column>
                <el-table-column label="来源" width="88" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.mismatch" size="small" type="danger" effect="plain">不一致</el-tag>
                    <el-tag v-else-if="row.source === 'override'" size="small" type="warning">手改</el-tag>
                    <el-tag v-else-if="row.source === 'app'" size="small" type="success" effect="plain">战绩页</el-tag>
                    <el-tag v-else-if="row.source === 'seed'" size="small" type="info" effect="plain">内置</el-tag>
                    <span v-else class="opt-dim" style="margin: 0">—</span>
                  </template>
                </el-table-column>
                <el-table-column label="示例" min-width="140">
                  <template #default="{ row }">
                    <span class="cap-mono">{{ row.sample }}</span>
                  </template>
                </el-table-column>
              </el-table>
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
                <div v-if="respParsed != null" ref="respBodyRef" class="cap-json-wrap">
                  <CaptureJsonTree :value="respParsed" :query="respSearch.trim()" />
                </div>
                <pre v-else ref="respBodyRef" class="cap-body" v-html="respHighlightedHtml" />
              </template>
            </el-tab-pane>
            <el-tab-pane label="请求体" name="req">
              <div v-if="reqParsed != null" class="cap-json-wrap">
                <CaptureJsonTree :value="reqParsed" />
              </div>
              <pre v-else class="cap-body">{{ reqText || '（没有请求体）' }}</pre>
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
        <div v-else-if="!bodyLoading" class="cap-detail-empty">没有读到详情</div>
      </div>
      <template #footer>
        <el-button v-if="!bodyErr && detail" @click="copyCurrent">复制当前内容</el-button>
        <el-button type="primary" @click="bodyVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="saveDlg"
      title="收录到接口管理"
      width="820px"
      append-to-body
      :z-index="6100"
      class="cap-save-dialog"
    >
      <div class="cap-save-head">
        <span class="cap-save-label">全部归到</span>
        <el-select
          v-model="bulkProject"
          filterable
          clearable
          placeholder="选项目，勾选的行一起改"
          class="cap-save-bulk"
          popper-class="cap-save-popper"
          @change="applyBulk"
        >
          <el-option v-for="p in projectOptions" :key="p.code" :label="p.name || p.code" :value="p.code">
            <span>{{ p.name || p.code }}</span>
            <span class="opt-dim">{{ p.code }}</span>
          </el-option>
        </el-select>
        <span class="opt-dim">也可以逐行改。收录后出现在该项目的接口清单里</span>
      </div>
      <div class="cap-save-sum">
        <span v-if="knownLoading">正在和接口清单比对…</span>
        <span v-else>
          抓到 {{ saveSummary.total }} 个接口（同一接口多次调用已合并）：新的 <b>{{ saveSummary.fresh }}</b> 个
          <template v-if="saveSummary.known"> · 已收录 {{ saveSummary.known }} 个</template>
          <el-tooltip
            v-if="saveSummary.preflight"
            content="浏览器跨域前自动发的 OPTIONS，没有业务响应，源码里也没有对应方法"
            placement="top"
          >
            <span> · OPTIONS 预检 {{ saveSummary.preflight }} 个（不收录）</span>
          </el-tooltip>
          <span v-if="knownFailed" class="cap-save-warn">（没比对上接口清单，已收录的也会列出来）</span>
        </span>
        <span class="cap-save-toggles">
          <el-checkbox v-if="saveSummary.known" v-model="showKnown" size="small">显示已收录</el-checkbox>        </span>
      </div>
      <el-table
        ref="saveTableRef"
        v-loading="knownLoading"
        :data="visibleSaveRows"
        size="small"
        max-height="440"
        row-key="key"
        @selection-change="(rows: SaveRow[]) => (saveChecked = rows)"
      >
        <template #empty>
          <span v-if="saveSummary.total && !saveSummary.fresh">
            这次抓到的接口都收录过了，不用再收。要用这次的抓包覆盖原样本，勾上方「显示已收录」再选
          </span>
          <span v-else>没有可收录的接口</span>
        </template>
        <el-table-column type="selection" width="40" />
        <el-table-column label="方法" width="76">
          <template #default="{ row }">
            <el-tag size="small" :type="methodType(row.method)">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="路径" min-width="280">
          <template #default="{ row }">
            <div class="cap-path">{{ row.path }}</div>
            <div class="cap-host-sub">
              {{ row.host }}<template v-if="row.calls > 1"> · 调了 {{ row.calls }} 次</template>
            </div>
            <div v-if="isKnown(row) || row.inbox" class="cap-save-tags">
              <el-tooltip
                v-if="isKnown(row)"
                content="再收录不会多出一条，只会用这次的抓包覆盖原来的请求/响应样本，已有用例不动"
                placement="top"
              >
                <el-tag size="small" type="success" effect="plain">已收录 · {{ knownText(row) }}</el-tag>
              </el-tooltip>
              <el-tooltip
                v-if="row.inbox"
                content="之前收录时没认出项目，停在「待归类」。这次选了项目会挪过去"
                placement="top"
              >
                <el-tag size="small" type="warning" effect="plain">在待归类里</el-tag>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="归属项目" width="230">
          <template #default="{ row }">
            <el-select
              v-model="row.project"
              filterable
              size="small"
              placeholder="选项目"
              popper-class="cap-save-popper"
              :class="{ 'cap-save-missing': isChecked(row) && !row.project }"
            >
              <el-option
                v-for="p in projectOptions"
                :key="p.code"
                :label="p.name || p.code"
                :value="p.code"
              />
            </el-select>
            <div v-if="row.guess && row.project && row.project !== row.guess.project" class="cap-save-mismatch">
              <el-tooltip :content="row.guess.reason" placement="top">
                <span>路径像 {{ projectName(row.guess.project) || row.guess.project }} 的</span>
              </el-tooltip>
              <el-button link type="primary" size="small" @click="row.project = row.guess.project">改过去</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="urlPlanRows.length" class="cap-url">
        <div class="cap-url-head">
          <span class="cap-save-label">回填项目地址</span>
          <el-radio-group v-model="urlEnv" size="small">
            <el-radio-button value="TEST">测试环境</el-radio-button>
            <el-radio-button value="PROD">线上环境</el-radio-button>
          </el-radio-group>
          <span class="opt-dim">域名默认取抓包的，可以改；勾上的写进「项目管理 → 地址」并排在最前，执行时默认走它</span>
        </div>
        <template v-for="g in urlPlanRows" :key="g.project">
          <div v-if="urlPlans[g.project]" class="cap-url-row">
            <el-checkbox v-model="urlPlans[g.project].enabled" />
            <span class="cap-url-proj">{{ projectName(g.project) || g.project }}</span>
            <el-autocomplete
              v-model="urlPlans[g.project].baseUrl"
              :fetch-suggestions="(_q: string, cb: (v: { value: string }[]) => void) => cb(g.origins.map((o) => ({ value: o })))"
              size="small"
              placeholder="https://域名"
              class="cap-url-input"
              popper-class="cap-save-popper"
              :disabled="!urlPlans[g.project].enabled"
              @input="urlPlans[g.project].touched = true"
              @select="urlPlans[g.project].touched = true"
            />
            <span class="cap-url-now" :class="{ 'is-change': urlChange(g.project) }">{{ urlNowText(g.project) }}</span>
          </div>
        </template>
      </div>
      <template #footer>
        <el-checkbox v-model="aiAfterSave" class="cap-save-ai">收录后用 AI 生成用例（只生成不执行）</el-checkbox>
        <span class="cap-save-foot">
          已勾选 {{ saveChecked.length }} 个
          <template v-if="missingProject">，<b>{{ missingProject }} 个还没选项目</b></template>
        </span>
        <el-button @click="saveDlg = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!saveChecked.length || missingProject > 0"
          @click="saveToCatalog"
        >
          收录 {{ saveChecked.length }} 个
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'
import CaptureJsonTree from '../components/CaptureJsonTree.vue'
import EndpointInsightPanel from '../components/EndpointInsightPanel.vue'
import {
  flattenFields,
  loadOverrides,
  parseRespBody,
  resolveLabel,
  saveOverride,
  SEED_LABELS
} from '../utils/captureFieldLabels'
import {
  appMetaOf,
  evaluateMatchJudgments,
  type AppFieldUse
} from '../utils/captureFrontendRules'
import {
  captureKind,
  CAPTURE_KIND_TABS,
  type CaptureKind
} from '../utils/captureResourceKind'

const router = useRouter()
const devices = ref<any[]>([])
const form = reactive({ deviceId: '', hosts: '' })
const projects = ref<any[]>([])

const running = ref(false)
const starting = ref(false)
const stopping = ref(false)
const resetting = ref(false)
const sessionId = ref('')
/** 结束后仍能按这场 id 读详情；单靠 last 在后端重启后会丢 */
const finishedSessionId = ref('')
/** 当前这场是哪个环境的：导入的生产包是 PROD，手机现场抓的是 TEST */
const viewingEnv = ref<'TEST' | 'PROD'>('TEST')
const viewingImported = ref(false)
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
const kindTab = ref<CaptureKind>('api')

const kindTabs = computed(() =>
  CAPTURE_KIND_TABS.map((t) => ({ ...t, count: kindCount(t.id) })).filter(
    (t) => t.id === 'api' || t.count > 0
  )
)

const kindFlows = computed(() => flows.value.filter((f) => captureKind(f) === kindTab.value))

const FLOW_PAGE_SIZE = 20
const flowKeyword = ref('')
const flowPage = ref(1)

/** 空格隔开的几个词都要命中；项目按中文名和编码都能搜 */
const searchedFlows = computed(() => {
  const words = flowKeyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return kindFlows.value
  return kindFlows.value.filter((f) => {
    const text = [f.method, f.path, f.host, f.query, f.project, f.project ? projectName(f.project) : '', f.status]
      .map((x) => String(x ?? '').toLowerCase())
      .join(' ')
    return words.every((w) => text.includes(w))
  })
})

const pagedFlows = computed(() => {
  const start = (flowPage.value - 1) * FLOW_PAGE_SIZE
  return searchedFlows.value.slice(start, start + FLOW_PAGE_SIZE)
})

watch([flowKeyword, kindTab], () => {
  flowPage.value = 1
})
// 收录后表格会整体换一遍数据，页码超出就退回最后一页，别停在空页上
watch(
  () => searchedFlows.value.length,
  (n) => {
    const last = Math.max(1, Math.ceil(n / FLOW_PAGE_SIZE))
    if (flowPage.value > last) flowPage.value = last
  }
)

function kindCount(id: CaptureKind) {
  return flows.value.filter((f) => captureKind(f) === id).length
}

const apiFlows = computed(() => flows.value.filter((f) => captureKind(f) === 'api'))

watch(flows, () => {
  if (kindCount(kindTab.value) > 0) return
  const first = kindTabs.value.find((t) => t.count > 0)
  kindTab.value = first?.id || 'api'
})
const saving = ref(false)
const savedCount = computed(() => apiFlows.value.filter((f) => f.endpointId).length)
const inboxCount = computed(() =>
  apiFlows.value.filter((f) => f.endpointId && f.project === 'capture-inbox').length
)
const pendingCount = computed(() => apiFlows.value.filter((f) => !f.endpointId).length)
const staticCount = computed(() =>
  (['js', 'css', 'image', 'page'] as CaptureKind[]).reduce((n, k) => n + kindCount(k), 0)
)
const linkWarn = ref('')

function projectName(code?: string | null) {
  if (!code || code === 'capture-inbox') return ''
  return projects.value.find((p) => p.code === code)?.name || code
}

function goEndpoints() {
  const owners = [...new Set(apiFlows.value.filter((f) => f.endpointId).map((f) => f.project))]
  const project = inboxCount.value ? 'capture-inbox' : owners.length === 1 ? owners[0] : ''
  router.push({ path: '/api-endpoints', query: project ? { project } : undefined })
}

/** 接口清单只认后端项目；选了 App/前端项目的话，收进去在清单里看不到 */
const projectOptions = computed(() =>
  projects.value.filter((p) => !p.kind || String(p.kind).toUpperCase() === 'BACKEND')
)

interface SaveRow {
  key: string
  seq?: number
  method: string
  path: string
  query?: string
  host?: string
  url?: string
  project: string
  /** 这次抓包里同一 方法+路径 调了几次 */
  calls: number
  /** 已经在哪些项目的清单里（不含待归类） */
  owners: Array<{ project: string; id: string; caseCount: number }>
  inbox: boolean
  /** 按路径第一段猜的项目 */
  guess?: { project: string; reason: string }
}

const HOST_PROJECT_KEY = 'packet-capture:host-project'

function recallHostProjects(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(HOST_PROJECT_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

/** 同一个域名下次默认带上次选的项目：每次抓包都从头选一遍太烦 */
function rememberHostProjects(rows: SaveRow[]) {
  const map = recallHostProjects()
  for (const r of rows) if (r.host && r.project) map[r.host] = r.project
  try {
    localStorage.setItem(HOST_PROJECT_KEY, JSON.stringify(map))
  } catch {
    /* 写不了只是下次不预填 */
  }
}

/** 体检默认用的项目：收录时选的，其次这个域名上次选的 */
const insightProject = computed(() => {
  const f = cur.value
  if (!f) return ''
  const valid = new Set(projectOptions.value.map((p) => p.code))
  if (f.endpointId && valid.has(f.project)) return f.project
  const remembered = recallHostProjects()[f.host]
  return valid.has(remembered) ? remembered : ''
})

function rememberInsightProject(code: string) {
  if (cur.value?.host) rememberHostProjects([{ host: cur.value.host, project: code } as SaveRow])
}

const saveDlg = ref(false)
const saveRows = ref<SaveRow[]>([])
const saveChecked = ref<SaveRow[]>([])
const bulkProject = ref('')
const saveTableRef = ref<any>(null)
const checkedKeys = computed(() => new Set(saveChecked.value.map((r) => r.key)))
const missingProject = computed(() => saveChecked.value.filter((r) => !r.project).length)

function isChecked(row: SaveRow) {
  return checkedKeys.value.has(row.key)
}

/** 浏览器跨域前自动发的 OPTIONS，不是业务接口，后端也拒收 */
const isPreflight = (r: SaveRow) => r.method === 'OPTIONS'
const isKnown = (r: SaveRow) => r.owners.length > 0
const showKnown = ref(false)
const knownLoading = ref(false)
const knownFailed = ref(false)
const visibleSaveRows = computed(() =>
  saveRows.value.filter((r) => !isPreflight(r) && (showKnown.value || !isKnown(r)))
)
// 换 data 时 el-table 会清掉勾选，切显示开关后把还看得见的勾回去
watch(showKnown, async () => {
  const keep = new Set(saveChecked.value.map((r) => r.key))
  await nextTick()
  for (const row of visibleSaveRows.value) {
    if (keep.has(row.key)) saveTableRef.value?.toggleRowSelection(row, true)
  }
})
const saveSummary = computed(() => {
  const rows = saveRows.value
  const preflight = rows.filter(isPreflight).length
  const known = rows.filter((r) => !isPreflight(r) && isKnown(r)).length
  return { total: rows.length, preflight, known, fresh: rows.length - preflight - known }
})

function knownText(r: SaveRow) {
  return r.owners
    .map((o) => `${projectName(o.project) || o.project} · ${o.caseCount} 条用例`)
    .join('；')
}

function applyBulk(code: string) {
  if (!code) return
  const targets = saveChecked.value.length ? saveChecked.value : visibleSaveRows.value
  for (const r of targets) r.project = code
}

async function openSaveDialog() {
  if (!apiFlows.value.length) {
    ElMessage.warning('没有识别成接口的请求。JS / CSS / 图片不收录')
    return
  }
  urlEnv.value =
    viewingEnv.value === 'PROD' ? 'PROD' : localStorage.getItem(URL_ENV_KEY) === 'PROD' ? 'PROD' : 'TEST'
  const valid = new Set(projectOptions.value.map((p) => p.code))
  const byHost = recallHostProjects()
  // 同一接口调了多次只留一行，取最后一次：样本最新
  const byKey = new Map<string, SaveRow>()
  // 这次会话里已经收进某个项目的：以它为准，不拿猜测覆盖
  const savedKeys = new Set<string>()
  for (const f of apiFlows.value) {
    const method = String(f.method || 'GET').toUpperCase()
    const key = `${method} ${f.path}`
    const saved = f.endpointId && valid.has(f.project) ? f.project : ''
    const remembered = valid.has(byHost[f.host]) ? byHost[f.host] : ''
    if (saved) savedKeys.add(key)
    const prev = byKey.get(key)
    byKey.set(key, {
      key,
      seq: f.seq,
      method,
      path: f.path,
      query: f.query,
      host: f.host,
      url: f.url || (f.host ? `${f.scheme || 'https'}://${f.host}${f.path}` : undefined),
      project: saved || prev?.project || remembered,
      calls: (prev?.calls || 0) + 1,
      owners: [],
      inbox: false
    })
  }
  saveRows.value = [...byKey.values()]
  bulkProject.value = ''
  urlPlans.value = {}
  currentUrls.value = {}
  showKnown.value = false
  knownFailed.value = false
  saveDlg.value = true
  knownLoading.value = true
  try {
    const r = await apiClient.previewCaptureEndpoints(
      saveRows.value.filter((x) => !isPreflight(x)).map((x) => ({ method: x.method, path: x.path, url: x.url }))
    )
    const known = new Map((r.known || []).map((k) => [`${k.method} ${k.path}`, k]))
    const guesses = new Map((r.guesses || []).map((g) => [`${g.method} ${g.path}`, g]))
    for (const row of saveRows.value) {
      const g = guesses.get(row.key)
      if (g && valid.has(g.project)) {
        row.guess = { project: g.project, reason: g.reason }
        // 网关域名后面挂着好几个服务，按路径猜比按域名记的上次项目靠谱
        if (!savedKeys.has(row.key)) row.project = g.project
      }
      const k = known.get(row.key)
      if (!k) continue
      row.owners = k.owners || []
      row.inbox = !!k.inbox
      const owner = row.owners.length === 1 ? row.owners[0].project : ''
      if (owner && valid.has(owner)) row.project = owner
    }
  } catch {
    knownFailed.value = true
  } finally {
    knownLoading.value = false
  }
  await nextTick()
  for (const row of visibleSaveRows.value) {
    if (!isKnown(row)) saveTableRef.value?.toggleRowSelection(row, true)
  }
}

const URL_ENV_KEY = 'packet-capture:url-env'
const urlEnv = ref<'TEST' | 'PROD'>(localStorage.getItem(URL_ENV_KEY) === 'PROD' ? 'PROD' : 'TEST')
watch(urlEnv, (v) => {
  // 生产包是按场强制的，不能记成下次的默认
  if (viewingEnv.value === 'PROD') return
  try {
    localStorage.setItem(URL_ENV_KEY, v)
  } catch {
    /* 写不了只是下次不记得 */
  }
})

interface UrlPlan {
  project: string
  baseUrl: string
  enabled: boolean
  /** 人改过就不再跟着勾选变化重算默认域名 */
  touched: boolean
}
const urlPlans = ref<Record<string, UrlPlan>>({})
/** 项目 → 地址列表；undefined 表示还在查 */
const currentUrls = ref<Record<string, any[] | undefined>>({})

function originOfUrl(u?: string) {
  try {
    return u ? new URL(u).origin : ''
  } catch {
    return ''
  }
}

/** 勾选的行按项目分组；同一个项目抓到几个域名时，出现最多的排第一做默认 */
const urlPlanRows = computed(() => {
  const by = new Map<string, Map<string, number>>()
  for (const r of saveChecked.value) {
    if (!r.project) continue
    const votes = by.get(r.project) ?? new Map<string, number>()
    const o = originOfUrl(r.url)
    if (o) votes.set(o, (votes.get(o) ?? 0) + 1)
    by.set(r.project, votes)
  }
  return [...by].map(([project, votes]) => ({
    project,
    origins: [...votes].sort((a, b) => b[1] - a[1]).map(([o]) => o)
  }))
})

watch(urlPlanRows, (rows) => {
  for (const { project, origins } of rows) {
    const p = urlPlans.value[project]
    if (!p) {
      urlPlans.value[project] = { project, baseUrl: origins[0] || '', enabled: !!origins[0], touched: false }
    } else if (!p.touched && origins[0]) {
      p.baseUrl = origins[0]
    }
    if (!(project in currentUrls.value)) loadCurrentUrls(project)
  }
})

async function loadCurrentUrls(project: string) {
  currentUrls.value[project] = undefined
  try {
    currentUrls.value[project] = (await apiClient.getApiUrls({ project })) || []
  } catch {
    currentUrls.value[project] = []
  }
}

/** 和后端 autoPick 同一个挑法：启用的、同环境优先于通用、按排序取第一条 */
function currentBase(project: string): string | null | undefined {
  const list = currentUrls.value[project]
  if (!list) return undefined
  const live = list
    .filter((u) => u.enabled !== false && u.baseUrl)
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
  const hit =
    live.find((u) => String(u.environment || '').toUpperCase() === urlEnv.value) ||
    live.find((u) => String(u.environment || '').toUpperCase() === 'ANY')
  return hit ? String(hit.baseUrl).replace(/\/+$/, '') : null
}

function urlChange(project: string) {
  const p = urlPlans.value[project]
  const now = currentBase(project)
  return !!p?.enabled && !!p.baseUrl.trim() && now !== undefined && now !== originOfUrl(withScheme(p.baseUrl))
}

function withScheme(u: string) {
  const s = u.trim()
  return s.includes('://') ? s : `https://${s}`
}

function urlNowText(project: string) {
  const now = currentBase(project)
  const env = urlEnv.value === 'PROD' ? '线上' : '测试'
  if (now === undefined) return '查询当前地址…'
  if (!now) return `当前没有${env}地址`
  const p = urlPlans.value[project]
  if (p?.enabled && now === originOfUrl(withScheme(p.baseUrl))) return `已是当前${env}地址`
  return `当前${env}：${now}`
}

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
const fieldSearch = ref('')
const fieldFilter = ref<'app' | 'labeled' | 'all' | 'empty' | 'mismatch'>('app')
const fieldOverrides = ref<Record<string, string>>(loadOverrides())

type FieldViewRow = {
  path: string
  name: string
  sample: string
  labelKey: string
  zh: string
  seed: string
  source: '' | 'seed' | 'override' | 'app'
  appZh: string
  appUse: AppFieldUse | ''
  appNote: string
  mismatch: boolean
}

const matchJudgments = computed(() => evaluateMatchJudgments(parseRespBody(detail.value?.respBody)))

const fieldRows = computed<FieldViewRow[]>(() => {
  const parsed = parseRespBody(detail.value?.respBody)
  if (parsed == null) return []
  return flattenFields(parsed).map((row) => {
    const found = resolveLabel(row.labelKey, fieldOverrides.value)
    const app = appMetaOf(row.labelKey)
    const seed = SEED_LABELS[row.labelKey] || ''
    const appZh = app?.zh || ''
    return {
      ...row,
      zh: found.zh,
      seed,
      source: found.source,
      appZh,
      appUse: app?.use || '',
      appNote: app?.note || '',
      mismatch: !!(
        appZh &&
        seed &&
        appZh !== seed &&
        !seed.includes(appZh) &&
        !appZh.includes(seed) &&
        found.source !== 'override'
      )
    }
  })
})

const fieldRowsView = computed(() => {
  const q = fieldSearch.value.trim().toLowerCase()
  return fieldRows.value.filter((row) => {
    if (fieldFilter.value === 'app' && !row.appUse) return false
    if (fieldFilter.value === 'labeled' && !row.zh) return false
    if (fieldFilter.value === 'empty' && row.zh) return false
    if (fieldFilter.value === 'mismatch' && !row.mismatch) return false
    if (!q) return true
    return (
      row.path.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      row.zh.toLowerCase().includes(q) ||
      row.appNote.toLowerCase().includes(q)
    )
  })
})

function useLabel(use: AppFieldUse) {
  if (use === 'display') return '直出'
  if (use === 'judge') return '判断'
  if (use === 'derived') return '演算'
  if (use === 'css') return '样式'
  return use
}

function onFieldLabelChange(row: FieldViewRow) {
  saveOverride(row.labelKey, row.zh)
  fieldOverrides.value = loadOverrides()
}

let poll: ReturnType<typeof setInterval> | null = null


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
const MISSED_PREVIEW = 1
const missedOpen = ref(false)

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

type FailTone = 'danger' | 'warning'

/** 「host（TLS 握手失败：原话）」拆成 域名 / 类型 / 原话，类型做徽标，原话折叠 */
function parseFailLabel(label: string) {
  const host = hostOfLabel(label)
  const i = label.indexOf('（')
  let why = i < 0 ? '' : label.slice(i + 1).replace(/）$/, '').trim()
  let kind = why
  let detail = ''
  const tls = why.match(/^TLS 握手失败[:：]?\s*(.*)$/)
  if (tls) {
    kind = 'TLS 握手失败'
    detail = tls[1].trim()
  } else {
    why = why.replace(/[.。]\s*$/, '')
    kind = why || '连接出错'
    if (kind.length > 32) {
      detail = kind
      kind = '连接出错'
    }
  }
  const tone: FailTone = /server closed/i.test(kind) ? 'warning' : 'danger'
  return { host, kind, detail, tone }
}

const failedRows = computed(() =>
  failedInScope.value.map((f) => ({ label: f.host, count: f.count, ...parseFailLabel(f.host) }))
)

const noiseRows = computed(() =>
  failedOutOfScope.value.map((f) => ({ label: f.host, count: f.count, ...parseFailLabel(f.host) }))
)

const failOpen = reactive<Record<string, boolean>>({})
const failAllOpen = ref(false)
const codesOpen = ref(false)
const failCardRef = ref<HTMLElement | null>(null)

const failedOutOfScope = computed(() =>
  failedList.value.filter((f) => !hostMatched(hostOfLabel(f.host)))
)

const noiseOpen = ref(false)

type DiagKey = 'failed' | 'codes' | 'missed' | 'noise'
const diagKeys = computed<DiagKey[]>(() => {
  const keys: DiagKey[] = []
  if (failedInScope.value.length) keys.push('failed', 'codes')
  if ((running.value || flows.value.length > 0) && missedHosts.value.length) keys.push('missed')
  if (failedOutOfScope.value.length) keys.push('noise')
  return keys
})
/** 抓到的接口是主角，默认停在第一个 tab；诊断只在要排查时才点过去 */
const mainTab = ref<'flows' | 'diag'>('flows')

const savingToken = ref(false)

/** 抓一次要人在手机上把操作走一遍；刷新页面或开了新的一场之后，前几场还要能翻回来 */
const HISTORY_KEEP = 3
const history = ref<any[]>([])
/** 当前表格展示的是哪一场（刚结束的那场或翻出来的历史） */
const viewingId = ref('')
const loadingHistory = ref('')

async function loadHistory() {
  try {
    const rows = await apiClient.getCaptureSessions()
    history.value = (rows || [])
      .filter((r: any) => String(r.status || '').toUpperCase() === 'FINISHED' && Number(r.flow_count) > 0)
      .slice(0, HISTORY_KEEP)
  } catch {
    history.value = []
  }
}

function sessionTime(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (Array.isArray(v)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = v.map(Number)
    return new Date(y, mo - 1, d, h, mi, s)
  }
  const d = new Date(typeof v === 'number' ? v : String(v))
  return isNaN(d.getTime()) ? null : d
}

function historyWhen(h: any) {
  const t = sessionTime(h.started_at)
  const p = (x: number) => String(x).padStart(2, '0')
  return t ? `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}` : h.id
}

function historyDevice(h: any) {
  if (h.platform === 'IMPORT') return '导入'
  const dev = devices.value.find((d) => d.id === h.device_id)
  const plat = String(dev?.platform || h.platform || '')
  const kind = /ios/i.test(plat) ? 'iPhone' : /android/i.test(plat) ? 'Android' : plat
  return `${kind} ${deviceTail(h.device_id)}`.trim()
}

const allHistory = ref<any[]>([])

async function loadAllHistory() {
  try {
    const rows = await apiClient.getCaptureSessions()
    allHistory.value = (rows || [])
      .filter((r: any) => String(r.status || '').toUpperCase() === 'FINISHED' && Number(r.flow_count) > 0)
      .slice(0, 30)
  } catch {
    allHistory.value = []
  }
}

function historyLabel(h: any) {
  const t = sessionTime(h.started_at)
  const p = (x: number) => String(x).padStart(2, '0')
  const when = t ? `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}` : h.id
  const dev = devices.value.find((d) => d.id === h.device_id)
  return `${when} · ${h.flow_count} 条 · ${dev?.name || h.platform || ''}`
}

async function openHistory(h: any) {
  loadingHistory.value = h.id
  try {
    const r = await apiClient.captureSessionResult(h.id)
    clearBoard()
    flows.value = r.flows || []
    capturedTotal.value = r.total || 0
    seenHosts.value = r.seenHosts || {}
    failedHosts.value = r.failedHosts || {}
    finishedSessionId.value = h.id
    viewingId.value = h.id
    viewingEnv.value = r.env === 'PROD' ? 'PROD' : 'TEST'
    viewingImported.value = !!r.imported
  } catch (e: any) {
    ElMessage.error(e?.message || '打不开这场抓包')
  } finally {
    loadingHistory.value = ''
  }
}

const importVisible = ref(false)
const importFile = ref<File | null>(null)
const importEnv = ref<'TEST' | 'PROD'>('PROD')
const importing = ref(false)
const importSize = computed(() => {
  const n = importFile.value?.size || 0
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
})

function openImport() {
  importFile.value = null
  importEnv.value = 'PROD'
  importVisible.value = true
}

function onImportFile(f: { raw?: File }) {
  importFile.value = f.raw || null
}

/** 导入后就当一场历史抓包打开，后面收录、AI 生成用例都照原来的走 */
async function doImport() {
  if (!importFile.value) return
  importing.value = true
  try {
    const r = await apiClient.importCaptureFile(importFile.value, importEnv.value)
    importVisible.value = false
    await loadHistory()
    await openHistory({ id: r.sessionId })
    ElMessage.success(
      `导入 ${r.flows} 条请求（${r.hosts} 个域名，${r.env === 'PROD' ? '生产' : '测试'}环境）。下一步：收录到接口管理，再 AI 生成用例`
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

/** 把这次抓包的 token 存到测试环境，用例执行时自动注入 */
async function saveToken() {
  savingToken.value = true
  try {
    const r = await apiClient.saveCaptureToken(sessionId.value || finishedSessionId.value || 'last', 'TEST')
    ElMessage.success(r.message)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingToken.value = false
  }
}

const AI_AFTER_SAVE_KEY = 'packet-capture:ai-after-save'
const aiAfterSave = ref(localStorage.getItem(AI_AFTER_SAVE_KEY) !== '0')

function rememberAiAfterSave() {
  try {
    localStorage.setItem(AI_AFTER_SAVE_KEY, aiAfterSave.value ? '1' : '0')
  } catch {
    /* 写不了只是下次恢复默认 */
  }
}

const savedEndpointCount = computed(
  () => apiFlows.value.filter((f) => f.endpointId && f.project && f.project !== 'capture-inbox').length
)
const aiGenning = ref(false)
const aiProgress = ref('')

/**
 * 按这次抓到的请求头、参数、响应让 AI 出用例。
 * <p>
 * 生成任务是按项目起的，一次收录常常横跨好几个项目（APP-ENGINE、APP-PUSH…），所以逐个项目跑。
 * 只建不跑：用例落到项目的全量集合，环境跟着抓包走（导入的生产包是 PROD，且只出 GET）；
 * token 不写进用例，执行时从对应环境注入。
 */
async function aiGenFromCapture(only?: Set<string>) {
  const byProject = new Map<string, string[]>()
  for (const f of apiFlows.value) {
    if (!f.endpointId || !f.project || f.project === 'capture-inbox') continue
    if (only && !only.has(f.endpointId)) continue
    const list = byProject.get(f.project) ?? []
    if (!list.includes(f.endpointId)) list.push(f.endpointId)
    byProject.set(f.project, list)
  }
  if (!byProject.size) {
    ElMessage.warning('先收录到接口管理，再生成用例')
    return
  }
  aiGenning.value = true
  let created = 0
  let enabled = 0
  let skipped = 0
  let prodWrites = 0
  const problems: string[] = []
  try {
    for (const [project, endpointIds] of byProject) {
      const label = projectName(project) || project
      try {
        aiProgress.value = `${label} 生成中…`
        let job = await apiClient.startAiCases({ project, endpointIds, onlyUncovered: false, preferCapture: true })
        while (job.running) {
          aiProgress.value = `${label} ${job.done}/${job.total}`
          await new Promise((r) => setTimeout(r, 2000))
          job = await apiClient.getAiCaseJob(job.id)
        }
        for (const it of job.items) {
          created += it.cases || 0
          enabled += it.enabled || 0
          if (it.status === 'SKIPPED' && String(it.note || '').startsWith('生产环境')) prodWrites++
          else if (it.status === 'SKIPPED') skipped++
          else if (it.status === 'FAILED') problems.push(`${it.path}：${it.note || '失败'}`)
        }
      } catch (e: any) {
        problems.push(`${label}：${e?.message || '启动失败'}`)
      }
    }
  } finally {
    aiGenning.value = false
    aiProgress.value = ''
  }
  const parts = [`AI 生成 ${created} 条用例`]
  if (created)
    parts.push(
      `${enabled} 条已启用、其余先停用待确认（${viewingEnv.value === 'PROD' ? '生产环境' : '仅测试环境'}，没有执行）`
    )
  if (skipped) parts.push(`${skipped} 个接口之前生成过，跳过`)
  if (prodWrites) parts.push(`${prodWrites} 个写接口是生产抓的，只收录不生成`)
  if (problems.length) parts.push(`失败 ${problems.length} 个：${problems.slice(0, 2).join('；')}`)
  ElMessage({
    type: problems.length && !created ? 'error' : problems.length ? 'warning' : 'success',
    message: parts.join('，') + (created ? '。在「用例集合」各项目的全量集合里查看' : ''),
    duration: 10000,
    showClose: true
  })
}

/** 抓到的接口收进接口管理，归属项目由人在弹窗里选 */
async function saveToCatalog() {
  const toSave = saveChecked.value
  if (!toSave.length || missingProject.value) return
  saving.value = true
  try {
    const r = await apiClient.saveCaptureEndpoints({
      sessionId: sessionId.value || finishedSessionId.value || 'last',
      flows: toSave.map((f) => ({
        seq: f.seq,
        method: f.method,
        path: f.path,
        query: f.query,
        project: f.project,
        url: f.url
      })),
      urls: urlPlanRows.value
        .map((g) => urlPlans.value[g.project])
        .filter((p) => p?.enabled && p.baseUrl.trim())
        .map((p) => ({ project: p.project, environment: urlEnv.value, baseUrl: p.baseUrl.trim() }))
    })
    rememberHostProjects(toSave)
    const byKey = new Map(r.items.map((x) => [`${x.method} ${x.path}`, x]))
    flows.value = flows.value.map((f) => {
      const hit = byKey.get(`${String(f.method || 'GET').toUpperCase()} ${f.path}`)
      if (!hit) return f
      return {
        ...f,
        project: hit.project || null,
        endpointId: hit.endpointId || null,
        catalogMessage: hit.message || ''
      }
    })
    linkWarn.value = ''
    const failed = r.items.filter((x) => !x.endpointId)
    const perProject = new Map<string, number>()
    for (const x of r.items) {
      if (x.endpointId && x.project) perProject.set(x.project, (perProject.get(x.project) ?? 0) + 1)
    }
    const where = [...perProject].map(([code, n]) => `${projectName(code) || code}（${n}）`).join('、')
    const why = failed[0]?.message || '写不进清单'
    if (!r.saved) {
      ElMessage.error(`收录失败 ${failed.length} 个：${why}`)
      return
    }
    const urlNotes = (r.urls || [])
      .filter((u) => u.action !== 'FAILED')
      .map(
        (u) =>
          `${projectName(u.project) || u.project} ${u.environment === 'PROD' ? '线上' : '测试'} → ${u.baseUrl}` +
          (u.action === 'KEPT' ? '（本来就是）' : '')
      )
    const urlFailed = (r.urls || []).filter((u) => u.action === 'FAILED')
    for (const u of r.urls || []) delete currentUrls.value[u.project]
    ElMessage.success({
      message:
        `已收录 ${r.saved} 个接口到 ${where}` +
        (failed.length ? `；另有 ${failed.length} 个失败：${why}` : '') +
        (urlNotes.length ? `。项目地址已回填：${urlNotes.join('、')}` : '') +
        (urlFailed.length ? `。地址回填失败：${urlFailed.map((u) => u.message).join('；')}` : ''),
      duration: urlNotes.length || urlFailed.length ? 8000 : 3000
    })
    if (!failed.length) saveDlg.value = false
    rememberAiAfterSave()
    if (aiAfterSave.value) {
      const ids = new Set(r.items.filter((x) => x.endpointId).map((x) => x.endpointId as string))
      aiGenFromCapture(ids)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '收录失败')
  } finally {
    saving.value = false
  }
}



const failedList = computed(() =>
  Object.entries(failedHosts.value)
    .map(([host, count]) => ({ host, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
)

// watch 的 getter 在 setup 里立刻求值，diagKeys 依赖 failedList，必须放在它后面
watch(
  () => diagKeys.value.length,
  (n) => {
    if (!n && mainTab.value === 'diag') mainTab.value = 'flows'
  }
)

/** 后端实际抓到的条数。「见到」不等于「抓到」：没等到响应的、被挡掉的都在「见到」里 */
const capturedTotal = ref(0)

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
const respParsed = computed(() => parseRespBody(detail.value?.respBody))
const reqParsed = computed(() => parseRespBody(detail.value?.reqBody))

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
  if (row?.seq == null) {
    ElMessage.error('这条没有序号，点不开详情')
    return
  }
  bodyVisible.value = true
  bodyLoading.value = true
  bodyErr.value = ''
  detail.value = null
  cur.value = row
  respSearch.value = ''
  respMatchIndex.value = 0
  fieldSearch.value = ''
  fieldOverrides.value = loadOverrides()
  // 默认落在概览：点开详情多半是想先看这条到底是什么，再决定看不看 body
  bodyTab.value = 'general'
  bodyTitle.value = `${row.method} ${row.path}`
  bodyTruncated.value = !!row.respTruncated
  try {
    // 优先用本场 sessionId；结束之后仍保留 finishedSessionId，避免只靠易丢的 last
    const sid = sessionId.value || finishedSessionId.value || 'last'
    const r = await apiClient.captureDetail(sid, row.seq)
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
  const fieldTsv = fieldRowsView.value
    .map((r) => `${r.path}\t${r.name}\t${r.zh}\t${r.sample}`)
    .join('\n')
  const map: Record<string, string> = {
    general: cur.value?.url || '',
    fields: fieldTsv ? `路径\t字段\t前端中文\t示例\n${fieldTsv}` : '',
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

function shortId(id: string) {
  return String(id || '').slice(-6)
}

/** 同名手机按尾号区分——一台手机在设备表里可能有好几条历史记录 */
function deviceLabel(d: any) {
  return `${d.name || d.id}（${d.platform} · ${shortId(d.id)}）`
}

function deviceTail(id?: string) {
  return String(id || '').slice(-4).toUpperCase()
}

function deviceName(id?: string) {
  const d = devices.value.find((x) => x.id === id)
  return d?.name || id || ''
}

const hostList = computed(() =>
  form.hosts
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
)

function setHosts(list: string[]) {
  form.hosts = [...new Set(list)].join(',')
  rememberHosts(form.hosts)
}

function removeHost(h: string) {
  setHosts(hostList.value.filter((x) => x !== h))
}

function clearHosts() {
  form.hosts = ''
}

function isIpHost(h: string) {
  return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(h)
}

const hostAdding = ref(false)
const hostDraft = ref('')
const hostInputRef = ref<HTMLInputElement | null>(null)

async function startHostAdd() {
  hostAdding.value = true
  await nextTick()
  hostInputRef.value?.focus()
}

function commitHostDraft(close = false) {
  const add = hostDraft.value
    .split(/[\s,，]+/)
    .map((x) => x.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean)
  if (add.length) setHosts([...hostList.value, ...add])
  hostDraft.value = ''
  if (close === true) hostAdding.value = false
}

function onHostBackspace() {
  if (!hostDraft.value && hostList.value.length) removeHost(hostList.value[hostList.value.length - 1])
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

/** 上一场的表格、诊断、挂单状态。设备/白名单/需求单是下次还要用的，不清 */
const canReset = computed(
  () =>
    running.value ||
    flows.value.length > 0 ||
    capturedTotal.value > 0 ||
    count.value > 0 ||
    Object.keys(seenHosts.value).length > 0 ||
    Object.keys(failedHosts.value).length > 0 ||
    !!linkWarn.value
)

function clearBoard() {
  stopPoll()
  running.value = false
  sessionId.value = ''
  finishedSessionId.value = ''
  count.value = 0
  capturedTotal.value = 0
  seenHosts.value = {}
  seenTotal.value = 0
  failedHosts.value = {}
  flows.value = []
  linkWarn.value = ''
  tip.value = ''
  bodyVisible.value = false
  detail.value = null
  cur.value = null
  noiseOpen.value = false
  mainTab.value = 'flows'
  viewingId.value = ''
  viewingEnv.value = 'TEST'
  viewingImported.value = false
  flowKeyword.value = ''
  flowPage.value = 1
}

/** 丢掉当前这场，页面回到可以再点「开始抓包」的状态 */
async function reset() {
  resetting.value = true
  try {
    if (running.value && sessionId.value) {
      try {
        await apiClient.stopCapture(sessionId.value, {})
      } catch {
        /* 代理可能已经停了，页面照样清掉 */
      }
    }
    clearBoard()
    ElMessage.success('已清空，可以重新开始抓包')
  } finally {
    resetting.value = false
  }
}

async function start() {
  const dev = devices.value.find((d) => d.id === form.deviceId)
  starting.value = true
  flows.value = []
  linkWarn.value = ''
  viewingId.value = ''
  try {
    const r = await apiClient.startCapture({
      deviceId: form.deviceId,
      platform: String(dev?.platform || 'ANDROID'),
      hosts: form.hosts.trim() || undefined
    })
    running.value = true
    sessionId.value = r.sessionId
    finishedSessionId.value = ''
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
    const stoppedId = sessionId.value
    const r = await apiClient.stopCapture(sessionId.value, {})
    flows.value = r.flows || []
    capturedTotal.value = r.total || 0
    linkWarn.value = ''
    seenHosts.value = r.seenHosts || {}
    failedHosts.value = r.failedHosts || {}
    finishedSessionId.value = stoppedId || ''
    viewingId.value = stoppedId || ''
    loadHistory()
    ElMessage.success(
      `抓到 ${r.total} 条请求，去重后 ${r.distinct} 条` +
        (kindCount('api') ? `（接口 ${kindCount('api')}），点「收录到接口管理」选项目后收录` : '')
    )
    // 安卓会撤全局代理；若 Wi‑Fi 里还留着手动 127.0.0.1:8080，页面会全挂
    ElMessage.warning({
      message:
        '抓包已结束。若手机页面打不开：到 Wi‑Fi → 当前网络 → 代理，确认已「关闭」（不要留 127.0.0.1:8080）',
      duration: 8000
    })
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
      startPoll()
    }
  } catch {
    /* 拿不到就当没在抓 */
  }
  await loadHistory()
  // 刷新页面后直接回到最近那场，不用再抓一遍
  if (!running.value && !flows.value.length && history.value.length) {
    await openHistory(history.value[0])
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




.cap-save-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.cap-save-sum {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.cap-save-toggles {
  margin-left: auto;
  display: flex;
  gap: 12px;
}

.cap-save-warn {
  color: var(--el-color-warning);
}

.cap-save-mismatch {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.cap-save-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.cap-save-label {
  font-weight: 600;
}

.cap-save-bulk {
  width: 260px;
}

.cap-save-missing :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.cap-save-ai {
  float: left;
}

.cap-save-foot {
  margin-right: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.cap-save-foot b {
  color: var(--el-color-danger);
}

.cap-url {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.cap-url-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.cap-url-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.cap-url-proj {
  width: 130px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cap-url-input {
  width: 300px;
}

.cap-url-now {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cap-url-now.is-change {
  color: var(--el-color-warning-dark-2);
}


.head-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cap-help {
  display: inline-flex;
  align-items: center;
  font-size: 15px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  align-self: center;
}

.cap-help:hover {
  color: var(--el-color-primary);
}

.fx-help {
  max-height: 70vh;
  overflow-y: auto;
}

.fx-help-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 2px 8px;
  border-bottom: 1px solid #eef0f2;
}

.fx-help .fx-body {
  padding: 10px 2px 2px;
}






.cap-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
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


.cap-tabs {
  margin-top: 16px;
}

.cap-tab-num {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 9px;
  background: #f2f3f5;
  color: #5c6370;
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.cap-tab-num--danger {
  background: #fdecec;
  color: #d64545;
}

.cap-tab-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.cap-diag-pane {
  margin-top: 4px;
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

.cap-kind-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

.cap-kind-tab {
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12.5px;
  cursor: pointer;
  line-height: 1.6;
}

.cap-kind-tab em {
  margin-left: 5px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
}

.cap-kind-tab.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.cap-kind-tab.active em {
  color: var(--el-color-primary);
}


.cap-gen :deep(.el-descriptions__label) {
  width: 190px;
  white-space: nowrap;
}

.cap-mono,
.cap-sz {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  word-break: break-all;
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
  background: var(--el-color-warning-light-7);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}

.cap-body :deep(mark.cap-hl-active) {
  background: var(--el-color-warning-light-3);
  outline: 1px solid var(--el-color-warning);
}

.cap-fields-tip {
  margin: 0 0 10px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.cap-fields-table {
  width: 100%;
}

.cap-judge {
  margin: 0 0 14px;
}

.cap-judge-head {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.cap-judge-table {
  width: 100%;
  margin-bottom: 4px;
}

.cap-use {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.45;
  font-size: 12px;
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




.cap-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}


.opt-dim {
  margin-left: 10px;
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



.fx-card {
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.fx-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fafbfc;
  border-bottom: 1px solid #eef0f2;
}

.fx-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
}

.fx-icon--danger { background: #fdecec; color: #d64545; }
.fx-icon--warning { background: #fdf3e1; color: #d48806; }
.fx-icon--info { background: #e8f1fd; color: #2f6fdb; }
.fx-icon--muted { background: #f2f3f5; color: #8a9099; }

.fx-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.fx-sub {
  font-size: 11.5px;
  color: #8a9099;
}

.fx-count {
  margin-left: auto;
  padding: 0 8px;
  border: 1px solid #e0e3e7;
  border-radius: 10px;
  font-size: 11.5px;
  line-height: 18px;
  color: #5c6370;
}

.fx-body {
  padding: 10px 14px 12px;
  font-size: 12.5px;
  line-height: 1.75;
  color: #3a3f47;
}

.fx-body code {
  padding: 0 4px;
  border-radius: 3px;
  background: #f2f3f5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
}

.fx-hosts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fx-host {
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  background: #fff;
}

.fx-more {
  align-self: flex-start;
  font-size: 12px;
  color: #2f6fdb;
  cursor: pointer;
}

.fx-host-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
}

.fx-body .fx-host-name {
  padding: 0;
  background: none;
  font-size: 12px;
  color: #1f2329;
}

.fx-badge {
  margin-left: auto;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.fx-badge--danger { border-color: #e88a8a; background: #fff; color: #d64545; }
.fx-badge--warning { border-color: #e9b45a; background: #fffaf0; color: #c27c0e; }
.fx-badge--muted { border-color: #d5d8dc; background: #fff; color: #8a9099; }

.fx-times {
  font-size: 11px;
  color: #8a9099;
  font-variant-numeric: tabular-nums;
}

.fx-host-detail {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 10px 8px;
  padding: 5px 10px;
  border: 1px solid #e6e8eb;
  border-radius: 4px;
  background: #fff;
}

.fx-body .fx-host-detail code {
  flex: 1;
  min-width: 0;
  padding: 0;
  background: none;
  color: #6b717b;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fx-body .fx-host-detail code.is-open {
  white-space: pre-wrap;
  word-break: break-all;
}

.fx-link {
  flex-shrink: 0;
  font-size: 11px;
  color: #2f6fdb;
  cursor: pointer;
}

.fx-times--push {
  margin-left: auto;
}

.fx-more-row {
  display: flex;
  align-items: center;
  gap: 12px;
}


.fx-more--table {
  margin-top: 8px;
}

.fx-table {
  width: 100%;
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}

.fx-table th {
  padding: 6px 10px;
  background: #fafbfc;
  font-size: 11px;
  font-weight: 500;
  color: #8a9099;
  text-align: left;
}

.fx-table td {
  padding: 8px 10px;
  border-top: 1px solid #eef0f2;
  vertical-align: top;
}

.fx-table th + th,
.fx-table td + td {
  border-left: 1px solid #eef0f2;
}

.fx-table td:first-child {
  width: 26%;
}

.fx-table td:last-child {
  width: 30%;
}

.fx-body .fx-table td:first-child code {
  padding: 0;
  background: none;
  font-weight: 600;
  color: #1f2329;
}

.fx-table td small {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  color: #8a9099;
}

.fx-table td:last-child .fx-chip {
  display: table;
  margin: 0 0 2px;
}

.fx-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 17px;
  vertical-align: middle;
}

.fx-chip--danger { background: #fdecec; color: #d64545; }
.fx-chip--warning { background: #fdf3e1; color: #c27c0e; }
.fx-chip--info { background: #e8f1fd; color: #2f6fdb; }
.fx-chip--muted { background: #f2f3f5; color: #8a9099; }

.fx-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fx-steps li {
  display: flex;
  gap: 10px;
}

.fx-steps li > div {
  flex: 1;
  min-width: 0;
}

.fx-steps p {
  margin: 2px 0;
}

.fx-num {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.fx-num--danger { background: #e5484d; }
.fx-num--warning { background: #f0a020; }
.fx-num--muted { background: #e6e8eb; color: #6b717b; }

.fx-step-title {
  font-weight: 600;
  color: #1f2329;
}

.fx-code {
  margin: 6px 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: #1f2329;
  color: #e6e8eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
}

.fx-ok {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #b7e0a5;
  border-radius: 6px;
  background: #f3fbef;
  color: #3b6e22;
}

.fx-ok-mark {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 3px;
  border: 1px solid #67b346;
  border-radius: 3px;
  background: #fff;
  font-size: 10px;
  color: #3b8a1e;
}

.fx-steps .fx-ok {
  margin-top: 4px;
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

.cap-calls {
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.cap-detail-body {
  min-height: 120px;
}

.cap-detail-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}


/* ---------- 设计稿：顶部面板 ---------- */
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cap-panel {
  border: 1px solid #e6e8eb;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.cap-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #eef0f2;
}

.cap-top-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.cap-top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.cap-top-actions .el-icon {
  margin-right: 4px;
}

.cap-prod-tip {
  margin-bottom: 14px;
}

.cap-import :deep(.el-upload),
.cap-import :deep(.el-upload-dragger) {
  width: 100%;
}

.cap-import :deep(.el-upload-dragger) {
  padding: 26px 18px;
  border: 1px dashed var(--el-color-primary-light-3);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.cap-import :deep(.el-upload-dragger:hover),
.cap-import :deep(.el-upload-dragger.is-dragover) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.cap-import-drop {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cap-import-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 18px;
  line-height: 1;
}

.cap-import-icon.done {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.cap-import-text {
  min-width: 0;
}

.cap-import-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  color: #1f2329;
}

.cap-import-title b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.cap-import-title em {
  font-style: normal;
  font-weight: 600;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.cap-import-size {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
}

.cap-import-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}

.cap-import-env {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0 10px;
}

.cap-import-env-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.cap-seg {
  display: inline-flex;
  padding: 2px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
}

.cap-seg button {
  min-width: 56px;
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cap-seg button.on {
  background: var(--el-color-primary);
  color: #fff;
}

.cap-import-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #86909c;
}

.cap-import-note code {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f2f3f5;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11.5px;
  color: #4e5969;
}

.cap-import-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cap-import-foot-tip {
  flex: 1;
  text-align: left;
  font-size: 12px;
  color: #a0a6ae;
}

.cap-setup {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 24px;
  padding: 16px 20px 14px;
}

.cap-label {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.cap-label-side {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: #8a9099;
}

.cap-device-select {
  width: 100%;
}

.cap-dim-tail {
  margin-left: 6px;
  font-size: 12px;
  color: #a0a6ae;
}

.cap-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #8a9099;
}

.cap-hint b {
  color: #3a3f47;
}

.cap-host-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: #fff;
  cursor: text;
}

.cap-host-box:hover {
  border-color: var(--el-border-color-hover);
}

.cap-host-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border: 1px solid #c6dafc;
  border-radius: 3px;
  background: #eef4ff;
  color: #2f6fdb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 20px;
}

.cap-host-chip.is-ip {
  border-color: #f3d39a;
  background: #fff7e6;
  color: #b7791f;
}

.cap-host-x {
  font-style: normal;
  color: #a0a6ae;
  cursor: pointer;
}

.cap-host-x:hover {
  color: #d64545;
}

.cap-host-add {
  font-size: 12px;
  color: #8a9099;
}

.cap-host-input {
  flex: 1;
  min-width: 140px;
  border: none;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: transparent;
}

.cap-mini-link {
  font-size: 12px;
  color: #2f6fdb;
  cursor: pointer;
  text-decoration: none;
}

.cap-mini-link:hover {
  text-decoration: underline;
}

.cap-history {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 20px;
  border-top: 1px solid #eef0f2;
  background: #fafbfc;
}

.cap-history-label {
  margin-right: 4px;
  font-size: 12px;
  color: #8a9099;
}

.cap-hist-chip,
.cap-hist-row {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 10px;
  border: 1px solid #e0e3e7;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  color: #3a3f47;
  cursor: pointer;
}

.cap-hist-chip code,
.cap-hist-row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.cap-hist-chip .cap-dim-tail,
.cap-hist-row .cap-dim-tail {
  margin-left: 0;
}

.cap-hist-chip.active,
.cap-hist-row.active {
  border-color: #8fb4f5;
  background: #eef4ff;
  color: #2f6fdb;
}

.cap-hist-chip:disabled {
  opacity: 0.6;
  cursor: progress;
}

.cap-history-all {
  margin-left: auto;
}

.cap-hist-all {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
}

.cap-hist-row {
  justify-content: flex-start;
}

.cap-live {
  color: var(--el-color-danger);
  font-weight: 600;
}

.cap-count {
  font-size: 13px;
  color: #5c6370;
  font-variant-numeric: tabular-nums;
}

/* ---------- 设计稿：结果面板 ---------- */
.cap-panel--result {
  padding: 0 20px 16px;
}

.cap-panel--result .cap-tabs {
  margin-top: 6px;
}

.cap-panel--result :deep(.el-tabs__item) {
  font-size: 13px;
}

.cap-panel--result :deep(.el-tabs__item.is-active) .cap-tab-num {
  background: #e8f1fd;
  color: #2f6fdb;
}

.cap-panel--result :deep(.el-tabs__item.is-active) .cap-tab-num--danger,
.cap-tab-num--danger {
  background: #fdecec;
  color: #d64545;
}

.cap-sum {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin: 4px 0 14px;
}

.cap-sum-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.cap-sum-num {
  font-size: 22px;
  font-weight: 700;
  color: #1f2329;
  font-variant-numeric: tabular-nums;
}

.cap-sum-unit {
  font-size: 13px;
  color: #5c6370;
}

.cap-pill {
  padding: 0 8px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
}

.cap-pill--ok { border-color: #b7e0a5; background: #f3fbef; color: #3b8a1e; }
.cap-pill--warn { border-color: #f3d39a; background: #fff7e6; color: #b7791f; }

.cap-sum-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #8a9099;
}

.cap-sum-sub i {
  margin: 0 8px;
  font-style: normal;
  color: #c9cdd4;
}

.cap-sum-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.cap-sum-actions .el-button + .el-button {
  margin-left: 0;
}

.cap-kind-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.cap-kind-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 12px;
  border: 1px solid #e0e3e7;
  border-radius: 14px;
  background: #fff;
  font-size: 12px;
  color: #3a3f47;
  cursor: pointer;
}

.cap-kind-tab em {
  font-style: normal;
  color: #8a9099;
}

.cap-kind-tab.active {
  border-color: #8fb4f5;
  background: #eef4ff;
  color: #2f6fdb;
}

.cap-kind-tab.active em {
  color: #2f6fdb;
  font-weight: 600;
}

.cap-kind-note {
  margin-left: auto;
  font-size: 12px;
  color: #8a9099;
}

.cap-flow-search {
  width: 240px;
}

.cap-flow-search.is-pushed {
  margin-left: auto;
}

.cap-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.cap-pager .cap-kind-note {
  margin-left: 0;
}

.cap-table :deep(th.el-table__cell) {
  background: #fafbfc;
  font-size: 12px;
  font-weight: 500;
  color: #8a9099;
}

.cap-table :deep(td.el-table__cell) {
  padding: 10px 0;
}

.cap-method {
  display: inline-block;
  min-width: 52px;
  padding: 0 6px;
  border-radius: 3px;
  background: #f2f3f5;
  color: #6b717b;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
}

.cap-method--get { background: #eaf7ef; color: #2e8b57; }
.cap-method--post { background: #e8f1fd; color: #2f6fdb; }
.cap-method--put,
.cap-method--patch { background: #fdf3e1; color: #c27c0e; }
.cap-method--delete { background: #fdecec; color: #d64545; }

.cap-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: #1f2329;
  word-break: break-all;
}

.cap-path-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 11.5px;
  color: #a0a6ae;
}

.cap-calls {
  padding: 0 5px;
  border-radius: 3px;
  background: #f2f3f5;
  color: #6b717b;
  font-size: 11px;
}

.cap-tag {
  display: inline-block;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 3px;
  font-size: 11.5px;
  line-height: 20px;
}

.cap-tag--ok { border-color: #b7e0a5; background: #f3fbef; color: #3b8a1e; font-weight: 600; }
.cap-tag--warn { border-color: #f3d39a; background: #fff7e6; color: #b7791f; }

.cap-catalog-go {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
}

.cap-status {
  font-weight: 700;
  color: #3b8a1e;
  font-variant-numeric: tabular-nums;
}

.cap-status.bad {
  color: #d64545;
}

.cap-dur,
.cap-sz {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #5c6370;
  white-space: nowrap;
}

.cap-host-sub,
.cap-host-sub,
.opt-dim {
  font-size: 12px;
  color: #a0a6ae;
}
</style>

<style>
/* 收录弹窗 z-index 是 6100，下拉浮层默认 2000 起步会被压在弹窗底下，看着像「下拉没有数据」 */
.cap-save-popper {
  z-index: 6300 !important;
}

.cap-import-dialog {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
}

.cap-import-dialog .el-dialog__header {
  margin: 0;
  padding: 18px 22px 16px;
  border-bottom: 1px solid #f0f1f3;
}

.cap-import-dialog .el-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.cap-import-dialog .el-dialog__headerbtn {
  top: 6px;
  right: 8px;
}

.cap-import-dialog .el-dialog__body {
  padding: 20px 22px 18px;
}

.cap-import-dialog .el-dialog__footer {
  padding: 14px 22px;
  border-top: 1px solid #f0f1f3;
  background: #fafbfc;
}

.cap-import-dialog .el-dialog__footer .el-button {
  min-width: 76px;
  height: 34px;
  border-radius: 8px;
}
</style>
