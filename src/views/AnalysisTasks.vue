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
      <template v-if="detail"><h2>{{ detail.requirement_key }}</h2><el-descriptions :column="1" border><el-descriptions-item label="业务组 / 材料版本">{{ detail.businessGroup }} / {{ detail.materialVersion }}</el-descriptions-item><el-descriptions-item label="状态">{{ states[detail.status] || detail.status }}</el-descriptions-item><el-descriptions-item label="外部请求 ID">{{ detail.external_id }}</el-descriptions-item><el-descriptions-item label="来源">{{ detail.client }}</el-descriptions-item><el-descriptions-item label="结果来源">{{ detail.result_source === 'manual' ? '人工导入（非执行端自动分析）' : detail.result_source === 'codex' ? 'Codex 执行端' : '尚无结果' }}</el-descriptions-item><el-descriptions-item label="回传">{{ callbackLabels[detail.callback_state] || detail.callback_state }} · 已尝试 {{ detail.callback_attempts }} 次</el-descriptions-item></el-descriptions>
        <el-collapse v-if="detail.analysisInput"><el-collapse-item title="本单分析范围与材料" name="scope"><p v-for="repo in detail.analysisInput.repositories || []" :key="repo.projectId + repo.targetRef">{{ repo.projectId }}：{{ repo.baseRef }} → {{ repo.targetRef }}</p><article v-for="material in detail.analysisInput.materials || []" :key="material.id" class="analysis-item"><b>{{ materialTypes[material.type] || material.type }} · {{ material.title }}</b><p>{{ material.url }}</p><pre>{{ material.content }}</pre></article><pre class="analysis-report">{{ detail.analysisInput.changeNotes }}</pre></el-collapse-item></el-collapse>
        <el-alert v-if="detail.error_code" :title="errorLabel(detail.error_code)" type="warning" :closable="false" style="margin-top:16px" />
        <el-alert v-if="detail.status === 'SUCCEEDED' && detail.callback_state !== 'DELIVERED'" :title="detail.callback_state === 'NOT_CONFIGURED' ? '报告已保存，等待配置通知地址' : '报告已保存，等待通知对方平台'" :description="detail.callback_http_status ? `对方接口返回 HTTP ${detail.callback_http_status}；不影响报告查询，可仅重试回传。` : detail.callback_attempts > 0 ? '通知暂未送达，请检查接收服务和网络；对方仍可主动获取报告。' : '对方可主动获取报告，无需重新分析。'" type="info" :closable="false" style="margin-top:12px" />
        <div class="analysis-detail-actions"><el-button @click="refreshDetail">刷新详情</el-button><el-button v-if="canWrite && ['BLOCKED','FAILED'].includes(detail.status)" :loading="acting" @click="act('retry')">重新分析</el-button><el-button v-if="canWrite && ['BLOCKED','QUEUED','RUNNING','FAILED'].includes(detail.status)" :loading="acting" @click="act('cancel')">取消任务</el-button><el-button v-if="canWrite && ['FAILED','NOT_CONFIGURED'].includes(detail.callback_state) && detail.status === 'SUCCEEDED'" :loading="acting" @click="act('retry-callback')">重试回传</el-button><el-button v-if="canManageUsers && ['BLOCKED','FAILED','QUEUED'].includes(detail.status)" @click="importText = ''; importDialog = true">导入分析结果</el-button><el-button v-if="canManageUsers && detail.status === 'SUCCEEDED'" @click="importText = ''; importDialog = true">发布补充报告</el-button><el-button v-if="result" @click="download">下载结果 JSON</el-button></div>
        <template v-if="result"><div class="analysis-summary"><span>{{ result.findings?.length || 0 }} 项风险</span><span>{{ result.cases?.length || 0 }} 条用例</span><span>{{ result.apis?.length || 0 }} 个接口</span></div><el-alert v-if="result.coverageGaps?.length" title="材料与分析覆盖缺口" type="warning" :closable="false"><p v-for="gap in result.coverageGaps" :key="gap">{{ gap }}</p></el-alert><el-tabs v-model="resultTab"><el-tab-pane v-if="result.businessFlow" label="业务链路" name="flow"><h3>{{ result.businessFlow.title }}</h3><p>{{ result.businessFlow.summary }}</p><article v-for="step in result.businessFlow.steps || []" :key="step.id" class="analysis-item"><b>{{ step.id }} · {{ step.title }}</b><p>{{ step.description }}</p></article><article v-for="branch in result.businessFlow.branches || []" :key="branch.id" class="analysis-item"><b>{{ branch.condition }}</b><p>{{ branch.expectedBehavior }}</p></article></el-tab-pane><el-tab-pane label="分析报告" name="report"><pre class="analysis-report">{{ result.reportMarkdown || '该结果没有 Markdown 摘要，请在其他分类查看结构化内容。' }}</pre></el-tab-pane><el-tab-pane v-for="section in ['findings','cases','apis']" :key="section" :label="sectionLabels[section]" :name="section"><article v-for="item in result[section] || []" :key="item.id" class="analysis-item"><b>{{ item.id }} · {{ item.title || `${item.method} ${item.path}` }}</b><pre>{{ item.detail || JSON.stringify(item, null, 2) }}</pre><template v-if="section === 'findings' && item.recommendation"><h4>建议调整</h4><p>{{ item.recommendation }}</p><h4>代码证据 · 固定提交快照</h4><article v-for="(evidence,index) in item.codeEvidence || []" :key="index"><b>{{ evidence.projectId }} · {{ evidence.filePath }}:{{ evidence.startLine }}–{{ evidence.endLine }}</b><p>{{ evidence.commitSha }}</p><pre>{{ evidence.snippet }}</pre><p>{{ evidence.explanation }}</p></article></template></article></el-tab-pane></el-tabs></template>
      </template>
    </el-drawer>
    <el-dialog v-model="createDialog" title="创建分析任务" width="min(920px, 96vw)" class="analysis-create" align-center :close-on-click-modal="false" @closed="stopPreparation">
      <p class="form-hint">输入 JIRA 单号，读取本单的项目分支、需求和设计材料。核对后提交分析。</p>
      <el-form label-position="top">
        <div class="form-grid"><el-form-item label="业务组" required><el-select v-model="draft.businessGroup" :disabled="preparing" placeholder="按单号自动识别" clearable><el-option v-for="group in ['APP','WEB','PVP']" :key="group" :label="group" :value="group" /></el-select></el-form-item><el-form-item label="JIRA 单号" required><el-input v-model="draft.requirementKey" :disabled="preparing" placeholder="如 PVP-13859，或粘贴 JIRA 链接" @keyup.enter="prepareFromJira" /></el-form-item></div>
        <div class="jira-read-actions"><el-button type="primary" :loading="preparing" @click="prepareFromJira">{{ preparing ? '正在获取材料' : '从 JIRA 读取' }}</el-button><span class="form-hint">只读取本单，不修改 JIRA 或执行测试。</span></div>
        <el-alert v-if="preparationError" :title="preparationError" type="error" :closable="false" />
        <section v-if="preparationState?.sources?.length" class="source-status-panel"><h3>{{ preparationState.draft?.summary || '材料获取情况' }}</h3><div v-for="(source,index) in preparationState.sources" :key="index" class="source-status-row"><div><b>{{ source.title || source.type }}</b><p>{{ source.url }}</p><small v-if="source.type === 'wiki'">{{ source.tableCount || 0 }} 张表格 · {{ source.codeBlockCount || 0 }} 个代码块 · {{ source.imageCount || 0 }} 处图片引用 · {{ source.commentCount || 0 }} 条评论</small></div><el-tag :type="source.status === 'ready' ? 'success' : 'warning'">{{ sourceLabels[source.status] || source.status }}</el-tag><p v-if="source.gaps?.length" class="source-gaps">{{ source.gaps.join('；') }}</p></div><el-alert v-if="preparationState.draft?.discoveryGaps?.length" title="请确认以下内容" type="warning" :closable="false"><p v-for="gap in preparationState.draft.discoveryGaps" :key="gap">{{ gap }}</p></el-alert></section>
        <el-form-item label="需求正文或本次变更"><el-input v-model="draft.changeNotes" type="textarea" :rows="3" maxlength="50000" placeholder="粘贴已确认的需求、验收条件或变更说明，也可在下方添加材料。" /></el-form-item>
        <div class="form-section-title"><h3>项目与分支</h3><el-button text type="primary" @click="addRepo">添加项目</el-button></div>
        <p v-if="!repositories.length" class="form-hint">可先分析需求；有提测代码时添加对应项目及比较分支。</p>
        <div v-for="(repo,index) in repositories" :key="index" class="repo-row"><el-select v-model="repo.projectId" filterable allow-create default-first-option placeholder="项目 ID" aria-label="项目 ID"><el-option v-for="project in config?.repositoryProjects || []" :key="project" :label="project" :value="project" /></el-select><el-input v-model="repo.baseRef" placeholder="比较基线（请确认）" aria-label="比较基线" /><el-input v-model="repo.targetRef" placeholder="提测分支" aria-label="提测分支" /><el-button text type="danger" @click="repositories.splice(index,1)">移除</el-button></div>
        <div class="form-section-title"><h3>分析材料 <small>选填</small></h3><el-button text type="primary" @click="addMaterial">添加材料</el-button></div>
        <p class="form-hint">需求、设计稿、SQL 结构与变更、脱敏样例均归属当前单子。链接需执行端能访问；只支持读取下列文本文件，不执行 SQL。</p>
        <section v-for="(material,index) in materials" :key="material.id" class="material-card">
          <div class="material-head"><el-select v-model="material.type" aria-label="材料类型"><el-option v-for="(label,value) in materialTypes" :key="value" :label="label" :value="value" /></el-select><el-input v-model="material.title" placeholder="材料名称，如订单相关表结构" aria-label="材料名称" /><el-button text type="danger" @click="materials.splice(index,1)">移除</el-button></div>
          <el-input v-model="material.url" placeholder="原文或设计稿链接（选填）" aria-label="材料链接" />
          <el-input v-model="material.content" type="textarea" :rows="3" maxlength="500000" placeholder="粘贴正文、CREATE TABLE / ALTER TABLE，或脱敏样例" aria-label="材料正文" />
          <div class="material-upload"><label :for="`material-file-${material.id}`">读取文本文件</label><input :id="`material-file-${material.id}`" type="file" accept=".sql,.txt,.md,.json,.csv,.html,.xml" @change="readMaterial($event,material)" /><small>SQL / TXT / MD / JSON / CSV / HTML / XML，单份最多 500KB。Word、Excel、图片请先转换成文本或提供可访问链接。</small></div>
        </section>
        <el-collapse><el-collapse-item title="更新分析与版本信息" name="versions"><div class="form-grid"><el-form-item label="材料版本"><el-input v-model="draft.materialVersion" placeholder="本次材料快照版本" /></el-form-item><el-form-item label="上一份已完成分析（选填）"><el-select v-model="draft.previousJobId" clearable placeholder="仅显示当前业务组和单号的结果"><el-option v-for="row in previousJobs" :key="row.id" :value="row.id" :label="`${row.materialVersion} · ${when(row.updated_at)}`" /></el-select></el-form-item></div><p class="form-hint">版本和请求 ID 自动生成。重复提交复用同一请求 ID；材料变化请创建新任务。未受影响的执行记录由 TestForge 合并保留。</p></el-collapse-item></el-collapse>
      </el-form>
      <template #footer><el-button @click="createDialog = false">取消</el-button><el-button type="primary" :loading="acting" :disabled="preparing" @click="create">提交分析</el-button></template>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'
import { canWrite, canManageUsers } from '../stores/auth'
const rows = ref<any[]>([]), config = ref<any>(null), detail = ref<any>(null), result = ref<any>(null)
const loading = ref(false), acting = ref(false), error = ref(''), keyword = ref(''), status = ref(''), drawer = ref(false), help = ref(false), createDialog = ref(false), importDialog = ref(false), importText = ref(''), resultTab = ref('report')
const draft = ref({ businessGroup:'', requirementKey:'', externalId:'', changeNotes:'', materialVersion:'', previousJobId:'' })
const repositories = ref<{projectId:string; baseRef:string; targetRef:string}[]>([])
interface Material { id:string; type:string; title:string; url:string; content:string }
const materials = ref<Material[]>([])
const materialTypes: Record<string,string> = { requirement:'需求文档', design:'设计稿与交互', schema:'数据库表结构', migration:'数据库变更 SQL', sampleData:'脱敏样例数据', apiSpec:'接口定义', configuration:'配置与依赖', changeNote:'需求变更说明' }
const previousJobs = computed(() => rows.value.filter(row => row.status === 'SUCCEEDED' && row.businessGroup === draft.value.businessGroup && row.requirement_key === draft.value.requirementKey.trim().toUpperCase()))
const preparationState = ref<any>(null), preparationError = ref(''), preparing = ref(false), preparationId = ref('')
const sourceLabels: Record<string,string> = { ready:'已获取', partial:'部分获取', failed:'获取失败', listed:'待获取' }
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
function addRepo() { repositories.value.push({projectId:'',baseRef:'',targetRef:''}) }
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
const sectionLabels: Record<string,string> = { findings: '问题与风险', cases: '测试用例', apis: '待测接口' }
const filtered = computed(() => rows.value.filter(r => (!status.value || r.status === status.value) && `${r.businessGroup} ${r.requirement_key} ${r.external_id} ${r.client}`.toLowerCase().includes(keyword.value.toLowerCase())))
const when = (v: string) => v ? new Date(v).toLocaleString() : '—'
const stateType = (s: string) => s === 'SUCCEEDED' ? 'success' : s === 'FAILED' ? 'danger' : s === 'BLOCKED' ? 'warning' : 'info'
const errorLabel = (code: string) => ({ EXECUTOR_DISABLED: 'Codex 执行端未启用，请按接入说明配置后重新分析。', REPOSITORY_NOT_CONFIGURED: '项目未映射到服务端仓库目录。', WORKER_SCRIPT_MISSING: '找不到分析执行脚本。', REPOSITORY_UNAVAILABLE: '配置的仓库目录不可用。', EXECUTOR_FAILED_CHECK_LOCAL_CONFIGURATION: '执行端失败，请检查 SDK、模型登录和本地任务日志；未生成有效结果。', WORKER_INTERRUPTED: '执行端中断，请确认后手动重试。', ANALYSIS_TIMEOUT: '分析超时，未将不完整结果发布。' } as Record<string,string>)[code] || code
async function load() { loading.value = true; error.value = ''; try { const [list, settings] = await Promise.all([apiClient.listAnalysisJobs(), apiClient.analysisJobConfig()]); rows.value = list; config.value = settings } catch(e:any) { error.value = e.message || '读取失败' } finally { loading.value = false } }
async function showDetail(row:any) { detail.value = row; result.value = null; resultTab.value = 'report'; drawer.value = true; await refreshDetail() }
async function refreshDetail() { if (!detail.value) return; try { const id = detail.value.id; const d = await apiClient.getAnalysisJob(id); if (detail.value?.id !== id) return; detail.value = d; if(d.status === 'SUCCEEDED') result.value = await apiClient.getAnalysisResult(id) } catch(e:any) { ElMessage.error(e.message || '读取失败') } }
async function act(action:string) { if(!detail.value) return; if(action === 'retry') { try { await ElMessageBox.confirm('重新分析会调用已启用的模型执行端，可能产生模型费用。是否继续？','重新分析') } catch { return } } acting.value = true; try { await apiClient.analysisJobAction(detail.value.id,action); await refreshDetail(); await load() } catch(e:any) { ElMessage.error(e.message) } finally { acting.value = false } }
function newTask() { stopPreparation(); const version=`snapshot-${Date.now()}`; draft.value = { businessGroup:'', requirementKey:'', externalId:newId(), changeNotes:'', materialVersion:version, previousJobId:'' }; repositories.value=[]; materials.value=[]; preparationId.value=''; preparationState.value=null; preparationError.value=''; createDialog.value=true }
async function create() {
  if(!/^[A-Z][A-Z0-9_]*-\d+$/.test(draft.value.requirementKey.trim().toUpperCase()))return ElMessage.warning('请填写正确的 JIRA 单号')
  if(!['APP','WEB','PVP'].includes(draft.value.businessGroup))return ElMessage.warning('请选择业务组，或先从 JIRA 读取')
  if(!draft.value.materialVersion.trim())return ElMessage.warning('请填写材料版本')
  if(repositories.value.some(r=>!r.projectId.trim() || !r.baseRef.trim() || !r.targetRef.trim()))return ElMessage.warning('请补全项目、比较基线和提测分支')
  if(materials.value.some(m=>!m.title.trim() || (!m.content.trim() && !m.url.trim())))return ElMessage.warning('每份材料需要名称，以及正文或链接')
  if(!draft.value.changeNotes.trim() && !materials.value.length && !repositories.value.length)return ElMessage.warning('请至少提供需求说明、材料或项目代码')
  acting.value=true
  try {
    const {previousJobId,...fields}=draft.value
    const payload={...fields,requirementKey:fields.requirementKey.trim().toUpperCase(),contractVersion:'2',...(preparationId.value?{preparationId:preparationId.value}:{}),...(previousJobId?{previousJobId}:{}),repositories:repositories.value.map(r=>({projectId:r.projectId.trim(),baseRef:r.baseRef.trim(),targetRef:r.targetRef.trim()})),materials:materials.value.map(m=>({id:m.id,type:m.type,title:m.title.trim(),...(m.url.trim()?{url:m.url.trim()}:{}),...(m.content.trim()?{content:m.content}: {})}))}
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
