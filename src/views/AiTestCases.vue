<template>
  <div class="ai-cases">
    <header class="page-nav">
      <div class="nav-left">
        <!--
          没有 fullTitle 的套件会退化成 title，两段就长得一模一样（「国内接口 / 国内接口」）。
          相同就只显示一段——面包屑重复一次，人会以为自己点错了层级。
        -->
        <span class="nav-crumb">
          <template v-if="suiteFullTitle && suiteFullTitle !== suiteTitle">
            {{ suiteFullTitle }}
            <span class="nav-sep">/</span>
          </template>
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
          class="vpill is-online"
          :class="{ active: releaseTab === 'ONLINE' }"
          @click="switchReleaseTab('ONLINE')"
        >
          <span class="vpill-ico">✓</span>
          线上版本
          <span class="vpill-num">{{ onlineCount }}</span>
        </button>
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
      </div>

      <div class="filter-bar">
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

    <div class="page-body" :class="{ 'has-detail': detailOpen && !isNarrow, resizing }">
      <div v-loading="loading" class="list-col">
        <div v-if="releaseTab === 'TESTING'" class="env-banner">
          <span>当前查看：测试版本 — 来自测试环境新需求的用例，上线后可提升为线上版</span>
          <em>待提升 {{ testingCount }}</em>
        </div>

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
          <div class="table-top">
            <div class="table-top-left">
              测试用例列表
              <span class="count-badge">{{ total }} 条</span>
            </div>
          </div>

          <div class="table-head">
            <span>
              <input
                v-if="releaseTab === 'TESTING'"
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

          <el-empty
            v-if="!loading && !list.length"
            :description="`「${suiteTitle}」${releaseTab === 'ONLINE' ? '线上' : '测试'}暂无用例`"
          />

          <div v-for="mod in moduleGroups" :key="mod.module" class="mod-block">
            <div class="mod-head" @click="toggleModule(mod.module)">
              <span class="fold-arrow" :class="{ folded: isModuleCollapsed(mod.module) }">▼</span>
              <span class="mod-name">{{ mod.module }}</span>
              <span class="mod-meta">
                <span class="count-badge">{{ mod.count }} 条</span>
                <span class="cover-pct" :class="{ zero: mod.coverage === 0 }">覆盖 {{ mod.coverage }}%</span>
              </span>
              <span v-if="isModuleCollapsed(mod.module)" class="folded-tip">已折叠</span>
            </div>

            <template v-if="!isModuleCollapsed(mod.module)">
              <div v-for="sub in mod.subs" :key="mod.module + '::' + sub.subModule" class="sub-block">
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
          <span class="pos">{{ releaseTab === 'ONLINE' ? '线上版' : '测试版' }} · {{ selectedIndex + 1 }} / {{ list.length }}</span>
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
            <label class="ced-field">
              <span class="ced-label">功能模块</span>
              <el-input v-model="editForm.module" placeholder="如 账号" />
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
            <span class="ced-label">测试步骤</span>
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
                <div class="ced-step-sub">
                  <label class="ced-field">
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

          <label class="ced-field">
            <span class="ced-label">期望结果</span>
            <el-input
              v-model="editForm.expectedResult"
              class="ced-expected"
              type="textarea"
              :rows="2"
              placeholder="整条用例跑完应该看到什么"
            />
          </label>
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
              这里<strong>只列用途为「仅自动化编排」的流程</strong>。回归是独立的一套——
              包括「回归 + 自动化编排」在内，只要进回归批次就属于回归，验的是「这个包能不能用」，
              不对应任何一条用例。
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

      <el-dialog
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

    <el-dialog v-model="genVisible" title="生成测试用例" width="720px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="页面/模块" required>
          <el-input v-model="genForm.pageName" placeholder="如 登录页、赛事详情" />
        </el-form-item>
        <el-form-item label="APP 截图">
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
                将截图拖到此处，或 <em>点击上传</em>
              </div>
            </el-upload>
            <div class="edit-hint">
              支持拖拽与点击选择，可多张（一个页面的正常态 + 异常态一起给，生成的用例更全）。
              不用再传到公网，图片由后端转发。
            </div>
          </div>
        </el-form-item>
        <!--
          层级让人填一次、整批共用：一张截图基本就是一个页面，这批用例的模块是同一个。
          生成器只管枚举「该测什么」——归类它不擅长，而逐条补四级是最耗人的部分。
        -->
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
        <el-button type="primary" :loading="genLoading" @click="runGenerate">生成并保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, UploadFilled } from '@element-plus/icons-vue'
import { apiClient, type AiTestCaseDto, type AiTestCaseStep } from '../api'
import { findTestCaseSuite, TEST_CASE_SUITES } from '../constants/testCaseSuites'

const route = useRoute()
const categoryKey = computed(() => String(route.params.category || route.query.category || '').trim())
const suite = computed(() => findTestCaseSuite(categoryKey.value) || TEST_CASE_SUITES[0])
const suiteTitle = computed(() => suite.value.title)
// 没配 fullTitle 时返回空而不是回落到 title：回落会让面包屑出现「X / X」。
// 上层已经按「为空就不显示这一段」处理
const suiteFullTitle = computed(() => suite.value.fullTitle || '')

const loading = ref(false)
const list = ref<AiTestCaseDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50

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
const releaseTab = ref<'ONLINE' | 'TESTING'>('ONLINE')
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
  pageName: '登录页',
  module: '',
  subModule: '',
  requirements: '',
  elementsText: ''
})

/** 本地截图，直接走后端上传转发，不用先传到公网 */
const genFiles = ref<any[]>([])

const displayPage = computed(() => {
  const n = list.value[0]?.pageName || filterPageName.value
  return n || '—'
})
const automatedCount = computed(() => list.value.filter((r: any) => r?.automated).length)
const coverPercent = computed(() => {
  const n = list.value.length
  if (!n) return 0
  return Math.min(100, Math.round((automatedCount.value / n) * 100))
})
const moduleOptions = computed(() => {
  const set = new Set<string>()
  for (const r of list.value) {
    const m = String(r.module || '').trim()
    if (m) set.add(m)
  }
  return [...set].sort()
})

const selectedCase = computed(() => list.value.find((r) => r.id === selectedId.value) || null)
const selectedIndex = computed(() => list.value.findIndex((r) => r.id === selectedId.value))
const prevCase = computed(() => (selectedIndex.value > 0 ? list.value[selectedIndex.value - 1] : null))
const nextCase = computed(() =>
  selectedIndex.value >= 0 && selectedIndex.value < list.value.length - 1
    ? list.value[selectedIndex.value + 1]
    : null
)

type SubGroup = { subModule: string; rows: AiTestCaseDto[] }
type ModuleGroup = { module: string; count: number; coverage: number; subs: SubGroup[] }

const moduleGroups = computed((): ModuleGroup[] => {
  const filtered = filterModule.value
    ? list.value.filter((r) => String(r.module || '').trim() === filterModule.value)
    : list.value
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
      module,
      count,
      coverage: count ? Math.round((auto / count) * 100) : 0,
      subs
    })
  }
  return out
})

const pageIds = computed(() => list.value.map((r) => r.id).filter((id): id is number => !!id))
const allPageSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selectedIds.value.includes(id))
)
const somePageSelected = computed(() => pageIds.value.some((id) => selectedIds.value.includes(id)))

function syncNarrow() {
  isNarrow.value = typeof window !== 'undefined' && window.innerWidth < 960
}

function isModuleCollapsed(module: string) {
  return !!collapsedByTab[releaseTab.value][module]
}
function toggleModule(module: string) {
  const bag = collapsedByTab[releaseTab.value]
  bag[module] = !bag[module]
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
      .filter((f: any) => f.catalog === 'AUTOMATION')
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
    expectedResult: row?.expectedResult || '',
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
  genVisible.value = true
}

async function runGenerate() {
  if (!genForm.pageName.trim()) {
    ElMessage.warning('请填写页面名称')
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
    await apiClient.saveAiTestCasesBatch({
      page_name: genForm.pageName.trim(),
      category: suite.value.key,
      // 层级整批共用：生成器不产出这几级，逐条补是最耗人的部分
      module: genForm.module.trim() || undefined,
      sub_module: genForm.subModule.trim() || undefined,
      status: 'DRAFT',
      test_cases: cases
    })
    ElMessage.success(
      `已用 ${generated.model || '千问'} 生成 ${cases.length} 条并保存到「${suiteTitle.value}」`
    )
    genVisible.value = false
    filterPageName.value = genForm.pageName.trim()
    page.value = 1
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    genLoading.value = false
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

watch(categoryKey, () => {
  page.value = 1
  filterPageName.value = ''
  filterPriority.value = ''
  filterStatus.value = ''
  filterAdvice.value = ''
  filterModule.value = ''
  selectedIds.value = []
  selectedId.value = null
  detailOpen.value = false
  loadList()
})

onMounted(() => {
  syncNarrow()
  window.addEventListener('resize', syncNarrow)
  loadList()
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

.env-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
  padding: 8px 14px;
  background: #fff7e6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  color: #ad6800;
  font-size: 12.5px;
}
.env-banner em { font-style: normal; color: #d48806; font-weight: 700; }

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
.table-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13.5px;
  font-weight: 700;
}
.table-top-left { display: flex; align-items: center; gap: 8px; }
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
  grid-template-columns: 22px 88px minmax(0, 1fr) 56px 78px 72px 188px;
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
.table-head > span:nth-child(3),
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
  font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #0284c7;
  background: #e0f2fe;
  border-radius: 3px;
  padding: 2px 5px;
  font-weight: 600;
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
  padding: 14px 20px 8px;
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
.case-edit-dialog .ced-expected .el-textarea__inner {
  background: #f6ffed;
  border-color: #b7eb8f;
  border-left: 3px solid #52c41a;
  box-shadow: none;
}
.ai-tc-filter-popper {
  min-width: 120px !important;
}
.ai-tc-filter-popper .el-select-dropdown__item {
  padding: 0 16px;
  height: 32px;
  line-height: 32px;
}
</style>
