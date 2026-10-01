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
        </div>
      </el-form>

      <div class="cap-actions-bar">
        <div v-if="!running" key="cap-idle" class="cap-actions-idle">
          <el-button
            type="success"
            :loading="starting"
            :disabled="!form.deviceId"
            @click="start"
          >
            开始抓包
          </el-button>
          <el-button
            v-if="canReset"
            :loading="resetting"
            @click="reset"
          >
            重置
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
          <el-button :loading="resetting" @click="reset">重置</el-button>
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
          <b>{{ kindCount('api') }} 个接口</b>
          <!--
            「4 个接口」孤零零摆着，人会以为抓漏了。
            真实关系是「23 个请求 → 12 个命中白名单 → 去重后 4 个接口」，
            中间那两步不写出来，少的那 19 个就成了悬案。
            命中数必须用后端实际抓到的条数，不能拿「代理上见到的」去减——
            见到不等于抓到：没等到响应的、被挡掉的，都在「见到」里
          -->
          <span class="cap-ratio">
            代理上共 {{ seenGrandTotal }} 个请求 · 命中白名单 {{ capturedTotal }} 次调用 ·
            去重后 {{ flows.length }} 条
            <template v-if="kindCount('api') !== flows.length">
              （接口 {{ kindCount('api') }}）
            </template>
          </span>
          <span v-if="savedCount > 0" class="cap-linked">
            已收录 {{ savedCount }} 个
            <template v-if="inboxCount">（待归类 {{ inboxCount }}）</template>
          </span>
          <div class="cap-link-box">
            <el-button size="small" type="primary" :loading="saving" @click="saveToCatalog()">
              收录到接口管理
            </el-button>
            <el-button size="small" plain :disabled="!inboxCount && !savedCount" @click="goEndpoints">
              去接口管理归类{{ inboxCount ? `（${inboxCount}）` : '' }}
            </el-button>
            <el-button size="small" plain :loading="savingToken" @click="saveToken">
              用这次的 token
            </el-button>
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
        </div>
        <el-table :data="kindFlows" size="small" style="width: 100%" empty-text="这一类没有请求">
          <el-table-column label="方法" width="80">
            <template #default="{ row }">
              <el-tag size="small" :type="methodType(row.method)">{{ row.method }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="路径" min-width="260">
            <template #default="{ row }">
              <div class="cap-path">
                {{ row.path }}
                <!-- 被调了几次直接标出来：轮询接口调七八次很常见，看不到次数就会以为抓重复了 -->
                <span v-if="row.calls > 1" class="cap-calls">× {{ row.calls }}</span>
              </div>
              <div class="cap-host-sub">{{ row.host }}</div>
            </template>
          </el-table-column>
          <el-table-column v-if="kindTab === 'api'" key="cap-catalog" label="接口管理" min-width="170">
            <template #default="{ row }">
              <div v-if="row.endpointId" class="cap-catalog">
                <el-tag v-if="row.project === 'capture-inbox'" size="small" type="warning">待归类</el-tag>
                <span v-else class="cap-catalog-proj">{{ projectName(row.project) }}</span>
              </div>
              <span v-else-if="row.catalogMessage" class="opt-dim">{{ row.catalogMessage }}</span>
              <span v-else class="opt-dim">未收录</span>
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
              <el-button size="small" text type="primary" @click.stop="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!anyTrace" class="cap-hint" style="margin-top: 8px">
          没有一条带 traceId。响应头里没有 <code>pwrd-request-id</code> 的话，
          出问题时只能拿时间戳去日志里捞 —— 那是碰运气。可以让后端加上。
        </div>
      </div>
    </el-card>

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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'
import CaptureJsonTree from '../components/CaptureJsonTree.vue'
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
const linkWarn = ref('')

function projectName(code?: string | null) {
  if (!code || code === 'capture-inbox') return ''
  return projects.value.find((p) => p.code === code)?.name || code
}

function goEndpoints() {
  router.push({
    path: '/api-endpoints',
    query: inboxCount.value ? { project: 'capture-inbox' } : undefined
  })
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

const savingToken = ref(false)

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

/** 抓到的接口收进接口管理；认不出归属的先进「待归类」 */
async function saveToCatalog(silent = false) {
  const toSave = apiFlows.value
  if (!toSave.length) {
    if (!silent) ElMessage.warning('没有识别成接口的请求。JS / CSS / 图片不收录')
    return
  }
  saving.value = true
  try {
    const r = await apiClient.saveCaptureEndpoints({
      sessionId: sessionId.value || finishedSessionId.value || 'last',
      flows: toSave.map((f) => ({ seq: f.seq, method: f.method, path: f.path, query: f.query }))
    })
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
    const inbox = r.items.filter((x) => x.project === 'capture-inbox').length
    if (!silent) {
      ElMessage.success(
        `已收录 ${r.saved} 个接口` + (inbox ? `，其中 ${inbox} 个待归类，去接口管理里选项目` : '')
      )
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
    ElMessage.success(
      `抓到 ${r.total} 条请求，去重后 ${r.distinct} 条` +
        (kindCount('api') ? `（接口 ${kindCount('api')}）` : '')
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
    void saveToCatalog(true)
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

.cap-actions-idle,
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

.cap-linked {
  font-size: 12px;
  color: var(--el-color-success);
}

.cap-catalog {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.cap-catalog-proj {
  font-size: 12px;
  color: var(--el-text-color-regular);
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

</style>
