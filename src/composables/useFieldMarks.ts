import { reactive, ref } from 'vue'
import { apiClient, type FieldMarkItem } from '@/api'
import { changeSig, type DiffRow } from '@/utils/fieldDiff'

export interface EndpointRef {
  method: string
  path: string
}

function fieldKey(ep: EndpointRef, side: string, name: string) {
  return `${String(ep.method || '').toUpperCase()} ${ep.path}|${side}|${name}`
}

function create(project: string, refs: string) {
  const tags = reactive(new Map<string, string>())
  const confirms = reactive(new Set<string>())
  const tagNames = ref<string[]>([])
  const loaded = ref(false)
  let pending: Promise<void> | null = null

  function load(force = false) {
    if (pending && !force) return pending
    pending = (async () => {
      try {
        const r = await apiClient.getFieldMarks(project, refs)
        tags.clear()
        confirms.clear()
        for (const t of r.tags || []) tags.set(fieldKey(t, t.side, t.field), t.tag)
        for (const c of r.confirms || []) confirms.add(`${fieldKey(c, c.side, c.field)}|${c.changeSig}`)
        tagNames.value = r.tagNames || []
        loaded.value = true
      } catch {
        pending = null
      }
    })()
    return pending
  }

  function confirmKey(ep: EndpointRef, row: DiffRow) {
    return `${fieldKey(ep, row.side, row.name)}|${changeSig(row, refs)}`
  }

  function item(ep: EndpointRef, row: DiffRow, withSig: boolean): FieldMarkItem {
    return {
      method: String(ep.method || '').toUpperCase(),
      path: ep.path,
      side: row.side,
      field: row.name,
      changeSig: withSig ? changeSig(row, refs) : undefined
    }
  }

  function tagOf(ep: EndpointRef, row: DiffRow) {
    return tags.get(fieldKey(ep, row.side, row.name)) || ''
  }

  function isConfirmed(ep: EndpointRef, row: DiffRow) {
    return confirms.has(confirmKey(ep, row))
  }

  async function setTag(ep: EndpointRef, rows: DiffRow[], tag: string) {
    if (!rows.length) return
    const t = tag.trim()
    await apiClient.setFieldTag(project, t, rows.map((r) => item(ep, r, false)))
    for (const r of rows) {
      const k = fieldKey(ep, r.side, r.name)
      if (t) tags.set(k, t)
      else tags.delete(k)
    }
    if (t && !tagNames.value.includes(t)) tagNames.value = [t, ...tagNames.value]
  }

  async function setConfirmed(ep: EndpointRef, rows: DiffRow[], value: boolean) {
    if (!rows.length) return
    await apiClient.setFieldConfirmed(project, value, rows.map((r) => item(ep, r, true)))
    for (const r of rows) {
      const k = confirmKey(ep, r)
      if (value) confirms.add(k)
      else confirms.delete(k)
    }
  }

  /** 这个接口的字段按业务标签聚合：{ 胜率展示模块: 10 } */
  function tagSummary(ep: EndpointRef, rows: DiffRow[]) {
    const out = new Map<string, number>()
    for (const r of rows) {
      const t = tagOf(ep, r)
      if (t) out.set(t, (out.get(t) || 0) + 1)
    }
    return [...out.entries()].map(([tag, count]) => ({ tag, count }))
  }

  return { project, refs, loaded, tagNames, load, tagOf, isConfirmed, setTag, setConfirmed, tagSummary }
}

export type FieldMarks = ReturnType<typeof create>

const stores = new Map<string, FieldMarks>()

/** 同一个 项目 + 分支对 共用一份，接口对比页和测试面板里改了对方马上能看到 */
export function useFieldMarks(project: string, refs: string): FieldMarks {
  const key = `${project}\u0001${refs}`
  let s = stores.get(key)
  if (!s) {
    s = create(project, refs)
    stores.set(key, s)
  }
  s.load()
  return s
}

let pageNamesPromise: Promise<string[]> | null = null

/** UI 自动化页面库里的页面名，给业务标签当候选 */
export function loadUiPageNames(): Promise<string[]> {
  if (!pageNamesPromise) {
    pageNamesPromise = apiClient
      .getUiPages({ enabledOnly: true })
      .then((list) => [...new Set((list || []).map((p: any) => String(p?.nameZh || '').trim()).filter(Boolean))])
      .catch(() => {
        pageNamesPromise = null
        return []
      })
  }
  return pageNamesPromise
}
