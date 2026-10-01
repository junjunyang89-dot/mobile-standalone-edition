import { type ComputedRef, type InjectionKey, computed, inject } from 'vue'

/** 当前页签是否正显示。隐藏页签里的 Teleport 要自己收起来，避免按钮叠到别的页上。 */
export const pagePaneActiveKey: InjectionKey<ComputedRef<boolean>> = Symbol('pagePaneActive')

export function usePagePaneActive() {
  return inject(pagePaneActiveKey, computed(() => true))
}
