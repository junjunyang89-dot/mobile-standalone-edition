<template>
  <el-popover
    v-model:visible="open"
    placement="bottom-start"
    :width="panelWidth"
    :disabled="disabled"
    trigger="click"
    :teleported="true"
    popper-class="element-key-select-popper"
    @after-enter="focusSearch"
  >
    <template #reference>
      <div
        class="eks-trigger"
        :class="{ 'is-disabled': disabled, 'is-open': open }"
      >
        <span v-if="displayText" class="eks-value" :title="displayText">{{ displayText }}</span>
        <span v-else class="eks-placeholder">{{ placeholder }}</span>
        <span class="eks-actions">
          <el-icon
            v-if="modelValue && !disabled"
            class="eks-clear"
            @click.stop="clear"
          >
            <CircleClose />
          </el-icon>
          <el-icon class="eks-arrow"><ArrowDown /></el-icon>
        </span>
      </div>
    </template>

    <div class="eks-panel" @keydown.stop>
      <el-input
        ref="searchRef"
        v-model="keyword"
        clearable
        size="small"
        placeholder="搜索页面或元素（中文 / 英文 key）"
        @keydown.esc.stop="close"
      />

      <div v-if="!filteredPages.length" class="eks-empty">无匹配结果</div>

      <!-- 有关键字：扁平列出「页面 / 元素」，一眼扫完 -->
      <el-scrollbar v-else-if="keywordTrim" max-height="280px">
        <div
          v-for="hit in flatHits"
          :key="hit.en"
          class="eks-hit"
          :class="{ 'is-active': hit.en === modelValue }"
          @click="pick(hit.en)"
        >
          <span class="eks-hit-page">{{ hit.pageTitle }}</span>
          <span class="eks-hit-sep">/</span>
          <span class="eks-hit-el">{{ hit.elLabel }}</span>
        </div>
      </el-scrollbar>

      <!-- 无关键字：先选页面，再展开该页元素 -->
      <div v-else class="eks-cols">
        <el-scrollbar max-height="280px" class="eks-col">
          <div
            v-for="pg in filteredPages"
            :key="pg.pageId"
            class="eks-page"
            :class="{ 'is-active': pg.pageId === activePageId }"
            @click="activePageId = pg.pageId"
          >
            <span class="eks-page-name">{{ pg.title }}</span>
            <span class="eks-page-count">{{ pg.elements.length }}</span>
          </div>
        </el-scrollbar>
        <el-scrollbar max-height="280px" class="eks-col eks-col-el">
          <template v-if="activePage">
            <div
              v-for="el in activePage.elements"
              :key="el.en"
              class="eks-el"
              :class="{ 'is-active': el.en === modelValue }"
              @click="pick(el.en)"
            >
              {{ el.label }}
            </div>
          </template>
          <div v-else class="eks-empty soft">请选择左侧页面</div>
        </el-scrollbar>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown, CircleClose } from '@element-plus/icons-vue'

export type ElementOption = {
  nameEn?: string
  nameZh?: string
  pageId?: string | null
}

export type PageOption = {
  pageId?: string
  nameZh?: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    elements?: ElementOption[]
    pages?: PageOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    elements: () => [],
    pages: () => [],
    placeholder: '先选页面，再选元素',
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const open = ref(false)
const keyword = ref('')
const activePageId = ref('')
const searchRef = ref<{ focus?: () => void } | null>(null)

const keywordTrim = computed(() => keyword.value.trim().toLowerCase())

function pageTitle(pageId: string) {
  if (!pageId || pageId === '__NONE__') return '未归属页面'
  const hit = (props.pages || []).find((p) => p.pageId === pageId)
  return hit?.nameZh || pageId
}

function elementLabel(el: ElementOption) {
  const zh = String(el.nameZh || '').trim()
  const en = String(el.nameEn || '').trim()
  if (zh && en) return `${zh}（${en}）`
  return zh || en || '—'
}

type PageGroup = {
  pageId: string
  title: string
  elements: Array<{ en: string; label: string; zh: string }>
}

/** 一级页面、二级元素。leaf value 用 nameEn，与步骤 elementKey 一致。 */
const pageGroups = computed<PageGroup[]>(() => {
  const list = props.elements || []
  const groups = new Map<string, ElementOption[]>()
  for (const el of list) {
    const en = String(el.nameEn || '').trim()
    if (!en) continue
    const pid = String(el.pageId || '').trim() || '__NONE__'
    if (!groups.has(pid)) groups.set(pid, [])
    groups.get(pid)!.push(el)
  }
  const keys = Array.from(groups.keys()).sort((a, b) => {
    if (a === '__NONE__') return 1
    if (b === '__NONE__') return -1
    return pageTitle(a).localeCompare(pageTitle(b), 'zh')
  })
  return keys.map((pid) => {
    const elements = (groups.get(pid) || [])
      .slice()
      .sort((a, b) => elementLabel(a).localeCompare(elementLabel(b), 'zh'))
      .map((el) => ({
        en: String(el.nameEn).trim(),
        label: elementLabel(el),
        zh: String(el.nameZh || '').trim()
      }))
    return {
      pageId: pid,
      title: pageTitle(pid),
      elements
    }
  })
})

const filteredPages = computed(() => {
  const q = keywordTrim.value
  if (!q) return pageGroups.value
  return pageGroups.value
    .map((pg) => {
      const pageHit = pg.title.toLowerCase().includes(q) || pg.pageId.toLowerCase().includes(q)
      const elements = pageHit
        ? pg.elements
        : pg.elements.filter(
            (el) =>
              el.label.toLowerCase().includes(q) ||
              el.en.toLowerCase().includes(q) ||
              el.zh.toLowerCase().includes(q)
          )
      return { ...pg, elements }
    })
    .filter((pg) => pg.elements.length > 0)
})

const flatHits = computed(() => {
  const hits: Array<{ en: string; pageTitle: string; elLabel: string }> = []
  for (const pg of filteredPages.value) {
    for (const el of pg.elements) {
      hits.push({ en: el.en, pageTitle: pg.title, elLabel: el.label })
    }
  }
  return hits
})

const activePage = computed(() =>
  filteredPages.value.find((p) => p.pageId === activePageId.value) || null
)

const selectedMeta = computed(() => {
  const key = String(props.modelValue || '').trim()
  if (!key) return null
  for (const pg of pageGroups.value) {
    const el = pg.elements.find((e) => e.en === key)
    if (el) return { pageTitle: pg.title, elLabel: el.label, pageId: pg.pageId }
  }
  return { pageTitle: '', elLabel: key, pageId: '' }
})

const displayText = computed(() => {
  const m = selectedMeta.value
  if (!m) return ''
  return m.pageTitle ? `${m.pageTitle} / ${m.elLabel}` : m.elLabel
})

const panelWidth = computed(() => (keywordTrim.value ? 420 : 520))

watch(
  () => [open.value, pageGroups.value, props.modelValue] as const,
  () => {
    if (!open.value) return
    const sel = selectedMeta.value
    if (sel?.pageId) {
      activePageId.value = sel.pageId
      return
    }
    if (!activePageId.value && pageGroups.value.length) {
      activePageId.value = pageGroups.value[0].pageId
    }
  },
  { immediate: true }
)

watch(open, (v) => {
  if (v) keyword.value = ''
})

watch(filteredPages, (pages) => {
  if (!pages.length) {
    activePageId.value = ''
    return
  }
  if (!pages.some((p) => p.pageId === activePageId.value)) {
    activePageId.value = pages[0].pageId
  }
})

function focusSearch() {
  nextTick(() => searchRef.value?.focus?.())
}

function close() {
  open.value = false
}

function pick(en: string) {
  emit('update:modelValue', en)
  close()
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.eks-trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  padding: 1px 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.eks-trigger:hover {
  border-color: var(--el-border-color-hover);
}
.eks-trigger.is-open {
  border-color: var(--el-color-primary);
}
.eks-trigger.is-disabled {
  cursor: not-allowed;
  background: var(--el-disabled-bg-color);
  color: var(--el-disabled-text-color);
}
.eks-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.eks-placeholder {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}
.eks-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.eks-clear:hover {
  color: var(--el-text-color-secondary);
}
.eks-arrow {
  transition: transform 0.15s;
}
.eks-trigger.is-open .eks-arrow {
  transform: rotate(180deg);
}

.eks-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eks-empty {
  padding: 16px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.eks-empty.soft {
  padding-top: 40px;
}
.eks-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}
.eks-col {
  min-width: 0;
}
.eks-col-el {
  border-left: 1px solid var(--el-border-color-lighter);
}
.eks-page,
.eks-el,
.eks-hit {
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.eks-page:hover,
.eks-el:hover,
.eks-hit:hover {
  background: var(--el-fill-color-light);
}
.eks-page.is-active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 600;
}
.eks-el.is-active,
.eks-hit.is-active {
  color: var(--el-color-primary);
  font-weight: 600;
}
.eks-page-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eks-page-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}
.eks-hit-page {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eks-hit-sep {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.eks-hit-el {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
