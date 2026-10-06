<template>
  <div class="api-changes">
    <el-card class="main-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">接口对比分析</span>
          <el-button @click="openHistory">历史报告</el-button>
        </div>
      </template>

      <el-radio-group v-model="mode" size="small" class="mode-switch" @change="onModeChange">
        <el-radio-button label="branch">分支对比</el-radio-button>
        <el-radio-button label="dir">目录对比</el-radio-button>
      </el-radio-group>
      <div v-if="mode === 'dir'" class="mode-hint">
        不需要 git：把两个分支各拷一份到本地，直接比目录。拿不到内网时用这个。
      </div>

      <template v-if="mode === 'dir'">
        <div class="cmp-grid">
          <div class="cmp-field">
            <label class="cmp-label">项目</label>
            <ProjectCascadeSelect
              v-model="project"
              :groups="projectGroups"
              width="100%"
              placeholder="从项目管理里选"
              @change="loadCodeDirs"
            />
          </div>
          <div class="cmp-field">
            <label class="cmp-label">基线目录</label>
            <el-select v-model="baseDir" filterable allow-create class="cmp-select mono"
                       placeholder="选已保存的目录，或直接粘路径">
              <el-option v-for="d in codeDirs" :key="'b' + d.id"
                         :label="d.label + (d.isBaseline ? '（基线）' : '')" :value="d.dirPath">
                <span>{{ d.label }}</span>
                <span class="opt-sub">{{ shortPath(d.dirPath) }}</span>
              </el-option>
            </el-select>
          </div>
          <div class="cmp-field">
            <label class="cmp-label">待测目录</label>
            <el-select v-model="headDir" filterable allow-create class="cmp-select mono"
                       placeholder="本次提测那份代码">
              <el-option v-for="d in codeDirs" :key="'h' + d.id" :label="d.label" :value="d.dirPath">
                <span>{{ d.label }}</span>
                <span class="opt-sub">{{ shortPath(d.dirPath) }}</span>
              </el-option>
            </el-select>
          </div>
        </div>
        <div class="cmp-actions">
          <el-button type="primary" :loading="loading" :disabled="!project || !baseDir || !headDir" @click="analyzeDirs">
            开始分析
          </el-button>
          <el-button @click="openDirMgr">管理目录</el-button>
        </div>
      </template>

      <template v-else>
        <div class="cmp-grid">
          <div class="cmp-field">
            <label class="cmp-label">项目</label>
            <ProjectCascadeSelect
              v-model="project"
              :groups="projectGroups"
              width="100%"
              placeholder="从项目管理里选"
              require-ready
              @change="onProjectChange"
            />
          </div>
          <div class="cmp-field">
            <label class="cmp-label">基线分支</label>
            <el-select v-model="baseRef" filterable allow-create class="cmp-select mono" placeholder="如 master / testing"
                       :loading="branchLoading">
              <el-option v-for="b in branches" :key="'b-' + b" :label="b" :value="b" />
            </el-select>
          </div>
          <div class="cmp-field">
            <label class="cmp-label">待测分支</label>
            <el-select v-model="headRef" filterable allow-create class="cmp-select mono" placeholder="本次提测的分支"
                       :loading="branchLoading">
              <el-option v-for="b in branches" :key="'h-' + b" :label="b" :value="b" />
            </el-select>
          </div>
        </div>
        <div class="cmp-actions">
          <el-button type="primary" :loading="loading" :disabled="!project || branchLoading" @click="analyze">
            开始分析
          </el-button>
          <span v-if="branchLoading" class="sync-line">正在拉取最新代码…</span>
          <span v-else-if="syncMsg && !syncBad" class="sync-line">{{ syncMsg }}</span>
        </div>
      </template>

      <div v-if="mode === 'branch' && syncFailure" class="sync-fail">
        <el-icon class="sync-fail-icon"><WarningFilled /></el-icon>
        <div class="sync-fail-body">
          <div class="sync-fail-title">
            拉取最新代码失败，用的是本地代码
            <span class="sync-fail-tag">结果可能不是最新</span>
          </div>
          <div class="sync-fail-detail">{{ syncFailure }}</div>
        </div>
        <el-popover
          v-model:visible="syncHelpVisible"
          placement="bottom-end"
          :width="340"
          trigger="click"
          popper-class="sync-help-popper"
        >
          <template #reference>
            <button type="button" class="sync-fail-link">怎么办</button>
          </template>
          <div class="sync-help">
            <div class="sync-help-head">
              <span class="sync-help-badge">!</span>
              <span class="sync-help-title">拉不到最新代码</span>
            </div>
            <p class="sync-help-lead">连上公司 <b>VPN / 内网</b>，大多能解决。</p>
            <div class="sync-help-actions">
              <el-button type="primary" :loading="branchLoading" @click="retrySync">
                <el-icon v-if="!branchLoading"><Refresh /></el-icon>
                <span>重新拉取</span>
              </el-button>
              <button type="button" class="sync-help-toggle" @click="syncHelpMore = !syncHelpMore">
                {{ syncHelpMore ? '收起' : '其它办法' }}
                <el-icon :class="{ up: syncHelpMore }"><ArrowDown /></el-icon>
              </button>
            </div>
            <ul v-if="syncHelpMore" class="sync-help-list">
              <li>核对「项目管理」里的 <b>GitLab 地址</b></li>
              <li>本机能 <code>git clone</code> 这个地址</li>
              <li>或切「<a class="sync-help-link" @click="switchToDirMode">目录对比</a>」，用本地两份代码比</li>
            </ul>
          </div>
        </el-popover>
      </div>

      <el-alert
        v-if="errorMsg"
        type="error"
        :closable="false"
        show-icon
        :title="errorMsg"
        style="margin-bottom: 12px"
      />

      <div v-if="!report && !loading && !errorMsg" class="cmp-empty">
        <div class="cmp-empty-icon">📦</div>
        <div>
          <div class="cmp-empty-title">还没有分析结果</div>
          <div class="cmp-empty-sub">
            {{ mode === 'branch'
              ? '选项目和分支，点「开始分析」。分支列表会从本地仓库自动读出来。'
              : '填两个本地目录，点「开始分析」。目录里若套了一层工程根会自动定位。' }}
          </div>
        </div>
      </div>

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
        <div class="stat-row" role="tablist">
          <a
            v-for="s in statCards"
            :key="s.key"
            role="tab"
            class="stat-card"
            :class="{ danger: s.danger, empty: !s.value, active: isStatActive(s.key) }"
            :aria-selected="isStatActive(s.key)"
            @click="pickStat(s.key)"
          >
            <div class="stat-num">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </a>
        </div>

        <div v-if="reportNotes.length" class="report-notes">
          <span v-for="(n, i) in reportNotes" :key="i">{{ n }}</span>
        </div>

        <EndpointDiffView
          v-if="activeSec === 'ep'"
          v-model:filter="epFilter"
          :report="report"
          :project="reportProjectCode"
          :refs="reportRefs"
          @open-table="openTableImpact"
          @open-schema="openSchemaFor"
          @edit-case="goReviewCase"
        />

        <template v-else>
          <p class="section-sub">这些改动没能挂到具体接口上。能挂上的（读写的表、调到的实现、接口上的安全问题）都已经放进对应接口里了。</p>
          <el-empty
            v-if="!linked.unlinkedCount"
            :description="skipItems.length ? '没有要单独测的，剩下的都是不用测的改动' : '全部都挂到接口上了'"
            :image-size="60"
          />

          <section v-if="dtoItems.length" class="ul-sec">
            <div class="section-head"><span class="section-name">公共返回体（{{ dtoItems.length }}）</span></div>
            <p class="section-sub">被多处引用、或没能连回具体接口的返回体，用到它的接口都会受影响。</p>
            <div v-for="d in dtoItems" :key="d.ref.path" class="ul-dto">
              <div class="ul-dto-head">
                <code>{{ d.ref.path }}</code>
                <span class="muted">{{ d.file }}</span>
              </div>
              <JsonDiffView :blocks="d.blocks" :project="reportProjectCode" :endpoint="d.ref" :marks="otherMarks" />
            </div>
          </section>

          <section v-if="linked.unlinked.tables.length" class="ul-sec">
            <div class="section-head"><span class="section-name">没有接口用到的表（{{ linked.unlinked.tables.length }}）</span></div>
          <el-alert
            v-if="report.schemaNote"
            type="info"
            :closable="false"
            show-icon
            :title="report.schemaNote"
            style="margin-bottom: 8px"
          />
                    <el-table :data="linked.unlinked.tables" size="small" border>
            <el-table-column label="表名" width="240">
              <template #default="{ row }">
                <a class="catalog-link" @click="openTableImpact(row.table)">{{ row.table }}</a>
                <div v-if="row.ddlSource" class="ddl-source">{{ row.ddlSource }}</div>
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
                <template v-else>
                  <span class="muted">关联的测试库里没读到这张表</span>
                  <el-button link type="primary" @click="openSchemaFor(row.table)">手动补建表语句</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          </section>

          <section v-if="linked.unlinked.others.length" class="ul-sec">
            <div class="section-head"><span class="section-name">定时任务 / 配置等改动（{{ linked.unlinked.others.length }}）</span></div>
          <div class="other-list">
            <div v-for="g in otherGroups" :key="g.kind" class="other-group">
              <div
                class="other-row"
                :class="{ clickable: g.items.length > 1 }"
                @click="g.items.length > 1 && toggleOther(g.kind)"
              >
                <span class="other-kind">
                  <el-tag size="small" :type="kindTag(g.kind)" effect="plain">{{ kindLabel(g.kind) }}</el-tag>
                </span>
                <span class="other-file">
                  <template v-if="g.items.length > 1">
                    <el-icon class="other-arrow" :class="{ open: openOther.has(g.kind) }"><ArrowRight /></el-icon>
                    {{ g.items.length }} 个文件
                  </template>
                  <el-tooltip v-else :content="g.items[0].file" placement="top" :show-after="200">
                    <span class="mono">{{ otherFileName(g.items[0]) }}</span>
                  </el-tooltip>
                </span>
                <span class="other-hint">{{ g.hint }}</span>
              </div>
              <template v-if="g.items.length > 1 && openOther.has(g.kind)">
                <div v-for="(o, j) in g.items" :key="j" class="other-row sub">
                  <span class="other-kind" />
                  <span class="other-file">
                    <el-tooltip :content="o.file" placement="top" :show-after="200">
                      <span class="mono">{{ otherFileName(o) }}</span>
                    </el-tooltip>
                  </span>
                  <span class="other-hint">{{ g.sameHint ? '' : o.hint }}</span>
                </div>
              </template>
            </div>
          </div>
          </section>

          <section v-if="linked.unlinked.findings.length" class="ul-sec">
            <div class="section-head danger"><span class="section-name">安全 / 设计问题（{{ linked.unlinked.findings.length }}）</span></div>
            <div
              v-for="(f, i) in linked.unlinked.findings"
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
          </section>

          <section v-if="skipItems.length" class="ul-sec ul-skip">
            <button type="button" class="ul-skip-head" @click="skipOpen = !skipOpen">
              <el-icon class="other-arrow" :class="{ open: skipOpen }"><ArrowRight /></el-icon>
              不用测的改动（{{ skipItems.length }}）
              <span class="muted">只挪了位置、只改了日志、已合进基线，或写了还没被用到——不计入上面的数</span>
            </button>
            <div v-if="skipOpen" class="other-list">
              <div v-for="(s, i) in skipItems" :key="'sk' + i" class="other-row sub">
                <span class="other-kind">
                  <el-tag size="small" type="info" effect="plain">{{ s.label }}</el-tag>
                </span>
                <span class="other-file">
                  <el-tooltip :content="s.file" placement="top" :show-after="200">
                    <span class="mono">{{ s.name }}</span>
                  </el-tooltip>
                </span>
                <span class="other-hint">{{ s.reason }}</span>
              </div>
            </div>
          </section>
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
import { ArrowRight, WarningFilled } from '@element-plus/icons-vue'
import ProjectCascadeSelect from '@/components/ProjectCascadeSelect.vue'
import EndpointDiffView from '@/components/EndpointDiffView.vue'
import JsonDiffView from '@/components/JsonDiffView.vue'
import { dtoBlocks } from '@/utils/jsonDiffTree'
import { CTX_FILTERS, linkReport } from '@/utils/endpointContext'
import { useFieldMarks } from '@/composables/useFieldMarks'

const router = useRouter()
const route = useRoute()

/** branch=从 git 仓库读分支比；dir=两个本地目录直接比（拿不到内网时用） */
const mode = ref<'branch' | 'dir'>('branch')
const baseDir = ref('')
const headDir = ref('')

function onModeChange() {
  report.value = null
  errorMsg.value = ''
  if (mode.value === 'dir') loadCodeDirs()
  else if (project.value) onProjectChange()
}

async function analyzeDirs() {
  loading.value = true
  errorMsg.value = ''
  report.value = null
  try {
    reportProject.value = project.value
    report.value = await apiClient.analyzeApiChangeDirs({
      project: project.value,
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

/** 报告按接口归拢：能挂到接口上的都挂上，挂不上的进「没关联到接口」 */
const linked = computed(() => linkReport(report.value))

const STAT_KEYS: Array<{ key: string; label: string; danger: boolean }> = [
  { key: 'ALL', label: '接口', danger: false },
  { key: 'BREAKING', label: '可能不兼容', danger: true },
  { key: 'CONC', label: '并发风险', danger: true },
  { key: 'FINDING', label: '安全/设计', danger: true },
  { key: 'NOCASE', label: '没有用例', danger: true }
]

const statCards = computed(() => [
  ...STAT_KEYS.map((k) => {
    const test = CTX_FILTERS.find((f) => f.key === k.key)!.test
    return { ...k, value: linked.value.ctxs.filter(test).length }
  }),
  { key: 'other', label: '没关联到接口', value: linked.value.unlinkedCount, danger: false }
])

/** ep：按接口看（统计卡片是它的快捷筛选）；other：没关联到接口的 */
const activeSec = ref<'ep' | 'other'>('ep')
const epFilter = ref('ALL')

function isStatActive(key: string) {
  return key === 'other' ? activeSec.value === 'other' : activeSec.value === 'ep' && epFilter.value === key
}

function pickStat(key: string) {
  if (key === 'other') {
    activeSec.value = 'other'
    return
  }
  activeSec.value = 'ep'
  epFilter.value = key
}

function resetSections() {
  activeSec.value = 'ep'
  epFilter.value = 'ALL'
}

const otherMarks = computed(() =>
  reportProjectCode.value || reportRefs.value ? useFieldMarks(reportProjectCode.value, reportRefs.value) : null
)

const dtoItems = computed(() =>
  linked.value.unlinked.dtos.map((d: any) => ({
    file: d.file,
    blocks: dtoBlocks(d),
    ref: { method: 'DTO', path: d.type }
  }))
)

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

const projectGroups = ref<any[]>([])
const projects = computed<any[]>(() => projectGroups.value.flatMap((g: any) => g.projects || []))
const branches = ref<string[]>([])
const branchLoading = ref(false)
const syncMsg = ref('')
const syncBad = ref(false)
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
    reportProject.value = row.project || ''
    errorMsg.value = ''
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

/** 历史报告里还存着已下线的「返回体文件归集」说明 */
const reportNotes = computed<string[]>(() =>
  (report.value?.notes || []).filter((n: string) => !String(n).startsWith('字段按「返回体文件」归集'))
)

const reportProject = ref('')
const reportProjectCode = computed(() => reportProject.value || project.value || '')
const reportRefs = computed(() =>
  report.value ? `${report.value.baseRef || ''}..${report.value.headRef || ''}` : ''
)

function otherFileName(o: any) {
  if (o.fileName) return o.fileName
  const f = String(o.file || '')
  return f.slice(f.lastIndexOf('/') + 1) || f
}

const otherGroups = computed(() => {
  const map = new Map<string, any[]>()
  for (const o of linked.value.unlinked.others) {
    const k = o.kind || 'OTHER'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(o)
  }
  return [...map.entries()].map(([kind, items]) => {
    const hints = new Set(items.map((o) => o.hint || ''))
    const sameHint = hints.size === 1
    return { kind, items, sameHint, hint: sameHint ? items[0].hint : '各文件原因不同，展开看' }
  })
})

const skipItems = computed(() => [
  ...linked.value.unlinked.trivial.map((o: any) => ({
    label: kindLabel(o.kind || 'OTHER'),
    name: otherFileName(o),
    file: o.file,
    reason: o.trivial
  })),
  ...linked.value.unlinked.unusedDtos.map((f: string) => ({
    label: '返回体',
    name: f.slice(f.lastIndexOf('/') + 1),
    file: f,
    reason: '整个代码里没有别处用到这个类，改了也影响不到接口'
  }))
])

const openOther = ref<Set<string>>(new Set())
const skipOpen = ref(false)
watch(report, () => {
  openOther.value = new Set()
  skipOpen.value = false
  resetSections()
})

function toggleOther(kind: string) {
  const next = new Set(openOther.value)
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  openOther.value = next
}

const KIND_LABELS: Record<string, string> = {
  SCHEDULE: '定时任务',
  CACHE: '缓存',
  CONFIG: '配置',
  MAPPER: '数据访问',
  SERVICE: '业务实现',
  SERVICE_SCHEDULED: '实现+定时',
  OTHER: '其它'
}

function kindLabel(k: string) {
  return KIND_LABELS[k] || k
}

function kindTag(k: string) {
  if (k === 'SCHEDULE' || k === 'SERVICE_SCHEDULED') return 'warning'
  if (k === 'CACHE') return 'danger'
  return 'info'
}

async function loadProjects() {
  try {
    const res = await apiClient.getApiChangeProjects()
    projectGroups.value = Array.isArray(res?.groups) ? res.groups : []
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

let branchSeq = 0
async function onProjectChange() {
  branches.value = []
  headRef.value = ''
  report.value = null
  errorMsg.value = ''
  syncMsg.value = ''
  syncBad.value = false
  const p = projects.value.find((x) => x.code === project.value)
  baseRef.value = p?.baseBranch || ''
  if (mode.value === 'dir') return
  if (!p?.ready) {
    errorMsg.value = `项目「${p?.name || project.value}」还没填 GitLab 地址，去「项目管理」里补上`
    return
  }
  const my = ++branchSeq
  branchLoading.value = true
  try {
    const res = await apiClient.getApiChangeBranches(project.value, true)
    if (my !== branchSeq) return
    branches.value = res.branches || []
    // 待测分支默认取仓库当前分支，多数情况就是人正在看的那个
    headRef.value = res.current || ''
    if (!baseRef.value) {
      // 基线没配就猜一个：这几个仓库有的用 master、有的用 testing
      baseRef.value = branches.value.find((b) => b === 'master' || b === 'main' || b === 'testing') || ''
    }
    if (res.sync) {
      syncBad.value = res.sync.ok === false
      syncMsg.value = res.sync.ok === false
        ? res.sync.message
        : res.sync.action === 'CLONE' ? '已从 GitLab clone 到本地' : '已拉取最新代码'
    }
  } catch (e: any) {
    if (my !== branchSeq) return
    errorMsg.value = e?.message || '读取分支失败'
  } finally {
    if (my === branchSeq) branchLoading.value = false
  }
}

const SYNC_FAIL_PREFIX = /^拉取最新代码失败[，,]?用的是本地已有代码[：:]\s*/

const syncFailure = computed(() => {
  const raw = syncBad.value
    ? syncMsg.value
    : report.value?.repoSync?.ok === false
      ? report.value.repoSync.message
      : ''
  return raw ? String(raw).replace(SYNC_FAIL_PREFIX, '') : ''
})

const syncHelpVisible = ref(false)
const syncHelpMore = ref(true)

function switchToDirMode() {
  syncHelpVisible.value = false
  mode.value = 'dir'
  onModeChange()
}

async function retrySync() {
  if (!project.value) return
  const my = ++branchSeq
  branchLoading.value = true
  try {
    const res = await apiClient.getApiChangeBranches(project.value, true)
    if (my !== branchSeq) return
    branches.value = res.branches || []
    if (!headRef.value) headRef.value = res.current || ''
    syncBad.value = res.sync?.ok === false
    syncMsg.value = res.sync?.ok === false ? res.sync.message : '已拉取最新代码'
    if (!syncBad.value && report.value?.repoSync) report.value.repoSync = { ...report.value.repoSync, ok: true }
    if (syncBad.value) ElMessage.warning('还是拉不到，看看网络或 GitLab 地址')
    else ElMessage.success('已拉取最新代码')
  } catch (e: any) {
    if (my === branchSeq) ElMessage.error(e?.message || '拉取失败')
  } finally {
    if (my === branchSeq) branchLoading.value = false
  }
}

async function analyze() {
  loading.value = true
  errorMsg.value = ''
  report.value = null
  try {
    reportProject.value = project.value
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

onMounted(async () => {
  loadCodeDirs()
  await loadProjects()
  const rid = Number(route.query.reportId || 0)
  if (rid > 0) await openHistoryReport(rid)
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
  color: var(--el-text-color-secondary);
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.mode-switch {
  margin-bottom: 16px;
}

.cmp-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 20px;
}
.cmp-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.cmp-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cmp-select {
  width: 100%;
}
.cmp-select.mono :deep(.el-select__selected-item),
.cmp-select.mono :deep(.el-input__inner) {
  font-family: ui-monospace, Menlo, monospace;
}
.opt-sub {
  float: right;
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.cmp-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.sync-fail {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #fffbeb;
}
.sync-fail-icon {
  margin-top: 2px;
  font-size: 16px;
  color: #f59e0b;
}
.sync-fail-body {
  flex: 1;
  min-width: 0;
}
.sync-fail-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
}
.sync-fail-tag {
  padding: 0 6px;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  color: #b45309;
  background: #fff;
}
.sync-fail-detail {
  margin-top: 6px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: #b8915a;
  word-break: break-all;
}
.sync-fail-link {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: #b45309;
  cursor: pointer;
}
.sync-fail-link:hover {
  text-decoration: underline;
}
.sync-help {
  padding: 4px 4px 2px;
  font-size: 13px;
  color: #4e5969;
}
.sync-help-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sync-help-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.sync-help-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}
.sync-help-lead {
  margin: 10px 0 12px;
  line-height: 1.6;
}
.sync-help-lead b {
  font-weight: 600;
  color: #1f2329;
}
.sync-help-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.sync-help-actions .el-button {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-weight: 600;
}
.sync-help-actions .el-button .el-icon + span {
  margin-left: 4px;
}
.sync-help-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
}
.sync-help-toggle .el-icon {
  font-size: 11px;
  transition: transform 0.15s;
}
.sync-help-toggle .el-icon.up {
  transform: rotate(180deg);
}
.sync-help-list {
  margin: 14px 0 0;
  padding: 12px 0 0 4px;
  border-top: 1px dashed #e5e6eb;
  list-style: none;
}
.sync-help-list li {
  position: relative;
  padding-left: 14px;
  line-height: 1.6;
}
.sync-help-list li + li {
  margin-top: 8px;
}
.sync-help-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c9cdd4;
}
.sync-help-list b {
  font-weight: 600;
  color: #1f2329;
}
.sync-help-list code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: #1f2329;
}
.sync-help-link {
  font-weight: 600;
  color: #1f2329;
  cursor: pointer;
}
.sync-help-link:hover {
  color: var(--el-color-primary);
}

.cmp-empty {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: #fafbfc;
}
.cmp-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 18px;
}
.cmp-empty-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cmp-empty-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.mode-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: -8px 0 14px;
  line-height: 1.6;
}

.main-card {
  border-radius: 12px;
}

.sync-line {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.ddl-source {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
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
}

.stat-card.active {
  border-color: var(--app-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 -3px 0 var(--app-primary);
  opacity: 1;
}

.stat-card.active .stat-label {
  color: var(--app-primary);
  font-weight: 600;
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
  margin: 4px 0 6px;
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

.f-muted {
  color: var(--el-text-color-secondary);
}

.other-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  font-size: 13px;
}

.other-group + .other-group {
  border-top: 1px solid var(--el-border-color-lighter);
}

.other-row {
  display: grid;
  grid-template-columns: 110px minmax(200px, 1fr) 2fr;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
}

.other-row.clickable {
  cursor: pointer;
}

.other-row.clickable:hover {
  background: var(--el-fill-color-light);
}

.other-row.sub {
  padding-top: 3px;
  padding-bottom: 3px;
  font-size: 12.5px;
}

.other-file {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--app-text-regular);
}

.other-file .mono {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-arrow {
  font-size: 12px;
  transition: transform 0.15s;
}

.other-arrow.open {
  transform: rotate(90deg);
}

.other-hint {
  color: var(--el-text-color-secondary);
  line-height: 1.5;
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

.ul-sec {
  margin-bottom: 18px;
}
.ul-skip-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.ul-skip-head .muted {
  font-weight: 400;
  font-size: 12px;
}
.ul-skip .other-list {
  background: var(--el-fill-color-lighter);
}
.ul-skip .other-row {
  padding-top: 5px;
  padding-bottom: 5px;
}
.ul-dto {
  margin-bottom: 12px;
}
.ul-dto-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.ul-dto-head code {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
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
  color: #b8915a;
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
  color: var(--el-text-color-placeholder);
}

.table-file {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
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

.cr-hint{color:var(--el-text-color-placeholder);font-size:12.5px;margin:4px 0 2px}
.must-points{display:flex;flex-wrap:wrap;gap:6px}
.must-point{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px solid var(--el-border-color);border-radius:10px;background:#fff;font-size:12px;color:var(--app-text-regular);cursor:pointer}
.must-point b{font-weight:600}
.must-point:hover{border-color:var(--el-color-primary)}
.must-point.is-primary b{color:var(--el-color-primary)}
.must-point.is-danger{border-color:var(--el-color-danger-light-5);color:var(--el-color-danger)}
.must-point.is-warning b{color:var(--el-color-warning-dark-2)}
.must-point.is-success b{color:var(--el-color-success)}
.must-point.is-info b{color:var(--el-text-color-secondary)}
.case-review{margin:12px 0;padding:12px 14px;background:var(--el-color-warning-light-9);border:1px solid #ffe0a3;border-radius:8px}
.case-review.empty{background:var(--el-color-success-light-9);border-color:var(--el-color-success-light-7)}
.case-review.empty .cr-head{color:var(--el-color-success-dark-2)}
.case-review .cr-head{display:flex;align-items:center;gap:6px;color:#c67a13;font-size:14px}
.case-review .cr-hint{color:#b8915a;font-size:12.5px;margin:4px 0 2px}
.case-review .cr-ep{font-family:monospace;font-size:12.5px;color:var(--app-text-regular)}
.case-review .cr-reason{margin:2px 0;font-size:12.5px}
.cr-table{cursor:pointer}
</style>

<style>
.el-popover.sync-help-popper {
  padding: 14px 16px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}
</style>
