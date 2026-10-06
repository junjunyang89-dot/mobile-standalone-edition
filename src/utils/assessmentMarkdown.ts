/**
 * 《代码 Diff 对比分析与测试评估报告（标准版）》：勾选项的人工覆盖规则 + 导出 Markdown。
 * 页面展示和复制出去的文档共用这里的判断，免得两边勾的不一样。
 */

export interface Check {
  label: string
  checked: boolean
  basis?: string
}

export type Manual = Record<string, string>

export const RISK_LABEL: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低' }

export function ckKey(group: string, label: string) {
  return `ck:${group}:${label}`
}

/** 人工点过的以人工为准，没点过用自动判断 */
export function isChecked(manual: Manual | undefined, group: string, c: Check | null | undefined) {
  if (!c) return false
  const v = manual?.[ckKey(group, c.label)]
  if (v === '1') return true
  if (v === '0') return false
  return !!c.checked
}

export function effectiveRisk(a: any, manual: Manual | undefined) {
  return manual?.riskLevel || a?.riskLevel || ''
}

function box(on: boolean) {
  return on ? '☑' : '☐'
}

function checks(manual: Manual, group: string, list: Check[] | undefined) {
  return (list || []).map((c) => `${box(isChecked(manual, group, c))} ${c.label}`).join('  ')
}

function yesNo(manual: Manual, group: string, c: Check | null | undefined) {
  const on = isChecked(manual, group, c)
  return `${box(on)} 是  ${box(!on)} 否${c?.basis ? `（${c.basis}）` : ''}`
}

function bullets(items: string[] | undefined, empty = '无', indent = '') {
  const list = (items || []).filter((s) => s && s.trim())
  if (!list.length) return `${indent}- ${empty}`
  return list.map((s) => `${indent}- ${s}`).join('\n')
}

function text(v: string | undefined, empty = '（待补充）') {
  const s = (v || '').trim()
  return s ? s : empty
}

const FILE_STATUS: Record<string, string> = { ADDED: '新增', MODIFIED: '修改', DELETED: '删除' }

export function fileStatusLabel(s: string) {
  return FILE_STATUS[s] || s || '修改'
}

const CHANGE_LABEL: Record<string, string> = { ADDED: '新增', REMOVED: '下线', MODIFIED: '修改' }

export function apiChangeLabel(d: any) {
  if (d?.risk === 'BREAKING') return '不兼容'
  if (d?.risk === 'IMPL') return '实现改了'
  return CHANGE_LABEL[d?.changeType] || '修改'
}

export const CHECK_STATUS_LABEL: Record<string, string> = {
  MATCH: '对上了',
  CODE_ONLY: '代码改了，单子没写',
  TICKET_ONLY: '单子写了，代码没看到',
  CHECK: '没法自动判断'
}

export const LOGIC_KIND_LABEL: Record<string, string> = {
  METHOD_CHANGED: '改动行',
  METHOD_ADDED: '新增方法',
  METHOD_REMOVED: '删除方法',
  CONDITION: '判断条件',
  FORMULA: '计算公式',
  CALC: '多算了几项',
  LITERAL: '数值',
  EXCEPTION: '报错',
  WRITE: '写库',
  CACHE: '缓存',
  MQ: '消息',
  REMOTE: '远程调用',
  TRANSACTION: '事务',
  SCHEDULE: '定时任务',
  ASYNC: '异步',
  CONFIG: '配置',
  CONSTANT: '常量'
}

export interface LogicGroup {
  key: string
  project: string
  title: string
  endpoints: string[]
  items: any[]
}

/** 按「项目 + 类.方法」归组：一个方法改了哪几处、测试点是什么放在一起看 */
export function groupLogic(details: any[] | undefined): LogicGroup[] {
  const map = new Map<string, LogicGroup>()
  for (const d of details || []) {
    const field = d.kind === 'CONFIG' || d.kind === 'CONSTANT'
    const title = `${d.className}.${d.member}${field ? '' : '()'}`
    const key = `${d.project}|${title}`
    let g = map.get(key)
    if (!g) {
      g = { key, project: d.project, title, endpoints: [], items: [] }
      map.set(key, g)
    }
    for (const e of d.endpoints || []) if (!g.endpoints.includes(e)) g.endpoints.push(e)
    g.items.push(d)
  }
  return [...map.values()]
}

function cell(s: string | null | undefined) {
  return (s || '—').replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function codeLines(prefix: string, s: string | null | undefined) {
  return s ? s.split('\n').map((x) => `${prefix} ${x}`) : []
}

export function assessmentMarkdown(ticket: any, a: any, manual: Manual = {}): string {
  if (!a) return ''
  const L: string[] = []
  const risk = effectiveRisk(a, manual)
  L.push('# 代码 Diff 对比分析与测试评估报告（标准版）', '')

  L.push('## 基础信息', '')
  L.push(`- 项目名称：${text(a.projectName, '无后端项目')}`)
  L.push(`- 版本 / MR：${text(a.version, '')}`)
  L.push(`- 需求 / Bug 单号：${a.issueKey || ''}${a.summary ? ' ' + a.summary : ''}${ticket?.url ? `（${ticket.url}）` : ''}`)
  L.push(`- 模块：${text(a.modules, '')}`)
  L.push(`- 开发人员：${text(manual.developer || a.developer, '')}`)
  L.push(`- 分析人：${text(manual.analyst || a.analyst, '')}`)
  L.push(`- 分析日期：${a.date || ''}`)
  L.push(`- 变更类型：${checks(manual, 'ct', a.changeTypes)}`, '')

  if (a.overview?.length) {
    L.push('## 全栈影响概览', '')
    L.push('| 维度 | 数量 | 说明 |', '| --- | --- | --- |')
    for (const s of a.overview) {
      L.push(`| ${s.level === 'RISK' ? '🔴 ' : ''}${s.label} | ${s.count} | ${cell(s.detail)} |`)
    }
    if (a.releaseOrder?.length) {
      L.push('', '发版 / 执行顺序：', '', ...a.releaseOrder.map((s: string, i: number) => `${i + 1}. ${s}`))
    }
    L.push('')
  }

  if (a.ticketChecks) {
    L.push('## 需求单 ↔ 代码 对账', '')
    if (a.ticketChecks.length) {
      L.push('| 项 | 结果 | 单子里 | 代码里 | 怎么办 |', '| --- | --- | --- | --- | --- |')
      for (const c of a.ticketChecks) {
        L.push(`| ${c.topic} | ${CHECK_STATUS_LABEL[c.status] || c.status} | ${cell(c.ticket)} | ${cell(c.code)} | ${cell(c.hint)} |`)
      }
    } else {
      L.push('- 单子里没写表 / 配置 / 定时任务，代码里也没看到这几类改动')
    }
    L.push('')
  }

  if (a.compat) {
    L.push('## 线上版本兼容检查', '')
    L.push('拿各前端 / 客户端仓库的 master 当线上版本，看它调没调有不兼容改动的接口、读没读被改的字段。', '')
    if (a.compat.hits?.length) {
      L.push('| 结果 | 调用方 | 接口 | 改了什么 | 代码里 | 怎么测 |', '| --- | --- | --- | --- | --- | --- |')
      for (const h of a.compat.hits) {
        const who = `${h.caller}（${h.callerKind === 'CLIENT' ? '客户端线上老版本' : h.inTicket ? 'H5，在单里' : 'H5，不在单里'}）`
        const where = [`调用：${(h.callRefs || []).join('、')}`]
        if (h.fieldFound === 'FOUND') where.push(`读 ${h.field}：${(h.fieldRefs || []).join('、')}`)
        else if (h.fieldFound === 'NOT_FOUND') where.push(`搜不到 ${h.field}`)
        else if (h.fieldFound === 'TOO_COMMON') where.push(`${h.field} 太常见，定位不到`)
        L.push(`| ${h.level === 'RISK' ? '会出错' : '看一眼'} | ${cell(who)} | ${cell(h.endpoint)} | ${cell(h.problem)} | ${cell(where.join('\n'))} | ${cell(h.advice)} |`)
      }
    } else {
      L.push('- 查过的仓库都没调到这些不兼容的接口')
    }
    if (a.compat.checked?.length) L.push('', `查过：${a.compat.checked.join('、')}`)
    for (const u of a.compat.unchecked || []) L.push(`- 没检查：${u}（受不受影响不知道）`)
    L.push('')
  }

  L.push('## 一、代码改动范围', '')
  L.push('### 1. 改动文件清单', '')
  if (a.files?.length) {
    L.push('| 项目 | 文件 | 状态 |', '| --- | --- | --- |')
    for (const f of a.files) L.push(`| ${f.project} | ${f.path} | ${fileStatusLabel(f.status)} |`)
  } else {
    L.push('- 无')
  }
  L.push('', '### 2. 改动类 / 方法', '', bullets(a.classes))
  L.push('', '### 3. 影响页面 / 接口 / 数据表', '')
  L.push('- 前端页面：', bullets(a.frontends, '无', '  '))
  L.push('- 客户端：', bullets(a.clients, '无', '  '))
  L.push('- 后端接口：', bullets(a.endpoints, '无', '  '))
  L.push('- 数据库表：', bullets(a.tables, '无', '  '))
  if (manual.scopeNote) L.push(`- 补充：${manual.scopeNote}`)
  L.push('')

  L.push('## 二、变更内容详情', '')
  L.push('### 1. 业务逻辑变更', '')
  L.push(`- 旧逻辑：${text(manual.oldLogic)}`)
  L.push(`- 新逻辑：${text(manual.newLogic)}`)
  const groups = groupLogic(a.logicDetails)
  if (groups.length) {
    L.push('- 代码里识别到的改动（按方法）：')
    for (const g of groups) {
      L.push(`  - **${g.title}**（${g.project}${g.endpoints.length ? '，入口 ' + g.endpoints.join('、') : ''}）`)
      for (const d of g.items) {
        L.push(`    - 【${LOGIC_KIND_LABEL[d.kind] || d.kind}】${d.title}`)
        const diff = [...codeLines('-', d.before), ...codeLines('+', d.after)]
        if (diff.length) L.push('', '      ```diff', ...diff.map((x) => '      ' + x), '      ```', '')
        if (d.hint) L.push(`      - 测：${d.hint}`)
      }
    }
    if (a.logicChanges?.length) L.push('- 其他：', bullets(a.logicChanges, '无', '  '))
  } else {
    L.push('- 代码里识别到的改动：', bullets(a.logicChanges, '无', '  '))
  }
  L.push('', '### 2. 接口变更', '')
  if (a.apiChanges?.length) {
    for (const d of a.apiChanges) {
      L.push(`- ${d.method} ${d.path}${d.summary ? ' ' + d.summary : ''}（${d.project}，${apiChangeLabel(d)}）`)
      L.push(`  - 入参：${d.inputs?.length ? d.inputs.join('；') : '无变化'}`)
      L.push(`  - 出参：${d.outputs?.length ? d.outputs.join('；') : '无变化'}`)
      if (d.impls?.length) L.push(`  - 改动实现：${d.impls.join('、')}`)
    }
  } else {
    L.push('- 无')
  }
  L.push(`- 状态码：${text(manual.statusCode, '代码里没识别到状态码变化，以实际返回为准')}`)
  L.push('', '### 3. 数据库变更', '')
  L.push('- 涉及表 / 字段：', bullets(a.dbChanges, '无', '  '))
  if (a.sql) L.push('- SQL：', '', '```sql', a.sql, '```')
  L.push('', '### 4. 其他变更（缓存 / MQ / 第三方 / 配置 / 开关）', '', bullets(a.otherChanges))
  if (manual.detailNote) L.push(`- 补充：${manual.detailNote}`)
  L.push('')

  L.push('## 三、依赖与关联模块', '')
  L.push(`- 是否涉及公共方法 / 公共组件：${yesNo(manual, 'pub', a.publicChange)}`)
  if (a.publicItems?.length) L.push(bullets(a.publicItems, '', '  '))
  L.push('- 关联业务模块：', bullets(a.relatedModules, '无', '  '))
  L.push('- 数据兼容性：', bullets(a.compatNotes, '没看到兼容性问题', '  '))
  L.push(`- 是否需要数据迁移或初始化刷数脚本：${yesNo(manual, 'mig', a.needMigration)}`)
  if (a.migrationNotes?.length) L.push(bullets(a.migrationNotes, '', '  '))
  if (manual.depNote) L.push(`- 补充：${manual.depNote}`)
  L.push('')

  L.push('## 四、风险点分析', '')
  L.push('### 1. 逻辑风险', '', bullets(a.logicRisks, '没扫到'))
  L.push('', '### 2. 兼容性与数据风险', '', bullets(a.compatRisks, '没扫到'))
  L.push('', '### 3. 隐性影响', '', bullets(a.hiddenRisks, '没扫到'))
  L.push('', '### 4. 其他风险', '', bullets(a.otherRisks, '没扫到'))
  if (manual.riskNote) L.push(`- 补充：${manual.riskNote}`)
  L.push('')

  L.push('## 五、测试建议', '')
  L.push('### 1. 核心测试场景', '')
  L.push('- 正常场景：', bullets(a.normalCases, '无', '  '))
  L.push('- 边界场景：', bullets(a.boundaryCases, '无', '  '))
  L.push('- 异常场景：', bullets(a.errorCases, '无', '  '))
  if (a.endGroups?.length) {
    L.push('', '#### 按端测试清单', '')
    for (const g of a.endGroups) {
      L.push(`- **${g.label}**`)
      if (g.items?.length) {
        for (const it of g.items) L.push(`  - ${it.what}${it.why ? `（为什么：${it.why}）` : ''}`)
      } else {
        L.push(`  - ${g.note || '无'}`)
      }
    }
  }
  L.push('', '### 2. 回归测试范围', '')
  L.push('- 必测回归：', bullets(a.mustRegress, '无', '  '))
  L.push('- 关联回归：', bullets(a.relatedRegress, '无', '  '))
  L.push('- 无需回归：', bullets(a.noRegress, '无', '  '))
  L.push('', '### 3. 测试手段', '', checks(manual, 'm', a.methods))
  L.push('', '### 4. 测试数据准备', '', bullets(a.testData))
  L.push('', '### 5. 自动化资产同步', '')
  L.push(`- 是否需要更新自动化脚本：${yesNo(manual, 'auto', a.automation)}`)
  if (a.automationRefs?.length) L.push(bullets(a.automationRefs, '', '  '))
  L.push(`- 是否需要新增 / 更新 Diff 测试基线：${yesNo(manual, 'base', a.baseline)}`)
  if (a.baselineRefs?.length) L.push(bullets(a.baselineRefs, '', '  '))
  if (manual.testNote) L.push(`- 补充：${manual.testNote}`)
  L.push('')

  L.push('## 六、待确认事项', '')
  L.push(bullets([...(a.questions || []), ...splitLines(manual.questions)]))
  if (a.limits?.length) L.push('', '分析范围说明：', bullets(a.limits))
  L.push('')

  L.push('## 七、结论评估', '')
  L.push(`- 风险等级：${['HIGH', 'MEDIUM', 'LOW'].map((k) => `${box(risk === k)} ${RISK_LABEL[k]}`).join('  ')}`)
  if (a.riskReasons?.length) L.push(`- 依据：${a.riskReasons.join('；')}`)
  L.push(`- 评估结论：${text(manual.conclusion || a.conclusion)}`)
  return L.join('\n') + '\n'
}

function splitLines(s: string | undefined) {
  return (s || '')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
}
