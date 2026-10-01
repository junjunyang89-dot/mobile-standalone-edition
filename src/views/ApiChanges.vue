<template>
  <div class="api-changes">
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">接口对比分析</span>
            <p class="card-sub">
              本次提测动了哪些接口、返回体多了/少了哪些字段、涉及哪些表。
              全程只读，不动你的代码；分析成功会自动存一份，可在历史里复看。
            </p>
          </div>
          <el-button @click="openHistory">历史报告</el-button>
        </div>
      </template>

      <el-radio-group v-model="mode" class="mode-switch" @change="onModeChange">
        <el-radio-button label="branch">分支对比</el-radio-button>
        <el-radio-button label="dir">目录对比</el-radio-button>
      </el-radio-group>
      <div class="mode-hint">
        {{ mode === 'branch'
          ? '从本地 git 仓库读分支，按「共同祖先起这个分支干了什么」比。'
          : '不需要 git：把两个分支各拷一份到本地，直接比目录。拿不到内网时用这个。' }}
      </div>

      <el-form v-if="mode === 'dir'" :inline="true" class="filter-bar">
        <el-form-item label="项目">
          <el-select v-model="project" filterable clearable style="width: 200px" placeholder="不选则不同步清单">
            <el-option v-for="p in projects" :key="'d-' + p.code" :label="p.name || p.code" :value="p.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="基线目录">
          <el-select v-model="baseDir" filterable allow-create style="width: 320px"
                     placeholder="选已保存的目录，或直接粘路径">
            <el-option v-for="d in codeDirs" :key="'b' + d.id"
                       :label="d.label + (d.isBaseline ? '（基线）' : '')" :value="d.dirPath">
              <span>{{ d.label }}</span>
              <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">{{ shortPath(d.dirPath) }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="待测目录">
          <el-select v-model="headDir" filterable allow-create style="width: 320px"
                     placeholder="本次提测那份代码">
            <el-option v-for="d in codeDirs" :key="'h' + d.id" :label="d.label" :value="d.dirPath">
              <span>{{ d.label }}</span>
              <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">{{ shortPath(d.dirPath) }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" :disabled="!baseDir || !headDir" @click="analyzeDirs">
            开始分析
          </el-button>
          <el-button @click="openDirMgr">管理目录</el-button>
        </el-form-item>
      </el-form>

      <el-form v-else :inline="true" class="filter-bar">
        <el-form-item label="项目">
          <el-select v-model="project" filterable style="width: 200px" @change="onProjectChange">
            <el-option
              v-for="p in projects"
              :key="p.code"
              :label="p.name || p.code"
              :value="p.code"
              :disabled="!p.ready"
            >
              <span>{{ p.name || p.code }}</span>
              <span v-if="!p.ready" style="float: right; color: var(--el-color-danger); font-size: 12px">未配仓库</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="基线分支">
          <el-select v-model="baseRef" filterable allow-create style="width: 240px" placeholder="如 master / testing">
            <el-option v-for="b in branches" :key="'b-' + b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="待测分支">
          <el-select v-model="headRef" filterable allow-create style="width: 280px" placeholder="本次提测的分支">
            <el-option v-for="b in branches" :key="'h-' + b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" :disabled="!project" @click="analyze">
            开始分析
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="errorMsg"
        type="error"
        :closable="false"
        show-icon
        :title="errorMsg"
        style="margin-bottom: 12px"
      />

      <el-empty
        v-if="!report && !loading && !errorMsg"
        :description="mode === 'branch'
          ? '选项目和分支，点「开始分析」。分支列表会从本地仓库自动读出来'
          : '填两个本地目录，点「开始分析」。目录里若套了一层工程根会自动定位'"
      />

      <template v-if="report">
        <div class="summary-head">
          <span class="summary-ref">{{ report.baseRef }} → <b>{{ report.headRef }}</b></span>
          <span class="summary-files">共 {{ report.changedFiles }} 个文件有差异</span>
        </div>

        <!--
          同步是跟着分析自动做的，但不显示出来的话「同步没同步过」只能靠猜，
          而猜错的方向是「以为同步了其实没有」——那会让人拿着上一版的清单去排测试
        -->
        <div
          v-if="report.catalogSync"
          class="catalog-sync"
          :class="{ skipped: report.catalogSync.skipped }"
        >
          <template v-if="report.catalogSync.skipped">
            接口没有进清单：{{ report.catalogSync.reason || '这次同步被跳过了' }}
            <a v-if="mode === 'dir'" class="catalog-link" @click="scrollToForm">选一个项目再分析一次</a>
          </template>
          <template v-else>
            已同步到<a class="catalog-link" @click="goCatalog">接口清单</a>：
            <template v-if="syncTotal > 0">
              <b v-if="report.catalogSync.created">新增 {{ report.catalogSync.created }}</b>
              <b v-if="report.catalogSync.updated">标记变更 {{ report.catalogSync.updated }}</b>
              <b v-if="report.catalogSync.deprecated">标废弃 {{ report.catalogSync.deprecated }}</b>
            </template>
            <span v-else>本次没有接口变更，清单里上一轮的标记已清空</span>
          </template>
        </div>

        <div v-if="report.requirementLink" class="req-link">
          已挂到需求
          <b v-for="k in reqKeys" :key="k">{{ k }}</b>
          ，关联 {{ report.requirementLink.linked ?? 0 }} 个接口
        </div>

        <!-- 变更牵动哪些已有用例需复查：断言取了变更字段、或读写了改结构的表。
             它们现在可能还显示绿，其实已经不对——这是上线同步最容易漏的一环 -->
        <div v-if="review" class="case-review" :class="{ empty: !review.count }">
          <div class="cr-head">
            <el-icon><WarningFilled /></el-icon>
            <b v-if="review.count > 0">{{ review.count }} 条已有用例可能失效，需复查</b>
            <b v-else>没有用例直接命中这次变更</b>
          </div>
          <div class="cr-hint">{{ review.hint }}</div>
          <el-table
            v-if="review.count > 0"
            :data="review.cases"
            size="small"
            border
            style="margin-top:8px"
            class="cr-table"
            @row-click="goReviewCase"
          >
            <el-table-column prop="name" label="用例" min-width="160" show-overflow-tooltip />
            <el-table-column label="接口" min-width="200">
              <template #default="{ row }"><span class="cr-ep">{{ row.method }} {{ row.path }}</span></template>
            </el-table-column>
            <el-table-column label="为什么要复查" min-width="220">
              <template #default="{ row }">
                <div v-for="(r, i) in row.reasons" :key="i" class="cr-reason">
                  <el-tag size="small" :type="r.kind === 'FIELD' ? 'warning' : 'danger'">
                    {{ r.kind === 'FIELD' ? '字段' : '表' }}
                  </el-tag>
                  {{ r.detail }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="" width="88" align="right">
              <template #default>
                <el-button link type="primary" size="small">去补断言</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-if="report.mustTest?.items?.length" id="sec-must" class="must-test">
          <div class="cr-head">
            <b>必测清单</b>
            <el-tag size="small" type="danger">P0 {{ report.mustTest.p0 }}</el-tag>
            <el-tag size="small" type="warning">P1 {{ report.mustTest.p1 }}</el-tag>
            <el-tag size="small" type="info">P2 {{ report.mustTest.p2 }}</el-tag>
          </div>
          <div class="cr-hint">{{ report.mustTest.hint }}</div>
          <el-table :data="report.mustTest.items" size="small" border style="margin-top:8px">
            <el-table-column label="优先级" width="72" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.priority === 'P0' ? 'danger' : row.priority === 'P1' ? 'warning' : 'info'">
                  {{ row.priority }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="接口 / 对象" min-width="220">
              <template #default="{ row }">
                <span v-if="row.httpMethod" class="cr-ep">{{ row.httpMethod }} {{ row.path }}</span>
                <span v-else>{{ row.title }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="测什么" min-width="160" show-overflow-tooltip />
            <el-table-column prop="why" label="为什么必测" min-width="180" show-overflow-tooltip />
            <el-table-column label="接口测试要注意什么" min-width="320">
              <template #default="{ row }">
                <ul class="must-notes">
                  <li v-for="(n, i) in row.notes" :key="i">{{ n }}</li>
                </ul>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="stat-row">
          <a
            v-for="s in statCards"
            :key="s.key"
            class="stat-card"
            :class="{ danger: s.danger, empty: !s.value }"
            @click="scrollTo(s.key)"
          >
            <div class="stat-num">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </a>
        </div>

        <div v-if="report.notes?.length" class="report-notes">
          <span v-for="(n, i) in report.notes" :key="i">{{ n }}</span>
        </div>

        <!-- 先列可能挂前端的：字段删了、类型变了。这两类不看会直接线上炸 -->
        <template v-if="breakingCount">
          <div id="sec-breaking" class="section-head danger">
            <span class="section-no">1</span>
            <span class="section-name">先确认这些 —— 可能不兼容的变更（{{ breakingCount }}）</span>
          </div>
          <p class="section-sub">
            字段被删、或类型变了。字段名还在、抓包看着正常，但前端按老类型解析会静默出错——
            这类最难定位到后端。<b>先拿这几条去问开发是不是有意为之。</b>
          </p>
          <div v-for="(e, i) in visibleBreaking" :key="'brk-' + i" class="ep-card breaking">
            <div class="ep-head">
              <el-tag size="small" :type="methodTag(e.httpMethod)">{{ e.httpMethod }}</el-tag>
              <span class="ep-path">{{ e.path }}</span>
              <span v-if="e.summary" class="ep-summary">{{ e.summary }}</span>
            </div>
            <ul class="field-list">
              <li v-for="(f, j) in breakingFields(e)" :key="j" :class="fieldClass(f.changeType)">
                {{ changeLabel(f.changeType) }} {{ fieldName(f) }}
                <span class="ftype">{{ typeText(f) }}</span>
              </li>
            </ul>
          </div>
          <el-button v-if="breakingEndpoints.length > 1" link type="primary"
                     @click="showAllBreaking = !showAllBreaking">
            {{ showAllBreaking ? '收起' : `展开其余 ${breakingEndpoints.length - 1} 条` }}
          </el-button>
        </template>

        <div id="sec-endpoints" class="section-head">
          <span class="section-no">2</span>
          <span class="section-name">这些接口要测（{{ report.endpoints.length }}）</span>
        </div>
        <p class="section-sub">
          按风险排好序了：<b>不兼容</b> 优先，其次<b>新接口</b>，再是<b>只改了实现</b>的（签名没变但行为可能变）。
          标「未覆盖」的就是本次要补接口用例的。
        </p>
        <el-empty v-if="!report.endpoints.length" description="没有接口变更" :image-size="60" />
        <div v-for="(e, i) in visibleEndpoints" :key="'ep-' + i" class="ep-card">
          <div class="ep-head">
            <el-tag size="small" :type="riskTag(e.risk)">{{ riskLabel(e.risk) }}</el-tag>
            <el-tag size="small" :type="methodTag(e.httpMethod)">{{ e.httpMethod }}</el-tag>
            <span class="ep-path">{{ e.path }}</span>
            <span v-if="e.summary" class="ep-summary">{{ e.summary }}</span>
            <span class="ep-spacer" />
            <el-tag v-if="e.testCases > 0" size="small" type="success" effect="plain">
              已有用例 {{ e.testCases }}
            </el-tag>
            <el-tag v-else size="small" type="info" effect="plain">未覆盖</el-tag>
          </div>

          <div v-if="e.params?.length" class="sub-label">入参</div>
          <ul v-if="e.params?.length" class="field-list">
            <li v-for="(pm, j) in e.params" :key="'p' + j" :class="fieldClass(pm.changeType)">
              {{ changeLabel(pm.changeType) }} [{{ pm.source }}] {{ pm.name }}
              <span class="ftype">{{ paramTypeText(pm) }}</span>
              <el-tag v-if="pm.required && pm.changeType === 'ADDED'" size="small" type="danger" effect="plain">
                必填
              </el-tag>
            </li>
          </ul>

          <div v-if="e.bodyFields?.length" class="sub-label">请求体字段</div>
          <ul v-if="e.bodyFields?.length" class="field-list">
            <li v-for="(f, j) in e.bodyFields" :key="'bf' + j" :class="fieldClass(f.changeType)">
              {{ changeLabel(f.changeType) }} {{ fieldName(f) }}
              <span class="ftype">{{ typeText(f) }}</span>
            </li>
          </ul>

          <div v-if="e.fields.length" class="sub-label">返回体字段</div>
          <ul v-if="e.fields.length" class="field-list">
            <li v-for="(f, j) in e.fields" :key="j" :class="fieldClass(f.changeType)">
              {{ changeLabel(f.changeType) }} {{ fieldName(f) }}
              <span class="ftype">{{ typeText(f) }}</span>
            </li>
          </ul>

          <!--
            完整字段清单：抓包时逐字段对照用。默认收起——有的接口几十个字段，
            全铺开会把「本次改了什么」淹掉；要对字段的时候再展开。
          -->
          <div v-if="(e.responseFields?.length || e.requestFields?.length)" class="all-fields">
            <el-button link type="primary" @click="toggleFields(e.path)">
              {{ openFields.has(e.path) ? '收起' : '查看该接口全部字段' }}
              （请求 {{ e.requestFields?.length || 0 }} / 返回 {{ e.responseFields?.length || 0 }}）
            </el-button>
            <template v-if="openFields.has(e.path)">
              <div v-if="e.requestFields?.length" class="sub-label">请求体全部字段</div>
              <el-table v-if="e.requestFields?.length" :data="e.requestFields" size="small" border>
                <el-table-column label="字段" min-width="220">
                  <template #default="{ row }">
                    <span :style="{ paddingLeft: row.depth * 14 + 'px' }" class="fld-path">{{ row.path }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="180" />
                <el-table-column label="说明" min-width="200">
                  <template #default="{ row }">
                    <span v-if="row.comment">{{ row.comment }}</span>
                    <span v-else class="muted">代码里没写注释</span>
                  </template>
                </el-table-column>
                <el-table-column label="本次" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.changeType" size="small" :type="row.changeType === 'ADDED' ? 'success' : 'warning'">
                      {{ changeLabel(row.changeType) }}
                    </el-tag>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>

              <div v-if="e.responseFields?.length" class="sub-label">返回体全部字段</div>
              <el-table v-if="e.responseFields?.length" :data="e.responseFields" size="small" border>
                <el-table-column label="字段" min-width="220">
                  <template #default="{ row }">
                    <span :style="{ paddingLeft: row.depth * 14 + 'px' }" class="fld-path">{{ row.path }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="180" />
                <el-table-column label="说明" min-width="200">
                  <template #default="{ row }">
                    <span v-if="row.comment">{{ row.comment }}</span>
                    <span v-else class="muted">代码里没写注释</span>
                  </template>
                </el-table-column>
                <el-table-column label="本次" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.changeType" size="small" :type="row.changeType === 'ADDED' ? 'success' : 'warning'">
                      {{ changeLabel(row.changeType) }}
                    </el-tag>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
              <el-tooltip placement="top">
                <template #content>
                  字段名是抓包能看到的名字：@JsonProperty 改过的按改后显示，@JsonIgnore 的不列。<br />
                  嵌套对象最多展开三层，路径里的 [] 表示数组。
                </template>
                <span class="fields-note">字段是怎么来的？</span>
              </el-tooltip>
            </template>
          </div>

          <!-- 表与缓存：数据跟预期不符时，先看是不是缓存没刷 -->
          <div v-if="e.tables?.length" class="dep-row">
            <span class="dep-label">读写表</span>
            <div class="dep-tags">
              <el-tag
                v-for="(t, j) in e.tables"
                :key="'t' + j"
                size="small"
                :type="j < (e.relatedTableCount || 0) ? 'warning' : 'info'"
                effect="plain"
              >{{ t }}</el-tag>
              <span v-if="e.relatedTableCount && e.tables.length > e.relatedTableCount" class="dep-hint">
                橙色是本次变更涉及的，灰色是这个接口本来就在用的
              </span>
            </div>
          </div>
          <div v-if="e.redisKeys?.length" class="dep-row">
            <span class="dep-label">缓存 key</span>
            <div class="dep-tags">
              <el-tag
                v-for="(k, j) in e.redisKeys"
                :key="'k' + j"
                size="small"
                :type="k.valueChanged ? 'danger' : (k.related ? 'warning' : 'info')"
                effect="plain"
                :title="k.constant + (k.valueChanged ? `（本次由 ${k.oldValue} 改成这个）` : '')"
              >{{ k.value }}{{ k.valueChanged ? ' · key 变了' : '' }}</el-tag>
              <span class="dep-hint">数据跟预期不符时先清这几个 key，能一步分清是逻辑还是缓存</span>
            </div>
          </div>

          <div v-if="e.changedImpls?.length" class="impl-note">
            实现有改动：{{ e.changedImpls.join('、') }} —— 签名没变不等于行为没变，建议回归
          </div>
          <div class="ep-file">{{ e.file }}</div>
        </div>
        <el-button v-if="report.endpoints.length > 1" link type="primary"
                   @click="showAllEndpoints = !showAllEndpoints">
          {{ showAllEndpoints ? '收起' : `展开其余 ${report.endpoints.length - 1} 条` }}
        </el-button>

        <template v-if="report.orphanDtos.length">
          <div id="sec-dtos" class="section-head">
            <span class="section-no">3</span>
            <span class="section-name">这些返回体改了，但没能连回具体接口（{{ report.orphanDtos.length }}）</span>
          </div>
          <p class="section-sub">
            公共 DTO 被多处引用，或者这个返回体我没能连回具体接口。它的字段变了，用到它的接口都会受影响。
          </p>
          <div v-for="(d, i) in report.orphanDtos" :key="'dto-' + i" class="ep-card">
            <div class="ep-head">
              <span class="ep-path">{{ d.type }}</span>
              <span class="ep-spacer" />
              <span class="ep-file">{{ d.file }}</span>
            </div>
            <ul class="field-list">
              <li v-for="(f, j) in d.fields" :key="j" :class="fieldClass(f.changeType)">
                {{ changeLabel(f.changeType) }} {{ fieldName(f) }}
                <span class="ftype">{{ typeText(f) }}</span>
              </li>
            </ul>
          </div>
        </template>

        <template v-if="report.otherChanges?.length">
          <div id="sec-other" class="section-head">
            <span class="section-no">4</span>
            <span class="section-name">这些不是接口变更，但会影响你测（{{ report.otherChanges.length }}）</span>
          </div>
          <p class="section-sub">
            不是接口变更，但会影响你测的东西：定时任务决定测试环境有什么数据，缓存 key 变了会出现
            「改了没生效」。这些不列出来，人容易以为报告干净就等于不用测。
          </p>
          <el-table :data="report.otherChanges" size="small" border>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="kindTag(row.kind)" effect="plain">{{ kindLabel(row.kind) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="file" label="文件" min-width="260" show-overflow-tooltip />
            <el-table-column prop="hint" label="为什么要看" min-width="320" />
          </el-table>
        </template>

        <template v-if="report.findings?.length">
          <div id="sec-findings" class="section-head danger">
            <span class="section-no">5</span>
            <span class="section-name">安全与字段设计（{{ report.findings.length }}）</span>
          </div>
          <p class="section-sub">
            从代码里能<b>确证</b>的问题，每条带依据。只报高置信度的——掺进猜测，
            你核过两三条假的就不看了，真的那条也一起废掉。
          </p>
          <div
            v-for="(f, i) in (showAllFindings ? report.findings : report.findings.slice(0, 3))"
            :key="'fd' + i"
            class="finding-card"
            :class="{ risk: f.level === 'RISK' }"
          >
            <div class="finding-head">
              <el-tag size="small" :type="f.kind === 'SECURITY' ? 'danger' : 'warning'" effect="plain">
                {{ f.kind === 'SECURITY' ? '安全' : '设计' }}
              </el-tag>
              <span class="finding-target">{{ f.target }}</span>
            </div>
            <div class="finding-title">{{ f.title }}</div>
            <div class="finding-basis">依据：{{ f.basis }}</div>
          </div>
          <el-button v-if="report.findings.length > 3" link type="primary"
                     @click="showAllFindings = !showAllFindings">
            {{ showAllFindings ? '收起' : `展开其余 ${report.findings.length - 3} 条` }}
          </el-button>
        </template>

        <template v-if="report.concurrencyRisks?.length">
          <div id="sec-concurrency" class="section-head danger">
            <span class="section-no">5b</span>
            <span class="section-name">并发风险（{{ report.concurrencyRisks.length }}）</span>
          </div>
          <p class="section-sub">依据是建表语句里的唯一索引、计数列，以及 Redis key。没录 DDL 的表扫不出来，不是没风险。</p>
          <div
            v-for="(c, i) in report.concurrencyRisks"
            :key="'cc' + i"
            class="finding-card"
            :class="{ risk: c.level === 'RISK' }"
          >
            <div class="finding-head">
              <el-tag size="small" :type="c.level === 'RISK' ? 'danger' : 'info'" effect="plain">
                {{ c.level === 'RISK' ? '重点' : '了解' }}
              </el-tag>
              <span class="finding-target">{{ c.httpMethod }} {{ c.path }}</span>
            </div>
            <div class="finding-title">{{ c.title }}</div>
            <div v-if="c.howToTest" class="finding-basis">怎么测：{{ c.howToTest }}</div>
            <div v-if="c.basis" class="finding-basis">依据：{{ c.basis }}</div>
          </div>
        </template>

        <template v-if="report.tables.length">
          <div id="sec-tables" class="section-head">
            <span class="section-no">6</span>
            <span class="section-name">涉及的表 —— 造数据和边界看这里（{{ report.tables.length }}）</span>
          </div>
          <p class="section-sub">
            录了建表语句的表会自动列出测试注意事项（唯一索引、可空字段、大整数精度这些，
            建表语句里本来就写着）。没录过的点一下就能补。
          </p>
          <el-table :data="report.tables" size="small" border>
            <el-table-column label="表名" width="240">
              <template #default="{ row }">
                <a class="catalog-link" @click="openTableImpact(row.table)">{{ row.table }}</a>
              </template>
            </el-table-column>
            <el-table-column label="结构变更" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.ddl" size="small" type="warning">DDL</el-tag>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="结构明细 / 出现在" min-width="240">
              <template #default="{ row }">
                <div v-for="(d, i) in row.ddlDetails || []" :key="'d' + i" class="ddl-line">
                  {{ d.action }} {{ d.column || '' }} {{ d.detail }}
                </div>
                <div v-for="(f, i) in row.files" :key="i" class="table-file">{{ f }}</div>
              </template>
            </el-table-column>
            <el-table-column label="被哪些接口用" min-width="220">
              <template #default="{ row }">
                <div v-for="(p, i) in row.usedByEndpoints || []" :key="i" class="table-file">{{ p }}</div>
                <span v-if="!row.usedByEndpoints?.length" class="muted">没连到接口（可能只被定时任务用）</span>
              </template>
            </el-table-column>
            <el-table-column label="测试要注意什么" min-width="420">
              <template #default="{ row }">
                <template v-if="row.testHints?.length">
                  <div v-for="(h, i) in row.testHints" :key="i" class="hint-line">
                    <el-tag size="small" :type="h.level === 'RISK' ? 'danger' : 'info'" effect="plain">
                      {{ h.level === 'RISK' ? '重点' : '了解' }}
                    </el-tag>
                    <span class="hint-text">{{ h.title }}</span>
                    <div class="hint-basis">依据：{{ h.basis }}</div>
                  </div>
                  <div v-if="row.remark" class="hint-remark">补充：{{ row.remark }}</div>
                </template>
                <el-button v-else link type="primary" @click="openSchemaFor(row.table)">
                  录入建表语句 → 自动列出测试注意事项
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </template>
    </el-card>

    <!-- 目录管理：远程办公切不了分支，一个分支一份目录，路径存下来省得天天手打 -->
    <el-dialog v-model="dirMgrVisible" title="本地代码目录" width="760px" destroy-on-close>
      <el-form :inline="true">
        <el-form-item label="别名">
          <el-input v-model="dirForm.label" style="width: 150px" placeholder="如 master / APP-8928" />
        </el-form-item>
        <el-form-item label="目录">
          <el-input v-model="dirForm.dirPath" style="width: 340px" placeholder="绝对路径" />
        </el-form-item>
        <el-form-item label="作基线">
          <el-switch v-model="dirForm.isBaseline" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveDir">保存</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="codeDirs" size="small" border>
        <el-table-column prop="label" label="别名" width="150" />
        <el-table-column prop="dirPath" label="目录" min-width="340" show-overflow-tooltip />
        <el-table-column label="基线" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isBaseline" size="small" type="success">是</el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button v-perm:delete link type="danger" size="small" @click="removeDir(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-drawer v-model="impactVisible" :title="impactTitle" size="520px">
      <div v-loading="impactLoading">
        <p v-if="impactHint" class="cr-hint">{{ impactHint }}</p>
        <el-empty v-if="!impactLoading && !impactEndpoints.length" description="清单里还没有接口挂这张表" />
        <el-table v-else :data="impactEndpoints" size="small" border>
          <el-table-column label="接口" min-width="220">
            <template #default="{ row }">
              <span class="cr-ep">{{ row.httpMethod }} {{ row.path }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="caseCount" label="用例" width="70" align="center" />
          <el-table-column label="" width="72">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="goEndpoint(row.id)">看清单</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <!-- 表结构：项目里一个 .sql 都没有，建表语句只能从数据库导出来贴 -->
    <el-dialog v-model="schemaVisible" title="录入表结构" width="820px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="表名">
          <el-input v-model="schemaForm.tableName" style="width: 280px"
                    placeholder="留空则从建表语句里自动读" />
        </el-form-item>
        <el-form-item label="建表语句">
          <el-input v-model="schemaForm.ddl" type="textarea" :rows="10"
                    placeholder="从数据库 SHOW CREATE TABLE 导出后原样粘贴" @change="previewHints" />
        </el-form-item>
        <el-form-item label="补充说明">
          <el-input v-model="schemaForm.remark" type="textarea" :rows="2"
                    placeholder="自动推导不出来的业务注意事项，可留空" />
        </el-form-item>
      </el-form>
      <template v-if="hintPreview.length">
        <div class="section-title">自动推导的测试注意事项（{{ hintPreview.length }}）</div>
        <div v-for="(h, i) in hintPreview" :key="i" class="hint-line">
          <el-tag size="small" :type="h.level === 'RISK' ? 'danger' : 'info'" effect="plain">
            {{ h.level === 'RISK' ? '重点' : '了解' }}
          </el-tag>
          <span class="hint-text">{{ h.title }}</span>
          <div class="hint-basis">依据：{{ h.basis }}</div>
        </div>
      </template>
      <template #footer>
        <el-button @click="schemaVisible = false">取消</el-button>
        <el-button @click="previewHints">预览推导</el-button>
        <el-button type="primary" :loading="schemaSaving" @click="saveSchema">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="historyVisible" title="历史分析报告" size="520px" destroy-on-close>
      <div class="history-toolbar">
        <el-select
          v-model="historyProjectFilter"
          clearable
          filterable
          placeholder="按项目筛选"
          style="width: 200px"
          @change="loadHistory"
        >
          <el-option v-for="p in projects" :key="p.code" :label="p.name || p.code" :value="p.code" />
        </el-select>
        <el-button :loading="historyLoading" @click="loadHistory">刷新</el-button>
      </div>
      <el-empty v-if="!historyLoading && !historyList.length" description="暂无历史报告" />
      <div v-else class="history-list">
        <div v-for="row in historyList" :key="row.id" class="history-item">
          <div class="history-main" @click="openHistoryReport(row.id)">
            <div class="history-meta">
              <span class="history-time">{{ formatHistoryTime(row.createdAt) }}</span>
              <el-tag size="small" effect="plain">{{ row.project || '—' }}</el-tag>
            </div>
            <div class="history-refs">{{ row.baseRef || '?' }} → {{ row.headRef || '?' }}</div>
            <div class="history-summary">{{ row.summary || '无摘要' }}</div>
          </div>
          <el-button v-perm:delete type="danger" link @click.stop="removeHistory(row.id)">删除</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '@/api'
import { WarningFilled } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

/** branch=从 git 仓库读分支比；dir=两个本地目录直接比（拿不到内网时用） */
const mode = ref<'branch' | 'dir'>('branch')
const baseDir = ref('')
const headDir = ref('')

function onModeChange() {
  report.value = null
  errorMsg.value = ''
  showAllBreaking.value = false
  showAllEndpoints.value = false
  if (mode.value === 'dir') loadCodeDirs()
}

async function analyzeDirs() {
  loading.value = true
  errorMsg.value = ''
  report.value = null
  try {
    report.value = await apiClient.analyzeApiChangeDirs({
      project: project.value || undefined,
      baseDir: baseDir.value.trim(),
      headDir: headDir.value.trim()
    })
    if (!report.value.endpoints.length && !report.value.orphanDtos.length) {
      ElMessage.info('没扫到接口或返回体变更')
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '分析失败'
  } finally {
    loading.value = false
  }
}

/** 顶部统计：点一下跳到对应章节。数字为 0 的置灰，一眼看出哪几节不用看 */
const syncTotal = computed(() => {
  const c = report.value?.catalogSync
  return c ? (c.created || 0) + (c.updated || 0) + (c.deprecated || 0) : 0
})

function goCatalog() {
  router.push({ path: '/api-endpoints', query: { project: report.value?.project || project.value } })
}

function goEndpoint(endpointId?: string) {
  if (!endpointId) return
  router.push({
    path: '/api-endpoints',
    query: { project: report.value?.project || project.value, endpointId }
  })
}

function goReviewCase(row: any) {
  router.push({
    path: '/api-endpoints',
    query: {
      project: row.project || report.value?.project || project.value,
      endpointId: row.endpointId,
      caseId: row.id
    }
  })
}

function scrollToForm() {
  document.querySelector('.filter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const reqKeys = computed(() => {
  const keys = report.value?.requirementLink?.requirements
  return Array.isArray(keys) ? keys : []
})

const impactVisible = ref(false)
const impactLoading = ref(false)
const impactTitle = ref('')
const impactHint = ref('')
const impactEndpoints = ref<any[]>([])

async function openTableImpact(table: string) {
  if (!table) return
  impactVisible.value = true
  impactLoading.value = true
  impactTitle.value = `表 ${table} 牵动哪些接口`
  impactHint.value = ''
  impactEndpoints.value = []
  try {
    const r = await apiClient.getTableImpact(table, report.value?.project || project.value || undefined)
    impactHint.value = r.hint || ''
    impactEndpoints.value = r.endpoints || []
  } catch (e: any) {
    impactHint.value = e?.message || '查询失败'
  } finally {
    impactLoading.value = false
  }
}

const statCards = computed(() => {
  const r: any = report.value || {}
  return [
    { key: 'sec-must', label: '必测项', value: (r.mustTest?.items || []).length, danger: true },
    { key: 'sec-breaking', label: '可能不兼容', value: breakingCount.value, danger: true },
    { key: 'sec-endpoints', label: '接口变更', value: (r.endpoints || []).length, danger: false },
    { key: 'sec-dtos', label: '返回体变更', value: (r.orphanDtos || []).length, danger: false },
    { key: 'sec-other', label: '其它影响', value: (r.otherChanges || []).length, danger: false },
    { key: 'sec-findings', label: '安全/设计', value: (r.findings || []).length, danger: true },
    { key: 'sec-concurrency', label: '并发风险', value: (r.concurrencyRisks || []).length, danger: true },
    { key: 'sec-tables', label: '涉及的表', value: (r.tables || []).length, danger: false }
  ]
})

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 哪些接口展开了完整字段清单。按 path 记，避免折叠状态随排序错位 */
const openFields = ref<Set<string>>(new Set())

function toggleFields(path: string) {
  const next = new Set(openFields.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  openFields.value = next
}

// 折叠：一次列七八条太长，默认只展开第一条
const showAllBreaking = ref(false)
const showAllEndpoints = ref(false)
const showAllFindings = ref(false)
const visibleBreaking = computed(() =>
  showAllBreaking.value ? breakingEndpoints.value : breakingEndpoints.value.slice(0, 1)
)
const visibleEndpoints = computed(() => {
  const list = report.value?.endpoints || []
  return showAllEndpoints.value ? list : list.slice(0, 1)
})

// ---- 本地代码目录 ----
const codeDirs = ref<any[]>([])
const dirMgrVisible = ref(false)
const dirForm = ref<any>({ label: '', dirPath: '', isBaseline: false })

function shortPath(p: string) {
  const s = String(p || '')
  return s.length > 40 ? '…' + s.slice(-40) : s
}

async function loadCodeDirs() {
  try {
    codeDirs.value = await apiClient.getApiCodeDirs(project.value || undefined)
    // 存了基线的话直接填上，省一次选择
    const baseline = codeDirs.value.find((d: any) => d.isBaseline)
    if (baseline && !baseDir.value) baseDir.value = baseline.dirPath
  } catch {
    codeDirs.value = []
  }
}

function openDirMgr() {
  dirForm.value = { label: '', dirPath: '', isBaseline: false }
  dirMgrVisible.value = true
  loadCodeDirs()
}

async function saveDir() {
  if (!dirForm.value.dirPath?.trim()) {
    ElMessage.warning('请填写目录路径')
    return
  }
  try {
    await apiClient.saveApiCodeDir({ ...dirForm.value, project: project.value || null })
    dirForm.value = { label: '', dirPath: '', isBaseline: false }
    await loadCodeDirs()
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function removeDir(row: any) {
  try {
    await apiClient.deleteApiCodeDir(row.id)
    await loadCodeDirs()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// ---- 表结构 ----
const schemaVisible = ref(false)
const schemaSaving = ref(false)
const schemaForm = ref<any>({ tableName: '', ddl: '', remark: '' })
const hintPreview = ref<any[]>([])

function openSchemaFor(table: string) {
  schemaForm.value = { tableName: table || '', ddl: '', remark: '' }
  hintPreview.value = []
  schemaVisible.value = true
}

async function previewHints() {
  if (!schemaForm.value.ddl?.trim()) return
  try {
    const res = await apiClient.previewTableHints(schemaForm.value.ddl)
    hintPreview.value = res.testHints || []
    if (!schemaForm.value.tableName && res.tableName && res.tableName !== 'null') {
      schemaForm.value.tableName = res.tableName
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '解析失败')
  }
}

async function saveSchema() {
  if (!schemaForm.value.ddl?.trim()) {
    ElMessage.warning('请粘贴建表语句')
    return
  }
  schemaSaving.value = true
  try {
    const res = await apiClient.saveApiTableSchema({
      ...schemaForm.value,
      project: project.value || null
    })
    // 当场把结果挂回正在看的这份报告——人已经在看报告了，
    // 让他为了看一眼刚录的东西再跑一次分析，是白等
    const name = String(res?.tableName || schemaForm.value.tableName || '').toLowerCase()
    const hit = (report.value?.tables || []).find(
      (t: any) => String(t.table || '').toLowerCase() === name
    )
    if (hit) {
      hit.testHints = res?.testHints || hintPreview.value
      hit.ddlText = schemaForm.value.ddl
      hit.remark = schemaForm.value.remark
    }
    schemaVisible.value = false
    ElMessage.success(hit ? '已保存，测试注意事项已更新到下方' : '已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    schemaSaving.value = false
  }
}

const projects = ref<any[]>([])
const branches = ref<string[]>([])
const project = ref('')
const baseRef = ref('')
const headRef = ref('')
const loading = ref(false)
const errorMsg = ref('')
const report = ref<any | null>(null)
const review = ref<any | null>(null)

// 报告一变就重算"哪些已有用例可能失效"。从报告里提出变更字段和变更表——
// 字段散在每个接口的 fields/bodyFields 里，表在 report.tables
function fieldNameOf(f: any): string {
  const raw = f?.name || f?.field || ''
  if (raw) return String(raw)
  const path = String(f?.path || '')
  const segs = path.replace(/^\$/, '').split(/[.\[\]]/).map((s: string) => s.trim()).filter(Boolean)
  return segs.filter((s: string) => !/^\d+$/.test(s)).pop() || ''
}

watch(report, async (r) => {
  review.value = null
  if (!r || !r.endpoints?.length) return
  const fields = new Set<string>()
  for (const e of r.endpoints) {
    const changed = [
      ...(e.fields || []),
      ...(e.bodyFields || []),
      ...(e.responseFields || []),
      ...(e.requestFields || [])
    ]
    for (const f of changed) {
      // 只有删/改类型的字段才会让老用例失效；纯新增不影响已有断言
      if (f.changeType === 'REMOVED' || f.changeType === 'TYPE_CHANGED') {
        const name = fieldNameOf(f)
        if (name) fields.add(name)
      }
    }
  }
  const tables = (r.tables || []).map((t: any) => t.table).filter(Boolean)
  if (!fields.size && !tables.length) return
  try {
    review.value = await apiClient.getCaseReview({
      project: r.project || project.value || undefined,
      changedFields: [...fields],
      changedTables: tables
    })
  } catch { /* 复查是锦上添花，失败不打断报告展示 */ }
})

const historyVisible = ref(false)
const historyLoading = ref(false)
const historyList = ref<
  Array<{
    id: number
    project?: string
    baseRef?: string
    headRef?: string
    summary?: string
    createdAt?: string
  }>
>([])
const historyProjectFilter = ref('')

async function openHistory() {
  historyVisible.value = true
  historyProjectFilter.value = project.value || ''
  await loadHistory()
}

async function loadHistory() {
  historyLoading.value = true
  try {
    historyList.value = await apiClient.listApiChangeReports({
      project: historyProjectFilter.value || undefined,
      limit: 50
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载历史失败')
  } finally {
    historyLoading.value = false
  }
}

async function openHistoryReport(id: number) {
  try {
    const row = await apiClient.getApiChangeReport(id)
    report.value = row.report
    errorMsg.value = ''
    showAllBreaking.value = false
    showAllEndpoints.value = false
    historyVisible.value = false
    ElMessage.success('已加载历史报告')
  } catch (e: any) {
    ElMessage.error(e?.message || '打开报告失败')
  }
}

async function removeHistory(id: number) {
  try {
    await ElMessageBox.confirm('删除后无法恢复，确认删除？', '删除历史报告', { type: 'warning' })
    await apiClient.deleteApiChangeReport(id)
    ElMessage.success('已删除')
    await loadHistory()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '删除失败')
  }
}

function formatHistoryTime(v?: string) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 字段删了、类型变了——这两类会让前端静默出错，单独提到最上面 */
function isBreaking(changeType: string) {
  return changeType === 'REMOVED' || changeType === 'TYPE_CHANGED'
}

const breakingEndpoints = computed(() =>
  (report.value?.endpoints || [])
    .concat(report.value?.orphanDtos?.map((d: any) => ({
      httpMethod: 'DTO',
      path: d.type,
      summary: '',
      fields: d.fields
    })) || [])
    .filter((e: any) => (e.fields || []).some((f: any) => isBreaking(f.changeType)))
)

const breakingCount = computed(() =>
  breakingEndpoints.value.reduce(
    (n: number, e: any) => n + e.fields.filter((f: any) => isBreaking(f.changeType)).length,
    0
  )
)

function breakingFields(e: any) {
  return (e.fields || []).filter((f: any) => isBreaking(f.changeType))
}

function fieldName(f: any) {
  return f.comment ? `${f.name}（${f.comment}）` : f.name
}

function typeText(f: any) {
  if (f.changeType === 'TYPE_CHANGED') return `${f.oldType} → ${f.newType}`
  return f.newType || f.oldType || ''
}

const CHANGE_LABELS: Record<string, string> = {
  ADDED: '新增',
  REMOVED: '删除',
  TYPE_CHANGED: '类型变更',
  REQUIRED_CHANGED: '必填变更',
  MODIFIED: '改动'
}

const RISK_LABELS: Record<string, string> = {
  BREAKING: '不兼容',
  NEW: '新接口',
  IMPL: '实现改动',
  COMPATIBLE: '兼容变更'
}

function riskLabel(r: string) {
  return RISK_LABELS[r] || r || '改动'
}

function riskTag(r: string) {
  if (r === 'BREAKING') return 'danger'
  if (r === 'NEW') return 'success'
  if (r === 'IMPL') return 'warning'
  return 'info'
}

const KIND_LABELS: Record<string, string> = {
  SCHEDULE: '定时任务',
  CACHE: '缓存',
  CONFIG: '配置',
  MAPPER: '数据访问',
  SERVICE: '业务实现',
  SERVICE_SCHEDULED: '实现+定时'
}

function kindLabel(k: string) {
  return KIND_LABELS[k] || k
}

function kindTag(k: string) {
  if (k === 'SCHEDULE' || k === 'SERVICE_SCHEDULED') return 'warning'
  if (k === 'CACHE') return 'danger'
  return 'info'
}

function paramTypeText(pm: any) {
  if (pm.changeType === 'TYPE_CHANGED') return `${pm.oldType} → ${pm.newType}`
  if (pm.changeType === 'REQUIRED_CHANGED') return pm.required ? '改为必填' : '改为可选'
  return pm.newType || pm.oldType || ''
}

function changeLabel(t: string) {
  return CHANGE_LABELS[t] || t
}

function changeTag(t: string) {
  if (t === 'ADDED') return 'success'
  if (t === 'REMOVED') return 'danger'
  return 'warning'
}

function fieldClass(t: string) {
  if (t === 'ADDED') return 'f-added'
  if (t === 'REMOVED') return 'f-removed'
  return 'f-changed'
}

function methodTag(m: string) {
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'primary'
  if (m === 'DELETE') return 'danger'
  return 'info'
}

async function loadProjects() {
  try {
    const rows = await apiClient.getApiChangeProjects()
    projects.value = Array.isArray(rows) ? rows : []
    const first = projects.value.find((p) => p.ready)
    const want = String(route.query.project || '')
    const fromQuery = projects.value.find((p) => p.code === want)
    if (fromQuery) {
      project.value = fromQuery.code
      await onProjectChange()
    } else if (first) {
      project.value = first.code
      await onProjectChange()
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '加载项目失败'
  }
}

async function onProjectChange() {
  branches.value = []
  headRef.value = ''
  report.value = null
  errorMsg.value = ''
  const p = projects.value.find((x) => x.code === project.value)
  baseRef.value = p?.baseBranch || ''
  if (!p?.ready) {
    errorMsg.value = `项目「${p?.name || project.value}」还没配本地仓库路径，请到「接口项目」里补上`
    return
  }
  try {
    const res = await apiClient.getApiChangeBranches(project.value)
    branches.value = res.branches || []
    // 待测分支默认取仓库当前分支，多数情况就是人正在看的那个
    headRef.value = res.current || ''
    if (!baseRef.value) {
      // 基线没配就猜一个：这几个仓库有的用 master、有的用 testing
      baseRef.value = branches.value.find((b) => b === 'master' || b === 'main' || b === 'testing') || ''
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '读取分支失败'
  }
}

async function analyze() {
  loading.value = true
  errorMsg.value = ''
  report.value = null
  try {
    report.value = await apiClient.analyzeApiChanges({
      project: project.value,
      baseRef: baseRef.value || undefined,
      headRef: headRef.value || undefined
    })
    if (!report.value.endpoints.length && !report.value.orphanDtos.length) {
      ElMessage.info('没扫到接口或返回体变更')
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '分析失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProjects()
  loadCodeDirs()
})
</script>

<style scoped>
.catalog-sync {
  margin: 8px 0 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-7);
  font-size: 13px;
}

.catalog-sync.skipped {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.catalog-sync b {
  margin-right: 10px;
  font-weight: 600;
}

.req-link {
  margin: 8px 0 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.req-link b {
  margin: 0 4px;
}

.catalog-link {
  margin: 0 2px;
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: underline;
}

.api-changes {
  padding: 16px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.filter-bar {
  margin-bottom: 12px;
}

.mode-switch {
  margin-bottom: 6px;
}

.mode-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 12px;
  line-height: 1.6;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--app-text-secondary);
  margin-bottom: 10px;
}

.summary-ref {
  font-family: ui-monospace, Menlo, monospace;
  color: var(--app-text);
}

.summary-files {
  color: var(--el-text-color-placeholder);
}

.stat-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  min-width: 110px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.stat-card:hover {
  border-color: var(--app-primary);
  transform: translateY(-1px);
}

.stat-card.danger .stat-num {
  color: var(--app-danger);
}

.stat-card.empty {
  opacity: 0.5;
  cursor: default;
}

.stat-card.empty:hover {
  border-color: var(--app-border);
  transform: none;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.2;
}

.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 26px 0 6px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.section-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--app-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  flex: none;
}

.section-head.danger .section-no {
  background: var(--app-danger);
}

.section-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.section-head.danger .section-name {
  color: var(--app-danger);
}

.summary-bar {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--app-text);
  color: var(--app-border);
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}

.summary-bar .danger {
  color: #ff9a9e;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  margin: 18px 0 6px;
}

.section-title.danger {
  color: var(--app-danger);
}

.section-sub {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.6;
}

.ep-card {
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.ep-card.breaking {
  border-color: var(--el-color-danger-light-7);
  background: #fef6f6;
}

.ep-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ep-path {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: var(--app-text);
  word-break: break-all;
}

.ep-summary {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.ep-spacer {
  flex: 1;
}

.ep-type {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-family: ui-monospace, Menlo, monospace;
}

.ep-file {
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-disabled);
  word-break: break-all;
}

.field-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.9;
}

.field-list .ftype {
  margin-left: 8px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.f-added {
  color: var(--app-success);
}

.f-removed {
  color: var(--app-danger);
}

.f-changed {
  color: var(--app-warning);
}

.dep-row {
  margin-top: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.dep-tags {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.dep-label {
  flex: none;
  width: 58px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 24px;
}

.dep-hint {
  font-size: 12px;
  color: var(--el-text-color-disabled);
  line-height: 24px;
}

.report-notes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--el-text-color-disabled);
}

.finding-card {
  border: 1px solid var(--app-border);
  border-left: 3px solid var(--app-warning);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.finding-card.risk {
  border-left-color: var(--app-danger);
}

.finding-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.finding-target {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--app-text-secondary);
  word-break: break-all;
}

.finding-title {
  font-size: 13px;
  color: var(--app-text);
  line-height: 1.7;
}

.finding-basis {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-disabled);
  font-family: ui-monospace, Menlo, monospace;
}

.all-fields {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--app-border);
}

.fld-path {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
}

.fields-note {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-disabled);
  cursor: help;
  border-bottom: 1px dashed var(--app-border);
}

.sub-label {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-weight: 600;
}

.impl-note {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--el-color-warning-light-9);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
  line-height: 1.6;
}

.ddl-line {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--app-warning);
}

.hint-line {
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.7;
}

.hint-text {
  margin-left: 6px;
  color: var(--app-text);
}

.hint-basis {
  font-size: 11px;
  color: var(--el-text-color-disabled);
  font-family: ui-monospace, Menlo, monospace;
}

.hint-remark {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.table-file {
  font-size: 12px;
  color: var(--app-text-secondary);
  word-break: break-all;
}

.muted {
  color: var(--el-text-color-disabled);
}

.history-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.history-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.history-main:hover .history-refs {
  color: var(--app-primary);
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.history-time {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.history-refs {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: var(--app-text);
  word-break: break-all;
}

.history-summary {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.5;
}

.must-test{margin:12px 0;padding:12px 14px;background:var(--el-color-danger-light-9);border:1px solid var(--el-color-danger-light-7);border-radius:8px}
.must-test .cr-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.must-notes{margin:0;padding-left:18px;font-size:12.5px;line-height:1.55;color:var(--app-text-regular)}
.must-notes li{margin:2px 0}
.case-review{margin:12px 0;padding:12px 14px;background:var(--el-color-warning-light-9);border:1px solid #ffe0a3;border-radius:8px}
.case-review.empty{background:var(--el-color-success-light-9);border-color:var(--el-color-success-light-7)}
.case-review.empty .cr-head{color:var(--el-color-success-dark-2)}
.case-review .cr-head{display:flex;align-items:center;gap:6px;color:#c67a13;font-size:14px}
.case-review .cr-hint{color:#8a6d3b;font-size:12.5px;margin:4px 0 2px}
.case-review .cr-ep{font-family:monospace;font-size:12.5px;color:var(--app-text-regular)}
.case-review .cr-reason{margin:2px 0;font-size:12.5px}
.cr-table{cursor:pointer}
</style>
