<template>
  <div class="ekm">
    <div v-if="keys.length" class="ekm-tags">
      <el-tag
        v-for="(k, i) in keys"
        :key="k"
        class="ekm-tag"
        :closable="!disabled"
        :type="labelOf(k).known ? undefined : 'warning'"
        disable-transitions
        @close="removeAt(i)"
      >
        <span class="ekm-idx">{{ i + 1 }}</span>
        <span :title="labelOf(k).full">{{ labelOf(k).short }}</span>
      </el-tag>
    </div>

    <ElementKeySelect
      :model-value="''"
      :elements="elements"
      :pages="pages"
      :disabled="disabled"
      :placeholder="keys.length ? '继续添加元素' : placeholder"
      @update:modelValue="add"
    />

    <!--
      未知 key 单独提示：这类值多半来自导入的流程，或元素被改过名。
      不在这里默默过滤掉——悄悄少一个判定对象，比一条黄色标签危险得多。
    -->
    <div v-if="unknown.length" class="ekm-warn">
      有 {{ unknown.length }} 个元素在当前元素库里找不到：{{ unknown.join('、') }}。
      执行时会直接报错，建议现在就替换掉
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ElementKeySelect from './ElementKeySelect.vue'

type ElementOption = { nameEn?: string; nameZh?: string; pageId?: string | null }
type PageOption = { pageId?: string; nameZh?: string }

/**
 * 多选元素（后端 ParamDef 的 elements 类型）。
 *
 * 复用 ElementKeySelect 逐个添加，而不是做成一个多选下拉：
 * 元素库有上千个，多选下拉里已选项会散落在长列表各处，删一个要先翻到它。
 * 拆成「上面是已选清单、下面是选择器」之后，已选的永远在眼前，加和删都是一步。
 *
 * 值统一吐成字符串数组。收的时候数组、逗号分隔的字符串都认——
 * 导入的流程 JSON、手改过的库记录都可能是后一种，认不出就会让人对着有内容的界面查「为什么是空」。
 */

const props = withDefaults(
  defineProps<{
    modelValue?: string[] | string
    elements?: ElementOption[]
    pages?: PageOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    modelValue: () => [],
    elements: () => [],
    pages: () => [],
    placeholder: '选择元素（可多选）',
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const keys = computed<string[]>(() => normalize(props.modelValue))

function normalize(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(/[\n\r,;，、；]+/)
  const out: string[] = []
  for (const item of list) {
    const v = String(item ?? '').trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

const pageTitles = computed(() => {
  const m = new Map<string, string>()
  for (const p of props.pages || []) {
    if (p.pageId) m.set(p.pageId, p.nameZh || p.pageId)
  }
  return m
})

const elementIndex = computed(() => {
  const m = new Map<string, ElementOption>()
  for (const el of props.elements || []) {
    const en = String(el.nameEn || '').trim()
    if (en) m.set(en, el)
  }
  return m
})

function labelOf(key: string) {
  const el = elementIndex.value.get(key)
  if (!el) return { short: key, full: `${key}（元素库里找不到）`, known: false }
  const zh = String(el.nameZh || '').trim() || key
  const page = el.pageId ? pageTitles.value.get(String(el.pageId)) || '' : ''
  return {
    short: zh,
    full: page ? `${page} / ${zh}（${key}）` : `${zh}（${key}）`,
    known: true
  }
}

const unknown = computed(() => keys.value.filter((k) => !elementIndex.value.has(k)))

function add(key: string) {
  const v = String(key || '').trim()
  if (!v || keys.value.includes(v)) return
  emit('update:modelValue', [...keys.value, v])
}

function removeAt(index: number) {
  const next = keys.value.slice()
  next.splice(index, 1)
  emit('update:modelValue', next)
}
</script>

<style scoped>
.ekm {
  width: 100%;
}
.ekm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.ekm-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.ekm-idx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.ekm-warn {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-color-warning);
}
</style>
