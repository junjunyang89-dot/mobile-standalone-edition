<template>
  <div class="ai-cases">
    <header class="page-nav">
      <div class="nav-left">
        <!-- 完整说明已在 MainLayout 顶栏展示，这里只保留层级：分类 / 线上|测试 -->
        <span class="nav-crumb">
          {{ suiteTitle }}
          <span class="nav-sep">/</span>
          {{ releaseTab === 'ONLINE' ? '线上版本' : '测试版本' }}
        </span>
      </div>
      <div class="nav-actions">
        <button type="button" class="btn-nav" @click="openImport">导入 Excel</button>
        <button type="button" class="btn-nav" @click="openEdit(null)">新建用例</button>
        <button type="button" class="btn-nav btn-nav-primary" @click="openGenerate">生成用例</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="version-pills">
        <button
          type="button"
          class="vpill is-testing"
          :class="{ active: releaseTab === 'TESTING' }"
          @click="switchReleaseTab('TESTING')"
        >
          <span class="vpill-ico">✎</span>
          测试版本
          <span class="vpill-num">{{ testingCount }}</span>
        </button>
        <button
          type="button"
          class="vpill is-online"
          :class="{ active: releaseTab === 'ONLINE' }"
          @click="switchReleaseTab('ONLINE')"
        >
          <span class="vpill-ico">✓</span>
          线上版本
          <span class="vpill-num">{{ onlineCount }}</span>
        </button>
        <el-tooltip
          v-if="releaseTab === 'TESTING'"
          placement="bottom"
          effect="light"
          :show-after="120"
        >
          <template #content>
            来自测试环境新需求的用例，上线后可提升为线上版。<br />
            当前待提升 {{ testingCount }} 条。
</template>
          <span class="vpill-tip" tabindex="0" @click.stop>
            <el-icon><InfoFilled /></el-icon>
          </span>
        </el-tooltip>
      </div>

      <!--
        待确认项放在列表最上面，不是弹一次窗。
        这些是需求文档里的矛盾和缺口，没问清之前对应的用例根本写不出预期——
        藏起来的话，人会照着一个模型编出来的预期去测，然后把「符合错误预期」判成通过
      -->
      <!--
        只在测试版本显示。这些问题是「本次提测的需求文档」上的，
        线上版本页签放的是已经上线的用例——那边挂着一堆待确认，
        会让人以为线上有一批没验清楚的东西
      -->
      <div v-if="openQuestions.length && releaseTab === 'TESTING'" class="oq-bar">
        <div class="oq-head" @click="oqOpen = !oqOpen">
          <span class="oq-arrow">{{ oqOpen ? '▾' : '▸' }}</span>
          <b>{{ openQuestions.length }} 项待确认</b>
          <span class="oq-sub">需求文档里自相矛盾或没定义的地方，问清楚再测这几块</span>
        </div>
        <div v-if="oqOpen" class="oq-list">
          <div v-for="q in openQuestions" :key="q.id" class="oq-item">
            <div class="oq-title">
              <span v-if="q.kind" class="oq-kind">{{ q.kind }}</span>
              {{ q.title }}
              <span v-if="q.appVersion" class="oq-ver">{{ q.appVersion }}</span>
              <button type="button" class="oq-done" @click="resolveQuestion(q)">已确认</button>
              <button type="button" class="oq-drop" @click="deleteQuestion(q)">删除</button>
            </div>
            <div v-if="q.detail" class="oq-line"><span class="oq-lab">文档里</span>{{ q.detail }}</div>
            <div v-if="q.question" class="oq-line"><span class="oq-lab">要问</span>{{ q.question }}</div>
            <div v-if="q.impact" class="oq-line"><span class="oq-lab">影响</span>{{ q.impact }}</div>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <!--
          版本下拉只在「APP版本迭代」集显示：其余集合是长期沉淀的功能用例，
          加个永远选「全部」的控件只会占地方
        -->
        <div v-if="suite.byVersion" class="f-item">
          <span class="f-label">版本</span>
          <el-select
            v-model="filterVersion"
            class="f-w-page"
            size="small"
            clearable
            filterable
            placeholder="全部版本"
            @change="onVersionChange"
          >
            <el-option
              v-for="v in versionOptions"
              :key="v.version"
              :label="v.count ? `${v.version}（${v.count}）` : v.version"
              :value="v.version"
            />
          </el-select>
          <el-button size="small" text type="primary" @click="newVersionVisible = true">
            + 新建版本
          </el-button>
        </div>
        <!--
          单号这一层：一个版本几十个单子，用例不挂到单号上的话，
          「这个单子测完了没有」就答不出来——而那是提测时唯一要回答的问题。
          没选版本时不显示：跨版本的单号列表没有意义
        -->
        <!-- 版本迭代集用左侧树选需求单，顶部不再重复筛单号 -->
        <div v-if="suite.byVersion && filterVersion" class="f-item">
          <el-button size="small" text type="primary" @click="newIssueVisible = true">
            + 加单号
          </el-button>
        </div>
        <div v-if="suite.byVersion" class="f-item">
          <span class="f-label">端</span>
          <el-select
            v-model="filterSide"
            class="f-w-side"
            size="small"
            clearable
            placeholder="全部端"
            @change="onSearch"
          >
            <el-option v-for="sd in sideOptions" :key="sd.code" :label="sd.label" :value="sd.code" />
          </el-select>
        </div>
        <div class="f-item">
          <span class="f-label">搜索</span>
          <el-input
            v-model="filterKeyword"
            class="f-w-keyword"
            size="small"
            clearable
            placeholder="标题 / 编号 / 测试点"
            @keyup.enter="onSearch"
            @clear="onSearch"
          />
        </div>
        <div class="f-item">
          <span class="f-label">页面</span>
          <el-input
            v-model="filterPageName"
            class="f-w-page"
            size="small"
            clearable
            placeholder="页面"
            @keyup.enter="loadList"
          />
        </div>
        <div class="f-item">
          <span class="f-label">功能模块</span>
          <el-select
            v-model="filterModule"
            class="f-w-module"
            size="small"
            clearable
            placeholder="全部"
            teleported
            popper-class="ai-tc-filter-popper"
          >
            <el-option label="全部" value="" />
            <el-option v-for="m in moduleOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </div>
        <div class="f-item">
          <span class="f-label">优先级</span>
          <el-select
            v-model="filterPriority"
            class="f-w-priority"
            size="small"
            clearable
            placeholder="全部"
            teleported
            popper-class="ai-tc-filter-popper"
            @change="loadList"
          >
            <el-option label="全部" value="" />
            <el-option label="P0" value="P0" />
            <el-option label="P1" value="P1" />
            <el-option label="P2" value="P2" />
          </el-select>
        </div>
        <div class="f-item">
          <span class="f-label">状态</span>
          <el-select
            v-model="filterStatus"
            class="f-w-status"
            size="small"
            clearable
            placeholder="全部"
            teleported
            popper-class="ai-tc-filter-popper"
            @change="loadList"
          >
            <el-option label="全部" value="" />
            <el-option label="草稿" value="DRAFT" />
            <el-option label="已复核" value="REVIEWED" />
            <el-option label="归档" value="ARCHIVED" />
          </el-select>
        </div>
        <button type="button" class="btn-primary" @click="loadList">查询</button>
        <button type="button" class="btn-plain" @click="resetFilters">重置</button>
      </div>
    </div>

    <div
      class="page-body"
      :class="{
        'has-detail': detailOpen && !isNarrow,
        resizing,
        'is-version-browse': suite.byVersion
      }"
    >
      <!-- APP 版本迭代：环境 → APP/PWA/WEB → 需求单 →（海外）语言 -->
      <template v-if="suite.byVersion">
        <aside class="browse-nav">
          <div class="browse-nav-head">
            <span class="browse-env" :class="releaseTab === 'TESTING' ? 'is-test' : 'is-online'">
              {{ releaseTab === 'TESTING' ? '测试环境' : '线上版本' }}
            </span>
            <span class="browse-nav-tip">APP · PWA · WEB → 需求单</span>
          </div>
          <div class="browse-tree-wrap">
            <el-tree
              v-if="versionTree.length"
              ref="browseTreeRef"
              :data="versionTree"
              node-key="nodeKey"
              :props="browseTreeProps"
              highlight-current
              default-expand-all
              :expand-on-click-node="false"
              @node-click="onBrowseTreeClick"
            >
              <template #default="{ data }">
                <span class="browse-tree-row" :class="{ 'is-leaf': !data.isFolder }">
                  <el-icon v-if="data.isFolder" class="browse-tree-icon"><FolderOpened /></el-icon>
                  <span class="browse-tree-text" :title="data.label">{{ data.label }}</span>
                  <span v-if="data.meta != null" class="browse-tree-badge">{{ data.meta }}</span>
                </span>
              </template>
            </el-tree>
            <div v-else-if="!loading" class="browse-tree-empty">暂无用例，请先生成或导入</div>
          </div>
        </aside>

        <main v-loading="loading" class="browse-main">
          <template v-if="selectedBrowse && !selectedBrowse.isFolder">
            <div class="browse-main-head">
              <div>
                <h2 class="browse-title">{{ selectedBrowse.label }}</h2>
                <div class="browse-sub">
                  <span class="pill pill-ch">{{ browseChannelLabel(selectedBrowse.channel) }}</span>
                  <span v-if="selectedBrowse.lang" class="pill pill-lang">
                    {{ selectedBrowse.lang === 'zh' ? '海外 · 中文' : '海外 · 英文' }}
                  </span>
                  <span class="pill pill-count">{{ visibleBrowseCases.length }} 条用例</span>
                </div>
              </div>
              <div v-if="selectedBrowseRequirement && coverageOf(selectedBrowseRequirement)" class="browse-cov">
                <span
                  v-for="d in coverageOf(selectedBrowseRequirement)!.dimensions"
                  :key="d.key"
                  class="cov-pill"
                  :class="'is-' + String(d.status || '').toLowerCase()"
                >
                  {{ d.badge || d.label }}
                </span>
              </div>
            </div>

            <section v-if="selectedBrowseRequirement" class="browse-eps">
              <div class="browse-eps-head">
                <span>涉及接口</span>
                <span class="browse-eps-req">{{ selectedBrowseRequirement }}</span>
              </div>
              <div v-if="browseEndpointsLoading" class="browse-eps-tip">加载中…</div>
              <div v-else-if="!browseEndpoints.length" class="browse-eps-tip">
                暂无关联接口。跑「接口对比分析」且分支名带单号会自动挂上。
              </div>
              <div v-for="ep in browseEndpoints" v-else :key="ep.id" class="browse-ep">
                <span class="req-ep-m" :class="'m-' + (ep.httpMethod || '').toLowerCase()">{{ ep.httpMethod }}</span>
                <span class="req-ep-p">{{ ep.path }}</span>
                <span v-if="ep.project" class="req-ep-proj">{{ ep.project }}</span>
                <span class="req-ep-src" :class="'is-' + srcOf(ep.source)">{{ srcLabel(ep.source) }}</span>
                <span v-if="ep.summary" class="req-ep-note">{{ ep.summary }}</span>
              </div>
            </section>

            <div class="browse-case-table">
              <div class="table-head">
                <span>
                  <input
                    v-if="releaseTab === 'TESTING'"
                    type="checkbox"
                    :checked="allVisibleSelected"
                    :indeterminate.prop="someVisibleSelected && !allVisibleSelected"
                    @change="onSelectAllVisibleChange"
                  />
                </span>
                <span>TC 编号</span>
                <span>用例标题</span>
                <span>优先级</span>
                <span>复核状态</span>
                <span>自动化</span>
                <span>操作</span>
              </div>
              <el-empty v-if="!visibleBrowseCases.length" description="该节点下暂无用例" />
              <template v-for="row in visibleBrowseCases" :key="row.id ?? row.caseId">
                <div
                  class="case-row"
                  :class="{ active: detailOpen && row.id === selectedId }"
                  @click="selectCase(row)"
                >
                  <span class="c-check" @click.stop>
                    <input
                      v-if="releaseTab === 'TESTING' && row.id"
                      type="checkbox"
                      :checked="selectedIds.includes(row.id)"
                      @change="onRowCheckChange(row.id, $event)"
                    />
                  </span>
                  <span class="c-id">{{ row.caseId }}</span>
                  <span class="c-title" :title="row.title">{{ row.title }}</span>
                  <span class="c-prio" :class="prioClass(row.priority)">{{ row.priority || 'P1' }}</span>
                  <span class="c-status" :class="statusChipClass(row.status)">{{ statusLabel(row.status) }}</span>
                  <span class="c-cover" :class="coverClass(row)" :title="coverTip(row)">{{ coverLabel(row) }}</span>
                  <span class="c-ops" @click.stop>
                    <button
                      v-if="releaseTab === 'TESTING' && row.id"
                      type="button"
                      class="op-promote"
                      @click="promoteOne(row)"
                    >↑ 提升</button>
                    <button
                      v-if="row.status !== 'REVIEWED' && row.id"
                      type="button"
                      class="op-review"
                      @click="markReviewed(row)"
                    >复核</button>
                    <button type="button" class="op-edit" @click="openEdit(row)">编辑</button>
                    <button type="button" class="op-del" @click="removeRow(row)">删除</button>
                  </span>
                </div>
              </template>
            </div>

            <div
              v-if="releaseTab === 'TESTING'"
              class="batch-bar"
              :class="{ active: selectedIds.length > 0 }"
            >
              <span>已选 <b>{{ selectedIds.length }}</b> 条</span>
              <span class="batch-sep" />
              <button
                type="button"
                class="btn-batch"
                :disabled="!selectedIds.length || promoting"
                @click="promoteSelected"
              >🚀 批量提升为线上版</button>
              <button
                type="button"
                class="btn-batch"
                :disabled="!selectedIds.length"
                @click="openBatchMeta"
              >✎ 批量改页面/模块</button>
            </div>
          </template>
          <div v-else class="browse-main-empty">在左侧选中一个需求单节点，查看用例与涉及接口</div>
        </main>
      </template>

      <div v-else v-loading="loading" class="list-col">
        <div class="stats-bar">
          <div class="stats-left">
            <span><i>页面</i><b>{{ displayPage }}</b></span>
            <span class="stats-pipe">|</span>
            <span><i>本页</i><b>{{ list.length }} / {{ total }}</b></span>
          </div>
          <div class="stats-right">
            <span class="stats-cover-label">自动化覆盖</span>
            <div class="cover-track" :title="`${automatedCount} / ${list.length || 0}`">
              <div
                class="cover-fill"
                :style="{ width: coverPercent + '%' }"
              />
            </div>
            <span class="stats-cover-num">{{ automatedCount }} / {{ list.length || 0 }}</span>
          </div>
        </div>

        <div class="case-table">
          <el-empty
            v-if="!loading && !list.length"
            :description="`「${suiteTitle}」${releaseTab === 'ONLINE' ? '线上' : '测试'}暂无用例`"
          />

          <div v-for="(mod, modIdx) in moduleGroups" :key="mod.groupKey" class="mod-block">
            <div class="mod-head" @click="toggleModule(mod.groupKey)">
              <span class="fold-arrow" :class="{ folded: isModuleCollapsed(mod.groupKey) }">▼</span>
              <span class="mod-name">{{ mod.module }}</span>
              <span class="mod-meta">
                <span
                  v-if="suite.byVersion && !filterVersion && mod.subs[0]?.rows[0]?.appVersion"
                  class="mod-ver"
                >
                  {{ mod.subs[0].rows[0].appVersion }}
                </span>
                <span v-for="sd in groupSides(mod)" :key="sd" class="mod-side">{{ sideLabel(sd) }}</span>
                <span v-if="groupService(mod)" class="mod-side is-svc">{{ groupService(mod) }}</span>
                <span class="count-badge">{{ mod.count }} 条</span>
                <span class="cover-pct" :class="{ zero: mod.coverage === 0 }">覆盖 {{ mod.coverage }}%</span>
                <!-- 含对比分析关联 + 人工补充；「改了哪些」只覆盖前者，测试更关心整条链路 -->
                <a
                  v-if="suite.byVersion && groupRequirement(mod)"
                  class="mod-eps"
                  :class="{ 'has-count': reqEndpointCount(groupRequirement(mod)) > 0 }"
                  @click.stop="toggleReqEndpoints(groupRequirement(mod))"
                >
                  {{ reqEndpointLinkLabel(groupRequirement(mod)) }}
                </a>
              </span>
              <span v-if="isModuleCollapsed(mod.groupKey)" class="folded-tip">已折叠</span>
            </div>

            <div
              v-if="suite.byVersion && groupRequirement(mod) && !isModuleCollapsed(mod.groupKey)"
              class="cov-bar"
              @click.stop
            >
              <span class="cov-label">提测覆盖</span>
              <template v-if="coverageOf(groupRequirement(mod))">
                <span
                  v-for="d in coverageOf(groupRequirement(mod))!.dimensions"
                  :key="d.key"
                  class="cov-pill"
                  :class="'is-' + String(d.status || '').toLowerCase()"
                  :title="String(d.hint || '')"
                >
                  {{ d.badge || d.label }}
                </span>
                <span
                  class="cov-ready"
                  :class="coverageOf(groupRequirement(mod))!.ready ? 'ok' : 'no'"
                >
                  {{ coverageOf(groupRequirement(mod))!.ready ? '可提测' : '未就绪' }}
                </span>
                <button
                  v-if="coverageTodos(groupRequirement(mod)).length"
                  type="button"
                  class="cov-link"
                  @click="toggleCoveragePanel(groupRequirement(mod))"
                >
                  {{ coveragePanelOf === groupRequirement(mod) ? '收起' : '待办' }}
                </button>
              </template>
              <span v-else class="cov-loading">…</span>
            </div>

            <div
              v-if="suite.byVersion && coveragePanelOf === groupRequirement(mod) && coverageOf(groupRequirement(mod)) && !isModuleCollapsed(mod.groupKey)"
              class="cov-panel"
              @click.stop
            >
              <div
                v-for="d in coverageTodos(groupRequirement(mod))"
                :key="'cov-' + d.key"
                class="cov-card"
                :class="'is-' + String(d.status || '').toLowerCase()"
              >
                <div class="cov-card-head">
                  <span class="cov-card-label">{{ d.label }}</span>
                  <span class="cov-pill" :class="'is-' + String(d.status || '').toLowerCase()">
                    {{ d.badge || d.statusLabel }}
                  </span>
                </div>
                <p class="cov-card-hint">{{ d.hint }}</p>
                <div class="cov-card-actions">
                  <button
                    v-if="d.key === 'SERVER' && (d.endpointTotal || 0) > 0"
                    type="button"
                    class="cov-act"
                    @click="openReqEndpoints(groupRequirement(mod))"
                  >
                    涉及接口
                  </button>
                  <button
                    v-if="d.key === 'SERVER' && d.status !== 'GREEN' && d.status !== 'WAIVED'"
                    type="button"
                    class="cov-act is-primary"
                    :disabled="batchGenLoading && batchGenReqNo === groupRequirement(mod)"
                    @click="batchGenerateReqCases(groupRequirement(mod))"
                  >
                    {{ batchGenLoading && batchGenReqNo === groupRequirement(mod) ? '生成中…' : '一键生成用例' }}
                  </button>
                  <button
                    v-if="d.status === 'WAIVED'"
                    type="button"
                    class="cov-act"
                    @click="clearWaive(groupRequirement(mod), String(d.key))"
                  >
                    取消豁免
                  </button>
                  <button
                    v-if="d.key === 'SERVER' && groupRequirement(mod)"
                    type="button"
                    class="cov-act"
                    @click="releaseRequirementApi(groupRequirement(mod))"
                  >
                    本单已上线
                  </button>
                  <button
                    v-if="d.status !== 'GREEN' && d.status !== 'WAIVED'"
                    type="button"
                    class="cov-act"
                    @click="openWaive(groupRequirement(mod), String(d.key))"
                  >
                    豁免
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="suite.byVersion && reqEndpointsOf && reqEndpointsOf === groupRequirement(mod) && !isModuleCollapsed(mod.groupKey)"
              class="req-eps"
            >
              <div class="req-eps-head">
                <span>涉及接口</span>
                <span class="req-eps-req">{{ groupRequirement(mod) }}</span>
              </div>
              <div v-if="reqEndpointsLoading" class="req-eps-tip">加载中…</div>
              <template v-else>
                <div v-if="!reqEndpoints.length" class="req-eps-tip">
                  还没关联接口。跑「接口对比分析」且分支名带单号（如 fch/20260804/{{ groupRequirement(mod) }}）会自动挂上<b>分支改动</b>；
                  没改但本需求会调到的，点「补上」手动加。
                </div>
                <div v-for="ep in reqEndpoints" :key="ep.id" class="req-ep">
                  <span class="req-ep-m" :class="'m-' + (ep.httpMethod || '').toLowerCase()">
                    {{ ep.httpMethod }}
                  </span>
                  <span class="req-ep-p">{{ ep.path }}</span>
                  <span v-if="ep.project" class="req-ep-proj">{{ ep.project }}</span>
                  <span v-else class="req-ep-proj is-missing">未归项目</span>
                  <!--
                    分开标：SYNC 是「这个分支确实改了它」（事实），
                    MANUAL 是「我记得这个需求会调它」（判断）。不分的话你就不知道哪些是验证过的
                  -->
                  <span class="req-ep-src" :class="'is-' + srcOf(ep.source)">
                    {{ srcLabel(ep.source) }}
                  </span>
                  <span v-if="ep.changeFlag" class="req-ep-flag">{{ ep.changeFlag }}</span>
                  <span v-if="ep.changeNote" class="req-ep-note">{{ ep.changeNote }}</span>
                  <span v-else-if="ep.summary" class="req-ep-note">{{ ep.summary }}</span>
                  <!--
                    抓包抓到只说明「它被调了」，没有任何东西在验它。
                    从这里一步生成用例，是「涉及接口」变成「有覆盖」的唯一通路
                  -->
                  <button
                    type="button"
                    class="req-ep-gen"
                    @click.stop="openGenCase(ep)"
                  >
                    生成用例
                  </button>
                  <button type="button" class="req-ep-del" @click.stop="removeReqEndpoint(ep)">移除</button>
                </div>

                <div class="req-ep-add" @click.stop>
                  <el-button size="small" type="primary" plain @click="openAddEpDialog(groupRequirement(mod))">
                    补上
                  </el-button>
                </div>


                <div v-if="reqEndpoints.length" class="req-eps-tip">
                  分析来源分支：{{ syncBranchOf(reqEndpoints) || '（暂无，都是手动补的）' }}
                </div>
              </template>
            </div>

            <template v-if="!isModuleCollapsed(mod.groupKey)">
              <div class="table-head">
                <span>
                  <input
                    v-if="releaseTab === 'TESTING' && modIdx === 0"
                    type="checkbox"
                    :checked="allPageSelected"
                    :indeterminate.prop="somePageSelected && !allPageSelected"
                    @change="onSelectAllChange"
                  />
                </span>
                <span>TC 编号</span>
                <span>用例标题</span>
                <span>优先级</span>
                <span>复核状态</span>
                <span>自动化</span>
                <span>操作</span>
              </div>

              <div v-for="sub in mod.subs" :key="mod.groupKey + '::' + sub.subModule" class="sub-block">
                <div v-if="sub.subModule" class="sub-head">
                  <span class="sub-arrow">▸</span>
                  <span>{{ sub.subModule }}</span>
                  <span class="sub-count">{{ sub.rows.length }}</span>
                </div>

                <template v-for="row in sub.rows" :key="row.id ?? row.caseId">
                  <div
                    class="case-row"
                    :class="{ active: detailOpen && row.id === selectedId }"
                    @click="selectCase(row)"
                  >
                    <span class="c-check" @click.stop>
                      <input
                        v-if="releaseTab === 'TESTING' && row.id"
                        type="checkbox"
                        :checked="selectedIds.includes(row.id)"
                        @change="onRowCheckChange(row.id, $event)"
                      />
                    </span>
                    <span class="c-id">{{ row.caseId }}</span>
                    <span class="c-title" :title="row.title">{{ row.title }}</span>
                    <span class="c-prio" :class="prioClass(row.priority)">{{ row.priority || 'P1' }}</span>
                    <span class="c-status" :class="statusChipClass(row.status)">{{ statusLabel(row.status) }}</span>
                    <span class="c-cover" :class="coverClass(row)" :title="coverTip(row)">{{ coverLabel(row) }}</span>
                    <span class="c-ops" @click.stop>
                      <button
                        v-if="releaseTab === 'TESTING' && row.id"
                        type="button"
                        class="op-promote"
                        @click="promoteOne(row)"
                      >↑ 提升</button>
                      <button
                        v-if="row.status !== 'REVIEWED' && row.id"
                        type="button"
                        class="op-review"
                        @click="markReviewed(row)"
                      >复核</button>
                      <button type="button" class="op-edit" @click="openEdit(row)">编辑</button>
                      <button type="button" class="op-del" @click="removeRow(row)">删除</button>
                    </span>
                  </div>
                  <div v-if="isRowExpanded(row.id)" class="more-row" @click.stop>
                    <span class="more-spacer" />
                    <span class="more-spacer" />
                    <span class="more-body">
                      <span>模块：{{ row.module || '—' }} · 子功能：{{ row.subModule || '—' }} · 建议：{{ adviceShort(row.automationAdvice) }}</span>
                      <span v-if="row.flowName" class="more-flow">
                        流程：{{ row.flowName }}
                        <template v-if="row.lastRunAt">
                          · 最近自动化执行 {{ fmtTime(row.lastRunAt) }}（{{ row.lastRunStatus || '—' }}）
                        </template>
                        <template v-else>· 还没跑过自动化</template>
                      </span>
                      <span v-if="row.flowStale" class="more-stale">
                        关联之后用例又被改过（{{ fmtTime(row.contentUpdatedAt) }}），
                        流程可能还在验旧的期望结果。核对完流程后，重新保存一次关联即可清掉这个提示。
                      </span>
                      <button type="button" class="link-btn" @click="toggleRowExpand(row.id)">收起</button>
                    </span>
                  </div>
                  <div v-else class="more-row is-toggle" @click.stop="toggleRowExpand(row.id)">
                    <span class="more-spacer" />
                    <span class="more-spacer" />
                    <span class="more-body">更多 ▾</span>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <div
            v-if="releaseTab === 'TESTING'"
            class="batch-bar"
            :class="{ active: selectedIds.length > 0 }"
          >
            <span>已选 <b>{{ selectedIds.length }}</b> 条</span>
            <span class="batch-sep" />
            <button
              type="button"
              class="btn-batch"
              :disabled="!selectedIds.length || promoting"
              @click="promoteSelected"
            >🚀 批量提升为线上版</button>
            <!--
              批量改页面/模块：生成器猜的层级往往整批都是错的，
              一条条改十几次是纯粹的重复劳动——而这种活干到一半就会有人放弃，
              然后那批用例的层级就永远错着
            -->
            <button
              type="button"
              class="btn-batch"
              :disabled="!selectedIds.length"
              @click="openBatchMeta"
            >✎ 批量改页面/模块</button>
            <span class="batch-sep" />
            <span class="batch-tip">勾选后可一键提升；不复制行，进入线上版本 Tab</span>
          </div>

          <div v-if="total > pageSize" class="pager">
            <el-pagination
              background
              small
              layout="prev, pager, next"
              :total="total"
              :page-size="pageSize"
              v-model:current-page="page"
              @current-change="loadList"
            />
          </div>
        </div>
      </div>

      <div
        v-if="detailOpen && selectedCase && !isNarrow"
        class="split-handle"
        title="拖动调节左右宽度"
        @mousedown.prevent="startResize"
      />

      <aside
        v-if="detailOpen && selectedCase && !isNarrow"
        class="detail-side"
        :style="{ width: detailWidth + 'px' }"
      >
        <div class="detail-sticky-top">
          <div class="detail-top-row">
            <span class="detail-tcid">{{ selectedCase.caseId }}</span>
            <span v-if="releaseTab === 'TESTING'" class="detail-env">测试版</span>
            <span v-else class="detail-env is-online">线上版</span>
            <div class="detail-top-ops">
              <button
                v-if="releaseTab === 'TESTING'"
                type="button"
                class="op-promote is-lg"
                @click="promoteOne(selectedCase)"
              >↑ 提升为线上版</button>
              <button
                v-if="selectedCase.status !== 'REVIEWED' && selectedCase.id"
                type="button"
                class="op-review"
                @click="markReviewed(selectedCase)"
              >标记复核</button>
              <button type="button" class="op-edit" @click="openEdit(selectedCase)">编辑</button>
              <button type="button" class="op-del" @click="removeRow(selectedCase)">删除</button>
              <button type="button" class="detail-close" @click="closeDetail">✕</button>
            </div>
          </div>
          <h3 class="detail-title">{{ selectedCase.title }}</h3>
          <div class="detail-badges">
            <span class="c-prio" :class="prioClass(selectedCase.priority)">{{ selectedCase.priority || 'P1' }}</span>
            <span class="type-tag">{{ selectedCase.type || '功能测试' }}</span>
            <span class="c-status" :class="statusChipClass(selectedCase.status)">{{ statusLabel(selectedCase.status) }}</span>
          </div>
        </div>
        <div class="detail-accent" :class="prioClass(selectedCase.priority)"></div>

        <div class="detail-body">
          <div class="field-pair">
            <div class="fl">功能模块</div><div class="fv">{{ selectedCase.module || '—' }}</div>
            <div class="fl">子功能</div><div class="fv">{{ selectedCase.subModule || '—' }}</div>
          </div>
          <div v-if="selectedCase.testPoint" class="field-full">
            <div class="fl">测试点</div><div class="fv">{{ selectedCase.testPoint }}</div>
          </div>
          <div v-if="selectedCase.precondition" class="field-full">
            <div class="fl">初始条件</div><div class="fv">{{ selectedCase.precondition }}</div>
          </div>
          <div class="field-full is-steps">
            <div class="fl">测试步骤</div>
            <div class="fv">
              <ol v-if="normalizeSteps(selectedCase.steps).length" class="step-list">
                <li v-for="(st, i) in normalizeSteps(selectedCase.steps)" :key="i" class="step-item">
                  <span class="step-no">{{ i + 1 }}</span>
                  <div class="step-content">
                    <div class="step-action">{{ st.action || '—' }}</div>
                    <div class="step-meta">
                      <span v-if="st.target" class="pill pill-target"><b>目标</b>：{{ st.target }}</span>
                      <span v-if="st.expected" class="pill pill-expected"><b>预期</b>：{{ st.expected }}</span>
                    </div>
                  </div>
                </li>
              </ol>
              <span v-else class="muted">—</span>
            </div>
          </div>
          <div class="field-full">
            <div class="fl">期望结果</div>
            <div class="fv">
              <div v-if="selectedCase.expectedResult" class="expected-box">{{ selectedCase.expectedResult }}</div>
              <span v-else class="muted">—</span>
            </div>
          </div>
          <div v-if="selectedCase.remark" class="field-full">
            <div class="fl">备注</div><div class="fv">{{ selectedCase.remark }}</div>
          </div>
        </div>

        <div class="detail-sticky-bottom">
          <button type="button" class="nav-link" :disabled="!prevCase" @click="selectCase(prevCase)">← 上一条</button>
          <span class="pos">{{ releaseTab === 'ONLINE' ? '线上版' : '测试版' }} · {{ selectedIndex + 1 }} / {{ navigationList.length }}</span>
          <button type="button" class="nav-link" :disabled="!nextCase" @click="selectCase(nextCase)">下一条 →</button>
        </div>
      </aside>
    </div>

    <el-drawer v-model="drawerVisible" size="92%" direction="rtl" title="用例详情" destroy-on-close>
      <template v-if="selectedCase">
        <div class="detail-top-row">
          <span class="detail-tcid">{{ selectedCase.caseId }}</span>
          <span class="detail-env" :class="{ 'is-online': releaseTab === 'ONLINE' }">
            {{ releaseTab === 'ONLINE' ? '线上版' : '测试版' }}
          </span>
        </div>
        <h3 class="detail-title">{{ selectedCase.title }}</h3>
        <div class="detail-body">
          <div class="field-pair">
            <div class="fl">功能模块</div><div class="fv">{{ selectedCase.module || '—' }}</div>
            <div class="fl">子功能</div><div class="fv">{{ selectedCase.subModule || '—' }}</div>
          </div>
          <div v-if="selectedCase.precondition" class="field-full">
            <div class="fl">初始条件</div><div class="fv">{{ selectedCase.precondition }}</div>
          </div>
          <div class="field-full is-steps">
            <div class="fl">测试步骤</div>
            <div class="fv">
              <ol v-if="normalizeSteps(selectedCase.steps).length" class="step-list">
                <li v-for="(st, i) in normalizeSteps(selectedCase.steps)" :key="i" class="step-item">
                  <span class="step-no">{{ i + 1 }}</span>
                  <div class="step-content">
                    <div class="step-action">{{ st.action || '—' }}</div>
                    <div class="step-meta">
                      <span v-if="st.target" class="pill pill-target"><b>目标</b>：{{ st.target }}</span>
                      <span v-if="st.expected" class="pill pill-expected"><b>预期</b>：{{ st.expected }}</span>
                    </div>
                  </div>
                </li>
              </ol>
            </div>
          </div>
          <div class="field-full">
            <div class="fl">期望结果</div>
            <div class="fv">
              <div v-if="selectedCase.expectedResult" class="expected-box">{{ selectedCase.expectedResult }}</div>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="editVisible"
      class="case-edit-dialog"
      width="760px"
      top="4vh"
      destroy-on-close
      :show-close="true"
    >
      <template #header>
        <div class="ced-header">
          <el-icon class="ced-title-ico"><EditPen /></el-icon>
          <span class="ced-title">{{ editingId ? '编辑用例' : '新建用例' }}</span>
          <span v-if="editingCaseId" class="ced-tcid">{{ editingCaseId }}</span>
        </div>
      </template>

      <div class="ced-body">
        <section class="ced-sec">
          <div class="ced-sec-title">基本信息</div>
          <div class="ced-grid2">
            <!--
              页面必须能改：版本迭代这块是优化 + 新需求，页面 / 模块 / 功能由人自己判断，
              生成器猜不准。改不了的话，一批标错的用例只能删了重来
            -->
            <label class="ced-field">
              <span class="ced-label">页面</span>
              <el-input v-model="editForm.pageName" placeholder="如 更新日志页、赛事详情" />
            </label>
            <label class="ced-field">
              <span class="ced-label">功能模块</span>
              <el-input v-model="editForm.module" placeholder="如 账号" />
            </label>
            <!--
              多选：一个需求常常同时改客户端 + H5 + 后端，单选会逼人填错一个。
              和下面的「设备平台」不是一回事——那个是 iOS/安卓，用来做流程校验的
            -->
            <label class="ced-field">
              <span class="ced-label">涉及端</span>
              <el-select
                v-model="editForm.sides"
                multiple
                placeholder="客户端 / H5 / 后端 / 管理后台"
                style="width: 100%"
              >
                <el-option v-for="sd in sideOptions" :key="sd.code" :label="sd.label" :value="sd.code">
                  <span class="side-opt-name">{{ sd.label }}</span>
                  <span class="side-opt-hint">{{ sd.hint }}</span>
                </el-option>
              </el-select>
            </label>
            <!--
              「后端的问题」推不到人，「comment-service 的问题」才推得到。
              没选后端时不显示——留着一个指向无关团队的服务名只会误导
            -->
            <label v-if="editForm.sides.includes('SERVER')" class="ced-field">
              <span class="ced-label">后端服务</span>
              <el-select
                v-model="editForm.serverService"
                filterable
                allow-create
                clearable
                default-first-option
                placeholder="选已登记的服务，或直接输"
                style="width: 100%"
              >
                <el-option v-for="p in serviceOptions" :key="p.code" :label="p.code" :value="p.code" />
              </el-select>
            </label>
            <label class="ced-field">
              <span class="ced-label">子功能</span>
              <el-input v-model="editForm.subModule" placeholder="如 验证码登录" />
            </label>
            <label class="ced-field">
              <span class="ced-label">测试项</span>
              <el-input v-model="editForm.testItem" placeholder="如 异常输入" />
            </label>
            <label class="ced-field">
              <span class="ced-label">测试点</span>
              <el-input v-model="editForm.testPoint" placeholder="如 错误手机号登录" />
            </label>
          </div>
          <label class="ced-field">
            <span class="ced-label">用例标题 <i>*</i></span>
            <el-input v-model="editForm.title" placeholder="一句话说清这条在验什么" />
          </label>
          <div class="ced-grid2">
            <label class="ced-field">
              <span class="ced-label">用例级别</span>
              <el-select v-model="editForm.priority" style="width: 100%">
                <el-option label="P0（冒烟）" value="P0" />
                <el-option label="P1" value="P1" />
                <el-option label="P2" value="P2" />
              </el-select>
            </label>
            <label class="ced-field">
              <span class="ced-label">测试类型</span>
              <el-select v-model="editForm.type" style="width: 100%">
                <el-option label="功能测试" value="功能测试" />
                <el-option label="异常测试" value="异常测试" />
                <el-option label="兼容性测试" value="兼容性测试" />
                <el-option label="性能测试" value="性能测试" />
              </el-select>
            </label>
          </div>
        </section>

        <section class="ced-sec">
          <div class="ced-sec-title">测试内容</div>
          <label class="ced-field">
            <span class="ced-label">初始条件</span>
            <el-input
              v-model="editForm.precondition"
              type="textarea"
              :rows="2"
              placeholder="执行前设备/账号要处于什么状态"
            />
          </label>

          <div class="ced-field">
            <div class="ced-steps-head">
              <span class="ced-label">测试步骤</span>
              <!--
                不做自动化的用例，「目标元素」那一列是纯噪音——
                它只对要落成自动化流程的用例有用。而这类用例是多数：
                大量用例写出来就是给人照着测、顺便统计覆盖的
              -->
              <label class="ced-auto-toggle">
                <el-switch v-model="editAutomate" size="small" />
                <span>要做自动化</span>
                <span class="ced-auto-tip">
                  {{ editAutomate ? '步骤里可以填目标元素' : '只写操作和预期，不填元素' }}
                </span>
              </label>
            </div>
            <div class="ced-steps">
              <div v-for="(st, i) in editForm.steps" :key="i" class="ced-step">
                <div class="ced-step-top">
                  <span class="ced-step-no">{{ i + 1 }}</span>
                  <el-input v-model="st.action" class="ced-step-action" placeholder="如 点击登录" />
                  <div class="ced-step-ops">
                    <button type="button" class="ced-ico" :disabled="i === 0" @click="moveStepRow(i, -1)">↑</button>
                    <button
                      type="button"
                      class="ced-ico"
                      :disabled="i === editForm.steps.length - 1"
                      @click="moveStepRow(i, 1)"
                    >↓</button>
                    <button type="button" class="ced-ico is-del" @click="editForm.steps.splice(i, 1)">×</button>
                  </div>
                </div>
                <div class="ced-step-sub" :class="{ 'no-target': !editAutomate }">
                  <label v-if="editAutomate" class="ced-field">
                    <span class="ced-label is-sub">目标元素</span>
                    <el-select
                      v-model="st.target"
                      filterable
                      allow-create
                      default-first-option
                      clearable
                      placeholder="选元素或直接写"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="el in elementOptions"
                        :key="el.nameEn"
                        :label="el.nameZh ? `${el.nameZh}（${el.nameEn}）` : el.nameEn"
                        :value="el.nameZh || el.nameEn"
                      />
                    </el-select>
                  </label>
                  <label class="ced-field">
                    <span class="ced-label is-sub">预期结果</span>
                    <el-input v-model="st.expected" placeholder="这一步应该看到什么（可留空）" />
                  </label>
                </div>
              </div>
              <div v-if="!editForm.steps.length" class="ced-hint">还没有步骤，点下面「加一步」，或直接从 Excel 粘贴</div>
              <div class="ced-step-actions">
                <button type="button" class="ced-btn" @click="addStepRow">+ 加一步</button>
                <button type="button" class="ced-btn" @click="pasteVisible = true">从 Excel 粘贴</button>
              </div>
            </div>
          </div>

          <div class="ced-field">
            <span class="ced-label">期望结果</span>
            <el-input
              v-model="editForm.expectedResult"
              type="textarea"
              :rows="3"
              placeholder="整条用例跑完应该看到什么"
            />
          </div>
        </section>

        <section class="ced-sec">
          <div class="ced-sec-title">扩展信息</div>
          <label class="ced-field">
            <span class="ced-label">关联流程</span>
            <el-select
              v-model="editForm.flowId"
              filterable
              clearable
              placeholder="留空＝尚未自动化"
              style="width: 100%"
            >
              <el-option
                v-for="f in linkableFlowOptions"
                :key="f.id"
                :label="f.platform ? `${f.name}（${f.platform}）` : f.name"
                :value="f.id"
              />
            </el-select>
            <div class="ced-hint is-link">
              「是否已实现自动化」由这里推导——关联的流程被停用或删除，标记会自动变回「未覆盖」。<br />
              <strong>只要流程执行了这条用例的步骤就算覆盖</strong>，跟它进不进回归批次无关。
              这里不列的只有<strong>装包准备</strong>（不执行用例步骤）和<strong>仅性能测试</strong>
              （采资源曲线、不验功能）——那两类挂上去必然是假覆盖。
              <template v-if="editingPlatform">同时只列 {{ editingPlatform }} 的流程。</template>
            </div>
          </label>
          <div class="ced-grid2">
            <label class="ced-field">
              <span class="ced-label">自动化建议</span>
              <el-select v-model="editForm.automationAdvice" clearable placeholder="尚未评估" style="width: 100%">
                <el-option label="建议自动化" value="RECOMMENDED" />
                <el-option label="部分可自动" value="PARTIAL" />
                <el-option label="不建议自动化" value="NOT_RECOMMENDED" />
              </el-select>
              <div class="ced-hint is-link">建议自动化：可点可断言；不建议：偏视觉/不稳定，人测即可</div>
            </label>
            <label class="ced-field">
              <span class="ced-label">发布轨</span>
              <el-select v-model="editForm.releaseStage" style="width: 100%">
                <el-option label="测试版本" value="TESTING" />
                <el-option label="线上版本" value="ONLINE" />
              </el-select>
              <div class="ced-hint is-link">新建默认跟随当前 Tab；也可手动改轨（提升走「提升为线上」更清晰）</div>
            </label>
          </div>
          <label class="ced-field">
            <span class="ced-label">备注</span>
            <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="选填" />
          </label>
        </section>
      </div>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-if="pasteVisible"
      v-model="pasteVisible"
      title="从 Excel 粘贴步骤"
      width="620px"
      append-to-body
      destroy-on-close
    >
      <el-input
        v-model="pasteText"
        type="textarea"
        :rows="10"
        placeholder="直接从表格里复制若干行粘进来。一行一步，列顺序：操作 / 目标元素 / 预期结果"
      />
      <div class="ced-hint">
        列之间按 Tab 分隔（从 Excel、飞书表格复制出来就是这个格式）。只有一列时全当「操作」。
        追加到现有步骤后面，不会覆盖。
      </div>
      <template #footer>
        <el-button @click="pasteVisible = false">取消</el-button>
        <el-button type="primary" @click="applyPaste">追加 {{ pastePreviewCount }} 步</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入用例表格" width="920px" destroy-on-close>
      <div class="import-src">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".xlsx,.xls,.csv"
          :on-change="onPickFile"
        >
          <el-button type="primary">选择 Excel / CSV 文件</el-button>
        </el-upload>
        <span class="edit-hint">或者直接从表格里复制若干行，粘到下面这个框</span>
      </div>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="4"
        placeholder="连表头一起复制粘贴进来（表头是认列用的，不能只贴数据行）"
        @change="parseImportText"
      />
      <div class="import-actions">
        <el-button size="small" :loading="importParsing" @click="parseImportText">解析粘贴内容</el-button>
        <span v-if="importFileName" class="edit-hint">已选文件：{{ importFileName }}</span>
      </div>

      <el-alert
        v-if="importError"
        type="error"
        :closable="false"
        show-icon
        :title="importError"
        style="margin-top: 12px"
      />
      <el-alert
        v-for="(w, i) in importWarnings"
        :key="i"
        type="warning"
        :closable="false"
        show-icon
        :title="w"
        style="margin-top: 8px"
      />

      <template v-if="importRows.length">
        <div class="section-title" style="margin-top: 14px">
          <span class="section-icon">📋</span>
          解析出 {{ importRows.length }} 条，确认无误再导入
        </div>
        <el-table :data="importRows" size="small" border max-height="320">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="module" label="功能模块" width="100" show-overflow-tooltip />
          <el-table-column prop="subModule" label="子功能" width="100" show-overflow-tooltip />
          <el-table-column prop="testItem" label="测试项" width="100" show-overflow-tooltip />
          <el-table-column prop="title" label="测试点 / 标题" min-width="160" show-overflow-tooltip />
          <el-table-column prop="priority" label="级别" width="64" align="center" />
          <el-table-column label="步骤" width="64" align="center">
            <template #default="{ row }">{{ (row.steps || []).length }}</template>
          </el-table-column>
          <el-table-column prop="expectedResult" label="期望结果" min-width="140" show-overflow-tooltip />
        </el-table>
      </template>

      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importSaving"
          :disabled="!importRows.length"
          @click="submitImport"
        >导入 {{ importRows.length }} 条到「{{ suiteTitle }}」</el-button>
      </template>
    </el-dialog>

    <!--
      生成结果先在这里过一遍再入库。
      直接入库的话，不适用的那几条要再进列表一条条删——而删过一轮之后，
      你已经分不清哪些是看过的、哪些是还没看的
    -->
    <el-dialog
      v-model="genPreviewVisible"
      :title="`生成了 ${genPreviewRows.length} 条，挑一遍再入库`"
      width="900px"
      top="6vh"
    >
      <div class="gp-head">
        <span>
          由 {{ genPreviewModel }} 生成 ·
          <b>{{ genPreviewKept.length }}</b> / {{ genPreviewRows.length }} 条将入库
        </span>
        <span v-if="genPreviewQuestions.length" class="gp-oq">
          另有 {{ genPreviewQuestions.length }} 项待确认，会一起存下来
        </span>
      </div>

      <div class="gp-list">
        <div v-for="row in genPreviewRows" :key="row._key" class="gp-item" :class="{ off: !row._keep }">
          <el-checkbox v-model="row._keep" class="gp-check" />
          <div class="gp-body">
            <div class="gp-title">
              <span class="gp-id">{{ row.case_id || row.caseId }}</span>
              <span class="gp-prio" :class="prioClass(row.priority)">{{ row.priority || 'P1' }}</span>
              <span v-if="row.type" class="gp-type">{{ row.type }}</span>
              <b>{{ row.title }}</b>
            </div>
            <div v-if="row.precondition" class="gp-line">
              <span class="gp-lab">前置</span>{{ row.precondition }}
            </div>
            <div v-if="(row.steps || []).length" class="gp-line">
              <span class="gp-lab">步骤</span>
              <span>
                <span v-for="(st, i) in row.steps" :key="i" class="gp-step">
                  {{ i + 1 }}. {{ st.action || st.step_desc || '' }}
                </span>
              </span>
            </div>
            <div v-if="row.expected_result || row.expectedResult" class="gp-line">
              <span class="gp-lab">预期</span>{{ row.expected_result || row.expectedResult }}
            </div>
          </div>
          <button type="button" class="gp-del" title="不要这条" @click="dropPreviewRow(row)">删除</button>
        </div>
      </div>

      <template #footer>
        <span class="gp-foot-tip">取消勾选＝这次不入库；删除＝直接从这批里去掉</span>
        <el-button @click="genPreviewVisible = false">全部丢弃</el-button>
        <el-button
          type="primary"
          :loading="genPreviewSaving"
          :disabled="!genPreviewKept.length"
          @click="confirmPreviewImport"
        >
          入库 {{ genPreviewKept.length }} 条
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchMetaVisible" :title="`批量修改 ${selectedIds.length} 条`" width="440px">
      <el-form label-width="80px">
        <el-form-item label="页面">
          <el-input v-model="batchMetaForm.pageName" placeholder="留空＝不改这一项" />
        </el-form-item>
        <el-form-item label="功能模块">
          <el-input v-model="batchMetaForm.module" placeholder="留空＝不改这一项" />
        </el-form-item>
        <el-form-item label="子功能">
          <el-input v-model="batchMetaForm.subModule" placeholder="留空＝不改这一项" />
        </el-form-item>
        <!--
          一个页面要么是原生要么是 H5，它下面的用例不会一条一个端。
          所以这一项几乎总是整批一起标——逐条标的话迟早标出不一致，
          而不一致的标记在甩锅时比没有更糟：对方会说「你们自己标的都对不上」
        -->
        <el-form-item label="涉及端">
          <el-select
            v-model="batchMetaForm.sides"
            multiple
            placeholder="留空＝不改这一项"
            style="width: 100%"
          >
            <el-option v-for="sd in sideOptions" :key="sd.code" :label="sd.label" :value="sd.code" />
          </el-select>
          <el-select
            v-if="genForm.sides.includes('SERVER')"
            v-model="genForm.serverService"
            filterable
            allow-create
            clearable
            default-first-option
            placeholder="后端服务（选已登记的，或直接输）"
            style="width: 100%; margin-top: 8px"
          >
            <el-option v-for="p in serviceOptions" :key="p.code" :label="p.code" :value="p.code" />
          </el-select>
        </el-form-item>
        <!--
          一批用例往往是同一个决定：这个需求整块都不做自动化。
          一条条开关十几次，和刚才改页面是同一种重复劳动
        -->
        <el-form-item label="自动化">
          <el-select v-model="batchMetaForm.automationAdvice" style="width: 100%">
            <el-option label="不改这一项" value="" />
            <el-option label="要做自动化（清空为尚未评估）" value="__CLEAR__" />
            <el-option label="不做自动化" value="NOT_RECOMMENDED" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="edit-hint" style="padding: 0 12px 4px">
        只改填了的那几项，留空的保持原样——不然想改页面会把模块一起清空。
      </div>
      <template #footer>
        <el-button @click="batchMetaVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchMetaSaving" @click="submitBatchMeta">
          改这 {{ selectedIds.length }} 条
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newVersionVisible" title="新建版本" width="460px">
      <el-form label-width="90px">
        <el-form-item label="版本名称" required>
          <el-input v-model="newVersionForm.releaseLabel" placeholder="如 9.3 国内客户端" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="newVersionForm.appVersion" placeholder="如 4.1.5（可留空）" />
        </el-form-item>
        <el-form-item label="产品线">
          <el-input v-model="newVersionForm.productLine" placeholder="国内客户端 / 海外客户端（可留空）" />
        </el-form-item>
      </el-form>
      <div class="edit-hint" style="padding: 0 12px 4px">
        名称里带上日期（如「9.3 国内客户端」）会自动解析出上线日。
        这个版本和「版本需求归档」是同一份数据，那边同步过来的版本这里也能直接选。
      </div>
      <template #footer>
        <el-button @click="newVersionVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNewVersion">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newIssueVisible" title="给这一版加需求单" width="460px">
      <el-form label-width="90px">
        <el-form-item label="版本">
          <span>{{ filterVersion }}</span>
        </el-form-item>
        <el-form-item label="单号" required>
          <el-input v-model="newIssueForm.issueKey" placeholder="如 APP-8873" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="newIssueForm.summary" placeholder="如 ios灵动岛优化（可留空）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newIssueVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNewIssue">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addEpVisible" title="手动补接口" width="480px" destroy-on-close @closed="resetAddEpForm">
      <el-form label-width="72px" @submit.prevent="submitAddEp">
        <el-form-item label="需求单">
          <span>{{ addEpForReq || '—' }}</span>
        </el-form-item>
        <el-form-item label="方法" required>
          <el-select v-model="newEp.httpMethod" style="width: 120px">
            <el-option v-for="m in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目">
          <el-select
            v-model="newEp.project"
            filterable
            clearable
            placeholder="可选；/gld/…、/appdatacenter/… 会自动识别"
            style="width: 100%"
            @change="newEpProjectManual = true"
          >
            <el-option v-for="p in serviceOptions" :key="p.code" :label="p.code" :value="p.code" />
          </el-select>
          <p v-if="inferredEpProject && !newEp.project" class="gen-ep-hint">
            将按路径识别为 <b>{{ inferredEpProject }}</b>
          </p>
        </el-form-item>
        <el-form-item label="路径" required>
          <el-input
            v-model="newEp.path"
            placeholder="如 /gld/deadlock/friend/list"
            @keyup.enter="submitAddEp"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="newEp.summary"
            placeholder="可留空，如 获取更新日志"
            @keyup.enter="submitAddEp"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addEpVisible = false">取消</el-button>
        <el-button type="primary" :loading="addEpSaving" @click="submitAddEp">补上</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="genEpVisible" title="生成接口用例" width="480px" destroy-on-close>
      <p class="gen-ep-tip">
        先选要归入的<b>用例集合</b>，再去接口清单逐条或批量生成。生成的用例会自动挂进这个集合，方便按单号跑回归。
      </p>
      <el-form label-width="72px">
        <el-form-item label="需求单">
          <span>{{ genEpForm.requirementNo || '—' }}</span>
        </el-form-item>
        <el-form-item label="集合" required>
          <el-radio-group v-model="genEpForm.mode" class="gen-ep-mode">
            <el-radio value="existing">选已有集合</el-radio>
            <el-radio value="new">新建集合</el-radio>
          </el-radio-group>
          <el-cascader
            v-if="genEpForm.mode === 'existing'"
            v-model="genEpCascade"
            :options="genEpCascadeOptions"
            :props="{ expandTrigger: 'hover', emitPath: true, disabled: 'disabled' }"
            placeholder="先选项目，再选测试集合（无集合的项目不可选）"
            style="width: 100%; margin-top: 8px"
            filterable
            clearable
            :loading="genEpCollectionsLoading"
            @change="onGenEpCascadeChange"
          />
          <p v-if="genEpForm.mode === 'existing' && genEpCascadeOptions.length" class="gen-ep-hint">
            共 {{ genEpProjectWithCollectionsCount }} 个项目有测试集合；
            {{ genEpCascadeOptions.length - genEpProjectWithCollectionsCount }} 个暂无集合（需先在建或选「新建集合」）
          </p>
          <p
            v-if="genEpForm.mode === 'existing' && !genEpCollectionsLoading && !genEpProjectWithCollectionsCount"
            class="gen-ep-empty"
          >
            暂无测试集合。请先在「用例集合 · 测试环境」里手动创建，或选「新建集合」。
          </p>
          <template v-if="genEpForm.mode === 'new'">
            <el-select
              v-model="genEpForm.project"
              placeholder="归属项目"
              style="width: 100%; margin-top: 8px"
            >
              <el-option
                v-for="p in genEpProjectOptions"
                :key="p.code"
                :label="p.name || p.code"
                :value="p.code"
              />
            </el-select>
            <el-input
              v-model="genEpForm.newName"
              placeholder="如 APP-8999-接口"
              style="margin-top: 8px"
            />
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genEpVisible = false">取消</el-button>
        <el-button type="primary" :loading="genEpSaving" @click="submitGenEp">去接口清单生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="waiveVisible" title="豁免（需写原因）" width="460px" destroy-on-close>
      <el-form label-width="72px">
        <el-form-item label="需求单">
          <span>{{ waiveForm.requirementNo }}</span>
        </el-form-item>
        <el-form-item label="端">
          <span>{{ waiveDimensionLabel(waiveForm.dimension) }}</span>
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input
            v-model="waiveForm.reason"
            type="textarea"
            :rows="3"
            placeholder="如：H5 与安卓同逻辑，跟测客户端；接口复用 9.2 集合已跑绿"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="waiveVisible = false">取消</el-button>
        <el-button type="primary" :loading="waiveSaving" @click="submitWaive">确认豁免</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="genVisible" title="生成测试用例" width="720px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="素材类型">
          <el-radio-group v-model="genForm.materialKind">
            <el-radio-button value="PAGE_SHOT">APP 页面截图</el-radio-button>
            <el-radio-button value="REQUIREMENT_DOC">需求文档</el-radio-button>
          </el-radio-group>
          <div class="edit-hint" style="width: 100%">
            {{
              genForm.materialKind === 'REQUIREMENT_DOC'
                ? '按需求条款出用例，并把文档里自相矛盾、边界没定义的地方单独挑出来给你去问产品。'
                : '按截图上真实存在的控件出用例，不会臆造图上没有的入口。'
            }}
          </div>
        </el-form-item>
        <div class="edit-row">
          <el-form-item label="页面/模块" class="edit-col" required>
            <el-input v-model="genForm.pageName" placeholder="如 登录页、赛事详情" />
          </el-form-item>
          <!--
            版本只在版本迭代集里要：其余集合是长期沉淀的功能用例，不属于某一版
          -->
          <el-form-item v-if="suite.byVersion" label="版本" class="edit-col" required>
            <!--
              版本只能从归档里选，不给 allow-create。
              带上它的话，输入「9.3」想选「9.3 国内客户端」，回车却会创建一个叫「9.3」的野版本——
              而野版本没有归档，单号下拉随即变空，用例就挂到了一个不存在的版本上。
              要建新版本有「+ 新建版本」，那是一个需要明确决定的动作
            -->
            <el-select
              v-model="genForm.appVersion"
              placeholder="从下拉里选，没有就先「+ 新建版本」"
              filterable
              style="width: 100%"
              @change="onGenVersionChange"
            >
              <el-option v-for="v in versionOptions" :key="v.version" :label="v.version" :value="v.version" />
            </el-select>
          </el-form-item>
        </div>
        <!--
          单号必填：一次生成对应的就是一个需求单。不填的话这批用例挂在版本上但不知道属于哪个单子，
          而提测时要回答的恰恰是「这个单子测完了没有」
        -->
        <el-form-item v-if="suite.byVersion" label="需求单号" required>
          <el-select
            v-model="genForm.requirementNo"
            placeholder="如 APP-8873"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option
              v-for="r in genRequirementOptions"
              :key="r.issueKey"
              :label="r.label"
              :value="r.issueKey"
            />
          </el-select>
          <div class="edit-hint" style="width: 100%">
            下拉里是这一版归档过的单子；没有的话直接输入单号回车也能建。
          </div>
        </el-form-item>
        <el-form-item :label="genForm.materialKind === 'REQUIREMENT_DOC' ? '需求文档' : 'APP 截图'">
          <div class="gen-shot-wrap">
            <el-upload
              v-model:file-list="genFiles"
              class="gen-shot-upload"
              drag
              :auto-upload="false"
              accept="image/*"
              multiple
              list-type="picture"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                {{ genForm.materialKind === 'REQUIREMENT_DOC' ? '将需求文档截图拖到此处' : '将截图拖到此处' }}，或
                <em>点击上传</em>
              </div>
            </el-upload>
            <div class="edit-hint">
              {{
                genForm.materialKind === 'REQUIREMENT_DOC'
                  ? '支持拖拽与点击选择，可多张（原始需求 + 后续优化一起给——两份之间的矛盾正是要挑出来的东西）。'
                  : '支持拖拽与点击选择，可多张（一个页面的正常态 + 异常态一起给，生成的用例更全）。'
              }}
              不用再传到公网，图片由后端转发。
            </div>
          </div>
        </el-form-item>
        <!--
          层级让人填一次、整批共用：一张截图基本就是一个页面，这批用例的模块是同一个。
          生成器只管枚举「该测什么」——归类它不擅长，而逐条补四级是最耗人的部分。
        -->
        <el-form-item v-if="suite.byVersion" label="涉及端">
          <el-select
            v-model="genForm.sides"
            multiple
            placeholder="客户端 / H5 / 后端 / 管理后台（整批共用）"
            style="width: 100%"
          >
            <el-option v-for="sd in sideOptions" :key="sd.code" :label="sd.label" :value="sd.code" />
          </el-select>
        </el-form-item>
        <div class="edit-row">
          <el-form-item label="功能模块" class="edit-col">
            <el-input v-model="genForm.module" placeholder="整批共用，如 账号" />
          </el-form-item>
          <el-form-item label="子功能" class="edit-col">
            <el-input v-model="genForm.subModule" placeholder="整批共用，如 验证码登录" />
          </el-form-item>
        </div>
        <el-form-item label="需求说明">
          <el-input
            v-model="genForm.requirements"
            type="textarea"
            :rows="5"
            placeholder="粘贴需求摘要（可含 Java / H5 / 客户端等多端说明）"
          />
        </el-form-item>
        <el-form-item label="元素 JSON">
          <el-input
            v-model="genForm.elementsText"
            type="textarea"
            :rows="6"
            placeholder="可选。有 Appium 元素可粘贴；仅需求文档时可留空"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" @click="runGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="epGenVisible" title="生成这条接口的用例" width="560px" destroy-on-close>
      <div v-if="genEp" class="gen-target">
        <span class="req-ep-m" :class="'m-' + (genEp.httpMethod || '').toLowerCase()">
          {{ genEp.httpMethod }}
        </span>
        <span class="req-ep-p">{{ genEp.path }}</span>
      </div>
      <el-form label-width="96px" style="margin-top: 14px">
        <el-form-item label="归入集合">
          <el-select
            v-model="genCollectionId"
            filterable
            clearable
            style="width: 100%"
            :placeholder="genDefaultName ? `默认新建：${genDefaultName}` : '默认按需求单新建'"
          >
            <el-option
              v-for="c in genCollections"
              :key="c.id"
              :label="`${c.name}${c.caseCount ? '（' + c.caseCount + ' 条）' : ''}`"
              :value="c.id"
            />
          </el-select>
          <div class="gen-hint">
            留空就<b>按需求单自动找或新建</b>一个测试集合，不用从二十几个项目的树里翻。
            <br />
            一单一集合不只是省事：<b>「本单上线」是按需求单整批归档的</b> ——
            接口散在好几个集合里，那一步就归不干净，测完的东西会继续挂在测试视图里。
          </div>
        </el-form-item>
        <el-form-item label="关联">
          <div class="gen-rel">
            <el-tag v-if="genEp?.requirementNo" size="small" type="primary" effect="plain">
              需求单 {{ genEp.requirementNo }}
            </el-tag>
            <el-tag v-if="genEp?.sourceBranch" size="small" effect="plain">
              分支 {{ genEp.sourceBranch }}
            </el-tag>
            <el-tag v-if="genAppVersion" size="small" type="info" effect="plain">
              {{ genAppVersion }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="生成的是骨架：请求 + 状态码断言，默认停用"
        style="margin-top: 4px"
      >
        <div style="font-size: 12.5px; line-height: 1.8">
          业务断言（「关注后列表应该多一条」）生成不了，要你补。
          补完在接口清单点「还差什么」能看到就绪状态，再启用就进覆盖率。
          用例落在 <b>测试环境</b>，不会跟着线上回归一起跑。
        </div>
      </el-alert>
      <template #footer>
        <el-button @click="epGenVisible = false">取消</el-button>
        <el-button type="primary" :loading="genSaving" @click="doGenCase">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, FolderOpened, InfoFilled, UploadFilled } from '@element-plus/icons-vue'
import { apiClient, type AiTestCaseDto, type AiTestCaseStep } from '../api'
import { findTestCaseSuite, TEST_CASE_SUITES } from '../constants/testCaseSuites'

const route = useRoute()
const router = useRouter()
const categoryKey = computed(() => String(route.params.category || route.query.category || '').trim())
const suite = computed(() => findTestCaseSuite(categoryKey.value) || TEST_CASE_SUITES[0])
const suiteTitle = computed(() => suite.value.title)

const loading = ref(false)
const list = ref<AiTestCaseDto[]>([])
/** 版本迭代集一次拉全量，供左侧树分组 */
const browseCases = ref<AiTestCaseDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const browseTreeRef = ref<any>(null)
const selectedBrowse = ref<BrowseNode | null>(null)
const browseEndpoints = ref<Array<Record<string, any>>>([])
const browseEndpointsLoading = ref(false)

const filterRequirement = ref('')
const filterSide = ref('')
const sideOptions = ref<Array<{ code: string; label: string; hint: string }>>([])
/** 后端服务候选：项目管理里已登记的那些，不用另建一份 */
const serviceOptions = ref<Array<{ code: string; name?: string }>>([])
/** 当前展开查看接口的那个需求单 */
const reqEndpointsOf = ref('')
const reqEndpoints = ref<Array<Record<string, any>>>([])
const reqEndpointsLoading = ref(false)
const reqEndpointCounts = ref<Record<string, number>>({})
const reqCoverageMap = ref<Record<string, any>>({})
const coveragePanelOf = ref('')
const waiveVisible = ref(false)
const waiveSaving = ref(false)
const waiveForm = reactive({ requirementNo: '', dimension: '', reason: '' })
/** 归档里的版本（手动建或从 Wiki 同步的），和「用例里出现过的版本」合并显示 */
const archives = ref<any[]>([])
const requirementOptions = ref<Array<{ issueKey: string; label: string }>>([])
const newVersionVisible = ref(false)
const newVersionForm = reactive({ releaseLabel: '', appVersion: '', productLine: '' })
const newIssueVisible = ref(false)
const newIssueForm = reactive({ issueKey: '', summary: '' })
const openQuestions = ref<Array<Record<string, any>>>([])
const oqOpen = ref(true)
const filterVersion = ref('')
const versionOptions = ref<Array<{ version: string; count: number }>>([])
const filterPageName = ref('')
const filterKeyword = ref('')

/**
 * 搜索要回到第 1 页。
 * 停在第 3 页搜一个只有两条结果的词会得到一个空列表——
 * 人第一反应是「搜不到」，而不是「我还在第 3 页」。
 */
function onSearch() {
  page.value = 1
  loadList()
}
const filterPriority = ref('')
const filterStatus = ref('')
const filterAdvice = ref('')
const filterModule = ref('')

/** ONLINE | TESTING — 设计规范双轨 Tab（API 仍用 releaseStage） */
const releaseTab = ref<'ONLINE' | 'TESTING'>('TESTING')
const onlineCount = ref(0)
const testingCount = ref(0)
const selectedId = ref<number | null>(null)
const selectedIds = ref<number[]>([])
const promoting = ref(false)
const drawerVisible = ref(false)
const isNarrow = ref(false)
const detailOpen = ref(false)
const DETAIL_WIDTH_KEY = 'ai-cases-detail-width'
const detailWidth = ref(loadDetailWidth())
const resizing = ref(false)

function loadDetailWidth() {
  try {
    const n = Number(localStorage.getItem(DETAIL_WIDTH_KEY))
    if (Number.isFinite(n) && n >= 320 && n <= 800) return n
  } catch {
    /* ignore */
  }
  return 408
}

function startResize(e: MouseEvent) {
  resizing.value = true
  const startX = e.clientX
  const startW = detailWidth.value
  const onMove = (ev: MouseEvent) => {
    // 向左拖 → 详情变宽；向右拖 → 详情变窄
    const next = Math.min(800, Math.max(320, startW + (startX - ev.clientX)))
    detailWidth.value = next
  }
  const onUp = () => {
    resizing.value = false
    try {
      localStorage.setItem(DETAIL_WIDTH_KEY, String(detailWidth.value))
    } catch {
      /* ignore */
    }
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 模块折叠：线上/测试独立记忆 */
const collapsedByTab = reactive({
  ONLINE: {} as Record<string, boolean>,
  TESTING: {} as Record<string, boolean>
})
const expandedRowIds = ref<number[]>([])

const genVisible = ref(false)
const genLoading = ref(false)
const genForm = reactive({
  // 不给默认值。原来默认「登录页」，人不改就整批用例都被标成登录页——
  // 而那是静默发生的，等发现时已经存了好几批
  pageName: '',
  // 版本迭代集里传的基本都是需求文档，默认选它，省掉每次都要切一次
  materialKind: 'PAGE_SHOT' as 'PAGE_SHOT' | 'REQUIREMENT_DOC',
  appVersion: '',
  requirementNo: '',
  sides: [] as string[],
  serverService: '',
  module: '',
  subModule: '',
  requirements: '',
  elementsText: ''
})

/** 本地截图，直接走后端上传转发，不用先传到公网 */
const genFiles = ref<any[]>([])

const displayPage = computed(() => {
  const filtered = filterPageName.value?.trim()
  if (filtered) return filtered

  const rows = filterModule.value
    ? list.value.filter((r) => String(r.module || '').trim() === filterModule.value)
    : list.value
  if (!rows.length) return '—'

  const counts = new Map<string, number>()
  for (const r of rows) {
    const n = String(r.pageName || '').trim()
    if (n) counts.set(n, (counts.get(n) || 0) + 1)
  }
  if (!counts.size) return '—'
  if (counts.size === 1) return [...counts.keys()][0]

  let best = ''
  let bestN = 0
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name
      bestN = n
    }
  }
  return best || '—'
})
const moduleOptions = computed(() => {
  const set = new Set<string>()
  for (const r of list.value) {
    const m = String(r.module || '').trim()
    if (m) set.add(m)
  }
  return [...set].sort()
})

const selectedCase = computed(() => {
  const pool = suite.value.byVersion ? browseCases.value : list.value
  return pool.find((r) => r.id === selectedId.value) || null
})

type SubGroup = { subModule: string; rows: AiTestCaseDto[] }
type ModuleGroup = { groupKey: string; module: string; count: number; coverage: number; subs: SubGroup[] }

type BrowseChannel = 'APP' | 'PWA' | 'WEB'
type BrowseNode = {
  nodeKey: string
  label: string
  isFolder: boolean
  meta?: number
  children?: BrowseNode[]
  channel?: BrowseChannel
  requirementNo?: string
  lang?: 'zh' | 'en'
}

const browseTreeProps = { label: 'label', children: 'children' }

function hasNativeClient(sides: string[]) {
  return sides.some((s) => s.startsWith('CLIENT_'))
}

/** 渠道：APP 原生 / PWA 内嵌 / 独立 WEB */
function channelOf(row: AiTestCaseDto): BrowseChannel {
  const ver = String(row.appVersion || '').toLowerCase()
  const sides = ((row as any).sides || []) as string[]
  if (ver.includes('web') || ver.includes('网站') || ver.includes('web站')) return 'WEB'
  if (ver.includes('pwa') || ver.includes('h5')) return 'PWA'
  if (sides.includes('H5') && !hasNativeClient(sides)) return 'PWA'
  return 'APP'
}

function isOverseasCase(row: AiTestCaseDto): boolean {
  const ver = String(row.appVersion || '')
  if (/海外|pog/i.test(ver)) return true
  if (/国内|电竞/i.test(ver)) return false
  const appId = String((row as any).appId || '')
  return appId.includes('OVERSEAS') || appId.includes('POG')
}

function langOfCase(row: AiTestCaseDto): 'zh' | 'en' {
  const t = String(row.title || '')
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (t.match(/[a-zA-Z]/g) || []).length
  return cjk >= latin ? 'zh' : 'en'
}

function reqGroupTitle(req: string, rows: AiTestCaseDto[]): string {
  if (req === '未归类') return '未归类'
  const names = new Map<string, number>()
  for (const r of rows) {
    const m = String(r.module || '').trim()
    if (m && m !== req && !m.includes(req)) names.set(m, (names.get(m) || 0) + 1)
  }
  let best = ''
  let bestN = 0
  for (const [m, n] of names) {
    if (n > bestN) {
      best = m
      bestN = n
    }
  }
  return best ? `${best} · ${req}` : req
}

function buildVersionTree(cases: AiTestCaseDto[], stage: 'TESTING' | 'ONLINE'): BrowseNode[] {
  const channels: BrowseChannel[] = ['APP', 'PWA', 'WEB']
  const root: BrowseNode[] = []
  for (const ch of channels) {
    const chCases = cases.filter((c) => channelOf(c) === ch)
    if (!chCases.length) continue
    const byReq = new Map<string, AiTestCaseDto[]>()
    for (const c of chCases) {
      const req = String((c as any).requirementNo || '').trim() || '未归类'
      if (!byReq.has(req)) byReq.set(req, [])
      byReq.get(req)!.push(c)
    }
    const chNode: BrowseNode = {
      nodeKey: `${stage}|${ch}`,
      label: ch,
      isFolder: true,
      children: []
    }
    for (const [req, rows] of [...byReq].sort((a, b) => a[0].localeCompare(b[0]))) {
      const overseas = rows.some(isOverseasCase)
      if (!overseas) {
        chNode.children!.push({
          nodeKey: `${stage}|${ch}|${req}`,
          label: reqGroupTitle(req, rows),
          isFolder: false,
          meta: rows.length,
          channel: ch,
          requirementNo: req
        })
        continue
      }
      const reqNode: BrowseNode = {
        nodeKey: `${stage}|${ch}|${req}|folder`,
        label: reqGroupTitle(req, rows),
        isFolder: true,
        meta: rows.length,
        channel: ch,
        requirementNo: req,
        children: []
      }
      for (const lang of ['zh', 'en'] as const) {
        const langRows = rows.filter((r) => langOfCase(r) === lang)
        if (!langRows.length) continue
        reqNode.children!.push({
          nodeKey: `${stage}|${ch}|${req}|${lang}`,
          label: lang === 'zh' ? '海外 · 中文' : '海外 · 英文',
          isFolder: false,
          meta: langRows.length,
          channel: ch,
          requirementNo: req,
          lang
        })
      }
      if (reqNode.children!.length) chNode.children!.push(reqNode)
    }
    if (chNode.children!.length) root.push(chNode)
  }
  return root
}

function browseChannelLabel(ch?: BrowseChannel) {
  if (ch === 'PWA') return 'PWA'
  if (ch === 'WEB') return 'WEB'
  return 'APP'
}

/** 版本集分组标题：按需求单聚合，功能名取组内最常见的 module */
function reqGroupLabel(rows: AiTestCaseDto[], groupKey: string): string {
  if (groupKey === '未归类') return '未归类'
  const names = new Map<string, number>()
  for (const row of rows) {
    const m = String(row.module || '').trim()
    if (m && m !== groupKey && !m.includes(groupKey)) {
      names.set(m, (names.get(m) || 0) + 1)
    }
  }
  let best = ''
  let bestN = 0
  for (const [m, n] of names) {
    if (n > bestN) {
      best = m
      bestN = n
    }
  }
  return best ? `${best} · ${groupKey}` : groupKey
}

/**
 * 分组。
 *
 * 版本迭代集下按<b>需求单</b>分：一个版本几十个单子，
 * 「这个单子测完了没有」是提测时唯一要回答的问题，所以条数和覆盖率必须挂在单号上。
 * 按功能模块分的话，十个单子的用例混在一个 DEADLOCK 底下，那个百分比谁也用不上。
 *
 * 其余集合是长期沉淀的功能用例，没有单号，仍按 模块 → 子功能 分。
 */
const moduleGroups = computed((): ModuleGroup[] => {
  const filtered = filterModule.value
    ? list.value.filter((r) => String(r.module || '').trim() === filterModule.value)
    : list.value

  if (suite.value.byVersion) {
    const byReq = new Map<string, AiTestCaseDto[]>()
    for (const row of filtered) {
      const reqNo = String((row as any).requirementNo || '').trim()
      const key = reqNo || '未归类'
      if (!byReq.has(key)) byReq.set(key, [])
      byReq.get(key)!.push(row)
    }
    return [...byReq].map(([groupKey, rows]) => ({
      groupKey,
      module: reqGroupLabel(rows, groupKey),
      count: rows.length,
      coverage: rows.length
        ? Math.round((rows.filter((r: any) => r?.automated).length / rows.length) * 100)
        : 0,
      // 只有一层，子分组留空——再套一层子功能就又要多点一次
      subs: [{ subModule: '', rows }]
    }))
  }

  const modMap = new Map<string, Map<string, AiTestCaseDto[]>>()
  for (const row of filtered) {
    const module = String(row.module || '').trim() || '未分类'
    const subModule = String(row.subModule || '').trim()
    if (!modMap.has(module)) modMap.set(module, new Map())
    const subMap = modMap.get(module)!
    if (!subMap.has(subModule)) subMap.set(subModule, [])
    subMap.get(subModule)!.push(row)
  }
  const out: ModuleGroup[] = []
  for (const [module, subMap] of modMap) {
    const subs: SubGroup[] = []
    let count = 0
    let auto = 0
    for (const [subModule, rows] of subMap) {
      subs.push({ subModule, rows })
      count += rows.length
      auto += rows.filter((r: any) => r?.automated).length
    }
    out.push({
      groupKey: module,
      module,
      count,
      coverage: count ? Math.round((auto / count) * 100) : 0,
      subs
    })
  }
  return out
})

const versionTree = computed(() => buildVersionTree(browseCases.value, releaseTab.value))

const selectedBrowseRequirement = computed(() => {
  const req = String(selectedBrowse.value?.requirementNo || '').trim()
  return req && req !== '未归类' ? req : ''
})

const visibleBrowseCases = computed(() => {
  const sel = selectedBrowse.value
  if (!sel || sel.isFolder) return []
  let rows = browseCases.value
  if (filterPageName.value) {
    rows = rows.filter((r) => String(r.pageName || '').includes(filterPageName.value))
  }
  if (filterPriority.value) rows = rows.filter((r) => r.priority === filterPriority.value)
  if (filterStatus.value) rows = rows.filter((r) => r.status === filterStatus.value)
  if (filterAdvice.value) rows = rows.filter((r) => (r as any).automationAdvice === filterAdvice.value)
  if (filterSide.value) {
    rows = rows.filter((r) => ((r as any).sides || []).includes(filterSide.value))
  }
  if (filterKeyword.value.trim()) {
    const kw = filterKeyword.value.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        String(r.title || '').toLowerCase().includes(kw) ||
        String(r.caseId || '').toLowerCase().includes(kw) ||
        String(r.testPoint || '').toLowerCase().includes(kw)
    )
  }
  rows = rows.filter((r) => channelOf(r) === sel.channel)
  const req = String((sel.requirementNo || '').trim() || '未归类')
  rows = rows.filter((r) => (String((r as any).requirementNo || '').trim() || '未归类') === req)
  if (sel.lang) rows = rows.filter((r) => langOfCase(r) === sel.lang)
  return rows
})

const navigationList = computed(() => (suite.value.byVersion ? visibleBrowseCases.value : list.value))
const selectedIndex = computed(() => navigationList.value.findIndex((r) => r.id === selectedId.value))
const prevCase = computed(() =>
  selectedIndex.value > 0 ? navigationList.value[selectedIndex.value - 1] : null
)
const nextCase = computed(() =>
  selectedIndex.value >= 0 && selectedIndex.value < navigationList.value.length - 1
    ? navigationList.value[selectedIndex.value + 1]
    : null
)

const automatedCount = computed(() => {
  const rows = suite.value.byVersion ? visibleBrowseCases.value : list.value
  return rows.filter((r: any) => r?.automated).length
})
const coverPercent = computed(() => {
  const rows = suite.value.byVersion ? visibleBrowseCases.value : list.value
  const n = rows.length
  if (!n) return 0
  return Math.min(100, Math.round((automatedCount.value / n) * 100))
})

const visibleIds = computed(() =>
  visibleBrowseCases.value.map((r) => r.id).filter((id): id is number => !!id)
)
const allVisibleSelected = computed(
  () => visibleIds.value.length > 0 && visibleIds.value.every((id) => selectedIds.value.includes(id))
)
const someVisibleSelected = computed(() =>
  visibleIds.value.some((id) => selectedIds.value.includes(id))
)

function onBrowseTreeClick(data: BrowseNode) {
  if (data.isFolder) return
  selectedBrowse.value = data
  loadBrowseEndpoints(data.requirementNo)
}

async function loadBrowseEndpoints(reqNo?: string) {
  const req = String(reqNo || '').trim()
  if (!req || req === '未归类') {
    browseEndpoints.value = []
    return
  }
  browseEndpointsLoading.value = true
  try {
    browseEndpoints.value = await apiClient.fetchRequirementEndpoints(req)
    if (!reqCoverageMap.value[req]) {
      reqCoverageMap.value[req] = await apiClient.fetchRequirementCoverage(req, suite.value.key)
    }
  } catch {
    browseEndpoints.value = []
  } finally {
    browseEndpointsLoading.value = false
  }
}

function findBrowseNode(nodes: BrowseNode[], nodeKey: string): BrowseNode | null {
  for (const n of nodes) {
    if (n.nodeKey === nodeKey) return n
    if (n.children?.length) {
      const found = findBrowseNode(n.children, nodeKey)
      if (found) return found
    }
  }
  return null
}

function autoSelectBrowseLeaf() {
  const prevKey = selectedBrowse.value?.nodeKey
  if (prevKey) {
    const kept = findBrowseNode(versionTree.value, prevKey)
    if (kept && !kept.isFolder) {
      selectedBrowse.value = kept
      browseTreeRef.value?.setCurrentKey?.(kept.nodeKey)
      loadBrowseEndpoints(kept.requirementNo)
      return
    }
  }
  const walk = (nodes: BrowseNode[]): BrowseNode | null => {
    for (const n of nodes) {
      if (!n.isFolder) return n
      if (n.children?.length) {
        const found = walk(n.children)
        if (found) return found
      }
    }
    return null
  }
  const first = walk(versionTree.value)
  if (!first) {
    selectedBrowse.value = null
    browseEndpoints.value = []
    return
  }
  selectedBrowse.value = first
  browseTreeRef.value?.setCurrentKey?.(first.nodeKey)
  loadBrowseEndpoints(first.requirementNo)
}

function onSelectAllVisibleChange(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  if (checked) {
    const merged = new Set([...selectedIds.value, ...visibleIds.value])
    selectedIds.value = [...merged]
  } else {
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.value.includes(id))
  }
}

const pageIds = computed(() => {
  if (suite.value.byVersion) return visibleIds.value
  return list.value.map((r) => r.id).filter((id): id is number => !!id)
})
const allPageSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selectedIds.value.includes(id))
)
const somePageSelected = computed(() => pageIds.value.some((id) => selectedIds.value.includes(id)))

function syncNarrow() {
  isNarrow.value = typeof window !== 'undefined' && window.innerWidth < 960
}

function isModuleCollapsed(module: string) {
  // 默认折叠；只有用户点开（显式设为 false）才展开
  return collapsedByTab[releaseTab.value][module] !== false
}
function expandModule(module: string) {
  if (!module) return
  collapsedByTab[releaseTab.value][module] = false
}
function toggleModule(module: string) {
  const bag = collapsedByTab[releaseTab.value]
  bag[module] = bag[module] === false
}
function isRowExpanded(id?: number | null) {
  return !!id && expandedRowIds.value.includes(id)
}
function toggleRowExpand(id?: number | null) {
  if (!id) return
  if (expandedRowIds.value.includes(id)) {
    expandedRowIds.value = expandedRowIds.value.filter((x) => x !== id)
  } else {
    expandedRowIds.value = [...expandedRowIds.value, id]
  }
}

function selectCase(row: AiTestCaseDto | null | undefined) {
  if (!row?.id) return
  selectedId.value = row.id
  detailOpen.value = true
  if (isNarrow.value) drawerVisible.value = true
}
function closeDetail() {
  detailOpen.value = false
  drawerVisible.value = false
}

function switchReleaseTab(tab: 'ONLINE' | 'TESTING') {
  if (releaseTab.value === tab) return
  releaseTab.value = tab
  page.value = 1
  selectedIds.value = []
  selectedId.value = null
  selectedBrowse.value = null
  detailOpen.value = false
  expandedRowIds.value = []
  loadList()
}

function toggleSelect(id: number, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  }
}

function toggleSelectAll(checked: boolean | string | number) {
  const on = !!checked
  if (on) {
    const set = new Set([...selectedIds.value, ...pageIds.value])
    selectedIds.value = [...set]
  } else {
    const drop = new Set(pageIds.value)
    selectedIds.value = selectedIds.value.filter((id) => !drop.has(id))
  }
}

function onSelectAllChange(e: Event) {
  toggleSelectAll((e.target as HTMLInputElement).checked)
}
function onRowCheckChange(id: number | undefined, e: Event) {
  if (!id) return
  toggleSelect(id, (e.target as HTMLInputElement).checked)
}

async function confirmPromote(rows: AiTestCaseDto[]) {
  const drafts = rows.filter((r) => r.status !== 'REVIEWED')
  const tip = drafts.length
    ? `选中 ${rows.length} 条中有 ${drafts.length} 条尚未复核，确认提升为线上版本？`
    : `确认将 ${rows.length} 条用例提升为线上版本？`
  try {
    await ElMessageBox.confirm(tip, '提升确认', {
      type: 'warning',
      confirmButtonText: '确认提升',
      cancelButtonText: '取消'
    })
    return true
  } catch {
    return false
  }
}

async function promoteOne(row: AiTestCaseDto | null | undefined) {
  if (!row?.id) return
  if (!(await confirmPromote([row]))) return
  promoting.value = true
  try {
    await apiClient.promoteAiTestCase(row.id)
    ElMessage.success(`已提升 ${row.caseId || row.id} 为线上`)
    selectedIds.value = selectedIds.value.filter((id) => id !== row.id)
    if (selectedId.value === row.id) closeDetail()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '提升失败')
  } finally {
    promoting.value = false
  }
}

async function promoteSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  const rows = list.value.filter((r) => r.id && ids.includes(r.id))
  if (!(await confirmPromote(rows))) return
  promoting.value = true
  try {
    const res = await apiClient.promoteAiTestCasesBatch(ids)
    if (res.failed?.length) {
      ElMessage.warning(`已提升 ${res.promoted} 条，${res.failed.length} 条失败`)
    } else {
      ElMessage.success(`已提升 ${res.promoted} 条为线上`)
    }
    selectedIds.value = []
    closeDetail()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '批量提升失败')
  } finally {
    promoting.value = false
  }
}

/**
 * 覆盖状态。三态而不是两态：
 * 「已覆盖」和「可能过期」必须分开——后者标记是绿的、覆盖的却是旧需求，
 * 混在一起等于把最该看的那种情况藏进了最不会被看的地方。
 */
function coverLabel(row: any) {
  if (row?.flowMissing) return '流程已删'
  if (row?.flowStale) return '可能过期'
  return row?.automated ? '已覆盖' : '未覆盖'
}

function coverClass(row: any) {
  if (row?.flowMissing) return 'is-missing'
  if (row?.flowStale) return 'is-stale'
  return row?.automated ? 'is-covered' : 'is-none'
}

function coverTip(row: any) {
  if (row?.flowMissing) return '关联的流程已被删除，这条用例实际上没有自动化了'
  if (row?.flowStale) return '关联之后用例内容又改过，流程可能还在验旧的期望结果。展开「更多」看详情'
  if (row?.automated) return `由流程「${row.flowName || ''}」覆盖`
  return '还没关联流程。适合自动化的话去流程编排里建一条，建的时候勾上这条用例'
}

function fmtTime(v?: string | null) {
  if (!v) return ''
  return String(v).replace('T', ' ').slice(0, 16)
}

function adviceShort(v?: string | null) {
  if (v === 'RECOMMENDED') return '建议'
  if (v === 'PARTIAL') return '部分'
  if (v === 'NOT_RECOMMENDED') return '不建议'
  return '—'
}

function sideLabel(code: string) {
  return sideOptions.value.find((s) => s.code === code)?.label || code
}

/** 分组里这批用例涉及的端（去重）。一个需求常常跨端，所以取并集而不是第一条的值 */
function groupSides(mod: ModuleGroup): string[] {
  const out: string[] = []
  for (const sub of mod.subs) {
    for (const row of sub.rows) {
      for (const sd of ((row as any).sides || []) as string[]) {
        if (!out.includes(sd)) out.push(sd)
      }
    }
  }
  return out
}

/** 分组对应的需求单号。标题是拼出来的字符串，取行里的真实值更稳 */
function groupRequirement(mod: ModuleGroup): string {
  return String((mod.subs[0]?.rows[0] as any)?.requirementNo || '')
}

const newEp = reactive({ httpMethod: 'GET', path: '', summary: '', project: '' })
const newEpProjectManual = ref(false)

function inferProjectFromPath(path: string): string {
  const p = path.trim().toLowerCase()
  if (p.startsWith('/gld/') || p.includes('/deadlock/')) return 'app-global-data'
  if (p.startsWith('/appdatacenter/')) return 'app-data-center'
  return ''
}

const inferredEpProject = computed(() => inferProjectFromPath(newEp.path))

watch(() => newEp.path, () => {
  const inferred = inferProjectFromPath(newEp.path)
  if (inferred && !newEpProjectManual.value) {
    newEp.project = inferred
  }
})







const addEpVisible = ref(false)
const addEpForReq = ref('')
const addEpSaving = ref(false)

const genEpVisible = ref(false)
const genEpSaving = ref(false)
const genEpCollectionsLoading = ref(false)
const genEpCascadeOptions = ref<Array<{ value: string; label: string; children?: Array<{ value: string; label: string }> }>>([])
const genEpCascade = ref<string[]>([])
const genEpProjectOptions = ref<Array<{ code: string; name?: string }>>([])

const genEpProjectWithCollectionsCount = computed(
  () => genEpCascadeOptions.value.filter((o) => o.children && o.children.length > 0).length
)
const genEpForm = reactive({
  requirementNo: '',
  project: 'data-center',
  mode: 'existing' as 'existing' | 'new',
  collectionId: '',
  newName: ''
})

function reqEndpointCount(reqNo: string): number {
  return reqEndpointCounts.value[reqNo] ?? 0
}

function reqEndpointLinkLabel(reqNo: string): string {
  if (reqEndpointsOf.value === reqNo) return '收起'
  const n = reqEndpointCount(reqNo)
  return n > 0 ? `涉及接口 · ${n}` : '涉及接口'
}

function setReqEndpointCount(reqNo: string, total: number) {
  if (!reqNo) return
  reqEndpointCounts.value = { ...reqEndpointCounts.value, [reqNo]: total }
}

async function loadReqEndpointCounts() {
  if (!suite.value.byVersion) return
  try {
    const rows = await apiClient.fetchRequirementEndpointCounts()
    const next: Record<string, number> = {}
    for (const row of rows || []) {
      const key = String(row.requirementNo || '').trim()
      if (!key) continue
      next[key] = Number(row.total) || 0
    }
    reqEndpointCounts.value = next
  } catch {
    // 数量拿不到不影响用例列表
  }
}

async function loadReqCoverages() {
  if (!suite.value.byVersion) return
  const reqs = new Set<string>()
  if (suite.value.byVersion) {
    for (const mod of moduleGroups.value) {
      const r = groupRequirement(mod)
      if (r) reqs.add(r)
    }
    for (const n of versionTree.value) {
      const walk = (nodes: BrowseNode[]) => {
        for (const x of nodes) {
          if (x.requirementNo && x.requirementNo !== '未归类') reqs.add(x.requirementNo)
          if (x.children) walk(x.children)
        }
      }
      walk([n])
    }
  }
  const next = { ...reqCoverageMap.value }
  await Promise.all(
    [...reqs].map(async (reqNo) => {
      try {
        next[reqNo] = await apiClient.fetchRequirementCoverage(reqNo, suite.value.key)
      } catch {
        delete next[reqNo]
      }
    })
  )
  reqCoverageMap.value = next
}

function coverageOf(reqNo: string) {
  return reqCoverageMap.value[reqNo]
}

/** 待办面板：只放硬阻塞（接口缺用例、功能缺 P0、已豁免可取消），复核进度只在顶栏标签看 */
function coverageTodos(reqNo: string) {
  const dims = coverageOf(reqNo)?.dimensions as Array<Record<string, any>> | undefined
  if (!dims?.length) return []
  return dims.filter((d) => {
    if (d.status === 'WAIVED') return true
    if (d.key === 'SERVER') return d.status !== 'GREEN'
    return d.status === 'RED'
  })
}

function toggleCoveragePanel(reqNo: string) {
  if (!reqNo) return
  const mod = moduleGroups.value.find((m) => groupRequirement(m) === reqNo)
  if (mod) expandModule(mod.groupKey)
  coveragePanelOf.value = coveragePanelOf.value === reqNo ? '' : reqNo
}

function openReqEndpoints(reqNo: string) {
  if (!reqNo) return
  const mod = moduleGroups.value.find((m) => groupRequirement(m) === reqNo)
  if (mod) expandModule(mod.groupKey)
  coveragePanelOf.value = reqNo
  if (reqEndpointsOf.value !== reqNo) {
    toggleReqEndpoints(reqNo)
  }
}

async function loadGenEpProjectOptions() {
  try {
    genEpProjectOptions.value = await apiClient.getApiProjects({ enabledOnly: true, catalogOnly: true })
  } catch {
    genEpProjectOptions.value = serviceOptions.value
  }
}

async function loadGenEpCascadeOptions() {
  genEpCollectionsLoading.value = true
  try {
    const res = await apiClient.getApiTestPickableTree({
      requirementNo: genEpForm.requirementNo || undefined,
      appVersion: filterVersion.value || undefined
    })
    genEpCascadeOptions.value = res.options || []
  } catch (e: any) {
    genEpCascadeOptions.value = []
    ElMessage.error(e?.message || '加载测试集合失败')
  } finally {
    genEpCollectionsLoading.value = false
  }
}

function onGenEpCascadeChange(val: string[] | null) {
  if (val && val.length >= 2) {
    genEpForm.project = val[0]
    genEpForm.collectionId = val[1]
  } else {
    genEpForm.collectionId = ''
  }
}

function pickDefaultCascade(fromProject?: string): string[] {
  const proj = ApiAppCatalog_normalizeProject(fromProject)
  if (proj) {
    const node = genEpCascadeOptions.value.find((o) => o.value === proj)
    if (node?.children?.length) {
      const byReq = node.children.find((c) =>
        genEpForm.requirementNo && c.label.toUpperCase().includes(genEpForm.requirementNo.toUpperCase())
      )
      const pick = byReq || node.children[0]
      return [node.value, pick.value]
    }
  }
  const first = genEpCascadeOptions.value[0]
  if (first?.children?.length) {
    return [first.value, first.children[0].value]
  }
  return []
}

/** 与后端 treeProjectKey 对齐的轻量归一（仅对话框默认选中用） */
function ApiAppCatalog_normalizeProject(code?: string): string {
  if (!code) return ''
  const raw = code.trim()
  if (raw.startsWith('app-') || raw.startsWith('app_')) return raw.replace(/^app_/, 'app-').toLowerCase()
  if (raw === 'data-center') return 'app-data-center'
  return raw.startsWith('app-') ? raw : `app-${raw}`
}

async function openGenEpDialog(reqNo: string) {
  if (!reqNo) return
  if (reqEndpointsOf.value !== reqNo) {
    await toggleReqEndpoints(reqNo)
  }
  await loadGenEpProjectOptions()
  const fromEp = reqEndpoints.value.find((e) => String(e.project || '').trim())?.project
  const fromCase = groupService(
    moduleGroups.value.find((m) => groupRequirement(m) === reqNo) || {
      groupKey: '',
      module: '',
      count: 0,
      coverage: 0,
      subs: []
    }
  )
    .split('/')
    .map((s) => s.trim())
    .find(Boolean)
  const fallback = genEpProjectOptions.value[0]?.code || 'data-center'
  genEpForm.requirementNo = reqNo
  genEpForm.project = String(fromEp || fromCase || fallback).trim()
  genEpForm.mode = 'existing'
  genEpForm.newName = `${reqNo}-接口`
  genEpForm.collectionId = ''
  genEpCascade.value = []
  await loadGenEpCascadeOptions()
  genEpCascade.value = pickDefaultCascade(genEpForm.project)
  onGenEpCascadeChange(genEpCascade.value.length ? genEpCascade.value : null)
  genEpVisible.value = true
}

async function releaseRequirementApi(reqNo: string) {
  if (!reqNo) return
  try {
    await ElMessageBox.confirm(
      `确认 ${reqNo} 已上线？将归档测试集合与「涉及接口」，默认不再展示（记录保留）。`,
      '本单已上线',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    const r = await apiClient.releaseApiTestRequirement(reqNo)
    ElMessage.success(`已归档 ${r.collectionsArchived} 个集合、${r.endpointsArchived} 条涉及接口`)
    if (reqEndpointsOf.value === reqNo) {
      reqEndpointsOf.value = ''
      reqEndpoints.value = []
    }
    await loadReqEndpointCounts()
    await loadReqCoverages()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function submitGenEp() {
  if (!genEpForm.requirementNo) return
  genEpSaving.value = true
  try {
    let collectionId = genEpForm.collectionId
    if (genEpForm.mode === 'new') {
      const name = genEpForm.newName.trim() || `${genEpForm.requirementNo}-接口`
      const created = await apiClient.createApiTestCollection({
        project: genEpForm.project,
        name,
        enabled: true,
        scope: 'TEST',
        requirementNo: genEpForm.requirementNo || undefined,
        sourceBranch: genEp.value?.sourceBranch || undefined,
        appVersion: filterVersion.value || undefined
      })
      collectionId = created.id
    } else if (!collectionId) {
      ElMessage.warning('请选择项目下的测试集合')
      return
    }
    genEpVisible.value = false
    router.push({
      path: '/api-endpoints',
      query: {
        project: genEpForm.project,
        requirementNo: genEpForm.requirementNo,
        collectionId
      }
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    genEpSaving.value = false
  }
}

function waiveDimensionLabel(key: string) {
  const map: Record<string, string> = {
    CLIENT: '客户端',
    H5: 'H5',
    SERVER: '后端接口',
    ADMIN: '管理后台'
  }
  return map[key] || key
}

function openWaive(reqNo: string, dimension: string) {
  waiveForm.requirementNo = reqNo
  waiveForm.dimension = dimension
  waiveForm.reason = ''
  waiveVisible.value = true
}

async function submitWaive() {
  if (!waiveForm.reason.trim()) {
    ElMessage.warning('请写豁免原因')
    return
  }
  waiveSaving.value = true
  try {
    await apiClient.waiveRequirementCoverage({
      requirementNo: waiveForm.requirementNo,
      dimension: waiveForm.dimension,
      reason: waiveForm.reason.trim()
    })
    waiveVisible.value = false
    ElMessage.success('已记录豁免')
    await loadReqCoverages()
  } catch (e: any) {
    ElMessage.error(e?.message || '豁免失败')
  } finally {
    waiveSaving.value = false
  }
}

async function clearWaive(reqNo: string, dimension: string) {
  try {
    await apiClient.clearRequirementCoverageWaiver(reqNo, dimension)
    ElMessage.success('已取消豁免')
    await loadReqCoverages()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

/**
 * 三种来源的证据强度不一样：
 * 抓包＝这个操作确实调了它（最硬）；分析＝这个分支确实改了它；手动＝我记得它会调（判断）。
 * 混成一种标记，就没法回答「这条链路是验过的还是想当然的」
 */
const SRC_LABEL: Record<string, string> = { CAPTURE: '抓包', MANUAL: '手动', SYNC: '分析' }

function srcOf(src?: string) {
  return (src || 'SYNC').toLowerCase()
}

function srcLabel(src?: string) {
  return SRC_LABEL[src || 'SYNC'] || src || '分析'
}

/** 分析来的那些接口来自哪个分支；全是手动补的时候返回空 */
function syncBranchOf(list: Array<Record<string, any>>): string {
  return list.find((e) => e.source === 'SYNC' && e.sourceBranch)?.sourceBranch || ''
}

function resetAddEpForm() {
  newEp.httpMethod = 'GET'
  newEp.path = ''
  newEp.summary = ''
  newEp.project = ''
  newEpProjectManual.value = false
  addEpForReq.value = ''
}

function openAddEpDialog(reqNo: string) {
  if (!reqNo) return
  addEpForReq.value = reqNo
  newEp.httpMethod = 'GET'
  newEp.path = ''
  newEp.summary = ''
  newEp.project = ''
  newEpProjectManual.value = false
  addEpVisible.value = true
}

async function submitAddEp() {
  if (!addEpForReq.value) return
  await addReqEndpoint(addEpForReq.value)
}

async function addReqEndpoint(reqNo: string) {
  if (!reqNo) return
  if (!newEp.path.trim()) {
    ElMessage.warning('请填接口路径')
    return
  }
  addEpSaving.value = true
  try {
    const project = newEp.project.trim() || inferredEpProject.value || undefined
    await apiClient.addRequirementEndpoint({
      requirementNo: reqNo,
      httpMethod: newEp.httpMethod,
      path: newEp.path.trim(),
      summary: newEp.summary.trim() || undefined,
      project
    })
    newEp.path = ''
    newEp.summary = ''
    reqEndpoints.value = await apiClient.fetchRequirementEndpoints(reqNo)
    setReqEndpointCount(reqNo, reqEndpoints.value.length)
    addEpVisible.value = false
    ElMessage.success('已补上')
    await loadReqCoverages()
  } catch (e: any) {
    ElMessage.error(e?.message || '添加失败')
  } finally {
    addEpSaving.value = false
  }
}

const epGenVisible = ref(false)
const genSaving = ref(false)
const genEp = ref<Record<string, any> | null>(null)
const genCollections = ref<any[]>([])
const genCollectionId = ref('')
const batchGenLoading = ref(false)
const batchGenReqNo = ref('')

/** 建集合时带上的版本标签，和当前筛选的版本一致 */
const genAppVersion = computed(() => filterVersion.value || genEp.value?.appVersion || '')

const genDefaultName = computed(() => {
  const ep = genEp.value
  if (!ep) return ''
  const base = ep.requirementNo || (ep.sourceBranch ? `${ep.sourceBranch} · 分支对比` : '未归类')
  return genAppVersion.value ? `${base} · ${genAppVersion.value}` : base
})

async function openGenCase(ep: Record<string, any>) {
  let row = ep
  if (!row.project && reqEndpointsOf.value) {
    reqEndpoints.value = await apiClient.fetchRequirementEndpoints(reqEndpointsOf.value)
    row = reqEndpoints.value.find((e) => e.id === ep.id) || ep
  }
  if (!row.project) {
    ElMessage.warning('这条接口还没归项目 —— 展开「涉及接口」会自动按路径补全；不行的话用「补上」选好项目')
    return
  }
  genEp.value = row
  genCollectionId.value = ''
  epGenVisible.value = true
  try {
    genCollections.value = await apiClient.getPickableCollections(
      row.project,
      row.requirementNo || reqEndpointsOf.value || undefined,
      genAppVersion.value || undefined
    )
  } catch {
    genCollections.value = []
  }
}

async function batchGenerateReqCases(reqNo: string) {
  if (!reqNo) return
  if (reqEndpointsOf.value !== reqNo) {
    await toggleReqEndpoints(reqNo)
  } else {
    reqEndpoints.value = await apiClient.fetchRequirementEndpoints(reqNo)
    setReqEndpointCount(reqNo, reqEndpoints.value.length)
  }
  const all = reqEndpoints.value
  const ready = all.filter((e) => e.id && e.project)
  const noProject = all.filter((e) => !e.project)
  if (noProject.length) {
    ElMessage.warning(`${noProject.length} 条接口还没归项目 —— 刷新展开后会自动补；仍缺的话用「补上」选好项目`)
  }
  if (!ready.length) {
    ElMessage.warning('没有可生成的接口')
    return
  }
  try {
    await ElMessageBox.confirm(
      `为 ${reqNo} 的 ${ready.length} 条涉及接口生成用例，并归入测试集合？\n\n` +
        '生成的是骨架用例（默认停用）。要在覆盖率里变绿，还需补业务断言或在项目管理配业务成功码后启用。',
      '一键生成接口用例',
      { confirmButtonText: '开始生成', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }
  batchGenReqNo.value = reqNo
  batchGenLoading.value = true
  let ok = 0
  let disabled = 0
  let failed = 0
  let lastErr = ''
  let collectionName = ''
  try {
    for (const ep of ready) {
      try {
        const r = await apiClient.generateCaseFromRequirementEndpoint(ep.id, {
          appVersion: genAppVersion.value || undefined,
          sourceBranch: ep.sourceBranch || undefined
        })
        ok += 1
        if (!r.caseEnabled) disabled += 1
        collectionName = r.collectionName || collectionName
      } catch (e: any) {
        failed += 1
        lastErr = e?.message || lastErr
      }
    }
    reqEndpoints.value = await apiClient.fetchRequirementEndpoints(reqNo)
    setReqEndpointCount(reqNo, reqEndpoints.value.length)
    await loadReqCoverages()
    if (ok && !failed) {
      ElMessage.success(
        disabled
          ? `已生成 ${ok} 条，归入「${collectionName}」。默认停用 —— 补断言并启用后覆盖率才会变绿。`
          : `已生成并启用 ${ok} 条，归入「${collectionName}」`
      )
    } else if (ok) {
      ElMessage.warning(`成功 ${ok} 条，失败 ${failed} 条${lastErr ? '：' + lastErr : ''}`)
    } else {
      ElMessage.error(lastErr || '生成失败，请确认项目已在「项目管理」建档')
    }
  } finally {
    batchGenLoading.value = false
    batchGenReqNo.value = ''
  }
}

async function doGenCase() {
  const ep = genEp.value
  if (!ep) return
  genSaving.value = true
  try {
    const r = await apiClient.generateCaseFromRequirementEndpoint(ep.id, {
      collectionId: genCollectionId.value || undefined,
      appVersion: genAppVersion.value || undefined,
      sourceBranch: ep.sourceBranch || undefined
    })
    ElMessage.success(
      `已生成「${r.caseName}」，归入${r.collectionCreated ? '新建的' : ''}集合「${r.collectionName}」` +
        (r.caseEnabled
          ? ''
          : '。用例默认停用 —— 补完业务断言并启用后，提测覆盖里的「接口 N/4」才会变绿')
    )
    epGenVisible.value = false
    // 刷新这一单的涉及接口和覆盖数字——生成完页面不动的话，人会以为没成
    if (ep.requirementNo || reqEndpointsOf.value) {
      reqEndpoints.value = await apiClient.fetchRequirementEndpoints(
        ep.requirementNo || reqEndpointsOf.value
      )
    }
    await loadReqCoverages()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    genSaving.value = false
  }
}

async function removeReqEndpoint(ep: Record<string, any>) {
  try {
    await apiClient.removeRequirementEndpoint(ep.id)
    reqEndpoints.value = reqEndpoints.value.filter((x) => x.id !== ep.id)
    if (reqEndpointsOf.value) {
      setReqEndpointCount(reqEndpointsOf.value, reqEndpoints.value.length)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '移除失败')
  }
}

async function toggleReqEndpoints(reqNo: string) {
  if (!reqNo) return
  if (reqEndpointsOf.value === reqNo) {
    reqEndpointsOf.value = ''
    return
  }
  const mod = moduleGroups.value.find((m) => groupRequirement(m) === reqNo)
  if (mod) expandModule(mod.groupKey)
  reqEndpointsOf.value = reqNo
  reqEndpointsLoading.value = true
  try {
    reqEndpoints.value = await apiClient.fetchRequirementEndpoints(reqNo)
    setReqEndpointCount(reqNo, reqEndpoints.value.length)
  } catch {
    reqEndpoints.value = []
  } finally {
    reqEndpointsLoading.value = false
  }
}

/** 这批用例涉及的后端服务（去重后拼一起） */
function groupService(mod: ModuleGroup): string {
  const out: string[] = []
  for (const sub of mod.subs) {
    for (const row of sub.rows) {
      const sv = String((row as any).serverService || '').trim()
      if (sv && !out.includes(sv)) out.push(sv)
    }
  }
  return out.join(' / ')
}

async function loadSides() {
  try {
    // 服务名直接用项目管理里登记的，不另建一份——两份清单迟早对不上
    serviceOptions.value = await apiClient.getApiProjects({ enabledOnly: true }).catch(() => [])
    sideOptions.value = await apiClient.fetchSides()
  } catch {
    // 拿不到端字典不该让页面打不开，只是标签显示成 code
    sideOptions.value = []
  }
}

function prioClass(p?: string) {
  if (p === 'P0') return 'p0'
  if (p === 'P1') return 'p1'
  return 'p2'
}
function statusLabel(s?: string) {
  if (s === 'REVIEWED') return '已复核'
  if (s === 'ARCHIVED') return '归档'
  return '草稿'
}
function statusChipClass(s?: string) {
  if (s === 'REVIEWED') return 'is-ok'
  if (s === 'ARCHIVED') return 'is-muted'
  return 'is-draft'
}
function runChipClass(st?: string) {
  if (st === 'COMPLETED') return 'is-ok'
  if (st === 'FAILED') return 'is-bad'
  if (st === 'RUNNING' || st === 'PENDING') return 'is-warn'
  return 'is-muted'
}
function adviceLabel(v?: string | null) {
  if (v === 'RECOMMENDED') return '建议自动化'
  if (v === 'PARTIAL') return '部分可自动'
  if (v === 'NOT_RECOMMENDED') return '不建议自动化'
  return '未评估'
}
function adviceChipClass(v?: string | null) {
  if (v === 'RECOMMENDED') return 'is-advice-yes'
  if (v === 'PARTIAL') return 'is-advice-partial'
  if (v === 'NOT_RECOMMENDED') return 'is-advice-no'
  return 'is-muted'
}
function adviceHint(v?: string | null) {
  if (v === 'RECOMMENDED') return '适合 UI 自动化：可点击、可稳定断言'
  if (v === 'PARTIAL') return '入口/关键路径可自动，视觉完整渲染建议人测'
  if (v === 'NOT_RECOMMENDED') return '偏视觉或断言不稳定，建议人测，不必挂流程'
  return '尚未评估是否适合 UI 自动化'
}
function statusTag(s?: string) {
  if (s === 'REVIEWED') return 'success'
  if (s === 'ARCHIVED') return 'info'
  return 'warning'
}
// ==================== 表格导入 ====================

const importVisible = ref(false)
const importText = ref('')
const importFileName = ref('')
const importRows = ref<any[]>([])
const importRaw = ref<any[]>([])
const importWarnings = ref<string[]>([])
const importError = ref('')
const importParsing = ref(false)
const importSaving = ref(false)

function openImport() {
  importText.value = ''
  importFileName.value = ''
  importRows.value = []
  importRaw.value = []
  importWarnings.value = []
  importError.value = ''
  importVisible.value = true
}

function applyParsed(res: { rows: any[]; raw: any[]; warnings: string[] }) {
  importRows.value = res.rows || []
  importRaw.value = res.raw || []
  importWarnings.value = res.warnings || []
  importError.value = ''
}

async function onPickFile(file: any) {
  const raw = file?.raw
  if (!raw) return
  importFileName.value = raw.name
  importParsing.value = true
  try {
    applyParsed(await apiClient.parseTestCaseSheet(raw))
  } catch (e: any) {
    importRows.value = []
    importError.value = e?.message || '解析失败'
  } finally {
    importParsing.value = false
  }
}

async function parseImportText() {
  if (!importText.value.trim()) return
  importParsing.value = true
  try {
    applyParsed(await apiClient.parseTestCaseText(importText.value))
  } catch (e: any) {
    importRows.value = []
    importError.value = e?.message || '解析失败'
  } finally {
    importParsing.value = false
  }
}

async function submitImport() {
  importSaving.value = true
  try {
    // 落库用 raw（后端解析出的实体），不用预览用的视图，免得来回转换丢字段
    const res = await apiClient.importTestCases(categoryKey.value, importRaw.value)
    if (res.failed?.length) {
      ElMessage.warning(`导入 ${res.imported} 条，${res.failed.length} 条失败：${res.failed[0]}`)
    } else {
      ElMessage.success(`已导入 ${res.imported} 条`)
    }
    importVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importSaving.value = false
  }
}

// ==================== 手工录入 / 编辑 ====================

const editVisible = ref(false)
const editSaving = ref(false)
const editingId = ref<number | null>(null)
const editingCaseId = ref('')
const flowOptions = ref<Array<{ id: string; name: string; platform?: string }>>([])

/**
 * 当前编辑的用例是哪个平台。
 * 单独放一个 ref 而不是塞进 editForm——editForm 会整体作为保存载荷，
 * 混一个只读的展示字段进去，迟早会在某次改动里被当成可编辑项一起提交
 */
const editingPlatform = ref('')

/** 再按用例平台收一道：两端用例是分开的两套，安卓用例挂 iOS 流程后端会直接拒 */
const linkableFlowOptions = computed(() => {
  const p = editingPlatform.value.trim()
  if (!p) return flowOptions.value
  return flowOptions.value.filter((f) => !f.platform || f.platform === p)
})

const editForm = reactive({
  pageName: '',
  sides: [] as string[],
  serverService: '',
  module: '',
  subModule: '',
  testItem: '',
  testPoint: '',
  title: '',
  priority: 'P1',
  type: '功能测试',
  precondition: '',
  steps: [] as Array<{ action: string; target: string; expected: string }>,
  expectedResult: '',
  flowId: '',
  automationAdvice: '' as '' | 'RECOMMENDED' | 'PARTIAL' | 'NOT_RECOMMENDED',
  releaseStage: 'TESTING' as 'TESTING' | 'ONLINE',
  remark: ''
})

/**
 * 「要做自动化」开关。
 *
 * 不另存一个字段，直接读写 automationAdvice——开关和下面那个「自动化建议」下拉
 * 管的是同一件事，各存一份状态迟早会对不上（下拉选了「不建议」而开关还开着）。
 *
 * 关掉＝不建议自动化；打开时如果原来是「不建议」，退回「尚未评估」而不是直接写成
 * 「建议自动化」——那是一个判断，不该由一次开关代替人做出。
 */
const editAutomate = computed({
  get: () => editForm.automationAdvice !== 'NOT_RECOMMENDED',
  set: (v: boolean) => {
    editForm.automationAdvice = v
      ? editForm.automationAdvice === 'NOT_RECOMMENDED'
        ? ''
        : editForm.automationAdvice
      : 'NOT_RECOMMENDED'
  }
})

const RUN_LABELS: Record<string, string> = {
  COMPLETED: '最近执行通过',
  FAILED: '最近执行失败',
  RUNNING: '正在执行',
  STOPPED: '已停止',
  SKIPPED: '已跳过',
  PENDING: '排队中'
}

function runLabel(st?: string) {
  if (!st) return '从未执行'
  return RUN_LABELS[st] || st
}

function runTag(st?: string) {
  if (st === 'COMPLETED') return 'success'
  if (st === 'FAILED') return 'danger'
  if (st === 'RUNNING' || st === 'PENDING') return 'warning'
  return 'info'
}

function formatTime(v: any) {
  if (!v) return ''
  try {
    return new Date(v).toLocaleString('zh-CN')
  } catch {
    return String(v)
  }
}

/**
 * 库里的步骤摊成可编辑的行。
 * <p>
 * 三列都要带上——早先这里只往返「操作 / 预期」，编辑一条 AI 生成的用例再保存，
 * 目标元素那一列就在路上被丢了，是实打实的数据丢失。
 */
function stepsToRows(steps: unknown) {
  return normalizeSteps(steps).map((st) => ({
    action: String(st.action || ''),
    target: String(st.target || ''),
    expected: String(st.expected || '')
  }))
}

function rowsToSteps(rows: Array<{ action: string; target: string; expected: string }>) {
  return rows
    .filter((r) => [r.action, r.target, r.expected].some((v) => String(v || '').trim()))
    .map((r, i) => ({
      step: i + 1,
      action: String(r.action || '').trim(),
      target: String(r.target || '').trim(),
      expected: String(r.expected || '').trim()
    }))
}

function addStepRow() {
  editForm.steps.push({ action: '', target: '', expected: '' })
}

function moveStepRow(idx: number, delta: number) {
  const to = idx + delta
  if (to < 0 || to >= editForm.steps.length) return
  const [item] = editForm.steps.splice(idx, 1)
  editForm.steps.splice(to, 0, item)
}

// 从 Excel / 飞书表格整块粘：复制单元格出来就是「行换行、列 Tab」
const pasteVisible = ref(false)
const pasteText = ref('')

function parsePasted(text: string) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split('\t')
      return {
        action: (cols[0] || '').trim(),
        target: (cols[1] || '').trim(),
        expected: (cols[2] || '').trim()
      }
    })
}

const pastePreviewCount = computed(() => parsePasted(pasteText.value).length)

function applyPaste() {
  const rows = parsePasted(pasteText.value)
  if (!rows.length) {
    ElMessage.warning('没解析出任何步骤')
    return
  }
  editForm.steps.push(...rows)
  pasteText.value = ''
  pasteVisible.value = false
  ElMessage.success(`已追加 ${rows.length} 步`)
}

/** 元素库：给「目标元素」做下拉，填的时候就对上，省掉事后映射 */
const elementOptions = ref<Array<{ nameEn: string; nameZh?: string }>>([])

async function loadElementOptions() {
  try {
    const rows = await apiClient.getUiElements({ catalogs: 'AUTOMATION,SHARED', size: 500 })
    const list = Array.isArray(rows) ? rows : (rows as any)?.content || []
    elementOptions.value = list
      .filter((e: any) => e?.nameEn)
      .map((e: any) => ({ nameEn: e.nameEn, nameZh: e.nameZh }))
  } catch {
    // 拉不到元素不影响录用例，自由输入照样能用
    elementOptions.value = []
  }
}

/**
 * 可关联的流程。
 *
 * 只列用途＝「仅自动化编排」的。回归和自动化是两条独立的轨：
 * 回归（含「回归 + 自动化编排」）验的是「这个包能不能用」，不对应任何一条用例。
 * 挂错了不报错，只会得到一个「已覆盖却从来没跑过」的绿标记——
 * 因为用例的执行状态只认自动化轨。后端保存时也拦一道，这里过滤只是别让人有机会选错。
 */
async function loadFlowOptions() {
  try {
    const rows = await apiClient.getUiFlows({})
    flowOptions.value = (Array.isArray(rows) ? rows : [])
      .filter((f: any) => f?.id && !f.isComponent)
      // 只要流程执行了这条用例的步骤就算覆盖，跟它进不进回归批次无关。
      // 排除的只有装包准备（不执行用例步骤）和仅性能测试（采资源曲线、不验功能）
      .filter((f: any) => f.catalog !== 'INSTALL' && f.catalog !== 'PERFORMANCE')
      .map((f: any) => ({ id: f.id, name: f.name || f.id, platform: f.platform || '' }))
  } catch {
    // 拉不到流程不该挡住录用例：关联留空即可，回头再挂
    flowOptions.value = []
  }
}

function openEdit(row: any | null) {
  editingId.value = row?.id ?? null
  editingCaseId.value = row?.caseId || ''
  Object.assign(editForm, {
    pageName: row?.pageName || '',
    sides: Array.isArray(row?.sides) ? [...row.sides] : [],
    serverService: row?.serverService || '',
    module: row?.module || '',
    subModule: row?.subModule || '',
    testItem: row?.testItem || '',
    testPoint: row?.testPoint || '',
    title: row?.title || '',
    priority: row?.priority || 'P1',
    // 性能分类下新建，默认就是性能测试——同一套用例字段服务所有分类，
    // 但默认值该跟着分类走，不然每条都要人手动改一次
    type: row?.type || (categoryKey.value === 'performance' ? '性能测试' : '功能测试'),
    precondition: row?.precondition || '',
    steps: row ? stepsToRows(row.steps) : [],
    expectedResult: row?.expectedResult || row?.expected_result || '',
    flowId: row?.flowId || '',
    automationAdvice: row?.automationAdvice || '',
    releaseStage: (row?.releaseStage as 'TESTING' | 'ONLINE') || releaseTab.value,
    remark: row?.remark || ''
  })
  editingPlatform.value = String(row?.platform || '').trim()
  editVisible.value = true
  loadFlowOptions()
  loadElementOptions()
}

async function submitEdit() {
  if (!editForm.title.trim()) {
    ElMessage.warning('请填写用例标题')
    return
  }
  const body: Record<string, unknown> = {
    category: categoryKey.value,
    pageName: editForm.pageName.trim() || null,
    // 空数组要发空串（清空），不能发 null——null 是「不改」
    sides: editForm.sides.join(','),
    serverService: editForm.serverService.trim(),
    module: editForm.module.trim() || null,
    subModule: editForm.subModule.trim() || null,
    testItem: editForm.testItem.trim() || null,
    testPoint: editForm.testPoint.trim() || null,
    title: editForm.title.trim(),
    priority: editForm.priority,
    type: editForm.type,
    precondition: editForm.precondition.trim() || null,
    stepsJson: JSON.stringify(rowsToSteps(editForm.steps)),
    expectedResult: editForm.expectedResult.trim() || null,
    // 空串＝解除关联；不传＝不动。这两种语义后端是分开处理的
    flowId: editForm.flowId || '',
    // 空串＝清空为未评估
    automationAdvice: editForm.automationAdvice || '',
    releaseStage: editForm.releaseStage || releaseTab.value,
    remark: editForm.remark.trim() || null
  }
  editSaving.value = true
  try {
    if (editingId.value) {
      await apiClient.updateAiTestCase(editingId.value, body)
      ElMessage.success('已更新')
    } else {
      await apiClient.createAiTestCase(body)
      ElMessage.success('已创建')
    }
    editVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    editSaving.value = false
  }
}

function normalizeSteps(steps: unknown): AiTestCaseStep[] {
  if (!Array.isArray(steps)) return []
  return steps.map((s: any, i) => ({
    step: s?.step ?? i + 1,
    action: s?.action ?? '',
    target: s?.target ?? '',
    expected: s?.expected ?? ''
  }))
}

async function loadList() {
  if (suite.value.byVersion) {
    await loadBrowseCases()
    return
  }
  loading.value = true
  try {
    const res = await apiClient.listAiTestCases({
      category: suite.value.key,
      pageName: filterPageName.value || undefined,
      priority: filterPriority.value || undefined,
      status: filterStatus.value || undefined,
      automationAdvice: filterAdvice.value || undefined,
      keyword: filterKeyword.value.trim() || undefined,
      releaseStage: releaseTab.value,
      appVersion: filterVersion.value || undefined,
      requirementNo: filterRequirement.value || undefined,
      side: filterSide.value || undefined,
      page: page.value,
      size: pageSize
    })
    list.value = res.content || []
    total.value = res.totalElements || 0
    onlineCount.value = res.onlineCount ?? onlineCount.value
    testingCount.value = res.testingCount ?? testingCount.value
    const still = list.value.some((r) => r.id === selectedId.value)
    if (!still) {
      selectedId.value = null
      detailOpen.value = false
      drawerVisible.value = false
    }
    selectedIds.value = selectedIds.value.filter((id) => list.value.some((r) => r.id === id))
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
    loadReqCoverages()
  }
}

async function loadBrowseCases() {
  loading.value = true
  try {
    const res = await apiClient.listAiTestCases({
      category: suite.value.key,
      pageName: filterPageName.value || undefined,
      priority: filterPriority.value || undefined,
      status: filterStatus.value || undefined,
      automationAdvice: filterAdvice.value || undefined,
      keyword: filterKeyword.value.trim() || undefined,
      releaseStage: releaseTab.value,
      appVersion: filterVersion.value || undefined,
      side: filterSide.value || undefined,
      page: 1,
      size: 5000
    })
    browseCases.value = res.content || []
    list.value = browseCases.value
    total.value = res.totalElements || browseCases.value.length
    onlineCount.value = res.onlineCount ?? onlineCount.value
    testingCount.value = res.testingCount ?? testingCount.value
    const still = browseCases.value.some((r) => r.id === selectedId.value)
    if (!still) {
      selectedId.value = null
      detailOpen.value = false
      drawerVisible.value = false
    }
    selectedIds.value = selectedIds.value.filter((id) => browseCases.value.some((r) => r.id === id))
    autoSelectBrowseLeaf()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
    loadReqCoverages()
  }
}

function resetFilters() {
  // 搜索框也要清。留着的话「重置」之后列表还是筛过的，
  // 人会以为重置坏了，或者以为用例真的少了那么多
  filterKeyword.value = ''
  filterPageName.value = ''
  filterPriority.value = ''
  filterStatus.value = ''
  filterAdvice.value = ''
  filterModule.value = ''
  page.value = 1
  loadList()
}

function openGenerate() {
  // 上次选的截图不该留到下一次——很容易在没注意的情况下拿旧图生成
  genFiles.value = []
  // 版本迭代集里传的基本都是需求文档；其他集合是照着页面写用例
  genForm.materialKind = suite.value.byVersion ? 'REQUIREMENT_DOC' : 'PAGE_SHOT'
  // 带入列表上已经筛好的版本和单号：你正看着 9.3 的 APP-8873 点「生成用例」，
  // 再让你把这两个重选一遍是纯粹的重复劳动，而且很容易选错版本
  if (suite.value.byVersion) {
    if (filterVersion.value) {
      genForm.appVersion = filterVersion.value
      loadGenRequirements()
    }
    if (filterRequirement.value) {
      genForm.requirementNo = filterRequirement.value
    }
  }
  genVisible.value = true
}

async function runGenerate() {
  if (!genForm.pageName.trim()) {
    ElMessage.warning('请填写页面名称')
    return
  }
  // 版本迭代集必须填版本：不填的话这批用例落进「无版本」，几周之后就分不出哪条属于哪版，
  // 而那正是建这个集合要解决的问题
  if (suite.value.byVersion && !genForm.appVersion.trim()) {
    ElMessage.warning('请选择版本，如 9.3 国内客户端')
    return
  }
  if (suite.value.byVersion && !genForm.requirementNo.trim()) {
    ElMessage.warning('请填写需求单号，如 APP-8873')
    return
  }
  const reqText = genForm.requirements.trim()
  let elements: Array<Record<string, any>> | undefined
  const raw = genForm.elementsText.trim()
  if (raw) {
    try {
      elements = JSON.parse(raw)
      if (!Array.isArray(elements) || !elements.length) elements = undefined
    } catch (e: any) {
      ElMessage.error('元素 JSON 无效：' + (e?.message || e))
      return
    }
  }
  const pickedFiles = genFiles.value.map((f: any) => f?.raw).filter(Boolean)
  if (!reqText && !elements?.length && !pickedFiles.length) {
    ElMessage.warning('请至少给一样：APP 截图、需求说明或元素 JSON')
    return
  }

  genLoading.value = true
  try {
    // 统一走千问：截图与需求文档一并上传，后端转 base64 发给模型
    const material = [reqText, elements ? `元素清单 JSON：\n${raw}` : '']
      .filter(Boolean)
      .join('\n\n')
    const generated: any = await apiClient.generateTestCasesByQwen({
      pageName: genForm.pageName.trim(),
      materialKind: genForm.materialKind,
      text: material || undefined,
      files: pickedFiles
    })
    const cases =
      (Array.isArray(generated?.test_cases) && generated.test_cases) ||
      (Array.isArray((generated as any)?.data?.test_cases) && (generated as any).data.test_cases) ||
      (Array.isArray((generated as any)?.result?.test_cases) && (generated as any).result.test_cases) ||
      null
    if (!cases?.length) {
      ElMessage.warning('生成器未返回 test_cases，请检查工作流输出')
      console.warn('generate payload', generated)
      return
    }
    // 生成完先进预览，不直接落库。
    // 模型出的东西总有几条不适用，直接入库的话得再进列表里一条条删——
    // 而删过一轮之后，你已经分不清哪些是看过的、哪些是没看的
    genPreviewRows.value = cases.map((c: any, i: number) => ({
      ...c,
      _key: `${c.case_id || c.caseId || 'TC'}-${i}`,
      _keep: true
    }))
    genPreviewQuestions.value = (generated as any)?.open_questions || []
    genPreviewModel.value = generated.model || '千问'
    genVisible.value = false
    genPreviewVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    genLoading.value = false
  }
}

/** 预览里勾中的那些才入库 */
const genPreviewVisible = ref(false)
const genPreviewRows = ref<Array<Record<string, any>>>([])
const genPreviewQuestions = ref<Array<Record<string, any>>>([])
const genPreviewModel = ref('')
const genPreviewSaving = ref(false)

const genPreviewKept = computed(() => genPreviewRows.value.filter((r) => r._keep))

function dropPreviewRow(row: Record<string, any>) {
  // 直接从列表里去掉，不是打个删除线——留着一条划掉的只会让人再确认一遍
  genPreviewRows.value = genPreviewRows.value.filter((r) => r._key !== row._key)
}

async function confirmPreviewImport() {
  const kept = genPreviewKept.value
  if (!kept.length) {
    ElMessage.warning('至少留一条')
    return
  }
  genPreviewSaving.value = true
  try {
    await apiClient.saveAiTestCasesBatch({
      page_name: genForm.pageName.trim(),
      category: suite.value.key,
      // 层级整批共用：生成器不产出这几级，逐条补是最耗人的部分
      module: genForm.module.trim() || undefined,
      sub_module: genForm.subModule.trim() || undefined,
      app_version: genForm.appVersion.trim() || undefined,
      requirement_no: genForm.requirementNo.trim() || undefined,
      sides: genForm.sides.length ? genForm.sides : undefined,
      server_service: genForm.serverService.trim() || undefined,
      // 待确认项跟着这一批一起落库：弹一次窗就没了的话，人得当场复制到别处，
      // 而需要人当场记下来的东西迟早有一次会忘
      open_questions: genPreviewQuestions.value.length ? genPreviewQuestions.value : undefined,
      status: 'DRAFT',
      test_cases: kept.map(({ _key, _keep, ...rest }) => rest)
    })
    const dropped = genPreviewRows.value.length - kept.length
    ElMessage.success(
      `已入库 ${kept.length} 条` + (dropped > 0 ? `，跳过 ${dropped} 条` : '')
    )
    genPreviewVisible.value = false
    genPreviewRows.value = []
    filterPageName.value = genForm.pageName.trim()
    // 新入库的都是测试版本。停在「线上版本」页签的话列表是空的，
    // 看着就像刚才那一步没存进去——而实际上存了
    releaseTab.value = 'TESTING'
    // 入库后直接切到这一版这一单：不切的话新用例混在「全部」里，还得自己去找
    if (suite.value.byVersion && genForm.appVersion.trim()) {
      filterVersion.value = genForm.appVersion.trim()
      filterRequirement.value = genForm.requirementNo.trim()
    }
    page.value = 1
    await loadList()
    await loadVersions()
    await loadRequirements()
    await loadOpenQuestions()
  } catch (e: any) {
    ElMessage.error(e?.message || '入库失败')
  } finally {
    genPreviewSaving.value = false
  }
}

async function markReviewed(row: AiTestCaseDto) {
  if (!row.id) return
  try {
    await apiClient.updateAiTestCaseStatus(row.id, 'REVIEWED')
    ElMessage.success('已标记复核')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

async function removeRow(row: AiTestCaseDto) {
  if (!row.id) return
  try {
    await ElMessageBox.confirm(`删除用例 ${row.caseId || row.id}？`, '确认', { type: 'warning' })
    await apiClient.deleteAiTestCase(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

/** 这一版还没确认的问题 */
async function loadOpenQuestions() {
  try {
    openQuestions.value = await apiClient.listOpenQuestions({
      category: categoryKey.value,
      appVersion: filterVersion.value || undefined
    })
  } catch {
    // 查不到不该让列表打不开
    openQuestions.value = []
  }
}

/**
 * 删掉一条待确认。
 * 和「已确认」是两件事：确认过的是问过、有结论的，留着下版还有人翻；
 * 而模型挑出来的总有几条根本不成立，那种留着只会下次再判断一遍
 */
async function deleteQuestion(q: Record<string, any>) {
  try {
    await ElMessageBox.confirm(
      `删除「${q.title}」？确认过的建议用「已确认」——那样还能翻到问过什么。`,
      '删除待确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deleteOpenQuestion(q.id)
    openQuestions.value = openQuestions.value.filter((x) => x.id !== q.id)
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function resolveQuestion(q: Record<string, any>) {
  try {
    await apiClient.resolveOpenQuestion(q.id, true)
    // 标掉就从列表里去掉——留着一个划线的条目只会占地方
    openQuestions.value = openQuestions.value.filter((x) => x.id !== q.id)
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

/**
 * 版本下拉。
 *
 * 两个来源合并：<b>归档里的版本</b>（手动建的、或从 Wiki 同步的 JIRA 汇总）
 * 和<b>用例里出现过的版本</b>。
 * 只取后者的话，刚建好还没写用例的版本不会出现，而那正是要开始写用例的时候。
 */
async function loadVersions() {
  if (!suite.value.byVersion) {
    versionOptions.value = []
    archives.value = []
    return
  }
  const [used, archived] = await Promise.all([
    apiClient.listAiTestCaseVersions(categoryKey.value).catch(() => []),
    apiClient.listVersionArchives().catch(() => [])
  ])
  archives.value = archived || []
  const counts = new Map((used || []).map((v: any) => [v.version, v.count]))
  const merged: Array<{ version: string; count: number }> = []
  const seen = new Set<string>()
  for (const a of archived || []) {
    const label = a.releaseLabel || a.appVersion
    if (!label || seen.has(label)) continue
    seen.add(label)
    merged.push({ version: label, count: counts.get(label) || 0 })
  }
  // 用例里有、归档里没有的版本也要列出来，否则历史用例会变成筛不到的孤儿
  for (const [version, count] of counts) {
    if (!seen.has(version)) {
      merged.push({ version, count: count as number })
    }
  }
  versionOptions.value = merged
}

/** 当前选中版本对应的归档 */
const currentArchive = computed(() =>
  archives.value.find((a) => (a.releaseLabel || a.appVersion) === filterVersion.value)
)

/**
 * 单号下拉。
 *
 * 归档里的单子 + 用例里已经用过的单号，两边合并。
 * 归档里的带上标题和用例数——「APP-8873（0 条）」比光一个单号有用得多，
 * 一眼就能看出这个单子还没开始写
 */
async function loadRequirements() {
  if (!suite.value.byVersion || !filterVersion.value) {
    requirementOptions.value = []
    return
  }
  const counts = await apiClient
    .fetchRequirementCounts({ category: categoryKey.value, appVersion: filterVersion.value })
    .catch(() => [] as any[])
  const countMap = new Map((counts || []).map((c: any) => [c.requirementNo, c.total]))
  const out: Array<{ issueKey: string; label: string }> = []
  const seen = new Set<string>()

  const arch = currentArchive.value
  if (arch?.id) {
    try {
      const detail = await apiClient.getVersionArchive(arch.id)
      for (const it of detail?.issues || []) {
        if (!it.issueKey || seen.has(it.issueKey)) continue
        seen.add(it.issueKey)
        const n = countMap.get(it.issueKey) || 0
        const title = (it.summary || '').slice(0, 28)
        out.push({ issueKey: it.issueKey, label: `${it.issueKey}（${n} 条）${title ? ' · ' + title : ''}` })
      }
    } catch {
      /* 归档拉不到时只用用例里的单号 */
    }
  }
  for (const [key, n] of countMap) {
    if (!seen.has(key as string)) {
      out.push({ issueKey: key as string, label: `${key}（${n} 条）` })
    }
  }
  requirementOptions.value = out
}

/** 生成弹窗里的单号下拉，跟着弹窗里选的版本走（可能和列表上筛的不是同一版） */
const genRequirementOptions = ref<Array<{ issueKey: string; label: string }>>([])

/** 拉弹窗里选中版本对应的单号列表 */
async function loadGenRequirements() {
  const arch = archives.value.find(
    (a) => (a.releaseLabel || a.appVersion) === genForm.appVersion
  )
  if (!arch?.id) {
    genRequirementOptions.value = []
    return
  }
  try {
    const detail = await apiClient.getVersionArchive(arch.id)
    genRequirementOptions.value = (detail?.issues || []).map((it: any) => ({
      issueKey: it.issueKey,
      label: `${it.issueKey}${it.summary ? ' · ' + String(it.summary).slice(0, 30) : ''}`
    }))
  } catch {
    genRequirementOptions.value = []
  }
}

async function onGenVersionChange() {
  // 换版本时单号必须清掉：上一版的单号在这一版里不存在
  genForm.requirementNo = ''
  await loadGenRequirements()
}

const batchMetaVisible = ref(false)
const batchMetaSaving = ref(false)
const batchMetaForm = reactive({
  pageName: '',
  module: '',
  subModule: '',
  automationAdvice: '',
  sides: [] as string[]
})

function openBatchMeta() {
  if (!selectedIds.value.length) {
    ElMessage.warning('先勾选要改的用例')
    return
  }
  batchMetaForm.pageName = ''
  batchMetaForm.module = ''
  batchMetaForm.subModule = ''
  batchMetaForm.automationAdvice = ''
  batchMetaForm.sides = []
  batchMetaVisible.value = true
}

async function submitBatchMeta() {
  // 只发填了的字段。全发的话，想改页面会把没填的模块一起清成 null
  const patch: Record<string, string> = {}
  if (batchMetaForm.pageName.trim()) patch.pageName = batchMetaForm.pageName.trim()
  if (batchMetaForm.module.trim()) patch.module = batchMetaForm.module.trim()
  if (batchMetaForm.subModule.trim()) patch.subModule = batchMetaForm.subModule.trim()
  // 后端把空串当「清空为未评估」，null 才是「不改」——所以这里要显式区分，
  // 不能靠 falsy 判断，那会把「清空」也当成「不改」
  if (batchMetaForm.sides.length) {
    patch.sides = batchMetaForm.sides.join(',')
  }
  if (batchMetaForm.automationAdvice === 'NOT_RECOMMENDED') {
    patch.automationAdvice = 'NOT_RECOMMENDED'
  } else if (batchMetaForm.automationAdvice === '__CLEAR__') {
    patch.automationAdvice = ''
  }
  if (!Object.keys(patch).length) {
    ElMessage.warning('至少填一项')
    return
  }
  batchMetaSaving.value = true
  let ok = 0
  let fail = 0
  try {
    for (const id of [...selectedIds.value]) {
      try {
        await apiClient.updateAiTestCase(id, patch)
        ok++
      } catch {
        // 单条失败不中断整批：改了一半停下来，剩下的还得人自己找出来
        fail++
      }
    }
    batchMetaVisible.value = false
    ElMessage[fail ? 'warning' : 'success'](
      `已改 ${ok} 条` + (fail ? `，${fail} 条失败` : '')
    )
    selectedIds.value = []
    await loadList()
  } finally {
    batchMetaSaving.value = false
  }
}

async function submitNewVersion() {
  if (!newVersionForm.releaseLabel.trim()) {
    ElMessage.warning('请填写版本名称，如「9.3 国内客户端」')
    return
  }
  try {
    await apiClient.createVersionArchive({
      releaseLabel: newVersionForm.releaseLabel.trim(),
      appVersion: newVersionForm.appVersion.trim() || undefined,
      productLine: newVersionForm.productLine.trim() || undefined
    })
    newVersionVisible.value = false
    ElMessage.success('版本已创建')
    await loadVersions()
    // 建完直接切过去——建版本的下一步一定是往里加单子
    filterVersion.value = newVersionForm.releaseLabel.trim()
    newVersionForm.releaseLabel = ''
    newVersionForm.appVersion = ''
    newVersionForm.productLine = ''
    await loadRequirements()
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  }
}

async function submitNewIssue() {
  const arch = currentArchive.value
  if (!arch?.id) {
    ElMessage.warning('这个版本不在归档里，没法挂单号。先用「新建版本」建一个')
    return
  }
  if (!newIssueForm.issueKey.trim()) {
    ElMessage.warning('请填写单号，如 APP-8873')
    return
  }
  try {
    await apiClient.addVersionIssue(arch.id, {
      issueKey: newIssueForm.issueKey.trim(),
      summary: newIssueForm.summary.trim() || undefined
    })
    newIssueVisible.value = false
    newIssueForm.issueKey = ''
    newIssueForm.summary = ''
    ElMessage.success('单号已加入这一版')
    await loadRequirements()
  } catch (e: any) {
    ElMessage.error(e?.message || '添加失败')
  }
}

function onVersionChange() {
  // 换版本时单号必须清空——上一版的单号在这一版里不存在，
  // 留着会筛出 0 条，而人会以为用例丢了
  filterRequirement.value = ''
  loadRequirements()
  onSearch()
}

// 换版本时待确认项要跟着换。用 watch 而不是塞进 onSearch——
// onSearch 每次搜关键字都会跑，没必要跟着重查一遍问题
watch(filterVersion, () => {
  loadOpenQuestions()
  loadRequirements()
})

watch(categoryKey, () => {
  page.value = 1
  filterVersion.value = ''
  filterRequirement.value = ''
  filterPageName.value = ''
  filterPriority.value = ''
  filterStatus.value = ''
  filterAdvice.value = ''
  filterModule.value = ''
  selectedIds.value = []
  selectedId.value = null
  detailOpen.value = false
  loadList()
  loadVersions()
  loadOpenQuestions()
  loadRequirements()
})

onMounted(() => {
  loadSides()
  syncNarrow()
  window.addEventListener('resize', syncNarrow)
  loadList()
  loadVersions()
  loadOpenQuestions()
  loadRequirements()
  loadReqEndpointCounts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncNarrow)
})
</script>


<style scoped>
.ai-cases {
  --page-bg: #f0f2f5;
  --card-bg: #ffffff;
  --card-border: #e2e8f0;
  --row-hover: #f8fafc;
  --row-selected: #eff6ff;
  --row-selected-border: #2563eb;
  --nav-bg: #1e2d4a;
  --nav-text: #ffffff;
  --nav-crumb: #64748b;
  --color-test: #d48806;
  --color-test-bg: #fffbe6;
  --color-test-light: #fff7e6;
  --color-prod: #52c41a;
  --color-prod-bg: #f6ffed;
  --pri-p0: #ef4444;
  --pri-p1: #f97316;
  --pri-p2: #94a3b8;
  --status-ok-bg: #f0fdf4;
  --status-ok-text: #166534;
  --status-ok-border: #bbf7d0;
  --status-draft-bg: #fffbeb;
  --status-draft-text: #92400e;
  --status-draft-border: #fde68a;
  --btn-edit-text: #2563eb;
  --btn-edit-border: #bfdbfe;
  --btn-edit-bg: #eff6ff;
  --btn-delete-text: #ef4444;
  --btn-delete-border: #fecaca;
  --btn-delete-bg: #fff1f2;
  --btn-promote: #52c41a;
  --btn-promote-border: #95de64;
  --btn-promote-bg: #f6ffed;
  --text-primary: #0f172a;
  --text-secondary: #1e293b;
  --text-muted: #94a3b8;
  --text-label: #64748b;
  --stats-bg: #1e293b;
  --stats-label: #94a3b8;
  --stats-value: #e2e8f0;
  --stats-cover: #f59e0b;
  --tcid-text: #0284c7;
  --tcid-bg: #e0f2fe;
  --tcid-active-text: #1d4ed8;
  --tcid-active-bg: #dbeafe;
  --result-border: #52c41a;
  --result-bg: #f6ffed;
  --step-target-bg: #eff6ff;
  --step-target-text: #1e40af;
  --step-target-border: #bfdbfe;
  --step-expect-bg: #f0fdf4;
  --step-expect-text: #14532d;
  --step-expect-border: #bbf7d0;

  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--page-bg);
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', sans-serif;
  color: var(--text-primary);
  /* 保留滚动能力，隐藏所有滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ai-cases::-webkit-scrollbar,
.ai-cases *::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}
.ai-cases,
.ai-cases * {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.page-nav {
  flex-shrink: 0;
  position: relative;
  z-index: 100;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  background: var(--nav-bg);
}
.nav-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}
.nav-crumb {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-sep {
  margin: 0 8px;
  color: #64748b;
  font-weight: 400;
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.btn-nav {
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  line-height: 1.4;
}
.btn-nav:hover {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
.btn-nav-primary {
  background: #1890ff;
  border-color: #1890ff;
}
.btn-nav-primary:hover {
  background: #0f78d9;
  border-color: #0f78d9;
}

.toolbar {
  flex-shrink: 0;
  position: relative;
  z-index: 90;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 10px 16px;
  background: #f7f8fa;
  border-bottom: 1px solid #e8eaed;
}
.version-pills {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.vpill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1;
}
.vpill-ico {
  font-size: 12px;
  opacity: 0.7;
}
.vpill-num {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #94a3b8;
}
.vpill.is-online.active {
  color: #389e0d;
  border-color: #95de64;
  background: #f6ffed;
  box-shadow: 0 0 0 1px rgba(82, 196, 26, 0.12);
}
.vpill.is-online.active .vpill-ico,
.vpill.is-online.active .vpill-num {
  color: #389e0d;
  opacity: 1;
}
.vpill.is-testing.active {
  color: #7c3aed;
  border-color: #c4b5fd;
  background: #f5f3ff;
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.1);
}
.vpill.is-testing.active .vpill-ico,
.vpill.is-testing.active .vpill-num {
  color: #7c3aed;
  opacity: 1;
}
.vpill:not(.active):hover {
  border-color: #cbd5e1;
  color: #475569;
}

.vpill-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #ad6800;
  background: #fff7e6;
  border: 1px solid #ffe58f;
  cursor: help;
  outline: none;
}
.vpill-tip .el-icon {
  font-size: 13px;
}
.vpill-tip:hover,
.vpill-tip:focus-visible {
  color: #d48806;
  border-color: #ffd666;
  background: #fffbe6;
}

.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}
.page-body.resizing {
  cursor: col-resize;
  user-select: none;
}
.list-col {
  flex: 1;
  min-width: 280px;
  min-height: 0;
  padding: 12px 14px;
  overflow: auto;
}
.page-body.has-detail .list-col {
  flex: 1 1 auto;
}

.split-handle {
  flex-shrink: 0;
  width: 5px;
  margin: 0 -1px;
  cursor: col-resize;
  position: relative;
  z-index: 5;
  background: transparent;
  touch-action: none;
}
.split-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 1px;
  width: 2px;
  background: #e2e8f0;
  transition: background 0.15s, width 0.15s, left 0.15s;
}
.split-handle:hover::after,
.page-body.resizing .split-handle::after {
  left: 0;
  width: 4px;
  background: #2563eb;
}

.btn-plain, .btn-primary {
  padding: var(--app-btn-padding-y, 5px) var(--app-btn-padding-x, 11px);
  border-radius: var(--app-btn-radius, 5px);
  font-size: var(--app-btn-font-size, 13px);
  cursor: pointer;
  border: 1px solid var(--app-btn-plain-border, #d1d5db);
  background: var(--app-btn-plain-bg, #fff);
  color: var(--app-btn-plain-text, #374151);
}
.btn-primary {
  background: var(--app-primary, #1890ff);
  border-color: var(--app-primary, #1890ff);
  color: #fff;
}
.btn-primary:hover {
  background: var(--el-color-primary-dark-2, #0f78d9);
  border-color: var(--el-color-primary-dark-2, #0f78d9);
}
.btn-plain:hover {
  color: var(--app-primary, #1890ff);
  border-color: var(--el-color-primary-light-5, #8cc8ff);
  background: var(--el-color-primary-light-9, #e6f4ff);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}
.f-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}
.f-label {
  flex: none;
  white-space: nowrap;
  line-height: 28px;
}
.f-w-keyword {
  width: 200px;
}
.f-w-page {
  width: 120px;
}
.f-w-module {
  width: 140px;
}
.f-w-priority {
  width: 96px;
}
.f-w-status {
  width: 110px;
}
.filter-bar :deep(.el-input),
.filter-bar :deep(.el-select) {
  vertical-align: middle;
}
.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select__wrapper) {
  min-height: 28px;
  font-size: 12px;
}
.filter-bar :deep(.el-input__inner),
.filter-bar :deep(.el-select__selected-item),
.filter-bar :deep(.el-select__placeholder) {
  font-size: 12px;
}

.stats-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
  padding: 9px 14px;
  background: #111827;
  border-radius: 6px;
  font-size: 12px;
}
.stats-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stats-bar i { font-style: normal; color: #94a3b8; margin-right: 4px; }
.stats-bar b { font-weight: 600; color: #f8fafc; }
.stats-pipe { color: #4b5563; }
.stats-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.stats-cover-label {
  color: #94a3b8;
  white-space: nowrap;
}
.cover-track {
  width: 120px;
  height: 6px;
  border-radius: 999px;
  background: #374151;
  overflow: hidden;
}
.cover-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1890ff, #36cfc9);
  transition: width 0.2s ease;
}
.stats-cover-num {
  color: #e2e8f0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  text-align: right;
}

.case-table {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.link-btn {
  border: none;
  background: transparent;
  color: #0284c7;
  font-size: 11.5px;
  cursor: pointer;
}
.count-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
}

.table-head, .case-row, .more-row {
  display: grid;
  /* 勾选 / TC 编号 / 标题 / 优先级 / 复核 / 自动化 / 操作。
     列数必须和行里的子元素个数对上——多一个就会换行，操作列会掉到下一行最左边 */
  grid-template-columns: 22px 120px minmax(0, 1fr) 56px 78px 72px 188px;
  column-gap: 10px;
  align-items: center;
  padding: 6px 14px;
  width: 100%;
  box-sizing: border-box;
}
.table-head {
  background: #f8fafc;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.table-head > span {
  white-space: nowrap;
}
/*
  页面全局把滚动条藏了（.ai-cases *::-webkit-scrollbar { display:none }）。
  对整页是合理的，但对一个封了顶的面板不行——藏掉滚动条之后，
  「下面还有内容」这件事没有任何提示，人只会以为就这么多。
  所以这两块单独把滚动条放出来，选择器写长一点盖过全局那条
*/
.ai-cases .oq-bar::-webkit-scrollbar,
.ai-cases .gp-list::-webkit-scrollbar {
  display: block !important;
  width: 6px !important;
}

.ai-cases .oq-bar::-webkit-scrollbar-thumb,
.ai-cases .gp-list::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: var(--el-border-color, #dcdfe6);
}

.ai-cases .oq-bar,
.ai-cases .gp-list {
  scrollbar-width: thin;
}

.oq-bar {
  /*
    这一块在 .toolbar 里，而 .toolbar 是横向 wrap 的 flex 行。
    不显式占整行的话，它能不能换到自己一行全靠「内容碰巧够宽」——
    换不下来就会跟版本页签挤在同一行。order 排到最后，让它紧贴用例列表
  */
  flex: 0 0 100%;
  order: 99;
  /*
    页面是 height:100% + overflow:hidden 的内滚布局，而 .toolbar 又是 flex-shrink:0，
    这一块不封顶的话，7 项待确认会把用例列表整个顶出屏幕，页面本身还不滚——
    表现就是「用例看不到，也划不动」
  */
  max-height: 32vh;
  margin-bottom: 0;
  border: 1px solid var(--el-color-warning-light-5, #f3d19e);
  border-left: 3px solid var(--el-color-warning, #e6a23c);
  border-radius: 6px;
  background: var(--el-color-warning-light-9, #fdf6ec);
  /*
    必须写在最后：简写 overflow 会把 overflow-y 一起重置。
    之前 overflow-y:auto 写在前面、overflow:hidden（为了圆角裁剪）写在后面，
    结果是「JS 能设 scrollTop，鼠标滚不动」——查起来极其费劲，因为看上去两条都写了
  */
  overflow-x: hidden;
  overflow-y: auto;
}

.oq-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--el-color-warning-light-9, #fdf6ec);
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  font-size: 13px;
}

.oq-arrow {
  color: var(--el-color-warning, #e6a23c);
}

.oq-sub {
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.oq-list {
  padding: 0 12px 10px 12px;
  display: grid;
  gap: 10px;
}

.oq-item {
  padding-top: 9px;
  border-top: 1px dashed var(--el-border-color, #dcdfe6);
}

.oq-title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
}

.oq-kind {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-warning-light-7, #f8e3c5);
  color: var(--el-color-warning-dark-2, #b88230);
  font-size: 11px;
  font-weight: 500;
}

.oq-ver {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-secondary, #909399);
  font-size: 11px;
  font-weight: 400;
}

.oq-done {
  margin-left: auto;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--el-bg-color, #fff);
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
  padding: 1px 9px;
  cursor: pointer;
}

.oq-done:hover {
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
}

.oq-drop {
  margin-left: 6px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--el-bg-color, #fff);
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
  padding: 1px 9px;
  cursor: pointer;
}

.oq-drop:hover {
  border-color: var(--el-color-danger, #f56c6c);
  color: var(--el-color-danger, #f56c6c);
}

.oq-line {
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-text-color-regular, #606266);
}

.oq-lab {
  display: inline-block;
  min-width: 34px;
  margin-right: 8px;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 11px;
}

.gp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
}

.gp-oq {
  color: var(--el-color-warning, #e6a23c);
  font-size: 12px;
}

.gp-list {
  max-height: 58vh;
  overflow-y: auto;
  padding-right: 2px;
}

.gp-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 4px;
  border-bottom: 1px dashed var(--el-border-color, #dcdfe6);
}

.gp-item.off {
  opacity: 0.42;
}

.gp-check {
  margin-top: 2px;
}

.gp-body {
  flex: 1;
  min-width: 0;
}

.gp-title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 13.5px;
}

.gp-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.gp-prio {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
}

.gp-type {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-secondary, #909399);
  font-size: 11px;
}

.gp-line {
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-text-color-regular, #606266);
}

.gp-lab {
  display: inline-block;
  min-width: 30px;
  margin-right: 8px;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 11px;
}

.gp-step {
  margin-right: 10px;
}

.gp-del {
  flex-shrink: 0;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 4px;
  background: var(--el-bg-color, #fff);
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
  padding: 2px 9px;
  cursor: pointer;
}

.gp-del:hover {
  border-color: var(--el-color-danger, #f56c6c);
  color: var(--el-color-danger, #f56c6c);
}

.gp-foot-tip {
  float: left;
  line-height: 32px;
  font-size: 12px;
  color: var(--el-text-color-placeholder, #a8abb2);
}

.f-w-req {
  width: 230px;
}

.f-w-side {
  width: 130px;
}

.side-opt-name {
  margin-right: 12px;
}

.side-opt-hint {
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 12px;
}

.mod-side.is-svc {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.mod-side {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-success-light-9, #f0f9eb);
  color: var(--el-color-success, #67c23a);
  font-size: 11px;
  font-weight: 400;
}

.mod-eps {
  margin-left: 4px;
  color: var(--el-color-primary, #409eff);
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: none;
}
.mod-eps.has-count {
  padding: 1px 7px;
  border-radius: 10px;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  font-weight: 600;
}
.mod-eps:hover {
  color: #337ecc;
}
.mod-eps.has-count:hover {
  background: #d9ecff;
}

.cov-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 12px;
}
.cov-label {
  font-weight: 600;
  color: #334155;
  flex-shrink: 0;
}
.cov-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid transparent;
}
.cov-pill.is-green { background: #f6ffed; color: #389e0d; border-color: #b7eb8f; }
.cov-pill.is-yellow { background: #fffbe6; color: #d48806; border-color: #ffe58f; }
.cov-pill.is-red { background: #fff2f0; color: #cf1322; border-color: #ffccc7; }
.cov-pill.is-waived { background: #f5f5f5; color: #595959; border-color: #d9d9d9; }
.cov-ready {
  margin-left: auto;
  font-weight: 700;
  font-size: 12px;
}
.cov-ready.ok { color: #389e0d; }
.cov-ready.no { color: #cf1322; }
.cov-link {
  border: none;
  background: none;
  color: var(--el-color-primary, #409eff);
  font-size: 11.5px;
  cursor: pointer;
  padding: 0 4px;
}
.cov-loading { color: #94a3b8; font-size: 11.5px; }

.cov-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 8px;
}

.cov-card {
  padding: 10px 12px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left-width: 3px;
}
.cov-card.is-green { border-left-color: #52c41a; }
.cov-card.is-yellow { border-left-color: #faad14; }
.cov-card.is-red { border-left-color: #ff4d4f; }
.cov-card.is-waived { border-left-color: #bfbfbf; }

.cov-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cov-card-label {
  font-weight: 600;
  font-size: 12.5px;
  color: #1e293b;
  min-width: 4em;
}
.cov-card-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
}
.cov-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.cov-act {
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #475569;
  font-size: 11.5px;
  cursor: pointer;
}
.cov-act:hover {
  border-color: #94a3b8;
  color: #1e293b;
}
.cov-act.is-primary {
  border-color: #91caff;
  background: #e6f4ff;
  color: #1677ff;
}
.cov-act.is-primary:hover {
  background: #bae0ff;
}

.req-eps {
  margin: 0 0 8px;
  padding: 9px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter, #f5f7fa);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.req-eps-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.gen-ep-tip {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary, #909399);
}
.gen-ep-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary, #909399);
}
.gen-ep-empty {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}
.gen-ep-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.req-eps-req {
  font-weight: 500;
  color: var(--el-text-color-secondary, #909399);
}

.req-ep {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  padding: 3px 0;
  font-size: 12.5px;
}

.req-ep-m {
  min-width: 46px;
  padding: 0 5px;
  border-radius: 3px;
  text-align: center;
  font-size: 10.5px;
  font-weight: 600;
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-regular, #606266);
}
.req-ep-m.m-get { background: #f0f9eb; color: #67c23a; }
.req-ep-m.m-post { background: #fdf6ec; color: #e6a23c; }
.req-ep-m.m-delete { background: #fef0f0; color: #f56c6c; }

.req-ep-p {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.req-ep-proj {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10.5px;
  background: var(--el-color-info-light-9, #f4f4f5);
  color: var(--el-text-color-secondary, #909399);
}
.req-ep-proj.is-missing {
  background: var(--el-color-warning-light-9, #fdf6ec);
  color: var(--el-color-warning, #e6a23c);
}

.req-ep-flag {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-color-danger-light-9, #fef0f0);
  color: var(--el-color-danger, #f56c6c);
  font-size: 10.5px;
}

.req-ep-note {
  color: var(--el-text-color-secondary, #909399);
  font-size: 11.5px;
}

.req-ep-src {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10.5px;
}
.req-ep-src.is-sync {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
}
/* 手动补的用中性色：它是判断不是事实，不该看起来和分析结果一样确定 */
.req-ep-src.is-manual {
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-secondary, #909399);
}
/* 抓包是三者里最硬的证据，给它最实的颜色 */
.req-ep-src.is-capture {
  background: var(--el-color-success-light-9, #f0f9eb);
  color: var(--el-color-success, #67c23a);
}

.req-ep-del {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 11.5px;
  cursor: pointer;
  padding: 0 4px;
}
.req-ep-del:hover {
  color: var(--el-color-danger, #f56c6c);
}

.req-ep-add {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color, #dcdfe6);
}

.req-cap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color, #dcdfe6);
}

.req-cap-label {
  font-size: 12px;
  color: var(--el-text-color-regular, #606266);
}

.req-cap-hint {
  flex: 1 1 100%;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder, #a8abb2);
}

.req-cap-live {
  color: var(--el-color-danger, #f56c6c);
  font-size: 12.5px;
  font-weight: 600;
}

.req-cap-count {
  font-size: 12.5px;
  color: var(--el-text-color-regular, #606266);
  font-variant-numeric: tabular-nums;
}

/* iOS 的代理提示：要人照着做，所以要显眼 */
.req-cap-tip {
  margin-top: 8px;
  padding: 8px 11px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9, #fdf6ec);
  border: 1px solid var(--el-color-warning-light-7, #f8e3c5);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-color-warning-dark-2, #b88230);
}

.req-eps-tip {
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder, #a8abb2);
  line-height: 1.6;
}

.mod-ver {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-secondary, #909399);
  font-size: 11px;
  font-weight: 400;
}

.c-req {
  display: inline-block;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  font-style: normal;
  font-size: 11px;
  line-height: 16px;
  vertical-align: middle;
}

.c-ver {
  display: inline-block;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-fill-color, #f0f2f5);
  color: var(--el-text-color-secondary, #909399);
  font-style: normal;
  font-size: 11px;
  line-height: 16px;
  vertical-align: middle;
}

.case-row > .c-title {
  padding-left: 14px;
}
.table-head > span:nth-child(4),
.table-head > span:nth-child(5),
.table-head > span:nth-child(6) {
  text-align: center;
}
.case-row > .c-prio,
.case-row > .c-status {
  justify-self: center;
}
.case-row {
  padding: 7px 14px;
  border-bottom: 1px solid #f8fafc;
  cursor: pointer;
}
.case-row:hover { background: #f8fafc; }
.case-row.active {
  background: #eff6ff;
  box-shadow: inset 3px 0 0 #2563eb;
}

.mod-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: #f8fafc;
  cursor: pointer;
  border-top: 1px solid #f1f5f9;
}
.mod-block:first-child .mod-head {
  border-top: none;
}
.mod-block .table-head {
  border-bottom: 1px solid #f1f5f9;
}
.fold-arrow {
  display: inline-block;
  font-size: 11px;
  color: #64748b;
  transition: transform 0.15s;
}
.fold-arrow.folded { transform: rotate(-90deg); }
.mod-name { font-size: 12.5px; color: #1e293b; font-weight: 600; }
.mod-meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 4px;
}
.folded-tip { font-size: 11px; color: #94a3b8; margin-left: 8px; }
.cover-pct {
  margin-left: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: #52c41a;
  white-space: nowrap;
}
.cover-pct.zero { color: #f59e0b; }

.sub-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px 5px 32px;
  background: #fafafa;
  font-size: 11.5px;
  color: #475569;
}
.sub-arrow { color: #94a3b8; }
.sub-count { color: #94a3b8; }

.c-id {
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #0284c7;
  background: #e0f2fe;
  border-radius: 3px;
  padding: 2px 5px;
  font-weight: 600;
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
}
.case-row.active .c-id { background: #dbeafe; color: #1d4ed8; }
.c-title {
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.case-row.active .c-title { color: #1d4ed8; }

.c-prio {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  text-align: center;
}
.c-prio.p0 { background: #ef4444; }
.c-prio.p1 { background: #f97316; }
.c-prio.p2 { background: #94a3b8; }

.c-status {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  border: 1px solid transparent;
}
.c-status.is-ok {
  background: #f0fdf4; color: #166534; border-color: #bbf7d0;
}
.c-status.is-draft {
  background: #fffbeb; color: #92400e; border-color: #fde68a;
}
.c-status.is-muted {
  background: #f8fafc; color: #64748b; border-color: #e2e8f0;
}

.c-cover {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  border: 1px solid transparent;
  white-space: nowrap;
  cursor: default;
}
.c-cover.is-covered {
  background: #f0fdf4; color: #166534; border-color: #bbf7d0;
}
/* 过期用橙色而不是绿色：它是「绿得不该信」，视觉上必须和真绿分开 */
.c-cover.is-stale {
  background: #fff7ed; color: #9a3412; border-color: #fed7aa;
}
.c-cover.is-missing {
  background: #fef2f2; color: #991b1b; border-color: #fecaca;
}
.c-cover.is-none {
  background: #f8fafc; color: #94a3b8; border-color: #e2e8f0;
}
.more-flow {
  color: #64748b;
}
.more-stale {
  color: #9a3412;
  line-height: 1.6;
}

.table-head > span:nth-child(7) {
  text-align: left;
  justify-self: start;
  padding-left: 24px;
}
.case-row > .c-ops {
  justify-self: start;
  padding-left: 24px;
}
.c-ops {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  justify-content: flex-start;
  align-items: center;
}
.op-promote, .op-edit, .op-del, .op-view, .op-review {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  white-space: nowrap;
}
.op-promote {
  color: #389e0d; border: 1px solid #95de64; font-weight: 600;
}
.op-promote:hover { background: #f6ffed; }
.op-promote.is-lg {
  padding: 3px 8px;
  font-size: 10.5px;
}
.op-edit {
  color: #2563eb; border: 1px solid #bfdbfe;
}
.op-edit:hover { background: #eff6ff; }
.op-review {
  color: #389e0d; border: 1px solid #95de64;
}
.op-review:hover { background: #f6ffed; }
.op-del {
  color: #ef4444; border: 1px solid #fecaca;
}
.op-del:hover { background: #fef2f2; }
.op-view {
  color: #64748b; border: none;
}

.more-row {
  padding-top: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f8fafc;
  font-size: 11px;
  color: #0284c7;
}
.more-spacer { visibility: hidden; pointer-events: none; }
.more-body {
  grid-column: 3 / 7;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-left: 14px;
}
.more-row.is-toggle {
  cursor: pointer;
}
.more-row.is-toggle .more-body {
  text-decoration: none;
}
.more-row.is-toggle:hover .more-body {
  text-decoration: none;
  color: #0369a1;
}

.batch-bar {
  position: sticky;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  background: #e6f4ff;
  border-top: 1px solid #91d5ff;
  font-size: 11.5px;
  color: #1f2329;
  box-shadow: 0 -4px 12px rgba(24, 144, 255, 0.08);
  opacity: 0.85;
  transition: opacity 0.15s;
}
.batch-bar.active {
  opacity: 1;
}
.batch-bar b { font-weight: 700; color: #0958d9; }
.batch-sep { width: 1px; height: 14px; background: #91d5ff; }
.btn-batch {
  padding: 5px 12px;
  border: 1px solid #1890ff;
  border-radius: 5px;
  background: #1890ff;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.btn-batch:hover:not(:disabled) {
  background: #0f78d9;
  border-color: #0f78d9;
}
.btn-batch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: #8cc8ff;
  border-color: #8cc8ff;
  color: #fff;
}
.batch-tip { color: #64748b; }

.pager { padding: 10px 14px; display: flex; justify-content: flex-end; }

.detail-side {
  width: 408px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e2e8f0;
  box-shadow: -6px 0 20px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  min-width: 320px;
  max-width: 800px;
}
.detail-sticky-top {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.detail-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-tcid {
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 2px 6px;
  border-radius: 3px;
}
.detail-env {
  font-size: 11px;
  font-weight: 700;
  color: #d48806;
  background: #fffbe6;
  padding: 2px 6px;
  border-radius: 3px;
}
.detail-env.is-online {
  color: #389e0d;
  background: #f6ffed;
}
.detail-top-ops { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.detail-close {
  width: 26px; height: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  color: #64748b;
}
.detail-close:hover { background: #f1f5f9; }
.detail-title {
  margin: 8px 0 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.5;
}
.detail-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.type-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #0369a1;
  background: #e0f2fe;
  border: 1px solid #bae6fd;
}
.online-hint { font-size: 11px; color: #94a3b8; }

.detail-accent { height: 3px; background: linear-gradient(90deg, #94a3b8, #cbd5e1); }
.detail-accent.p0 { background: linear-gradient(90deg, #ef4444, #f97316); }
.detail-accent.p1 { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.detail-body { flex: 1; overflow: auto; padding: 0 0 12px; }
.field-pair {
  display: grid;
  grid-template-columns: 66px 1fr 66px 1fr;
  border-bottom: 1px solid #f1f5f9;
}
.field-full {
  display: grid;
  grid-template-columns: 66px 1fr;
  border-bottom: 1px solid #f1f5f9;
}
.fl {
  padding: 8px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: #0ea5e9;
  background: #fafafa;
  border-right: 1px solid #f1f5f9;
}
.fv {
  padding: 8px 11px;
  font-size: 12.5px;
  color: #1e293b;
  line-height: 1.6;
}
.muted { color: #94a3b8; }

.step-list { list-style: none; margin: 0; padding: 0; }
.step-item { display: flex; gap: 8px; margin-bottom: 10px; }
.step-no {
  flex-shrink: 0;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #0ea5e9;
  color: #fff;
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}
.step-action { font-size: 12.5px; color: #0f172a; font-weight: 500; margin-bottom: 4px; }
.step-meta { display: flex; flex-wrap: wrap; gap: 4px; }
.pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
}
.pill-target { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.pill-expected { background: #f0fdf4; color: #14532d; border-color: #bbf7d0; }
.expected-box {
  border-left: 3px solid #52c41a;
  background: #f6ffed;
  padding: 8px 10px;
  font-size: 12.5px;
  color: #1e293b;
  line-height: 1.65;
}

.detail-sticky-bottom {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
.nav-link {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12.5px;
  cursor: pointer;
}
.nav-link:disabled { color: #cbd5e1; cursor: not-allowed; }
.pos { font-size: 11.5px; color: #94a3b8; }

/* dialogs keep usable */
.edit-row { display: flex; gap: 12px; }
.edit-col { flex: 1; }
.edit-hint { margin-top: 4px; font-size: 12px; color: #94a3b8; line-height: 1.4; }

.import-src { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.import-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.section-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.gen-shot-wrap { width: 100%; }

@media (max-width: 959px) {
  .detail-side { display: none; }
  .page-body.has-detail .list-col { flex: 1; }
  .case-row, .table-head, .more-row {
    grid-template-columns: 22px 70px minmax(0, 1fr) 48px 64px;
  }
  .c-ops, .c-cover { display: none; }
  .table-head span:last-child,
  .table-head span:nth-last-child(2) { display: none; }
}
</style>

<!-- Dialog 挂到 body，需非 scoped 才能命中样式 -->
<style>
.case-edit-dialog {
  border-radius: 12px !important;
  overflow: hidden;
}
.case-edit-dialog .el-dialog__header {
  padding: 16px 20px 12px;
  margin: 0;
  border-bottom: 1px solid #f1f5f9;
}
.case-edit-dialog .el-dialog__body {
  padding: 0;
  max-height: calc(92vh - 140px);
  overflow: auto;
}
.case-edit-dialog .el-dialog__footer {
  padding: 12px 20px 16px;
  border-top: 1px solid #f1f5f9;
}
.case-edit-dialog .ced-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.case-edit-dialog .ced-title-ico {
  color: #1890ff;
  font-size: 18px;
}
.case-edit-dialog .ced-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.case-edit-dialog .ced-tcid {
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 2px 8px;
  border-radius: 4px;
}
.case-edit-dialog .ced-body {
  padding: 14px 20px 16px;
}
.case-edit-dialog .ced-sec {
  margin-bottom: 18px;
}
.case-edit-dialog .ced-sec-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 12px;
}
.case-edit-dialog .ced-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.case-edit-dialog .ced-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.case-edit-dialog .ced-grid2 > .ced-field,
.case-edit-dialog .ced-step-sub > .ced-field {
  margin-bottom: 0;
}
.case-edit-dialog .ced-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.case-edit-dialog .ced-label i {
  color: #ef4444;
  font-style: normal;
  margin-left: 2px;
}
.case-edit-dialog .ced-label.is-sub {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}
.case-edit-dialog .ced-hint {
  margin-top: 4px;
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.45;
}
.case-edit-dialog .ced-hint.is-link {
  color: #1890ff;
}
.case-edit-dialog .ced-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.case-edit-dialog .ced-step {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}
.case-edit-dialog .ced-step-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.case-edit-dialog .ced-step-no {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1890ff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.case-edit-dialog .ced-step-action { flex: 1; min-width: 0; }
.case-edit-dialog .ced-step-ops {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.case-edit-dialog .ced-ico {
  width: 24px;
  height: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.case-edit-dialog .ced-ico:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.case-edit-dialog .ced-ico.is-del { color: #ef4444; border-color: #fecaca; }
.case-edit-dialog .ced-ico:hover:not(:disabled) { background: #f8fafc; }
.case-edit-dialog .ced-step-sub {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
/* 藏掉目标元素后，预期结果占满整行，不留一块空白 */
.case-edit-dialog .ced-step-sub.no-target {
  grid-template-columns: 1fr;
}
.case-edit-dialog .ced-steps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.case-edit-dialog .ced-auto-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
}
.case-edit-dialog .ced-auto-tip {
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 11.5px;
}
.case-edit-dialog .ced-step-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.case-edit-dialog .ced-btn {
  padding: 5px 11px;
  border-radius: 5px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}
.case-edit-dialog .ced-btn:hover {
  color: #1890ff;
  border-color: #91d5ff;
  background: #e6f4ff;
}
.ai-tc-filter-popper {
  min-width: 120px !important;
}
.ai-tc-filter-popper .el-select-dropdown__item {
  padding: 0 16px;
  height: 32px;
  line-height: 32px;
}
.req-ep-gen {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 3px;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
}

.req-ep-gen:hover {
  background: var(--el-color-primary-light-9);
}

.gen-target {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gen-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.page-body.is-version-browse {
  gap: 0;
  background: #fff;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  margin: 0 14px 14px;
  overflow: hidden;
}
.page-body.is-version-browse.has-detail .browse-main {
  flex: 1 1 auto;
  min-width: 0;
}

.browse-nav {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #f8fafc;
}
.browse-nav-head {
  padding: 12px 14px 8px;
  border-bottom: 1px solid #e2e8f0;
}
.browse-env {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.browse-env.is-test {
  color: #ad6800;
  background: #fff7e6;
}
.browse-env.is-online {
  color: #166534;
  background: #f0fdf4;
}
.browse-nav-tip {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}
.browse-tree-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 6px 12px;
}
.browse-tree-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}
.browse-tree-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.browse-tree-badge {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
  background: #e2e8f0;
  border-radius: 10px;
  padding: 0 6px;
  line-height: 18px;
}
.browse-tree-icon {
  color: #64748b;
  font-size: 14px;
}
.browse-tree-empty,
.browse-main-empty {
  padding: 24px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.browse-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
}
.browse-main-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.browse-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}
.browse-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.pill {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
}
.pill-ch {
  background: #eff6ff;
  color: #1d4ed8;
}
.pill-lang {
  background: #fdf4ff;
  color: #7e22ce;
}
.pill-count {
  background: #f0fdf4;
  color: #166534;
}
.browse-cov {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.browse-eps {
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.browse-eps-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.browse-eps-req {
  font-weight: 400;
  color: #64748b;
  font-size: 12px;
}
.browse-eps-tip {
  font-size: 12px;
  color: #94a3b8;
}
.browse-ep {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid #eef2f7;
  font-size: 12px;
}
.browse-ep:first-of-type {
  border-top: none;
}

.browse-case-table {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}
.browse-case-table .table-head,
.browse-case-table .case-row {
  grid-template-columns: 36px 88px minmax(180px, 1fr) 64px 80px 72px 220px;
}

</style>
