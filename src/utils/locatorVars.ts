/** 从定位串里抽出 ${变量名}，与后端 LocatorTemplate.variablesIn 一致 */
export function locatorVarNames(...chunks: Array<string | null | undefined>): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const re = /\$\{([A-Za-z0-9_]+)}/g
  for (const chunk of chunks) {
    if (!chunk) continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(String(chunk)))) {
      if (!seen.has(m[1])) {
        seen.add(m[1])
        names.push(m[1])
      }
    }
  }
  return names
}

export function elementLocatorVars(el: {
  locatorValue?: string
  locatorFallbacks?: string
} | null | undefined): string[] {
  if (!el) return []
  return locatorVarNames(el.locatorValue, el.locatorFallbacks)
}
