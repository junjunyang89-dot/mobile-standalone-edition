/**
 * 抓包字段 ↔ 前端中文。
 *
 * 战绩页文案以 APP_FIELDS 为准（对照 swift-sphere）；
 * 对不上就在表格里改，改的会盖过，下次同名字段自动带上。
 */
import { APP_FIELDS } from './captureFrontendRules'

export type FieldRow = {
  path: string
  name: string
  sample: string
  labelKey: string
}

export type LabelSource = 'override' | 'app' | 'seed' | ''

const STORAGE_KEY = 'packet-capture:field-labels'

/** 战绩页（Deadlock 对局详情）用到的字段。key 是字段名，或 goldSourceMap.1 这种 map 项 */
export const SEED_LABELS: Record<string, string> = {
  code: '业务码',
  message: '提示',
  result: '业务数据',

  matchId: '对局 ID',
  duration: '时长（秒）',
  winner: '胜方（队伍号）',
  startTime: '开局时间',
  matchModeDesc: '模式',
  matchMode: '模式枚举',
  demoStatus: 'Demo 解析状态（0=获取中）',

  players: '玩家列表',
  steamId: 'Steam ID',
  name: '玩家名',
  team: '队伍',
  kills: '击杀',
  deaths: '死亡',
  assists: '助攻',
  kda: 'KDA',
  netWorth: '经济',
  heroId: '英雄 ID',
  heroImg: '英雄图',
  heroMinImg: '英雄小图',
  heroRenderImg: '英雄立绘',
  lastHits: '正补',
  denies: '反补',
  assignedLane: '分路（1上/4中/6下）',
  level: '等级',
  itemMap: '出装（按栏位）',
  itemList: '出装列表',
  abilityList: '技能加点时间线',
  abilitySortList: '技能终态',
  playerDamage: '输出',
  playerDamagePercent: '输出占比',
  playerDamageTaken: '承受伤害',
  playerDamageTakenPercent: '承伤占比',
  playerHealing: '治疗',
  playerHealingPercent: '治疗占比',
  bossDamage: '目标伤害',
  bossDamagePercent: '目标伤害占比',
  netWorthPercent: '经济占比',
  participationRate: '参团率',
  spm: 'SPM',
  score: '评分',
  scoreRank: '本场排名',
  mvp: 'MVP',
  svp: 'SVP',
  rank: '段位',
  rankImg: '段位图',
  maxKillStreak: '最高连杀',

  maxKillHeroId: '击杀最多（未出标签）',
  maxAssistHeroId: '最多助攻',
  maxNetWorthHeroId: '最高经济',
  maxDamageHeroId: '最高输出',
  maxBossDamageHeroId: '目标伤害最多（未出标签）',
  maxHealingHeroId: '治疗最多（未出标签）',
  maxDamageTakenHeroId: '最高承伤',
  maxLastHitsHeroId: '最多补兵',
  maxDeniesHeroId: '最多反补',
  maxKillStreakHeroId: '连续击杀',

  goldDeathLoss: '死亡损失',
  urnSouls: '灵翁获取',
  bulletDamage: '枪械伤害',
  abilityDamage: '技能伤害',
  meleeDamage: '近战伤害',
  headshotDmg: '爆头伤害',
  closeupDmg: '近距离伤害',
  longRangeDmg: '远距离伤害',
  heroHitRate: '命中率',
  heroHeadshotRate: '爆头命中率',
  damageAbsorbed: '伤害减免',
  dmgResistedPercent: '伤害减免比例',
  selfHealing: '自我治疗量',
  teammateHealing: '队友治疗量',
  teammateBarriering: '队友护盾量',
  healPrevented: '阻止治疗量',
  urnDeposits: '灵翁上交',
  midBoss: '中区头目',
  statueBuffs: '雕像增益',
  riftParticipations: '虚空裂隙',
  netWorthDiff: '经济差',
  goldSourceMap: '经济来源',
  treasureCnt: '箱子数',
  neutralKills: '野怪击杀',
  lastHitsSouls: '补兵经济',
  goldNeutralCreep: '野区经济',
  goldKills: '击杀获取',

  'goldSourceMap.1': '击杀获取',
  'goldSourceMap.2': '补兵经济',
  'goldSourceMap.3': '野怪经济（计入野区经济）',
  'goldSourceMap.4': 'Boss 经济',
  'goldSourceMap.5': '宝箱经济（计入野区经济）',
  'goldSourceMap.6': '助攻经济',
  'goldSourceMap.7': '反补经济',
  'goldSourceMap.8': '团队奖励',
  'goldSourceMap.9': '技能暗杀',
  'goldSourceMap.10': '奖杯收集者',
  'goldSourceMap.11': '邪教徒献祭',
  'goldSourceMap.12': '可破坏物',
  'goldSourceMap.13': '鹅蛋',

  weapon: '武器',
  vitality: '活力',
  spirit: '元灵',
  others: '其它栏位',
  itemType: '栏位类型（0技能/1武器/2活力/3元灵）',
  type: '类型',
  order: '技能槽位',
  time: '发生秒数',
  img: '图标',
  id: 'ID',

  heroLine: '分路经济',
  teamLine: '双方经济曲线',
  heroKillInfo: '击杀关系',
  objectives: '建筑/目标',
  heroGraph: '英雄曲线',
  playerInfoList: '分时切片',
  gameTime: '对局秒数',
  averageBadge: '平均段位',
  averageBadgeTeam0: '0 队平均段位',
  averageBadgeTeam1: '1 队平均段位',
  averageBadgeRankImg: '平均段位图'
}

export function labelKeyOf(path: string, name: string): string {
  const m = path.match(/goldSourceMap\.(\d+)$/)
  if (m) return `goldSourceMap.${m[1]}`
  return name
}

export function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveOverride(key: string, zh: string) {
  const all = loadOverrides()
  const trimmed = zh.trim()
  if (!trimmed) delete all[key]
  else all[key] = trimmed
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* 隐私模式写不了，当场仍可用 */
  }
}

export function resolveLabel(key: string, overrides = loadOverrides()): { zh: string; source: LabelSource } {
  if (overrides[key]) return { zh: overrides[key], source: 'override' }
  const app = APP_FIELDS[key]
  if (app?.zh) return { zh: app.zh, source: 'app' }
  if (SEED_LABELS[key]) return { zh: SEED_LABELS[key], source: 'seed' }
  return { zh: '', source: '' }
}

function preview(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `${value.length} 项`
  if (typeof value === 'object') return `${Object.keys(value).length} 个字段`
  return String(value)
}

function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]')
}

/**
 * 把响应 JSON 摊成「每种路径一行」。
 * players 有 12 个人也只留 players[].xxx，避免同一字段刷 12 遍。
 */
export function flattenFields(raw: unknown, maxDepth = 8): FieldRow[] {
  const rows = new Map<string, FieldRow>()

  const walk = (node: unknown, path: string, depth: number) => {
    if (node == null || depth > maxDepth) return
    if (Array.isArray(node)) {
      if (node.length && typeof node[0] === 'object' && node[0] !== null) {
        walk(node[0], `${path}[0]`, depth + 1)
      }
      return
    }
    if (typeof node !== 'object') return
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      const child = path ? `${path}.${key}` : key
      const norm = normalizePath(child)
      if (!rows.has(norm)) {
        rows.set(norm, {
          path: norm,
          name: key,
          sample: preview(val),
          labelKey: labelKeyOf(norm, key)
        })
      }
      if (val && typeof val === 'object') walk(val, child, depth + 1)
    }
  }

  walk(raw, '', 0)
  return [...rows.values()]
}

export function parseRespBody(raw: unknown): unknown {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
