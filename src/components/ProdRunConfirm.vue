<template>
  <Transition name="prc" appear @after-leave="emit('closed')">
    <div v-if="visible" class="prc-mask" @keydown.esc="finish('cancel')">
      <div ref="panelRef" class="prc-panel" role="dialog" aria-modal="true" tabindex="-1">
        <header class="prc-head">
          <div class="prc-icon">!</div>
          <div class="prc-head-main">
            <span class="prc-env"><i class="prc-dot" />线上环境 PROD</span>
            <h3 class="prc-title">确认要打到线上执行吗？</h3>
            <p class="prc-sub">{{ single ? '这个用例' : `这 ${cases.length} 个用例` }}会真实请求线上网关，产生真实数据</p>
          </div>
          <button type="button" class="prc-x" aria-label="取消执行" @click="finish('cancel')">×</button>
        </header>

        <div class="prc-body">
          <table class="prc-info">
            <tbody>
              <tr>
                <th>环境</th>
                <td><span class="prc-env-tag"><i class="prc-dot" />PROD</span><span class="prc-muted">线上，非测试环境</span></td>
              </tr>
              <tr>
                <th>用例</th>
                <td>
                  <template v-if="single">{{ caseLabel(cases[0]) }}</template>
                  <template v-else>
                    <div v-if="title" class="prc-strong">{{ title }}</div>
                    <ul class="prc-names">
                      <li v-for="c in shownCases" :key="c.id">{{ caseLabel(c) }}</li>
                      <li v-if="cases.length > shownCases.length" class="prc-muted">…还有 {{ cases.length - shownCases.length }} 条</li>
                    </ul>
                  </template>
                </td>
              </tr>
              <tr v-if="ifaceText">
                <th>接口</th>
                <td><code class="prc-code">{{ ifaceText }}</code></td>
              </tr>
              <tr>
                <th>数量</th>
                <td>{{ cases.length }} 个用例{{ durationText ? ` · 预计 ${durationText}` : '' }}</td>
              </tr>
            </tbody>
          </table>

          <div v-if="risk" class="prc-risk">
            <div class="prc-risk-head">
              <svg class="prc-risk-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 3 2 20h20L12 3Z" />
                <path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 10v4m0 3v.01" />
              </svg>
              需要注意
            </div>
            <p class="prc-risk-text">
              <template v-if="risk.scene">这条用例是 <code class="prc-chip">{{ risk.scene }}</code>，走的是异常分支。</template>
              <template v-else>其中 {{ risk.count }} 条走的是异常分支（空值、非法参数等）。</template>
              如果接口没有做校验，可能返回 500 或在线上留下异常日志。
            </p>
          </div>

          <div v-if="blocked.length" class="prc-blocked">
            <div class="prc-blocked-head">以下 {{ blocked.length }} 条不会跑</div>
            <ul>
              <li v-for="(b, i) in blocked.slice(0, 6)" :key="i">
                <span class="we-guard-tag" :class="b.cls">{{ b.tag }}</span>
                <span class="prc-blocked-name">{{ b.name }}</span>
                <div class="prc-muted prc-blocked-reason">{{ b.reason }}</div>
              </li>
              <li v-if="blocked.length > 6" class="prc-muted">…还有 {{ blocked.length - 6 }} 条</li>
            </ul>
          </div>

          <label class="prc-ack" :class="{ 'is-on': ack }">
            <input v-model="ack" type="checkbox" />
            <span class="prc-box" />
            <span>我已确认{{ single ? '这条用例' : '这些用例' }}不会写坏线上数据</span>
          </label>
        </div>

        <footer class="prc-foot">
          <button v-if="allowTest" type="button" class="prc-btn is-test" @click="finish('test')">先去测试环境试跑</button>
          <span class="prc-spacer" />
          <button type="button" class="prc-btn" @click="finish('cancel')">取消</button>
          <button type="button" class="prc-btn is-danger" :disabled="!ack" @click="finish('prod')">确认执行</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
export type ProdConfirmCase = { id: string; name?: string; method?: string; path?: string; durationMs?: number | null }
export type ProdConfirmBlocked = { name: string; tag: string; cls: string; reason: string }
export type ProdConfirmResult = 'prod' | 'test' | 'cancel'
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    cases: ProdConfirmCase[]
    blocked?: ProdConfirmBlocked[]
    title?: string
    allowTest?: boolean
  }>(),
  { blocked: () => [], title: '', allowTest: true }
)
const emit = defineEmits<{ (e: 'done', v: ProdConfirmResult): void; (e: 'closed'): void }>()

const visible = ref(true)
const ack = ref(false)
const panelRef = ref<HTMLElement>()
let result: ProdConfirmResult = 'cancel'

const single = computed(() => props.cases.length === 1)
const shownCases = computed(() => props.cases.slice(0, 5))

function caseLabel(c: ProdConfirmCase) {
  return c.name || `${c.method || ''} ${c.path || ''}`.trim() || c.id
}

const ifaceText = computed(() => {
  const keys = [...new Set(props.cases.map((c) => `${String(c.method || 'GET').toUpperCase()} ${c.path || ''}`.trim()))]
  if (!keys.length || !props.cases.some((c) => c.path)) return ''
  return keys.length === 1 ? keys[0] : `${keys.length} 个接口`
})

const durationText = computed(() => {
  const known = props.cases.map((c) => Number(c.durationMs)).filter((n) => Number.isFinite(n) && n > 0)
  if (!known.length) return ''
  const avg = known.reduce((a, b) => a + b, 0) / known.length
  const total = avg * props.cases.length
  return total < 1000 ? `${Math.round(total)}ms` : `${(total / 1000).toFixed(1)}s`
})

const ABNORMAL = /空|缺失|缺少|不传|未传|非法|无效|错误|异常|不存在|超长|越界|负数|格式错|过期|未登录|无权限/

function sceneOf(c: ProdConfirmCase) {
  return String(c.name || '').split(' · ').slice(1).join(' · ')
}

const risk = computed(() => {
  const abnormal = props.cases.filter((c) => ABNORMAL.test(sceneOf(c)))
  if (!abnormal.length) return null
  return { count: abnormal.length, scene: single.value ? sceneOf(abnormal[0]) : '' }
})

function finish(v: ProdConfirmResult) {
  if (!visible.value) return
  if (v === 'prod' && !ack.value) return
  result = v
  visible.value = false
  emit('done', result)
}

onMounted(() => nextTick(() => panelRef.value?.focus()))
</script>

<style scoped>
.prc-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}
.prc-panel {
  width: 560px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  outline: none;
  overflow: hidden;
}
.prc-head {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 24px 24px 4px;
}
.prc-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
}
.prc-head-main {
  min-width: 0;
  flex: 1;
}
.prc-env {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-regular);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.prc-env .prc-dot {
  color: var(--el-color-warning);
}
.prc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}
.prc-title {
  margin: 8px 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.prc-sub {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.prc-x {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.prc-x:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
.prc-body {
  padding: 16px 24px 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.prc-info {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  overflow: hidden;
  font-size: 14px;
}
.prc-info th,
.prc-info td {
  padding: 10px 14px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.prc-info tr:last-child th,
.prc-info tr:last-child td {
  border-bottom: 0;
}
.prc-info th {
  width: 96px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-right: 1px solid var(--el-border-color-lighter);
}
.prc-info td {
  color: var(--el-text-color-primary);
  word-break: break-all;
}
.prc-env-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 10px;
  padding: 1px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
  border: 1px solid var(--el-color-warning);
  border-radius: 6px;
  background: #fff;
}
.prc-env-tag .prc-dot {
  color: var(--el-color-warning);
}
.prc-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.prc-strong {
  font-weight: 600;
  margin-bottom: 4px;
}
.prc-names {
  margin: 0;
  padding-left: 16px;
}
.prc-names li + li {
  margin-top: 2px;
}
.prc-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
}
.prc-risk {
  padding: 18px 28px 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 4px solid var(--el-color-warning);
  border-radius: 4px 10px 10px 4px;
}
.prc-risk-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.prc-risk-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}
.prc-risk-text {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
}
.prc-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
}
.prc-blocked {
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  font-size: 13px;
}
.prc-blocked-head {
  margin-bottom: 4px;
  color: var(--app-text-regular);
}
.prc-blocked ul {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 160px;
  overflow: auto;
}
.prc-blocked li {
  padding: 5px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}
.prc-blocked-name {
  margin-left: 6px;
}
.prc-blocked-reason {
  margin-top: 2px;
  font-size: 12px;
}
.prc-ack {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.prc-ack.is-on {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
}
.prc-ack input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.prc-box {
  flex-shrink: 0;
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-dark, #c0c4cc);
  background: #fff;
  transition: all 0.15s;
}
.prc-ack.is-on .prc-box {
  background: var(--el-color-warning);
  border-color: var(--el-color-warning);
}
.prc-ack.is-on .prc-box::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.prc-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.prc-spacer {
  flex: 1;
}
.prc-btn {
  height: 36px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: all 0.15s;
}
.prc-btn:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.prc-btn.is-test {
  color: var(--el-color-warning-dark-2);
  border-color: var(--el-color-warning-light-5);
}
.prc-btn.is-test:hover {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.prc-btn.is-danger {
  color: #fff;
  border-color: var(--el-color-danger);
  background: var(--el-color-danger);
}
.prc-btn.is-danger:hover {
  background: var(--el-color-danger-light-3);
  border-color: var(--el-color-danger-light-3);
}
.prc-btn.is-danger:disabled {
  cursor: not-allowed;
  background: var(--el-color-danger-light-5);
  border-color: var(--el-color-danger-light-5);
}
.prc-enter-active,
.prc-leave-active {
  transition: opacity 0.18s;
}
.prc-enter-active .prc-panel,
.prc-leave-active .prc-panel {
  transition: transform 0.18s;
}
.prc-enter-from,
.prc-leave-to {
  opacity: 0;
}
.prc-enter-from .prc-panel,
.prc-leave-to .prc-panel {
  transform: scale(0.96);
}
</style>
