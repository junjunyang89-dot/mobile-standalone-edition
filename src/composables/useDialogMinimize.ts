import { reactive } from 'vue'

/**
 * 弹窗「放到后台」：只把遮罩藏起来，弹窗组件本身不关，填到一半的内容都还在。
 *
 * 不改各页面的 el-dialog / el-drawer，靠监听 DOM 给每个弹窗头部补一个按钮；
 * 个别弹窗不想要这个按钮，给它加 class="no-bg-minimize"。
 */

export type MinimizedDialog = {
  id: number
  title: string
  tabKey: string
  tabLabel: string
  overlay: HTMLElement
}

type Host = {
  currentTab: () => { key: string; label: string }
  openTab: (key: string) => Promise<void>
}

const HIDDEN_CLASS = 'is-bg-minimized'
const BTN_CLASS = 'dlg-bg-btn'
const PANEL_SELECTOR = '.el-dialog, .el-drawer'
const MINUS_SVG =
  '<svg viewBox="0 0 1024 1024" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M128 544h768a32 32 0 1 0 0-64H128a32 32 0 0 0 0 64z"/></svg>'

export const minimizedDialogs = reactive<MinimizedDialog[]>([])

let host: Host | null = null
let observer: MutationObserver | null = null
let pruneTimer: number | undefined
let seq = 0

function titleOf(panel: HTMLElement): string {
  const el = panel.querySelector('.el-dialog__title, .el-drawer__title, .el-dialog__header, .el-drawer__header')
  const text = (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 40) || '弹窗'
}

function headerOf(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector(':scope > .el-dialog__header, :scope > .el-drawer__header, :scope > header')
}

function decorate(panel: HTMLElement) {
  if (panel.classList.contains('no-bg-minimize')) return
  const header = headerOf(panel)
  if (!header) return
  let btn = header.querySelector<HTMLElement>(`.${BTN_CLASS}`)
  if (!btn) {
    btn = document.createElement('button')
    btn.setAttribute('type', 'button')
    btn.className = BTN_CLASS
    btn.title = '放到后台：内容会保留，右下角点一下就回来'
    btn.setAttribute('aria-label', '放到后台')
    btn.innerHTML = MINUS_SVG
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      minimize(panel)
    })
  }
  // 自己画了头部和关闭钮的弹窗，默认的绝对定位会压在头部内容上，跟着它的关闭钮排。
  // 头部内容可能晚于面板渲染，所以每次都重新摆一次位置，摆对了就不动
  const drawerClose = header.querySelector(':scope > .el-drawer__close-btn')
  const customClose = header.querySelector<HTMLElement>(
    'button[aria-label="关闭"]:not(.el-dialog__headerbtn):not(.el-drawer__close-btn)'
  )
  const anchor = drawerClose || customClose
  if (anchor?.parentElement) {
    if (btn.nextElementSibling !== anchor) anchor.parentElement.insertBefore(btn, anchor)
  } else if (btn.parentElement !== header) {
    header.appendChild(btn)
  }
}

function scan(root: ParentNode) {
  if (root instanceof HTMLElement) {
    const owner = root.closest<HTMLElement>(PANEL_SELECTOR)
    if (owner) decorate(owner)
  }
  root.querySelectorAll?.<HTMLElement>(PANEL_SELECTOR).forEach(decorate)
}

function minimize(panel: HTMLElement) {
  const overlay = panel.closest<HTMLElement>('.el-overlay')
  if (!overlay || !host) return
  const active = document.activeElement
  if (active instanceof HTMLElement && overlay.contains(active)) active.blur()
  overlay.classList.add(HIDDEN_CLASS)
  const tab = host.currentTab()
  minimizedDialogs.push({ id: ++seq, title: titleOf(panel), tabKey: tab.key, tabLabel: tab.label, overlay })
  schedulePrune()
}

export async function restoreDialog(id: number) {
  const idx = minimizedDialogs.findIndex((d) => d.id === id)
  if (idx < 0) return
  const item = minimizedDialogs[idx]
  if (host) await host.openTab(item.tabKey)
  minimizedDialogs.splice(idx, 1)
  item.overlay.classList.remove(HIDDEN_CLASS)
  prune()
}

/** 页签被关、页面自己把弹窗关了：后台条目跟着消失 */
function prune() {
  for (let i = minimizedDialogs.length - 1; i >= 0; i--) {
    const o = minimizedDialogs[i].overlay
    if (!o.isConnected || o.style.display === 'none') {
      o.classList.remove(HIDDEN_CLASS)
      minimizedDialogs.splice(i, 1)
    }
  }
  if (!minimizedDialogs.length && pruneTimer !== undefined) {
    window.clearInterval(pruneTimer)
    pruneTimer = undefined
  }
}

function schedulePrune() {
  if (pruneTimer === undefined) pruneTimer = window.setInterval(prune, 1500)
}

/**
 * Element Plus 按 Esc 会通知所有打开着的弹窗，藏在后台的那个也会被关掉、内容丢失。
 * 有后台弹窗时在 body 冒泡阶段截住 Esc，输入框、下拉框自己的 Esc 不受影响。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && minimizedDialogs.length) e.stopPropagation()
}

export function startDialogMinimize(h: Host) {
  host = h
  if (observer) return
  scan(document.body)
  observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) scan(n)
      })
    }
    if (minimizedDialogs.length) prune()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  document.body.addEventListener('keydown', onKeydown)
}

export function stopDialogMinimize() {
  observer?.disconnect()
  observer = null
  document.body.removeEventListener('keydown', onKeydown)
  host = null
}
