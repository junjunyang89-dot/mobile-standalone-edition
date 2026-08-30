/** Bug 优先级：库内仍存 CRITICAL/HIGH/MEDIUM/LOW，界面统一显示 P0–P3 */
export const BUG_PRIORITIES = [
  { value: 'CRITICAL', label: 'P0', prefix: '↑' },
  { value: 'HIGH', label: 'P1', prefix: '▲' },
  { value: 'MEDIUM', label: 'P2', prefix: '—' },
  { value: 'LOW', label: 'P3', prefix: '↓' }
] as const

export type BugPriorityValue = (typeof BUG_PRIORITIES)[number]['value']

export function bugPriorityLabel(value?: string | null): string {
  const s = String(value || 'MEDIUM').trim().toUpperCase()
  if (s.startsWith('P0') || s === 'CRITICAL') return 'P0'
  if (s.startsWith('P1') || s === 'HIGH') return 'P1'
  if (s.startsWith('P2') || s === 'MEDIUM') return 'P2'
  if (s.startsWith('P3') || s === 'LOW') return 'P3'
  return 'P2'
}

export function bugPriorityDisplay(value?: string | null): string {
  const item = BUG_PRIORITIES.find((p) => p.value === normalizeBugPriority(value))
  return item ? `${item.prefix} ${item.label}` : bugPriorityLabel(value)
}

export function normalizeBugPriority(value?: string | null): BugPriorityValue {
  const s = String(value || 'MEDIUM').trim().toUpperCase()
  if (s.startsWith('P0') || s === 'CRITICAL') return 'CRITICAL'
  if (s.startsWith('P1') || s === 'HIGH') return 'HIGH'
  if (s.startsWith('P2') || s === 'MEDIUM') return 'MEDIUM'
  if (s.startsWith('P3') || s === 'LOW') return 'LOW'
  return 'MEDIUM'
}
