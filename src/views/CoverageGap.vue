<template>
  <div class="cov-gap">
    <el-card shadow="never">
      <template #header>
        <div>
          <span class="title">接口覆盖差集</span>
          <p class="sub">
            白盒（代码变更分析）与黑盒（前端抓包）两边对照：改了却没人调的，和调了却没分析过的。
            回答「这个需求还有哪些接口没测到」。
          </p>
        </div>
      </template>

      <div class="bar">
        <el-checkbox v-model="includeArchived" @change="load">含已上线</el-checkbox>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table :data="summary" size="small" border style="margin-top: 10px" @row-click="openDetail">
        <el-table-column prop="requirementNo" label="需求单" width="140" />
        <el-table-column label="改了但没抓到" width="130">
          <template #default="{ row }">
            <el-tag v-if="Number(row.changedNotCaptured) > 0" type="danger">{{ row.changedNotCaptured }}</el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column prop="covered" label="改了且覆盖" width="110" />
        <el-table-column label="抓到但没分析" width="130">
          <template #default="{ row }">
            <el-tag v-if="Number(row.capturedNotChanged) > 0" type="warning">{{ row.capturedNotChanged }}</el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="接口总数" width="90" />
      </el-table>
      <el-empty v-if="!summary.length" description="还没有数据：先跑接口对比分析，再从前端入口抓一次包" />
    </el-card>

    <el-dialog v-model="detailOpen" :title="`${current?.requirementNo || ''} 覆盖差集`" width="720px">
      <el-alert v-if="detail" :type="detail.changedNotCapturedCount ? 'error' : 'success'" :closable="false" show-icon
        :title="detail.hint" style="margin-bottom: 10px" />
      <template v-if="detail">
        <h4 v-if="detail.changedNotCaptured.length">改了但没抓到（漏测面）</h4>
        <el-table v-if="detail.changedNotCaptured.length" :data="detail.changedNotCaptured" size="small" border>
          <el-table-column prop="httpMethod" label="方法" width="70" />
          <el-table-column prop="path" label="接口" />
          <el-table-column prop="changeNote" label="变更" />
        </el-table>
        <h4 v-if="detail.capturedNotChanged.length" style="margin-top: 12px">抓到但不在变更里（回归面）</h4>
        <el-table v-if="detail.capturedNotChanged.length" :data="detail.capturedNotChanged" size="small" border>
          <el-table-column prop="httpMethod" label="方法" width="70" />
          <el-table-column prop="path" label="接口" />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const summary = ref<any[]>([])
const includeArchived = ref(false)
const detailOpen = ref(false)
const detail = ref<any | null>(null)
const current = ref<any | null>(null)

async function load() {
  try { summary.value = await apiClient.getCoverageGapSummary(includeArchived.value) }
  catch (e: any) { ElMessage.error(e?.message || '加载失败') }
}
async function openDetail(row: any) {
  current.value = row
  try { detail.value = await apiClient.getCoverageGap(row.requirementNo, includeArchived.value); detailOpen.value = true }
  catch (e: any) { ElMessage.error(e?.message || '加载失败') }
}
onMounted(load)
</script>

<style scoped>
.title { font-size: 16px; font-weight: 600; }
.sub { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; max-width: 760px; }
.bar { display: flex; gap: 12px; align-items: center; }
h4 { margin: 8px 0 6px; }
</style>
