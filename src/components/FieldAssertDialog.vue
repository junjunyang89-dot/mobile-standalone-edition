<template>
  <el-dialog
    :model-value="modelValue"
    title="转为用例断言"
    width="820px"
    append-to-body
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="loading" class="fad-muted">查这个接口的用例…</div>
    <el-alert v-else-if="error" type="warning" :closable="false" show-icon :title="error" />
    <template v-else-if="!cases.length">
      <el-empty description="这个接口还没有用例，先在「去测试」面板里 AI 生成一条" :image-size="56" />
    </template>
    <template v-else>
      <div class="fad-row">
        <span class="fad-label">写进用例</span>
        <el-select v-model="caseId" style="width: 360px" @change="loadPreview">
          <el-option v-for="c in cases" :key="c.id" :label="c.name" :value="c.id">
            <span>{{ c.name }}</span>
            <span class="fad-muted"> · {{ c.assertCount }} 条断言</span>
          </el-option>
        </el-select>
      </div>
      <div v-if="preview" class="fad-prefix" :class="{ guessed: preview.guessed }">
        字段位置 <code>{{ preview.prefix }}</code> · {{ preview.prefixFrom }}
        <span v-if="preview.guessed">，写入前核对一下路径</span>
      </div>
      <el-table v-if="preview" :data="items" size="small" border class="fad-table">
        <el-table-column width="44" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.on" :disabled="row.duplicate" />
          </template>
        </el-table-column>
        <el-table-column label="字段" width="150">
          <template #default="{ row }"><code class="fad-code">{{ row.field }}</code></template>
        </el-table-column>
        <el-table-column label="断言路径" min-width="230">
          <template #default="{ row }">
            <el-input v-model="row.path" size="small" class="fad-mono" :disabled="row.duplicate" />
          </template>
        </el-table-column>
        <el-table-column label="检查" width="150">
          <template #default="{ row }">
            <el-select v-model="row.check" size="small" :disabled="row.duplicate">
              <el-option v-if="row.jsonType" :label="`类型是 ${row.jsonType}`" value="type" />
              <el-option label="字段存在" value="exists" />
              <el-option label="不再返回" value="absent" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="180">
          <template #default="{ row }"><span class="fad-muted">{{ row.note }}</span></template>
        </el-table-column>
      </el-table>
    </template>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!picked.length" :loading="saving" @click="apply">
        写入用例（{{ picked.length }} 条）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import type { DiffRow } from '@/utils/fieldDiff'
import type { EndpointRef } from '@/composables/useFieldMarks'

const props = defineProps<{
  modelValue: boolean
  project: string
  endpoint: EndpointRef | null
  rows: DiffRow[]
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'done', v: { caseId: string; added: number }): void
}>()

type Lookup = Awaited<ReturnType<typeof apiClient.lookupChangedEndpoint>>
type Preview = Awaited<ReturnType<typeof apiClient.previewFieldAsserts>>

const loading = ref(false)
const error = ref('')
const cases = ref<NonNullable<Lookup['cases']>>([])
const caseId = ref('')
const preview = ref<Preview | null>(null)
const items = ref<Array<Preview['items'][number] & { on: boolean }>>([])
const saving = ref(false)

const picked = computed(() => items.value.filter((i) => i.on && !i.duplicate && i.path.trim()))

async function open() {
  error.value = ''
  cases.value = []
  caseId.value = ''
  preview.value = null
  items.value = []
  if (!props.project || !props.endpoint?.path) {
    error.value = '这份报告没有关联项目，找不到接口清单里的用例'
    return
  }
  loading.value = true
  try {
    const r = await apiClient.lookupChangedEndpoint(props.project, props.endpoint.method, props.endpoint.path)
    if (!r.found) {
      error.value = r.message || '接口清单里没找到这个接口'
      return
    }
    cases.value = r.cases || []
    const first = cases.value.find((c) => c.enabled !== false) || cases.value[0]
    if (first) {
      caseId.value = first.id
      await loadPreview()
    }
  } catch (e: any) {
    error.value = e?.message || '查用例失败'
  } finally {
    loading.value = false
  }
}

async function loadPreview() {
  if (!caseId.value) return
  try {
    preview.value = await apiClient.previewFieldAsserts(
      caseId.value,
      props.rows.map((r) => ({
        name: r.name,
        treePath: r.treePath,
        changeType: r.changeType,
        oldType: r.oldType,
        newType: r.newType
      }))
    )
    items.value = preview.value.items.map((i) => ({ ...i, on: !i.duplicate }))
  } catch (e: any) {
    ElMessage.error(e?.message || '生成断言失败')
  }
}

async function apply() {
  saving.value = true
  try {
    const r = await apiClient.applyFieldAsserts(
      caseId.value,
      picked.value.map((i) => ({ path: i.path.trim(), check: i.check, jsonType: i.jsonType }))
    )
    ElMessage.success(`已写进「${r.caseName}」：新增 ${r.added} 条${r.skipped ? `，${r.skipped} 条已存在跳过` : ''}`)
    emit('done', { caseId: r.caseId, added: r.added })
    emit('update:modelValue', false)
  } catch (e: any) {
    ElMessage.error(e?.message || '写入失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) open()
  },
  { immediate: true }
)
</script>

<style scoped>
.fad-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fad-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.fad-prefix {
  margin: 10px 0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}

.fad-prefix.guessed {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.fad-prefix code,
.fad-code,
.fad-mono :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.fad-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fad-table {
  margin-top: 4px;
}
</style>
