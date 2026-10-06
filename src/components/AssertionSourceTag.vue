<template>
  <el-popover v-if="verdict" trigger="click" placement="bottom-start" :width="420">
    <template #reference>
      <span class="as-tag" :class="verdict === 'verified' ? 'is-ok' : 'is-warn'" @click.stop>
        {{ verdict === 'verified' ? '断言已验证' : '断言未验证' }}
      </span>
    </template>
    <div class="as-pop">
      <div class="as-head">
        {{ verdict === 'verified'
          ? '每条断言都在真实响应上对过（抓包或试跑）'
          : '有断言没在真实响应上验证过，绿了也不代表接口对；跑一次或抓一次包确认后再启用' }}
      </div>
      <div v-for="(l, i) in lines" :key="i" class="as-row">
        <code class="as-what">{{ l.what }}</code>
        <span
          class="as-src"
          :class="l.source ? srcCls(l.source) : 'is-none'"
        >{{ l.source ? ASSERTION_SOURCE_META[l.source].text : '没有出处记录' }}</span>
        <div v-if="l.evidence" class="as-evi">{{ l.evidence }}</div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ASSERTION_SOURCE_META,
  assertionLines,
  assertionVerdict,
  type AssertionSourceKey
} from '../utils/assertionSource'

const props = defineProps<{ assertions?: string | null }>()

const lines = computed(() => assertionLines(props.assertions))
const verdict = computed(() => assertionVerdict(props.assertions))

function srcCls(s: AssertionSourceKey) {
  const v = ASSERTION_SOURCE_META[s].verified
  return v === true ? 'is-ok' : v === false ? 'is-warn' : 'is-none'
}
</script>

<style scoped>
.as-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
  border: 1px solid transparent;
}
.as-tag.is-ok { color: var(--el-color-success-dark-2); background: var(--el-color-success-light-9); border-color: var(--el-color-success-light-7); }
.as-tag.is-warn { color: var(--el-color-warning-dark-2); background: var(--el-color-warning-light-9); border-color: var(--el-color-warning-light-5); }
.as-pop { font-size: 12px; line-height: 1.6; }
.as-head { color: var(--el-text-color-secondary); margin-bottom: 8px; }
.as-row { padding: 6px 0; border-top: 1px solid var(--el-border-color-lighter); }
.as-what { font-family: ui-monospace, Menlo, monospace; margin-right: 8px; word-break: break-all; }
.as-src { white-space: nowrap; }
.as-src.is-ok { color: var(--el-color-success-dark-2); }
.as-src.is-warn { color: var(--el-color-warning-dark-2); }
.as-src.is-none { color: var(--el-text-color-secondary); }
.as-evi { color: var(--el-text-color-secondary); }
</style>
