<template>
  <el-drawer :model-value="modelValue" title="分支用例分诊" size="640px" @update:model-value="emit('update:modelValue', $event)" @open="load">
    <div class="bt-intro">
      分支用例是为某次提测写的。分支合进 master 后，这些用例要么<b>升级成回归用例</b>长期守着，要么<b>退役</b>。
      一直挂着不处理，它们会混在回归里跑，挂了也不知道该找谁。
    </div>

    <div class="bt-bar">
      <el-select v-model="project" filterable clearable placeholder="全部项目" class="bt-project" @change="load">
        <el-option v-for="p in projects" :key="p" :label="p" :value="p" />
      </el-select>
      <el-button :loading="loading" @click="load">刷新</el-button>
      <span class="bt-sum">{{ groups.length }} 个分支 · {{ totalCases }} 条分支用例</span>
    </div>

    <div v-if="repoNote" class="bt-note">{{ repoNote }}</div>

    <div v-loading="loading" class="bt-list">
      <div v-if="!loading && !groups.length" class="bt-empty">没有挂着的分支用例</div>
      <div v-for="g in sortedGroups" :key="g.key" class="bt-group" :class="`is-${g.state}`">
        <div class="bt-head" @click="toggle(g)">
          <el-icon class="bt-caret" :class="{ open: openKey === g.key }"><ArrowRight /></el-icon>
          <span class="bt-state">{{ STATE_TEXT[g.state] }}</span>
          <span class="bt-branch mono">{{ g.sourceBranch || '（没记来源分支）' }}</span>
          <span class="bt-cnt">{{ g.cnt }} 条</span>
          <el-button
            v-if="g.sourceBranch"
            size="small"
            plain
            :loading="busyKey === g.key"
            @click.stop="promoteGroup(g)"
          >整组升级成回归</el-button>
        </div>
        <div class="bt-why">{{ STATE_HINT[g.state] }}</div>

        <div v-if="openKey === g.key" class="bt-cases">
          <div v-if="casesLoading" class="bt-empty">加载中…</div>
          <template v-else>
            <div v-for="c in casesOf(g)" :key="c.id" class="bt-case">
              <span class="method-tag" :class="`m-${String(c.method || 'GET').toLowerCase()}`">{{ c.method }}</span>
              <span class="bt-case-main">
                <span class="bt-case-name">{{ c.name }}<span v-if="c.enabled === false" class="bt-off">已停用</span></span>
                <span class="bt-case-path mono">{{ c.path }}</span>
              </span>
              <el-button link type="primary" :disabled="!!busyKey" @click="promote([c])">升级成回归</el-button>
              <el-button link type="danger" :disabled="!!busyKey" @click="retire(c)">退役</el-button>
            </div>
            <div v-if="!casesOf(g).length" class="bt-empty">这组用例已经处理完了，点刷新更新计数</div>
          </template>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight } from '@element-plus/icons-vue'
import { apiClient } from '../../api'
import { invalidateCaseKindIndex } from '../../utils/caseKind'

const props = defineProps<{ modelValue: boolean; projects: string[]; defaultProject?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'changed'): void }>()

/**
 * 「合没合进 master」现在没有数据源：后端只回「哪个分支还挂着几条」，变更分析也只列分支、不判合并。
 * 所以这里只说看得见的事实——分支在不在仓库里——不替人下「已合并 / 还在测」的结论。
 */
type GroupState = 'nobranch' | 'gone' | 'unknown'
const STATE_TEXT: Record<GroupState, string> = {
  nobranch: '数据问题',
  gone: '仓库里找不到',
  unknown: '合并状态未知'
}
const STATE_HINT: Record<GroupState, string> = {
  nobranch: '是分支用例却没记来源分支，没法判断该不该分诊。逐条补上分支，或直接定成回归 / 退役',
  gone: '这个分支在仓库里已经没有了，多半是合并后删掉的——优先分诊这组',
  unknown: '分支还在仓库里。合没合进 master 目前判断不了，请对照上线情况处理'
}
const STATE_ORDER: Record<GroupState, number> = { nobranch: 0, gone: 1, unknown: 2 }

type Group = { key: string; sourceBranch: string | null; cnt: number; state: GroupState }

const project = ref('')
const loading = ref(false)
const groups = ref<Group[]>([])
const repoNote = ref('')
const openKey = ref('')
const busyKey = ref('')
const casesLoading = ref(false)
const branchCases = ref<any[]>([])

const totalCases = computed(() => groups.value.reduce((s, g) => s + g.cnt, 0))
const sortedGroups = computed(() =>
  [...groups.value].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.cnt - a.cnt)
)

async function repoBranches(p: string): Promise<Set<string> | null> {
  if (!p) {
    repoNote.value = '选了项目才能对照仓库分支；现在只显示计数'
    return null
  }
  try {
    const r = await apiClient.getApiChangeBranches(p)
    const set = new Set<string>()
    for (const b of r.branches || []) {
      set.add(b)
      set.add(b.replace(/^origin\//, ''))
    }
    repoNote.value = ''
    return set
  } catch (e: any) {
    repoNote.value = `读不到 ${p} 的仓库分支（${e?.message || '未配置仓库'}），只显示计数`
    return null
  }
}

let seq = 0
async function load() {
  if (!project.value && props.defaultProject && !groups.value.length) project.value = props.defaultProject
  const my = ++seq
  loading.value = true
  openKey.value = ''
  branchCases.value = []
  try {
    const p = project.value || ''
    const [rows, repo] = await Promise.all([apiClient.getApiTestCaseBranchGroups(p || undefined), repoBranches(p)])
    if (my !== seq) return
    groups.value = (rows || []).map((r) => {
      const b = r.sourceBranch ? String(r.sourceBranch) : null
      const state: GroupState = !b ? 'nobranch' : repo && !repo.has(b) ? 'gone' : 'unknown'
      return { key: b ?? '__null__', sourceBranch: b, cnt: Number(r.cnt) || 0, state }
    })
  } catch (e: any) {
    if (my === seq) {
      groups.value = []
      ElMessage.error(e?.message || '加载失败')
    }
  } finally {
    if (my === seq) loading.value = false
  }
}

async function loadCases() {
  casesLoading.value = true
  try {
    branchCases.value = await apiClient.getApiTestCases({ project: project.value || undefined, caseKind: 'BRANCH' })
  } catch (e: any) {
    branchCases.value = []
    ElMessage.error(e?.message || '加载用例失败')
  } finally {
    casesLoading.value = false
  }
}

function casesOf(g: Group) {
  return branchCases.value.filter((c) => (c.sourceBranch || null) === g.sourceBranch)
}

async function toggle(g: Group) {
  openKey.value = openKey.value === g.key ? '' : g.key
  if (openKey.value && !branchCases.value.length) await loadCases()
}

function afterChange(ids: string[]) {
  const gone = new Set(ids)
  branchCases.value = branchCases.value.filter((c) => !gone.has(c.id))
  for (const g of groups.value) g.cnt = casesOf(g).length
  groups.value = groups.value.filter((g) => g.cnt > 0)
  invalidateCaseKindIndex()
  emit('changed')
}

async function promote(cases: any[], key = cases[0].id) {
  busyKey.value = key
  const done: string[] = []
  try {
    for (const c of cases) {
      // PUT 是整条覆盖：拿整条实体改种类，来源分支保留，日后还能追溯是为哪次提测写的
      await apiClient.updateApiTestCase(c.id, { ...c, caseKind: 'REGRESSION' })
      done.push(c.id)
    }
    ElMessage.success(`已升级 ${done.length} 条为回归用例`)
  } catch (e: any) {
    ElMessage.error(`升级到第 ${done.length + 1} 条失败：${e?.message || ''}`)
  } finally {
    busyKey.value = ''
    if (done.length) afterChange(done)
  }
}

async function promoteGroup(g: Group) {
  if (!branchCases.value.length) await loadCases()
  const cases = casesOf(g)
  if (!cases.length) return
  try {
    await ElMessageBox.confirm(
      `把分支 ${g.sourceBranch} 的 ${cases.length} 条用例都升级成回归用例？之后每次定期回归都会跑它们。`,
      '整组升级',
      { type: 'warning', confirmButtonText: '升级', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await promote(cases, g.key)
}

async function retire(c: any) {
  try {
    await ElMessageBox.confirm(
      `退役会删除用例「${c.name}」。停用不算退役：停用的分支用例还会一直挂在这个队列里。`,
      '退役用例',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busyKey.value = c.id
  try {
    await apiClient.deleteApiTestCase(c.id)
    ElMessage.success('已退役')
    afterChange([c.id])
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  } finally {
    busyKey.value = ''
  }
}
</script>

<style scoped>
.bt-intro { font-size: 13px; color: #595959; line-height: 1.7; margin-bottom: 14px; }
.bt-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.bt-project { width: 220px; }
.bt-sum { margin-left: auto; font-size: 13px; color: #8c8c8c; }
.bt-note { font-size: 12px; color: #ad6800; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; }
.bt-list { min-height: 120px; display: flex; flex-direction: column; gap: 8px; }
.bt-empty { padding: 16px; text-align: center; color: #8c8c8c; font-size: 13px; }
.bt-group { border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
.bt-group.is-nobranch { border-color: #ffa39e; }
.bt-group.is-gone { border-color: #ffd591; background: #fffcf5; }
.bt-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px 2px; cursor: pointer; }
.bt-caret { transition: transform 0.15s; color: #8c8c8c; }
.bt-caret.open { transform: rotate(90deg); }
.bt-state { flex-shrink: 0; font-size: 11px; line-height: 18px; padding: 0 6px; border-radius: 4px; color: #595959; background: #f5f5f5; }
.is-nobranch .bt-state { color: #cf1322; background: #fff1f0; }
.is-gone .bt-state { color: #d46b08; background: #fff7e6; }
.bt-branch { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #262626; }
.bt-cnt { font-size: 13px; color: #595959; white-space: nowrap; }
.bt-why { padding: 2px 12px 9px 34px; font-size: 12px; color: #8c8c8c; }
.bt-cases { border-top: 1px solid #f5f5f5; padding: 4px 12px 8px 34px; }
.bt-case { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px dashed #f0f0f0; }
.bt-case:first-child { border-top: 0; }
.bt-case-main { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.bt-case-name { font-size: 13px; color: #262626; }
.bt-case-path { font-size: 11px; color: #a6a6a6; word-break: break-all; }
.bt-off { margin-left: 6px; font-size: 11px; color: #8c8c8c; }
.mono { font-family: ui-monospace, Menlo, monospace; }
.method-tag { flex-shrink: 0; font-size: 11px; font-weight: 600; min-width: 42px; text-align: center; color: #1677ff; }
.method-tag.m-post { color: #389e0d; }
.method-tag.m-put, .method-tag.m-patch { color: #d46b08; }
.method-tag.m-delete { color: #cf1322; }
</style>
