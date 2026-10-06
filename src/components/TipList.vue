<template>
  <div v-if="merged.length" class="tl" :class="`tl-${tone || 'tip'}`">
    <ul class="tl-list">
      <li v-for="(it, i) in shown" :key="i">
        <span>{{ it.text }}</span>
        <div v-if="it.names.length" class="tl-names">
          <code v-for="n in namesOf(it, i)" :key="n">{{ n }}</code>
          <button v-if="it.names.length > NAME_LIMIT" type="button" class="tl-more" @click="toggleNames(i)">
            {{ openNames.has(i) ? '收起' : `还有 ${it.names.length - NAME_LIMIT} 个` }}
          </button>
        </div>
      </li>
    </ul>
    <button v-if="merged.length > 1" type="button" class="tl-toggle" @click="open = !open">
      {{ open ? '收起 ▴' : `展开其余 ${merged.length - 1} 条 ▾` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{
  items: string[]
  /** tip：黄色提示条；plain：跟在正文下面的普通列表 */
  tone?: 'tip' | 'plain'
}>()

interface Item {
  text: string
  names: string[]
}

const NAME_LIMIT = 6

/**
 * 后端按字段逐条写提示（「返回多了 xxx：确认有值…」），字段一多就是几十条同一句话。
 * 开头和后半句都一样的合成一条，字段名单独列出来。
 */
const PER_FIELD = /^(返回多了|返回少了字段|新入参|入参|请求体)\s+([\w$.[\]]+)((?:（[^）]*）)?)：(.+)$/

const merged = computed<Item[]>(() => {
  const out: Item[] = []
  const groups = new Map<string, { prefix: string; suffix: string; tail: string; names: string[]; at: number }>()
  for (const raw of props.items) {
    const m = PER_FIELD.exec(raw)
    if (!m) {
      out.push({ text: raw, names: [] })
      continue
    }
    const [, prefix, name, suffix, tail] = m
    const key = `${prefix}|${suffix}|${tail}`
    const g = groups.get(key)
    if (g) {
      g.names.push(name)
    } else {
      groups.set(key, { prefix, suffix, tail, names: [name], at: out.length })
      out.push({ text: raw, names: [] })
    }
  }
  for (const g of groups.values()) {
    if (g.names.length < 2) continue
    const what = g.prefix === '返回少了字段' ? '返回少了' : g.prefix
    const unit = g.prefix.endsWith('入参') ? '个参数' : '个字段'
    out[g.at] = { text: `${what} ${g.names.length} ${unit}${g.suffix}：${g.tail}`, names: g.names }
  }
  return out
})

const open = ref(false)
const openNames = reactive(new Set<number>())

const shown = computed(() => (open.value ? merged.value : merged.value.slice(0, 1)))

function namesOf(it: Item, i: number) {
  return openNames.has(i) ? it.names : it.names.slice(0, NAME_LIMIT)
}

function toggleNames(i: number) {
  if (openNames.has(i)) openNames.delete(i)
  else openNames.add(i)
}

watch(
  () => props.items,
  () => {
    open.value = false
    openNames.clear()
  }
)
</script>

<style scoped>
.tl-tip {
  margin: 0 0 10px;
  padding: 6px 12px 6px 26px;
  border-left: 3px solid #e3a008;
  border-radius: 0 6px 6px 0;
  background: #fffbeb;
  font-size: 12.5px;
  line-height: 1.75;
  color: #7c5a10;
}

.tl-plain {
  margin-top: 6px;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.tl-list {
  margin: 0;
  padding: 0;
}

.tl-names {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin: 2px 0 4px;
}

.tl-names code {
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.75);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 20px;
}

.tl-more,
.tl-toggle {
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.tl-toggle {
  margin-left: -14px;
}

.tl-more:hover,
.tl-toggle:hover {
  text-decoration: underline;
}
</style>
