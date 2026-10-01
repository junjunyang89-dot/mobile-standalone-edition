/**
 * 战绩页（swift-sphere deadlock/matchDetail）对 /gld/deadlock/match/detail 的用法。
 * 抓包字段对照拿它和后端 JSON 对，不靠猜。
 */

export type AppFieldUse = 'display' | 'judge' | 'derived' | 'css'

export type AppFieldMeta = {
  zh: string
  use: AppFieldUse
  note: string
}

export type JudgmentRow = {
  id: string
  title: string
  code: string
  sample: string
  outcome: string
}

/** 文案来自 src/lang/zh-CN/deadlock/matchDetail.json，判断来自 matchDetail 页面源码 */
export const APP_FIELDS: Record<string, AppFieldMeta> = {
  matchId: { zh: '对局 ID', use: 'display', note: '请求参数 / 页内跳转 Demo 回放' },
  duration: { zh: '时长（秒）', use: 'judge', note: '时间轴：Math.ceil(duration / 60) 分钟' },
  winner: { zh: '胜方（队伍号）', use: 'judge', note: 'winner === player.team → 胜，否则负' },
  matchMode: { zh: '模式枚举', use: 'judge', note: '== 2 街斗；1 标准。街斗藏经济、出塔伤、藏控图' },
  matchModeDesc: { zh: '模式', use: 'display', note: '头部直接展示' },
  demoStatus: { zh: 'Demo 解析状态', use: 'judge', note: '== 0 显示「数据陆续获取中」；控图类数字改成 --' },

  players: { zh: '玩家列表', use: 'display', note: '按 team 拆成两边' },
  steamId: { zh: 'Steam ID', use: 'judge', note: '找当前玩家、高亮「我」' },
  name: { zh: '玩家名', use: 'display', note: '' },
  team: { zh: '队伍', use: 'judge', note: '=== 0 隐王，=== 1 源祖' },
  kills: { zh: '击杀', use: 'display', note: '概览 K/D/A；对线 tab 再出一次' },
  deaths: { zh: '死亡', use: 'display', note: 'K/D/A' },
  assists: { zh: '助攻', use: 'display', note: 'K/D/A' },
  netWorth: { zh: '经济', use: 'display', note: '街斗模式不展示；概览按队求和' },
  heroId: { zh: '英雄 ID', use: 'judge', note: '点头像跳英雄；max* 标签用 includes(heroId)' },
  heroImg: { zh: '英雄图', use: 'display', note: '' },
  heroRenderImg: { zh: '英雄立绘', use: 'display', note: '高光封面' },
  lastHits: { zh: '正补', use: 'derived', note: '和 denies 拼成「正/反补」' },
  denies: { zh: '反补', use: 'derived', note: '和 lastHits 拼成「正/反补」' },
  assignedLane: { zh: '分路', use: 'judge', note: '1 上路（黄）/ 4 中路（蓝）/ 6 下路（绿）；其它值按上路兜底' },
  level: { zh: '等级', use: 'display', note: '头像角标；出装 level 另映射 I–V' },
  itemList: { zh: '出装列表', use: 'display', note: '' },
  abilitySortList: { zh: '技能终态', use: 'display', note: '' },
  playerDamage: { zh: '输出', use: 'display', note: '概览「输出」；对线 tab 再出「玩家伤害」' },
  playerDamagePercent: { zh: '输出占比', use: 'display', note: '' },
  playerDamageTaken: { zh: '承受伤害', use: 'display', note: '' },
  playerDamageTakenPercent: { zh: '承伤占比', use: 'display', note: '' },
  playerHealing: { zh: '治疗', use: 'display', note: '' },
  playerHealingPercent: { zh: '治疗占比', use: 'display', note: '' },
  bossDamage: { zh: '目标伤害 / 塔伤', use: 'display', note: '街斗模式概览改显示塔伤' },
  bossDamagePercent: { zh: '目标伤害占比', use: 'display', note: '街斗才跟塔伤一起出' },
  netWorthPercent: { zh: '经济占比', use: 'display', note: '街斗不展示经济' },
  participationRate: { zh: '参团率', use: 'display', note: '页面字段名 KP' },
  spm: { zh: 'SPM', use: 'display', note: '格式 {k}/Min' },
  score: { zh: '评分', use: 'display', note: '一位小数' },
  scoreRank: { zh: '本场排名', use: 'display', note: '#N' },
  mvp: { zh: 'MVP', use: 'judge', note: '真值出荣誉角标' },
  svp: { zh: 'SVP', use: 'judge', note: '真值出荣誉角标' },
  rank: { zh: '段位', use: 'display', note: '' },
  rankImg: { zh: '段位图', use: 'display', note: '有图才渲染段位组件' },
  maxKillStreak: { zh: '最高连杀', use: 'display', note: '标签文案：连续击杀 × {num}' },

  maxDamageHeroId: { zh: '最高输出', use: 'judge', note: 'maxDamageHeroId.includes(heroId) 出「最高输出」' },
  maxDamageTakenHeroId: { zh: '最高承伤', use: 'judge', note: 'includes(heroId)' },
  maxKillStreakHeroId: { zh: '连续击杀', use: 'judge', note: 'includes(heroId)' },
  maxNetWorthHeroId: { zh: '最高经济', use: 'judge', note: 'includes(heroId)' },
  maxAssistHeroId: { zh: '最多助攻', use: 'judge', note: 'includes(heroId)' },
  maxDeniesHeroId: { zh: '最多反补', use: 'judge', note: 'includes(heroId)' },
  maxLastHitsHeroId: { zh: '最多补兵', use: 'judge', note: 'includes(heroId)' },
  maxKillHeroId: { zh: '击杀最多', use: 'display', note: '战绩页没出这个标签' },
  maxBossDamageHeroId: { zh: '目标伤害最多', use: 'display', note: '战绩页没出这个标签' },
  maxHealingHeroId: { zh: '治疗最多', use: 'display', note: '战绩页没出这个标签' },

  goldDeathLoss: { zh: '死亡损失', use: 'display', note: '' },
  urnSouls: { zh: '灵翁获取', use: 'display', note: '0 显示 --' },
  bulletDamage: { zh: '枪械伤害', use: 'display', note: '' },
  abilityDamage: { zh: '技能伤害', use: 'display', note: '' },
  meleeDamage: { zh: '近战伤害', use: 'display', note: '' },
  headshotDmg: { zh: '爆头伤害', use: 'display', note: '0 显示 --' },
  closeupDmg: { zh: '近距离伤害', use: 'display', note: '0 显示 --' },
  longRangeDmg: { zh: '远距离伤害', use: 'display', note: '0 显示 --' },
  heroHitRate: { zh: '命中率', use: 'display', note: '截成整数百分比' },
  heroHeadshotRate: { zh: '爆头命中率', use: 'display', note: '截成整数百分比' },
  damageAbsorbed: { zh: '伤害减免', use: 'display', note: '' },
  dmgResistedPercent: { zh: '伤害减免比例', use: 'display', note: '' },
  selfHealing: { zh: '自我治疗量', use: 'display', note: '' },
  teammateHealing: { zh: '队友治疗量', use: 'display', note: '' },
  teammateBarriering: { zh: '队友护盾量', use: 'display', note: '' },
  healPrevented: { zh: '阻止治疗量', use: 'display', note: '' },
  urnDeposits: { zh: '灵翁上交', use: 'judge', note: 'demoStatus==0 时显示 --，解析完 0 也要出 0' },
  midBoss: { zh: '中区头目', use: 'judge', note: '同上，解析中 --' },
  statueBuffs: { zh: '雕像增益', use: 'judge', note: '同上，解析中 --' },
  riftParticipations: { zh: '虚空裂隙', use: 'judge', note: '同上，解析中 --' },
  treasureCnt: { zh: '箱子数', use: 'derived', note: '和 neutralKills 拼成「刷野/箱子」' },
  neutralKills: { zh: '野怪击杀', use: 'derived', note: '和 treasureCnt 拼成「刷野/箱子」' },
  goldSourceMap: { zh: '经济来源', use: 'derived', note: '不整表展示，按下标拆成几项经济' },
  'goldSourceMap.1': { zh: '击杀获取', use: 'derived', note: '页面 goldKills = map[1]' },
  'goldSourceMap.2': { zh: '补兵经济', use: 'derived', note: '页面 lastHitsSouls = map[2]' },
  'goldSourceMap.3': { zh: '野怪经济', use: 'derived', note: '不单独出，和 .5 相加 = 野区经济' },
  'goldSourceMap.4': { zh: 'Boss 经济', use: 'display', note: '战绩页没有单独展示' },
  'goldSourceMap.5': { zh: '宝箱经济', use: 'derived', note: '不单独出，和 .3 相加 = 野区经济' },
  'goldSourceMap.6': { zh: '助攻经济', use: 'display', note: '战绩页没有单独展示' },
  lastHitsSouls: {
    zh: '补兵经济',
    use: 'derived',
    note: '页面不读这个字段，用 goldSourceMap.2'
  },
  goldNeutralCreep: {
    zh: '野区经济',
    use: 'derived',
    note: '页面不读这个字段，用 goldSourceMap.3 + .5'
  },
  goldKills: {
    zh: '击杀获取',
    use: 'derived',
    note: '页面不读这个字段，用 goldSourceMap.1'
  },
  netWorthDiff: {
    zh: '经济差',
    use: 'derived',
    note: '对线 tab 取 playerInfoList[2].netWorthDiff，不是玩家根上的字段'
  },
  playerInfoList: {
    zh: '分时切片',
    use: 'derived',
    note: '对线经济差固定取下标 2（第 3 个点）'
  },
  itemType: { zh: '栏位类型', use: 'css', note: 'CSS class level-{itemType}，不出中文' },
  img: { zh: '图标', use: 'display', note: '' },
  id: { zh: 'ID', use: 'judge', note: '出装点开会按 id 打开详情' },
  order: { zh: '技能槽位', use: 'judge', note: '点技能图标按 order 打开' },
  userId: { zh: '用户 ID', use: 'judge', note: '点名字跳资料' }
}

const LANE: Record<number, string> = { 1: '上路（黄）', 4: '中路（蓝）', 6: '下路（绿）' }

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function preview(v: unknown): string {
  if (v == null) return 'null'
  if (typeof v === 'string') return v.length > 80 ? `${v.slice(0, 80)}…` : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    const s = JSON.stringify(v)
    return s.length > 80 ? `${s.slice(0, 80)}…` : s
  } catch {
    return String(v)
  }
}

function mapGet(map: unknown, key: string): number {
  if (!map || typeof map !== 'object') return 0
  const o = map as Record<string, unknown>
  return num(o[key] ?? o[Number(key) as unknown as string])
}

function includesHero(field: unknown, heroId: unknown): boolean {
  if (field == null || heroId == null) return false
  if (Array.isArray(field)) return field.some((x) => String(x) === String(heroId))
  if (typeof field === 'string' || typeof field === 'number') {
    return String(field).includes(String(heroId))
  }
  return false
}

export function unwrapMatchDetail(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const cand =
    o.result && typeof o.result === 'object' && !Array.isArray(o.result)
      ? (o.result as Record<string, unknown>)
      : o
  if (Array.isArray(cand.players) || cand.demoStatus != null || cand.matchId != null) return cand
  return null
}

export function appMetaOf(labelKey: string): AppFieldMeta | undefined {
  return APP_FIELDS[labelKey]
}

/** 用这一条响应，把战绩页会怎么走算出来 */
export function evaluateMatchJudgments(raw: unknown): JudgmentRow[] | null {
  const match = unwrapMatchDetail(raw)
  if (!match) return null
  const players = Array.isArray(match.players) ? (match.players as Record<string, unknown>[]) : []
  const p0 = players[0] || {}
  const laneRaw = num(p0.assignedLane)
  const laneShown = LANE[laneRaw] || `非法值 ${laneRaw}，页面按上路兜底`
  const gold = p0.goldSourceMap
  const slice = Array.isArray(p0.playerInfoList) ? p0.playerInfoList : []
  const slice2 = slice[2] && typeof slice[2] === 'object' ? (slice[2] as Record<string, unknown>) : {}
  const derivedLastHits = mapGet(gold, '2')
  const derivedNeutral = mapGet(gold, '3') + mapGet(gold, '5')
  const derivedKills = mapGet(gold, '1')
  const parsing = match.demoStatus == 0
  const street = match.matchMode == 2
  const tagged = players.filter((p) => includesHero(match.maxDamageHeroId, p.heroId)).map((p) => p.name)

  return [
    {
      id: 'demoStatus',
      title: 'Demo 解析中',
      code: 'demoStatus == 0',
      sample: preview(match.demoStatus),
      outcome: parsing ? '出「数据陆续获取中」；控图数字显示 --' : '正常展示数据'
    },
    {
      id: 'matchMode',
      title: '街斗模式',
      code: 'matchMode == 2',
      sample: `${preview(match.matchMode)} / ${preview(match.matchModeDesc)}`,
      outcome: street ? '藏经济、出塔伤、藏控图 tab' : '标准：出经济、出控图'
    },
    {
      id: 'team',
      title: '阵营名',
      code: 'team === 0 隐王；=== 1 源祖',
      sample: players
        .slice(0, 2)
        .map((p) => `${p.name}:${p.team}`)
        .join('，') || preview(p0.team),
      outcome: '概览两边队名按这个枚举，不是 winner'
    },
    {
      id: 'winner',
      title: '胜负',
      code: 'winner === player.team',
      sample: preview(match.winner),
      outcome: `胜方队伍号 ${preview(match.winner)}`
    },
    {
      id: 'assignedLane',
      title: '分路',
      code: 'assignedLane 1 / 4 / 6，其它当 1',
      sample: players
        .slice(0, 4)
        .map((p) => `${p.name}:${p.assignedLane}`)
        .join('，'),
      outcome: `第一个玩家会画成 ${laneShown}`
    },
    {
      id: 'goldKills',
      title: '击杀获取',
      code: 'goldKills = goldSourceMap[1]',
      sample: `map.1=${mapGet(gold, '1')}；根字段 goldKills=${preview(p0.goldKills)}`,
      outcome: `页面用 ${derivedKills}（不理根上的 goldKills）`
    },
    {
      id: 'lastHitsSouls',
      title: '补兵经济',
      code: 'lastHitsSouls = goldSourceMap[2]',
      sample: `map.2=${mapGet(gold, '2')}；根字段 lastHitsSouls=${preview(p0.lastHitsSouls)}`,
      outcome: `页面用 ${derivedLastHits}`
    },
    {
      id: 'goldNeutral',
      title: '野区经济',
      code: 'goldNeutralCreep = map[3] + map[5]',
      sample: `map.3=${mapGet(gold, '3')} map.5=${mapGet(gold, '5')}；根字段=${preview(p0.goldNeutralCreep)}`,
      outcome: `页面用 ${derivedNeutral}`
    },
    {
      id: 'netWorthDiff',
      title: '对线经济差',
      code: 'playerInfoList[2].netWorthDiff',
      sample: `切片数 ${slice.length}；[2].netWorthDiff=${preview(slice2.netWorthDiff)}；根字段=${preview(p0.netWorthDiff)}`,
      outcome:
        slice.length > 2
          ? `页面用 ${num(slice2.netWorthDiff)}`
          : '切片不足 3 个，页面会当成 0'
    },
    {
      id: 'maxDmg',
      title: '最高输出标签',
      code: 'maxDamageHeroId.includes(heroId)',
      sample: preview(match.maxDamageHeroId),
      outcome: tagged.length ? `会打在：${tagged.join('、')}` : '这一条没人中标签（或类型对不上 includes）'
    },
    {
      id: 'parseHold',
      title: '解析中占位',
      code: 'isParsing 时 urnDeposits/midBoss/裂隙/雕像/--',
      sample: `demoStatus=${preview(match.demoStatus)}`,
      outcome: parsing ? '这四项显示 --，即使后端已经给了数字' : '按后端数字展示，0 也出 0'
    }
  ]
}
