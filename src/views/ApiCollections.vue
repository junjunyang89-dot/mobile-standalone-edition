<template>
  <div class="collections-page">
    <div class="page-body" v-loading="loading">
      <!-- 左侧：环境 + 树 -->
      <aside class="nav-panel">
        <div class="scope-tabs">
          <button type="button" class="scope-tab" :class="{ active: scope === 'TEST' }" @click="switchScope('TEST')">
            分支用例
          </button>
          <button type="button" class="scope-tab" :class="{ active: scope === 'LIVE' }" @click="switchScope('LIVE')">
            全量用例
          </button>
        </div>
        <div v-if="scope === 'LIVE'" class="live-env">
          <span class="live-env-label">执行环境</span>
          <el-radio-group v-model="liveRunEnv" size="small">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="projectFilter" class="project-filter">
          <el-tag closable size="small" @close="clearProjectFilter">只看 {{ projectFilter }}</el-tag>
        </div>
        <div class="tree-filter">
          <el-input v-model="treeKeyword" placeholder="搜接口 / Controller / 集合" clearable :prefix-icon="Search" />
        </div>
        <div class="nav-tree-wrap">
          <el-tree
            v-if="visibleTree.length"
            ref="treeRef"
            :data="visibleTree"
            node-key="nodeKey"
            :props="treeProps"
            highlight-current
            :default-expanded-keys="treeExpandedKeys"
            :expand-on-click-node="false"
            @node-click="onNodeClick"
            @node-expand="onTreeExpand"
            @node-collapse="onTreeCollapse"
          >
            <template #default="{ data }">
              <span class="tree-row" :class="{ 'tree-leaf-row': !data.isFolder }">
                <el-icon v-if="data.isFolder" class="tree-icon"><FolderOpened /></el-icon>
                <span class="tree-text" :title="data.kind === 'interface' ? data.path || data.label : data.label">
                  {{ data.label }}
                </span>
                <span
                  v-if="data.coreTotal"
                  class="tree-core"
                  :class="{ 'is-done': data.coreCovered >= data.coreTotal }"
                  :title="`核心接口 ${data.coreTotal} 个，已有启用用例 ${data.coreCovered} 个`"
                >核心 {{ data.coreCovered }}/{{ data.coreTotal }}</span>
                <span v-if="data.statusTag" class="tree-status" :class="statusClass(data.statusTag)">
                  {{ data.statusTag }}
                </span>
                <span v-else-if="data.meta != null" class="tree-badge">{{ data.meta }}</span>
              </span>
            </template>
          </el-tree>
          <div v-else-if="!loading && treeKeyword.trim()" class="nav-empty">没有匹配「{{ treeKeyword.trim() }}」的</div>
          <div v-else-if="!loading && projectFilter" class="nav-empty">
            {{ projectFilter }} 在「{{ scope === 'LIVE' ? '全量用例' : '分支用例' }}」下还没有东西，可以切到另一个页签看看
          </div>
          <div v-else-if="!loading" class="nav-empty">暂无集合</div>
        </div>
        <div v-if="navTotal > NAV_PAGE_SIZE" class="nav-pagination">
          <el-pagination
            v-model:current-page="navPage"
            :page-size="NAV_PAGE_SIZE"
            :total="navTotal"
            :pager-count="5"
            layout="total, prev, pager, next"
            small
          />
        </div>
      </aside>

      <!-- 右侧主区 -->
      <main class="detail-panel">
        <div class="main-topbar">
          <el-select
            v-if="scope === 'TEST'"
            v-model="appVersion"
            clearable
            placeholder="筛选版本"
            class="version-select"
            @change="loadTree"
          >
            <el-option v-for="v in versionOptions" :key="v" :label="v" :value="v" />
          </el-select>
          <el-checkbox v-model="includeArchived" @change="loadTree">已归档</el-checkbox>
          <el-button plain @click="triageVisible = true">分支用例分诊</el-button>
          <el-button v-if="scope === 'TEST'" type="primary" @click="openCreate">
            <el-icon><Plus /></el-icon>新建集合
          </el-button>
        </div>

        <!-- 需求单 / 分支集合：先选接口，再看用例 -->
        <template v-if="selectedCollection">
          <div class="detail-head">
            <div class="head-left">
              <h2 v-if="selectedInterface">{{ selectedInterface.path }}</h2>
              <h2 v-else>{{ collectionTitle }}</h2>
              <span v-if="selectedInterface" class="method-tag" :class="methodClass(selectedInterface.method)">
                {{ selectedInterface.method }}
              </span>
              <span v-if="!selectedInterface && selectedCollection.requirementNo" class="pill pill-req">需求单接口</span>
              <span v-else-if="!selectedInterface && selectedCollection.sourceBranch" class="pill pill-req">分支涉及的接口用例</span>
              <span class="pill pill-env">{{ scope === 'TEST' ? '分支用例' : '全量用例' }}</span>
              <span
                v-if="!selectedInterface && collectionStatusTag"
                class="pill"
                :class="collectionStatusTag === '已验证' ? 'pill-ok' : 'pill-run'"
              >
                {{ collectionStatusTag }}
              </span>
            </div>
            <el-button
              v-if="!selectedCollection.virtual && !selectedInterface"
              type="primary"
              @click="run(selectedCollection)"
            >
              <el-icon><VideoPlay /></el-icon>
              {{ selectedCollection.requirementNo ? '运行本需求单' : '执行集合' }}
            </el-button>
            <el-button v-else-if="selectedCollection.virtual && !selectedInterface" type="primary" @click="openCreateFromSelection">
              <el-icon><Plus /></el-icon>新建集合
            </el-button>
          </div>

          <div v-if="selectedCollection.requirementNo && !selectedInterface" class="progress-block">
            <div class="progress-label">
              <span>本单验证进度</span>
              <span>{{ progressStats.passed }}/{{ progressStats.total }} 条用例已启用</span>
            </div>
            <el-progress
              :percentage="progressStats.total ? Math.round((progressStats.passed / progressStats.total) * 100) : 0"
              :stroke-width="6"
              :show-text="false"
            />
            <div class="progress-chips">
              <span class="chip chip-pass">已启用 {{ progressStats.passed }}</span>
              <span class="chip chip-pending">已停用 {{ progressStats.disabled }}</span>
            </div>
          </div>

          <template v-if="selectedInterface">
            <div class="toolbar">
              <el-input
                v-model="caseKeyword"
                placeholder="搜索用例名称"
                clearable
                class="search-input"
              />
              <el-select
                v-if="hasCaseKind(collectionCases)"
                v-model="kindFilter"
                clearable
                placeholder="全部类型"
                class="kind-select"
              >
                <el-option v-for="o in CASE_KIND_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-button type="primary" @click="openCreateCase">
                <el-icon><Plus /></el-icon>新建用例
              </el-button>
              <el-button plain :loading="generatingCase" @click="generateCaseForInterface">智能生成</el-button>
              <el-button plain @click="openImportDoc">导入接口文档</el-button>
              <el-button plain @click="refreshSelectedCases">刷新</el-button>
              <el-button
                plain
                :disabled="!selectedInterfaceCases.length"
                :loading="runningCase"
                @click="runInterfaceCases"
              >
                执行本接口
              </el-button>
            </div>

            <el-table v-if="interfaceCaseRows.length" :data="pagedInterfaceCaseRows" size="default" class="case-table">
              <el-table-column label="用例名称" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.level === 'CORE'" class="core-tag">核心</span><span
                    v-if="kindOf(row)"
                    class="kind-tag"
                    :class="CASE_KIND_META[kindOf(row)!].cls"
                    :title="caseKindTitle(row)"
                  >{{ CASE_KIND_META[kindOf(row)!].text }}</span><span v-if="row.testOnly" class="test-only-tag">仅测试</span>{{ row.name }}
                </template>
              </el-table-column>
              <el-table-column label="说明" min-width="160" show-overflow-tooltip prop="description" />
              <el-table-column label="验证状态" width="120">
                <template #default="{ row }">
                  <span class="verify-tag" :class="row.enabled ? 'st-pass' : 'st-pending'">
                    {{ row.enabled ? '已启用' : '已停用' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="128" fixed="right">
                <template #default="{ row }">
                  <div class="ops-col">
                    <div class="ops-row">
                      <el-button link type="primary" @click="openEditCase(row)">编辑</el-button>
                      <el-button link type="danger" @click="removeCase(row)">删除</el-button>
                    </div>
                    <div class="ops-row">
                      <el-button
                        link
                        type="success"
                        :loading="runningCaseId === row.id"
                        :disabled="!!runningCaseId && runningCaseId !== row.id"
                        @click="runOneCase(row)"
                      >执行</el-button>
                      <el-button link @click="toggleCaseEnabled(row)">
                        {{ row.enabled ? '停用' : '启用' }}
                      </el-button>
                    </div>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <el-pagination
              v-if="interfaceCaseRows.length > PAGE_SIZES[0]"
              v-model:current-page="ifaceCasePage"
              v-model:page-size="ifaceCaseSize"
              class="table-pagination"
              background
              small
              layout="total, sizes, prev, pager, next"
              :page-sizes="PAGE_SIZES"
              :total="interfaceCaseRows.length"
            />
          </template>

          <div v-else class="detail-empty">展开左侧需求单，点击具体接口查看用例</div>
        </template>

        <!-- 生产 Controller -->
        <template v-else-if="selectedController">
          <div class="detail-head">
            <div class="head-left">
              <h2>{{ selectedController.label }}</h2>
              <span class="pill pill-ctrl">Controller</span>
            </div>
            <el-button
              v-if="selectedController.runCollectionId"
              type="primary"
              @click="runLiveProject(selectedController)"
            >
              <el-icon><VideoPlay /></el-icon>执行
            </el-button>
          </div>
          <div class="toolbar">
            <el-input v-model="caseKeyword" placeholder="搜索用例 / 路径" clearable class="search-input" />
            <el-select
              v-model="kindFilter"
              clearable
              placeholder="全部类型"
              class="kind-select"
            >
              <el-option v-for="o in CASE_KIND_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span class="ctrl-count">{{ liveIfaceTotal }} 个接口 · {{ liveCaseTotal }} 条用例</span>
            <el-button plain @click="refreshLiveInterfaces">刷新</el-button>
          </div>
          <div v-loading="liveLoading">
          <el-table
            v-if="ifaceGroups.length"
            :data="ifaceGroups"
            :row-key="(r: any) => r.rowKey || r.id"
            :tree-props="{ children: 'children' }"
            default-expand-all
            :row-class-name="({ row }: any) => (row.isIface ? 'iface-row' : 'case-row')"
            size="default"
            class="case-table iface-table"
            @row-click="onIfaceRowClick"
            @expand-change="onIfaceExpandChange"
          >
            <el-table-column label="接口 / 用例" min-width="360">
              <template #default="{ row }">
                <template v-if="row.isIface">
                  <el-icon class="iface-arrow" :class="{ 'is-open': row.children.length }"><ArrowRight /></el-icon>
                  <span class="method-tag" :class="methodClass(row.method)">{{ row.method }}</span>
                  <span class="iface-cell">
                    <span class="path-main">
                      <span v-if="row.level === 'CORE'" class="core-tag">核心</span>{{ row.title }}
                    </span>
                    <span class="path-sub">{{ row.path }}</span>
                  </span>
                </template>
                <span v-else class="case-name" :title="row.name">
                  <span
                    v-if="kindOf(row)"
                    class="kind-tag"
                    :class="CASE_KIND_META[kindOf(row)!].cls"
                    :title="caseKindTitle(row)"
                  >{{ CASE_KIND_META[kindOf(row)!].text }}</span><span v-if="row.testOnly" class="test-only-tag">仅测试</span>{{ scenarioOf(row) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <span v-if="row.isIface" class="iface-count">
                  {{ row.caseCount }} 条 · <span :class="row.enabledCount ? 'st-pass' : 'st-pending'">{{ row.enabledCount }} 启用</span>
                </span>
                <span v-else class="verify-tag" :class="row.enabled ? 'st-pass' : 'st-pending'">
                  {{ row.enabled ? '已启用' : '已停用' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="128" fixed="right">
              <template #default="{ row }">
                <div v-if="row.isIface" class="ops-col" @click.stop>
                  <div class="ops-row">
                    <el-button
                      link
                      type="success"
                      :loading="runningCaseId === row.rowKey"
                      :disabled="!!runningCaseId && runningCaseId !== row.rowKey"
                      @click="runIfaceCases(row)"
                    >执行全部</el-button>
                  </div>
                </div>
                <div v-else class="ops-col" @click.stop>
                  <div class="ops-row">
                    <el-button link type="primary" @click="openEditCase(row)">编辑</el-button>
                    <el-button link type="danger" @click="removeCase(row)">删除</el-button>
                  </div>
                  <div class="ops-row">
                    <el-button
                      link
                      type="success"
                      :loading="runningCaseId === row.id"
                      :disabled="!!runningCaseId && runningCaseId !== row.id"
                      @click="runOneCase(row)"
                    >执行</el-button>
                    <el-button link @click="toggleCaseEnabled(row)">
                      {{ row.enabled ? '停用' : '启用' }}
                    </el-button>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-else-if="!liveLoading" class="detail-empty">没有匹配的接口</div>
          <el-pagination
            v-if="liveIfaceTotal > PAGE_SIZES[0]"
            v-model:current-page="liveIfacePage"
            v-model:page-size="liveIfaceSize"
            class="table-pagination"
            background
            small
            layout="total, sizes, prev, pager, next"
            :page-sizes="PAGE_SIZES"
            :total="liveIfaceTotal"
          />
          </div>
        </template>

        <div v-else class="detail-empty">从左侧选择需求单、分支或 Controller</div>
      </main>
    </div>

    <el-dialog v-model="dialog" :title="editing ? '编辑集合' : '新建集合'" width="480px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item label="归属项目" required>
          <el-select v-model="form.project" style="width: 100%">
            <el-option v-for="p in projects" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 APP-GLOBAL-DATA" />
        </el-form-item>
        <el-form-item label="范围">
          <el-radio-group v-model="form.scope">
            <el-radio value="TEST">分支涉及的接口用例</el-radio>
            <el-radio value="LIVE">全量接口用例</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.scope === 'TEST'" label="需求单">
          <el-input v-model="form.requirementNo" placeholder="APP-xxxx（可留空）" />
        </el-form-item>
        <el-form-item v-if="form.scope === 'TEST'" label="版本">
          <el-input v-model="form.appVersion" placeholder="如 9.3 国内客户端" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="runDialog" title="执行集合" :width="prodGuardOn ? '640px' : '460px'" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="集合">
          <b>{{ runTarget?.name }}</b><template v-if="runTarget?.caseCount != null">（{{ runTarget.caseCount }} 条）</template>
        </el-form-item>
        <el-form-item label="环境">
          <el-radio-group v-model="runEnv">
            <el-radio-button value="TEST">测试</el-radio-button>
            <el-radio-button value="PROD">线上</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="runEnv === 'PROD' && prodJudge.loading">
          <span class="pg-hint">正在逐条判断会不会改数据…</span>
        </el-form-item>
        <el-form-item v-else-if="runEnv === 'PROD' && !prodJudge.supported">
          <el-checkbox v-model="confirmProd">我确认要在线上环境执行</el-checkbox>
        </el-form-item>
      </el-form>

      <!-- 线上：只读的才能勾，写数据/读写未知的列出来但勾不上。列表说的是「这些不给你跑」，不是「你确认一下」 -->
      <div v-if="prodGuardOn" class="pg">
        <div class="pg-head">
          <span>可以跑 <b class="pg-ok">{{ prodAllowed.length }}</b> 条只读用例</span>
          <span v-if="prodBlocked.length">· 不给跑 <b class="pg-bad">{{ prodBlocked.length }}</b> 条</span>
          <span class="pg-spacer" />
          <el-checkbox
            v-if="prodAllowed.length"
            :model-value="prodPicked.length === prodAllowed.length"
            :indeterminate="prodPicked.length > 0 && prodPicked.length < prodAllowed.length"
            @change="(v: boolean) => (prodPicked = v ? prodAllowed.map((x) => x.c.id) : [])"
          >全选只读</el-checkbox>
        </div>
        <div class="pg-list">
          <div
            v-for="v in prodJudge.verdicts"
            :key="v.c.id"
            class="pg-row"
            :class="{ 'is-blocked': !v.allowed }"
            @click.self="v.allowed && togglePicked(v.c.id, !prodPicked.includes(v.c.id))"
          >
            <el-checkbox
              :model-value="v.allowed && prodPicked.includes(v.c.id)"
              :disabled="!v.allowed"
              @change="(on: boolean) => togglePicked(v.c.id, on)"
            />
            <span class="pg-tag" :class="v.c.testOnly ? 'is-unknown' : WRITE_EFFECT_META[v.effect].cls">
              {{ v.c.testOnly ? '仅测试' : WRITE_EFFECT_META[v.effect].text }}
            </span>
            <span class="pg-main">
              <span class="pg-name">{{ v.c.name || v.c.path }}</span>
              <span class="pg-path">{{ v.c.method }} {{ v.c.path }}</span>
              <span v-if="!v.allowed" class="pg-reason">{{ v.reason }}</span>
            </span>
          </div>
          <div v-if="!prodJudge.verdicts.length" class="pg-empty">这个集合里没有启用的用例</div>
        </div>
      </div>

      <template #footer>
        <el-button @click="runDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="running"
          :disabled="runDisabled"
          @click="doRun"
        >
          {{ prodGuardOn ? `在线上执行 ${prodPicked.length} 条` : '开始执行' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="caseDrawer"
      width="780px"
      class="case-edit-dialog"
      :show-close="false"
      append-to-body
      destroy-on-close
    >
      <template #header="{ close }">
        <div class="ce-head">
          <div class="ce-head-main">
            <div class="ce-title">{{ caseForm.id ? '编辑用例' : '新建用例' }}</div>
            <div v-if="caseForm.path" class="ce-sub">
              <span class="method-tag" :class="methodClass(caseForm.method)">{{ caseForm.method }}</span>
              <code class="ce-path">{{ caseForm.path }}</code>
            </div>
          </div>
          <button type="button" class="ce-close" aria-label="关闭" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>

      <!--
        原来 Headers / 断言 是两个裸 JSON 文本框：少一个引号整条失效，
        而报错只说「断言解析异常」，不说是哪一行。改成键值行——
        这是 Postman 那套形式，好处不是好看，是<b>写不出语法错</b>
      -->
      <el-tabs v-model="editTab" class="ce-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <el-form label-width="72px" class="ce-form">
            <el-form-item label="名称" required>
              <el-input v-model="caseForm.name" />
            </el-form-item>
            <el-form-item label="请求" required>
              <div class="ce-req">
                <el-select v-model="caseForm.method" class="ce-method">
                  <el-option v-for="m in httpMethods" :key="m" :label="m" :value="m" />
                </el-select>
                <el-input v-model="caseForm.path" class="ce-path-input" />
              </div>
            </el-form-item>
            <el-form-item label="地址">
              <div class="ce-url">
                <el-select v-model="caseForm.urlId" class="ce-url-select">
                  <el-option label="按执行环境自动选" value="" />
                  <el-option
                    v-for="u in urlEntries"
                    :key="u.id"
                    :label="`固定用 ${u.name}（${u.baseUrl}）`"
                    :value="u.id"
                  />
                </el-select>
                <div v-for="p in urlPreview" :key="p.key" class="ce-url-line">
                  <span class="ce-env" :class="p.cls">{{ p.label }}</span>
                  <code class="ce-url-full" :title="p.url">{{ p.url || '未配置地址' }}</code>
                  <button v-if="p.url" type="button" class="ce-copy" title="复制" @click="copyText(p.url)">
                    <el-icon><CopyDocument /></el-icon>
                  </button>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="说明">
              <el-input v-model="caseForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
            </el-form-item>
            <el-form-item label="来源分支">
              <el-input
                v-model="caseForm.sourceBranch"
                clearable
                placeholder="为哪个提测分支写的，如 mike/20260901/APP-9083；不填就是回归用例"
              />
            </el-form-item>
            <el-form-item label="用例类型">
              <div class="ce-kind">
                <el-radio-group v-model="caseForm.caseKind" size="small" @click="caseKindTouched = true">
                  <el-radio-button value="BRANCH">分支用例</el-radio-button>
                  <el-radio-button value="REGRESSION">回归用例</el-radio-button>
                  <el-radio-button v-if="caseForm.id" value="UNCLASSIFIED">未分类</el-radio-button>
                </el-radio-group>
                <div class="kv-hint">
                  <template v-if="caseForm.caseKind === 'BRANCH' && !caseForm.sourceBranch.trim()">
                    <b>分支用例没填来源分支</b>：分支合进 master 后没法提醒你来分诊，请补上
                  </template>
                  <template v-else-if="caseForm.caseKind">{{ CASE_KIND_META[caseForm.caseKind].hint }}</template>
                  <template v-else>不选就按来源分支定：填了是分支用例，没填是回归用例</template>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane name="params">
          <template #label>Params <span class="kv-count">{{ activeCount(paramRows) }}</span></template>
          <KvTable v-model="paramRows" key-ph="参数名" val-ph="值" :variables="caseVars" />
          <div class="kv-hint">URL 上的 query 参数。勾选框决定这次是否传它；点行的 + 在下方新增一行</div>
        </el-tab-pane>

        <el-tab-pane name="headers">
          <template #label>Headers <span class="kv-count">{{ activeCount(headerRows) }}</span></template>
          <KvTable v-model="headerRows" key-ph="头名称" val-ph="值" :variables="caseVars" />
          <div class="kv-hint">token 不用填，执行时按环境自动注入</div>
        </el-tab-pane>

        <el-tab-pane name="body">
          <template #label>Body <span class="kv-count">{{ caseForm.body?.trim() ? 1 : 0 }}</span></template>
          <el-input v-model="caseForm.body" type="textarea" :rows="12" placeholder="POST/PUT 的 JSON" class="ce-body" />
          <el-button size="small" text type="primary" class="kv-hint" @click="formatBody">格式化</el-button>
        </el-tab-pane>

        <el-tab-pane name="assert">
          <template #label>断言 <span class="kv-count">{{ assertRows.length }}</span></template>
          <div v-if="!assertRaw">
            <div class="as-list">
            <div v-for="(a, i) in assertRows" :key="i" class="as-row">
              <el-select v-model="a.type" style="width: 108px" @change="onAssertType(a)">
                <el-option label="状态码" value="status" />
                <el-option label="字段" value="jsonPath" />
                <el-option label="响应含" value="bodyIncludes" />
                <el-option label="响应头" value="header" />
                <el-option label="查库" value="db" />
                <el-option label="查库增量" value="dbDelta" />
              </el-select>
              <el-input
                v-if="a.type === 'jsonPath'"
                v-model="a.path"
                placeholder="$.data.total"
                class="as-path"
              />
              <el-input
                v-else-if="a.type === 'header'"
                v-model="a.path"
                placeholder="content-type"
                class="as-path"
              />
              <el-input
                v-else-if="a.type === 'db' || a.type === 'dbDelta'"
                v-model="a.path"
                placeholder="SELECT COUNT(*) FROM 表 WHERE 条件"
                class="as-path"
              />
              <el-select
                v-if="a.type !== 'status' && a.type !== 'bodyIncludes'"
                v-model="a.op"
                style="width: 104px"
              >
                <el-option v-for="o in assertOps" :key="o.v" :label="o.l" :value="o.v" />
              </el-select>
              <el-input
                v-if="a.op !== 'exists' && a.op !== 'notEmpty'"
                v-model="a.value"
                placeholder="期望值"
                class="as-val"
              />
              <button type="button" class="as-del" title="删除" @click="assertRows.splice(i, 1)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
            <button type="button" class="as-add" @click="addAssert">
              <el-icon><Plus /></el-icon>加一条断言
            </button>
            </div>
            <div v-if="assertUnknown.length" class="kv-hint">
              另有 {{ assertUnknown.length }} 条这里编辑不了的断言，已原样保留（切「源码」查看）
            </div>
            <div class="kv-hint">
              <b>只断状态码等于没验</b>：接口返回 200 但 data 是空的，那种用例照样是绿的
            </div>
          </div>
          <el-input v-else v-model="caseForm.assertions" type="textarea" :rows="10" />
          <el-button size="small" text class="kv-hint" @click="toggleAssertRaw">
            {{ assertRaw ? '← 回到表格' : '源码…' }}
          </el-button>
        </el-tab-pane>

        <el-tab-pane label="运行设置" name="settings">
          <div class="ce-setting">
            <div class="ce-setting-text">
              <div class="ce-setting-title" :class="{ on: caseForm.enabled }">启用该用例</div>
              <div class="ce-setting-sub">关闭后执行集合时会跳过它，但不会删除</div>
            </div>
            <el-switch v-model="caseForm.enabled" style="--el-switch-on-color: var(--el-color-success)" />
          </div>
          <div class="ce-setting">
            <div class="ce-setting-text">
              <div class="ce-setting-title">只在测试环境跑</div>
              <div class="ce-setting-sub">打开后切到生产环境时会自动跳过，避免打到线上</div>
            </div>
            <el-switch v-model="caseForm.testOnly" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <div class="ce-foot">
          <span class="ce-saved">{{ caseForm.updatedAt ? `上次保存 ${fmtSaved(caseForm.updatedAt)}` : '' }}</span>
          <el-button @click="caseDrawer = false">取消</el-button>
          <el-button type="primary" :loading="caseSaving" @click="saveCaseForm">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <BranchTriageDrawer
      v-model="triageVisible"
      :projects="projects"
      :default-project="selectedCollection?.project || selectedController?.code || ''"
      @changed="refreshCurrentCases"
    />

    <el-dialog v-model="importDocVisible" title="导入接口文档" width="560px" destroy-on-close>
      <el-radio-group v-model="importDocMode" size="small" style="margin-bottom: 12px">
        <el-radio-button value="docx">上传 .docx（Confluence 导出）</el-radio-button>
        <el-radio-button value="openapi">粘贴 OpenAPI JSON</el-radio-button>
      </el-radio-group>

      <p class="import-tip">
        文档补的是抓包补不了的那一半：<b>必填、默认值、枚举回落、边界、哪些字段可空</b>。
        只有抓包的话，用例就是把这次调用重放一遍，边界一条都验不到；
        更要紧的是它会给文档写明「可空」的字段生成非空断言 —— 那种用例正常情况下也会红。
        <br />
        文档字段一律标「仅参考」，<b>不直接变成断言</b>。
      </p>

      <template v-if="importDocMode === 'docx'">
        <input ref="docFileInput" type="file" accept=".docx" style="display: none" @change="onDocFilePicked" />
        <el-button plain @click="docFileInput?.click()">选择 .docx 文件</el-button>
        <span v-if="docFile" class="import-file">{{ docFile.name }}</span>
      </template>
      <el-input
        v-else
        v-model="importDocContent"
        type="textarea"
        :rows="12"
        placeholder="粘贴 OpenAPI JSON…"
      />

      <div v-if="importResult" class="import-result">
        <div>写入接口清单 <b>{{ importResult.matched }}</b> 个</div>
        <div v-if="importResult.unmatched?.length" class="import-warn">
          文档里有、清单里没有的 {{ importResult.unmatched.length }} 个：
          {{ importResult.unmatched.slice(0, 3).join('、') }}
          <br />
          这些多半是<b>还没被抓包或对比分析覆盖到</b>的接口 —— 那就是漏测点。
        </div>
        <div v-if="importResult.aliasApplied?.length" class="cap-doc-dim">
          另有 {{ importResult.aliasApplied.length }} 条按<b>同名透传</b>推断着套过去了
          （如 GLD 直连和 DC 编排是同一个契约）：{{ importResult.aliasApplied.slice(0, 2).join('；') }}
          <br />这是推断不是文档写的，不对的话在接口清单里改。
        </div>
        <div v-if="importResult.branches?.length" class="import-dim">
          文档提到的分支：{{ importResult.branches.join('、') }}
        </div>
      </div>

      <template #footer>
        <el-button @click="importDocVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importingDoc" @click="submitImportDoc">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, Close, CopyDocument, Delete, FolderOpened, Plus, Search, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import KvTable, { type KvRow, type KvVariable } from '../components/KvTable.vue'
import type { MustTestItem } from '../components/api-testing/MustTestBoard.vue'
import {
  WRITE_EFFECT_META,
  guardProdRun,
  judgeProdCases,
  type CaseRef,
  type ProdVerdict
} from '../utils/writeEffect'
import {
  CASE_KIND_META,
  CASE_KIND_OPTIONS,
  caseKindTitle,
  hasCaseKind,
  invalidateCaseKindIndex,
  kindOf,
  type ApiCaseKind
} from '../utils/caseKind'
import BranchTriageDrawer from '../components/api-testing/BranchTriageDrawer.vue'

type TreeNode = {
  nodeKey: string
  label: string
  meta?: string
  statusTag?: string
  method?: string
  isFolder?: boolean
  kind: 'category' | 'project' | 'branch-group' | 'req-group' | 'collection' | 'interface' | 'controller' | 'endpoint'
  collection?: any
  requirementNo?: string
  sourceBranch?: string
  project?: string
  projectLabel?: string
  runCollectionId?: string
  handler?: string
  code?: string
  path?: string
  linkId?: string
  endpointId?: string
  coreTotal?: number
  coreCovered?: number
  /** Controller 下的接口路径和用例名，树上搜接口时靠它命中 */
  searchText?: string
  children?: TreeNode[]
}

const router = useRouter()
const route = useRoute()

const scope = ref<'TEST' | 'LIVE'>('TEST')
const appVersion = ref('')
const includeArchived = ref(false)
const versionOptions = ref<string[]>([])
const projects = ref<string[]>([])
const loading = ref(false)
const grouping = ref(false)
const saving = ref(false)
const running = ref(false)
const treeData = ref<TreeNode[]>([])
const projectFilter = computed(() => String(route.query.project || '').trim())
const treeKeyword = ref('')
function filterTreeByKeyword(nodes: TreeNode[], kw: string): TreeNode[] {
  const out: TreeNode[] = []
  for (const n of nodes) {
    const text = `${n.label || ''}\n${n.path || ''}\n${n.searchText || ''}`.toLowerCase()
    if (text.includes(kw)) {
      out.push(n)
      continue
    }
    const children = filterTreeByKeyword(n.children || [], kw)
    if (children.length) out.push({ ...n, children })
  }
  return out
}
const filteredTree = computed(() => {
  const code = projectFilter.value
  const byProject = !code
    ? treeData.value
    : treeData.value
        .map((cat) => ({ ...cat, children: (cat.children || []).filter((p) => p.project === code) }))
        .filter((cat) => cat.children.length)
  const kw = treeKeyword.value.trim().toLowerCase()
  return kw ? filterTreeByKeyword(byProject, kw) : byProject
})

/** 左侧分页单位：全量用例按 Controller，分支用例按集合 */
const NAV_PAGE_SIZE = 20
const navPage = ref(1)
const navUnitKind = computed(() => (scope.value === 'LIVE' ? 'controller' : 'collection'))

function countNavUnits(nodes: TreeNode[], kind: string): number {
  let n = 0
  for (const node of nodes) {
    if (node.kind === kind) n++
    else if (node.children?.length) n += countNavUnits(node.children, kind)
  }
  return n
}

/** 只留 [from, to) 区间内的单位节点，没有剩下单位的文件夹一并去掉 */
function sliceNavUnits(nodes: TreeNode[], kind: string, from: number, to: number, counter: { i: number }): TreeNode[] {
  const out: TreeNode[] = []
  for (const node of nodes) {
    if (counter.i >= to) break
    if (node.kind === kind) {
      if (counter.i >= from) out.push(node)
      counter.i++
      continue
    }
    if (!node.children?.length) continue
    const children = sliceNavUnits(node.children, kind, from, to, counter)
    if (children.length) out.push({ ...node, children })
  }
  return out
}

const navTotal = computed(() => countNavUnits(filteredTree.value, navUnitKind.value))
const visibleTree = computed(() => {
  if (navTotal.value <= NAV_PAGE_SIZE) return filteredTree.value
  const from = (navPage.value - 1) * NAV_PAGE_SIZE
  return sliceNavUnits(filteredTree.value, navUnitKind.value, from, from + NAV_PAGE_SIZE, { i: 0 })
})
watch([treeKeyword, projectFilter, scope], () => {
  navPage.value = 1
})
watch(navTotal, (total) => {
  const pages = Math.max(1, Math.ceil(total / NAV_PAGE_SIZE))
  if (navPage.value > pages) navPage.value = pages
})
const treeRef = ref()
/** 树每次换数据都会重建节点，手动展开的要记下来，否则点一下集合别的都收起了 */
const userExpandedKeys = ref<string[]>([])
/** 默认展开的文件夹被手动收起后，不能再被默认规则展开回去 */
const userCollapsedKeys = ref<string[]>([])
const treeExpandedKeys = computed(() => {
  const kw = treeKeyword.value.trim()
  const collapsed = new Set(userCollapsedKeys.value)
  const out: string[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (!n.children?.length) continue
      // 集合下面是接口，默认收起，点开才渲染
      if ((kw || n.kind !== 'collection') && !collapsed.has(n.nodeKey)) out.push(n.nodeKey)
      walk(n.children)
    }
  }
  walk(visibleTree.value)
  return [...out, ...userExpandedKeys.value.filter((k) => !collapsed.has(k))]
})
function onTreeExpand(data: TreeNode) {
  const key = data.nodeKey
  if (userCollapsedKeys.value.includes(key)) {
    userCollapsedKeys.value = userCollapsedKeys.value.filter((k) => k !== key)
  }
  if (!userExpandedKeys.value.includes(key)) {
    userExpandedKeys.value = [...userExpandedKeys.value, key]
  }
}
function onTreeCollapse(data: TreeNode) {
  const key = data.nodeKey
  if (userExpandedKeys.value.includes(key)) {
    userExpandedKeys.value = userExpandedKeys.value.filter((k) => k !== key)
  }
  if (!userCollapsedKeys.value.includes(key)) {
    userCollapsedKeys.value = [...userCollapsedKeys.value, key]
  }
}
function expandTreeNode(nodeKey: string) {
  treeRef.value?.getNode?.(nodeKey)?.expand?.()
  onTreeExpand({ nodeKey } as TreeNode)
}
const collectionCases = ref<any[]>([])
const caseKeyword = ref('')
const selectedCollection = ref<any>(null)
const selectedInterface = ref<{
  method: string
  path: string
  label?: string
  linkId?: string
  endpointId?: string
} | null>(null)
const selectedController = ref<{
  label: string
  code: string
  handler: string
  runCollectionId?: string
} | null>(null)

const dialog = ref(false)
const runDialog = ref(false)
const editing = ref(false)
const runTarget = ref<any>(null)
const runEnv = ref('TEST')
/** 全量用例在哪个环境跑；默认测试，线上要主动切 */
const liveRunEnv = ref<'TEST' | 'PROD'>('TEST')
const confirmProd = ref(false)
const autoGroupProject = ref('')

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const caseDrawer = ref(false)
let editingRow: any = null
const caseSaving = ref(false)
const runningCaseId = ref('')
const generatingCase = ref(false)
const runningCase = ref(false)
const importDocVisible = ref(false)
const importDocContent = ref('')
const importingDoc = ref(false)
const importDocMode = ref<'docx' | 'openapi'>('docx')
const docFileInput = ref<HTMLInputElement>()
const docFile = ref<File | null>(null)
const importResult = ref<any>(null)

function onDocFilePicked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  docFile.value = f || null
  importResult.value = null
}
const editTab = ref('basic')
const paramRows = ref<KvRow[]>([])
const headerRows = ref<KvRow[]>([])
const assertRaw = ref(false)

type AssertRow = { type: string; path: string; op: string; value: string }
const assertRows = ref<AssertRow[]>([])
/** 表格编辑不了的断言原样留着——编辑器不认识不等于它没用 */
const assertUnknown = ref<any[]>([])

const assertOps = [
  { v: 'eq', l: '等于' },
  { v: 'ne', l: '不等于' },
  { v: 'contains', l: '包含' },
  { v: 'notContains', l: '不包含' },
  { v: 'exists', l: '存在' },
  { v: 'notEmpty', l: '非空' },
  { v: 'gt', l: '大于' },
  { v: 'gte', l: '大于等于' },
  { v: 'lt', l: '小于' },
  { v: 'lte', l: '小于等于' },
  { v: 'matches', l: '匹配正则' }
]

function activeCount(rows: KvRow[]) {
  const n = rows.filter((r) => r.enabled && r.key.trim()).length
  return n ? `(${n})` : ''
}

function addAssert() {
  assertRows.value.push({ type: 'jsonPath', path: '', op: 'eq', value: '' })
}

function onAssertType(a: AssertRow) {
  if (a.type === 'status') {
    a.op = 'eq'
    a.path = ''
  }
}

function formatBody() {
  try {
    caseForm.value.body = JSON.stringify(JSON.parse(caseForm.value.body || '{}'), null, 2)
  } catch {
    ElMessage.warning('不是合法 JSON，没法格式化')
  }
}

/** query 串 ⇄ 行 */
function queryToRows(q?: string): KvRow[] {
  const s = (q || '').trim()
  if (!s) return []
  if (s.startsWith('{')) return jsonToRows(s)
  return s
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('=')
      return {
        enabled: (i < 0 ? p : p.slice(0, i)).trim().length > 0,
        key: i < 0 ? p : p.slice(0, i),
        value: i < 0 ? '' : p.slice(i + 1)
      }
    })
}

function rowsToQuery(rows: KvRow[]) {
  const s = rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => `${r.key.trim()}=${r.value}`)
    .join('&')
  return s || undefined
}

function jsonToRows(json?: string): KvRow[] {
  try {
    const o = JSON.parse(json || '{}')
    if (!o || typeof o !== 'object') return []
    return Object.entries(o).map(([key, value]) => ({
      enabled: !!String(key || '').trim(),
      key,
      value: value == null ? '' : String(value)
    }))
  } catch {
    return []
  }
}

function rowsToJson(rows: KvRow[]) {
  const o: Record<string, string> = {}
  rows.filter((r) => r.enabled && r.key.trim()).forEach((r) => (o[r.key.trim()] = r.value))
  return JSON.stringify(o)
}

/**
 * 断言 JSON ⇄ 行。
 * 认不出来的原样收进 assertUnknown，保存时再拼回去——
 * 编辑器不认识不等于它没用，丢掉的话人下次打开就发现断言少了几条。
 */
function assertsToRows(json?: string) {
  assertRows.value = []
  assertUnknown.value = []
  let arr: any[] = []
  try {
    const p = JSON.parse(json || '[]')
    arr = Array.isArray(p) ? p : []
  } catch {
    return
  }
  for (const a of arr) {
    if (a?.type === 'status') {
      assertRows.value.push({ type: 'status', path: '', op: 'eq', value: String(a.equals ?? 200) })
    } else if (a?.type === 'jsonPath' || a?.type === 'header' || a?.type === 'db' || a?.type === 'dbDelta') {
      const path = a.path ?? a.name ?? a.sql ?? ''
      let op = a.op
      let value = a.value
      // 老写法：{path, equals} / {path, exists} / {path, contains}
      if (!op) {
        if (a.exists !== undefined) {
          op = a.exists ? 'exists' : 'ne'
          value = ''
        } else if (a.equals !== undefined) {
          op = 'eq'
          value = a.equals
        } else if (a.notEquals !== undefined) {
          op = 'ne'
          value = a.notEquals
        } else if (a.contains !== undefined) {
          op = 'contains'
          value = a.contains
        } else {
          op = 'exists'
          value = ''
        }
      }
      assertRows.value.push({
        type: a.type,
        path: String(path),
        op,
        value: value == null ? '' : String(value)
      })
    } else if (a?.type === 'bodyIncludes') {
      assertRows.value.push({ type: 'bodyIncludes', path: '', op: 'contains', value: String(a.value ?? '') })
    } else {
      assertUnknown.value.push(a)
    }
  }
}

function rowsToAsserts() {
  const out: any[] = []
  for (const a of assertRows.value) {
    if (a.type === 'status') {
      out.push({ type: 'status', equals: Number(a.value) || 200 })
    } else if (a.type === 'bodyIncludes') {
      out.push({ type: 'bodyIncludes', value: a.value })
    } else if (a.type === 'header') {
      out.push({ type: 'header', name: a.path, op: a.op, value: a.value })
    } else if (a.type === 'db' || a.type === 'dbDelta') {
      out.push({ type: a.type, sql: a.path, op: a.op, value: a.value })
    } else {
      out.push({ type: 'jsonPath', path: a.path, op: a.op, value: a.value })
    }
  }
  return JSON.stringify(out.concat(assertUnknown.value))
}

function toggleAssertRaw() {
  if (!assertRaw.value) {
    // 进源码前先把表格里的写回去，否则看到的是打开时的旧内容
    caseForm.value.assertions = rowsToAsserts()
  } else {
    assertsToRows(caseForm.value.assertions)
  }
  assertRaw.value = !assertRaw.value
}

/** 打开编辑器时把 JSON 拆成行 */
function loadEditorRows() {
  paramRows.value = queryToRows(caseForm.value.query)
  headerRows.value = jsonToRows(caseForm.value.headers)
  assertsToRows(caseForm.value.assertions)
  assertRaw.value = false
  editTab.value = 'basic'
}

const caseForm = ref({
  id: '',
  query: '',
  project: '',
  environment: 'TEST',
  name: '',
  description: '',
  method: 'GET',
  path: '',
  headers: '{}',
  body: '',
  assertions: '[{"type":"status","equals":200}]',
  enabled: true,
  testOnly: false,
  sortOrder: 100,
  urlId: '',
  updatedAt: '',
  sourceBranch: '',
  caseKind: '' as ApiCaseKind | ''
})
/** 新建时类型跟着来源分支走；人点过一次就不再自动改。编辑已有用例一律视为点过——种类是存下来的，不是推出来的 */
const caseKindTouched = ref(false)
watch(
  () => caseForm.value.sourceBranch,
  (sb) => {
    if (!caseKindTouched.value) caseForm.value.caseKind = String(sb || '').trim() ? 'BRANCH' : 'REGRESSION'
  }
)

const envBase = ref<Record<string, string>>({})
const urlEntries = ref<any[]>([])
const caseVars = ref<KvVariable[]>([])

const BUILTIN_VARS: KvVariable[] = [
  { name: 'token', builtin: '自动登录拿到的 token（执行时才有）' },
  { name: '$timestamp', builtin: '当前毫秒时间戳，每次执行都不同' },
  { name: '$timestampSec', builtin: '当前秒级时间戳' },
  { name: '$randomInt', builtin: '0～999999 随机整数' },
  { name: '$uuid', builtin: '随机 UUID' }
]

/** 测试 / 线上两套变量按名字合并：同一个 {{steamId}} 执行时按环境各取各的值 */
async function loadCaseVars(project?: string) {
  const [test, prod] = await Promise.all(
    ['TEST', 'PROD'].map((env) => apiClient.getApiTestVariables(env, project || undefined).catch(() => []))
  )
  const byName = new Map<string, KvVariable>()
  const put = (list: any[], key: 'test' | 'prod') => {
    for (const v of Array.isArray(list) ? list : []) {
      if (!v?.name || v.enabled === false) continue
      const cur = byName.get(v.name) || { name: v.name }
      cur[key] = v.value ?? ''
      cur.secret = cur.secret || !!v.secret
      byName.set(v.name, cur)
    }
  }
  put(test, 'test')
  put(prod, 'prod')
  const real = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  caseVars.value = [...real, ...BUILTIN_VARS.filter((b) => !byName.has(b.name))]
}

async function loadUrlContext(project?: string) {
  urlEntries.value = []
  loadCaseVars(project)
  try {
    if (!Object.keys(envBase.value).length) {
      const envs = await apiClient.getApiTestEnvs()
      envBase.value = Object.fromEntries(
        (envs || []).filter((e) => e.baseUrl).map((e) => [String(e.environment).toUpperCase(), e.baseUrl])
      )
    }
    if (project) {
      urlEntries.value = ((await apiClient.getApiUrls({ project })) || []).filter((u: any) => u.enabled !== false)
    }
  } catch {
    /* 地址预览拿不到不影响编辑 */
  }
}

const ENV_LABEL: Record<string, { label: string; cls: string }> = {
  TEST: { label: '测试', cls: 'is-test' },
  PROD: { label: '线上', cls: 'is-prod' }
}

const urlPreview = computed(() => {
  const qs = rowsToQuery(paramRows.value)
  const join = (base?: string) => {
    if (!base) return ''
    const p = caseForm.value.path.trim()
    if (/^https?:\/\//.test(p)) return p + (qs ? `?${qs}` : '')
    return base.replace(/\/+$/, '') + (p.startsWith('/') ? p : `/${p}`) + (qs ? `?${qs}` : '')
  }
  const bound = urlEntries.value.find((u) => u.id === caseForm.value.urlId)
  if (bound) {
    const env = ENV_LABEL[String(bound.environment).toUpperCase()] || { label: '固定', cls: '' }
    return [{ key: 'bound', ...env, url: join(bound.baseUrl) }]
  }
  return ['TEST', 'PROD'].map((k) => ({ key: k, ...ENV_LABEL[k], url: join(autoBase(k)) }))
})

/** 与后端执行器一致：项目在该环境的地址（同环境优先于 ANY，按排序取第一条），没有才退回全局环境 */
function autoBase(env: string) {
  const usable = urlEntries.value.filter((u: any) => u.baseUrl)
  const envOf = (u: any) => String(u.environment || '').toUpperCase()
  const hit = usable.find((u: any) => envOf(u) === env) || usable.find((u: any) => envOf(u) === 'ANY')
  return hit?.baseUrl || envBase.value[env]
}

async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

function fmtSaved(v: string) {
  const m = String(v).match(/^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : v
}

const form = ref<any>({
  id: '',
  project: '',
  name: '',
  description: '',
  sortOrder: 100,
  enabled: true,
  scope: 'TEST',
  requirementNo: '',
  appVersion: ''
})

const treeProps = { children: 'children', label: 'label' }

const collectionTitle = computed(() => {
  const c = selectedCollection.value
  if (!c) return ''
  if (c.requirementNo) return c.requirementNo
  if (c.sourceBranch) return c.sourceBranch
  return collectionDisplayName(c)
})

const currentProject = computed(() => {
  const q = String(route.query.project || '').trim()
  return (
    selectedCollection.value?.project ||
    selectedController.value?.code ||
    q ||
    undefined
  )
})

async function onMustTestSelect(item: MustTestItem) {
  if (!item.path) return
  const node = findTreeNode((n) => {
    if (!n.path) return false
    const methodOk = !item.httpMethod || !n.method || n.method.toUpperCase() === item.httpMethod.toUpperCase()
    return methodOk && (n.path === item.path || n.path.endsWith(item.path) || item.path.endsWith(n.path))
  })
  if (node) {
    await selectTreeNode(node)
    return
  }
  ElMessage.info(`左侧树里还没有 ${item.httpMethod || ''} ${item.path}，先在清单生成用例或归入集合`)
}

const collectionStatusTag = computed(() => {
  const c = selectedCollection.value
  if (!c) return ''
  if (c.statusTag) return c.statusTag
  if (c.passRate != null && c.passRate >= 100) return '已验证'
  if (c.requirementNo) return '进行中'
  return c.sourceBranch ? '待测' : ''
})

const progressStats = computed(() => {
  let passed = 0
  let disabled = 0
  for (const row of collectionCases.value) {
    if (row.enabled) passed++
    else disabled++
  }
  return { passed, disabled, total: collectionCases.value.length }
})

function casePriority(r: any) {
  if (r.level === 'CORE') return 0
  if (r.testOnly) return 1
  return 2
}

function sortByPriority<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => casePriority(a) - casePriority(b))
}

const kindFilter = ref<ApiCaseKind | ''>('')
const triageVisible = ref(false)
function byKind(rows: any[]) {
  return kindFilter.value ? rows.filter((r) => kindOf(r) === kindFilter.value) : rows
}

const interfaceCaseRows = computed(() => {
  if (!selectedInterface.value) return []
  const { method, path } = selectedInterface.value
  let rows = collectionCases.value.filter(
    (r) => String(r.method || '').toUpperCase() === method.toUpperCase() && String(r.path || '') === path
  )
  const kw = caseKeyword.value.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(
      (r) =>
        String(r.name || '').toLowerCase().includes(kw) ||
        String(r.path || '').toLowerCase().includes(kw) ||
        String(r.description || '').toLowerCase().includes(kw)
    )
  }
  return sortByPriority(byKind(rows))
})

const selectedInterfaceCases = computed(() => interfaceCaseRows.value)

const PAGE_SIZES = [20, 50, 100]
const ifaceCasePage = ref(1)
const ifaceCaseSize = ref(PAGE_SIZES[0])
const pagedInterfaceCaseRows = computed(() => {
  const from = (ifaceCasePage.value - 1) * ifaceCaseSize.value
  return interfaceCaseRows.value.slice(from, from + ifaceCaseSize.value)
})
watch([selectedInterface, caseKeyword, kindFilter], () => {
  ifaceCasePage.value = 1
})

function scenarioOf(row: any) {
  const name = String(row?.name || '')
  const i = name.indexOf(' · ')
  return i > 0 ? name.slice(i + 3) : name
}

/** 生产 Controller 视图：接口按页从后端取，每个接口自带用例，点开才渲染 */
const liveIfaceItems = ref<any[]>([])
const liveIfaceTotal = ref(0)
const liveCaseTotal = ref(0)
const liveIfacePage = ref(1)
const liveIfaceSize = ref(PAGE_SIZES[0])
const liveLoading = ref(false)
const expandedIfaceKeys = ref<string[]>([])
let liveSeq = 0
let liveQueryKey = ''

function ifaceRowKey(g: { method?: string; path?: string }) {
  return `if:${String(g.method || 'GET').toUpperCase()} ${g.path || ''}`
}

const ifaceGroups = computed(() =>
  liveIfaceItems.value.map((g) => {
    const rowKey = ifaceRowKey(g)
    const cases: any[] = g.cases || []
    return {
      rowKey,
      isIface: true,
      method: g.method,
      path: g.path,
      title: g.title,
      level: g.level,
      caseCount: cases.length,
      enabledCount: cases.filter((c) => c.enabled).length,
      allCases: cases,
      // 收起时不给 children：表格就不会把它们渲染成隐藏行
      children: expandedIfaceKeys.value.includes(rowKey) ? cases : []
    }
  })
)

function liveQuery() {
  const ctrl = selectedController.value
  return {
    code: ctrl?.code || '',
    params: {
      controller: ctrl?.handler || undefined,
      keyword: caseKeyword.value.trim() || undefined,
      kind: kindFilter.value || undefined,
      page: liveIfacePage.value,
      size: liveIfaceSize.value,
      includeArchived: includeArchived.value
    }
  }
}

function resetLiveInterfaces() {
  liveSeq++
  liveQueryKey = ''
  liveIfaceItems.value = []
  liveIfaceTotal.value = 0
  liveCaseTotal.value = 0
  liveIfacePage.value = 1
  expandedIfaceKeys.value = []
  liveLoading.value = false
}

async function loadLiveInterfaces(opts: { force?: boolean; keepExpanded?: boolean } = {}) {
  const { code, params } = liveQuery()
  if (!code) return
  const key = JSON.stringify([code, params])
  if (!opts.force && key === liveQueryKey) return
  liveQueryKey = key
  const seq = ++liveSeq
  liveLoading.value = true
  try {
    const res = await apiClient.getApiTestLiveInterfaces(code, params)
    if (seq !== liveSeq) return
    liveIfaceItems.value = res.items || []
    liveIfaceTotal.value = res.total || 0
    liveCaseTotal.value = res.caseTotal || 0
    if (res.page && res.page !== liveIfacePage.value) {
      liveIfacePage.value = res.page
      liveQueryKey = JSON.stringify([code, liveQuery().params])
    }
    const keys = new Set(liveIfaceItems.value.map(ifaceRowKey))
    expandedIfaceKeys.value = params.keyword
      ? [...keys]
      : opts.keepExpanded
        ? expandedIfaceKeys.value.filter((k) => keys.has(k))
        : []
  } catch (e: any) {
    if (seq !== liveSeq) return
    liveQueryKey = ''
    liveIfaceItems.value = []
    liveIfaceTotal.value = 0
    liveCaseTotal.value = 0
    ElMessage.error(e?.message || '加载接口失败')
  } finally {
    if (seq === liveSeq) liveLoading.value = false
  }
}

function refreshLiveInterfaces() {
  return loadLiveInterfaces({ force: true, keepExpanded: true })
}

let liveFilterTimer: ReturnType<typeof setTimeout> | undefined
watch([caseKeyword, kindFilter], () => {
  if (!selectedController.value) return
  clearTimeout(liveFilterTimer)
  liveFilterTimer = setTimeout(() => {
    liveIfacePage.value = 1
    loadLiveInterfaces()
  }, 300)
})
watch([liveIfacePage, liveIfaceSize], () => {
  if (selectedController.value) loadLiveInterfaces()
})

function onIfaceRowClick(row: any) {
  if (!row?.isIface) return
  const keys = expandedIfaceKeys.value
  expandedIfaceKeys.value = keys.includes(row.rowKey)
    ? keys.filter((k) => k !== row.rowKey)
    : [...keys, row.rowKey]
}

function onIfaceExpandChange(row: any, expanded: boolean) {
  if (row?.isIface && !expanded) {
    expandedIfaceKeys.value = expandedIfaceKeys.value.filter((k) => k !== row.rowKey)
  }
}

async function runIfaceCases(group: any) {
  let env: 'PROD' | 'TEST' = scope.value === 'LIVE' ? liveRunEnv.value : 'TEST'
  const rows = (group.allCases || []).filter((c: any) => c.enabled !== false && !(env === 'PROD' && c.testOnly))
  if (!rows.length) {
    ElMessage.warning(env === 'PROD' ? '这个接口下没有能在线上跑的启用用例' : '这个接口下没有启用的用例')
    return
  }
  let ids: string[] = rows.map((c: any) => c.id)
  if (env === 'PROD') {
    const g = await guardProdRun(rows, rows[0].project || selectedController.value?.code, group.title)
    if (g.mode === 'cancel') return
    ids = g.ids
    env = g.env
  }
  runningCaseId.value = group.rowKey
  try {
    const r = await apiClient.runApiTest({
      caseIds: ids,
      environment: env,
      confirmProd: env === 'PROD'
    })
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await refreshCurrentCases()
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningCaseId.value = ''
  }
}

function projectShort(code?: string) {
  if (!code) return '—'
  return code.replace(/^app-/, '').replace(/-/g, ' ')
}

function statusClass(tag: string) {
  if (tag === '已验证' || tag === '已上线') return 'ts-ok'
  if (tag === '进行中') return 'ts-run'
  return 'ts-pending'
}

function treeDisplayLabel(raw: string) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('APP-') || s.startsWith('app-')) {
    return s.replace(/^app-/i, 'APP-').toUpperCase()
  }
  return s.toUpperCase()
}

function collectionDisplayName(c: any) {
  return treeDisplayLabel(c?.name || c?.project || '')
}

function caseHostLabel(row: any) {
  const name = String(row?.name || '').trim()
  if (!name) return '—'
  const idx = name.indexOf('（')
  return idx > 0 ? name.slice(0, idx) : name
}

function caseMetaLabel(row: any) {
  const host = caseHostLabel(row)
  const status = row?.enabled ? '(待执行)' : '(已停用)'
  return `${host} ${status}`
}

function switchScope(next: 'TEST' | 'LIVE') {
  if (scope.value === next) return
  scope.value = next
  onScopeChange()
}

function methodClass(method: string) {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET') return 'm-get'
  if (m === 'POST') return 'm-post'
  if (m === 'PUT' || m === 'PATCH') return 'm-put'
  if (m === 'DELETE') return 'm-del'
  return 'm-other'
}

function fmt(s: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

async function toggleCaseEnabled(row: any) {
  const next = !row.enabled
  try {
    await apiClient.updateApiTestCase(row.id, {
      ...row,
      enabled: next,
      project: row.project || selectedCollection.value?.project || selectedController.value?.code
    })
    row.enabled = next
    ElMessage.success(next ? '已启用' : '已停用')
    if (selectedCollection.value && selectedInterface.value) {
      const node = findTreeNode(
        (n) =>
          n.kind === 'interface' &&
          String(n.method || '').toUpperCase() === selectedInterface.value!.method.toUpperCase() &&
          String(n.path || '') === selectedInterface.value!.path
      )
      if (node) {
        const ifaceCases = collectionCases.value.filter(
          (c) =>
            String(c.method || '').toUpperCase() === selectedInterface.value!.method.toUpperCase() &&
            String(c.path || '') === selectedInterface.value!.path
        )
        node.statusTag = interfaceStatusTag(ifaceCases)
        node.meta = ifaceCases.length ? String(ifaceCases.length) : undefined
      }
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

function onCollectionMore(cmd: string) {
  if (cmd === 'delete' && selectedCollection.value) {
    remove(selectedCollection.value)
  } else if (cmd === 'autoGroup') {
    autoGroup()
  }
}

function countGroupLeaves(groups: any[]): number {
  return (groups || []).reduce((sum, g) => sum + (g.collections || []).length, 0)
}

function categoryTreeLabel(cat: { key?: string; label?: string }) {
  if (cat.key === 'APP') return 'APP'
  if (cat.key === 'PVP') return 'PWA'
  if (cat.key === 'WEB') return 'WEB'
  return cat.label || cat.key || ''
}

function buildTree(categories: any[]): TreeNode[] {
  if (scope.value === 'LIVE') {
    return (categories || []).map((cat) => ({
      nodeKey: `cat:${cat.key}`,
      label: categoryTreeLabel(cat),
      kind: 'category' as const,
      isFolder: true,
      meta: String(cat.total ?? (cat.projects || []).reduce((s: number, p: any) => s + (p.caseCount ?? 0), 0)),
      children: (cat.projects || []).flatMap((proj: any) => {
        const projectNode: TreeNode = {
          nodeKey: `proj:${cat.key}:${proj.code}`,
          label: proj.code || proj.label,
          kind: 'project',
          isFolder: true,
          project: proj.code,
          meta: String(proj.caseCount ?? 0),
          children: (proj.controllers || []).map((ctrl: any) => ({
            nodeKey: `ctrl:${proj.code}:${ctrl.label}`,
            label: ctrl.label,
            kind: 'controller' as const,
            isFolder: false,
            project: proj.code,
            handler: ctrl.handler || ctrl.label,
            code: proj.code,
            runCollectionId: proj.runCollectionId,
            meta: String(ctrl.caseCount ?? 0),
            coreTotal: Number(ctrl.coreTotal || 0),
            coreCovered: Number(ctrl.coreCovered || 0),
            searchText: ctrl.searchText || ''
          }))
        }
        return [projectNode]
      })
    }))
  }

  return (categories || []).map((cat) => ({
    nodeKey: `cat:${cat.key}`,
    label: categoryTreeLabel(cat),
    kind: 'category' as const,
    isFolder: true,
    meta: String(cat.total ?? (cat.projects || []).reduce((s: number, p: any) => s + (p.collectionCount ?? 0), 0)),
    children: (cat.projects || []).map((proj: any) => ({
        nodeKey: `proj:${cat.key}:${proj.code}`,
        label: proj.code || proj.label,
        kind: 'project' as const,
        isFolder: true,
        project: proj.code,
        projectLabel: proj.label || proj.code,
        meta: String(proj.collectionCount ?? countGroupLeaves(proj.groups || [])),
        children: (proj.groups || []).flatMap((g: any) => {
          const groupNode: TreeNode = {
            nodeKey: g.key || `grp:${proj.code}:${g.label}`,
            label: g.label,
            kind: (g.kind || 'req-group') as TreeNode['kind'],
            isFolder: true,
            project: proj.code,
            meta: String((g.collections || []).length),
            children: (g.collections || []).map((col: any) => {
              const nodeKey = col.id
                ? `col:${col.id}`
                : `leaf:${proj.code}:${col.requirementNo || col.sourceBranch || col.label}`
              return {
                nodeKey,
                label: col.label || col.requirementNo || col.sourceBranch || col.name,
                kind: 'collection' as const,
                isFolder: true,
                children: interfaceNodesFromCol(col, proj.code, nodeKey),
                collection: col.id ? col : null,
                requirementNo: col.requirementNo,
                sourceBranch: col.sourceBranch,
                project: proj.code,
                projectLabel: proj.label || proj.code,
                statusTag: col.statusTag,
                meta:
                  col.interfaces?.length != null
                    ? String(col.interfaces.length)
                    : col.caseCount != null
                      ? String(col.caseCount)
                      : undefined
              }
            })
          }
          return [groupNode]
        })
      }))
    }))
}

async function loadTree() {
  loading.value = true
  try {
    const res = await apiClient.getApiTestCollectionTree({
      scope: scope.value,
      appVersion: scope.value === 'TEST' ? appVersion.value || undefined : undefined,
      includeArchived: includeArchived.value
    })
    treeData.value = buildTree(res.categories || [])
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = null
    collectionCases.value = []
    resetLiveInterfaces()
    caseKeyword.value = ''
  } catch (e: any) {
    treeData.value = []
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function refreshCurrentCases() {
  if (selectedController.value) {
    await refreshLiveInterfaces()
  } else {
    await refreshSelectedCases()
  }
}

async function refreshSelectedCases() {
  const c = selectedCollection.value
  if (!c) return
  const node = findTreeNode(
    (n) =>
      n.kind === 'collection' &&
      (n.collection?.id === c.id ||
        (c.virtual && (n.requirementNo === c.requirementNo || n.sourceBranch === c.sourceBranch)))
  )
  if (node) {
    await hydrateCollectionNode(node, c)
  } else if (c.id) {
    await loadCollectionCases(c.id)
  }
}

async function onNodeClick(data: TreeNode) {
  if (data.kind === 'category' || data.kind === 'branch-group' || data.kind === 'req-group' || data.kind === 'project') {
    return
  }
  if (data.kind === 'collection') {
    selectedController.value = null
    selectedInterface.value = null
    caseKeyword.value = ''
    const col = data.collection
    let collectionCtx: any
    if (col?.id) {
      collectionCtx = col
      selectedCollection.value = col
    } else {
      collectionCtx = {
        requirementNo: data.requirementNo || col?.requirementNo,
        sourceBranch: data.sourceBranch || col?.sourceBranch,
        project: data.project,
        name: data.label,
        statusTag: data.statusTag,
        virtual: true
      }
      selectedCollection.value = collectionCtx
    }
    if (data.children?.length) expandTreeNode(data.nodeKey)
    if (collectionCtx?.id) {
      await loadCollectionCases(collectionCtx.id)
    }
    if (!data.children?.length) {
      await hydrateCollectionNode(data, collectionCtx)
    }
    return
  }
  if (data.kind === 'interface') {
    selectedController.value = null
    selectedInterface.value = {
      method: data.method || 'GET',
      path: data.path || '',
      label: data.label,
      linkId: data.linkId,
      endpointId: data.endpointId
    }
    if (data.collection) {
      selectedCollection.value = data.collection
      if (data.collection.id && !collectionCases.value.length) {
        await loadCollectionCases(data.collection.id)
      }
    }
    caseKeyword.value = ''
    return
  }
  if (data.kind === 'controller') {
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = {
      label: data.label,
      code: data.code || data.project || '',
      handler: data.handler || data.label,
      runCollectionId: data.runCollectionId
    }
    const kw = treeKeyword.value.trim()
    resetLiveInterfaces()
    caseKeyword.value = kw && !data.label.toLowerCase().includes(kw.toLowerCase()) ? kw : ''
    await loadLiveInterfaces({ force: true })
    return
  }
  if (data.kind === 'endpoint' && data.project && data.handler) {
    selectedCollection.value = null
    selectedInterface.value = null
    selectedController.value = {
      label: data.handler,
      code: data.project,
      handler: data.handler
    }
    resetLiveInterfaces()
    caseKeyword.value = data.method ? String(data.path || '').split('/').pop() || '' : ''
    await loadLiveInterfaces({ force: true })
  }
}

function openCreateFromSelection() {
  const c = selectedCollection.value
  form.value = {
    id: '',
    project: c?.project || '',
    name: c?.requirementNo || c?.sourceBranch || '',
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: 'TEST',
    requirementNo: c?.requirementNo || '',
    appVersion: appVersion.value || ''
  }
  editing.value = false
  dialog.value = true
}

function interfaceKey(method?: string, path?: string) {
  return `${String(method || '').toUpperCase()}:${String(path || '').trim()}`
}

function interfaceStatusTag(cases: any[]) {
  if (!cases.length) return '待测'
  const enabled = cases.filter((c) => c.enabled).length
  if (enabled === cases.length) return '已启用'
  if (enabled > 0) return '进行中'
  return '待测'
}

function collectionContext(col: any, projectCode: string) {
  if (col?.id) return col
  return {
    requirementNo: col.requirementNo,
    sourceBranch: col.sourceBranch,
    project: projectCode,
    name: col.label || col.requirementNo || col.sourceBranch || col.name,
    statusTag: col.statusTag,
    virtual: true
  }
}

function interfaceTreeLabel(path?: string) {
  const p = String(path || '').trim()
  return p || '—'
}

function interfaceNodesFromCol(col: any, projectCode: string, parentNodeKey: string): TreeNode[] {
  const ctx = collectionContext(col, projectCode)
  return (col.interfaces || [])
    .map((item: any) => {
      const path = String(item.path || '').trim()
      if (!path) return null
      const method = String(item.method || 'GET').toUpperCase()
      const caseCount = Number(item.caseCount ?? 0)
      return {
        nodeKey: `if:${parentNodeKey}:${interfaceKey(method, path)}`,
        label: interfaceTreeLabel(path),
        kind: 'interface' as const,
        isFolder: false,
        method,
        path,
        project: projectCode,
        collection: ctx,
        requirementNo: col.requirementNo,
        sourceBranch: col.sourceBranch,
        linkId: item.linkId,
        endpointId: item.endpointId,
        statusTag: item.statusTag || (caseCount > 0 ? '进行中' : '待测'),
        meta: caseCount > 0 ? String(caseCount) : undefined
      }
    })
    .filter(Boolean) as TreeNode[]
}

function patchTreeNode(nodeKey: string, patch: Partial<TreeNode> & { children?: TreeNode[] }): void {
  const node = findTreeNode((n) => n.nodeKey === nodeKey)
  if (!node) return
  if (patch.children) node.children = patch.children
  if (patch.isFolder != null) node.isFolder = patch.isFolder
  treeData.value = treeData.value.slice()
}

function buildInterfaceChildren(
  cases: any[],
  endpoints: any[],
  parent: TreeNode,
  collectionCtx: any
): TreeNode[] {
  const grouped = new Map<
    string,
    { method: string; path: string; cases: any[]; controller?: string; linkId?: string; endpointId?: string }
  >()
  for (const ep of endpoints) {
    const method = String(ep.httpMethod || ep.method || 'GET').toUpperCase()
    const path = String(ep.path || '').trim()
    if (!path) continue
    const key = interfaceKey(method, path)
    if (!grouped.has(key)) {
      grouped.set(key, {
        method,
        path,
        cases: [],
        linkId: ep.id,
        endpointId: ep.endpointId,
        controller: ep.summary?.split('·')?.[0]?.trim() || String(ep.handler || '').split('.')[0] || '—'
      })
    }
  }
  for (const c of cases) {
    const method = String(c.method || 'GET').toUpperCase()
    const path = String(c.path || '').trim()
    if (!path) continue
    const key = interfaceKey(method, path)
    const hit = grouped.get(key) || {
      method,
      path,
      cases: [],
      controller: c.controller || caseHostLabel(c)
    }
    hit.cases.push(c)
    if (!hit.controller || hit.controller === '—') hit.controller = c.controller || caseHostLabel(c)
    grouped.set(key, hit)
  }
  const parentKey = parent.nodeKey
  return [...grouped.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => ({
      nodeKey: `if:${parentKey}:${interfaceKey(item.method, item.path)}`,
      label: interfaceTreeLabel(item.path),
      kind: 'interface' as const,
      isFolder: false,
      method: item.method,
      path: item.path,
      project: parent.project,
      collection: collectionCtx,
      requirementNo: parent.requirementNo,
      sourceBranch: parent.sourceBranch,
      linkId: item.linkId,
      endpointId: item.endpointId,
      statusTag: interfaceStatusTag(item.cases),
      meta: item.cases.length ? String(item.cases.length) : undefined
    }))
}

async function fetchEndpointsForCollection(data: TreeNode) {
  if (data.requirementNo) {
    return apiClient.fetchRequirementEndpoints(data.requirementNo)
  }
  if (data.sourceBranch && data.project) {
    const res = await apiClient.fetchApiEndpoints({ project: data.project })
    return (res.items || []).filter(
      (ep: any) => String(ep.sourceBranch || '').trim() === data.sourceBranch
    )
  }
  return []
}

async function hydrateCollectionNode(data: TreeNode, collectionCtx: any) {
  try {
    const endpoints = await fetchEndpointsForCollection(data)
    let cases: any[] = collectionCases.value
    if (collectionCtx?.id) {
      cases = await apiClient.getApiTestCollectionCases(collectionCtx.id)
      collectionCases.value = cases
    }
    const children = buildInterfaceChildren(cases, endpoints, data, collectionCtx)
    patchTreeNode(data.nodeKey, { children, isFolder: true })
    await nextTick()
    expandTreeNode(data.nodeKey)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载接口列表失败')
    collectionCases.value = []
    patchTreeNode(data.nodeKey, { children: [] })
  }
}

async function loadCollectionCases(collectionId: string) {
  try {
    collectionCases.value = await apiClient.getApiTestCollectionCases(collectionId)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载用例失败')
    collectionCases.value = []
  }
}

function findTreeNode(match: (n: TreeNode) => boolean): TreeNode | null {
  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (match(n)) return n
      if (n.children?.length) {
        const hit = walk(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(treeData.value)
}

function clearProjectFilter() {
  const { project: _drop, ...rest } = route.query
  router.replace({ path: route.path, query: rest })
}

function navPageOf(nodeKey: string): number | null {
  const kind = navUnitKind.value
  let i = 0
  const contains = (n: TreeNode): boolean =>
    n.nodeKey === nodeKey || (n.children || []).some(contains)
  const walk = (nodes: TreeNode[]): number | null => {
    for (const n of nodes) {
      if (n.kind === kind) {
        if (contains(n)) return Math.floor(i / NAV_PAGE_SIZE) + 1
        i++
      } else if (n.children?.length) {
        const hit = walk(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(filteredTree.value)
}

async function selectTreeNode(data: TreeNode) {
  const page = navPageOf(data.nodeKey)
  if (page) navPage.value = page
  await nextTick()
  treeRef.value?.setCurrentKey?.(data.nodeKey)
  await onNodeClick(data)
}

function onScopeChange() {
  if (scope.value === 'LIVE') {
    appVersion.value = ''
  }
  loadTree()
}

function runLiveProject(proj: { code: string; label?: string; runCollectionId?: string }) {
  if (!proj.runCollectionId) {
    ElMessage.warning('该项目暂无可执行的全量集合')
    return
  }
  run({
    id: proj.runCollectionId,
    name: proj.label || proj.code,
    project: proj.code,
    scope: 'LIVE'
  })
}

async function loadProjects() {
  projects.value = await apiClient.getApiTestProjects()
  if (!autoGroupProject.value && projects.value.length) {
    autoGroupProject.value = projects.value[0]
  }
}

async function loadVersions() {
  try {
    const rows = await apiClient.listAiTestCaseVersions('app-release')
    versionOptions.value = (rows || []).map((r) => String(r.version || '')).filter(Boolean)
    const qv = String(route.query.appVersion || '')
    if (qv) appVersion.value = qv
    else if (versionOptions.value.length) {
      const hit = versionOptions.value.find((v) => v.includes('9.3')) || versionOptions.value[0]
      appVersion.value = hit
    }
  } catch {
    versionOptions.value = []
  }
}

async function autoGroup() {
  const p = autoGroupProject.value || selectedCollection.value?.project || projects.value[0]
  if (!p) {
    ElMessage.warning('没有可选项目')
    return
  }
  grouping.value = true
  try {
    const r = await apiClient.autoGroupApiTestCases(p)
    ElMessage.success(`新建 ${r.created} 个集合，归组 ${r.assigned} 条用例`)
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '归组失败')
  } finally {
    grouping.value = false
  }
}

function openCreate() {
  editing.value = false
  form.value = {
    id: '',
    project: autoGroupProject.value || projects.value[0] || '',
    name: '',
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: scope.value,
    requirementNo: '',
    appVersion: appVersion.value || ''
  }
  dialog.value = true
}

function openCreateForProject(projectCode: string) {
  editing.value = false
  form.value = {
    id: '',
    project: projectCode,
    name: treeDisplayLabel(projectCode),
    description: '',
    sortOrder: 100,
    enabled: true,
    scope: scope.value,
    requirementNo: '',
    appVersion: appVersion.value || ''
  }
  dialog.value = true
}

function openEdit(c: any) {
  editing.value = true
  form.value = {
    id: c.id,
    project: c.project,
    name: c.name,
    description: c.description || '',
    sortOrder: c.sortOrder ?? 100,
    enabled: c.enabled !== false,
    scope: c.scope || 'LIVE',
    requirementNo: c.requirementNo || '',
    appVersion: c.appVersion || ''
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name.trim() || !form.value.project) {
    ElMessage.warning('项目和名称必填')
    return
  }
  saving.value = true
  try {
    const body = {
      project: form.value.project,
      name: form.value.name.trim(),
      description: form.value.description,
      sortOrder: form.value.sortOrder,
      enabled: form.value.enabled,
      scope: form.value.scope,
      requirementNo: form.value.requirementNo?.trim() || undefined,
      appVersion: form.value.appVersion?.trim() || undefined
    }
    if (editing.value) await apiClient.updateApiTestCollection(form.value.id, body)
    else await apiClient.createApiTestCollection(body)
    dialog.value = false
    ElMessage.success('已保存')
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(c: any) {
  try {
    await ElMessageBox.confirm(`删除集合「${c.name}」？用例会保留，只是移出集合。`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestCollection(c.id)
    ElMessage.success('已删除')
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function archiveCollection(c: any) {
  try {
    await apiClient.archiveApiTestCollection(c.id)
    ElMessage.success('已归档')
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '归档失败')
  }
}

async function releaseRequirement(requirementNo: string) {
  try {
    await ElMessageBox.confirm(
      `确认 ${requirementNo} 已上线？将归档该单的测试集合与「涉及接口」，默认不再展示（记录保留）。`,
      '本单已上线',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    const r = await apiClient.releaseApiTestRequirement(requirementNo)
    ElMessage.success(`已归档 ${r.collectionsArchived} 个集合、${r.endpointsArchived} 条涉及接口`)
    selectedCollection.value = null
    await loadTree()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

function resetCaseForm() {
  editingRow = null
  const iface = selectedInterface.value
  const col = selectedCollection.value
  caseForm.value = {
    id: '',
    project: col?.project || '',
    environment: 'TEST',
    name: iface ? `${iface.method} ${iface.label || iface.path.split('/').pop()}` : '',
    description: '',
    method: iface?.method || 'GET',
    path: iface?.path || '',
    query: '',
    headers: '{}',
    body: '',
    assertions: '[{"type":"status","equals":200}]',
    enabled: false,
    testOnly: false,
    sortOrder: 100,
    urlId: '',
    updatedAt: '',
    sourceBranch: col?.sourceBranch || '',
    caseKind: col?.sourceBranch ? 'BRANCH' : 'REGRESSION'
  }
  caseKindTouched.value = false
}

function openCreateCase() {
  if (selectedCollection.value?.virtual) {
    ElMessage.warning('请先为本需求单新建集合，再添加用例')
    return
  }
  resetCaseForm()
  loadEditorRows()
  loadUrlContext(caseForm.value.project)
  caseDrawer.value = true
}

function openEditCase(row: any) {
  editingRow = row
  caseForm.value = {
    id: row.id,
    project: row.project || selectedCollection.value?.project || '',
    environment: row.environment || 'TEST',
    name: row.name || '',
    description: row.description || '',
    method: row.method || 'GET',
    path: row.path || '',
    query: row.query || '',
    headers: row.headers || '{}',
    body: row.body || '',
    assertions: row.assertions || '[{"type":"status","equals":200}]',
    enabled: row.enabled !== false,
    testOnly: !!row.testOnly,
    sortOrder: row.sortOrder ?? 100,
    urlId: row.urlId || '',
    updatedAt: row.updatedAt || '',
    sourceBranch: row.sourceBranch || '',
    caseKind: kindOf(row) || ''
  }
  caseKindTouched.value = true
  loadEditorRows()
  loadUrlContext(caseForm.value.project)
  caseDrawer.value = true
}

async function saveCaseForm() {
  const id = await persistCaseForm()
  if (!id) return
  ElMessage.success('已保存')
  caseDrawer.value = false
  await refreshCurrentCases()
}

/** 先落库当前表单，返回用例 id；失败返回空串 */
async function persistCaseForm(): Promise<string> {
  if (!caseForm.value.name.trim() || !caseForm.value.path.trim()) {
    ElMessage.warning('名称和 Path 必填')
    return ''
  }
  if (!assertRaw.value) {
    caseForm.value.assertions = rowsToAsserts()
  } else {
    try {
      JSON.parse(caseForm.value.assertions || '[]')
    } catch {
      ElMessage.warning('断言不是合法 JSON —— 切回表格模式就不会写错了')
      return ''
    }
  }
  caseForm.value.headers = rowsToJson(headerRows.value)
  caseForm.value.query = rowsToQuery(paramRows.value) || ''
  caseSaving.value = true
  try {
    const body = {
      urlId: caseForm.value.urlId || null,
      extractJson: editingRow?.extractJson,
      fieldNotes: editingRow?.fieldNotes,
      project: caseForm.value.project || selectedCollection.value?.project,
      environment: caseForm.value.environment,
      name: caseForm.value.name.trim(),
      description: caseForm.value.description,
      method: caseForm.value.method,
      path: caseForm.value.path.trim(),
      query: caseForm.value.query || undefined,
      headers: caseForm.value.headers,
      body: caseForm.value.body,
      assertions: caseForm.value.assertions,
      enabled: caseForm.value.enabled,
      testOnly: caseForm.value.testOnly,
      sortOrder: caseForm.value.sortOrder,
      requirementRef: selectedCollection.value?.requirementNo || editingRow?.requirementRef || undefined,
      caseKind: caseForm.value.caseKind || undefined,
      // 后端：null＝沿用库里的，空串＝清空。行里压根没这个键（后端旧版）时别发空串，免得把库里的分支抹掉
      sourceBranch:
        caseForm.value.sourceBranch.trim() || (editingRow && !('sourceBranch' in editingRow) ? undefined : '')
    }
    invalidateCaseKindIndex()
    if (caseForm.value.id) {
      await apiClient.updateApiTestCase(caseForm.value.id, body)
      return caseForm.value.id
    }
    const saved = await apiClient.createApiTestCase(body)
    const colId = selectedCollection.value?.id
    if (colId && saved?.id) {
      const ids = [...collectionCases.value.map((c) => c.id), saved.id]
      await apiClient.assignApiTestCases(colId, ids)
    }
    if (saved?.id) caseForm.value.id = saved.id
    return saved?.id || ''
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
    return ''
  } finally {
    caseSaving.value = false
  }
}

async function runOneCase(row: any) {
  if (!row?.id) return
  if (row.enabled === false) {
    ElMessage.warning('用例已停用，先启用再执行')
    return
  }
  let env: 'PROD' | 'TEST' = scope.value === 'LIVE' ? liveRunEnv.value : 'TEST'
  if (env === 'PROD' && row.testOnly) {
    ElMessage.warning('这条标了「只在测试环境跑」，把执行环境切到「测试」再执行')
    return
  }
  if (env === 'PROD') {
    const g = await guardProdRun([row], row.project || selectedController.value?.code)
    if (g.mode === 'cancel') return
    env = g.env
  }
  runningCaseId.value = row.id
  try {
    const r = await apiClient.runApiTest({
      caseIds: [row.id],
      environment: env,
      confirmProd: env === 'PROD'
    })
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await refreshCurrentCases()
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningCaseId.value = ''
  }
}

async function removeCase(row: any) {
  try {
    await ElMessageBox.confirm(`删除用例「${row.name}」？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiClient.deleteApiTestCase(row.id)
    ElMessage.success('已删除')
    await refreshCurrentCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function generateCaseForInterface() {
  const iface = selectedInterface.value
  if (!iface) return
  generatingCase.value = true
  try {
    let note = ''
    if (iface.linkId) {
      const r = await apiClient.generateCaseFromRequirementEndpoint(iface.linkId, {
        collectionId: selectedCollection.value?.id,
        appVersion: appVersion.value || undefined,
        sourceBranch: selectedCollection.value?.sourceBranch
      })
      note = r.note || ''
      if (r.collectionCreated) await loadTree()
    } else if (iface.endpointId) {
      const r = await apiClient.generateCaseFromEndpoint(iface.endpointId)
      note = r.note || ''
      const colId = selectedCollection.value?.id
      if (colId && r.case?.id) {
        const ids = [...collectionCases.value.map((c) => c.id), r.case.id]
        await apiClient.assignApiTestCases(colId, ids)
      }
    } else {
      ElMessage.warning('找不到接口关联记录，请刷新后重试')
      return
    }
    ElMessage.success(note || '已生成用例')
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generatingCase.value = false
  }
}

async function runInterfaceCases() {
  // 只跑启用的：停用的那些是「待补断言」，跑起来必然失败，
  // 而失败得毫无意义 —— 几次之后人就不再看执行结果了
  const runnable = selectedInterfaceCases.value.filter((c: any) => c.enabled)
  let ids = runnable.map((c: any) => c.id).filter(Boolean)
  if (!ids.length) {
    ElMessage.warning('这个接口下没有已启用的用例。停用的是「待补断言」，补完断言再启用')
    return
  }
  const skipped = selectedInterfaceCases.value.length - runnable.length
  let env: 'PROD' | 'TEST' = scope.value === 'LIVE' ? liveRunEnv.value : 'TEST'
  if (env === 'PROD') {
    const g = await guardProdRun(
      runnable.map((c: any) => ({ ...c, endpointId: c.endpointId || selectedInterface.value?.endpointId })),
      selectedCollection.value?.project,
      selectedInterface.value?.label
    )
    if (g.mode === 'cancel') return
    ids = g.ids
    env = g.env
  }
  runningCase.value = true
  try {
    const r = await apiClient.runApiTest({
      caseIds: ids,
      environment: env,
      confirmProd: env === 'PROD'
    })
    ElMessage[r.ok ? 'success' : 'warning'](
      (r.message || '执行完成') + (skipped > 0 ? `（跳过 ${skipped} 条待补断言的）` : '')
    )
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    runningCase.value = false
  }
}

function openImportDoc() {
  importDocContent.value = ''
  importDocVisible.value = true
}

async function submitImportDoc() {
  const project = selectedCollection.value?.project
  if (!project) {
    ElMessage.warning('请先选择需求单/集合')
    return
  }
  if (importDocMode.value === 'docx') {
    if (!docFile.value) {
      ElMessage.warning('先选一个 .docx 文件')
      return
    }
    importingDoc.value = true
    try {
      const r = await apiClient.importInterfaceDoc(project, docFile.value)
      // 不关弹窗：未匹配的接口清单要留给人看——那是漏测点，关掉就没人再想起来
      importResult.value = r
      ElMessage.success(`已写入 ${r.matched} 个接口的文档约束`)
      await refreshSelectedCases()
    } catch (e: any) {
      ElMessage.error(e?.message || '导入失败')
    } finally {
      importingDoc.value = false
    }
    return
  }

  const content = importDocContent.value.trim()
  if (!content) {
    ElMessage.warning('先粘贴 OpenAPI JSON')
    return
  }
  importingDoc.value = true
  try {
    const r = await apiClient.importOpenApi(project, content)
    importDocVisible.value = false
    ElMessage.success(`已导入 ${r.imported} 个接口到接口清单（文档仅参考）`)
    await refreshSelectedCases()
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importingDoc.value = false
  }
}

function run(c: any) {
  runTarget.value = c
  runEnv.value = scope.value === 'LIVE' ? liveRunEnv.value : 'TEST'
  confirmProd.value = false
  runDialog.value = true
  loadProdJudge()
}

const prodJudge = ref<{ loading: boolean; supported: boolean; verdicts: ProdVerdict[] }>({
  loading: false,
  supported: false,
  verdicts: []
})
const prodPicked = ref<string[]>([])
const prodGuardOn = computed(() => runEnv.value === 'PROD' && !prodJudge.value.loading && prodJudge.value.supported)
const prodAllowed = computed(() => prodJudge.value.verdicts.filter((v) => v.allowed))
const prodBlocked = computed(() => prodJudge.value.verdicts.filter((v) => !v.allowed))
const runDisabled = computed(() => {
  if (runEnv.value !== 'PROD') return false
  if (prodJudge.value.loading) return true
  return prodJudge.value.supported ? !prodPicked.value.length : !confirmProd.value
})

function togglePicked(id: string, on: boolean) {
  prodPicked.value = on ? [...new Set([...prodPicked.value, id])] : prodPicked.value.filter((x) => x !== id)
}

let judgeSeq = 0
async function loadProdJudge() {
  if (runEnv.value !== 'PROD' || !runTarget.value?.id) return
  const seq = ++judgeSeq
  prodJudge.value = { loading: true, supported: false, verdicts: [] }
  prodPicked.value = []
  try {
    const cases = (await apiClient.getApiTestCollectionCases(runTarget.value.id)).filter((c: any) => c.enabled !== false)
    const r = await judgeProdCases(cases as CaseRef[], runTarget.value.project)
    if (seq !== judgeSeq) return
    prodJudge.value = { loading: false, ...r }
    prodPicked.value = r.verdicts.filter((v) => v.allowed).map((v) => v.c.id)
  } catch {
    if (seq === judgeSeq) prodJudge.value = { loading: false, supported: false, verdicts: [] }
  }
}

watch(runEnv, (env) => {
  if (runDialog.value && env === 'PROD') loadProdJudge()
})

async function doRun() {
  running.value = true
  try {
    const guarded = prodGuardOn.value
    // 集合里全是只读、且全勾上了才按集合跑（报告里能认出是哪个集合第几次）；否则只跑勾上的那几条
    const whole = guarded && !prodBlocked.value.length && prodPicked.value.length === prodAllowed.value.length
    const r = await apiClient.runApiTest({
      ...(guarded && !whole ? { caseIds: prodPicked.value } : { collectionId: runTarget.value.id }),
      environment: runEnv.value,
      confirmProd: guarded || confirmProd.value
    })
    runDialog.value = false
    ElMessage[r.ok ? 'success' : 'warning'](r.message || '执行完成')
    await loadTree()
    if (selectedCollection.value) {
      await refreshSelectedCases()
    }
    if (r.runId) router.push({ path: '/api-reports', query: { runId: r.runId } })
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  try {
    if (route.query.scope === 'LIVE') scope.value = 'LIVE'
    await loadProjects()
    await loadVersions()
    await loadTree()
    const reqNo = String(route.query.requirementNo || '').trim()
    if (reqNo && treeData.value.length) {
      const node = findTreeNode((n) => n.kind === 'collection' && (n.requirementNo === reqNo || n.label === reqNo))
      if (node) await selectTreeNode(node)
    }
    const qPath = String(route.query.path || '').trim()
    const qMethod = String(route.query.method || '').trim()
    if (qPath) {
      await onMustTestSelect({
        priority: '',
        kind: 'ENDPOINT',
        httpMethod: qMethod,
        path: qPath,
        title: '',
        why: '',
        notes: []
      })
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '页面初始化失败')
  }
})
</script>

<style scoped>
.collections-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.page-body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 0;
  height: 100%;
}

.scope-tabs {
  display: flex;
  gap: 24px;
  padding: 14px 16px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.scope-tab {
  border: none;
  background: none;
  padding: 0 0 12px;
  font-size: 14px;
  color: var(--app-text-regular);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.scope-tab.active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 500;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 16px 24px;
  overflow: auto;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.head-left h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-disabled);
  font-size: 14px;
  min-height: 200px;
}

.import-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.progress-block {
  margin-bottom: 20px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--app-text-regular);
  margin-bottom: 8px;
}

.progress-chips {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 13px;
}

.chip-pass { color: var(--el-color-success); }
.chip-pending { color: var(--el-text-color-secondary); }

.stat-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--app-text-regular);
}

.stat-bar {
  flex: 1;
  max-width: 200px;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
}

.stat-fill {
  width: 100%;
  height: 100%;
  background: var(--el-color-primary);
  border-radius: 2px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input {
  /* 不加上限的话搜索框会一路撑开，把「执行本接口」挤出可视区 */
  max-width: 300px;
  flex: 1;
  min-width: 240px;
  max-width: 480px;
}

.path-main {
  font-weight: 500;
  word-break: break-all;
}

.path-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.verify-tag { font-size: 13px; }
.iface-table :deep(.iface-row) {
  cursor: pointer;
}
.iface-table :deep(.iface-row .cell) {
  display: flex;
  align-items: center;
  gap: 8px;
}
.iface-table :deep(.case-row td) {
  background: var(--el-fill-color-lighter);
}
.iface-table :deep(.iface-row .el-table__expand-icon),
.iface-table :deep(.iface-row .el-table__placeholder) {
  display: none;
}
.iface-arrow {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.15s;
}
.iface-arrow.is-open {
  transform: rotate(90deg);
}
.table-pagination {
  justify-content: flex-end;
  margin-top: 12px;
}
.iface-cell {
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
}
.iface-cell .path-sub {
  margin-top: 2px;
}
.case-name {
  font-size: 13px;
  color: var(--app-text-regular);
}
.iface-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.ops-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.2;
}
.ops-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ops-row .el-button {
  margin: 0;
  padding: 0 4px;
  font-size: 12px;
}
.ctrl-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.tree-core {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.tree-core.is-done {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.tree-core + .tree-badge {
  margin-left: 6px;
}
.core-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 600;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.kind-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
  border: 1px solid transparent;
}
.kind-tag.is-branch { color: #0958d9; background: #e6f4ff; border-color: #91caff; }
.kind-tag.is-regression { color: #531dab; background: #f9f0ff; border-color: #d3adf7; }
/* 未分类必须和另外两种一眼分开：它是「没人确认过」，不是一种正常状态 */
.kind-tag.is-unclassified { color: #8c8c8c; background: #fafafa; border: 1px dashed #bfbfbf; }
.kind-select { width: 120px; }
.ce-kind { display: flex; flex-direction: column; gap: 4px; }
.test-only-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.st-pass { color: var(--el-color-success); }
.st-pending { color: var(--el-text-color-secondary); }
.st-live { color: var(--el-color-primary); }

.tree-status {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 10px;
}

.ts-ok { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.ts-run { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.ts-pending { background: var(--el-fill-color-light); color: var(--el-text-color-secondary); }

.pill-ctrl { background: #e6fffb; color: #13c2c2; }
.pill-env { background: var(--el-fill-color-light); color: var(--app-text-regular); }
.pill-ok { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.pill-run { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }

/* ---- 左侧 ---- */
.nav-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  background: #fff;
  min-height: 0;
}

.scope-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 12px 12px 0;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.scope-btn {
  border: none;
  background: #fff;
  padding: 8px 0;
  font-size: 13px;
  color: var(--app-text-regular);
  cursor: pointer;
}

.scope-btn + .scope-btn {
  border-left: 1px solid var(--el-border-color);
}

.scope-btn.active {
  background: var(--el-color-primary);
  color: #fff;
}

.nav-toolbar {
  padding: 10px 12px 6px;
}

.nav-hint {
  padding: 0 14px 8px;
  font-size: 11px;
  color: var(--el-text-color-disabled);
}

.project-filter {
  flex-shrink: 0;
  padding: 10px 12px 0;
}
.live-env {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 0;
}
.live-env-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tree-filter {
  flex-shrink: 0;
  padding: 10px 12px 6px;
}
.nav-tree-wrap {
  flex: 1;
  overflow: auto;
  padding: 0 8px 12px;
  min-height: 0;
}

.nav-empty {
  padding: 24px 12px;
  font-size: 13px;
  color: var(--el-text-color-disabled);
  text-align: center;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
}

.tree-leaf-row .tree-text {
  color: var(--app-text-regular);
}

.tree-dot {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #bfbfbf;
  margin-left: 2px;
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) .tree-dot {
  background: var(--el-color-primary);
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) .tree-text {
  color: var(--el-color-primary);
}

.tree-badge {
  flex-shrink: 0;
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.nav-tree-wrap :deep(.el-tree) {
  background: transparent;
  --el-tree-node-hover-bg-color: #f5f5f5;
}

.nav-tree-wrap :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 4px;
}

.nav-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--el-color-primary-light-9) !important;
}

.nav-tree-wrap :deep(.el-tree-node__expand-icon) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-color-warning);
}

.tree-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.nav-pagination {
  padding: 8px 4px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.nav-pagination :deep(.el-pagination) {
  justify-content: center;
  flex-wrap: wrap;
}

.nav-pagination :deep(.el-pager li) {
  min-width: 26px;
}

/* ---- 右侧 ---- */
.detail-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  background: #fff;
}

.main-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.version-select {
  width: 180px;
}

.coll-head {
  padding: 16px 20px 0;
  flex-shrink: 0;
}

.coll-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.coll-title-line h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pill {
  display: inline-block;
  padding: 0 8px;
  border-radius: 2px;
  font-size: 12px;
  line-height: 22px;
  border: 1px solid transparent;
}

.pill.sm {
  font-size: 11px;
  line-height: 20px;
}

.pill-test {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-7);
}

.pill-live {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-7);
}

.pill-req {
  background: #fff;
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-7);
}

.pill-online {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-7);
  cursor: pointer;
}

.pill-online:hover {
  background: var(--el-color-success-light-8);
}

.coll-stats {
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.coll-action-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.coll-actions-left,
.coll-actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.more-btn {
  min-width: 32px;
  padding: 8px 10px;
  letter-spacing: 1px;
}

/* 用例列表 */
.case-rows {
  padding: 0 20px;
}

.case-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.case-row.is-disabled {
  opacity: 0.65;
}

.case-row.is-collection {
  cursor: pointer;
}

.case-row.is-collection:hover {
  background: var(--el-fill-color-lighter);
}

.collection-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.method-tag {
  flex-shrink: 0;
  min-width: 40px;
  padding: 0 6px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 20px;
}

.m-get {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  border: 1px solid var(--el-color-success-light-7);
}

.m-post {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
}

.m-put {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-7);
}

.m-del {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border: 1px solid var(--el-color-danger-light-7);
}

.m-other {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color);
}

.case-path {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-meta {
  flex-shrink: 0;
  color: var(--el-text-color-disabled);
  font-size: 12px;
  white-space: nowrap;
}

.case-toggle {
  flex-shrink: 0;
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}

.case-toggle:hover {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
}
.import-file {
  margin-left: 10px;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
}

.import-result {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12.5px;
  line-height: 1.9;
}

.import-warn {
  color: var(--el-color-warning);
}

.import-dim {
  color: var(--el-text-color-secondary);
}

.kv-count {
  display: inline-block;
  min-width: 18px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.is-active .kv-count {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.kv-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

.ce-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.ce-head-main {
  flex: 1;
  min-width: 0;
}
.ce-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.ce-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.ce-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--app-text-regular);
}
.ce-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}
.ce-close:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
.ce-tabs :deep(.el-tabs__header) {
  margin: 0 0 16px;
}
.ce-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
.ce-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  padding: 0 14px;
  height: 40px;
}
.ce-tabs :deep(.el-tabs__content) {
  height: 360px;
  overflow-y: auto;
  padding-right: 2px;
}
.ce-tabs :deep(.el-tab-pane) {
  min-height: 100%;
}
.ce-form {
  margin-bottom: 0;
}
.ce-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
.ce-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.ce-body :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
.ce-req {
  display: flex;
  gap: 10px;
  width: 100%;
}
.ce-method {
  width: 130px;
  flex-shrink: 0;
}
.ce-method :deep(.el-select__selected-item),
.ce-path-input :deep(.el-input__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.ce-method :deep(.el-select__selected-item) {
  font-weight: 600;
}
.ce-path-input {
  flex: 1;
}
.ce-url {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.ce-url-select {
  width: 100%;
}
.ce-url-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  line-height: 20px;
}
.ce-env {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  color: var(--app-text-regular);
  background: var(--el-fill-color-dark);
}
.ce-env.is-test {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.ce-env.is-prod {
  color: var(--el-color-danger-dark-2);
  background: var(--el-color-danger-light-9);
}
.ce-url-full {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}
.ce-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.ce-copy:hover {
  background: var(--el-fill-color-dark);
  color: var(--el-color-primary);
}
.ce-setting {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
}
.ce-setting + .ce-setting {
  border-top: 1px solid var(--el-border-color-lighter);
}
.ce-setting-text {
  flex: 1;
}
.ce-setting-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.ce-setting-title.on {
  color: var(--el-color-success);
}
.ce-setting-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ce-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ce-saved {
  flex: 1;
  text-align: left;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.as-list {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.as-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.as-path {
  width: 190px;
  flex-shrink: 0;
}

.as-path :deep(.el-input__inner),
.as-val :deep(.el-input__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.as-val {
  flex: 1;
  min-width: 110px;
}

.as-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 15px;
}

.as-del:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-danger);
}

.as-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 38px;
  border: none;
  background: var(--el-fill-color-lighter);
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
}

.as-add:hover {
  background: var(--el-color-primary-light-9);
}

.cap-doc-dim {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}


/* 线上执行：逐条列出，只读的才能勾 */
.pg-hint { color: var(--el-text-color-secondary); font-size: 13px; }
.pg { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.pg-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
  color: var(--app-text-regular);
}
.pg-ok { color: var(--el-color-success-dark-2); }
.pg-bad { color: var(--el-color-danger-dark-2); }
.pg-spacer { flex: 1; }
.pg-list { max-height: 320px; overflow: auto; }
.pg-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}
.pg-row:first-child { border-top: 0; }
.pg-row.is-blocked { cursor: not-allowed; background: #fcfcfc; }
.pg-row.is-blocked .pg-name { color: var(--el-text-color-secondary); }
.pg-tag {
  flex-shrink: 0;
  margin-top: 3px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 16px;
  border-radius: 4px;
  border: 1px solid transparent;
}
.pg-tag.is-writes { color: var(--el-color-danger-dark-2); background: var(--el-color-danger-light-9); border-color: var(--el-color-danger-light-7); }
.pg-tag.is-readonly { color: var(--el-color-success-dark-2); background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-7); }
.pg-tag.is-unknown { color: var(--el-text-color-secondary); background: var(--el-fill-color-lighter); border: 1px dashed #bfbfbf; }
.pg-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 13px; }
.pg-name { color: var(--el-text-color-primary); }
.pg-path { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #a6a6a6; word-break: break-all; }
.pg-reason { font-size: 12px; color: #ad4e00; }
.pg-empty { padding: 20px; text-align: center; color: var(--el-text-color-secondary); font-size: 13px; }
</style>

<style>
.case-edit-dialog.el-dialog {
  padding: 0;
  border-radius: 14px;
  overflow: hidden;
}
.case-edit-dialog .el-dialog__header {
  margin: 0;
  padding: 20px 20px 16px 24px;
  border-bottom: 1px solid var(--el-border-color);
}
.case-edit-dialog .el-dialog__body {
  overflow: hidden;
  padding: 16px 24px 8px;
}
.case-edit-dialog .el-dialog__footer {
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color);
  background: var(--el-fill-color-lighter);
}
</style>
