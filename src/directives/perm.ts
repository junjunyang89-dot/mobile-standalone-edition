import type { App, DirectiveBinding } from 'vue'
import { canDelete, canWrite } from '../stores/auth'

/**
 * `v-perm:delete` / `v-perm:write` —— 权限不足时把按钮<b>禁用</b>，不是隐藏。
 *
 * 隐藏了用户会以为是 bug 来找你（「我这里怎么没有删除按钮」）；
 * 禁用加一句 title 才说得清「这是权限，不是坏了」。
 *
 * 它只是体验层。真正的边界在后端 AuthFilter——客户端是 Electron 打包分发的，
 * 前端这层随便就能绕过去。
 */

function allowed(arg?: string): boolean {
  return arg === 'delete' ? canDelete.value : canWrite.value
}

function hint(arg?: string): string {
  return arg === 'delete'
    ? '需要「管理员」权限才能删除'
    : '当前账号是只读，不能修改'
}

function apply(el: HTMLElement, binding: DirectiveBinding) {
  const ok = allowed(binding.arg)
  // el-button 渲染出来就是一个真实的 <button>，指令挂在组件上时 el 就是它
  const target = el instanceof HTMLButtonElement ? el : el.querySelector('button')
  if (ok) {
    el.classList.remove('is-disabled')
    el.removeAttribute('title')
    if (target) target.disabled = false
    el.style.removeProperty('pointer-events')
    el.style.removeProperty('opacity')
    return
  }
  el.classList.add('is-disabled')
  el.setAttribute('title', hint(binding.arg))
  if (target) {
    target.disabled = true
  } else {
    // 不是原生按钮时（自定义组件、a 标签）只能靠样式挡住点击
    el.style.pointerEvents = 'none'
    el.style.opacity = '0.5'
  }
}

export default {
  install(app: App) {
    app.directive('perm', {
      mounted: apply,
      updated: apply
    })
  }
}
