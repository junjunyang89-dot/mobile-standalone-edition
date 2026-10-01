<template>
  <div v-show="active" class="page-pane">
    <router-view :route="location as any" />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, shallowReactive, toRef } from 'vue'
import { routeLocationKey } from 'vue-router'
import { pagePaneActiveKey } from '../utils/pagePane'

const props = defineProps<{
  location: Record<string, any>
  active: boolean
}>()

/**
 * 每个页签自己一份路由。页面里的 useRoute() 读的是这里，
 * 切到别的页签时，藏着的页面不会跟着地址栏改掉自己的参数。
 */
const locationRef = toRef(props, 'location')
const exposed: Record<string, unknown> = {}
for (const key of ['fullPath', 'path', 'hash', 'name', 'params', 'query', 'meta', 'matched', 'redirectedFrom', 'href']) {
  Object.defineProperty(exposed, key, {
    enumerable: true,
    get() {
      return locationRef.value?.[key]
    }
  })
}
provide(routeLocationKey, shallowReactive(exposed) as any)
provide(pagePaneActiveKey, computed(() => props.active))
</script>

<style scoped>
.page-pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 20px;
  background: var(--app-main-bg);
}
</style>
