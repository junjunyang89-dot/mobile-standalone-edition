export type InspectBounds = { left: number; top: number; right: number; bottom: number }

export type InspectNode = {
  nodePath?: string
  xpath?: string
  className?: string
  resourceId?: string
  text?: string
  contentDesc?: string
  clickable?: boolean
  displayed?: boolean
  bounds?: InspectBounds
  screenBounds?: InspectBounds
  children?: InspectNode[]
}

export function nodeBox(n: InspectNode | null | undefined) {
  return n?.screenBounds || n?.bounds || null
}

export function boxArea(b: InspectBounds) {
  return Math.max(1, (b.right - b.left) * (b.bottom - b.top))
}

export function boxContains(b: InspectBounds, x: number, y: number) {
  return x >= b.left && x < b.right && y >= b.top && y < b.bottom
}

/** 点在截图上时，取面积最小的包围节点——和 Inspector 点图选树同一规则，不猜。 */
export function findSmallestNodeAt(root: InspectNode | null | undefined, x: number, y: number) {
  let best: InspectNode | null = null
  let bestArea = Infinity
  walkInspect(root, (n) => {
    const b = nodeBox(n)
    if (!b || !boxContains(b, x, y)) return
    const area = boxArea(b)
    if (area < bestArea) {
      bestArea = area
      best = n
    }
  })
  return best
}

export function findNodeByPath(root: InspectNode | null | undefined, path: string | null | undefined) {
  if (!root || !path) return null
  let hit: InspectNode | null = null
  walkInspect(root, (n) => {
    if (n.nodePath === path) hit = n
  })
  return hit
}

export function walkInspect(root: InspectNode | null | undefined, visit: (n: InspectNode) => void) {
  if (!root) return
  visit(root)
  for (const c of root.children || []) walkInspect(c, visit)
}

export function nodeTitle(n: InspectNode) {
  const t = String(n.text || n.contentDesc || '').trim()
  if (t) return t.length > 40 ? `${t.slice(0, 40)}…` : t
  const id = String(n.resourceId || '').split('/').pop()
  if (id) return id
  const cls = String(n.className || '').split('.').pop()
  return cls || '节点'
}

export function nodeMatchesQuery(n: InspectNode, q: string) {
  if (!q) return true
  const blob = [n.text, n.contentDesc, n.resourceId, n.className, n.xpath, n.nodePath]
    .map((s) => String(s || '').toLowerCase())
    .join('\n')
  return blob.includes(q.toLowerCase())
}

export function ancestorPaths(root: InspectNode | null | undefined, path: string | null | undefined) {
  if (!root || !path) return []
  const chain: InspectNode[] = []
  const walk = (n: InspectNode, acc: InspectNode[]): boolean => {
    const next = [...acc, n]
    if (n.nodePath === path) {
      chain.push(...next)
      return true
    }
    for (const c of n.children || []) {
      if (walk(c, next)) return true
    }
    return false
  }
  walk(root, [])
  return chain
}
