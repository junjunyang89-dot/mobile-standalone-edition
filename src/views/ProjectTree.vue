<template>
  <div class="proj-tree">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="title">统一项目树</span>
            <p class="sub">
              分类 → 项目 → 模块，每层带覆盖数（接口用例 / 接口 / UI 流程 / Bug）。
              树本身就在回答「哪个项目没人测」。
            </p>
          </div>
          <el-checkbox v-model="includeEmpty" @change="load">显示空项目</el-checkbox>
        </div>
      </template>

      <el-tree
        :data="nodes"
        :props="{ label: 'label', children: 'children' }"
        node-key="key"
        default-expand-all
      >
        <template #default="{ data }">
          <span class="node">
            <el-tag v-if="data.type === 'CATEGORY'" size="small" type="info">{{ data.label }}</el-tag>
            <template v-else-if="data.type === 'PROJECT'">
              <el-tag size="small" :type="kindType(data.kind)">{{ kindLabel(data.kind) }}</el-tag>
              <span class="pname">{{ data.label }}</span>
            </template>
            <span v-else class="mname">{{ data.label }}</span>
            <span v-if="data.total != null && data.total > 0" class="total">{{ data.total }}</span>
            <span v-if="data.count != null && data.count > 0" class="mcount">{{ data.count }}</span>
          </span>
        </template>
      </el-tree>
      <el-empty v-if="!nodes.length" description="暂无数据" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '../api'

const nodes = ref<any[]>([])
const includeEmpty = ref(true)

async function load() {
  try { const t = await apiClient.getUnifiedTree(includeEmpty.value); nodes.value = t.nodes || [] }
  catch (e: any) { ElMessage.error(e?.message || '加载失败') }
}
function kindType(k: string) { return k === 'CLIENT' ? 'success' : k === 'H5' ? 'warning' : '' }
function kindLabel(k: string) { return k === 'CLIENT' ? '客户端' : k === 'H5' ? 'H5' : '后台' }
onMounted(load)
</script>

<style scoped>
.title { font-size: 16px; font-weight: 600; }
.sub { margin: 4px 0 0; color: #909399; font-size: 12px; max-width: 760px; }
.node { display: inline-flex; align-items: center; gap: 6px; }
.pname { font-weight: 500; }
.mname { color: #606266; }
.total, .mcount { color: #909399; font-size: 12px; margin-left: 4px; }
</style>
