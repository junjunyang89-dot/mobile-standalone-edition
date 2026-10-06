<template>
  <div class="api-endpoints">
    <Teleport v-if="paneActive" to="#page-header-actions">
      <div class="env-seg">
        <button
          type="button"
          class="env-seg-item"
          :class="{ active: environment === 'TEST' }"
          @click="setEnvironment('TEST')"
        >
          <i class="env-dot is-test" />测试
        </button>
        <button
          type="button"
          class="env-seg-item"
          :class="{ active: environment === 'PROD' }"
          @click="setEnvironment('PROD')"
        >
          <i class="env-dot is-prod" />生产
        </button>
      </div>
      <el-button :loading="loading || treeLoading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
      <el-button @click="openImportDoc">
        <el-icon><Upload /></el-icon>
        导入
      </el-button>
      <el-button @click="openScanAll">
        {{ scanAllJob && !scanAllJob.done ? '扫描中…' : '扫描全部项目' }}
      </el-button>
      <el-button @click="openAiBatch">
        {{ aiBatch?.running ? '生成用例中…' : '批量生成用例' }}
      </el-button>
      <el-tooltip
        v-if="preflight.length"
        content="早期收录时带进来的浏览器跨域预检，不是业务接口，生成不了用例"
        placement="bottom"
      >
        <el-button type="warning" plain :loading="purgingPreflight" @click="purgePreflight">
          清理 OPTIONS 预检 {{ preflight.length }}
        </el-button>
      </el-tooltip>
      <el-tooltip
        v-if="misplaced.length"
        content="按路径第一段看，这些接口像是收录时放错了项目（比如 /appuser/… 在 APP-EVENT 下）"
        placement="bottom"
      >
        <el-button type="danger" plain @click="openMisplaced">疑似放错项目 {{ misplaced.length }}</el-button>
      </el-tooltip>
    </Teleport>

    <div class="stats">
      <div class="stat">
        <b class="stat-num">{{ stats.total }}</b>
        <div class="stat-text">
          <div class="stat-label">接口总数</div>
          <div class="stat-sub">{{ requirementNo ? requirementNo + ' 涉及' : '全部项目' }}</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-green">{{ stats.covered }}</b>
        <div class="stat-text">
          <div class="stat-label">已覆盖</div>
          <div class="stat-sub">{{ pct(stats.covered, stats.total) }}</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-orange">{{ stats.uncovered }}</b>
        <div class="stat-text">
          <div class="stat-label">未覆盖</div>
          <div class="stat-sub">没有用例</div>
        </div>
      </div>
      <div class="stat">
        <b class="stat-num is-blue">{{ stats.changed }}</b>
        <div class="stat-text">
          <div class="stat-label">本版变更</div>
          <div class="stat-sub">{{ stats.added }} 新增 · {{ stats.changed - stats.added }} 有改动</div>
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="kw-input"
        placeholder="搜索路径、接口名或 Controller…"
        clearable
        :prefix-icon="Search"
      />
      <div class="chips">
        <button type="button" class="chip" :class="{ active: !chip }" @click="chip = ''">全部</button>
        <button
          v-for="l in langChips"
          :key="l.lang"
          type="button"
          class="chip"
          :class="{ active: chip === 'lang:' + l.lang }"
          @click="toggleChip('lang:' + l.lang)"
        >
          {{ l.lang }} <span class="chip-num">{{ l.count }}</span>
        </button>
        <span v-if="langChips.length" class="chip-sep" />
        <button
          v-for="c in stateChips"
          :key="c.value"
          type="button"
          class="chip"
          :class="{ active: chip === c.value }"
          @click="toggleChip(c.value)"
        >
          {{ c.label }} <span class="chip-num">{{ c.count }}</span>
        </button>
        <el-button
          v-if="chip === 'DEAD' && deadInProject.length"
          size="small"
          type="warning"
          plain
          class="retire-all"
          :loading="retiring"
          @click="retireAllDead"
        >
          当前项目全部标记废弃（{{ deadInProject.length }}）
        </el-button>
      </div>
    </div>

    <div v-if="requirementNo" class="req-bar">
      只看 <b>{{ requirementNo }}</b> 涉及的 {{ reqPathKeys.size }} 个接口
      <template v-if="targetCollectionName">，生成的用例归入「{{ targetCollectionName }}」</template>
      <el-button v-if="targetCollectionId" link type="primary" size="small" @click="openCollection">看集合用例</el-button>
      <el-button
        v-if="batchMissingCount > 0"
        type="success"
        size="small"
        class="req-batch"
        :loading="batchGenerating"
        @click="generateAllMissing"
      >
        当前项目批量生成 {{ batchMissingCount }} 条
      </el-button>
    </div>

    <div class="ep-shell">
      <aside class="tree" v-loading="treeLoading">
        <div class="tree-head">
          <span class="tree-title">项目树</span>
          <button type="button" class="tree-toggle" @click="toggleAllCats">
            {{ allCatsCollapsed ? '全部展开' : '全部收起' }}
          </button>
        </div>
        <el-input v-model="projKeyword" class="tree-search" placeholder="搜索项目…" clearable :prefix-icon="Search" />
        <div v-for="cat in categories" :key="cat.key" class="tree-cat">
          <button type="button" class="cat-head" @click="toggleCat(cat.key)">
            <el-icon class="caret" :class="{ open: !collapsedCats.has(cat.key) }"><ArrowRight /></el-icon>
            <i class="cat-dot" :style="{ background: catColor(cat.key) }" />
            <span class="cat-name">{{ cat.label }}</span>
            <span class="cat-num">{{ catCount(cat) }}</span>
          </button>
          <div v-if="!collapsedCats.has(cat.key)" class="cat-body">
            <template v-for="block in shownKindBlocks(cat)" :key="block.key">
              <div v-if="block.label" class="kind-head">{{ block.label }}</div>
              <button
                v-for="p in block.projects"
                :key="p.project"
                type="button"
                class="proj-item"
                :class="{ active: project === p.project, 'is-dim': projCount(p) === 0 }"
                :title="p.label && p.label !== p.project ? p.label : ''"
                @click="pickProject(p.project)"
              >
                <i class="proj-dot" />
                <span class="proj-code">{{ p.project.toUpperCase() }}</span>
                <span class="proj-num">{{ projCount(p) }}</span>
              </button>
            </template>
            <div v-if="pageCount(cat) > 1" class="proj-pager">
              <button
                type="button"
                class="pager-btn"
                :disabled="pageOf(cat) <= 1"
                @click="setPage(cat, pageOf(cat) - 1)"
              >
                <el-icon><ArrowLeft /></el-icon>
              </button>
              <span class="pager-text">{{ pageOf(cat) }} / {{ pageCount(cat) }}</span>
              <button
                type="button"
                class="pager-btn"
                :disabled="pageOf(cat) >= pageCount(cat)"
                @click="setPage(cat, pageOf(cat) + 1)"
              >
                <el-icon><ArrowRight /></el-icon>
              </button>
              <span class="pager-total">共 {{ matchedProjects(cat).length }} 个</span>
            </div>
            <div v-if="!matchedProjects(cat).length" class="proj-empty">没有匹配的项目</div>
          </div>
        </div>
      </aside>

      <section class="main">
        <div class="main-head">
          <div class="main-head-text">
            <div class="main-title">{{ isInbox ? '抓包待归类' : project.toUpperCase() }}</div>
            <div class="main-meta">
              <template v-if="isInbox">
                <span>认不出归属的接口先放这里，勾选后归到具体项目</span>
              </template>
              <template v-else>
                <template v-for="(m, i) in projectMeta" :key="i">
                  <span v-if="i" class="meta-sep" />
                  <span>{{ m }}</span>
                </template>
              </template>
            </div>
          </div>
          <div class="main-stats">
            <span>已覆盖 <b>{{ projectCovered }}</b>/{{ projectAll.length }}</span>
            <span class="meta-sep" />
            <span>变更 <b>{{ projectChanged }}</b></span>
            <template v-if="isInbox">
              <el-button
                type="primary"
                size="small"
                class="rescan-link"
                :disabled="!selectedIds.length"
                :loading="classifying"
                @click="classifyVisible = true"
              >
                归类到项目{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
              </el-button>
            </template>
            <template v-else>
              <el-button link type="primary" size="small" class="rescan-link" @click="authVisible = true">
                登录配置 <el-icon><ArrowRight /></el-icon>
              </el-button>
              <el-button link type="primary" size="small" class="rescan-link" @click="aiGenVisible = true">
                AI 生成用例 <el-icon><ArrowRight /></el-icon>
              </el-button>
              <el-button
                v-if="selectedCaptureIds.length"
                type="success"
                size="small"
                plain
                class="rescan-link"
                :loading="aiGenningSelected"
                @click="aiGenSelected"
              >
                按抓包 AI 生成（{{ selectedCaptureIds.length }}）
              </el-button>
              <el-tooltip
                v-if="selectedIds.length && !isInbox"
                content="读源码里每个入参怎么处理（不传 / 传错类型 / 越界 / 不支持的取值），以抓包请求为基础每条只改一个参数；GET 会试跑，和源码推断一致的直接启用"
                placement="top"
              >
                <el-button
                  size="small"
                  plain
                  class="rescan-link"
                  :loading="sourceGenning"
                  :disabled="selectedIds.length > 50"
                  @click="sourceGenSelected"
                >
                  按源码补参数用例（{{ selectedIds.length }}）
                </el-button>
              </el-tooltip>
              <el-button
                v-if="selectedIds.length"
                size="small"
                plain
                class="rescan-link"
                @click="classifyVisible = true"
              >
                移到其他项目（{{ selectedIds.length }}）
              </el-button>
              <el-button link type="primary" size="small" class="rescan-link" @click="openDup">
                查重复接口
              </el-button>
              <el-button link type="primary" size="small" class="rescan-link" @click="openScan">
                全量重扫该项目 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </template>
          </div>
        </div>

        <div v-loading="loading" class="groups">
          <div v-for="g in groups" :key="g.key" class="group-card">
            <button type="button" class="group-head" @click="toggleGroup(g.key)">
              <el-icon class="caret" :class="{ open: openGroups.has(g.key) }"><ArrowRight /></el-icon>
              <span class="lang-icon" :class="`is-${(g.lang || 'none').toLowerCase()}`">{{ langIcon(g.lang) }}</span>
              <span class="group-title">{{ g.name }}</span>
              <span v-if="g.lang" class="lang-tag" :class="`is-${g.lang.toLowerCase()}`">{{ g.lang }}</span>
              <span class="group-count">{{ g.rows.length }}</span>
            </button>
            <div v-if="openGroups.has(g.key)" class="ep-table">
              <div class="ep-row is-head">
                <span class="sel-col">
                  <input
                    v-if="canSelect"
                    type="checkbox"
                    :checked="allPageSelected"
                    @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
                  />
                </span>
                <span>方法</span>
                <span>接口</span>
                <span>{{ environment === 'PROD' ? '生产网关' : '测试网关' }}</span>
                <span>变更</span>
                <span class="center">覆盖</span>
                <span class="right">操作</span>
              </div>
              <div
                v-for="row in g.rows"
                :key="row.id"
                class="ep-row"
                :class="{ 'is-deprecated': isRetiredOrGone(row) }"
              >
                <span class="sel-col">
                  <input
                    v-if="canSelect"
                    type="checkbox"
                    :checked="selectedIds.includes(row.id)"
                    @change="toggleSelect(row.id, ($event.target as HTMLInputElement).checked)"
                  />
                </span>
                <span>
                  <span class="method" :class="`is-${(row.httpMethod || 'GET').toLowerCase()}`">{{ row.httpMethod }}</span>
                </span>
                <span class="ep-name-cell">
                  <span class="ep-summary-line">
                    <el-dropdown
                      v-if="!isRetiredOrGone(row)"
                      class="lvl-dd"
                      :class="{ 'is-tail': !(row.level === 'CORE' || row.level === 'IMPORTANT') }"
                      trigger="click"
                      placement="bottom-start"
                      @command="(cmd: string) => setLevel(row, cmd)"
                    >
                      <button
                        type="button"
                        class="lvl-tag"
                        :class="row.level === 'CORE' || row.level === 'IMPORTANT' ? `is-${row.level.toLowerCase()}` : 'is-empty'"
                        :title="row.levelReason || ''"
                      >
                        {{ row.level === 'CORE' || row.level === 'IMPORTANT' ? row.levelLabel : '定级' }}<template v-if="row.levelManual">·手动</template>
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <div v-if="row.levelReason" class="lvl-reason">{{ row.levelReason }}</div>
                          <el-dropdown-item
                            v-for="o in LEVEL_OPTIONS"
                            :key="o.value"
                            :command="o.value"
                            :disabled="row.level === o.value"
                          >
                            定为{{ o.label }}
                          </el-dropdown-item>
                          <el-dropdown-item v-if="row.levelManual" command="AUTO" divided>恢复自动判断</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <span v-if="row.summary" class="ep-summary">{{ row.summary }}</span>
                    <span v-else class="ep-summary is-blank">待补中文名</span>
                    <span v-if="row.authRequired" class="auth-tag" title="源码里挂了登录注解">需登录</span>
                    <span v-if="row.hasCaptureMeta" class="cap-src-tag" title="客户端抓包抓到过：真机在调，自动算核心">抓包</span>
                    <span
                      v-if="row.goneAt && !row.retiredAt"
                      class="gone-tag"
                      :class="{ 'is-live': row.hasCaptureMeta }"
                      :title="goneTitle(row)"
                    >{{ goneLabel(row) }}</span>
                    <span
                      v-if="row.writeEffect && !isRetiredOrGone(row)"
                      class="we-tag"
                      :class="WRITE_EFFECT_META[row.writeEffect]?.cls"
                      :title="row.writeEffectReason || ''"
                    >{{ writeEffectText(row.writeEffect, row.writeEffectLabel) }}</span>
                    <span
                      v-if="row.retiredAt"
                      class="caller-tag is-retired"
                      :title="`${row.retiredBy || '有人'} 于 ${fmtTime(row.retiredAt)} 标记废弃，不再生成用例`"
                    >已废弃</span>
                    <el-popover
                      v-else-if="row.callerStatus"
                      trigger="click"
                      placement="bottom-start"
                      :width="480"
                      popper-class="caller-popper"
                    >
                      <template #reference>
                        <button
                          type="button"
                          class="caller-tag"
                          :class="row.callerStatus === 'USED' ? 'is-used' : 'is-dead'"
                        >
                          {{ row.callerStatus === 'USED' ? `调用 ${usedCallers(row).length}` : '疑似废弃' }}
                        </button>
                      </template>
                      <div class="caller-pop">
                        <div class="caller-pop-title">
                          {{
                            row.callerStatus === 'USED'
                              ? '调用方'
                              : row.callerStatus === 'DEF_ONLY'
                                ? '疑似废弃 · 只写了封装，没人引用'
                                : '疑似废弃 · 其他仓库里没找到调用'
                          }}
                        </div>
                        <div v-for="(c, i) in row.callers || []" :key="i" class="caller-item" :class="{ 'is-unused': c.unused }">
                          <div class="caller-loc">
                            <span class="caller-repo">{{ c.repo }}</span>
                            <span class="caller-file" :title="`${c.file}:${c.line}`">{{ c.file }}:{{ c.line }}</span>
                          </div>
                          <div v-if="c.via" class="caller-via">
                            <code>{{ c.via }}</code>
                            <template v-if="c.unused"> 没人引用</template>
                            <template v-else> ← {{ c.usedBy.join('、') }}</template>
                          </div>
                        </div>
                        <div v-if="row.callerStatus !== 'USED'" class="caller-pop-foot">
                          <span>确认已下线的话，标记后不再给它生成用例</span>
                          <el-button size="small" type="warning" plain :loading="retiring" @click="setRetired([row], true)">
                            标记废弃
                          </el-button>
                        </div>
                      </div>
                    </el-popover>
                  </span>
                  <span class="ep-path" :title="pathTitle(row)">
                    {{ row.path
                    }}<span v-if="row.codePath && row.codePath !== row.path" class="ep-code-path">代码 {{ row.codePath }}</span>
                  </span>
                </span>
                <span class="gw-cell">
                  <template v-if="urlOf(row)">
                    <span class="gw-url" :title="urlOf(row)">{{ hostOf(urlOf(row)) }}</span>
                    <button type="button" class="copy-btn" title="复制完整地址" @click="copy(urlOf(row) + row.path)">
                      <el-icon><CopyDocument /></el-icon>
                    </button>
                  </template>
                  <template v-else>
                    <span class="gw-missing">未配</span>
                    <el-button link type="primary" size="small" @click="openUrls">去配</el-button>
                  </template>
                </span>
                <span>
                  <span
                    v-if="row.changeFlag"
                    class="change-tag"
                    :class="changeClass(row.changeFlag)"
                    :title="changeTitle(row)"
                  >{{ changeLabel(row.changeFlag) }}</span>
                  <span v-else class="faint">—</span>
                  <span v-if="(row.branches?.length || 0) > 1" class="br-more" :title="changeTitle(row)">
                    {{ row.branches!.length }} 个分支
                  </span>
                </span>
                <span class="center">
                  <span
                    class="cov-badge"
                    :class="coverClass(row)"
                    :title="`${row.statusLabel}${row.statusHint ? '：' + row.statusHint : ''}`"
                  >{{ row.caseCount ?? 0 }}</span>
                </span>
                <span class="right ops">
                  <el-button v-if="isInbox" link type="primary" size="small" @click="classifyOne(row)">归类</el-button>
                  <el-button link type="primary" size="small" @click="openCases(row)">用例</el-button>
                  <el-button v-if="!isInbox" link type="primary" size="small" @click="openInsight(row)">体检</el-button>
                  <el-button
                    v-if="row.retiredAt"
                    link
                    type="warning"
                    size="small"
                    :loading="retiring"
                    @click="setRetired([row], false)"
                  >
                    取消废弃
                  </el-button>
                  <el-button v-else-if="!isInbox && row.caseCount > 0" link type="primary" size="small" @click="openReadiness(row)">
                    还差什么
                  </el-button>
                  <el-button
                    v-else-if="!isInbox"
                    link
                    type="primary"
                    size="small"
                    :loading="generatingId === row.id"
                    :disabled="row.statusCode === 'DEPRECATED'"
                    @click="generate(row)"
                  >
                    生成
                  </el-button>
                </span>
              </div>
            </div>
          </div>

          <div v-if="!loading && !groups.length" class="empty-card">
            {{
              requirementNo
                ? '这个需求在当前项目下没有涉及的接口'
                : isInbox
                  ? '没有待归类的接口。抓包结束后会自动收进来'
                  : chip || keyword.trim()
                    ? '当前项目下没有符合条件的接口'
                    : '这个项目还没有接口'
            }}
          </div>
        </div>
      </section>
    </div>

    <el-dialog
      v-model="insightVisible"
      :title="insightRow ? `源码体检 · ${insightRow.httpMethod} ${insightRow.path}` : '源码体检'"
      width="920px"
      top="6vh"
      destroy-on-close
    >
      <EndpointInsightPanel
        v-if="insightRow"
        :key="insightRow.id"
        :project="project"
        :method="insightRow.httpMethod || 'GET'"
        :path="insightRow.path"
        :endpoint-id="insightRow.id"
        auto
        @generated="load"
      />
    </el-dialog>

    <el-dialog v-model="misplacedVisible" title="疑似放错项目" width="880px" append-to-body>
      <p class="classify-tip">
        按路径第一段判断（和项目编码对得上，或清单里同前缀的接口多数在另一个项目）；源码里找得到的不列。
        勾选后接口连同用例挪到「移到」那一列的项目。
      </p>
      <el-table
        :data="misplacedRows"
        size="small"
        max-height="440"
        row-key="id"
        @selection-change="(rows: MisplacedRow[]) => (misplacedChecked = rows)"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column label="接口" min-width="300">
          <template #default="{ row }">
            <span class="method" :class="`is-${(row.method || 'GET').toLowerCase()}`">{{ row.method }}</span>
            <span class="misplaced-path">{{ row.path }}</span>
          </template>
        </el-table-column>
        <el-table-column label="现在在" width="140">
          <template #default="{ row }">{{ projectNameOf(row.project) }}</template>
        </el-table-column>
        <el-table-column label="用例" width="60" align="center" prop="caseCount" />
        <el-table-column label="移到" width="220">
          <template #default="{ row }">
            <el-select v-model="row.target" filterable size="small" style="width: 100%">
              <el-option
                v-for="p in allProjectOptions"
                :key="p.project"
                :label="p.label || p.project"
                :value="p.project"
              />
            </el-select>
            <div class="misplaced-reason">{{ row.reason }}</div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="misplacedVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="movingMisplaced"
          :disabled="!misplacedChecked.length"
          @click="moveMisplaced"
        >
          移动 {{ misplacedChecked.length }} 个
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="classifyVisible"
      :title="isInbox ? '归类到项目' : '移到其他项目'"
      width="420px"
      destroy-on-close
    >
      <p v-if="isInbox" class="classify-tip">选好项目后，这些接口会进入该项目的接口清单，再按抓包用 AI 生成用例。</p>
      <p v-else class="classify-tip">
        接口连同用例一起挪过去，全量集合里的用例也跟着进目标项目的全量集合；目标项目已有同名接口会合并成一条。
      </p>
      <el-select v-model="classifyProject" filterable placeholder="选项目" style="width: 100%">
        <el-option
          v-for="p in classifyOptions"
          :key="p.project"
          :label="`${p.label || p.project}（${p.project}）`"
          :value="p.project"
        />
      </el-select>
      <template #footer>
        <el-button @click="classifyVisible = false">取消</el-button>
        <el-button type="primary" :loading="classifying" :disabled="!classifyProject" @click="doClassify">
          {{ isInbox ? '归类' : '移动' }} {{ pendingClassifyIds.length }} 个
        </el-button>
      </template>
    </el-dialog>

    <ApiAuthDialog
      v-if="project"
      v-model="authVisible"
      :project="project"
      :source-dir="readStored(SCAN_DIR_STORAGE_KEY)[project] || ''"
    />

    <AiCaseGenDialog
      v-if="project"
      v-model="aiGenVisible"
      :project="project"
      :uncovered-count="aiGenScope.filter(isUncovered).length"
      :total-count="aiGenScope.length"
      :level-counts="aiGenLevelCounts"
      @changed="load"
    />

    <ProjectUrlsDialog
      v-model="urlsVisible"
      :project="project ? { code: project, name: projectLabel || project } : null"
      @changed="loadUrls"
    />

    <el-dialog
      v-model="pendingVisible"
      width="800px"
      class="pending-dialog"
      :show-close="false"
      append-to-body
    >
      <template #header="{ close }">
        <div class="pd-head">
          <span class="pd-icon">!</span>
          <div class="pd-head-text">
            <span class="pd-tag">待补断言</span>
            <div class="pd-title">用例已生成，但还没生效</div>
            <div class="pd-sub">接口正确性暂未验证 · 可先补断言再执行</div>
          </div>
          <button type="button" class="pd-close" aria-label="关闭" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>

      <div class="pd-reason">
        <span class="pd-reason-label">原因</span>
        <span>
          只拿到 <code>status=200</code> 一项，没有抓包样本也没有代码对比字段 —— 这样只能说明「服务活着」，说明不了业务对不对。
        </span>
      </div>

      <div class="pd-section">选一种补齐方式</div>
      <div class="pd-options">
        <div class="pd-option">
          <div class="pd-option-head">
            <span class="pd-option-icon is-blue">📡</span>
            <span class="pd-option-title">抓包挂接口</span>
          </div>
          <p class="pd-option-desc">跑一次真实请求，拿真实返回做断言字段。最准，适合有可用环境的时候。</p>
          <el-button type="primary" class="pd-option-btn" @click="goFix('/packet-capture')">去抓包</el-button>
        </div>
        <div class="pd-option">
          <div class="pd-option-head">
            <span class="pd-option-icon is-green">🔀</span>
            <span class="pd-option-title">跑接口对比分析</span>
          </div>
          <p class="pd-option-desc">从代码里对比出真正变动的字段，据此生成断言。不用起服务，最快。</p>
          <el-button class="pd-option-btn is-green" @click="goFix('/api-changes')">去分析</el-button>
        </div>
      </div>

      <div class="pd-note">
        <b>开发文档只能参考</b>，不会自动写进断言 —— 文档容易和实际返回不一致，以抓包或代码为准。
      </div>

      <template #footer>
        <div class="pd-foot">
          <span>这个接口下已有 {{ pendingCaseCount }} 条用例，补齐断言后到用例集合里启用</span>
          <el-button @click="pendingVisible = false">稍后再说</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="scanVisible" :title="`全量扫描 · ${project}`" width="600px">
      <template v-if="!scanResult">
        <el-radio-group v-model="scanMode" class="scan-mode">
          <el-radio-button value="ref">按分支（推荐）</el-radio-button>
          <el-radio-button value="dir">本地目录</el-radio-button>
        </el-radio-group>
        <template v-if="scanMode === 'ref'">
          <div class="scan-hint">
            先 <code>git fetch</code> 更新远程分支，再读那个提交的代码——不切分支、不动本地改动。
            分支留空＝项目管理里配的基线分支（没配就是 master）。
          </div>
          <div class="scan-label">分支</div>
          <el-input
            v-model="scanRef"
            class="mono-input"
            placeholder="留空＝基线分支，如 origin/master"
            clearable
            @keyup.enter="submitScan"
          />
          <div class="scan-hint">只有扫基线分支才会标出「基线里已没有」的接口；扫别的分支只补充，不标。</div>
        </template>
        <template v-else>
          <div class="scan-label">源码目录</div>
          <el-input
            v-model="scanDir"
            class="mono-input"
            placeholder="如 /Users/xxx/app_coding/data-center"
            clearable
            @keyup.enter="submitScan"
          />
          <div class="scan-hint is-warn">扫的是目录现在的样子（当前所在分支 + 没提交的改动），不代表 master，也不会标「已没有」。</div>
        </template>
        <div class="scan-label">调用方搜索范围</div>
        <el-input
          v-model="scanCallerDirs"
          class="mono-input"
          placeholder="留空＝仓库的上一级目录，多个用逗号分隔"
          clearable
          @keyup.enter="submitScan"
        />
        <div v-if="lastScan" class="scan-last">上次扫描：{{ lastScanText }}</div>
      </template>
      <div v-else class="scan-result">
        <div class="sr-base">
          基于 <b>{{ scanResult.ref || '本地目录' }}</b>
          <template v-if="scanResult.shortSha">
            · 提交 <code>{{ scanResult.shortSha }}</code>（{{ fmtTime(scanResult.committedAt) }} 提交）
          </template>
        </div>
        <div v-if="scanResult.fetch" class="sr-fetch" :class="{ 'is-warn': scanResult.fetch.startsWith('fetch 失败') }">
          {{ scanResult.fetch }}
        </div>
        <ul class="sr-list">
          <li>扫到 {{ scanResult.controllers }} 个 Controller、{{ scanResult.endpoints }} 个接口</li>
          <li>
            新增 {{ scanResult.created }}，更新 {{ scanResult.updated
            }}<template v-if="scanResult.linked">，{{ scanResult.linked }} 个抓包接口认上了代码</template>
          </li>
          <li v-if="scanResult.prefix">
            网关前缀 <code>{{ scanResult.prefix }}</code>：新接口的路径已自动补上<template v-if="scanResult.reprefixed">，老接口补了 {{ scanResult.reprefixed }} 个</template>
          </li>
          <li v-if="scanResult.isBase">
            基线里已没有 {{ scanResult.gone ?? 0 }} 个<template v-if="scanResult.revived">，重新出现 {{ scanResult.revived }} 个</template>
          </li>
          <li>{{ scanCallerText }}</li>
        </ul>
        <div v-if="scanResult.duplicates" class="sr-dup">
          <span>还有 {{ scanResult.duplicates }} 对重复接口（同一个接口，抓包一条、源码一条）</span>
          <el-button size="small" type="warning" plain @click="openDup">查看并合并</el-button>
        </div>
      </div>
      <template #footer>
        <template v-if="!scanResult">
          <el-button @click="scanVisible = false">取消</el-button>
          <el-button type="primary" :loading="scanning" @click="submitScan">开始扫描</el-button>
        </template>
        <el-button v-else type="primary" @click="scanVisible = false">知道了</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scanAllVisible" title="扫描全部项目" width="900px">
      <div class="scan-hint">
        每个后端项目读它的基线分支（项目管理里配的，没配就是 master）：先 <code>git fetch</code>，
        再扫那个提交的代码，不切分支、不动本地改动。扫完会去安卓 / iOS / 鸿蒙 / H5 / 后台仓库里搜调用方，
        级别按调用方自动算：两端以上原生在调＝核心，一端原生或 H5 在调＝重要，只有后台在调＝一般，哪都搜不到＝无人调用。
        之后抓包抓到的接口会自动升为核心；算得不对的可以在列表里手动改级别。
      </div>
      <template v-if="scanAllJob">
        <div class="sa-head">
          <span>{{ scanAllJob.done ? '已完成' : '扫描中' }} · {{ scanAllDoneCount }}/{{ scanAllJob.items.length }}</span>
          <span class="faint">开始于 {{ fmtTime(scanAllJob.startedAt) }}</span>
          <span v-if="scanAllJob.done" class="sa-total">
            合计：核心 {{ scanAllTotals.CORE }} · 重要 {{ scanAllTotals.IMPORTANT }} · 一般 {{ scanAllTotals.NORMAL }} · 无人调用 {{ scanAllTotals.UNUSED }}
          </span>
        </div>
        <div class="sa-table">
          <div class="sa-row is-head">
            <span>项目</span>
            <span>状态</span>
            <span>基于</span>
            <span class="right">接口</span>
            <span class="right">核心</span>
            <span class="right">重要</span>
            <span class="right">一般</span>
            <span class="right">无人调用</span>
            <span>备注</span>
          </div>
          <div v-for="it in scanAllJob.items" :key="it.project" class="sa-row">
            <span class="sa-proj" :title="it.project">{{ it.name || it.project }}</span>
            <span><span class="sa-state" :class="`is-${it.state.toLowerCase()}`">{{ SCAN_STATE_LABEL[it.state] || it.state }}</span></span>
            <span class="sa-ref">
              <template v-if="it.result?.ref">{{ it.result.ref }}<small v-if="it.result.shortSha"> @{{ it.result.shortSha }}</small></template>
            </span>
            <span class="right">{{ it.result?.endpoints ?? '' }}</span>
            <span class="right sa-core">{{ it.levels?.CORE ?? '' }}</span>
            <span class="right">{{ it.levels?.IMPORTANT ?? '' }}</span>
            <span class="right">{{ it.levels?.NORMAL ?? '' }}</span>
            <span class="right faint">{{ it.levels?.UNUSED ?? '' }}</span>
            <span class="sa-note" :title="scanAllNote(it)">{{ scanAllNote(it) }}</span>
          </div>
        </div>
      </template>
      <div v-else class="faint">还没扫过。点「开始扫描」，大约每个项目几秒钟。</div>
      <template #footer>
        <el-button @click="scanAllVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="scanAllStarting || (!!scanAllJob && !scanAllJob.done)"
          @click="startScanAll"
        >{{ scanAllJob ? (scanAllJob.done ? '重新扫描' : '扫描中…') : '开始扫描' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="aiBatchVisible" title="批量生成用例" width="900px">
      <div class="scan-hint">
        所有后端项目一起跑，只给<b>还没用例</b>的接口生成。AI 读各项目 <code>origin/testing</code> 的代码出请求
        （没有这个分支的读本地工作区）。不试跑时生成的用例先停用，抓包之后再按真实返回补断言。
      </div>
      <template v-if="!aiBatch || !aiBatch.running">
        <div class="ab-form">
          <span class="ab-label">级别</span>
          <div class="ab-levels">
            <button
              v-for="o in LEVEL_OPTIONS"
              :key="o.value"
              type="button"
              class="ab-chip"
              :class="{ active: aiBatchLevels.includes(o.value) }"
              @click="toggleAiBatchLevel(o.value)"
            >{{ o.label }} <span class="faint">{{ aiBatchUncovered[o.value] }}</span></button>
          </div>
          <span class="ab-label">试跑</span>
          <el-checkbox v-model="aiBatchTryRun">在测试环境试跑 GET 接口、按真实返回写断言（写接口不跑）</el-checkbox>
        </div>
      </template>
      <template v-if="aiBatch">
        <div class="sa-head">
          <span>{{ aiBatch.running ? '生成中' : '已结束' }} · {{ aiBatchTotals.done }}/{{ aiBatchTotals.total }} 个接口</span>
          <span class="faint">开始于 {{ fmtTime(aiBatch.startedAt) }}</span>
          <span class="sa-total">用例 {{ aiBatchTotals.created }} 条，已启用 {{ aiBatchTotals.enabled }}，失败 {{ aiBatchTotals.failed }} 个接口</span>
        </div>
        <div class="sa-table">
          <div class="ab-row is-head">
            <span>项目</span>
            <span>状态</span>
            <span>源码</span>
            <span class="right">进度</span>
            <span class="right">用例</span>
            <span class="right">失败</span>
            <span>备注</span>
          </div>
          <div v-for="it in aiBatch.items" :key="it.project" class="ab-row">
            <span class="sa-proj" :title="it.project">{{ it.name || it.project }}</span>
            <span>
              <span class="sa-state" :class="it.skipped ? 'is-skipped' : it.running ? 'is-running' : 'is-done'">
                {{ it.skipped ? '跳过' : it.running ? '生成中' : '完成' }}
              </span>
            </span>
            <span class="sa-ref" :title="it.sourceRef || ''">{{ it.sourceRef || '' }}</span>
            <span class="right">{{ it.jobId ? `${it.done}/${it.total}` : '' }}</span>
            <span class="right">{{ it.jobId ? it.created : '' }}</span>
            <span class="right">{{ it.failed || '' }}</span>
            <span class="sa-note" :title="it.skipped || it.message || ''">{{ it.skipped || (it.running ? '' : it.message) || '' }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="aiBatchVisible = false">{{ aiBatch?.running ? '后台继续' : '关闭' }}</el-button>
        <el-button
          v-if="!aiBatch?.running"
          v-perm:write
          type="primary"
          :loading="aiBatchStarting"
          :disabled="!aiBatchLevels.length || !aiBatchScopeCount"
          @click="startAiBatch"
        >开始生成 {{ aiBatchScopeCount }} 个</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dupVisible" title="合并重复接口" width="780px">
      <div v-loading="dupLoading" class="dup-body">
        <div class="scan-hint">
          同一个接口有两条：抓包建的那条带网关前缀（客户端真正调的），源码扫的那条是代码里写的路径。
          合并后<b>保留抓包那条</b>，源码那条的方法名、源码文件、用例、需求关联、分支变更都挪过去；
          挪过去的用例如果请求路径还是代码路径，会改成实际调用的路径。
        </div>
        <div v-if="!dupLoading && !dupPairs.length && !dupAmbiguous.length" class="faint">没有重复接口</div>
        <div v-if="dupPairs.length" class="dup-table">
          <div class="dup-row is-head">
            <span>
              <input
                type="checkbox"
                :checked="dupChecked.size === dupPairs.length"
                @change="toggleAllDup(($event.target as HTMLInputElement).checked)"
              />
            </span>
            <span>方法</span>
            <span>保留（抓包）</span>
            <span>合并掉（源码）</span>
            <span class="center">用例</span>
          </div>
          <div v-for="p in dupPairs" :key="p.dropId" class="dup-row">
            <span>
              <input
                type="checkbox"
                :checked="dupChecked.has(p.dropId)"
                @change="toggleDup(p.dropId, ($event.target as HTMLInputElement).checked)"
              />
            </span>
            <span><span class="method" :class="`is-${(p.httpMethod || 'GET').toLowerCase()}`">{{ p.httpMethod }}</span></span>
            <span class="dup-path" :title="p.keepPath">
              {{ p.keepPath }}<small v-if="p.summary">{{ p.summary }}</small>
            </span>
            <span class="dup-path" :title="p.dropPath">
              {{ p.dropPath }}<small v-if="p.handler">{{ p.handler }}</small>
            </span>
            <span class="center">{{ p.keepCases }} + {{ p.dropCases }}</span>
          </div>
        </div>
        <div v-if="dupAmbiguous.length" class="dup-amb">
          <div class="scan-label">对不准的，不会自动合并（一条对上了好几条，需要你自己看）</div>
          <div v-for="(a, i) in dupAmbiguous" :key="i" class="dup-amb-row">
            <span class="method" :class="`is-${(a.httpMethod || 'GET').toLowerCase()}`">{{ a.httpMethod }}</span>
            <code>{{ a.codePath }}</code> ↔ <code>{{ a.paths.join('、') }}</code>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="dupVisible = false">取消</el-button>
        <el-button type="warning" :disabled="!dupChecked.size" :loading="dupMerging" @click="submitMerge">
          合并选中的（{{ dupChecked.size }}）
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入接口文档" width="640px">
      <el-input
        v-model="importContent"
        type="textarea"
        :rows="14"
        placeholder='粘贴 OpenAPI JSON，如 {"openapi":"3.0.0","paths":{...}}'
      />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImportDoc">导入到 {{ project }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="readyVisible" :title="readyTitle" width="640px">
      <div v-loading="readyLoading">
        <el-empty v-if="!readyCases.length" description="这个接口下还没有用例" />
        <div v-for="c in readyCases" :key="c.id" class="ready-item" :class="{ highlight: c.id === focusCaseId }">
          <div class="ready-head">
            <el-tag size="small" :type="c.enabled ? 'success' : 'info'">{{ c.enabled ? '已启用' : '已停用' }}</el-tag>
            <span class="ready-name">{{ c.name }}</span>
          </div>
          <ul v-if="c.todos?.length" class="ready-todos">
            <li v-for="(t, i) in c.todos" :key="i">{{ t }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="readyVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Close, CopyDocument, Refresh, Search, Upload } from '@element-plus/icons-vue'
import {
  apiClient,
  type AiCaseBatch,
  type ApiEndpointDuplicatePair,
  type ApiEndpointLevel,
  type ApiEndpointVo,
  type ApiScanAllJob,
  type ApiSourceScan
} from '../api'
import { usePagePaneActive } from '../utils/pagePane'
import { WRITE_EFFECT_META, writeEffectText } from '../utils/writeEffect'
import ProjectUrlsDialog from '../components/ProjectUrlsDialog.vue'
import ApiAuthDialog from '../components/ApiAuthDialog.vue'
import AiCaseGenDialog from '../components/AiCaseGenDialog.vue'
import EndpointInsightPanel from '../components/EndpointInsightPanel.vue'

type ProjNode = {
  project: string
  label?: string
  total: number
  pending?: number
  missing?: boolean
}

type KindNode = {
  key: string
  label: string
  type?: string
  total: number
  pending?: number
  children?: ProjNode[]
}

type CatNode = {
  key: string
  label: string
  total: number
  pending?: number
  children?: Array<ProjNode | KindNode>
}

type EpGroup = { key: string; name: string; lang: string; rows: ApiEndpointVo[] }

/** 已下线的分类；连到还没升级的后端时它仍会返回，这里兜底藏掉 */
const RETIRED_CATEGORY_KEYS = new Set(['PVP', 'WEB', 'OTHER'])
const OLD_APP_LABELS = new Set(['APP', 'APP 后端', 'APP后端', '电竞APP'])
const CAT_COLORS: Record<string, string> = { APP: '#22a06b', POGPOG: '#ff7d00' }
const CAT_PALETTE = ['#3370ff', '#7b61ff', '#14c9c9', '#f5319d', '#8a94a6']
const PROJ_PAGE_SIZE = 10
const UNGROUPED_KEY = '__ungrouped__'

const router = useRouter()
const route = useRoute()
const paneActive = usePagePaneActive()

const allRows = ref<ApiEndpointVo[]>([])
const tree = ref<CatNode[]>([])
const urlByProject = ref<Record<string, string>>({})
const treeLoading = ref(false)
const loading = ref(false)
const batchGenerating = ref(false)
const generatingId = ref('')

const requirementNo = computed(() => String(route.query.requirementNo || '').trim())
const targetCollectionId = computed(() => String(route.query.collectionId || '').trim())
const targetCollectionName = ref('')
const reqPathKeys = ref(new Set<string>())

const environment = ref<'TEST' | 'PROD'>(
  String(route.query.environment || '').toUpperCase() === 'PROD' ? 'PROD' : 'TEST'
)
const project = ref(
  typeof route.query.project === 'string' && route.query.project ? route.query.project : 'app-data-center'
)
const keyword = ref('')
const chip = ref('')
const focusCaseId = computed(() => String(route.query.caseId || '').trim())

const projKeyword = ref('')
const collapsedCats = ref(new Set<string>())
const projPage = ref<Record<string, number>>({})
const openGroups = ref(new Set<string>())
const urlsVisible = ref(false)
const authVisible = ref(false)
const aiGenVisible = ref(false)
const selectedIds = ref<string[]>([])
const classifyVisible = ref(false)
const classifyProject = ref('')
const classifying = ref(false)
const pendingClassifyIds = ref<string[]>([])
const aiGenningSelected = ref(false)

const INBOX = 'capture-inbox'
const isInbox = computed(() => project.value === INBOX)
const canSelect = computed(() => isInbox.value || projectRows.value.length > 0)
const selectedCaptureIds = computed(() =>
  projectRows.value.filter((r) => selectedIds.value.includes(r.id) && r.hasCaptureMeta).map((r) => r.id)
)
const allPageSelected = computed(() => {
  const ids = projectRows.value.map((r) => r.id)
  return ids.length > 0 && ids.every((id) => selectedIds.value.includes(id))
})
const classifyOptions = computed(() =>
  categories.value
    .filter((c) => c.key !== '__inbox__')
    .flatMap((c) => leafProjects(c))
    .filter((p) => p.project !== INBOX && p.project !== project.value)
)

const allProjectOptions = computed(() =>
  categories.value
    .filter((c) => c.key !== '__inbox__')
    .flatMap((c) => leafProjects(c))
    .filter((p) => p.project !== INBOX)
)

function projectNameOf(code: string) {
  return allProjectOptions.value.find((p) => p.project === code)?.label || code
}

interface MisplacedRow {
  id: string
  project: string
  method: string
  path: string
  caseCount: number
  suggest: string
  reason: string
  target: string
}

const misplaced = ref<Omit<MisplacedRow, 'target'>[]>([])
const misplacedVisible = ref(false)
const misplacedRows = ref<MisplacedRow[]>([])
const misplacedChecked = ref<MisplacedRow[]>([])
const movingMisplaced = ref(false)

async function loadMisplaced() {
  try {
    misplaced.value = (await apiClient.getMisplacedEndpoints()).items || []
  } catch {
    misplaced.value = []
  }
}

function openMisplaced() {
  misplacedRows.value = misplaced.value.map((m) => ({ ...m, target: m.suggest }))
  misplacedChecked.value = []
  misplacedVisible.value = true
}

async function moveMisplaced() {
  const byTarget = new Map<string, string[]>()
  for (const r of misplacedChecked.value) {
    if (!r.target || r.target === r.project) continue
    byTarget.set(r.target, [...(byTarget.get(r.target) || []), r.id])
  }
  if (!byTarget.size) return
  movingMisplaced.value = true
  let n = 0
  try {
    for (const [target, ids] of byTarget) {
      const r = await apiClient.classifyApiEndpoints(ids, target)
      n += r.moved + r.merged
    }
    ElMessage.success(`已移动 ${n} 个接口（连同用例）`)
    misplacedVisible.value = false
  } catch (e: any) {
    ElMessage.error(e?.message || '移动失败')
  } finally {
    movingMisplaced.value = false
    await Promise.all([load(), loadMisplaced()])
  }
}

function toggleSelect(id: string, on: boolean) {
  selectedIds.value = on
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((x) => x !== id)
}

function toggleSelectAll(on: boolean) {
  const ids = projectRows.value.map((r) => r.id)
  selectedIds.value = on
    ? [...new Set([...selectedIds.value, ...ids])]
    : selectedIds.value.filter((id) => !ids.includes(id))
}

function classifyOne(row: ApiEndpointVo) {
  pendingClassifyIds.value = [row.id]
  classifyProject.value = ''
  classifyVisible.value = true
}

watch(classifyVisible, (v) => {
  if (v && !pendingClassifyIds.value.length) {
    pendingClassifyIds.value = [...selectedIds.value]
  }
  if (!v) pendingClassifyIds.value = []
})

async function doClassify() {
  if (!classifyProject.value || !pendingClassifyIds.value.length) return
  classifying.value = true
  try {
    const r = await apiClient.classifyApiEndpoints(pendingClassifyIds.value, classifyProject.value)
    ElMessage.success(
      `已${isInbox.value ? '归类' : '移动'} ${r.moved + r.merged} 个到 ${r.project}` +
        (r.merged ? `（合并 ${r.merged}）` : '')
    )
    void loadMisplaced()
    classifyVisible.value = false
    selectedIds.value = []
    await load()
    pickProject(r.project)
  } catch (e: any) {
    ElMessage.error(e?.message || '归类失败')
  } finally {
    classifying.value = false
  }
}

async function aiGenSelected() {
  const ids = selectedCaptureIds.value
  if (!ids.length) return
  aiGenningSelected.value = true
  try {
    let job = await apiClient.startAiCases({
      project: project.value,
      endpointIds: ids,
      onlyUncovered: false,
      dir: readStored(SCAN_DIR_STORAGE_KEY)[project.value] || undefined
    })
    while (job.running) {
      await new Promise((r) => setTimeout(r, 2000))
      job = await apiClient.getAiCaseJob(job.id)
    }
    await load()
    const enabled = job.items.reduce((n, it) => n + (it.enabled || 0), 0)
    const created = job.items.reduce((n, it) => n + (it.cases || 0), 0)
    if (!created) {
      ElMessage.error(job.message || job.items[0]?.note || '生成失败')
    } else if (enabled) {
      ElMessage.success(`生成 ${created} 条，${enabled} 条已启用（仅测试环境）`)
    } else {
      ElMessage({ type: 'warning', message: `生成 ${created} 条，先停用：${job.items[0]?.note || ''}`, duration: 8000 })
    }
    selectedIds.value = []
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    aiGenningSelected.value = false
  }
}

const sourceGenning = ref(false)

async function sourceGenSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  sourceGenning.value = true
  try {
    const out = await apiClient.generateSourceCases(ids)
    await load()
    const sum = (k: 'created' | 'enabled' | 'fixed' | 'existed') => out.reduce((n, o) => n + (o[k] || 0), 0)
    const skipped = out.filter((o) => o.reason).length
    const parts = [`新增 ${sum('created')} 条，${sum('enabled')} 条试跑一致已启用`]
    if (sum('fixed')) parts.push(`修正旧的「缺少 xx」用例 ${sum('fixed')} 条`)
    if (sum('existed')) parts.push(`${sum('existed')} 条已存在`)
    if (skipped) parts.push(`${skipped} 个接口没生成（${out.find((o) => o.reason)?.reason}）`)
    ElMessage({ type: sum('created') || sum('fixed') ? 'success' : 'warning', message: parts.join('；'), duration: 8000 })
    selectedIds.value = []
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    sourceGenning.value = false
  }
}

const categories = computed(() => {
  const cats = tree.value
    .filter((c) => !RETIRED_CATEGORY_KEYS.has(String(c.key).toUpperCase()))
    .map((c) => (c.key === 'APP' && OLD_APP_LABELS.has(c.label) ? { ...c, label: '电竞' } : c))
  const inboxTotal = allRows.value.filter((r) => r.project === INBOX).length
  if (!inboxTotal) return cats
  return [
    {
      key: '__inbox__',
      label: '抓包待归类',
      total: inboxTotal,
      children: [{ project: INBOX, label: '待归类', total: inboxTotal }]
    },
    ...cats
  ]
})

const allCatsCollapsed = computed(
  () => categories.value.length > 0 && categories.value.every((c) => collapsedCats.value.has(c.key))
)

function keyOf(row: ApiEndpointVo) {
  return row.treeKey || row.project
}

function isRetiredOrGone(row: ApiEndpointVo) {
  return !!row.retiredAt || row.statusCode === 'DEPRECATED'
}

function isUncovered(row: ApiEndpointVo) {
  return !isRetiredOrGone(row) && !(row.caseCount > 0)
}

function urlOf(row: ApiEndpointVo) {
  return urlByProject.value[keyOf(row)] || urlByProject.value[row.project] || ''
}

/** 统计和筛选的范围：需求模式下只算这个需求涉及的接口 */
const scopeRows = computed(() => {
  if (!requirementNo.value || reqPathKeys.value.size === 0) return allRows.value
  return allRows.value.filter((r) => reqPathKeys.value.has(epKey(r.httpMethod, r.path)))
})

const stats = computed(() => {
  const rows = scopeRows.value
  let covered = 0
  let uncovered = 0
  let changed = 0
  let added = 0
  for (const r of rows) {
    if (r.caseCount > 0) covered++
    if (isUncovered(r)) uncovered++
    if (r.changeFlag) {
      changed++
      if (r.changeFlag.toUpperCase() === 'NEW') added++
    }
  }
  return { total: rows.length, covered, uncovered, changed, added }
})

const langChips = computed(() => {
  const m = new Map<string, number>()
  for (const r of scopeRows.value) {
    const lang = sourceOf(r.sourceFile)?.lang
    if (lang) m.set(lang, (m.get(lang) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([lang, count]) => ({ lang, count }))
})

function isCore(r: ApiEndpointVo) {
  return r.level === 'CORE' && !isRetiredOrGone(r)
}

/** 核心接口没有一条启用中的用例，就等于没人在验 */
function isCoreTodo(r: ApiEndpointVo) {
  return isCore(r) && !(r.enabledCaseCount > 0)
}

const stateChips = computed(() => {
  const rows = scopeRows.value
  const weak = rows.filter((r) => r.statusCode === 'WEAK_COVERED').length
  const list = [
    { value: 'CORE', label: '核心', count: rows.filter(isCore).length },
    { value: 'CORE_TODO', label: '核心待补', count: rows.filter(isCoreTodo).length },
    { value: 'UNCOVERED', label: '未覆盖', count: stats.value.uncovered },
    { value: 'CHANGED', label: '本版变更', count: stats.value.changed },
    { value: 'NO_URL', label: '地址未配', count: rows.filter((r) => !urlOf(r)).length }
  ]
  if (weak > 0 || chip.value === 'WEAK') list.push({ value: 'WEAK', label: '有用例没在验', count: weak })
  const dead = rows.filter(isDead).length
  if (dead > 0 || chip.value === 'DEAD') list.push({ value: 'DEAD', label: '疑似废弃', count: dead })
  const retired = rows.filter((r) => r.retiredAt).length
  if (retired > 0 || chip.value === 'RETIRED') list.push({ value: 'RETIRED', label: '已废弃', count: retired })
  // 后端还没下发 writeEffect 时不出这两个：全是 0 只会让人以为一个只读接口都没有
  if (rows.some((r) => r.writeEffect != null)) {
    list.push({ value: 'READ_ONLY', label: '只读', count: rows.filter(isReadOnly).length })
    list.push({ value: 'PROD_SAFE', label: '核心·只读（可巡检）', count: rows.filter((r) => isCore(r) && isReadOnly(r)).length })
  }
  return list
})

function isReadOnly(r: ApiEndpointVo) {
  return r.writeEffect === 'READ_ONLY' && !isRetiredOrGone(r)
}

/** 已经人工标了废弃的不再算「疑似」：那是已经拍板的事 */
function isDead(r: ApiEndpointVo) {
  return !r.retiredAt && (r.callerStatus === 'DEF_ONLY' || r.callerStatus === 'NONE')
}

function usedCallers(r: ApiEndpointVo) {
  return (r.callers || []).filter((c) => !c.unused)
}

function matchesChip(r: ApiEndpointVo) {
  const c = chip.value
  if (!c) return true
  if (c.startsWith('lang:')) return sourceOf(r.sourceFile)?.lang === c.slice(5)
  if (c === 'CORE') return isCore(r)
  if (c === 'CORE_TODO') return isCoreTodo(r)
  if (c === 'UNCOVERED') return isUncovered(r)
  if (c === 'CHANGED') return !!r.changeFlag
  if (c === 'NO_URL') return !urlOf(r)
  if (c === 'WEAK') return r.statusCode === 'WEAK_COVERED'
  if (c === 'DEAD') return isDead(r)
  if (c === 'RETIRED') return !!r.retiredAt
  if (c === 'READ_ONLY') return isReadOnly(r)
  if (c === 'PROD_SAFE') return isCore(r) && isReadOnly(r)
  return true
}

function matchesKeyword(r: ApiEndpointVo) {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return true
  return [r.path, r.summary, r.handler, sourceOf(r.sourceFile)?.name]
    .some((v) => String(v || '').toLowerCase().includes(kw))
}

const filtering = computed(() => !!(chip.value || keyword.value.trim() || requirementNo.value))

const filteredRows = computed(() => scopeRows.value.filter((r) => matchesChip(r) && matchesKeyword(r)))

const countByProject = computed(() => {
  const m: Record<string, number> = {}
  for (const r of filteredRows.value) m[keyOf(r)] = (m[keyOf(r)] || 0) + 1
  return m
})

const totalByProject = computed(() => {
  const m: Record<string, number> = {}
  for (const r of allRows.value) m[keyOf(r)] = (m[keyOf(r)] || 0) + 1
  return m
})

function leafProjects(cat: CatNode): ProjNode[] {
  const out: ProjNode[] = []
  for (const n of cat.children || []) {
    if ('project' in n && (n as ProjNode).project) {
      out.push(n as ProjNode)
    } else {
      out.push(...((n as KindNode).children || []))
    }
  }
  return out
}

function kindBlocks(cat: CatNode): Array<{ key: string; label: string; projects: ProjNode[] }> {
  const ch = cat.children || []
  if (ch.some((n) => (n as KindNode).type === 'KIND' || ((n as KindNode).children && !(n as ProjNode).project))) {
    return (ch as KindNode[]).map((k) => ({
      key: `${cat.key}/${k.key}`,
      label: k.label,
      projects: k.children || []
    }))
  }
  return [{ key: cat.key, label: '', projects: ch as ProjNode[] }]
}

function projCount(p: ProjNode) {
  return (filtering.value ? countByProject.value : totalByProject.value)[p.project] || 0
}

function catCount(cat: CatNode) {
  return leafProjects(cat).reduce((sum, p) => sum + projCount(p), 0)
}

function matchedProjects(cat: CatNode) {
  const kw = projKeyword.value.trim().toLowerCase()
  let list = leafProjects(cat)
  if (kw) list = list.filter((p) => p.project.toLowerCase().includes(kw) || (p.label || '').toLowerCase().includes(kw))
  if (filtering.value) list = list.filter((p) => projCount(p) > 0 || p.project === project.value)
  return list
}

function pageCount(cat: CatNode) {
  return Math.max(1, Math.ceil(matchedProjects(cat).length / PROJ_PAGE_SIZE))
}

function pageOf(cat: CatNode) {
  return Math.min(projPage.value[cat.key] || 1, pageCount(cat))
}

function setPage(cat: CatNode, page: number) {
  projPage.value = { ...projPage.value, [cat.key]: page }
}

function shownProjects(cat: CatNode) {
  const start = (pageOf(cat) - 1) * PROJ_PAGE_SIZE
  return matchedProjects(cat).slice(start, start + PROJ_PAGE_SIZE)
}

function shownKindBlocks(cat: CatNode) {
  const shown = new Set(shownProjects(cat).map((p) => p.project))
  return kindBlocks(cat)
    .map((b) => ({
      ...b,
      projects: b.projects.filter((p) => shown.has(p.project))
    }))
    .filter((b) => b.projects.length)
}

/** 翻到当前项目所在的那一页，免得选中的项目在别的页看不见 */
function revealCurrentProject() {
  const next: Record<string, number> = {}
  for (const cat of categories.value) {
    const i = matchedProjects(cat).findIndex((p) => p.project === project.value)
    next[cat.key] = i >= 0 ? Math.floor(i / PROJ_PAGE_SIZE) + 1 : 1
  }
  projPage.value = next
}

const projectLabel = computed(() => {
  for (const c of tree.value) {
    const hit = leafProjects(c).find((p) => p.project === project.value)
    if (hit) return hit.label || ''
  }
  return ''
})

const projectAll = computed(() => scopeRows.value.filter((r) => keyOf(r) === project.value))
const projectRows = computed(() => filteredRows.value.filter((r) => keyOf(r) === project.value))
const aiGenScope = computed(() =>
  allRows.value.filter((r) => keyOf(r) === project.value && !isRetiredOrGone(r))
)
const aiGenLevelCounts = computed(() => {
  const out = {} as Record<ApiEndpointLevel, { total: number; uncovered: number }>
  for (const o of LEVEL_OPTIONS) out[o.value] = { total: 0, uncovered: 0 }
  for (const r of aiGenScope.value) {
    if (r.goneAt || !r.level || !out[r.level as ApiEndpointLevel]) continue
    const c = out[r.level as ApiEndpointLevel]
    c.total++
    if (isUncovered(r)) c.uncovered++
  }
  return out
})
const deadInProject = computed(() => projectRows.value.filter(isDead))
const retiring = ref(false)

async function setRetired(rows: ApiEndpointVo[], retired: boolean) {
  if (!rows.length) return
  retiring.value = true
  try {
    await apiClient.retireApiEndpoints(rows.map((r) => r.id), retired)
    const keepOpen = new Set(openGroups.value)
    const res = await apiClient.fetchApiEndpoints({})
    allRows.value = res.items
    openGroups.value = keepOpen
    ElMessage.success(
      retired ? `已标记废弃 ${rows.length} 个，之后不会再给它们生成用例` : '已取消废弃，可以正常生成用例了'
    )
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  } finally {
    retiring.value = false
  }
}

const LEVEL_OPTIONS: { value: ApiEndpointLevel; label: string }[] = [
  { value: 'CORE', label: '核心' },
  { value: 'IMPORTANT', label: '重要' },
  { value: 'NORMAL', label: '一般' },
  { value: 'UNUSED', label: '无人调用' }
]

async function setLevel(row: ApiEndpointVo, cmd: string) {
  const level = cmd === 'AUTO' ? null : (cmd as ApiEndpointLevel)
  try {
    await apiClient.setApiEndpointLevel([row.id], level)
    const keepOpen = new Set(openGroups.value)
    const res = await apiClient.fetchApiEndpoints({})
    allRows.value = res.items
    openGroups.value = keepOpen
    ElMessage.success(level ? `已定为${LEVEL_OPTIONS.find((o) => o.value === level)?.label}` : '已恢复自动判断')
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function retireAllDead() {
  const rows = deadInProject.value
  try {
    await ElMessageBox.confirm(
      `把 ${project.value.toUpperCase()} 下 ${rows.length} 个疑似废弃的接口全部标记为废弃？标记后不再生成用例，也不算进未覆盖；之后可以在「已废弃」里逐个取消。`,
      '批量标记废弃',
      { type: 'warning', confirmButtonText: '全部标记', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await setRetired(rows, true)
}

function fmtTime(s?: string | null) {
  return s ? String(s).replace('T', ' ').slice(0, 16) : ''
}
const projectCovered = computed(() => projectAll.value.filter((r) => r.caseCount > 0).length)
const projectChanged = computed(() => projectAll.value.filter((r) => !!r.changeFlag).length)

const groups = computed<EpGroup[]>(() => {
  const map = new Map<string, EpGroup>()
  for (const row of projectRows.value) {
    const src = sourceOf(row.sourceFile)
    const key = src ? src.name : UNGROUPED_KEY
    let g = map.get(key)
    if (!g) {
      g = { key, name: src ? src.name : '未关联源码', lang: src?.lang || '', rows: [] }
      map.set(key, g)
    }
    g.rows.push(row)
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === UNGROUPED_KEY) return 1
    if (b.key === UNGROUPED_KEY) return -1
    return a.name.localeCompare(b.name)
  })
})

const projectMeta = computed(() => {
  const out: string[] = []
  if (projectLabel.value && projectLabel.value !== project.value) out.push(projectLabel.value)
  const langs = [...new Set(projectAll.value.map((r) => sourceOf(r.sourceFile)?.lang).filter(Boolean))]
  if (langs.length) out.push(langs.join(' / '))
  const controllers = new Set(projectAll.value.map((r) => sourceOf(r.sourceFile)?.name).filter(Boolean))
  out.push(`${controllers.size} 个 Controller`, `${projectAll.value.length} 个接口`)
  return out
})

const batchMissingCount = computed(() => projectRows.value.filter(isUncovered).length)

function sourceOf(file?: string) {
  const f = String(file || '').trim()
  if (!f) return null
  const base = f.split(/[\\/]/).pop() || f
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
  const name = dot > 0 ? base.slice(0, dot) : base
  const lang = ext === 'java' ? 'Java' : ext === 'kt' ? 'Kotlin' : ext === 'py' ? 'Py' : ext === 'go' ? 'Go' : ext ? ext.toUpperCase() : ''
  return { name, lang }
}

function langIcon(lang: string) {
  if (lang === 'Java' || lang === 'Kotlin') return '☕'
  if (lang === 'Py') return '🐍'
  if (lang === 'Go') return '◎'
  return '📄'
}

function catColor(key: string) {
  if (CAT_COLORS[key]) return CAT_COLORS[key]
  const i = categories.value.findIndex((c) => c.key === key)
  return CAT_PALETTE[Math.max(0, i) % CAT_PALETTE.length]
}

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)}%` : '—'
}

function hostOf(url: string) {
  return url.replace(/^\w+:\/\//, '')
}

function changeLabel(flag: string) {
  const f = flag.toUpperCase()
  if (f === 'NEW') return '新增'
  if (f === 'DELETED' || f === 'REMOVED') return '已删除'
  return '有改动'
}

function changeClass(flag: string) {
  const f = flag.toUpperCase()
  if (f === 'NEW') return 'is-new'
  if (f === 'DELETED' || f === 'REMOVED') return 'is-removed'
  return 'is-changed'
}

function coverClass(row: ApiEndpointVo) {
  if (!(row.caseCount > 0)) return 'is-none'
  if (row.actionable) return 'is-warn'
  return 'is-ok'
}

function epKey(method?: string, path?: string) {
  return `${String(method || '').toUpperCase()}:${String(path || '').trim()}`
}

function toggleChip(value: string) {
  chip.value = chip.value === value ? '' : value
}

function toggleCat(key: string) {
  const next = new Set(collapsedCats.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedCats.value = next
}

function toggleAllCats() {
  collapsedCats.value = allCatsCollapsed.value ? new Set() : new Set(categories.value.map((c) => c.key))
}

function toggleGroup(key: string) {
  const next = new Set(openGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openGroups.value = next
}

function resetOpenGroups() {
  const list = groups.value
  openGroups.value = new Set((filtering.value || list.length <= 4 ? list : list.slice(0, 3)).map((g) => g.key))
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选中')
  }
}

function setEnvironment(env: 'TEST' | 'PROD') {
  if (environment.value === env) return
  environment.value = env
  void router.replace({ query: { ...route.query, environment: env } })
  void loadUrls()
}

function pickProject(code: string) {
  if (project.value === code) return
  project.value = code
  selectedIds.value = []
  if (requirementNo.value) void loadReqContext()
}

function openUrls() {
  urlsVisible.value = true
}

async function loadUrls() {
  try {
    const rows = await apiClient.getApiUrls({ environment: environment.value, enabledOnly: true })
    const map: Record<string, string> = {}
    for (const r of Array.isArray(rows) ? rows : []) {
      if (r?.project && r?.baseUrl && !map[r.project]) map[r.project] = String(r.baseUrl).replace(/\/$/, '')
    }
    urlByProject.value = map
  } catch {
    urlByProject.value = {}
  }
}

async function refreshAll() {
  await Promise.all([loadTree(), load(), loadUrls(), loadPreflight(), loadMisplaced()])
}

const preflight = ref<Array<{ id: string; project: string; path: string; caseCount: number }>>([])
const purgingPreflight = ref(false)

async function loadPreflight() {
  try {
    preflight.value = (await apiClient.getPreflightEndpoints()).items || []
  } catch {
    preflight.value = []
  }
}

async function purgePreflight() {
  const withCases = preflight.value.filter((p) => p.caseCount > 0)
  const caseTotal = withCases.reduce((n, p) => n + p.caseCount, 0)
  let includeCases = false
  try {
    if (withCases.length) {
      const sample = withCases
        .slice(0, 5)
        .map((p) => `${p.project} · ${p.path}（${p.caseCount} 条）`)
        .join('\n')
      await ElMessageBox.confirm(
        `共 ${preflight.value.length} 个 OPTIONS 预检，其中 ${withCases.length} 个挂着 ${caseTotal} 条用例：\n${sample}${withCases.length > 5 ? '\n…' : ''}\n\n这些用例测的是跨域预检，不是业务接口。`,
        '清理 OPTIONS 预检',
        {
          confirmButtonText: '连用例一起删',
          cancelButtonText: '只删没用例的',
          distinguishCancelAndClose: true,
          type: 'warning',
          customStyle: { whiteSpace: 'pre-line' }
        }
      )
      includeCases = true
    } else {
      await ElMessageBox.confirm(
        `删掉 ${preflight.value.length} 个 OPTIONS 预检？都没挂用例。`,
        '清理 OPTIONS 预检',
        { type: 'warning', confirmButtonText: '删除' }
      )
    }
  } catch (action) {
    if (action !== 'cancel' || !withCases.length) return
  }
  purgingPreflight.value = true
  try {
    const r = await apiClient.purgePreflightEndpoints(includeCases)
    const kept = r.kept?.length ? `，留下 ${r.kept.length} 个挂着用例的` : ''
    const cases = r.casesDeleted ? `（连带 ${r.casesDeleted} 条用例）` : ''
    ElMessage.success(`已删 ${r.deleted} 个 OPTIONS 预检${cases}${kept}`)
    await refreshAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '清理失败，需要管理员权限')
  } finally {
    purgingPreflight.value = false
  }
}

/** 项目树直接用「项目管理」的数据；客户端工程没有后端接口，不列 */
async function loadTree() {
  treeLoading.value = true
  try {
    const r = await apiClient.getApiProjectsTree()
    tree.value = (r.categories || [])
      .map((c) => ({
        key: c.key,
        label: c.label,
        total: 0,
        children: inventoryChildren(c)
      }))
      .filter((c) => (c.children || []).length)
  } catch (e: any) {
    tree.value = []
    ElMessage.error(e?.message || '项目列表加载失败')
  } finally {
    treeLoading.value = false
  }
  syncProjectFromTree()
}

function inventoryChildren(c: {
  kinds?: Array<{ key: string; label: string; projects: Array<{ code: string; name: string; missing?: boolean; kind?: string; scanEndpoints?: boolean }> }>
  projects?: Array<{ code: string; name: string; missing?: boolean; kind?: string; scanEndpoints?: boolean }>
}): Array<ProjNode | KindNode> {
  const kinds = c.kinds || []
  if (kinds.length) {
    return kinds
      .filter((k) => k.key === 'BACKEND')
      .map((k) => ({
        key: k.key,
        label: k.label,
        type: 'KIND',
        total: 0,
        children: k.projects
          .filter((p) => !p.missing && p.scanEndpoints !== false)
          .map((p) => ({ project: p.code, label: p.name, total: 0 }))
      }))
      .filter((k) => (k.children || []).length)
  }
  return (c.projects || [])
    .filter((p) => !p.missing && p.kind !== 'CLIENT' && p.kind !== 'FRONTEND' && p.scanEndpoints !== false)
    .map((p) => ({ project: p.code, label: p.name, total: 0 }))
}

function syncProjectFromTree() {
  const all = categories.value.flatMap((c) => leafProjects(c))
  if (all.length && !all.some((p) => p.project === project.value)) {
    project.value = (all.find((p) => totalByProject.value[p.project]) || all[0]).project
  }
  revealCurrentProject()
}

async function load() {
  loading.value = true
  try {
    const res = await apiClient.fetchApiEndpoints({})
    allRows.value = res.items
    resetOpenGroups()
    await openFromQuery()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function openFromQuery() {
  const id = String(route.query.endpointId || '').trim()
  if (!id) return
  const row = allRows.value.find((r) => r.id === id)
  if (row) await openReadiness(row)
}

async function assignToCollection(caseId?: string) {
  if (!targetCollectionId.value || !caseId) return
  try {
    await apiClient.assignApiTestCases(targetCollectionId.value, [caseId])
  } catch (e: any) {
    ElMessage.warning(e?.message || '用例已生成，但归入集合失败，请在用例列表手动拖入')
  }
}

async function generate(row: ApiEndpointVo) {
  generatingId.value = row.id
  try {
    let job = await apiClient.startAiCases({
      project: row.project,
      endpointIds: [row.id],
      onlyUncovered: false,
      dir: readStored(SCAN_DIR_STORAGE_KEY)[row.project] || undefined
    })
    while (job.running) {
      await new Promise((r) => setTimeout(r, 2000))
      job = await apiClient.getAiCaseJob(job.id)
    }
    const it = job.items[0]
    for (const id of it?.caseIds || []) await assignToCollection(id)
    await load()
    if (!it || !it.cases) {
      ElMessage.error(it?.note || job.message || '生成失败')
    } else if (it.enabled) {
      ElMessage.success(`生成 ${it.cases} 条，${it.enabled} 条已启用`)
    } else {
      ElMessage({ type: 'warning', message: `生成 ${it.cases} 条，先停用：${it.note || ''}`, duration: 8000 })
    }
  } catch (e: any) {
    if (String(e?.message || '').includes('千问没配')) return generateSkeleton(row)
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generatingId.value = ''
  }
}

async function generateSkeleton(row: ApiEndpointVo) {
  generatingId.value = row.id
  try {
    const res = await apiClient.generateCaseFromEndpoint(row.id)
    await assignToCollection(res.case?.id)
    await load()
    if (res.enabled) {
      ElMessage.success(`已生成并启用：${res.note}`)
    } else {
      pendingProject.value = row.project
      pendingCaseCount.value = allRows.value.find((r) => r.id === row.id)?.caseCount ?? (row.caseCount ?? 0) + 1
      pendingVisible.value = true
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    generatingId.value = ''
  }
}

async function generateAllMissing() {
  const rows = projectRows.value.filter(isUncovered)
  if (!rows.length) return
  batchGenerating.value = true
  let ok = 0
  let skipped = 0
  try {
    for (const row of rows) {
      try {
        const res = await apiClient.generateCaseFromEndpoint(row.id)
        await assignToCollection(res.case?.id)
        ok += 1
        if (!res.enabled) skipped += 1
      } catch {
        /* 单条失败不挡后面的 */
      }
    }
    await load()
    ElMessage.success(
      skipped
        ? `已生成 ${ok} 条（其中 ${skipped} 条为停用，需补断言后再启用）`
        : `已生成 ${ok} 条并归入集合`
    )
  } finally {
    batchGenerating.value = false
  }
}

function openCollection() {
  const q: Record<string, string> = { environment: environment.value }
  if (project.value) q.project = project.value
  if (requirementNo.value) q.requirementNo = requirementNo.value
  router.push({ path: '/api-collections', query: q })
}

function openCases(row: ApiEndpointVo) {
  router.push({
    path: '/api-collections',
    query: { project: row.project, environment: environment.value }
  })
}

const insightVisible = ref(false)
const insightRow = ref<ApiEndpointVo | null>(null)

function openInsight(row: ApiEndpointVo) {
  insightRow.value = row
  insightVisible.value = true
}

const readyVisible = ref(false)
const readyLoading = ref(false)
const readyTitle = ref('')
const readyCases = ref<any[]>([])

async function openReadiness(row: ApiEndpointVo) {
  readyVisible.value = true
  readyLoading.value = true
  readyTitle.value = `${row.httpMethod} ${row.path} · 还差什么`
  readyCases.value = []
  try {
    const d = await apiClient.getApiEndpointDetail(row.id)
    readyCases.value = d.cases || []
  } catch (e: any) {
    ElMessage.error(e?.message || '读取失败')
  } finally {
    readyLoading.value = false
  }
  // 从「受影响用例」跳转进来时，滚动到那条高亮用例
  if (focusCaseId.value) {
    await nextTick()
    document.querySelector('.ready-item.highlight')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

/** 从对比分析的「受影响用例」跳转过来：自动打开该接口的用例弹窗并高亮目标用例 */
async function focusAffectedCase() {
  const epId = String(route.query.endpointId || '').trim()
  if (!focusCaseId.value || !epId) return
  const row = allRows.value.find((r) => r.id === epId)
  if (row) await openReadiness(row)
}

async function loadReqContext() {
  reqPathKeys.value = new Set()
  targetCollectionName.value = ''
  if (!requirementNo.value) return
  try {
    const eps = await apiClient.fetchRequirementEndpoints(requirementNo.value)
    reqPathKeys.value = new Set(eps.map((e) => epKey(e.httpMethod, e.path)))
  } catch {
    reqPathKeys.value = new Set()
  }
  if (targetCollectionId.value) {
    try {
      const cols = await apiClient.getApiTestCollections({ project: project.value })
      targetCollectionName.value =
        cols.find((c) => c.id === targetCollectionId.value)?.name || targetCollectionId.value
    } catch {
      targetCollectionName.value = targetCollectionId.value
    }
  }
}

const pendingVisible = ref(false)
const pendingProject = ref('')
const pendingCaseCount = ref(0)

function goFix(path: '/packet-capture' | '/api-changes') {
  pendingVisible.value = false
  router.push({ path, query: pendingProject.value ? { project: pendingProject.value } : {} })
}

const SCAN_DIR_STORAGE_KEY = 'apiEndpointScanDirs'
const scanVisible = ref(false)
const SCAN_CALLER_STORAGE_KEY = 'apiEndpointScanCallerDirs'
const scanDir = ref('')
const scanCallerDirs = ref('')
const scanning = ref(false)

function readStored(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {}
  } catch {
    return {}
  }
}

function remember(key: string, code: string, value: string) {
  const all = readStored(key)
  if (value) all[code] = value
  else delete all[code]
  localStorage.setItem(key, JSON.stringify(all))
}

type ScanResult = Awaited<ReturnType<typeof apiClient.scanApiEndpointSource>>
const scanMode = ref<'ref' | 'dir'>('ref')
const scanRef = ref('')
const scanResult = ref<ScanResult | null>(null)
const lastScan = ref<ApiSourceScan | null>(null)

const lastScanText = computed(() => {
  const l = lastScan.value
  if (!l) return ''
  const base = l.ref ? `${l.ref}${l.sha ? ' @ ' + l.sha.slice(0, 10) : ''}` : '本地目录'
  return `${fmtTime(l.scannedAt)} · ${base}${l.endpoints != null ? ` · ${l.endpoints} 个接口` : ''}`
})

const scanCallerText = computed(() => {
  const r = scanResult.value
  if (!r) return ''
  if (r.callerError) return `搜调用方失败：${r.callerError}`
  const dead = (r.callerDefOnly ?? 0) + (r.callerNone ?? 0)
  return `${r.callerUsed ?? 0} 个有调用方，${dead} 个疑似废弃`
})

function openScan() {
  scanDir.value = readStored(SCAN_DIR_STORAGE_KEY)[project.value] || ''
  scanCallerDirs.value = readStored(SCAN_CALLER_STORAGE_KEY)[project.value] || ''
  scanMode.value = 'ref'
  scanRef.value = ''
  scanResult.value = null
  lastScan.value = null
  scanVisible.value = true
  const code = project.value
  apiClient
    .fetchSourceScans(code)
    .then((m) => {
      if (project.value === code) lastScan.value = m[code] || Object.values(m)[0] || null
    })
    .catch(() => {})
}

async function submitScan() {
  const code = project.value
  const dir = scanDir.value.trim()
  const callerDirs = scanCallerDirs.value.trim()
  if (scanMode.value === 'dir' && !dir) {
    ElMessage.warning('填一下源码目录')
    return
  }
  scanning.value = true
  try {
    const r = await apiClient.scanApiEndpointSource(
      code,
      scanMode.value === 'dir' ? { dir, callerDirs } : { ref: scanRef.value.trim(), callerDirs }
    )
    if (scanMode.value === 'dir') remember(SCAN_DIR_STORAGE_KEY, code, dir)
    remember(SCAN_CALLER_STORAGE_KEY, code, callerDirs)
    scanResult.value = r
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

type ScanAllJob = ApiScanAllJob
const SCAN_STATE_LABEL: Record<string, string> = {
  WAITING: '排队',
  RUNNING: '扫描中',
  DONE: '完成',
  FAILED: '失败',
  SKIPPED: '跳过'
}
const scanAllVisible = ref(false)
const scanAllStarting = ref(false)
const scanAllJob = ref<ScanAllJob | null>(null)
let scanAllTimer: ReturnType<typeof setTimeout> | null = null

const scanAllDoneCount = computed(
  () => (scanAllJob.value?.items || []).filter((i) => i.state !== 'WAITING' && i.state !== 'RUNNING').length
)

const scanAllTotals = computed(() => {
  const t = { CORE: 0, IMPORTANT: 0, NORMAL: 0, UNUSED: 0 }
  for (const it of scanAllJob.value?.items || []) {
    if (!it.levels) continue
    t.CORE += it.levels.CORE || 0
    t.IMPORTANT += it.levels.IMPORTANT || 0
    t.NORMAL += it.levels.NORMAL || 0
    t.UNUSED += it.levels.UNUSED || 0
  }
  return t
})

function scanAllNote(it: ScanAllJob['items'][number]) {
  if (it.error) return it.error
  const r = it.result
  if (!r) return ''
  const parts: string[] = []
  if (r.created) parts.push(`新增 ${r.created}`)
  if (r.linked) parts.push(`认上抓包 ${r.linked}`)
  if (r.gone) parts.push(`基线里已没有 ${r.gone}`)
  if (r.duplicates) parts.push(`重复 ${r.duplicates} 对`)
  if (r.callerError) parts.push(`搜调用方失败：${r.callerError}`)
  if (r.fetch && r.fetch.startsWith('fetch 失败')) parts.push(r.fetch)
  return parts.join('，')
}

function pollScanAll() {
  if (scanAllTimer) clearTimeout(scanAllTimer)
  scanAllTimer = null
  const job = scanAllJob.value
  if (!job || job.done) return
  scanAllTimer = setTimeout(async () => {
    try {
      const j = await apiClient.getScanAllJob(job.id)
      if (j) {
        scanAllJob.value = j
        if (j.done) {
          await load()
          ElMessage.success(`全部项目扫描完成：核心 ${scanAllTotals.value.CORE} 个`)
        }
      }
    } catch {
      // 网络抖一下下次再拉
    }
    pollScanAll()
  }, 2000)
}

async function openScanAll() {
  scanAllVisible.value = true
  if (scanAllJob.value) return
  try {
    const j = await apiClient.getScanAllJob('latest')
    scanAllJob.value = j
    pollScanAll()
  } catch {
    scanAllJob.value = null
  }
}

async function startScanAll() {
  scanAllStarting.value = true
  try {
    scanAllJob.value = await apiClient.startScanAllProjects()
    pollScanAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动扫描失败')
  } finally {
    scanAllStarting.value = false
  }
}

onBeforeUnmount(() => {
  if (scanAllTimer) clearTimeout(scanAllTimer)
  if (aiBatchTimer) clearTimeout(aiBatchTimer)
})

const aiBatchVisible = ref(false)
const aiBatchStarting = ref(false)
const aiBatch = ref<AiCaseBatch | null>(null)
// 无人调用的生成用例没意义；只有后台在调的先不管
const aiBatchLevels = ref<ApiEndpointLevel[]>(['CORE', 'IMPORTANT'])
const aiBatchTryRun = ref(false)
let aiBatchTimer: ReturnType<typeof setTimeout> | null = null

function toggleAiBatchLevel(v: ApiEndpointLevel) {
  aiBatchLevels.value = aiBatchLevels.value.includes(v)
    ? aiBatchLevels.value.filter((x) => x !== v)
    : [...aiBatchLevels.value, v]
}

/** 各级别还没用例的接口数，和后端批量的口径一致：废弃、基线里已没有、待归类的不算 */
const aiBatchUncovered = computed(() => {
  const out = { CORE: 0, IMPORTANT: 0, NORMAL: 0, UNUSED: 0 } as Record<ApiEndpointLevel, number>
  for (const r of allRows.value) {
    if (r.project === INBOX || r.goneAt || !isUncovered(r) || !r.level) continue
    if (r.level in out) out[r.level as ApiEndpointLevel]++
  }
  return out
})

const aiBatchScopeCount = computed(() => aiBatchLevels.value.reduce((s, v) => s + aiBatchUncovered.value[v], 0))

const aiBatchTotals = computed(() => {
  const t = { total: 0, done: 0, created: 0, enabled: 0, failed: 0 }
  for (const it of aiBatch.value?.items || []) {
    t.total += it.total || 0
    t.done += it.done || 0
    t.created += it.created || 0
    t.enabled += it.enabledCases || 0
    t.failed += it.failed || 0
  }
  return t
})

function pollAiBatch() {
  if (aiBatchTimer) clearTimeout(aiBatchTimer)
  aiBatchTimer = null
  if (!aiBatch.value?.running) return
  aiBatchTimer = setTimeout(async () => {
    try {
      const b = await apiClient.latestAiCasesAll()
      if (b) {
        const finished = aiBatch.value?.running && !b.running
        aiBatch.value = b
        if (finished) {
          await load()
          ElMessage.success(`批量生成结束：${aiBatchTotals.value.created} 条用例`)
        }
      }
    } catch {
      // 网络抖一下下次再拉
    }
    pollAiBatch()
  }, 3000)
}

async function openAiBatch() {
  aiBatchVisible.value = true
  if (aiBatch.value?.running) return
  try {
    aiBatch.value = await apiClient.latestAiCasesAll()
    pollAiBatch()
  } catch {
    aiBatch.value = null
  }
}

async function startAiBatch() {
  aiBatchStarting.value = true
  try {
    aiBatch.value = await apiClient.startAiCasesAll({ levels: aiBatchLevels.value, tryRun: aiBatchTryRun.value })
    pollAiBatch()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    aiBatchStarting.value = false
  }
}

const dupVisible = ref(false)
const dupLoading = ref(false)
const dupMerging = ref(false)
const dupPairs = ref<ApiEndpointDuplicatePair[]>([])
const dupAmbiguous = ref<Array<{ project: string; httpMethod: string; codePath: string; paths: string[] }>>([])
const dupChecked = ref(new Set<string>())

async function openDup() {
  scanVisible.value = false
  dupVisible.value = true
  dupLoading.value = true
  dupPairs.value = []
  dupAmbiguous.value = []
  dupChecked.value = new Set()
  try {
    const r = await apiClient.previewEndpointDuplicates(isInbox.value ? undefined : project.value)
    dupPairs.value = r.pairs || []
    dupAmbiguous.value = r.ambiguous || []
    dupChecked.value = new Set(dupPairs.value.map((p) => p.dropId))
  } catch (e: any) {
    ElMessage.error(e?.message || '查重复接口失败')
  } finally {
    dupLoading.value = false
  }
}

function toggleDup(id: string, on: boolean) {
  const next = new Set(dupChecked.value)
  if (on) next.add(id)
  else next.delete(id)
  dupChecked.value = next
}

function toggleAllDup(on: boolean) {
  dupChecked.value = on ? new Set(dupPairs.value.map((p) => p.dropId)) : new Set()
}

async function submitMerge() {
  const ids = [...dupChecked.value]
  try {
    await ElMessageBox.confirm(
      `合并 ${ids.length} 对：源码那条删掉，它的用例、需求关联挪到抓包那条下面。合并后不能撤销。`,
      '确认合并',
      { type: 'warning', confirmButtonText: '合并', cancelButtonText: '再看看' }
    )
  } catch {
    return
  }
  dupMerging.value = true
  try {
    const r = await apiClient.mergeEndpointDuplicates(isInbox.value ? undefined : project.value, ids)
    ElMessage.success(`已合并 ${r.merged} 对`)
    dupVisible.value = false
    if (scanResult.value) scanResult.value = { ...scanResult.value, duplicates: Math.max(0, (scanResult.value.duplicates ?? 0) - r.merged) }
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '合并失败')
  } finally {
    dupMerging.value = false
  }
}

function pathTitle(row: ApiEndpointVo) {
  return row.codePath && row.codePath !== row.path
    ? `客户端调的：${row.path}\n代码里写的：${row.codePath}`
    : row.path
}

function goneBase(row: ApiEndpointVo) {
  return (row.goneRef || 'master').split('@')[0].replace(/^origin\//, '')
}

function goneLabel(row: ApiEndpointVo) {
  return row.hasCaptureMeta ? '客户端还在调，代码里没了' : `${goneBase(row)} 里已没有`
}

function goneTitle(row: ApiEndpointVo) {
  const head = `${fmtTime(row.goneAt)} 按 ${row.goneRef || '基线分支'} 全量扫描时，代码里找不到这个接口。可能已经删了，也可能还在别的分支上没合进来`
  return row.hasCaptureMeta
    ? `${head}。\n但抓包抓到过它，客户端还在调：要确认是不是网关转给了别的服务，或者代码删早了`
    : `${head}。\n确认已下线的话可以标记废弃`
}

function changeTitle(row: ApiEndpointVo) {
  const bs = row.branches || []
  if (!bs.length) return row.changeNote || ''
  return bs
    .map((b) => `${b.branch}：${b.changeFlag ? changeLabel(b.changeFlag) : '—'}${b.changeNote ? ' · ' + b.changeNote : ''}`)
    .join('\n')
}

const importVisible = ref(false)
const importContent = ref('')
const importing = ref(false)

function openImportDoc() {
  importContent.value = ''
  importVisible.value = true
}

async function submitImportDoc() {
  const content = importContent.value.trim()
  if (!content) {
    ElMessage.warning('先粘贴 OpenAPI JSON')
    return
  }
  importing.value = true
  try {
    const r = await apiClient.importOpenApi(project.value, content)
    importVisible.value = false
    await Promise.all([load(), loadTree()])
    const warn = r.warnings?.length ? `（${r.warnings.length} 条警告）` : ''
    ElMessage.success(`已导入 ${r.imported} 个接口${warn}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadTree(), loadReqContext(), loadUrls()])
  await load()
  void loadPreflight()
  void loadMisplaced()
  await focusAffectedCase()
})

watch(
  () => route.query.requirementNo,
  async () => {
    await loadReqContext()
    resetOpenGroups()
  }
)

watch(
  () => route.query.project,
  (code) => {
    if (typeof code !== 'string' || !code || code === project.value) return
    project.value = code
    syncProjectFromTree()
    if (requirementNo.value) void loadReqContext()
  }
)

watch(
  () => route.query.endpointId,
  async (id) => {
    if (!id || loading.value) return
    await openFromQuery()
  }
)

watch([chip, keyword], () => {
  if (filtering.value && !projectRows.value.length) {
    const next = categories.value.flatMap((c) => c.children || []).find((p) => countByProject.value[p.project])
    if (next) project.value = next.project
  }
})

watch([project, chip, keyword], resetOpenGroups)

watch([projKeyword, chip, keyword], () => revealCurrentProject())
</script>

<style scoped>
.api-endpoints {
  max-width: 100%;
}

.env-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  margin-right: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.env-seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.env-seg-item.active {
  background: #fff;
  color: var(--el-text-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.env-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.env-dot.is-test {
  background: var(--el-color-success);
}
.env-dot.is-prod {
  background: var(--el-color-danger);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
}
.stat + .stat {
  border-left: 1px solid var(--el-border-color-lighter);
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}
.stat-num.is-green {
  color: var(--el-color-success-dark-2);
}
.stat-num.is-orange {
  color: var(--el-color-warning-dark-2);
}
.stat-num.is-blue {
  color: var(--el-color-primary);
}
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.stat-sub {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.kw-input {
  flex: 1;
  min-width: 220px;
}
.chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: #fff;
  font-size: 12.5px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  white-space: nowrap;
}
.chip:hover {
  border-color: var(--el-color-primary-light-5);
}
.chip.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: #fff;
}
.chip-num {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--el-fill-color);
  font-size: 11px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.chip.active .chip-num {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}
.chip-sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--el-border-color);
}

.req-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  font-size: 12.5px;
  color: var(--el-text-color-regular);
}
.req-batch {
  margin-left: auto;
}

.ep-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.tree {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 150px);
  overflow: auto;
  padding: 12px 10px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 10px;
}
.tree-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.tree-toggle {
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.tree-toggle:hover {
  color: var(--el-color-primary);
}
.tree-search {
  margin-bottom: 8px;
}
.tree-cat + .tree-cat {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-extra-light);
}
.cat-head {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.cat-head:hover {
  background: var(--el-fill-color-light);
}
.caret {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.15s;
}
.caret.open {
  transform: rotate(90deg);
}
.cat-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cat-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cat-num {
  padding: 0 6px;
  border-radius: 9px;
  background: var(--el-color-primary-light-9);
  font-size: 11px;
  line-height: 18px;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.cat-body {
  padding: 2px 0 2px 12px;
}
.kind-head {
  padding: 8px 8px 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  letter-spacing: 0.04em;
}
.proj-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.proj-item:hover {
  background: var(--el-fill-color-light);
}
.proj-item.active {
  background: var(--el-color-primary-light-9);
}
.proj-dot {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
}
.proj-item.active .proj-dot {
  background: var(--el-color-success);
}
.proj-code {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-item.active .proj-code {
  color: var(--el-color-primary);
  font-weight: 600;
}
.proj-item.is-dim .proj-code,
.proj-item.is-dim .proj-num {
  color: var(--el-text-color-placeholder);
}
.proj-num {
  flex-shrink: 0;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.proj-pager {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 2px 21px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: #fff;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.pager-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.pager-btn:disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}
.pager-text {
  min-width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pager-total {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
}
.proj-empty {
  padding: 8px 21px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.main {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.main-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.main-head-text {
  min-width: 0;
}
.main-title {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.main-meta,
.main-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.main-meta {
  margin-top: 5px;
}
.main-stats {
  flex-shrink: 0;
  font-size: 12.5px;
}
.main-stats b {
  color: var(--el-text-color-primary);
}
.pd-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.pd-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #fff4e0;
  color: #e8850c;
  font-size: 22px;
  font-weight: 700;
}
.pd-head-text {
  flex: 1;
  min-width: 0;
}
.pd-tag {
  display: inline-block;
  padding: 0 10px;
  border: 1px solid #fcd9a0;
  border-radius: 12px;
  background: var(--el-color-warning-light-9);
  color: #d9730d;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}
.pd-title {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.pd-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.pd-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  cursor: pointer;
}
.pd-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.pd-reason {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
}
.pd-reason-label {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.pd-reason code {
  padding: 1px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
}
.pd-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.pd-section::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--el-border-color-lighter);
}
.pd-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.pd-option {
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}
.pd-option-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pd-option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 16px;
}
.pd-option-icon.is-blue {
  background: var(--el-color-primary-light-9);
}
.pd-option-icon.is-green {
  background: var(--el-color-success-light-9);
}
.pd-option-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.pd-option-desc {
  flex: 1;
  margin: 10px 0 14px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.pd-option-btn {
  width: 100%;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}
.pd-option-btn.is-green {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.pd-option-btn.is-green:hover {
  border-color: #73d13d;
  background: #eaffd9;
  color: var(--el-color-success-dark-2);
}
.pd-note {
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.pd-note::before {
  content: 'ℹ';
  margin-right: 8px;
  color: var(--el-text-color-placeholder);
}
.pd-note b {
  color: var(--el-text-color-primary);
}
.pd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.pd-foot :deep(.el-button) {
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 600;
}

.rescan-link {
  margin-left: 4px;
}
.scan-label {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.mono-input + .scan-label {
  margin-top: 16px;
}
.mono-input :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.meta-sep {
  width: 1px;
  height: 11px;
  background: var(--el-border-color);
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}
.group-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: var(--el-fill-color-lighter);
  cursor: pointer;
  text-align: left;
}
.group-head:hover {
  background: var(--el-fill-color-light);
}
.lang-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  background: var(--el-fill-color);
}
.lang-icon.is-java,
.lang-icon.is-kotlin {
  background: var(--el-color-warning-light-9);
}
.lang-icon.is-py {
  background: var(--el-color-primary-light-9);
}
.lang-icon.is-go {
  color: #0e9f9f;
  background: #e8fbfb;
}
.group-title {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lang-tag {
  padding: 0 7px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
  line-height: 18px;
  color: var(--app-text-regular);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}
.lang-tag.is-java,
.lang-tag.is-kotlin {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-color: #fed7aa;
}
.lang-tag.is-py {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: #c7d7fe;
}
.lang-tag.is-go {
  color: #0e9f9f;
  background: #e8fbfb;
  border-color: #a8e8e8;
}
.group-count {
  min-width: 18px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

.ep-row {
  display: grid;
  grid-template-columns: 28px 76px minmax(0, 1fr) 210px 80px 56px 120px;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid var(--el-border-color-extra-light);
  font-size: 12.5px;
}
.sel-col {
  display: flex;
  align-items: center;
  justify-content: center;
}
.classify-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.ep-row.is-head {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ep-row:not(.is-head):hover {
  background: var(--el-fill-color-lighter);
}
.ep-row.is-deprecated {
  opacity: 0.55;
}
.center {
  text-align: center;
}
.right {
  text-align: right;
}

.method {
  display: inline-block;
  min-width: 44px;
  padding: 0 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  color: var(--app-text-regular);
  background: var(--el-fill-color);
}
.method.is-get {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.method.is-post {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.method.is-put {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.method.is-patch {
  color: #7b61ff;
  background: #f3f0ff;
}
.method.is-delete {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.ep-name-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ep-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ep-summary.is-blank {
  font-weight: 400;
  font-style: italic;
  color: var(--el-text-color-placeholder);
}
.ep-summary-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.lvl-dd {
  flex-shrink: 0;
}
.lvl-dd.is-tail {
  order: 99;
}
.lvl-tag {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
}
.lvl-tag.is-core {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
  font-weight: 600;
}
.lvl-tag.is-important {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}
.lvl-tag.is-empty {
  color: var(--el-text-color-secondary);
  border-color: var(--el-border-color);
  opacity: 0;
}
.ep-row:hover .lvl-tag.is-empty {
  opacity: 1;
}
.misplaced-path {
  margin-left: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.misplaced-reason {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cap-src-tag {
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  color: #0e7a5f;
  background: #e8f7f1;
  border: 1px solid #bfe8d8;
}

.auth-tag {
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  color: var(--el-color-primary);
  background: #eef3ff;
  border: 1px solid #d6e2ff;
}
.we-tag {
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: help;
}
.we-tag.is-writes {
  color: var(--el-color-danger-dark-2);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.we-tag.is-readonly {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}
.we-tag.is-unknown {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border: 1px dashed #bfbfbf;
}
.caller-tag {
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
}
.caller-tag.is-used {
  color: var(--app-text-regular);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}
.caller-tag.is-used:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}
.caller-tag.is-dead {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.caller-tag.is-retired {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
  cursor: default;
}
.caller-pop-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.retire-all {
  margin-left: 4px;
}
.caller-pop-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.caller-item {
  padding: 6px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.caller-item.is-unused {
  opacity: 0.55;
}
.caller-loc {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.caller-repo {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.caller-file {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-text-color-regular);
  word-break: break-all;
}
.caller-via {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.caller-via code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-color-primary);
}
.ep-path {
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gw-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.gw-url {
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gw-missing {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.copy-btn {
  flex-shrink: 0;
  display: inline-flex;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}
.copy-btn:hover {
  color: var(--el-color-primary);
}

.change-tag {
  display: inline-block;
  padding: 0 7px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11.5px;
  line-height: 20px;
}
.change-tag.is-changed {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}
.change-tag.is-new {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}
.change-tag.is-removed {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
}
.faint {
  color: var(--el-text-color-placeholder);
}

.cov-badge {
  display: inline-block;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.cov-badge.is-ok {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
}
.cov-badge.is-warn {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}
.cov-badge.is-none {
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
  border-color: var(--el-border-color-lighter);
  font-weight: 400;
}

.ops :deep(.el-button + .el-button) {
  margin-left: 8px;
}

.empty-card {
  padding: 48px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.ready-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.ready-item.highlight {
  background: var(--el-color-warning-light-9);
  margin: 0 -12px;
  padding: 10px 12px;
  border-radius: 6px;
}
.ready-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ready-todos {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--app-text-regular);
}
</style>

<style>
.pending-dialog.el-dialog {
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
}
.pending-dialog .el-dialog__header {
  margin: 0;
  padding: 24px 24px 18px 28px;
}
.pending-dialog .el-dialog__body {
  padding: 0 28px 24px;
}
.pending-dialog .el-dialog__footer {
  padding: 16px 28px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.lvl-reason {
  max-width: 280px;
  padding: 6px 16px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 4px;
}

.ep-code-path {
  margin-left: 8px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}
.gone-tag {
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
  font-size: 11px;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border: 1px dashed var(--el-border-color);
}
.gone-tag.is-live {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
}
.br-more {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  cursor: default;
}
.scan-mode {
  margin-bottom: 12px;
}
.scan-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
.mono-input + .scan-hint {
  margin-top: 8px;
}
.scan-hint.is-warn {
  color: var(--el-color-warning-dark-2);
}
.scan-hint + .scan-label {
  margin-top: 4px;
}
.scan-last {
  margin-top: 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.scan-result {
  font-size: 13px;
  line-height: 1.7;
}
.sr-base code,
.sr-list code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.sr-fetch {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-color-success-dark-2);
}
.sr-fetch.is-warn {
  color: var(--el-color-warning-dark-2);
}
.sr-list {
  margin: 10px 0 0;
  padding-left: 18px;
}
.sr-dup {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
}
.dup-body {
  min-height: 80px;
}
.dup-table {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.dup-row {
  display: grid;
  grid-template-columns: 28px 60px 1fr 1fr 64px;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  font-size: 12.5px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.dup-row.is-head {
  border-top: none;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
.dup-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dup-path small {
  display: block;
  font-family: inherit;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}
.dup-amb {
  margin-top: 16px;
}
.dup-amb-row {
  margin: 4px 0;
  font-size: 12.5px;
}
.dup-amb-row code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sa-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
  font-size: 13px;
}
.sa-total {
  margin-left: auto;
  font-weight: 500;
}
.sa-table {
  max-height: 460px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.sa-row {
  display: grid;
  grid-template-columns: 1.3fr 64px 1.4fr 52px 44px 44px 44px 64px 2fr;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  font-size: 12.5px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.ab-form {
  display: grid;
  grid-template-columns: 40px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.ab-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.ab-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ab-chip {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 13px;
  background: #fff;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.ab-chip.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.ab-row {
  display: grid;
  grid-template-columns: 1.3fr 60px 1.6fr 76px 52px 44px 2fr;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  font-size: 12.5px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.ab-row.is-head {
  border-top: none;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
.ab-row .right {
  text-align: right;
}
.sa-row.is-head {
  border-top: none;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
.sa-row .right {
  text-align: right;
}
.sa-proj,
.sa-note,
.sa-ref {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sa-ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.sa-ref small {
  color: var(--el-text-color-secondary);
}
.sa-note {
  color: var(--el-text-color-secondary);
}
.sa-core {
  font-weight: 600;
  color: var(--el-color-danger);
}
.sa-state {
  font-size: 12px;
}
.sa-state.is-running {
  color: var(--el-color-primary);
}
.sa-state.is-done {
  color: var(--el-color-success);
}
.sa-state.is-failed {
  color: var(--el-color-danger);
}
.sa-state.is-skipped,
.sa-state.is-waiting {
  color: var(--el-text-color-placeholder);
}
</style>
