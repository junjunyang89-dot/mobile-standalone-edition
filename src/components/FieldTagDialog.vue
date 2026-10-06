<template>
  <el-dialog
    :model-value="modelValue"
    title="关联前端页面 / 模块"
    width="460px"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ftd-hint">
      {{ rows.length === 1 ? `字段 ${rows[0]?.name}` : `${rows.length} 个字段` }}
      是给哪块页面用的？下次分析同一接口还会带出来。
    </div>
    <el-autocomplete
      v-model="value"
      :fetch-suggestions="suggestTags"
      placeholder="如：胜率展示模块"
      clearable
      style="width: 100%"
      @keyup.enter="save"
    >
      <template #default="{ item }">
        <span>{{ item.value }}</span>
        <span v-if="item.page" class="ftd-hint"> · UI 页面库</span>
      </template>
    </el-autocomplete>
    <template #footer>
      <el-button v-if="hadTag" type="danger" link @click="value = ''; save()">去掉标签</el-button>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!value.trim()" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { DiffRow } from '@/utils/fieldDiff'
import { loadUiPageNames, type EndpointRef, type FieldMarks } from '@/composables/useFieldMarks'

const props = defineProps<{
  modelValue: boolean
  rows: DiffRow[]
  endpoint: EndpointRef | null
  marks: FieldMarks | null
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const value = ref('')
const hadTag = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.marks || !props.endpoint) return
    const tags = [...new Set(props.rows.map((r) => props.marks!.tagOf(props.endpoint!, r)).filter(Boolean))]
    value.value = tags.length === 1 ? tags[0] : ''
    hadTag.value = tags.length > 0
  }
)

async function suggestTags(q: string, cb: (list: Array<{ value: string; page?: boolean }>) => void) {
  const used = props.marks?.tagNames.value || []
  const pages = await loadUiPageNames()
  const kw = q.trim().toLowerCase()
  const hit = (s: string) => !kw || s.toLowerCase().includes(kw)
  cb([
    ...used.filter(hit).map((v) => ({ value: v })),
    ...pages.filter((p) => hit(p) && !used.includes(p)).slice(0, 30).map((v) => ({ value: v, page: true }))
  ])
}

async function save() {
  if (!props.marks || !props.endpoint) return
  try {
    await props.marks.setTag(props.endpoint, props.rows, value.value)
    emit('update:modelValue', false)
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}
</script>

<style scoped>
.ftd-hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
