<template>
  <div class="analysis-tasks">
    <header class="analysis-header"><div><h1>分析任务</h1><p>接收 TestForge 的需求分析，查看结果及回传状态。</p></div><el-button :loading="loading" @click="load">刷新</el-button></header>
    <el-alert v-if="config && !config.executorEnabled" title="Codex 执行端尚未启用" description="目前可接收任务、查询状态、导入结果；自动分析需按接入说明启用执行端。" type="info" :closable="false" show-icon />
    <el-alert v-if="config && !config.jiraConfigured" title="JIRA 读取尚未配置" description="请配置后端 release-doc 的 JIRA 地址和读取账号；可先手动添加本单材料。" type="warning" :closable="false" style="margin-top:12px" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" style="margin-top: 12px" />
    <div class="analysis-toolbar"><el-input v-model="keyword" placeholder="搜索需求单、来源或请求 ID" clearable /><el-select v-model="status" placeholder="全部状态"><el-option label="全部状态" value="" /><el-option v-for="(label, value) in states" :key="value" :label="label" :value="value" /></el-select><el-button v-if="canWrite" @click="newTask">创建分析任务</el-button><el-button text @click="help = true">接入说明</el-button></div>
    <el-table :data="filtered" v-loading="loading" @row-click="showDetail" row-key="id" empty-text="尚无分析任务。由 TestForge 调用开放接口下达，或先创建分析任务。">
      <el-table-column prop="businessGroup" label="业务组" width="90" />
      <el-table-column prop="materialVersion" label="材料版本" min-width="150" />
      <el-table-column prop="requirement_key" label="需求单" min-width="130" />
      <el-table-column prop="client" label="来源" min-width="110" />
      <el-table-column label="分析状态" min-width="130"><template #default="{ row }"><el-tag :type="stateType(row.status)">{{ states[row.status] || row.status }}</el-tag></template></el-table-column>
      <el-table-column label="回传" min-width="130"><template #default="{ row }">{{ callbackLabels[row.callback_state] || row.callback_state }}</template></el-table-column>
      <el-table-column label="更新时间" min-width="180"><template #default="{ row }">{{ when(row.updated_at) }}</template></el-table-column>
      <el-table-column label="操作" width="90"><template #default="{ row }"><el-button text type="primary" @click.stop="showDetail(row)">查看</el-button></template></el-table-column>
    </el-table>
    <el-drawer v-model="drawer" title="任务详情" size="min(800px, 100vw)" @closed="detail = null; result = null">
      <template v-if="detail"><h2>{{ detail.requirement_key }}</h2><el-descriptions :column="1" border><el-descriptions-item label="业务组 / 材料版本">{{ detail.businessGroup }} / {{ detail.materialVersion }}</el-descriptions-item><el-descriptions-item label="状态">{{ states[detail.status] || detail.status }}</el-descriptions-item><el-descriptions-item label="外部请求 ID">{{ detail.external_id }}</el-descriptions-item><el-descriptions-item label="来源">{{ detail.client }}</el-descriptions-item><el-descriptions-item label="结果来源">{{ detail.result_source === 'manual' ? '人工导入（非执行端自动分析）' : detail.result_source === 'codex' ? 'Codex 执行端' : detail.result_source === 'reused' ? '复用已有报告（未重新分析）' : '尚无结果' }}</el-descriptions-item><el-descriptions-item label="回传">{{ callbackLabels[detail.callback_state] || detail.callback_state }} · 已尝试 {{ detail.callback_attempts }} 次</el-descriptions-item></el-descriptions>
        <el-collapse v-if="detail.analysisInput"><el-collapse-item title="本单分析范围与材料" name="scope"><p v-for="repo in detail.analysisInput.repositories || []" :key="repo.projectId + repo.targetRef">{{ repo.projectId }}：{{ repo.baseRef }} → {{ repo.targetRef }}</p><article v-for="material in detail.analysisInput.materials || []" :key="material.id" class="analysis-item"><b>{{ materialTypes[material.type] || material.type }} · {{ material.title }}</b><p>{{ material.url }}</p><pre>{{ material.content }}</pre></article><pre class="analysis-report">{{ detail.analysisInput.changeNotes }}</pre></el-collapse-item></el-collapse>
        <p v-if="detail.analysisStage" class="form-hint">分析进度：{{ analysisStageLabels[detail.analysisStage] || detail.analysisStage }} · {{ when(detail.analysisProgressAt) }}（阶段时间不代表整体百分比）</p>
        <el-alert v-if="detail.error_code" :title="errorLabel(detail.error_code)" type="warning" :closable="false" style="margin-top:16px" />
        <el-alert v-if="detail.status === 'SUCCEEDED' && detail.callback_state !== 'DELIVERED'" :title="detail.callback_state === 'NOT_CONFIGURED' ? '报告已保存，等待配置通知地址' : '报告已保存，等待通知对方平台'" :description="detail.callback_http_status ? `对方接口返回 HTTP ${detail.callback_http_status}；不影响报告查询，可仅重试回传。` : detail.callback_attempts > 0 ? '通知暂未送达，请检查接收服务和网络；对方仍可主动获取报告。' : '对方可主动获取报告，无需重新分析。'" type="info" :closable="false" style="margin-top:12px" />
        <div class="analysis-detail-actions"><el-button @click="refreshDetail">刷新详情</el-button><el-button v-if="canWrite && ['BLOCKED','FAILED','CANCELLED'].includes(detail.status)" :loading="acting" @click="act('retry')">重新分析</el-button><el-button v-if="canWrite && ['BLOCKED','QUEUED','RUNNING','FAILED'].includes(detail.status)" :loading="acting" @click="act('cancel')">取消任务</el-button><el-button v-if="canWrite && ['FAILED','NOT_CONFIGURED'].includes(detail.callback_state) && detail.status === 'SUCCEEDED'" :loading="acting" @click="act('retry-callback')">重试回传</el-button><el-button v-if="canManageUsers && ['BLOCKED','FAILED','QUEUED'].includes(detail.status)" @click="importText = ''; importDialog = true">导入分析结果</el-button><el-button v-if="canManageUsers && detail.status === 'SUCCEEDED'" @click="importText = ''; importDialog = true">发布补充报告</el-button><el-button v-if="result" @click="download">下载结果 JSON</el-button></div>
        <template v-if="result"><div class="analysis-summary"><span>{{ result.findings?.filter((item: any) => item.countInRisk !== false).length || 0 }} 项风险</span><span v-if="result.testPlan">{{ result.testPlan.coreCaseIds.length }} 个核心场景</span><span v-else>{{ result.cases?.length || 0 }} 条用例</span><span>{{ result.apis?.length || 0 }} 项接口记录（含内部调用）</span></div><el-collapse v-if="result.coverageGaps?.length"><el-collapse-item title="分析覆盖说明（展开查看）" name="coverage"><p v-for="gap in result.coverageGaps" :key="gap">{{ gap }}</p></el-collapse-item></el-collapse><el-tabs v-model="resultTab"><el-tab-pane label="测试重点" name="actions">
<p>{{ result.presentation?.changeSummary || result.changeSummary || result.businessFlow?.summary || '查看本次测试重点' }}</p>
<p>{{ coreScenarios.length }} 个核心场景 · {{ riskItems.length }} 个重点问题 · {{ confirmations.length }} 组待确认</p>
<el-collapse v-if="sharedPreparation.length"><el-collapse-item title="统一准备" name="shared"><p v-for="text in sharedPreparation" :key="text">{{ text }}</p></el-collapse-item></el-collapse>
<h3>核心测试清单</h3><el-empty v-if="!coreScenarios.length" description="本次未提供核心场景，请查看用例明细。" />
<el-collapse><el-collapse-item v-for="(item,index) in coreScenarios" :key="item.id" :title="`${index+1}. ${item.title}`" :name="item.id"><p v-for="check in item.readinessChecks || []" :key="check.id">准备：{{ check.requirement }}</p><ol><li v-for="step in item.steps || []" :key="step">{{ step }}</li></ol><p v-for="expected in item.expectedResults || []" :key="expected">预期：{{ expected }}</p></el-collapse-item></el-collapse>
<h3>重点问题</h3><article v-for="item in riskItems" :key="item.id" class="analysis-item"><b>{{ item.id }} · {{ item.title }}</b><p>{{ item.impact }}</p><p>{{ item.recommendation }}</p></article><p v-if="!riskItems.length">暂无计入本期风险的问题。</p>
<el-collapse><el-collapse-item :title="`待确认事项 · ${confirmations.length} 组`" name="confirmations"><article v-for="item in confirmations" :key="item.id" class="analysis-item"><b>{{ item.question || item.title }}</b><p v-if="item.owner">确认对象：{{ item.owner }}</p><p>{{ item.impact || item.description || item.detail }}</p></article></el-collapse-item></el-collapse>
</el-tab-pane><el-tab-pane label="材料与范围" name="sources"><article v-for="source in result.sources || []" :key="source.id" class="analysis-item"><b>{{ source.title || source.id }}</b><a v-if="source.url && /^https?:\/\//i.test(source.url)" :href="source.url" target="_blank" rel="noreferrer"> 查看原文</a><el-collapse><el-collapse-item title="读取范围与依据" :name="source.id"><p>{{ source.detail }}</p></el-collapse-item></el-collapse></article><article v-for="repo in result.repositorySnapshots || []" :key="repo.projectId" class="analysis-item"><b>{{ repo.projectId }}</b><p>{{ repo.baseRef }} → {{ repo.targetRef }}</p><p>差异文件：{{ repo.changedFileCount ?? repo.changeFileCount ?? '未提供' }}</p></article></el-tab-pane><el-tab-pane v-if="result.businessFlow" label="业务链路" name="flow"><h3>{{ result.businessFlow.title }}</h3><p>{{ result.businessFlow.summary }}</p><article v-for="step in result.businessFlow.steps || []" :key="step.id" class="analysis-item"><b>{{ step.id }} · {{ step.title }}</b><p>{{ step.description }}</p></article><article v-for="branch in result.businessFlow.branches || []" :key="branch.id" class="analysis-item"><b>{{ branch.condition }}</b><p>{{ branch.expectedBehavior }}</p></article></el-tab-pane><el-tab-pane label="分析报告" name="report"><pre class="analysis-report">{{ result.reportMarkdown || '该结果没有 Markdown 摘要，请在其他分类查看结构化内容。' }}</pre></el-tab-pane><el-tab-pane v-for="section in ['findings','cases','apis']" :key="section" :label="sectionLabels[section]" :name="section"><el-select v-if="section === 'findings'" v-model="findingView" aria-label="问题分类"><el-option label="本期重点问题" value="risks"/><el-option label="待确认" value="confirmations"/><el-option label="补充观察" value="observations"/><el-option label="本期不做" value="excluded"/><el-option label="全部记录" value="all"/></el-select><el-switch v-if="section === 'cases'  && coreScenarios.length" v-model="showAllCases" active-text="显示全部覆盖明细" /><template v-if="section === 'apis' && result.apiReviewSummary"><p>新增 {{ result.apiReviewSummary.newOperations }} 项、老入口 {{ result.apiReviewSummary.unchangedOperations }} 项。接口行为随核心场景覆盖，不重复计任务。</p><el-switch v-model="showAllApiDetails" active-text="显示内部调用与按需旧入口" /></template><article v-for="item in analysisSectionItems(section)" :key="item.id" class="analysis-item"><b>{{ item.id }} · {{ item.title || `${item.method} ${item.path}` }}</b><p v-if="section !== 'apis' || !result.apiReviewSummary"><el-tag v-for="action in item.qaActions || []" :key="action" size="small" style="margin-right:6px">{{ qaLabels[action] }}</el-tag>{{ item.actionReason }}</p><template v-if="section === 'apis' && item.changeType"><p><el-tag size="small">{{ apiChangeLabels[item.changeType] }}</el-tag> {{ apiModeLabels[item.executionMode] }}</p><p>{{ item.testReason }}</p><p v-if="item.operationDiscriminator?.name">表单参数 {{ item.operationDiscriminator.name }}={{ item.operationDiscriminator.value }}</p></template><p v-if="item.status === 'OUT_OF_SCOPE'">本期不做 · 不计风险</p><p v-if="item.status === 'NEEDS_CONFIRMATION'">待确认 · 尚不作为已确认缺陷</p><p v-if="item.executionStatus === 'NOT_APPLICABLE'">本期不适用</p><el-collapse v-if="section === 'cases'"><el-collapse-item :title="readinessLabels[item.readinessStatus] || '执行准备尚未评估'" :name="item.id"><p v-if="item.readinessStatus === 'NOT_APPLICABLE'">本期不执行，无需准备。</p><template v-else><p v-if="!item.readinessStatus">旧结果未提供执行准备评估，不能据此判断可以直接执行。</p><p v-if="item.readinessStatus === 'NOT_VERIFIED'">以下是尚未核验的条件，不表示已确认缺失。</p><ul v-if="!item.readinessChecks?.length && item.readinessGaps?.length"><li v-for="gap in item.readinessGaps" :key="gap">{{ gap }}</li></ul><article v-for="check in item.readinessChecks || []" :key="check.id"><b>{{ check.status === 'VERIFIED' ? '已核验' : check.status === 'MISSING' ? '已确认缺项' : check.status === 'NOT_APPLICABLE' ? '不适用' : '尚未核验' }} · {{ preparationCategories[check.category] || '其他准备条件' }}</b><p>{{ check.requirement }}</p><p v-if="check.evidence">核验依据：{{ check.evidence }}</p></article></template></el-collapse-item></el-collapse><el-collapse v-if="section === 'apis' && result.apiReviewSummary"><el-collapse-item title="接口说明与依据（展开查看）" :name="item.id"><pre>{{ item.detail }}</pre></el-collapse-item></el-collapse><pre v-else>{{ item.detail || JSON.stringify(item, null, 2) }}</pre><template v-if="section === 'findings' && item.recommendation"><h4>建议调整</h4><p>{{ item.recommendation }}</p><h4>代码证据 · 固定提交快照</h4><article v-for="(evidence,index) in item.codeEvidence || []" :key="index"><b>{{ evidence.projectId }} · {{ evidence.filePath }}:{{ evidence.startLine }}–{{ evidence.endLine }}</b><p>{{ evidence.commitSha }}</p><pre>{{ evidence.snippet }}</pre><p>{{ evidence.explanation }}</p></article></template></article></el-tab-pane></el-tabs></template>
      </template>
    </el-drawer>
    <el-dialog v-model="createDialog" title="创建分析任务" width="min(780px, 94vw)" class="analysis-create" align-center :close-on-click-modal="false" @closed="stopPreparation">
      <p class="create-intro">读取需求与代码分支，核对后开始分析。</p>
      <el-form label-position="top">
        <section class="create-jira">
          <div class="create-label"><label for="analysis-jira-key">JIRA 单号或链接</label><el-tag v-if="draft.businessGroup" size="small" effect="plain">{{ draft.businessGroup }}</el-tag></div>
          <div class="create-read-row"><el-input id="analysis-jira-key" v-model="draft.requirementKey" :disabled="readBusy" placeholder="例如 APP-9227，或粘贴 JIRA 链接" @keyup.enter="readSelectedSource" /><el-button type="primary" :loading="readBusy" :disabled="!draft.requirementKey.trim() || (readMode === 'browser' && !canManageUsers)" @click="readSelectedSource">{{ readMode === 'browser' ? (browserSession ? '读取材料' : '打开浏览器') : '读取材料' }}</el-button></div>
          <div class="create-read-meta"><el-radio-group v-model="readMode" :disabled="readBusy" size="small" aria-label="读取方式"><el-radio-button value="browser" label="browser">浏览器读取</el-radio-button><el-radio-button value="api" label="api">接口读取</el-radio-button></el-radio-group><el-button v-if="readMode === 'browser' && browserSession" link type="primary" :disabled="readBusy" @click="openJiraBrowser">重新打开</el-button><span v-if="readMode === 'browser'">{{ browserSession ? '在 Chrome 中登录并打开本单，然后读取材料。' : '首次使用需在独立 Chrome 中登录。' }}</span></div>
        </section>
        <el-alert v-if="preparationError" class="create-error" title="材料未能读取" type="error" :closable="false" show-icon><details><summary>查看原因</summary><p>{{ preparationError }}</p></details></el-alert>
        <div v-if="preparationState?.draft" class="create-captured"><span>已读取 · {{ preparationState.draft.summary || draft.requirementKey }}</span><small>核对下方项目与材料，未读取的内容仍需补充。</small></div>
        <details v-if="preparationState?.sources?.length" class="source-status-panel"><summary>材料获取详情</summary><h3>{{ preparationState.draft?.summary || '材料获取情况' }}</h3><div v-for="(source,index) in preparationState.sources" :key="index" class="source-status-row"><div><b>{{ source.title || source.type }}</b><p>{{ source.url }}</p><small v-if="source.type === 'wiki'">{{ source.tableCount || 0 }} 张表格 · {{ source.codeBlockCount || 0 }} 个代码块 · {{ source.imageCount || 0 }} 处图片引用 · {{ source.commentCount || 0 }} 条评论</small></div><el-tag :type="source.status === 'ready' ? 'success' : 'warning'">{{ sourceLabels[source.status] || source.status }}</el-tag><p v-if="source.gaps?.length" class="source-gaps">{{ source.gaps.join('；') }}</p></div><el-alert v-if="preparationState.draft?.discoveryGaps?.length" title="请确认以下内容" type="warning" :closable="false"><p v-for="gap in preparationState.draft.discoveryGaps" :key="gap">{{ gap }}</p></el-alert></details>
        <el-form-item label="补充说明（选填）" class="create-notes"><el-input v-model="draft.changeNotes" type="textarea" :rows="2" maxlength="50000" placeholder="本次重点、需求变更，或已确认不做的内容" /></el-form-item>
        <details class="create-section" :open="repositories.length > 0"><summary>项目与分支 <span>{{ repositories.length ? repositories.length + ' 个项目' : '提测分支与最新 master 对比' }}</span></summary>
        <div class="form-section-title"><h3>项目与分支</h3><el-button text type="primary" @click="addRepo">添加项目</el-button></div>
        <p v-if="!repositories.length" class="form-hint">可先分析需求；有提测代码时添加对应项目及比较分支。</p>
        <div v-for="(repo,index) in repositories" :key="index" class="repo-row"><el-select v-model="repo.projectId" filterable allow-create default-first-option placeholder="项目 ID" aria-label="项目 ID"><el-option v-for="project in availableProjects" :key="project" :label="project" :value="project" /></el-select><span class="repo-baseline" title="分析前同步远程 master，记录实际提交版本">对比最新 master</span><el-input v-model="repo.targetRef" placeholder="提测分支" aria-label="提测分支" /><el-button text type="danger" @click="repositories.splice(index,1)">移除</el-button></div>
        </details>
        <div class="material-organizer"><b>分析依据</b><el-button v-if="materials.length" link type="primary" :loading="browserReading" @click="reparseSnapshot">重新分类当前快照</el-button></div>
        <div v-if="preparationState?.draft?.discoveryGaps?.length" class="classified-gaps"><details><summary>待补充与待确认 · {{ preparationState.draft.discoveryGaps.length }} 项</summary><p v-for="gap in preparationState.draft.discoveryGaps" :key="gap">{{ gap }}</p></details></div>
        <details v-for="category in materialCategories" :key="category.id" class="create-section"><summary>{{ category.title }} <span>{{ category.items.length ? category.items.length + ' 份' : category.empty }}</span></summary>
          <div class="form-section-title"><span class="form-hint">{{ category.hint }}</span><el-button text type="primary" @click="addCategoryMaterial(category.type)">添加</el-button></div>
        <details v-for="material in category.items" :key="material.id" class="material-card"><summary>{{ material.title || '未命名材料' }} <small>{{ material.content.trim() ? '有正文 · 待核对' : '仅链接 · 内容未读取' }}</small></summary>
          <div class="material-head"><el-select v-model="material.type" aria-label="材料类型"><el-option v-for="(label,value) in materialTypes" :key="value" :label="label" :value="value" /></el-select><el-input v-model="material.title" placeholder="材料名称，如订单相关表结构" aria-label="材料名称" /><el-button text type="danger" @click="materials.splice(materials.indexOf(material),1)">移除</el-button></div>
          <el-input v-model="material.url" placeholder="原文或设计稿链接（选填）" aria-label="材料链接" />
          <div v-if="material.url" class="material-upload"><el-button size="small" :loading="documentBusy === material.id" :disabled="!browserSession || !!documentBusy" @click="openLinkedDocument(material)">在浏览器打开</el-button><el-button v-if="openedDocument === material.id" size="small" type="primary" :loading="documentBusy === material.id" @click="captureLinkedDocument(material)">{{ material.type === 'design' ? '采集可见画布' : '读取已加载正文' }}</el-button><small>{{ material.captureNote || '使用本单浏览器会话；登录并浏览文档后读取，设计画布仍需导出图片。' }}</small></div>
          <img v-if="material.imagePreview" :src="material.imagePreview" alt="当前采集的设计画布，请核对覆盖范围" style="display:block;max-width:100%;max-height:240px;object-fit:contain;margin:8px 0" /><el-input v-model="material.content" type="textarea" :rows="3" maxlength="500000" placeholder="粘贴正文、CREATE TABLE / ALTER TABLE，或脱敏样例" aria-label="材料正文" />
          <div class="material-upload"><label :for="`material-file-${material.id}`">读取文本文件</label><input :id="`material-file-${material.id}`" type="file" accept=".sql,.txt,.md,.json,.csv,.html,.xml" @change="readMaterial($event,material)" /><small>SQL / TXT / MD / JSON / CSV / HTML / XML，单份最多 500KB。Word、Excel、图片请先转换成文本或提供可访问链接。</small></div>
        </details>
          <p v-if="!category.items.length" class="form-hint">{{ category.empty }}</p>
        </details>
        <details v-if="commentMaterials.length" class="create-section comment-review"><summary>来源评论 <span>{{ commentMaterials.length }} 条 · {{ activeMaterials.filter(isComment).length }} 条参与分析</span></summary><p class="form-hint">仅展示额外补充内容，重复通知已隐藏；业务规则仍需确认。</p><article v-for="comment in commentMaterials" :key="comment.id" class="comment-review-row"><div class="comment-review-top"><b>{{ comment.title }}</b><el-select v-model="comment.reviewStatus" aria-label="评论处理方式" @change="updateCommentDecision(comment)"><el-option v-for="(label,value) in commentStatusLabels" :key="value" :value="value" :label="label" /></el-select></div><p>{{ comment.reviewReason || '原始评论，当前有效性待核对。' }}</p><small>{{ activeMaterials.includes(comment) ? '作为补充依据提交，不视为已确认需求' : '不提交原文；标为不参与或被替代时，其派生材料也不提交' }}</small><details><summary>查看原文</summary><pre>{{ comment.content }}</pre></details></article></details>
        <el-collapse class="create-advanced"><el-collapse-item title="高级选项" name="versions"><div class="form-grid"><el-form-item label="材料版本"><el-input v-model="draft.materialVersion" placeholder="本次材料快照版本" /></el-form-item><el-form-item label="上一份已完成分析（选填）"><el-select v-model="draft.previousJobId" clearable placeholder="仅显示当前业务组和单号的结果"><el-option v-for="row in previousJobs" :key="row.id" :value="row.id" :label="`${row.materialVersion} · ${when(row.updated_at)}`" /></el-select></el-form-item></div><p class="form-hint">版本和请求 ID 自动生成。重复提交复用同一请求 ID；材料变化请创建新任务。未受影响的执行记录由 TestForge 合并保留。</p></el-collapse-item></el-collapse>
      </el-form>
      <template #footer><div class="create-footer"><span>{{ repositories.length }} 个项目 · {{ activeMaterials.filter(m=>!isComment(m)).length }} 份材料<span v-if="commentMaterials.length"> · {{ activeMaterials.filter(isComment).length }} 条补充评论</span></span><div><el-button @click="createDialog = false">取消</el-button><el-button type="primary" :loading="acting" :disabled="readBusy || (!draft.changeNotes.trim() && !activeMaterials.length && !repositories.length)" @click="create">开始分析</el-button></div></div></template>
    </el-dialog>
    <el-dialog v-model="importDialog" title="导入已完成的分析结果" width="min(650px, 94vw)"><el-alert title="结果标为人工导入并通知对方；补充已完成报告会生成关联的新任务，原报告保留。" type="warning" :closable="false" /><input type="file" accept=".json,application/json" aria-label="选择分析结果 JSON 文件" @change="loadImportFile" style="margin-top:12px" /><el-input v-model="importText" type="textarea" :rows="14" placeholder="粘贴符合结果契约的 JSON 对象" style="margin-top:12px" /><template #footer><el-button @click="importDialog = false">取消</el-button><el-button type="primary" :loading="acting" @click="importResult">校验并导入</el-button></template></el-dialog>
    <el-dialog v-model="help" title="TestForge 接入" width="min(650px, 94vw)"><p>后端上下文为 /api。机器调用使用已配置的 X-API-Key，不使用浏览器登录 Token。</p><pre class="analysis-report">POST /api/open/v1/analysis-jobs
POST /api/open/v1/analysis-jobs/prepare
GET  /api/open/v1/analysis-jobs/preparations/{id}
GET  /api/open/v1/analysis-jobs/{id}
GET  /api/open/v1/analysis-jobs/{id}/result
POST /api/open/v1/analysis-jobs/{id}/cancel</pre><p>TestForge 完成签名回调接收和报告导入后，结果才能自动出现在 TestForge 页面；本模块不会直接修改它的数据库。</p><p>请查看后端 docs/ANALYSIS_BRIDGE.md，配置调用方、Codex、仓库映射和固定回调地址。缺少 Figma 或仓库权限时必须保留覆盖缺口。</p><p v-if="config">已配置项目：{{ config.repositoryProjects?.join('、') || '无' }}；已配置回调调用方：{{ config.callbackClients?.join('、') || '无' }}。</p></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'
import { canWrite, canManageUsers } from '../stores/auth'
const rows = ref<any[]>([]), config = ref<any>(null), detail = ref<any>(null), result = ref<any>(null)
const loading = ref(false), acting = ref(false), error = ref(''), keyword = ref(''), status = ref(''), drawer = ref(false), help = ref(false), createDialog = ref(false), importDialog = ref(false), importText = ref(''), resultTab = ref('actions')
const draft = ref({ businessGroup:'', requirementKey:'', externalId:'', changeNotes:'', materialVersion:'', previousJobId:'' })
watch(() => draft.value.requirementKey, (value) => {
  const match = value.trim().toUpperCase().match(/(?:^|\/)(APP|PVP|WEB|ESPORTS)-\d+(?:[?#].*)?$/)
  draft.value.businessGroup = match?.[1] || ''
})
const repositories = ref<{projectId:string; baseRef:string; targetRef:string}[]>([])
interface Material { id:string; type:string; title:string; url:string; content:string; sourceKind?:string; sourceId?:string; reviewStatus?:string; reviewReason?:string; analysisIncluded?:boolean; confirmation?:string; browserCaptureId?:string; imagePreview?:string; captureNote?:string; captureStatus?:string; capturedAt?:string }
const materials = ref<Material[]>([])
const materialTypes: Record<string,string> = { requirement:'需求文档', design:'设计稿与交互', schema:'数据库表结构', migration:'数据库变更 SQL', sampleData:'脱敏样例数据', apiSpec:'接口定义', configuration:'配置与依赖', changeNote:'需求变更说明' }
const availableProjects = computed(() => (config.value?.repositoryProjects || []).filter((project:string) => {
 const group=config.value?.repositoryGroups?.[project]
 return !group || group === 'SHARED' || group === draft.value.businessGroup
}))
const commentStatusLabels: Record<string,string> = { ADOPTED:'采用为补充依据', PENDING_CONFIRMATION:'待确认', DUPLICATE:'重复信息', SUPERSEDED:'已被替代', EXCLUDED:'不参与分析' }
function isComment(m:Material){return m.sourceKind === 'JIRA_COMMENT' || (m.id.startsWith('jira-comment-') && !m.sourceId)}
const commentMaterials = computed(() => materials.value.filter(m => isComment(m) && m.reviewStatus !== 'DUPLICATE'))
const activeMaterials = computed(() => materials.value.filter(m => {
 if(['EXCLUDED','SUPERSEDED'].includes(m.reviewStatus || ''))return false
 if(isComment(m))return m.analysisIncluded !== false && !['DUPLICATE'].includes(m.reviewStatus || '')
 const parent=materials.value.find(p=>p.id===m.sourceId)
 return !parent || !['EXCLUDED','SUPERSEDED'].includes(parent.reviewStatus || '')
}))
function updateCommentDecision(m:Material){m.analysisIncluded=['ADOPTED','PENDING_CONFIRMATION'].includes(m.reviewStatus || 'PENDING_CONFIRMATION')}
const materialCategories = computed(() => {
 const groups=[
  {id:'requirement',title:'需求文档',type:'requirement',empty:'未获取独立需求文档',hint:'产品需求与验收依据；评论不等于已确认需求。',items:[] as Material[]},
  {id:'design',title:'设计稿',type:'design',empty:'未发现设计稿',hint:'Figma、蓝湖等设计；仅发现链接不代表读到内容。',items:[] as Material[]},
  {id:'database',title:'数据库',type:'migration',empty:'未发现数据库材料',hint:'表结构、变更SQL及只读查询参考，不执行SQL。',items:[] as Material[]},
  {id:'configuration',title:'配置与依赖',type:'configuration',empty:'未发现配置材料',hint:'本次相关的配置；备注值不代表环境生效值。',items:[] as Material[]},
  {id:'supplement',title:'评论与补充依据',type:'changeNote',empty:'无补充依据',hint:'保留原始评论用于追溯，开发或AI建议需要确认。',items:[] as Material[]},
 ]
 for(const m of activeMaterials.value.filter(m=>!isComment(m))){const id=m.type==='design'?'design':m.type==='requirement'?'requirement':['migration','schema','sampleData'].includes(m.type)||m.id.includes('-db-query')?'database':m.type==='configuration'?'configuration':'supplement';groups.find(g=>g.id===id)!.items.push(m)}
 return groups
})
function addCategoryMaterial(type:string){materials.value.push({id:newId(),type,title:'',url:'',content:''})}
async function reparseSnapshot(){
 browserReading.value=true
 try{const state=await apiClient.reparseAnalysisBrowser({requirementKey:draft.value.requirementKey,summary:preparationState.value?.draft?.summary,materials:materials.value.filter(m=>!m.id.match(/-(db-change|db-query|configuration)$/))});const data=state.draft;preparationState.value=state;preparationId.value='';draft.value.materialVersion=data.materialVersion;repositories.value=data.repositories||[];materials.value=(data.materials||[]).map((m:any)=>({...m,url:m.url||'',content:m.content||''}));ElMessage.success('已重新分类，请核对项目映射、基线及材料来源')}catch(e:any){preparationError.value=e.message}finally{browserReading.value=false}
}
const previousJobs = computed(() => rows.value.filter(row => row.status === 'SUCCEEDED' && row.businessGroup === draft.value.businessGroup && row.requirement_key === draft.value.requirementKey.trim().toUpperCase()))
const preparationState = ref<any>(null), preparationError = ref(''), preparing = ref(false), preparationId = ref('')
const sourceLabels: Record<string,string> = { ready:'已获取', partial:'部分获取', failed:'获取失败', listed:'待获取' }
const readMode = ref('browser')
const readBusy = computed(() => preparing.value || browserOpening.value || browserReading.value || !!documentBusy.value)
function readSelectedSource() { if(readBusy.value)return; if(readMode.value === 'api')void prepareFromJira(); else if(browserSession.value)void captureJiraBrowser(); else void openJiraBrowser() }
const documentBusy=ref(''), openedDocument=ref('')
async function openLinkedDocument(material:Material){
 documentBusy.value=material.id
 try{await apiClient.openAnalysisDocument({sessionId:browserSession.value,requirementKey:draft.value.requirementKey,materialId:material.id,url:material.url});openedDocument.value=material.id;ElMessage.success('请在浏览器登录并浏览文档，再读取已加载正文')}catch(e:any){ElMessage.error(e.message)}finally{documentBusy.value=''}
}
async function captureLinkedDocument(material:Material){
 if(material.content.trim()){try{await ElMessageBox.confirm('将替换这份材料的正文，是否继续？','更新正文')}catch{return}}
 documentBusy.value=material.id
 try{const data=await apiClient.captureAnalysisDocument({sessionId:browserSession.value,requirementKey:draft.value.requirementKey,materialId:material.id});material.content=data.content;material.browserCaptureId=data.browserCaptureId;material.imagePreview=data.imagePreview;material.captureNote=data.captureNote;material.captureStatus=data.captureStatus;material.capturedAt=data.capturedAt;preparationId.value='';ElMessage.success(data.browserCaptureId?'已采集画布，请核对截图覆盖范围':'已读取可见文字；请核对章节和图片缺口')}catch(e:any){ElMessage.error(e.message)}finally{documentBusy.value=''}
}
const browserSession = ref(''), browserOpening = ref(false), browserReading = ref(false)
async function openJiraBrowser() {
  const requirementKey=draft.value.requirementKey.trim()
  if(!requirementKey)return ElMessage.warning('请先填写 JIRA 单号')
  browserOpening.value=true;browserSession.value='';preparationError.value=''
  try {
    const state=await apiClient.openAnalysisBrowser({requirementKey})
    browserSession.value=state.sessionId
    ElMessage.success('已打开独立 Chrome，请登录并进入当前 JIRA 后点击读取')
  }catch(e:any){preparationError.value=e.message || '浏览器打开失败'}finally{browserOpening.value=false}
}
async function captureJiraBrowser() {
  if(draft.value.changeNotes.trim() || repositories.value.length || materials.value.length) {
    try{await ElMessageBox.confirm('读取结果会替换当前项目与材料，补充说明保留。是否继续？','更新材料',{type:'warning'})}catch{return}
  }
  browserReading.value=true;preparationError.value=''
  try {
    const state=await apiClient.captureAnalysisBrowser({sessionId:browserSession.value,requirementKey:draft.value.requirementKey.trim()})
    const data=state.draft
    preparationId.value='';preparationState.value=state
    draft.value.requirementKey=data.requirementKey;draft.value.businessGroup=data.businessGroup;draft.value.materialVersion=data.materialVersion
    repositories.value=(data.repositories||[]).map((r:any)=>({projectId:r.projectId,baseRef:r.baseRef,targetRef:r.targetRef}))
    materials.value=(data.materials||[]).map((m:any)=>({...m,url:m.url||'',content:m.content||''}))

    ElMessage.success('已读取可见 JIRA 内容；关联文档和附件仍需补充，请核对后提交')
  }catch(e:any){preparationError.value=e.message || '浏览器读取失败'}finally{browserReading.value=false}
}
let preparationTimer: ReturnType<typeof setTimeout> | undefined
function stopPreparation() { if(preparationTimer)clearTimeout(preparationTimer); preparationTimer=undefined; preparing.value=false }
async function prepareFromJira() {
  const raw=draft.value.requirementKey.trim();if(!raw)return ElMessage.warning('请填写 JIRA 单号')
  stopPreparation();preparationId.value='';preparationState.value=null;preparationError.value='';preparing.value=true
  try {
    const state=await apiClient.prepareAnalysisFromJira({requirementKey:raw,...(draft.value.businessGroup?{businessGroup:draft.value.businessGroup}:{})})
    preparationState.value=state; await pollPreparation(state.id)
  }catch(e:any){preparationError.value=e.message || '读取失败';preparing.value=false}
}
async function pollPreparation(id:string) {
  if(!createDialog.value || preparationState.value?.id!==id)return
  try {
    const state=await apiClient.analysisPreparation(id);if(preparationState.value?.id!==id || !createDialog.value)return
    preparationState.value=state
    if(state.status==='PREPARING'){preparationTimer=setTimeout(()=>void pollPreparation(id),2000);return}
    preparing.value=false
    if(state.status!=='READY'){preparationError.value=state.error || '材料获取失败';return}
    const data=state.draft
    draft.value.requirementKey=data.requirementKey;draft.value.businessGroup=data.businessGroup;draft.value.materialVersion=data.materialVersion
    repositories.value=(data.repositories||[]).map((r:any)=>({projectId:r.projectId,baseRef:r.baseRef,targetRef:r.targetRef}))
    materials.value=(data.materials||[]).map((m:any)=>({...m,url:m.url||'',content:m.content||''}))
    preparationId.value=state.id
    ElMessage.success('已读取本单材料，请核对项目、分支和获取缺口')
  }catch(e:any){preparationError.value=e.message || '读取状态失败';preparing.value=false}
}
function newId() { return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}` }
function addRepo() { repositories.value.push({projectId:'',baseRef:'master',targetRef:''}) }
function addMaterial() { materials.value.push({id:newId(),type:'requirement',title:'',url:'',content:''}) }
async function readMaterial(event:Event, material:Material) {
  const input=event.target as HTMLInputElement, file=input.files?.[0]; if(!file)return
  try { if(file.size>500000 || !/\.(sql|txt|md|json|csv|html|xml)$/i.test(file.name))throw new Error('请选择不超过 500KB 的受支持文本文件')
    const text=await file.text(); if(text.includes('\u0000'))throw new Error('该文件不是可读取的文本，请转换后提供')
    material.content=text; if(!material.title)material.title=file.name
  } catch(e:any){ElMessage.error(e.message || '文件读取失败')} finally{input.value=''}
}
const states: Record<string,string> = { QUEUED: '等待分析', RUNNING: '分析中', SUCCEEDED: '分析完成', BLOCKED: '缺少执行条件', FAILED: '分析失败', CANCELLED: '已取消' }
const callbackLabels: Record<string,string> = { NONE: '尚无结果', PENDING: '等待回传', DELIVERED: '已回传', FAILED: '回传失败', NOT_CONFIGURED: '未配置回调' }
const showAllApiDetails = ref(false)
const showAllCases = ref(false)
const findingView = ref('risks')
const coreScenarios = computed(() => {
 const list=result.value?.cases || []
 const ids=result.value?.presentation?.coreCaseIds || result.value?.testPlan?.coreCaseIds || list.filter((c:any)=>c.executionRole==='CORE_SCENARIO').map((c:any)=>c.id)
 return ids.map((id:string)=>list.find((c:any)=>c.id===id)).filter(Boolean)
})
const riskItems = computed(() => (result.value?.findings || []).filter((f:any)=>f.countInRisk!==false && !['OUT_OF_SCOPE','NEEDS_CONFIRMATION'].includes(f.status)))
const confirmations = computed(() => result.value?.presentation?.confirmations || result.value?.testPlan?.scopeConfirmations || result.value?.requirementQuestions || [])
const sharedPreparation = computed(() => {
 const raw=result.value?.testPlan?.sharedPreparation
 return Array.isArray(raw)?raw.map((i:any)=>typeof i==='string'?i:i.requirement || i.title):(raw?.items || [])
})
const apiChangeLabels: Record<string,string> = { NEW:'本次新增', MODIFIED:'本次修改', UNCHANGED:'老入口未改动' }
const apiModeLabels: Record<string,string> = { DIRECT_API_RECOMMENDED:'建议针对性直测', INTERNAL_CHAIN_ONLY:'内部调用 · 随链路覆盖', VIA_CORE_SCENARIO:'随核心场景覆盖', CONDITIONAL_BUSINESS_SCENARIO:'有样例时验证', OPTIONAL_REGRESSION:'按需回归' }
function analysisSectionItems(section:string) {
  const items=result.value?.[section] || []
  if(section === 'findings')return items.filter((f:any)=>findingView.value==='all' || (findingView.value==='risks' ? f.countInRisk!==false && !['OUT_OF_SCOPE','NEEDS_CONFIRMATION'].includes(f.status) : findingView.value==='confirmations' ? f.status==='NEEDS_CONFIRMATION' : findingView.value==='excluded' ? f.status==='OUT_OF_SCOPE' : f.countInRisk===false && !['OUT_OF_SCOPE','NEEDS_CONFIRMATION'].includes(f.status)))
  if(section === 'cases' && !showAllCases.value && coreScenarios.value.length)return coreScenarios.value
  if(section !== 'apis' || showAllApiDetails.value || !result.value?.apiReviewSummary)return items
  return items.filter((item:any) => item.defaultVisible)
}
const qaFilter = ref('IMPORTANT')
const qaSection = ref('cases')
const preparationCategories: Record<string,string> = { DEPLOYMENT:'测试环境与提测版本', CLIENT:'客户端准备', AUTH:'登录与签名', PERMISSION:'后台权限', SCENARIO_DATA:'本用例专用数据', FEEDBACK_IDENTITY:'反馈归属与状态', DATABASE_OBSERVATION:'数据库核对条件', UPLOAD_OBSERVATION:'上传及附件核对', CONTROLLED_SETUP:'受控场景准备', RULE_CONFIRMATION:'需求或机制确认', CACHE_OBSERVATION:'相关缓存核对' }
const readinessLabels: Record<string,string> = { NOT_VERIFIED:'执行准备尚未核验', READY:'执行准备已核验', BLOCKED:'执行准备存在已确认缺项', NOT_APPLICABLE:'本期不适用' }
const qaLabels: Record<string,string> = { MUST_TEST:'必测', MUST_CONFIRM:'必确认', MUST_READ:'必看', OPTIONAL:'按需回归' }
const qaEntries = computed(() => ['findings','cases','apis'].flatMap(section => (result.value?.[section] || []).map((item:any) => ({ ...item, section }))))
const qaVisible = computed(() => qaEntries.value.filter((item:any) => item.section === qaSection.value && item.executionStatus !== 'NOT_APPLICABLE' && (qaFilter.value === 'ALL' || qaFilter.value === 'IMPORTANT' && item.qaActions?.some((action:string) => action !== 'OPTIONAL') || item.qaActions?.includes(qaFilter.value))))
const sectionLabels: Record<string,string> = { findings: '问题与风险', cases: '用例明细', apis: '待测接口' }
const filtered = computed(() => rows.value.filter(r => (!status.value || r.status === status.value) && `${r.businessGroup} ${r.requirement_key} ${r.external_id} ${r.client}`.toLowerCase().includes(keyword.value.toLowerCase())))
const when = (v: string) => v ? new Date(v).toLocaleString() : '—'
const stateType = (s: string) => s === 'SUCCEEDED' ? 'success' : s === 'FAILED' ? 'danger' : s === 'BLOCKED' ? 'warning' : 'info'
const analysisStageLabels:Record<string,string>={MODEL_CONNECTED:'模型已连接',ANALYZING:'正在分析',READING_EVIDENCE:'正在读取代码和材料',VALIDATING_RESULT:'正在校验报告'}
const errorLabel = (code: string) => ({ MODEL_QUOTA_EXCEEDED:'模型额度不足；恢复额度后点击重新分析，任务不会自动续跑。', MODEL_AUTH_REQUIRED:'执行端模型登录已失效，请在Mac重新登录后重试。', EXECUTOR_DISABLED: 'Codex 执行端未启用，请按接入说明配置后重新分析。', REPOSITORY_NOT_CONFIGURED: '项目未映射到服务端仓库目录。', LATEST_MASTER_UNAVAILABLE: '无法更新最新 master，请检查公司网络或仓库权限后重试；未使用旧基线生成报告。', WORKER_SCRIPT_MISSING: '找不到分析执行脚本。', REPOSITORY_UNAVAILABLE: '配置的仓库目录不可用。', EXECUTOR_FAILED_CHECK_LOCAL_CONFIGURATION: '执行端失败，请检查 SDK、模型登录和本地任务日志；未生成有效结果。', WORKER_INTERRUPTED: '执行端中断，请确认后手动重试。', ANALYSIS_TIMEOUT: '分析超时，未将不完整结果发布。' } as Record<string,string>)[code] || code
async function load() { loading.value = true; error.value = ''; try { const [list, settings] = await Promise.all([apiClient.listAnalysisJobs(), apiClient.analysisJobConfig()]); rows.value = list; config.value = settings } catch(e:any) { error.value = e.message || '读取失败' } finally { loading.value = false } }
async function showDetail(row:any) { detail.value = row; result.value = null; resultTab.value = 'actions'; drawer.value = true; await refreshDetail() }
async function refreshDetail() { if (!detail.value) return; try { const id = detail.value.id; const d = await apiClient.getAnalysisJob(id); if (detail.value?.id !== id) return; detail.value = d; if(d.status === 'SUCCEEDED') result.value = await apiClient.getAnalysisResult(id) } catch(e:any) { ElMessage.error(e.message || '读取失败') } }
async function act(action:string) { if(!detail.value) return; if(action === 'retry') { try { await ElMessageBox.confirm('重新分析会调用已启用的模型执行端，可能产生模型费用。是否继续？','重新分析') } catch { return } } acting.value = true; try { const actionResult=await apiClient.analysisJobAction(detail.value.id,action); if(actionResult?.id)detail.value=actionResult; await refreshDetail(); await load() } catch(e:any) { ElMessage.error(e.message) } finally { acting.value = false } }
function newTask() { browserSession.value=''; stopPreparation(); const version=`snapshot-${Date.now()}`; draft.value = { businessGroup:'', requirementKey:'', externalId:newId(), changeNotes:'', materialVersion:version, previousJobId:'' }; repositories.value=[]; materials.value=[]; preparationId.value=''; preparationState.value=null; preparationError.value=''; createDialog.value=true }
async function create() {
  if(documentBusy.value)return ElMessage.warning('请等待文档读取完成')
  if(!/^[A-Z][A-Z0-9_]*-\d+$/.test(draft.value.requirementKey.trim().toUpperCase()))return ElMessage.warning('请填写正确的 JIRA 单号')
  if(!['APP','WEB','PVP','ESPORTS'].includes(draft.value.businessGroup))return ElMessage.warning('无法从单号识别业务组，请填写 APP、PVP、WEB 或 ESPORTS 单号')
  if(!draft.value.materialVersion.trim())return ElMessage.warning('请填写材料版本')
  if(repositories.value.some(r=>!r.projectId.trim() || !r.targetRef.trim()))return ElMessage.warning('请补全项目和提测分支')
  if(activeMaterials.value.some(m=>!m.title.trim() || (!m.content.trim() && !m.url.trim())))return ElMessage.warning('每份材料需要名称，以及正文或链接')
  if(!draft.value.changeNotes.trim() && !activeMaterials.value.length && !repositories.value.length)return ElMessage.warning('请至少提供需求说明、材料或项目代码')
  const unread=activeMaterials.value.filter(m=>['requirement','design'].includes(m.type)&&!m.content.trim())
  if(unread.length){try{await ElMessageBox.confirm(`还有 ${unread.length} 份需求或设计只有链接。继续后只能生成受限分析，不能视为完整需求验收。是否继续？`,'材料尚未读全',{type:'warning',confirmButtonText:'继续受限分析',cancelButtonText:'先补齐材料'})}catch{return}}
  acting.value=true
  try {
    const {previousJobId,...fields}=draft.value
    const payload={...fields,requirementKey:fields.requirementKey.trim().toUpperCase(),contractVersion:'2',...(preparationId.value?{preparationId:preparationId.value}:{}),...(previousJobId?{previousJobId}:{}),repositories:repositories.value.map(r=>({projectId:r.projectId.trim(),baseRef:'master',targetRef:r.targetRef.trim()})),materials:activeMaterials.value.map(m=>({...(m.reviewStatus?{reviewStatus:m.reviewStatus,reviewReason:m.reviewReason,confirmation:m.confirmation || '评论仅作补充依据，未确认的规则不能当成产品已确认需求'}:{}),...(m.sourceId?{sourceId:m.sourceId}:{}),...(m.browserCaptureId?{browserCaptureId:m.browserCaptureId}:{}),...(m.captureNote?{captureNote:m.captureNote,captureStatus:m.captureStatus,capturedAt:m.capturedAt}:{}),id:m.id,type:m.type,title:m.title.trim(),...(m.url.trim()?{url:m.url.trim()}:{}),...(m.content.trim()?{content:m.content}: {})}))}
    if(new TextEncoder().encode(JSON.stringify(payload)).length>2000000)throw new Error('材料合计超过 2MB，请精简为本单相关内容')
    const data=await apiClient.createAnalysisJob(payload); createDialog.value=false; await load(); await showDetail(data)
  } catch(e:any){ElMessage.error(e.message || '创建失败')} finally{acting.value=false}
}
async function loadImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('结果文件不能超过 8MB')
    const text = await file.text()
    const value = JSON.parse(text)
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('请选择 JSON 对象文件')
    if (value.requirementKey !== detail.value?.requirement_key) throw new Error('文件中的需求单号与当前任务不一致')
    importText.value = text
    ElMessage.success('文件已读取，请核对后点击校验并导入')
  } catch (e: any) { ElMessage.error(e.message || '读取结果文件失败') }
  finally { input.value = '' }
}
async function importResult() { if(!detail.value) return; acting.value = true; try { const value = JSON.parse(importText.value); const published = detail.value.status === 'SUCCEEDED' ? await apiClient.publishAnalysisRevision(detail.value.id, value) : await apiClient.importAnalysisResult(detail.value.id, value); if (published?.id) detail.value = published; importDialog.value = false; await refreshDetail(); await load() } catch(e:any) { ElMessage.error(e.message || '导入失败') } finally { acting.value = false } }
function download() { if(!result.value) return; const url = URL.createObjectURL(new Blob([JSON.stringify(result.value,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href=url;a.download=`${detail.value.requirement_key}-analysis.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000) }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { void load(); timer=setInterval(() => { if(!document.hidden && !acting.value) { void load(); if(drawer.value && ['RUNNING','QUEUED'].includes(detail.value?.status)) void refreshDetail() } },10000) })
onUnmounted(() => { if(timer)clearInterval(timer);stopPreparation() })
</script>
<style scoped>
.analysis-tasks{padding:24px;min-width:0;color:var(--el-text-color-primary)}.analysis-header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:20px}.analysis-header h1{font-size:24px;margin:0 0 8px}.analysis-header p{margin:0;color:var(--el-text-color-secondary);font-size:13px}.analysis-toolbar{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.analysis-toolbar>.el-input{max-width:340px}.analysis-toolbar>.el-select{width:160px}.analysis-detail-actions{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.analysis-detail-actions .el-button{margin-left:0}.analysis-summary{display:flex;gap:20px;padding:16px 0;font-weight:600}.analysis-report,.analysis-item pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.8}.analysis-item{border-bottom:1px solid var(--el-border-color-lighter);padding:16px 0}.analysis-item pre{font-size:13px;color:var(--el-text-color-regular)}@media(max-width:800px){.analysis-tasks{padding:16px}.analysis-header{align-items:flex-start}.analysis-toolbar>.el-input{max-width:100%}}
:deep(.analysis-create .el-dialog__body){max-height:65vh;overflow-y:auto}.form-hint{color:var(--el-text-color-secondary);font-size:13px;line-height:1.7;margin:0 0 16px}.form-grid{display:grid;grid-template-columns:1fr 2fr;gap:16px}.form-grid .el-select{width:100%}.form-section-title{display:flex;align-items:center;justify-content:space-between;margin-top:12px}.form-section-title h3{font-size:15px;margin:12px 0}.form-section-title small{font-weight:400;color:var(--el-text-color-secondary)}.repo-row{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:8px;margin-bottom:12px}.material-card{padding:14px;border:1px solid var(--el-border-color);border-radius:8px;margin:0 0 12px;display:grid;gap:10px}.material-head{display:grid;grid-template-columns:180px 1fr auto;gap:8px}.material-upload{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.material-upload label{color:var(--el-color-primary);font-size:13px}.material-upload input{max-width:220px;font-size:12px}.material-upload small{color:var(--el-text-color-secondary);line-height:1.6}@media(max-width:650px){.form-grid,.repo-row,.material-head{grid-template-columns:1fr}}
.jira-read-actions{display:flex;align-items:center;gap:14px;margin-bottom:20px}.jira-read-actions .form-hint{margin:0}.source-status-panel{border:1px solid var(--el-border-color);border-radius:8px;padding:16px;margin:16px 0}.source-status-panel h3{margin:0 0 12px;font-size:15px}.source-status-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px 0;border-top:1px solid var(--el-border-color-lighter)}.source-status-row p{font-size:12px;color:var(--el-text-color-secondary);overflow-wrap:anywhere;margin:6px 0}.source-status-row small{color:var(--el-text-color-secondary)}.source-gaps{grid-column:1/-1}
</style>

<style scoped>
.create-intro{font-size:13px;color:var(--el-text-color-secondary);margin:0 0 20px;line-height:1.6}
.create-jira{padding:18px;background:var(--el-fill-color-light);border:1px solid var(--el-border-color-lighter);border-radius:10px;margin-bottom:20px}
.create-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:13px;font-weight:600}
.create-read-row{display:flex;gap:10px}.create-read-row>.el-input{flex:1;min-width:0}.create-read-row>.el-button{margin:0;min-width:106px}
.create-read-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px}.create-read-meta>span{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}
.create-error{margin-bottom:18px}.create-error details{font-size:12px}.create-error summary{cursor:pointer}.create-error p{overflow-wrap:anywhere;line-height:1.6}
.create-captured{display:grid;gap:5px;margin-bottom:18px;font-size:13px}.create-captured small{font-size:12px;color:var(--el-text-color-secondary)}
.create-section{border-top:1px solid var(--el-border-color-lighter);padding:16px 0}.create-section>summary{cursor:pointer;font-size:14px;font-weight:600;line-height:1.7}.create-section>summary>span{font-size:12px;font-weight:400;color:var(--el-text-color-secondary);margin-left:10px}
.create-section .form-hint{font-size:12px}.create-section .material-card:last-child{margin-bottom:0}.create-advanced{border-top:1px solid var(--el-border-color-lighter);border-bottom:0}
.create-footer{display:flex;justify-content:space-between;align-items:center;gap:12px}.create-footer>span{font-size:12px;color:var(--el-text-color-secondary)}.create-footer>div{display:flex;gap:8px}.create-footer .el-button{margin:0}
@media(max-width:600px){.create-read-row{flex-direction:column}.create-footer{flex-wrap:wrap}.create-section>summary>span{display:block;margin-left:16px}}
</style>

<style scoped>
.material-organizer{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--el-border-color-lighter);font-size:14px}
.material-card>summary{cursor:pointer;font-weight:500;font-size:13px;line-height:1.8;overflow-wrap:anywhere}.material-card>summary small{display:block;color:var(--el-text-color-secondary);font-size:12px;font-weight:400}.material-card[open]>summary{margin-bottom:10px}
.classified-gaps{padding:12px;background:var(--el-color-warning-light-9);color:var(--el-text-color-regular);font-size:12px;border-radius:6px;margin-bottom:12px}.classified-gaps summary{cursor:pointer}.classified-gaps p{margin:10px 0 0;line-height:1.7}
</style>

<style scoped>
.comment-review-row{padding:14px 0;border-bottom:1px solid var(--el-border-color-lighter)}.comment-review-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px}.comment-review-top .el-select{width:180px;flex-shrink:0}.comment-review-row p,.comment-review-row small{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}.comment-review-row details{margin-top:10px;font-size:12px}.comment-review-row summary{cursor:pointer;color:var(--el-color-primary)}.comment-review-row pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;line-height:1.8;background:var(--el-fill-color-light);padding:12px}.comment-review-top b{font-weight:500}@media(max-width:600px){.comment-review-top{align-items:flex-start;flex-direction:column}}
</style>

<style scoped>
.repo-baseline{display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid var(--el-border-color-lighter);border-radius:4px;background:var(--el-fill-color-light);color:var(--el-text-color-secondary);font-size:12px;min-height:32px}
</style>
