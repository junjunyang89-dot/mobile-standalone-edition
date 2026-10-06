<template>
  <div class="tg">
    <div v-if="stale && rebuilding" class="stale muted">正在按新版刷新测试指引…</div>
    <div v-else-if="stale" class="stale">测试指引是旧版的，点「分析这一单」刷新一下</div>

    <!-- 一句话结论 -->
    <div v-if="a" class="verdict-line">
      <span class="risk" :class="'rk-' + a.riskLevel">{{ RISK_LABEL[a.riskLevel] || '—' }}风险</span>
      <span v-for="s in headline" :key="s.label" class="hl" :class="s.cls">{{ s.label }} {{ s.n }}</span>
      <span class="vl-actions"><slot name="actions" /></span>
      <span v-if="pending.length || planMust" class="vl-links">
        <a v-if="pending.length" class="unk" @click="tab = 'pending'">{{ pending.length }} 个项目没分析到，结论不完整 →</a>
        <a v-if="planMust" class="unk" @click="tab = 'release'">发版有 {{ planMust }} 项必须做 →</a>
      </span>
    </div>
    <template v-else>
      <div class="vl-actions solo"><slot name="actions" /></div>
      <el-empty description="还没分析：点上方「分析这一单」或「全部分析」" :image-size="60" />
    </template>

    <el-tabs v-model="tab" class="inner-tabs">
      <!-- 要测的接口 -->
      <el-tab-pane v-if="a && backends.length" name="api">
        <template #label>要测的接口<em class="cnt" :class="{ hot: mustCount }">{{ cards.length }}</em></template>
        <div class="ai-bar">
          <span class="muted">AI 读这次待测的代码写用例，放进「分支用例」（{{ ticket.key }} → 分支 → 接口）</span>
          <el-checkbox v-model="tryRun" size="small">生成后在测试环境试跑</el-checkbox>
          <el-checkbox v-if="tryRun" v-model="runWrites" size="small">写接口也试跑</el-checkbox>
          <template v-for="x in backends" :key="x.projectCode">
            <el-button size="small" type="primary" plain :loading="starting === x.projectCode + '|*'"
                       :disabled="!x.reportId || !!jobRunning(x)" @click="startAi(x)">
              {{ backends.length > 1 ? tName(x) + '：' : '' }}全部改动接口生成用例
            </el-button>
            <span v-if="jobs[x.projectCode]" class="job" :class="{ run: jobs[x.projectCode].running }">
              {{ jobText(jobs[x.projectCode]) }}
              <el-button v-if="jobs[x.projectCode].running" link type="warning" size="small" @click="cancelAi(x)">停止</el-button>
            </span>
          </template>
        </div>
        <el-radio-group v-if="verdictsPresent.length > 1" v-model="verdictFilter" size="small" class="filter">
          <el-radio-button label="ALL">全部 {{ cards.length }}</el-radio-button>
          <el-radio-button v-for="v in verdictsPresent" :key="v" :label="v">{{ VERDICT[v].label }} {{ verdictCount[v] }}</el-radio-button>
        </el-radio-group>
        <el-empty v-if="!cards.length" :image-size="50" :description="emptyCardsText" />
        <div v-for="c in filteredCards" :key="cardKey(c)" class="card" :class="'v-' + c.verdict">
          <div class="c-head" @click="toggleCard(c)">
            <span class="v-tag" :class="'vt-' + c.verdict">{{ VERDICT[c.verdict]?.label || c.verdict }}</span>
            <span class="m mono">{{ c.method }}</span>
            <span class="mono path">{{ c.path }}</span>
            <span class="sum">{{ c.summary }}</span>
            <span class="grow" />
            <span v-if="backends.length > 1" class="proj">{{ c.project }}</span>
            <span v-if="c.priority" class="prio">{{ c.priority }}</span>
            <span class="caret">{{ isOpen(c) ? '收起' : '展开' }}</span>
          </div>
          <div class="action">
            <i class="bang">!</i>
            <span><template v-for="(p, k) in boldParts(c.action)" :key="k"><b v-if="p.b">{{ p.t }}</b><template v-else>{{ p.t }}</template></template></span>
          </div>
          <div v-if="isOpen(c)" class="c-body">
            <div v-if="c.changes?.length || c.logic?.length" class="row">
              <label>改了什么</label>
              <ul>
                <li v-for="x in c.changes" :key="x">
                  <template v-if="implOf(x)">实现改了：<code>{{ implOf(x) }}</code></template>
                  <template v-else>{{ x }}</template>
                </li>
                <li v-for="x in c.logic" :key="x"><code>{{ splitLogic(x)[0] }}</code><span class="dim"> — {{ splitLogic(x)[1] }}</span></li>
              </ul>
            </div>
            <div v-if="c.tests?.length" class="row">
              <label>怎么测</label>
              <div>
                <ul>
                  <li v-for="x in c.tests" :key="x" class="t-item">
                    {{ x }}<a class="ask-one" @click="openCoach(c, x)">问 AI</a>
                  </li>
                </ul>
                <a class="ask-ai" @click="openCoach(c)">✦ 不知道怎么测？让 AI 读代码一步步教我</a>
              </div>
            </div>
            <div v-if="c.security?.length" class="row">
              <label class="lb-sec">安全</label>
              <ul><li v-for="x in c.security" :key="x">{{ x }}</li></ul>
            </div>
            <div v-for="(fc, k) in c.focus || []" :key="'f' + k" class="row">
              <label class="lb-focus">重点：{{ fc.label }}</label>
              <div class="focus">
                <div class="f-title">⚠ {{ fc.title }}<span class="f-chip">既是测试手段 · 也是风险点</span></div>
                <div v-if="fc.risk" class="f-risk">{{ fc.risk }}</div>
                <div v-for="(l, j) in sentences(fc.how)" :key="j">{{ j === 0 ? '做法：' : '' }}{{ l }}</div>
                <div class="f-foot">
                  <a v-if="fc.keys" class="fold" @click="toggleKeys(c, true)">涉及 {{ fc.keys }} 个缓存 Key，在下方「查数据」里看 ▾</a>
                  <a class="fold" @click="openCoach(c, `重点（${fc.label}）：${fc.title}。${fc.risk || ''}`)">✦ 让 AI 教我测这个</a>
                </div>
              </div>
            </div>
            <div v-if="c.risks?.length" class="row">
              <label class="lb-risk">可能出问题</label>
              <ul><li v-for="x in c.risks" :key="x">{{ x }}</li></ul>
            </div>
            <div v-if="c.tables?.length || c.cacheKeys?.length" class="row">
              <label>查数据</label>
              <div class="data">
                <div v-if="c.tables?.length" class="d-line">
                  <span class="d-tag d-table">表</span>
                  <span class="chips"><code v-for="t in c.tables" :key="t" class="chip">{{ t }}</code></span>
                </div>
                <div v-if="c.cacheKeys?.length" class="d-line">
                  <span class="d-tag d-cache">缓存</span>
                  <span v-if="c.cacheKeys.length <= KEY_FOLD || keysOpen[cardKey(c)]" class="chips">
                    <code v-for="x in c.cacheKeys" :key="x" class="chip" :class="{ changed: x.includes('（key 改了）') }"
                          :title="x.includes('（key 改了）') ? '这个 key 的值这次改了' : ''">{{ cleanKey(x).replace('（key 改了）', '') }}</code>
                    <a v-if="c.cacheKeys.length > KEY_FOLD" class="fold" @click="toggleKeys(c, false)">收起</a>
                  </span>
                  <a v-else class="fold" @click="toggleKeys(c, true)">查看涉及的 {{ c.cacheKeys.length }} 个缓存 Key ▸</a>
                </div>
              </div>
            </div>
          </div>
          <div class="c-foot">
            <span class="muted">已有用例 <b class="num">{{ c.testCases || 0 }}</b> 条</span>
            <span v-if="aiItem(c)" class="ai-state" :class="'as-' + aiItem(c)!.status">{{ aiItemText(aiItem(c)!) }}</span>
            <span class="grow" />
            <el-button v-if="c.verdict !== 'OFFLINE'" link type="primary" size="small"
                       :loading="starting === cardKey(c)" :disabled="!targetOf(c)?.reportId || !!jobRunning(targetOf(c))"
                       @click="startAi(targetOf(c)!, c)">✦ AI 生成用例</el-button>
            <el-button link size="small" @click="openCases(c)">看用例</el-button>
            <el-button link type="danger" size="small" @click="openBug(c)">提 Bug</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 牵连影响 -->
      <el-tab-pane v-if="a?.impacts?.length" name="impact">
        <template #label>牵连影响<em class="cnt" :class="{ hot: impactYes }">{{ impactYes }}</em></template>
        <div class="imp-card">
          <div class="imp-top">
            <span class="imp-bang">!</span>
            <b>这次改动涉及这些</b>
            <span class="grow" />
            <span class="imp-count">{{ impactView.yes.length }} 类 · {{ impactTodo }} 条待办<template v-if="impactView.unknown.length"> · {{ impactView.unknown.length }} 类没分析到</template></span>
          </div>
          <div class="imp-row imp-thead">
            <div class="imp-type">类别</div>
            <div class="imp-items">测试要做的事<span class="muted">（小字是依据）</span></div>
          </div>
          <div v-for="g in [...impactView.yes, ...impactView.unknown]" :key="g.key" class="imp-row" :class="'st-' + g.state">
            <div class="imp-type">
              <span class="imp-tag" :class="'t-' + g.key">{{ g.label }}</span>
            </div>
            <div class="imp-items">
              <div v-if="g.state === 'UNKNOWN'" class="imp-item">
                <div class="imp-what"><b class="imp-unk">没分析到</b>（不代表没问题）：{{ g.note || '这一类不知道' }}</div>
                <div class="imp-basis"><span class="b-lab">建议</span>补上代码重新分析，或人工确认这一类有没有改</div>
              </div>
              <div v-for="(r, j) in g.rows" :key="j" class="imp-item">
                <div class="imp-what">
                  <template v-if="r.head"><b>{{ r.head }}</b> —— </template>
                  <template v-if="r.title"><b class="imp-title">{{ r.title }}</b> —— </template>
                  <template v-for="(p, k) in richParts(r.text)" :key="k">
                    <b v-if="p.type === 'b'">{{ p.t }}</b>
                    <code v-else-if="p.type === 'code'">{{ p.t }}</code>
                    <template v-else>{{ p.t }}</template>
                  </template>
                </div>
                <div v-if="r.eps?.length" class="imp-eps">
                  <span v-for="e in r.eps" :key="e.sig" class="imp-ep" :title="e.sig">
                    <em>{{ e.method }}</em> {{ e.name }}<i v-if="e.extra.length"> +{{ e.extra.length }} key</i>
                  </span>
                  <span v-if="r.moreEps" class="imp-ep more">等 {{ r.moreEps }} 个接口</span>
                </div>
                <template v-if="r.keyTotal">
                  <a v-if="!impKeysOpen[g.key + j]" class="imp-keys-btn" @click="impKeysOpen = { ...impKeysOpen, [g.key + j]: true }">
                    共 {{ r.keyTotal }} 个 key · 展开 ▾
                  </a>
                  <div v-else class="imp-keys">
                    <div class="imp-key-list">
                      <code v-for="k in r.keys" :key="k" class="imp-key">{{ k }}</code>
                      <span v-if="r.keyTotal > r.allKeys" class="muted">等共 {{ r.keyTotal }} 个（完整列表要重新分析后才有）</span>
                    </div>
                    <div v-for="e in (r.eps || []).filter((x) => x.extra.length)" :key="e.sig" class="imp-key-extra">
                      <b>{{ e.name }}</b> 另有 {{ e.extra.length }} 个：<code v-for="k in e.extra" :key="k">{{ k }}</code>
                    </div>
                    <a class="imp-keys-btn" @click="impKeysOpen = { ...impKeysOpen, [g.key + j]: false }">收起 ▴</a>
                  </div>
                </template>
                <ol v-if="r.steps?.length" class="imp-steps">
                  <li v-for="(s, k) in r.steps" :key="k">
                    <template v-for="(p, q) in richParts(s)" :key="q">
                      <code v-if="p.type === 'code'">{{ p.t }}</code>
                      <template v-else>{{ p.t }}</template>
                    </template>
                  </li>
                </ol>
                <div v-if="r.basis" class="imp-basis">
                  <span class="b-lab">{{ r.basisLabel }}</span>
                  <code v-if="r.basisCode">{{ r.basis }}</code>
                  <template v-else>{{ r.basis }}</template>
                </div>
              </div>
            </div>
          </div>
          <div v-if="impactView.no.length" class="imp-row imp-no">
            <div class="imp-type"><span class="b-lab">不涉及</span></div>
            <div class="imp-items">
              <el-tooltip v-for="g in impactView.no" :key="g.key" :content="g.note || '没看到这一类改动'" placement="top">
                <span class="imp-no-item">{{ g.label }}</span>
              </el-tooltip>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 逻辑改动 -->
      <el-tab-pane v-if="a && backends.length" name="logic">
        <template #label>逻辑改动<em class="cnt">{{ logicGroups.length }}</em></template>
        <div v-if="logicGroups.length" class="lx-bar">
          <span class="muted">每处改动翻成「旧规则 → 新规则」，对照需求看改得对不对</span>
          <span class="grow" />
          <span v-if="lxError" class="lx-err">{{ lxError }}</span>
          <el-button v-if="untranslated.length" size="small" :loading="lxAll" @click="explainAll">
            ✦ 全部翻译成业务规则（{{ untranslated.length }} 处）
          </el-button>
        </div>
        <div v-for="g in shownLogic" :key="g.key" class="lx">
          <div class="lx-head">
            <span class="lx-ico">✦</span>
            <b class="lx-title">{{ exOf(g)?.title || autoTitle(g) }}</b>
            <span v-if="exOf(g)" class="lx-ai">AI 读代码翻译</span>
            <span class="grow" />
            <span class="proj">{{ g.project }}</span>
          </div>
          <div class="lx-meta">
            <span class="lx-lab">改动模块</span>
            <code>{{ g.title }}</code>
            <span v-for="e in g.endpoints" :key="e" class="ep-tag mono">{{ e }}</span>
          </div>

          <div class="lx-sec">
            <div class="lx-sec-h">业务规则变化</div>
            <!-- AI 翻译过：左右对照的业务规则 -->
            <template v-if="exOf(g)">
              <div class="lx-cmp">
                <div class="lx-ch old">✕ 旧</div>
                <div class="lx-ch new">✓ 新</div>
                <template v-for="(row, k) in ruleCompare(exOf(g)!)" :key="k">
                  <div class="lx-cell old">{{ row[0] }}</div>
                  <div class="lx-cell new">{{ row[1] }}</div>
                </template>
              </div>
              <div v-if="exOf(g)!.factors?.length" class="lx-factors">
                <span class="lx-lab">计算因子</span>
                <span v-for="(f, k) in exOf(g)!.factors" :key="k" class="lx-f" :class="factorCls(f.change)" :title="f.detail || ''">
                  {{ factorMark(f.change) }} {{ f.name }}<em v-if="f.detail">{{ f.detail }}</em>
                </span>
              </div>
            </template>
            <!-- 没翻译：规则认出来的部分先左右摆着，认不出的明说 -->
            <template v-else>
              <div v-if="ruleRows(g).length" class="lx-cmp">
                <div class="lx-ch old">✕ 旧</div>
                <div class="lx-ch new">✓ 新</div>
                <template v-for="(d, k) in ruleRows(g)" :key="k">
                  <div class="lx-cell old">
                    <span class="lk" :class="'lk-' + d.kind">{{ LOGIC_KIND_LABEL[d.kind] || d.kind }}</span>
                    <code v-if="d.before" class="lx-code">{{ d.before }}</code>
                    <span v-else class="muted">原来没有</span>
                  </div>
                  <div class="lx-cell new">
                    <span class="lx-what">{{ d.title }}</span>
                    <code v-if="d.after" class="lx-code">{{ d.after }}</code>
                    <span v-else class="muted">去掉了</span>
                  </div>
                </template>
              </div>
              <div v-else class="lx-unknown">
                规则引擎没认出这是哪类改动（<b>不代表没问题</b>），需要读完整方法才说得清新旧差在哪
              </div>
              <div class="lx-trans">
                <el-button size="small" type="primary" plain :loading="lxBusy[g.key]" :disabled="lxAll && !lxBusy[g.key]" @click="explain(g)">
                  ✦ 翻译成业务规则
                </el-button>
                <span class="muted">AI 读改前 / 改后两版完整方法，写成测试看得懂的规则，二三十秒</span>
              </div>
            </template>
          </div>

          <div class="lx-sec">
            <div class="lx-sec-h">影响范围</div>
            <div v-if="exOf(g)?.impact" class="lx-line"><span class="lx-tag ai">AI 预估</span>{{ exOf(g)!.impact }}</div>
            <div v-else-if="g.endpoints.length" class="lx-line">
              直接影响 <code v-for="e in g.endpoints" :key="e" class="lx-ep">{{ e }}</code> 的返回
            </div>
            <div v-if="asyncAction(g)" class="lx-act">
              <div class="lx-act-h"><span class="lx-tag warn">{{ asyncAction(g)!.tag }}</span>{{ asyncAction(g)!.title }}</div>
              <ol class="lx-steps">
                <li v-for="(s, k) in asyncAction(g)!.steps" :key="k">{{ s }}</li>
              </ol>
            </div>
          </div>

          <div class="lx-sec">
            <div class="lx-sec-h">你的测试重点</div>
            <ol v-if="focusOf(g).length" class="lx-steps">
              <li v-for="(s, k) in focusOf(g)" :key="k">{{ s }}</li>
            </ol>
            <div v-else class="muted">规则没给出具体测试点，先点上面「翻译成业务规则」</div>
            <template v-if="exOf(g) && ruleHints(g).length">
              <button type="button" class="lx-more" @click="lxHintsOpen[g.key] = !lxHintsOpen[g.key]">
                规则引擎的测试点 {{ ruleHints(g).length }} 条 {{ lxHintsOpen[g.key] ? '▴' : '▾' }}
              </button>
              <ol v-if="lxHintsOpen[g.key]" class="lx-steps sub">
                <li v-for="(s, k) in ruleHints(g)" :key="k">{{ s }}</li>
              </ol>
            </template>
            <div v-if="exOf(g)?.vsTicket" class="lx-line"><span class="lx-tag">和需求对照</span>{{ exOf(g)!.vsTicket }}</div>
            <div v-if="exOf(g)?.unsure" class="lx-line warn"><span class="lx-tag warn">AI 拿不准</span>{{ exOf(g)!.unsure }}</div>
          </div>

          <div class="lx-foot">
            <el-button size="small" @click="askLogic(g, 'explain')">💬 让 AI 解释这段逻辑</el-button>
            <el-button size="small" @click="askLogic(g, 'cases')">让 AI 帮我写边界测试用例</el-button>
            <button type="button" class="lx-more" @click="lxCodeOpen[g.key] = !lxCodeOpen[g.key]">
              看代码改动 {{ lxCodeOpen[g.key] ? '▴' : '▾' }}
            </button>
            <span class="grow" />
            <span v-if="exOf(g)" class="lx-seen">
              {{ exOf(g)!.codeSeen }} · {{ shortTime(exOf(g)!.at) }}
              <button type="button" class="lx-more" :disabled="lxBusy[g.key]" @click="explain(g)">{{ lxBusy[g.key] ? '翻译中…' : '重新翻译' }}</button>
            </span>
          </div>
          <div v-if="lxCodeOpen[g.key]" class="lx-code-box">
            <div v-for="(d, j) in g.items" :key="j" class="lg-item">
              <div><span class="lk" :class="'lk-' + d.kind">{{ LOGIC_KIND_LABEL[d.kind] || d.kind }}</span>{{ d.title }}</div>
              <pre v-if="d.before || d.after" class="diff"><template v-for="(l, k) in lines(d.before)" :key="'b' + k"><span class="del">- {{ l }}</span>
</template><template v-for="(l, k) in lines(d.after)" :key="'a' + k"><span class="add">+ {{ l }}</span>
</template></pre>
              <div v-if="d.hint" class="hint-line">测：{{ d.hint }}</div>
            </div>
          </div>
        </div>
        <el-button v-if="logicGroups.length > LOGIC_FOLD" link type="primary" size="small" @click="logicOpen = !logicOpen">
          {{ logicOpen ? '收起' : `展开全部 ${logicGroups.length} 处` }}
        </el-button>
        <el-empty v-if="!logicGroups.length" :image-size="50" description="没识别到方法级的逻辑改动" />
      </el-tab-pane>

      <!-- 前端 / App -->
      <el-tab-pane v-if="a && hasFront" name="front">
        <template #label>前端 / App<em v-if="compatRisk" class="cnt hot">{{ compatRisk }}</em></template>
        <div v-if="frontGroups.length" class="fgroups">
          <div v-for="g in frontGroups" :key="g.key" class="fg">
            <b>{{ g.label }}</b>
            <ul v-if="g.items?.length">
              <li v-for="(it, j) in g.items" :key="j">{{ it.what }}<div v-if="it.why" class="why">{{ it.why }}</div></li>
            </ul>
            <div v-else class="muted">{{ g.note || '无' }}</div>
          </div>
        </div>
        <div v-if="a.compat" class="block">
          <div class="block-head">
            <b>线上老版本还在调被改的接口</b>
            <em v-if="compatRisk" class="bad">{{ compatRisk }} 处会出错</em>
          </div>
          <div v-for="(h, i) in a.compat.hits" :key="i" class="compat">
            <span class="cs" :class="h.level === 'RISK' ? 'cs-CODE_ONLY' : 'cs-CHECK'">{{ h.level === 'RISK' ? '会出错' : '看一眼' }}</span>
            <b>{{ h.caller }}</b>
            <span class="muted">{{ h.callerKind === 'CLIENT' ? '客户端线上版本' : h.inTicket ? 'H5（在这单里）' : 'H5（不在这单里）' }}</span>
            <span class="mono">{{ h.endpoint }}</span>
            <div class="compat-body">{{ h.problem }}；{{ h.advice }}</div>
          </div>
          <div v-if="!a.compat.hits?.length" class="muted">查过的仓库都没调到这些不兼容的接口</div>
          <div v-for="u in a.compat.unchecked || []" :key="u" class="warn-text sm">没检查：{{ u }}（受不受影响不知道）</div>
        </div>
        <CrossProjectView :ticket="ticket" compact />
        <div class="muted sm">
          接口返回了哪些字段、前端用没用对、展示和需求 / 设计稿对不对得上：现在只到「谁调了哪个接口」这一层，字段级比对还没做，要人工对。
        </div>
      </el-tab-pane>

      <!-- 待确认 / 没分析到 -->
      <el-tab-pane v-if="a" name="pending">
        <template #label>待确认 / 没分析到<em class="cnt" :class="{ hot: confirmItems.some((x) => x.kind !== 'scope') }">{{ pendingCount }}</em></template>
        <div class="cf-wrap">
          <div class="cf-top">
            <b>待确认事项</b>
            <span class="grow" />
            <span class="muted">共 {{ confirmItems.length }} 项<template v-if="askCount"> · 要问人 {{ askCount }} 项</template></span>
          </div>
          <div v-if="mismatches.length" class="cf-banner">
            <span class="rel-bang">!</span>
            <b>单子和代码对不上 {{ mismatches.length }} 处 —— {{ mismatchSummary }}</b>
            <span class="grow" />
            <el-button size="small" @click="gotoMismatch">看这一处 ›</el-button>
          </div>
          <div v-if="!confirmItems.length" class="muted cf-none">没有要问的，也没有分析不到的地方</div>
          <div v-for="(it, i) in confirmItems" :id="it.anchor" :key="i" class="cf-card" :class="['k-' + it.kind, { flash: flashId === it.anchor }]">
            <div class="cf-main">
              <span class="cf-no">{{ i + 1 }}</span>
              <div class="cf-body">
                <div class="cf-title">
                  <template v-for="(p, k) in richParts(it.title)" :key="k">
                    <code v-if="p.type === 'code'">{{ p.t }}</code>
                    <template v-else>{{ p.t }}</template>
                  </template>
                  <span class="cf-tag">{{ it.tag }}</span>
                </div>
                <div v-if="it.desc" class="cf-desc">
                  <template v-for="(p, k) in richParts(it.desc)" :key="k">
                    <b v-if="p.type === 'b'">{{ p.t }}</b>
                    <code v-else-if="p.type === 'code'">{{ p.t }}</code>
                    <template v-else>{{ p.t }}</template>
                  </template>
                </div>
              </div>
            </div>
            <div v-if="it.dbs" class="cf-sec">
              <div class="cf-sec-head" @click="dbOpen = { ...dbOpen, [i]: dbOpen[i] === false }">
                <span>连不上的 <b>{{ it.dbTotal }}</b> 个库</span>
                <span class="grow" />
                <a>{{ dbOpen[i] === false ? '展开 ▾' : '收起 ▴' }}</a>
              </div>
              <div v-if="dbOpen[i] !== false" class="cf-chips">
                <code v-for="d in it.dbs" :key="d">{{ d }}</code>
                <span v-if="it.dbTotal! > it.dbs.length" class="muted">等共 {{ it.dbTotal }} 个（完整列表重新分析后才有）</span>
              </div>
              <div v-for="e in it.errors" :key="e" class="cf-kv"><span class="b-lab">错误</span><code>{{ e }}</code></div>
              <div v-if="it.impact" class="cf-kv">
                <span class="b-lab">影响</span>
                <template v-for="(p, k) in richParts(it.impact)" :key="k">
                  <code v-if="p.type === 'code'">{{ p.t }}</code>
                  <template v-else>{{ p.t }}</template>
                </template>
              </div>
            </div>
            <ul v-if="it.list?.length" class="cf-list">
              <li v-for="(s, k) in it.list" :key="k">
                <template v-for="(p, q) in richParts(s)" :key="q">
                  <code v-if="p.type === 'code'">{{ p.t }}</code>
                  <template v-else>{{ p.t }}</template>
                </template>
              </li>
            </ul>
            <div v-if="it.foot" class="cf-foot">
              <span v-if="it.foot.status" class="cf-status">{{ it.foot.status }}</span>
              <code v-if="it.foot.file">{{ it.foot.file }}</code>
              <span v-if="it.foot.label" class="b-lab">{{ it.foot.label }}</span>
              <span v-if="it.foot.text">{{ it.foot.text }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 用例与 Bug -->
      <el-tab-pane v-if="a" name="cases">
        <template #label>用例与 Bug<em v-if="bugs.length" class="cnt">{{ bugs.length }}</em></template>
        <div class="ck">
          <div class="ck-top">
            <b>{{ summary.done ? '测完了' : '还没测完' }}</b>
            <span v-if="todoCount" class="ck-cnt">● {{ todoCount }} 项待办</span>
            <span class="grow" />
            <el-button size="small" :loading="summaryLoading" @click="loadSummary">↻ 刷新</el-button>
            <el-tooltip placement="bottom-end" :show-after="200" popper-class="sum-preview">
              <template #content>
                <div class="sum-tip">复制到剪贴板，粘到群里告诉开发 / 产品测到哪了：</div>
                <pre class="sum-pre">{{ summaryText }}</pre>
              </template>
              <el-button size="small" type="primary" @click="copySummary">复制测试小结</el-button>
            </el-tooltip>
          </div>
          <div v-for="(it, i) in checklist" :key="it.key" class="ck-row" :class="'s-' + it.state">
            <span class="ck-no">{{ it.state === 'done' ? '✓' : i + 1 }}</span>
            <div class="ck-body">
              <div class="ck-title">
                {{ it.title }}<span v-if="it.badge" class="ck-badge">{{ it.badge }}</span>
              </div>
              <div v-if="it.chips?.length" class="ck-chips">
                <span v-for="(c, k) in it.chips" :key="k" class="ck-chip" :class="c.cls" :title="c.title">
                  <em v-if="c.method">{{ c.method }}</em>{{ c.text }}
                </span>
              </div>
              <div v-if="it.desc" class="ck-desc">{{ it.desc }}</div>
              <div v-for="(l, k) in it.lines || []" :key="k" class="ck-line">
                <span class="cs" :class="l.cls">{{ l.tag }}</span>
                <span class="bug-desc">{{ l.text }}</span>
              </div>
            </div>
            <div class="ck-acts">
              <el-button v-for="b in it.actions || []" :key="b.label" size="small" :type="b.type || 'primary'" plain
                         :disabled="b.disabled" :loading="b.loading" @click="b.run">{{ b.label }}</el-button>
            </div>
          </div>
          <div v-if="!todoCount" class="ck-done">
            <span class="ck-ok">✓</span>
            <b>{{ checklist.length }} 项都处理完了 —— 可以把测试小结发群了</b>
            <span class="grow" />
            <el-button size="small" type="primary" @click="copySummary">复制测试小结</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 改动范围 -->
      <el-tab-pane name="scope">
        <template #label>改动范围<em class="cnt">{{ ticket.targets.length }}</em></template>
        <table class="targets sc-table">
          <thead>
            <tr><th style="width: 22%">项目</th><th>分支 / 目录</th><th style="width: 26%">结果</th></tr>
          </thead>
          <tbody>
            <tr v-for="(x, i) in ticket.targets" :key="i">
              <td>
                <div class="tg-name">{{ tName(x) }}</div>
                <div class="sc-kind">
                  <span :class="'k-' + (x.projectCode ? x.kind : 'MISS')">{{ kindText(x) }}</span>
                  <span v-if="x.matchHow && x.matchHow !== 'EXACT'" class="sc-how" :title="'备注里写的是 ' + x.rawProject">
                    {{ HOW[x.matchHow] || x.matchHow }}{{ x.matchHow === 'MANUAL' ? '' : '：' + x.rawProject }}
                  </span>
                </div>
              </td>
              <td>
                <div class="sc-kv">
                  <span class="sc-k">分支</span>
                  <span class="sc-v mono">{{ x.branch || '—' }}</span>
                </div>
                <template v-if="x.baseDir && x.headDir">
                  <div class="sc-kv">
                    <span class="sc-k">目录</span>
                    <span class="sc-v mono" :title="`${x.baseDir} → ${x.headDir}`">
                      <template v-for="(d, k) in [dirView(x).base, dirView(x).head]" :key="k">
                        <span v-if="k" class="sc-arrow">→</span>
                        <span class="sc-dim">{{ d.lead }}</span><b>{{ d.last }}</b>
                      </template>
                    </span>
                    <button type="button" class="sc-copy" @click="copyText(`${x.baseDir} → ${x.headDir}`)">⧉ 复制</button>
                  </div>
                  <div v-if="dirView(x).prefix" class="sc-prefix mono">公共前缀 {{ dirView(x).prefix }}</div>
                </template>
                <div v-if="x.note" class="tg-sub">{{ x.note }}</div>
              </td>
              <td>
                <span v-if="!x.projectCode" class="muted">项目管理里没找到，点「修正项目 / 分支」指定</span>
                <template v-else>
                  <template v-if="x.analyzable">
                    <div v-if="x.error" class="err">{{ x.error }}</div>
                    <div v-else-if="summaryChips(x.reportSummary).length" class="sc-chips">
                      <span v-for="c in summaryChips(x.reportSummary)" :key="c.label" class="sc-chip" :class="c.cls">
                        <b>{{ c.n }}</b> {{ c.label }}
                      </span>
                    </div>
                    <div v-else-if="x.reportSummary">{{ x.reportSummary }}</div>
                    <div v-else-if="!x.front" class="muted">还没分析</div>
                    <div v-if="x.syncMessage && !x.syncMessage.startsWith('本地目录对比')" class="tg-sub"
                         :class="{ err: x.syncMessage.startsWith('拉取最新代码失败') }">{{ x.syncMessage }}</div>
                  </template>
                  <div v-if="x.front" :class="x.analyzable ? 'tg-sub' : ''">
                    {{ x.kind === 'BACKEND' ? '前端部分：' : '' }}{{ frontSummary(x.front) }}
                  </div>
                  <div v-if="x.codeMissing" class="tg-sub warn-text">缺代码：{{ x.codeMissing }}</div>
                  <div v-else-if="!x.analyzable && !x.front" class="muted">{{ ticket.analyzedAt ? '没有代码改动' : '还没分析' }}</div>
                </template>
                <button v-if="x.reportId" type="button" class="sc-link" @click="openReport(x)">字段 / 文件明细 ›</button>
              </td>
            </tr>
            <tr v-if="!ticket.targets.length">
              <td colspan="3" class="muted">备注里没认出项目和分支，点「修正项目 / 分支」手动加</td>
            </tr>
          </tbody>
        </table>
        <details v-if="ticket.notes" class="notes">
          <summary>JIRA 备注原文</summary>
          <pre>{{ ticket.notes }}</pre>
        </details>
      </el-tab-pane>

      <!-- 发版注意：测试负责发版，照着做 -->
      <el-tab-pane v-if="hasRelease" name="release">
        <template #label>发版注意<em class="cnt" :class="{ hot: planMust }">{{ planMust || planSteps.length || legacyOrder.length }}</em></template>
        <div v-if="relWhyShown && a.riskReasons?.length" class="rel-why">
          <div class="rel-why-head"><span class="rel-bang">!</span><b>为什么要注意</b></div>
          <ul>
            <li v-for="(s, i) in a.riskReasons" :key="i">{{ s }}</li>
          </ul>
        </div>
        <div v-if="planSteps.length" class="rel-plan">
          <div class="rel-plan-head">
            <b>上线清单</b>
            <span class="muted">上线前先执行 / 先配 → 按顺序发 → 发版后补</span>
            <span class="grow" />
            <span v-if="planMust" class="rel-must-cnt">{{ planMust }} 项必须做</span>
          </div>
          <div v-for="(ph, pi) in planPhases" :key="ph.key" class="rel-phase">
            <div class="rel-ph-head">
              <span class="rel-ph-no">{{ pi + 1 }}</span>
              <b>{{ ph.label }}</b>
              <span class="muted">{{ ph.steps.length }} 项</span>
            </div>
            <div class="rel-steps">
              <div v-for="(s, i) in ph.steps" :key="i" class="rel-step" :class="{ must: s.must }">
                <span class="rel-step-no">{{ i + 1 }}</span>
                <div class="rel-step-body">
                  <div class="rel-what">
                    <span v-if="s.must" class="must-tag">必须</span>
                    <template v-for="(p, k) in richParts(s.what)" :key="k">
                      <b v-if="p.type === 'b'">{{ p.t }}</b>
                      <code v-else-if="p.type === 'code'">{{ p.t }}</code>
                      <template v-else>{{ p.t }}</template>
                    </template>
                  </div>
                  <div v-if="s.why" class="why">{{ s.why }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="legacyOrder.length" class="rel-plan">
          <div class="rel-plan-head"><b>上线顺序</b></div>
          <div class="rel-steps flat">
            <div v-for="(s, i) in legacyOrder" :key="i" class="rel-step">
              <span class="rel-step-no">{{ i + 1 }}</span>
              <div class="rel-step-body"><div class="rel-what">{{ s }}</div></div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="detailVisible" size="70%" append-to-body
               :title="detailTarget ? `${tName(detailTarget)} · 字段 / 文件明细` : '字段 / 文件明细'">
      <div v-loading="detailLoading" class="detail-drawer">
        <template v-if="detailReport">
          <div class="dd-meta muted">
            <span class="mono">{{ detailReport.baseRef }} → {{ detailReport.headRef }}</span>
            <span>共 {{ detailReport.changedFiles || detailReport.files?.length || 0 }} 个文件有差异</span>
          </div>
          <el-radio-group v-model="detailSec" size="small" class="dd-sec">
            <el-radio-button label="ep">接口字段对比 {{ detailReport.endpoints?.length || 0 }}</el-radio-button>
            <el-radio-button label="files">改动文件 {{ detailReport.files?.length || 0 }}</el-radio-button>
          </el-radio-group>
          <EndpointDiffView v-if="detailSec === 'ep'" :report="detailReport" :project="detailTarget?.projectCode || ''" :refs="detailRefs" />
          <table v-else class="dd-files">
            <tr v-for="(f, i) in detailReport.files || []" :key="i">
              <td class="dd-st" :class="'st-' + f.status">{{ fileStatusLabel(f.status) }}</td>
              <td class="mono">{{ f.path }}</td>
            </tr>
            <tr v-if="!detailReport.files?.length"><td class="muted">没有文件清单（老的分析结果没存，重新分析一次就有）</td></tr>
          </table>
        </template>
      </div>
    </el-drawer>

    <TestCoach v-model="coachVisible" :batch-id="batch?.id" :ticket="ticket" :card="coachCard" :target="coachCard ? targetOf(coachCard) : null"
               :initial-ask="coachAsk" />

    <BugSubmitDialog v-if="bugVisible" v-model="bugVisible" :value="bugValue" :version-options="versionOptions"
                     :submitting="bugSaving" @submit="submitBug" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient, type AiCaseJob, type AiCaseJobItem } from '../../api'
import { CHECK_STATUS_LABEL, LOGIC_KIND_LABEL, RISK_LABEL, fileStatusLabel, groupLogic } from '../../utils/assessmentMarkdown'
import { defaultBugValue, type BugSubmitValue } from '../../utils/bugSubmit'
import BugSubmitDialog from '../BugSubmitDialog.vue'
import CrossProjectView from './CrossProjectView.vue'
import EndpointDiffView from '../EndpointDiffView.vue'
import TestCoach from './TestCoach.vue'

const props = defineProps<{ batch: any; ticket: any }>()
const emit = defineEmits<{ (e: 'update', batch: any): void; (e: 'reload'): void }>()

const GUIDE_VERSION = 3
const LOGIC_FOLD = 6
const VERDICT: Record<string, { label: string }> = {
  NEW: { label: '新接口' },
  BREAKING: { label: '不兼容' },
  OFFLINE: { label: '下线' },
  SHAPE: { label: '出入参变了' },
  ADD: { label: '补用例' },
  RERUN: { label: '重跑用例' }
}
const HOW: Record<string, string> = { ALIAS: '别名', FUZZY: '按近似名认的', CLIENT: '客户端', MANUAL: '人工指定', BRANCH: '按分支找到' }
const KIND_TEXT: Record<string, string> = { BACKEND: '后端', FRONTEND: '前端', CLIENT: '客户端' }
const AI_STATUS: Record<string, string> = {
  WAITING: '排队中',
  RUNNING: 'AI 生成中…',
  ENABLED: '已生成并启用',
  PENDING: '已生成，待确认',
  SKIPPED: '跳过',
  FAILED: '生成失败'
}

const router = useRouter()
const a = computed(() => props.ticket?.assessment || null)
const backends = computed(() => (props.ticket?.targets || []).filter((x: any) => x.analyzable))
const backendFailed = computed(() => backends.value.length > 0 && !backends.value.some((x: any) => x.reportId))
const cards = computed<any[]>(() => a.value?.endpointCards || [])
const logicGroups = computed(() => groupLogic(a.value?.logicDetails))
const logicOpen = ref(false)
const shownLogic = computed(() => (logicOpen.value ? logicGroups.value : logicGroups.value.slice(0, LOGIC_FOLD)))
const mismatches = computed(() => (a.value?.ticketChecks || []).filter((c: any) => c.status !== 'MATCH'))
const compatRisk = computed(() => (a.value?.compat?.hits || []).filter((h: any) => h.level === 'RISK').length)
const frontGroups = computed(() => (a.value?.endGroups || []).filter((g: any) => g.key === 'h5' || g.key === 'app'))
const hasFront = computed(
  () =>
    (props.ticket?.targets || []).some((x: any) => x.front || (x.projectCode && x.kind !== 'BACKEND')) ||
    frontGroups.value.some((g: any) => g.items?.length) ||
    !!a.value?.compat
)
const isIssueKey = computed(() => /^[A-Z][A-Z0-9]+-\d+$/.test(props.ticket?.key || ''))
/** 老单子打开时自动用已存的结果重算一遍指引，不用人点；失败了才露出提示 */
const stale = computed(() => !!a.value && a.value.guideVersion !== GUIDE_VERSION)
const rebuilding = ref(false)
const rebuildTried = new Set<string>()
const versionOptions = computed(() => (props.batch?.version ? [props.batch.version] : []))

/** 缺代码 / 分析失败的项目：和它们有关的结论都是推测 */
const pending = computed(() => {
  const out: string[] = []
  for (const x of props.ticket?.targets || []) {
    if (!x.projectCode) out.push(`${x.rawProject}：项目管理里没找到，这个项目完全没分析`)
    else if (x.analyzable && x.error) out.push(`${tName(x)}：后端没分析成功（${x.error}），接口和影响面都不知道`)
    else if (x.codeMissing) out.push(`${tName(x)}：缺代码（${x.codeMissing}），和它有关的关联只是推测`)
  }
  return out
})

const headline = computed(() => {
  const n = (v: string) => cards.value.filter((c) => c.verdict === v).length
  return [
    { label: '新接口', n: n('NEW'), cls: 'bad' },
    { label: '不兼容', n: n('BREAKING'), cls: 'bad' },
    { label: '下线', n: n('OFFLINE'), cls: 'warn' },
    { label: '出入参变了', n: n('SHAPE'), cls: 'warn' },
    { label: '要补用例', n: n('ADD'), cls: '' },
    { label: '要重跑', n: n('RERUN'), cls: '' },
    { label: '单子和代码对不上', n: mismatches.value.length, cls: 'warn' }
  ].filter((s) => s.n > 0)
})

// ---------------- 上线清单 ----------------
const PLAN_PHASES = [
  { key: 'BEFORE', label: '上线前（代码发之前做完）' },
  { key: 'ORDER', label: '发版顺序' },
  { key: 'AFTER', label: '发版后' }
]
const planSteps = computed<any[]>(() => a.value?.releasePlan || [])
const planMust = computed(() => planSteps.value.filter((s) => s.must).length)
const planPhases = computed(() =>
  PLAN_PHASES.map((p) => ({ ...p, steps: planSteps.value.filter((s) => s.phase === p.key) })).filter((p) => p.steps.length)
)
const legacyOrder = computed<string[]>(() => (!a.value?.releasePlan && a.value?.releaseOrder) || [])
const hasRelease = computed(() => !!a.value && (planSteps.value.length > 0 || legacyOrder.value.length > 0 || !!a.value.riskReasons?.length))

// ---------------- 页签 ----------------
const tab = ref('api')
const mustCount = computed(() => cards.value.filter((c) => ['NEW', 'BREAKING', 'OFFLINE'].includes(c.verdict)).length)
const impactYes = computed(() => (a.value?.impacts || []).filter((g: any) => g.state === 'YES').length)

// ---------------- 牵连影响 ----------------
type ImpEp = { sig: string; method: string; name: string; extra: string[] }
type ImpRow = {
  text: string
  head?: string
  title?: string
  basisLabel?: string
  basis?: string
  basisCode?: boolean
  steps?: string[]
  eps?: ImpEp[]
  moreEps?: number
  keys?: string[]
  allKeys?: number
  keyTotal?: number
}
/** 下面几个正则对应后端 GuideViews / ApiRiskScanner / AssessmentViews 生成的固定句式，后端改措辞要一起改 */
const TABLE_RE = /^表 (\S+)：造正常 \/ 边界 \/ 空数据各一份，调接口后查表核对$/
const CACHE_RE = /^调完接口去「测试工具 → Redis」查这些 key：(.+?)(?: 等 (\d+) 个)?。写接口调完 key 要被更新或删掉；再调读接口，确认拿到的不是旧值$/
const SQL_RE = /^SQL 拼接：(.+?) 用的是 \$\{\}，值会被直接拼进 SQL。如果这个值来自接口入参，(.+?)。预编译占位应该用 (.+)$/
const RECON_RE = /^对账（(.+?)）：(.*)$/
const FILE_RE = /^[\w./-]+\.(xml|java|kt|yml|yaml|properties|sql|ts|js|vue)$/

const impKeysOpen = ref<Record<string, boolean>>({})
const cardKeyMap = computed(() => {
  const m = new Map<string, string[]>()
  for (const c of cards.value) m.set(`${c.method} ${c.path}`, (c.cacheKeys || []).map((k: string) => k.replace('（key 改了）', '')))
  return m
})

function basisOf(why?: string): Partial<ImpRow> {
  if (!why) return {}
  const m = why.match(RECON_RE)
  if (m) return { basisLabel: '对账', basis: `${m[2]} —— ${m[1]}` }
  if (why.startsWith('单子和代码对不上：')) return { basisLabel: '对账', basis: why.slice('单子和代码对不上：'.length) }
  if (FILE_RE.test(why)) return { basisLabel: '位置', basis: why, basisCode: true }
  return { basisLabel: '依据', basis: why }
}

/** 同一句测法、只是表不同的合成一条 */
function tableRows(items: any[]): ImpRow[] {
  const byWhy = new Map<string, string[]>()
  for (const it of items) byWhy.set(it.why || '', [...(byWhy.get(it.why || '') || []), it.what.match(TABLE_RE)![1]])
  return [...byWhy.entries()].map(([why, tables]) => ({
    head: tables.join('、'),
    text: '各造正常 / 边界 / 空数据各一份，调接口后查表核对',
    ...basisOf(tables.length > 1 ? why.replace('这张表', `这 ${tables.length} 张表`) : why)
  }))
}

/** 读写同一批缓存的接口合成一条：共同的 key 折起来，个别接口多出来的单列 */
function cacheRow(items: any[]): ImpRow {
  const epKeys = new Map<string, string[]>()
  let total = 0
  let moreEps = 0
  for (const it of items) {
    const m = it.what.match(CACHE_RE)!
    const shown = m[1].split('、').filter(Boolean)
    total = Math.max(total, Number(m[2] || shown.length))
    const whyEps = (it.why || '').replace(/ 这次改了，并且读写这些缓存$/, '')
    const mm = whyEps.match(/^(.*) 等 (\d+) 个接口$/)
    const list = (mm ? mm[1] : whyEps).split('、').filter(Boolean)
    if (mm) moreEps += Number(mm[2]) - list.length
    for (const sig of list) {
      const full = cardKeyMap.value.get(sig)
      epKeys.set(sig, full?.length ? full : shown)
    }
  }
  const all = [...new Set([...epKeys.values()].flat())]
  const common = all.filter((k) => [...epKeys.values()].every((ks) => ks.includes(k)))
  const eps: ImpEp[] = [...epKeys.entries()].map(([sig, ks]) => {
    const [method, ...rest] = sig.split(' ')
    const path = rest.join(' ')
    return { sig, method, name: path.split('/').filter(Boolean).pop() || path, extra: ks.filter((k) => !common.includes(k)) }
  })
  const n = eps.length + moreEps
  return {
    text: '调完接口后检查缓存 key：**写接口调完 key 要被更新或删掉**；再调读接口，确认拿到的**不是旧值**',
    eps,
    moreEps,
    keys: common,
    allKeys: all.length,
    keyTotal: Math.max(total, all.length),
    basisLabel: '依据',
    basis: `${n > 1 ? `这 ${n} 个接口` : '这个接口'}这次改了，并且读写这些缓存`
  }
}

function sqlRow(it: any): ImpRow {
  const [, vars, inject, fix] = it.what.match(SQL_RE)!
  return {
    title: 'SQL 拼接注入风险',
    text: `${vars.split('、').join(' / ')} 用的是 \${}，值会被直接拼进 SQL。若来自接口入参，${inject}`,
    steps: [`先确认 ${vars.split('、').join(' / ')} 是否来自接口入参（是 → 可注入）`, `改成预编译占位 ${fix}`],
    ...basisOf(it.why)
  }
}

function impactRows(g: any): ImpRow[] {
  const items: any[] = g.items || []
  const tables = items.filter((it) => TABLE_RE.test(it.what))
  const caches = items.filter((it) => CACHE_RE.test(it.what))
  const out: ImpRow[] = []
  let tablesDone = false
  let cacheDone = false
  for (const it of items) {
    if (TABLE_RE.test(it.what)) {
      if (!tablesDone) out.push(...tableRows(tables))
      tablesDone = true
    } else if (CACHE_RE.test(it.what)) {
      if (!cacheDone) out.push(cacheRow(caches))
      cacheDone = true
    } else if (SQL_RE.test(it.what)) {
      out.push(sqlRow(it))
    } else {
      out.push({ text: it.what, ...basisOf(it.why) })
    }
  }
  return out
}

const impactView = computed(() => {
  const gs = (a.value?.impacts || []).map((g: any) => ({ ...g, rows: g.state === 'YES' ? impactRows(g) : [] }))
  return {
    yes: gs.filter((g: any) => g.state === 'YES'),
    unknown: gs.filter((g: any) => g.state === 'UNKNOWN'),
    no: gs.filter((g: any) => g.state !== 'YES' && g.state !== 'UNKNOWN')
  }
})
const impactTodo = computed(() => impactView.value.yes.reduce((n: number, g: any) => n + g.rows.length, 0))

/** **加粗**，以及代码标识（${x}、snake_case、类名）用等宽显示，不走 v-html */
const RICH_RE = /(\*\*[^*]+\*\*|[$#]\{\w*\}|' or 1=1 --|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+(?:\.java)?\b)/
const RICH_FULL = new RegExp(`^${RICH_RE.source}$`)
function richParts(text: string) {
  return (text || '')
    .split(RICH_RE)
    .filter(Boolean)
    .map((t) => (t.startsWith('**') && t.endsWith('**') ? { type: 'b', t: t.slice(2, -2) } : RICH_FULL.test(t) ? { type: 'code', t } : { type: 't', t }))
}
const emptyCardsText = computed(() => {
  if (stale.value) return rebuilding.value ? '正在刷新…' : '旧版本分析没有逐个接口的结论，点「分析这一单」刷新后才知道'
  return backendFailed.value ? '后端没分析成功，接口改没改不知道' : '接口出入参和实现都没变'
})
const pendingCount = computed(() => confirmItems.value.length)

// ---------------- 待确认事项 ----------------
type ConfirmItem = {
  kind: 'ask' | 'env' | 'scope'
  tag: string
  title: string
  desc?: string
  anchor?: string
  list?: string[]
  dbs?: string[]
  dbTotal?: number
  errors?: string[]
  impact?: string
  foot?: { status?: string; file?: string; label?: string; text?: string }
}
/** 下面几个正则对应 TestAssessmentBuilder / ApiChangeRunService 的固定句式，后端改措辞要一起改 */
const UNKNOWN_KIND_RE = /^(.+?)，没认出是哪类改动：对照二\.1 里的变更行，找开发问清楚新旧行为差在哪$/
const CHECK_Q_RE = /^【(单子没写|代码没看到) · (.+?)】/
const DB_FAIL_RE = /^(.+?)：(\d+) 个库连不上（(.+)）(?:。关联的库里没找到 (.+?)，可能在没关联的库里)?$/
const SCHEMA_RE = /^(.+?)：(这个项目还没关联测试库.*|读项目关联的测试库失败.*|关联的库里没找到 .+)$/
/** 只有「需求要不要这样」才问产品；实现细节、发版怎么配都问开发；工具认项目认得对不对自己看 */
const ASK_PRODUCT_RE = /是需求要求的吗|下线是否确认/
const SELF_CHECK_RE = /按 .+ 处理了，确认没认错|项目管理里没找到/

const dbOpen = ref<Record<number, boolean>>({})
const flashId = ref('')

/** 代码改了单子没写：这些都是开发定的，问开发要，补进单子备注，发版照着做 */
const CODE_ONLY_WHY: Record<string, string> = {
  定时任务:
    '找开发要：任务名、cron、参数，测试环境怎么手动触发。为什么要：不知道怎么触发就测不了；上线时调度中心（XXL-JOB）没人新建 / 改任务，新代码根本不会跑。',
  配置: '找开发要：配置项和测试 / 生产各自的值。为什么要：测试环境不先配上测不出来；生产 Apollo 没同步，上线就按默认值跑。',
  表: '找开发要：上线前要执行的 SQL。为什么要：单子里没写，发版时容易漏执行，代码一上就报错。',
  字段: '找开发要：加 / 改字段的 SQL。为什么要：单子里没写，发版时容易漏执行，代码一上就报错。'
}

function mismatchItem(c: any, idx: number): ConfirmItem {
  const hint = (c.hint || '').replace(/[；，。]?\s*单子里补上$/, '')
  const codeM = (c.code || '').match(/^(.+?)（(.+)）$/)
  const codeOnly = c.status === 'CODE_ONLY'
  return {
    kind: 'ask',
    tag: '要问开发',
    anchor: `cf-mis-${idx}`,
    title: `${c.topic}：${hint}`,
    desc: codeOnly
      ? (CODE_ONLY_WHY[c.topic] || `代码改了${c.topic}，单子里没写 —— 找开发问清楚。`) + '让开发补进单子备注，发版时照着做。'
      : c.status === 'TICKET_ONLY'
        ? `单子里写了${c.topic}，但代码里没看到对应改动 —— 找开发确认是还没做、在别的仓库，还是工具没认出来。`
        : `单子和代码对不上，工具判断不了 —— 人工对一下。`,
    foot: {
      status: CHECK_STATUS_LABEL[c.status] || c.status,
      file: codeM ? codeM[1] : c.code || undefined,
      text: [codeM?.[2], c.ticket ? `单子：${c.ticket}` : ''].filter(Boolean).join(' · ') || undefined
    }
  }
}

function questionItem(q: string): ConfirmItem {
  const m = q.match(UNKNOWN_KIND_RE)
  if (m) {
    return {
      kind: 'ask',
      tag: '要问开发',
      title: '规则没认出是哪类改动 —— 先让 AI 翻译，还说不清再问开发',
      desc: `${m[1]}，规则引擎归不了类（不代表没问题）。到「逻辑改动」点「翻译成业务规则」，AI 读完整方法写出新旧规则；对不上或拿不准再找开发确认。`,
      foot: { label: '去看', text: '「逻辑改动」→ 这个方法的「旧规则 / 新规则」' }
    }
  }
  const tag = ASK_PRODUCT_RE.test(q) ? '要问产品' : SELF_CHECK_RE.test(q) ? '自己核对' : '要问开发'
  return { kind: 'ask', tag, title: q }
}

function dbItem(m: RegExpMatchArray): ConfirmItem {
  const [, proj, total, groupsText, missing] = m
  const dbs: string[] = []
  const errors: string[] = []
  for (const g of groupsText.split('；')) {
    const k = g.indexOf('：')
    const names = (k > 0 ? g.slice(0, k) : g).replace(/ 等 \d+ 个$/, '')
    dbs.push(...names.split('、').filter(Boolean))
    if (k > 0) errors.push(g.slice(k + 1))
  }
  const offline = errors.some((e) => /Communications link failure|VPN|timed out|Connection refused/i.test(e))
  return {
    kind: 'env',
    tag: '环境问题',
    title: `${total} 个关联库连不上` + (missing ? ` —— 库里没找到要测的 ${missing}` : ''),
    desc:
      (offline ? '很可能是没连内网 / VPN。' : '检查「项目管理 → 关联库」里的连接配置。') +
      `表结构没读到，${proj} 和表有关的测试点可能不全；连上后重新分析这一单。`,
    dbs,
    dbTotal: Number(total),
    errors,
    impact: missing ? `表 ${missing} 的结构没读到（可能在连不上的库里，也可能在没关联的库里）` : undefined
  }
}

const confirmItems = computed<ConfirmItem[]>(() => {
  if (!a.value) return []
  const asks: ConfirmItem[] = []
  const usedMis = new Set<number>()
  const misIdx = (topic: string) => mismatches.value.findIndex((c: any, i: number) => !usedMis.has(i) && c.topic === topic)
  for (const q of a.value.questions || []) {
    const cm = q.match(CHECK_Q_RE)
    if (cm) {
      const i = misIdx(cm[2])
      if (i >= 0) {
        usedMis.add(i)
        asks.push(mismatchItem(mismatches.value[i], i))
        continue
      }
    }
    asks.push(questionItem(q))
  }
  mismatches.value.forEach((c: any, i: number) => !usedMis.has(i) && asks.push(mismatchItem(c, i)))

  const envs: ConfirmItem[] = []
  if (pending.value.length) {
    envs.push({
      kind: 'env',
      tag: '结论不完整',
      title: `${pending.value.length} 个项目没分析到`,
      desc: '和这些项目有关的接口、影响面都不知道，补上代码或修正项目后重新分析。',
      list: pending.value
    })
  }
  const scope: string[] = []
  for (const s of a.value.limits || []) {
    const dm = s.match(DB_FAIL_RE)
    if (dm) envs.push(dbItem(dm))
    else if (SCHEMA_RE.test(s)) {
      const unbound = s.includes('还没关联测试库')
      envs.push({
        kind: 'env',
        tag: '环境问题',
        title: unbound ? '项目没关联测试库，表结构没读到' : '表结构没读到',
        desc: unbound
          ? s.replace(/^(.+?)：这个项目还没关联测试库，?/, '$1 没关联测试库，') +
            (/连不上/.test(s) ? '（试的是没绑项目的通用库，不是这个项目的库）' : '')
          : s
      })
    }
    else if (!(pending.value.length && s.includes(' 缺代码（'))) scope.push(s)
  }
  if (scope.length) {
    envs.push({
      kind: 'scope',
      tag: '需人工判断',
      title: '这次没分析到的范围',
      desc: '下面这些**不代表没问题**，只是这次分析覆盖不到，需要人工判断。',
      list: scope
    })
  }
  return [...asks, ...envs]
})
const askCount = computed(() => confirmItems.value.filter((x) => x.kind === 'ask' && x.tag !== '自己核对').length)
const mismatchSummary = computed(() => {
  const w: Record<string, string> = { CODE_ONLY: '代码改了但需求单没写', TICKET_ONLY: '单子写了但代码没看到' }
  return [...new Set(mismatches.value.map((c: any) => w[c.status] || '内容对不上'))].join('；')
})
function gotoMismatch() {
  const id = confirmItems.value.find((x) => x.anchor)?.anchor
  if (!id) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashId.value = id
  setTimeout(() => (flashId.value = ''), 1600)
}

/** 最要紧的放第一个：有后端先看接口，纯前端先看前端，没分析过只能看改动范围 */
function defaultTab() {
  if (!a.value) return 'scope'
  if (backends.value.length) return 'api'
  if (hasFront.value) return 'front'
  return 'pending'
}

// ---------------- 接口卡片 ----------------
const verdictFilter = ref('ALL')
const verdictCount = computed(() => {
  const m: Record<string, number> = {}
  for (const c of cards.value) m[c.verdict] = (m[c.verdict] || 0) + 1
  return m
})
const verdictsPresent = computed(() => Object.keys(VERDICT).filter((v) => verdictCount.value[v]))
const viewCards = computed(() => cards.value.map(normalizeCard))
const filteredCards = computed(() =>
  verdictFilter.value === 'ALL' ? viewCards.value : viewCards.value.filter((c) => c.verdict === verdictFilter.value)
)

const KEY_FOLD = 3
const keysOpen = ref<Record<string, boolean>>({})
function toggleKeys(c: any, open: boolean) {
  keysOpen.value = { ...keysOpen.value, [cardKey(c)]: open }
}

/**
 * 老数据（重新分析前）里，并发风险连同整串缓存 key 在「怎么测」「可能出问题」各写一遍，
 * 这里拆成和新数据一样的「重点」块，key 只留在「查数据」里
 */
const OLD_FOCUS: Array<{ re: RegExp; label: string; title: string; keys: boolean }> = [
  { re: /^写接口同时在操作缓存：(.*?)。(.*?)\s*——\s*(.*)$/s, label: '并发', title: '写接口同时在操作缓存与库', keys: true },
  { re: /^重复提交：()(.*?)\s*——\s*(.*)$/s, label: '重复提交', title: '同样的请求并发提交', keys: false },
  { re: /^丢更新：()(.*?)\s*——\s*(.*)$/s, label: '丢更新', title: '计数 / 金额类字段并发写', keys: false }
]
function normalizeCard(c: any) {
  if (c.focus?.length) return c
  const focus: any[] = []
  const risks: string[] = []
  for (const r of c.risks || []) {
    const hit = OLD_FOCUS.map((f) => ({ f, m: r.match(f.re) })).find((x) => x.m)
    if (!hit) {
      risks.push(r)
      continue
    }
    const [, keys, risk, how] = hit.m!
    focus.push({
      label: hit.f.label,
      title: hit.f.title,
      risk: risk.trim(),
      how: how.trim(),
      keys: hit.f.keys ? keys.split('、').filter(Boolean).length : 0
    })
  }
  const tests = (c.tests || [])
    .filter((t: string) => !t.startsWith('改动的实现：') && !(focus.length && t.startsWith('并发：')))
    .map((t: string) => (t.startsWith('还没有接口用例') ? '测完把这条接口用例补上，否则下次还得靠人记' : t))
  return { ...c, focus, risks, tests }
}
const opened = ref<Record<string, boolean>>({})

function cardKey(c: any) {
  return `${c.project}|${c.method} ${c.path}`
}
function isOpen(c: any) {
  const k = cardKey(c)
  if (k in opened.value) return opened.value[k]
  return ['NEW', 'BREAKING', 'OFFLINE'].includes(c.verdict) || cards.value.length <= 3
}
function toggleCard(c: any) {
  opened.value = { ...opened.value, [cardKey(c)]: !isOpen(c) }
}
function targetOf(c: any) {
  return backends.value.find((x: any) => tName(x) === c.project)
}

// ---------------- AI 生成用例 ----------------
const tryRun = ref(false)
const runWrites = ref(false)
const starting = ref('')
const jobs = ref<Record<string, AiCaseJob>>({})
let timer: ReturnType<typeof setTimeout> | null = null

function jobRunning(x: any) {
  return x && jobs.value[x.projectCode]?.running
}
function jobText(j: AiCaseJob) {
  const base = `${j.done}/${j.total} 个接口，新建 ${j.created} 条用例` + (j.enabledCases ? `，启用 ${j.enabledCases}` : '')
  if (j.running) return 'AI 生成中：' + base
  if (j.cancelled) return '已停止：' + base
  return (j.failed ? `完成（${j.failed} 个失败）：` : '完成：') + base + (j.message ? `。${j.message}` : '')
}
function aiItem(c: any): AiCaseJobItem | undefined {
  const x = targetOf(c)
  const j = x && jobs.value[x.projectCode]
  return j?.items?.find((i) => i.method?.toUpperCase() === c.method && i.path === c.path)
}
function aiItemText(i: AiCaseJobItem) {
  const n = i.cases ? ` ${i.cases} 条` : ''
  return (AI_STATUS[i.status] || i.status) + n + (i.note && (i.status === 'SKIPPED' || i.status === 'FAILED') ? `：${i.note}` : '')
}

async function startAi(x: any, c?: any) {
  starting.value = c ? cardKey(c) : x.projectCode + '|*'
  try {
    const job = await apiClient.startApiChangeAiCases(props.batch.id, props.ticket.key, {
      projectCode: x.projectCode,
      endpoints: c ? [`${c.method} ${c.path}`] : undefined,
      tryRun: tryRun.value,
      runWrites: tryRun.value && runWrites.value
    })
    jobs.value = { ...jobs.value, [x.projectCode]: job }
    ElMessage.success('AI 开始生成，用例会放进分支用例')
    emit('reload')
    schedulePoll()
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    starting.value = ''
  }
}

async function cancelAi(x: any) {
  const j = jobs.value[x.projectCode]
  if (!j) return
  try {
    await apiClient.cancelAiCaseJob(j.id)
    await poll()
  } catch (e: any) {
    ElMessage.error(e?.message || '停止失败')
  }
}

async function poll() {
  const running = Object.entries(jobs.value).filter(([, j]) => j.running)
  for (const [code, j] of running) {
    try {
      const fresh = await apiClient.getAiCaseJob(j.id)
      jobs.value = { ...jobs.value, [code]: fresh }
      if (!fresh.running) ElMessage.success(`${code}：AI 生成完成，新建 ${fresh.created} 条用例`)
    } catch {
      /* 后端重启后任务就没了，不再轮询 */
      jobs.value = { ...jobs.value, [code]: { ...j, running: false, message: '任务已不在（后端重启过）' } }
    }
  }
}

function schedulePoll() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    await poll()
    if (Object.values(jobs.value).some((j) => j.running)) schedulePoll()
  }, 2500)
}

/** 切到别的单 / 刷新页面后，把这一单最近的 AI 任务接回来 */
async function restoreJobs() {
  const next: Record<string, AiCaseJob> = {}
  for (const x of backends.value) {
    if (!x.aiJobId) continue
    try {
      next[x.projectCode] = await apiClient.getAiCaseJob(x.aiJobId)
    } catch {
      /* 任务只在内存里，后端重启后拿不到 */
    }
  }
  jobs.value = next
  if (Object.values(next).some((j) => j.running)) schedulePoll()
}

// ---------------- AI 测试教练 ----------------
const coachVisible = ref(false)
const coachCard = ref<any>(null)
const coachAsk = ref<{ text: string; shown: string } | null>(null)

/** item 有值 = 从某一条测法点进来，打开就直接问这一条 */
function openCoach(c: any, item?: string) {
  coachCard.value = c
  coachAsk.value = item
    ? { text: `这一条我不太会测，请结合代码一步步教我：「${item}」`, shown: `这条怎么测：${item}` }
    : null
  coachVisible.value = true
}
watch(coachVisible, (v) => {
  if (!v) coachAsk.value = null
})

// ---------------- 逻辑改动：翻译成业务规则 ----------------
type LogicExplain = {
  title?: string
  oldRule?: string[]
  newRule?: string[]
  factors?: Array<{ name: string; change?: string; detail?: string }>
  impact?: string
  focus?: string[]
  vsTicket?: string
  unsure?: string
  codeSeen?: string
  at?: string
}
const lxBusy = ref<Record<string, boolean>>({})
const lxAll = ref(false)
const lxError = ref('')
const lxHintsOpen = ref<Record<string, boolean>>({})
const lxCodeOpen = ref<Record<string, boolean>>({})

/** 和后端 LogicExplainService.groupKey 一致 */
function exKey(g: any) {
  const d = g.items[0]
  return `${d.project}|${d.className}.${d.member}`
}
function exOf(g: any): LogicExplain | null {
  return props.ticket?.logicExplains?.[exKey(g)] || null
}
const untranslated = computed(() => logicGroups.value.filter((g) => !exOf(g)))

async function explain(g: any) {
  const d = g.items[0]
  lxBusy.value = { ...lxBusy.value, [g.key]: true }
  lxError.value = ''
  try {
    emit('update', await apiClient.explainApiChangeLogic(props.batch.id, props.ticket.key, {
      project: d.project,
      className: d.className,
      member: d.member
    }))
    return true
  } catch (e: any) {
    lxError.value = `${d.member}()：${e?.message || '翻译失败'}`
    return false
  } finally {
    lxBusy.value = { ...lxBusy.value, [g.key]: false }
  }
}

async function explainAll() {
  lxAll.value = true
  try {
    for (const g of [...untranslated.value]) {
      if (!(await explain(g))) break
    }
  } finally {
    lxAll.value = false
  }
}

/** 新旧规则按行对齐，少的一边留空 */
function ruleCompare(ex: LogicExplain) {
  const o = ex.oldRule || []
  const n = ex.newRule || []
  return Array.from({ length: Math.max(o.length, n.length) }, (_, i) => [o[i] || '', n[i] || ''])
}
function factorMark(c?: string) {
  return c === '新增' ? '+' : c === '去掉' ? '−' : '~'
}
function factorCls(c?: string) {
  return c === '新增' ? 'add' : c === '去掉' ? 'del' : 'mod'
}

/** 规则认出来的具体改动（「改动行」兜底那条不算） */
function ruleRows(g: any) {
  return g.items.filter((d: any) => d.kind !== 'METHOD_CHANGED' && (d.before || d.after))
}
function ruleHints(g: any): string[] {
  const out: string[] = []
  for (const d of g.items) {
    if (d.kind === 'METHOD_CHANGED' || !d.hint || out.includes(d.hint)) continue
    out.push(d.hint)
  }
  return out
}
function autoTitle(g: any) {
  const d = g.items[0]
  const labels = [...new Set(ruleRows(g).map((x: any) => LOGIC_KIND_LABEL[x.kind] || x.kind))].slice(0, 3)
  return `${d.member}${d.kind === 'CONFIG' || d.kind === 'CONSTANT' ? '' : '()'}：${labels.length ? labels.join('、') + '改了' : '逻辑改了'}`
}

const NEW_TYPE_RE = /\b[A-Z][A-Za-z0-9]*(?:DTO|Dto|VO|Vo|BO|Bo|PO|Po|Entity|Breakdown)\b/g
/** 改后的代码里新出现的 DTO / VO 之类：返回或落库的结构多了一层，要专门验序列化 */
function newTypes(g: any): string[] {
  const before = g.items.map((d: any) => d.before || '').join('\n')
  const after = g.items.map((d: any) => d.after || '').join('\n')
  const was = new Set(before.match(NEW_TYPE_RE) || [])
  return [...new Set<string>(after.match(NEW_TYPE_RE) || [])].filter((t) => !was.has(t)).slice(0, 3)
}

/** 测试重点：AI 的在前；没翻译时用规则的测试点；新出现的结构单独提一条 */
function focusOf(g: any): string[] {
  const ex = exOf(g)
  const out = ex?.focus?.length ? [...ex.focus] : ruleHints(g)
  const types = newTypes(g)
  if (types.length && g.endpoints.length && !out.some((s) => types.some((t) => s.includes(t)))) {
    out.push(`改后多了 ${types.join('、')} 结构：调接口断言这些字段都在、类型对、数值和明细累加得上；老数据没有这些字段时不报错`)
  }
  return out
}

/** 没连到接口的方法：接口测不到，换成能照着做的专项验证 */
function asyncAction(g: any): { tag: string; title: string; steps: string[] } | null {
  if (g.endpoints.length) return null
  const d = g.items[0]
  const m = d.member
  const code = g.items.map((x: any) => `${x.before || ''}\n${x.after || ''}`).join('\n')
  const job = /@XxlJob\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/.exec(code)?.[1]
  const topic = /(?:topics?|queues|destination)\s*=\s*\{?\s*"([^"]+)"/.exec(code)?.[1]
  const types = newTypes(g)
  const typeStep = types.length ? `验证新增的 ${types.join('、')} 结构能正常序列化 / 落库：字段齐全、类型对，老数据读出来不报错` : ''
  const pick = (tag: string, title: string, steps: string[]) => ({ tag, title, steps: [...steps, typeStep].filter(Boolean) })
  if (g.items.some((x: any) => x.kind === 'SCHEDULE') || /@Scheduled|@XxlJob/.test(code)) {
    return pick('定时任务', `${m}() 是定时任务，接口测不到`, [
      job ? `去调度中心找到任务 ${job}，手动触发一次` : '测试环境手动触发一次（调度中心执行一次 / 临时改执行时间），别等自然执行',
      '跑完查它处理的表：条数、字段值和新规则对得上；再跑一次，确认不会重复处理'
    ])
  }
  if (/@(?:Kafka|Rabbit|Jms|RocketMQMessage)Listener/.test(code) || g.items.some((x: any) => x.kind === 'MQ' && /消费/.test(x.title))) {
    return pick('消息消费', `${m}() 消费消息，接口测不到`, [
      topic ? `往 ${topic} 发一条测试消息` : '找开发要 topic 和消息样例，发一条测试消息',
      '看消费后的数据 / 日志；同一条消息再发一次，确认不会重复处理'
    ])
  }
  if (/pop|poll|queue|consume|dequeue|onMessage|handle\w*(?:Msg|Message)/i.test(m)) {
    return pick('队列 / 异步', `底层 ${m}() 队列消费逻辑改了`, [
      '触发一次会入队的业务操作（或手动往队列塞一条），等它被消费',
      '核对消费后的落库 / 缓存结果和新规则对得上；消费失败时能不能重试、会不会丢或重复'
    ])
  }
  if (/job|task|sync|batch|refresh|clean|stat|report/i.test(m)) {
    return pick('跑批', `${m}() 像是跑批 / 同步逻辑`, [
      '找开发确认怎么触发（定时任务 / 手动接口 / 启动时跑），测试环境触发一次',
      '对比跑之前和跑之后的数据：条数、金额 / 分数这类汇总值对得上新规则'
    ])
  }
  return pick('公共方法', `${m}() 没连到接口`, [
    '平台只追了一层调用，没找到哪个接口用到它（不代表没影响）：找开发确认谁调它 —— 接口、定时任务、MQ 还是别的服务',
    '从每个调用入口各测一次，按下面的测试重点核对结果'
  ])
}

/** 逻辑改动借用 AI 测试教练：拿方法当「卡片」，问法带上这一处的改动 */
function logicCard(g: any) {
  const ex = exOf(g)
  return {
    kind: 'METHOD',
    method: '方法',
    path: g.title,
    project: g.project,
    summary: ex?.title || autoTitle(g),
    endpoints: g.endpoints,
    logic: g.items.map(
      (d: any) =>
        `${LOGIC_KIND_LABEL[d.kind] || d.kind}：${d.title}` +
        (d.before ? `\n  改前：${d.before}` : '') +
        (d.after ? `\n  改后：${d.after}` : '')
    ),
    tests: focusOf(g),
    changes: ex ? [...(ex.oldRule || []).map((s) => '旧：' + s), ...(ex.newRule || []).map((s) => '新：' + s)] : []
  }
}
function askLogic(g: any, what: 'explain' | 'cases') {
  const eps = g.endpoints.length ? `（能经由 ${g.endpoints.join('、')} 触发）` : '（没连到接口，说明怎么触发）'
  const ask =
    what === 'explain'
      ? {
          text: `读一下 ${g.title} 改前、改后的完整代码，用测试听得懂的话解释这次改了什么：旧规则怎么算 / 怎么判断，新规则怎么算 / 怎么判断。再举一组具体数字，分别按新旧规则算一遍给我看。`,
          shown: `解释这段逻辑：${g.title}`
        }
      : {
          text: `帮我给 ${g.title} 这次的改动写边界测试用例${eps}：用表格列出 场景 / 前置数据 / 入参 / 期望结果 / 怎么核对，覆盖 0、临界值、极大值、空值，以及「只满足旧规则」的数据；能用接口触发的给出 curl。`,
          shown: `写边界用例：${g.title}`
        }
  coachCard.value = logicCard(g)
  coachAsk.value = ask
  coachVisible.value = true
}

function shortTime(s?: string) {
  return s ? String(s).replace('T', ' ').slice(5, 16) : ''
}

// ---------------- 用例 / Bug ----------------
const collecting = ref(false)
const bugs = ref<any[]>([])
const bugVisible = ref(false)
const bugSaving = ref(false)
const bugValue = ref<BugSubmitValue>(defaultBugValue())
const bugProject = ref('')

async function createCollections() {
  collecting.value = true
  try {
    const res = await apiClient.createApiChangeBatchCollections(props.batch.id)
    emit('update', res.batch)
    ElMessage.success(`新建 / 关联 ${res.created.length} 个分支用例集合` + (res.skipped.length ? `，跳过 ${res.skipped.length} 个` : ''))
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    collecting.value = false
  }
}

function openCollections(x: any) {
  const query: Record<string, string> = { project: x.projectCode }
  if (isIssueKey.value) query.requirementNo = props.ticket.key
  router.push({ path: '/api-collections', query })
}

function openCases(c: any) {
  const x = targetOf(c)
  router.push({ path: '/api-collections', query: { project: x?.projectCode || '', path: c.path, method: c.method } })
}

/** 这个项目这次分析存下的原始结果：接口逐字段前后对比、改动文件清单。只读已存的，不重新分析 */
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailTarget = ref<any>(null)
const detailReport = ref<any>(null)
const detailSec = ref<'ep' | 'files'>('ep')
const detailRefs = computed(() =>
  detailReport.value ? `${detailReport.value.baseRef || ''}..${detailReport.value.headRef || ''}` : ''
)
async function openReport(x: any) {
  detailTarget.value = x
  detailReport.value = null
  detailSec.value = 'ep'
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailReport.value = (await apiClient.getApiChangeReport(x.reportId)).report
  } catch (e: any) {
    ElMessage.error(e?.message || '读取明细失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadBugs() {
  bugs.value = []
  if (!isIssueKey.value) return
  try {
    bugs.value = (await apiClient.fetchRequirementBugs(props.ticket.key)) || []
  } catch {
    /* Bug 列表拿不到不挡主流程 */
  }
}

function openBug(c?: any) {
  if (!isIssueKey.value) {
    ElMessage.warning('这一单没有 JIRA 单号，Bug 挂不上需求')
    return
  }
  const x = c ? targetOf(c) : backends.value[0]
  bugProject.value = x?.projectCode || ''
  bugValue.value = defaultBugValue({
    requirementNo: props.ticket.key,
    appVersion: props.batch?.version || '',
    assignee: props.ticket.assignee || '',
    reporter: props.ticket.qaAssignee || '',
    summary: c ? `${c.method} ${c.path}${c.summary ? '（' + c.summary + '）' : ''}：` : '',
    module: c?.summary || ''
  })
  bugVisible.value = true
}

async function submitBug(payload: Record<string, any>) {
  bugSaving.value = true
  try {
    await apiClient.createBug({ ...payload, requirementNo: props.ticket.key, projectCode: bugProject.value || undefined })
    ElMessage.success('Bug 已记下')
    bugVisible.value = false
    await loadBugs()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    bugSaving.value = false
  }
}

// ---------------- 测试小结：给开发看「测完 / 测好 / 测全没有」 ----------------
type ColInfo = { project: string; cases: Array<{ method: string; path: string }>; caseCount: number; passRate: number | null; lastRunAt: string | null }
const cols = ref<ColInfo[]>([])
const summaryLoading = ref(false)

async function loadSummary() {
  summaryLoading.value = true
  try {
    cols.value = await Promise.all(
      backends.value
        .filter((x: any) => x.collectionId)
        .map(async (x: any) => {
          const [cases, list] = await Promise.all([
            apiClient.getApiTestCollectionCases(x.collectionId).catch(() => []),
            apiClient.getApiTestCollections({ project: x.projectCode, scope: 'TEST', includeArchived: true }).catch(() => [])
          ])
          const c = (list || []).find((o: any) => o.id === x.collectionId)
          return {
            project: tName(x),
            cases: (cases || []).filter((o: any) => o.enabled !== false),
            caseCount: c?.caseCount ?? (cases || []).length,
            passRate: c?.passRate ?? null,
            lastRunAt: c?.lastRunAt ?? null
          }
        })
    )
    await loadBugs()
  } finally {
    summaryLoading.value = false
  }
}

function samePath(a: string, b: string) {
  const x = (a || '').replace(/\/+$/, '')
  const y = (b || '').replace(/\/+$/, '')
  return x === y || x.endsWith(y) || y.endsWith(x)
}
const summary = computed(() => {
  const live = cards.value.filter((c) => c.verdict !== 'OFFLINE')
  const branchCases = cols.value.flatMap((c) => c.cases)
  const uncovered = live.filter(
    (c) =>
      !(c.testCases > 0) &&
      !branchCases.some((k) => (k.method || '').toUpperCase() === (c.method || '').toUpperCase() && samePath(k.path, c.path))
  )
  const offline = cards.value.filter((c) => c.verdict === 'OFFLINE')
  const unfixed = bugs.value.filter((b) => !b.fixed && !b.verified)
  const toVerify = bugs.value.filter((b) => b.fixed && !b.verified)
  const notRun = cols.value.filter((c) => c.caseCount > 0 && !c.lastRunAt)
  const failing = cols.value.filter((c) => c.lastRunAt && c.passRate != null && c.passRate < 100)
  const noCollection = backends.value.filter((x: any) => !x.collectionId)

  const blockers: string[] = []
  if (!a.value) blockers.push('还没分析')
  if (unfixed.length) blockers.push(`${unfixed.length} 个 Bug 未修复`)
  if (toVerify.length) blockers.push(`${toVerify.length} 个 Bug 待验证`)
  if (uncovered.length) blockers.push(`${uncovered.length} 个改动接口还没用例`)
  if (notRun.length) blockers.push(`分支用例还没跑：${notRun.map((c) => c.project).join('、')}`)
  if (failing.length) blockers.push(`分支用例有失败：${failing.map((c) => `${c.project} 通过率 ${c.passRate}%`).join('、')}`)
  if (pending.value.length) blockers.push(`${pending.value.length} 个项目没分析到`)
  if (mismatches.value.length) blockers.push(`单子和代码 ${mismatches.value.length} 处对不上`)

  const sig = (c: any) => `${c.method} ${c.path}`
  const head = (xs: any[], n = 8) => xs.slice(0, n).map(sig).join('、') + (xs.length > n ? ` 等 ${xs.length} 个` : '')
  const lines: Array<{ text: string; warn?: boolean }> = []
  if (backends.value.length) {
    lines.push({
      text: `改动接口 ${live.length} 个，有用例 ${live.length - uncovered.length} 个` + (uncovered.length ? `；没用例：${head(uncovered)}` : ''),
      warn: uncovered.length > 0
    })
    for (const c of cols.value) {
      const run = c.lastRunAt ? `最近一次 ${String(c.lastRunAt).replace('T', ' ').slice(5, 16)} 通过率 ${c.passRate ?? '—'}%` : '还没跑'
      lines.push({ text: `分支用例 · ${c.project}：${c.caseCount} 条，${run}`, warn: !c.lastRunAt || (c.passRate ?? 100) < 100 })
    }
    if (noCollection.length) lines.push({ text: `还没建分支用例集合：${noCollection.map(tName).join('、')}`, warn: true })
  }
  if (offline.length) lines.push({ text: `下线接口 ${offline.length} 个：${head(offline)}，已确认没有调用方再上线` })
  lines.push({
    text: bugs.value.length
      ? `Bug ${bugs.value.length} 个：未修复 ${unfixed.length}，待验证 ${toVerify.length}，已验证 ${bugs.value.length - unfixed.length - toVerify.length}`
      : isIssueKey.value ? 'Bug：无' : 'Bug：这一单没有单号，平台里查不到',
    warn: unfixed.length + toVerify.length > 0
  })
  for (const s of pending.value) lines.push({ text: `没分析到（不代表没问题）：${s}`, warn: true })
  if (mismatches.value.length) {
    lines.push({ text: `单子和代码对不上：${mismatches.value.map((c: any) => c.topic).join('、')}`, warn: true })
  }
  return { done: blockers.length === 0, blockers, lines, live, uncovered, offline, unfixed, toVerify, notRun, failing, noCollection }
})

/** 小结拆成一行一件事：每行带「去哪处理」的按钮，处理完变 ✓ */
type CkAction = { label: string; run: () => void; type?: 'primary' | 'danger'; disabled?: boolean; loading?: boolean }
type CkItem = {
  key: string
  state: 'todo' | 'done' | 'info'
  title: string
  badge?: string
  chips?: Array<{ text: string; method?: string; cls?: string; title?: string }>
  desc?: string
  lines?: Array<{ tag: string; cls: string; text: string }>
  actions?: CkAction[]
}
const epChip = (c: any) => ({ method: c.method, text: ' ' + ((c.path || '').split('/').filter(Boolean).pop() || c.path), title: `${c.method} ${c.path}` })
function lastSeg(xs: any[], n = 6) {
  const chips = xs.slice(0, n).map(epChip)
  if (xs.length > n) chips.push({ text: `等 ${xs.length} 个`, cls: 'more' } as any)
  return chips
}
function gotoPending(mis: boolean) {
  tab.value = 'pending'
  if (mis) setTimeout(gotoMismatch, 80)
}
const checklist = computed<CkItem[]>(() => {
  const s = summary.value
  const out: CkItem[] = []
  if (backends.value.length) {
    const live = s.live.length
    const covered = live - s.uncovered.length
    out.push(
      s.uncovered.length
        ? {
            key: 'cover',
            state: 'todo',
            title: `${s.uncovered.length} 个改动接口还没有用例`,
            badge: `${covered} / ${live}`,
            chips: lastSeg(s.uncovered),
            actions: [{ label: '去写用例 ›', run: () => openCollections(targetOf(s.uncovered[0]) || backends.value[0]) }]
          }
        : { key: 'cover', state: 'done', title: live ? '改动接口都有用例' : '没有要补用例的接口', badge: live ? `${live} / ${live}` : undefined }
    )
    if (s.noCollection.length) {
      out.push({
        key: 'col',
        state: 'info',
        title: '分支用例集合还没建',
        chips: s.noCollection.map((x: any) => ({ text: tName(x) })),
        desc: '测完的用例放进分支集合，下次回归直接跑',
        actions: [{ label: '建集合', run: createCollections, loading: collecting.value }]
      })
    }
    for (const c of s.notRun) {
      out.push({
        key: 'run-' + c.project,
        state: 'todo',
        title: '分支用例还没跑',
        badge: `${c.caseCount} 条`,
        chips: [{ text: '✓ 已建集合', cls: 'ok' }, { text: c.project }],
        actions: [{ label: '去跑 ›', run: () => openCollections(backends.value.find((x: any) => tName(x) === c.project) || backends.value[0]) }]
      })
    }
    for (const c of s.failing) {
      out.push({
        key: 'fail-' + c.project,
        state: 'todo',
        title: '分支用例有失败',
        badge: `通过率 ${c.passRate}%`,
        chips: [{ text: c.project }],
        actions: [{ label: '去看 ›', run: () => openCollections(backends.value.find((x: any) => tName(x) === c.project) || backends.value[0]) }]
      })
    }
    const passed = cols.value.filter((c) => c.lastRunAt && (c.passRate ?? 100) >= 100)
    if (passed.length && !s.notRun.length && !s.failing.length) {
      out.push({
        key: 'run',
        state: 'done',
        title: '分支用例已跑通',
        chips: passed.map((c) => ({ text: `${c.project} · ${c.caseCount} 条 · ${String(c.lastRunAt).replace('T', ' ').slice(5, 16)}` }))
      })
    }
  }
  if (pending.value.length) {
    out.push({
      key: 'pending',
      state: 'todo',
      title: '有项目没分析到',
      badge: `${pending.value.length} 个`,
      desc: pending.value.join('；') + '（不代表没问题）',
      actions: [{ label: '去看 ›', run: () => gotoPending(false) }]
    })
  }
  if (mismatches.value.length) {
    const w: Record<string, string> = { CODE_ONLY: '代码改了，需求单里没提', TICKET_ONLY: '单子写了，代码里没看到' }
    out.push({
      key: 'mismatch',
      state: 'todo',
      title: '单子和代码对不上',
      badge: `${mismatches.value.length} 处`,
      desc: mismatches.value.map((c: any) => `${c.topic} —— ${w[c.status] || '对不上'}`).join('；'),
      actions: [{ label: '去看 ›', run: () => gotoPending(true) }]
    })
  }
  if (s.offline.length) {
    out.push({
      key: 'offline',
      state: 'info',
      title: `下线接口 ${s.offline.length} 个`,
      chips: lastSeg(s.offline),
      desc: '确认没有调用方再上线'
    })
  }
  const bugLines = bugs.value.slice(0, 6).map((b) => ({
    tag: b.verified ? '已验证' : b.fixed ? '已修复待验' : '未修复',
    cls: b.verified ? 'cs-MATCH' : b.fixed ? 'cs-CHECK' : 'cs-CODE_ONLY',
    text: firstLine(b.description)
  }))
  const bugActs: CkAction[] = [
    { label: '记 Bug', type: 'danger', run: () => openBug(), disabled: !isIssueKey.value },
    { label: '去 Bug 管理 ›', run: () => router.push('/bug-management') }
  ]
  if (!isIssueKey.value) {
    out.push({
      key: 'bug',
      state: 'info',
      title: '这一单还没记 Bug',
      badge: '挂不上',
      desc: '这一单没有 JIRA 单号，Bug 挂不上需求 —— 要在平台上记 Bug，需要先补单号',
      actions: [bugActs[0]]
    })
  } else if (s.unfixed.length || s.toVerify.length) {
    out.push({
      key: 'bug',
      state: 'todo',
      title: [s.unfixed.length && `${s.unfixed.length} 个 Bug 未修复`, s.toVerify.length && `${s.toVerify.length} 个待验证`].filter(Boolean).join('，'),
      badge: `共 ${bugs.value.length} 个`,
      lines: bugLines,
      actions: bugActs
    })
  } else {
    out.push({
      key: 'bug',
      state: bugs.value.length ? 'done' : 'info',
      title: bugs.value.length ? `Bug 都已验证（${bugs.value.length} 个）` : '这一单还没记 Bug',
      desc: bugs.value.length ? undefined : '测出问题在这里记，先记在平台里，再手动同步到 JIRA',
      lines: bugLines,
      actions: bugActs
    })
  }
  return out
})
const todoCount = computed(() => checklist.value.filter((x) => x.state === 'todo').length)

const summaryText = computed(() => {
  const t = props.ticket || {}
  const s = summary.value
  return [
    `【测试小结】${t.key || ''} ${t.summary && t.summary !== '本地目录对比' ? t.summary : ''}`.trim(),
    `结论：${s.done ? '测完了，改动接口都有用例、分支用例已跑通、Bug 都已验证' : '还没测完 —— ' + s.blockers.join('；')}`,
    ...s.lines.map((l) => '· ' + l.text)
  ].join('\n')
})

async function copySummary() {
  const text = summaryText.value
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制，可以直接发群里')
  } catch {
    ElMessageBox.alert(text, '复制下面的内容', { customStyle: { whiteSpace: 'pre-wrap', maxWidth: '720px' } as any })
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessageBox.alert(text, '复制下面的内容', { customStyle: { whiteSpace: 'pre-wrap', maxWidth: '720px' } as any })
  }
}

/** 两个目录去掉公共前缀，只留前缀最后一级 + 各自剩下的部分，最后一级加粗 */
function dirView(x: any) {
  const split = (p: string) => String(p || '').replace(/\/+$/, '').split('/')
  const a = split(x.baseDir)
  const b = split(x.headDir)
  let n = 0
  while (n < a.length - 1 && n < b.length - 1 && a[n] === b[n]) n++
  const view = (segs: string[]) => {
    const rest = segs.slice(n)
    const lead = (n > 1 ? '…/' + segs[n - 1] + '/' : n === 1 ? '/' : '') + rest.slice(0, -1).map((s) => s + '/').join('')
    return { lead, last: rest[rest.length - 1] || '' }
  }
  return { base: view(a), head: view(b), prefix: n > 1 ? a.slice(0, n).join('/') + '/' : '' }
}

/** 「接口 3 · 高风险 0 · 表 2 · 其它 2 · 风险点 1」拆成小标签：0 置灰，高风险 / 风险点有数标红 */
function summaryChips(s?: string) {
  const out: Array<{ label: string; n: number; cls: string }> = []
  for (const part of String(s || '').split('·')) {
    const m = part.trim().match(/^(.+?)\s+(\d+)$/)
    if (!m) return []
    const n = Number(m[2])
    const bad = /风险/.test(m[1])
    out.push({ label: m[1], n, cls: n === 0 ? 'zero' : bad ? 'bad' : '' })
  }
  return out
}

// ---------------- 工具 ----------------
function tName(x: any) {
  return x.projectName || x.projectCode || x.rawProject
}
function kindText(x: any) {
  if (!x.projectCode) return '没找到项目'
  if (x.kind === 'BACKEND' && !x.analyzable) return '后端（不扫接口）'
  return KIND_TEXT[x.kind] || x.kind || '后端'
}
function frontSummary(fc: any) {
  const parts = [`改了 ${fc.changedFiles} 个文件`]
  if (fc.pages?.length) parts.push(`页面 / 组件 ${fc.pages.length} 个`)
  if (fc.addedCalls?.length) parts.push(`新增接口调用 ${fc.addedCalls.length}`)
  if (fc.removedCalls?.length) parts.push(`删掉 ${fc.removedCalls.length}`)
  return parts.join(' · ')
}
const BOLD = ['生成用例到分支', '必测', '回归所有调用方', '按新逻辑重跑', '更新断言后重跑', '要停用']
/** action 里的关键动作加粗，一眼看到要干什么 */
function boldParts(s: string) {
  const text = s || ''
  const re = new RegExp(`(${BOLD.join('|')})`)
  return text.split(re).filter(Boolean).map((t) => ({ t, b: BOLD.includes(t) }))
}
function implOf(x: string) {
  return x.startsWith('实现改了：') ? x.slice('实现改了：'.length) : ''
}
function splitLogic(x: string) {
  const i = x.indexOf('：')
  return i < 0 ? [x, ''] : [x.slice(0, i), x.slice(i + 1)]
}
function sentences(s: string | null | undefined) {
  return (s || '').split('。').map((x) => x.trim()).filter(Boolean).map((x) => x + '。')
}
/** key 常量以冒号结尾的是前缀，显示时去掉冒号 */
function cleanKey(k: string) {
  return k.replace(/:(?=（|$)/, '')
}
function lines(s: string | null | undefined) {
  return s ? s.split('\n') : []
}
function firstLine(s: string) {
  return String(s || '').split('\n')[0]
}

watch(
  () => [props.ticket?.key, !!a.value],
  ([key], old) => {
    if (!old || key !== old[0] || tab.value === 'scope') tab.value = defaultTab()
    if (old && key === old[0]) return
    opened.value = {}
    keysOpen.value = {}
    verdictFilter.value = 'ALL'
    logicOpen.value = false
    restoreJobs()
    cols.value = []
    loadBugs()
    autoRebuild()
  },
  { immediate: true }
)

async function autoRebuild() {
  const key = props.ticket?.key
  if (!stale.value || !props.batch?.id || !key || rebuildTried.has(`${props.batch.id}|${key}`)) return
  rebuildTried.add(`${props.batch.id}|${key}`)
  rebuilding.value = true
  try {
    emit('update', await apiClient.rebuildApiChangeBatchTicket(props.batch.id, key))
  } catch {
    /* 重算不了就留着提示，让人点「分析这一单」 */
  } finally {
    rebuilding.value = false
  }
}
watch(tab, (t) => {
  if (t === 'cases') loadSummary()
})

/** 「为什么要注意」每次分析完只在第一次看发版注意时出现，看过就不再占地方 */
const relWhyShown = ref(false)
watch(
  () => [tab.value, props.ticket?.key, props.ticket?.analyzedAt] as const,
  ([t, key, at]) => {
    if (t !== 'release') return
    const k = `acv2.relWhy|${props.batch?.id}|${key}|${at || ''}`
    relWhyShown.value = !localStorage.getItem(k)
    localStorage.setItem(k, '1')
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.tg {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
}
.stale {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.verdict-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.risk {
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 4px;
}
.rk-HIGH {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.rk-MEDIUM {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.rk-LOW {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.hl {
  font-size: 12px;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
.hl.bad,
.bad {
  color: var(--el-color-danger);
}
.hl.warn {
  color: var(--el-color-warning-dark-2);
}
.vl-links {
  flex-basis: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
}
.vl-links .unk {
  margin-left: 0;
}
.vl-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.vl-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.vl-actions.solo {
  justify-content: flex-end;
}
.unk {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-color-danger);
  cursor: pointer;
}
.inner-tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
}
.detail-drawer {
  min-height: 200px;
}
.dd-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 12px;
}
.dd-sec {
  margin-bottom: 12px;
}
.dd-files {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.dd-files td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.dd-st {
  width: 48px;
  white-space: nowrap;
}
.dd-st.st-ADDED {
  color: var(--el-color-success);
}
.dd-st.st-DELETED {
  color: var(--el-color-danger);
}
.dd-st.st-MODIFIED {
  color: var(--el-color-warning-dark-2);
}
.cnt {
  font-style: normal;
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 16px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.cnt.hot {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.tip {
  margin-bottom: 8px;
}
.filter {
  margin-bottom: 8px;
}
.block {
  margin-top: 10px;
}
.block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.block-head em {
  font-style: normal;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.sm {
  font-size: 12px;
}
.err {
  color: var(--el-color-danger);
}
.ok {
  color: var(--el-color-success);
}
.warn-text {
  color: var(--el-color-warning-dark-2);
}
.nowrap {
  white-space: nowrap;
}
.mono,
.mono-sm,
.mono-ish {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mono-sm {
  font-size: 12px;
  word-break: break-all;
}
.targets {
  width: 100%;
  border-collapse: collapse;
}
.targets th {
  text-align: left;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  padding: 4px 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.targets td {
  padding: 6px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  vertical-align: top;
}
.tg-name {
  font-weight: 500;
  white-space: nowrap;
}
.tg-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.how {
  margin-left: 6px;
  color: var(--el-color-warning);
}
.k-MISS {
  color: var(--el-color-danger);
}
.box {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.box.warn {
  margin-top: 8px;
  border-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}
.box em {
  font-style: normal;
  color: var(--el-text-color-secondary);
}
.ck {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.ck-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
}
.ck-top :deep(.el-button + .el-button) {
  margin-left: 0;
}
.ck-cnt {
  padding: 0 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 20px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
}
.ck-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px 12px 13px;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.ck-row.s-todo {
  border-left-color: var(--el-color-warning);
}
.ck-row.s-info {
  border-left-color: var(--el-border-color);
}
.ck-row.s-done {
  border-left-color: var(--el-color-success-light-5);
}
.ck-no {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  line-height: 18px;
  margin-top: 1px;
  text-align: center;
  border-radius: 50%;
  font-size: 11px;
  color: var(--el-color-warning-dark-2);
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
}
.s-info .ck-no {
  color: var(--el-text-color-secondary);
  border-color: var(--el-border-color);
  background: var(--el-fill-color-light);
}
.s-done .ck-no {
  color: #fff;
  border-color: var(--el-color-success);
  background: var(--el-color-success);
}
.ck-body {
  flex: 1;
  min-width: 0;
}
.ck-title {
  font-weight: 600;
  line-height: 22px;
}
.s-done .ck-title {
  color: var(--el-text-color-regular);
  font-weight: 500;
}
.ck-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
}
.s-info .ck-badge,
.s-done .ck-badge {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
}
.ck-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.ck-chip {
  padding: 0 7px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.ck-chip em {
  font-style: normal;
  font-weight: 600;
  font-size: 11px;
  color: var(--el-color-primary);
}
.ck-chip.ok {
  font-family: inherit;
  color: var(--el-color-success);
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}
.ck-chip.more {
  font-family: inherit;
  color: var(--el-text-color-secondary);
}
.ck-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
.ck-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
}
.ck-acts {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 1px;
}
.ck-acts :deep(.el-button + .el-button) {
  margin-left: 0;
}
.sum-tip {
  margin-bottom: 6px;
  opacity: 0.75;
}
.sum-pre {
  max-width: 520px;
  max-height: 320px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
}
.ck-done {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.ck-ok {
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  background: var(--el-color-success);
}
.ck-row:last-child {
  border-bottom: none;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.topic {
  font-weight: 500;
}
.cs {
  font-size: 12px;
  padding: 0 6px;
  border-radius: 3px;
  white-space: nowrap;
}
.cs-MATCH {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.cs-CODE_ONLY,
.cs-TICKET_ONLY {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.cs-CHECK {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.notes {
  margin-top: 8px;
  font-size: 12px;
}
.notes summary {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}
.notes pre {
  margin: 6px 0 0;
  padding: 8px 10px;
  max-height: 240px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.ep-tag {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: normal;
}
.proj {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
.lg-item {
  margin-top: 4px;
}
.lk {
  font-size: 11px;
  padding: 0 5px;
  margin-right: 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
.lk-CONDITION,
.lk-FORMULA,
.lk-LITERAL {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.lk-WRITE,
.lk-CACHE,
.lk-MQ,
.lk-TRANSACTION {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.diff {
  margin: 4px 0;
  padding: 6px 8px;
  max-height: 220px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff .del {
  color: var(--el-color-danger);
}
.diff .add {
  color: var(--el-color-success-dark-2);
}
.hint-line {
  font-size: 12px;
  color: var(--el-color-primary);
}
.sc-table td {
  padding: 12px 8px;
  vertical-align: top;
}
.sc-kind {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sc-how {
  padding: 0 6px;
  border-radius: 3px;
  border: 1px solid var(--el-color-warning-light-5);
  line-height: 18px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.sc-kv {
  display: flex;
  align-items: baseline;
  gap: 10px;
  line-height: 1.8;
}
.sc-k {
  flex: none;
  width: 28px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sc-v {
  min-width: 0;
  font-size: 12px;
  word-break: break-all;
}
.sc-dim {
  color: var(--el-text-color-secondary);
}
.sc-v b {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.sc-arrow {
  margin: 0 6px;
  color: var(--el-text-color-secondary);
}
.sc-copy,
.sc-link {
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  cursor: pointer;
}
.sc-copy {
  color: var(--el-text-color-secondary);
}
.sc-copy:hover,
.sc-link {
  color: var(--el-color-primary);
}
.sc-prefix {
  margin-left: 38px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  word-break: break-all;
}
.sc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sc-chip {
  padding: 0 7px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-regular);
}
.sc-chip b {
  font-weight: 600;
}
.sc-chip.zero {
  border-color: var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
}
.sc-chip.bad {
  border-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.sc-link {
  display: block;
  margin-top: 8px;
}
.lx-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.lx-err {
  font-size: 12px;
  color: var(--el-color-danger);
}
.lx {
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
}
.lx-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px 4px;
}
.lx-ico {
  color: var(--el-color-primary);
}
.lx-title {
  font-size: 14px;
}
.lx-ai {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.lx-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 0 14px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.lx-meta code,
.lx-ep {
  padding: 0 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--el-fill-color);
}
.lx-ep + .lx-ep {
  margin-left: 4px;
}
.lx-lab {
  color: var(--el-text-color-secondary);
}
.lx-sec {
  padding: 10px 14px;
}
.lx-sec + .lx-sec {
  border-top: 1px dashed var(--el-border-color-lighter);
}
.lx-sec-h {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.lx-cmp {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
}
.lx-ch {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
}
.lx-ch.old {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.lx-ch.new {
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
}
.lx-cell {
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-extra-light);
  min-width: 0;
}
.lx-cell.old {
  border-right: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-regular);
}
.lx-what {
  margin-right: 6px;
  font-weight: 500;
}
.lx-code {
  display: block;
  margin-top: 4px;
  padding: 4px 6px;
  max-height: 96px;
  overflow: auto;
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.lx-factors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}
.lx-f {
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}
.lx-f em {
  margin-left: 4px;
  font-style: normal;
  color: var(--el-text-color-secondary);
}
.lx-f.add {
  color: var(--el-color-success-dark-2);
  border-color: var(--el-color-success-light-7);
}
.lx-f.del {
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-7);
}
.lx-f.mod {
  color: var(--el-color-warning-dark-2);
  border-color: var(--el-color-warning-light-7);
}
.lx-unknown {
  padding: 8px 12px;
  border: 1px dashed var(--el-color-danger-light-5);
  border-radius: 6px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  font-size: 13px;
}
.lx-trans {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.lx-line {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
}
.lx-line:first-of-type {
  margin-top: 0;
}
.lx-line.warn {
  color: var(--el-color-warning-dark-2);
}
.lx-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color);
}
.lx-tag.ai {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.lx-tag.warn {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.lx-act {
  margin-top: 8px;
  padding: 8px 12px;
  border-left: 3px solid var(--el-color-warning);
  border-radius: 0 6px 6px 0;
  background: var(--el-color-warning-light-9);
}
.lx-act-h {
  font-size: 13px;
  font-weight: 500;
}
.lx-steps {
  margin: 6px 0 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.7;
}
.lx-steps.sub {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.lx-more {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}
.lx-more:disabled {
  color: var(--el-text-color-placeholder);
  cursor: default;
}
.lx-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.lx-foot :deep(.el-button + .el-button) {
  margin-left: 0;
}
.lx-seen {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.lx-seen .lx-more {
  margin-left: 6px;
}
.lx-code-box {
  padding: 6px 14px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.ai-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 6px 10px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
}
.job {
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.job.run {
  color: var(--el-color-primary);
}
.card {
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-border-color-darker);
  border-radius: 8px;
  margin-bottom: 10px;
  background: var(--el-bg-color);
  overflow: hidden;
}
.card.v-NEW,
.card.v-BREAKING {
  border-left-color: var(--el-color-danger);
}
.card.v-OFFLINE,
.card.v-SHAPE {
  border-left-color: var(--el-color-warning);
}
.card.v-ADD {
  border-left-color: var(--el-color-primary);
}
.c-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
}
.v-tag {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.vt-NEW,
.vt-BREAKING {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger);
}
.vt-OFFLINE,
.vt-SHAPE,
.vt-ADD {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-7);
  color: var(--el-color-warning-dark-2);
}
.vt-RERUN {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}
.m {
  font-weight: 700;
  font-size: 12px;
}
.path {
  font-weight: 500;
}
.sum {
  color: var(--el-text-color-secondary);
}
.prio {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--el-color-warning-light-5);
  color: var(--el-color-warning-dark-2);
}
.caret {
  font-size: 12px;
  color: var(--el-color-primary);
}
.action {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 14px;
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.action b {
  font-weight: 600;
}
.bang {
  font-style: normal;
  font-weight: 700;
  color: var(--el-color-primary);
}
.c-body {
  padding: 0 14px;
}
.row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
}
.row + .row {
  border-top: 1px solid var(--el-border-color-extra-light);
}
.row > label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}
.row ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.row li {
  position: relative;
  padding-left: 14px;
  line-height: 20px;
}
.row li + li {
  margin-top: 4px;
}
.row li::before {
  content: '·';
  position: absolute;
  left: 2px;
  color: var(--el-text-color-placeholder);
}
.row code,
.chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.dim {
  color: var(--el-text-color-secondary);
}
.lb-sec {
  color: var(--el-color-danger) !important;
}
.lb-risk,
.lb-focus {
  color: var(--el-color-warning-dark-2) !important;
}
.focus {
  padding: 10px 12px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  line-height: 20px;
}
.f-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 4px;
}
.f-chip {
  font-size: 11px;
  font-weight: normal;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-bg-color);
}
.f-risk {
  font-weight: 500;
}
.f-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 4px;
}
.t-item .ask-one {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  visibility: hidden;
}
.t-item:hover .ask-one {
  visibility: visible;
}
.ask-ai {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
}
.ask-ai:hover,
.ask-one:hover {
  text-decoration: underline;
}
.data {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.d-line {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.d-tag {
  flex: none;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 4px;
  line-height: 18px;
}
.d-table {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.d-cache {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chip {
  padding: 0 6px;
  line-height: 20px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.chip.changed {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
.fold {
  font-size: 12px;
  line-height: 20px;
  color: var(--el-color-primary);
  cursor: pointer;
  white-space: nowrap;
}
.c-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-lighter);
}
.num {
  color: var(--el-text-color-primary);
}
.grow {
  flex: 1;
}
.ai-state {
  font-size: 12px;
}
.as-RUNNING,
.as-WAITING {
  color: var(--el-color-primary);
}
.as-ENABLED,
.as-PENDING {
  color: var(--el-color-success);
}
.as-FAILED,
.as-SKIPPED {
  color: var(--el-color-warning-dark-2);
}
.imp-card {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.imp-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
}
.imp-bang {
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--el-color-warning);
}
.imp-count {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
}
.imp-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.imp-row:last-child {
  border-bottom: none;
}
.imp-row.st-UNKNOWN {
  background: var(--el-color-danger-light-9);
}
.imp-type {
  padding: 12px 14px;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.imp-row > .imp-items {
  padding: 12px 16px;
}
.imp-thead {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.imp-thead .imp-type,
.imp-thead > .imp-items {
  padding-top: 6px;
  padding-bottom: 6px;
}
.imp-thead .muted {
  margin-left: 4px;
  color: var(--el-text-color-placeholder);
}
.imp-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.imp-tag.t-job,
.imp-tag.t-config,
.imp-tag.t-mq {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}
.imp-tag.t-security {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.imp-tag.t-legacy {
  color: var(--el-text-color-regular);
  background: var(--el-fill-color);
}
.st-UNKNOWN .imp-tag {
  color: var(--el-color-danger);
  background: transparent;
  border: 1px dashed var(--el-color-danger-light-5);
}
.imp-items {
  flex: 1;
  min-width: 0;
}
.imp-item + .imp-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.imp-what {
  line-height: 1.7;
}
.imp-what b {
  font-weight: 600;
}
.imp-what code,
.imp-steps code,
.imp-basis code,
.imp-key-extra code {
  padding: 0 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--el-fill-color);
}
.imp-title {
  color: var(--el-color-danger);
}
.imp-unk {
  color: var(--el-color-danger);
}
.imp-eps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.imp-ep {
  padding: 1px 8px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.imp-ep em {
  font-style: normal;
  font-weight: 600;
  font-size: 11px;
  color: var(--el-color-primary);
}
.imp-ep i {
  font-style: normal;
  color: var(--el-color-warning-dark-2);
}
.imp-ep.more {
  font-family: inherit;
  color: var(--el-text-color-secondary);
}
.imp-keys-btn {
  display: inline-block;
  margin-top: 6px;
  padding: 1px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  cursor: pointer;
}
.imp-keys {
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}
.imp-key-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.imp-key {
  padding: 0 6px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}
.imp-key-extra {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
}
.imp-key-extra code {
  margin-left: 4px;
}
.imp-keys .imp-keys-btn {
  margin-top: 8px;
}
.imp-steps {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: imp-n;
}
.imp-steps li {
  position: relative;
  padding-left: 24px;
  line-height: 1.8;
  counter-increment: imp-n;
}
.imp-steps li::before {
  content: counter(imp-n);
  position: absolute;
  left: 0;
  top: 4px;
  width: 16px;
  height: 16px;
  line-height: 16px;
  border-radius: 50%;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
}
.imp-basis {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.b-lab {
  margin-right: 8px;
  color: var(--el-text-color-placeholder);
}
.imp-no {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.imp-no .imp-type,
.imp-no > .imp-items {
  padding-top: 8px;
  padding-bottom: 8px;
}
.imp-no > .imp-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.imp-no-item {
  padding: 0 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  cursor: default;
}
.fg ul,
.fg ul,
.grid3 ul,
.grid3 ol,
.grid2 > div > ul {
  margin: 0;
  padding-left: 18px;
}
.why {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rel-why {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-color-warning-light-7);
  background: var(--el-color-warning-light-9);
}
.rel-why-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rel-bang {
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--el-color-warning);
}
.rel-why ul {
  margin: 6px 0 0;
  padding-left: 24px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}
.rel-plan {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.rel-plan-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.rel-plan-head .muted {
  font-size: 12px;
}
.rel-must-cnt {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.rel-phase {
  padding: 12px 16px;
}
.rel-phase + .rel-phase {
  border-top: 1px dashed var(--el-border-color-lighter);
}
.rel-ph-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rel-ph-head .muted {
  font-size: 12px;
}
.rel-ph-no {
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-primary);
}
.rel-steps {
  margin: 8px 0 0 8px;
  padding-left: 18px;
  border-left: 2px solid var(--el-color-primary-light-8);
}
.rel-steps.flat {
  margin: 12px 16px;
}
.rel-step {
  display: flex;
  gap: 8px;
  padding: 4px 0;
}
.rel-step + .rel-step {
  margin-top: 4px;
}
.rel-step-no {
  flex-shrink: 0;
  width: 18px;
  line-height: 22px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rel-step-body {
  flex: 1;
  min-width: 0;
}
.rel-what {
  line-height: 1.7;
}
.rel-what code {
  padding: 0 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: var(--el-fill-color);
}
.rel-step.must .rel-what {
  font-weight: 500;
}
.cf-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.cf-top {
  display: flex;
  align-items: center;
  margin: 0 -16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
}
.cf-top .muted {
  font-size: 12px;
}
.cf-none {
  padding: 8px 0;
}
.cf-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--el-color-warning-light-7);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.cf-card {
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-warning);
  border-radius: 6px;
  overflow: hidden;
  transition: box-shadow 0.3s;
}
.cf-card.k-env {
  border-left-color: var(--el-color-danger);
}
.cf-card.k-scope {
  border-left-color: var(--el-border-color);
}
.cf-card.flash {
  box-shadow: 0 0 0 3px var(--el-color-warning-light-5);
}
.cf-main {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
}
.cf-no {
  flex-shrink: 0;
  width: 18px;
  line-height: 22px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cf-body {
  flex: 1;
  min-width: 0;
}
.cf-title {
  font-weight: 600;
  line-height: 1.6;
}
.cf-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  vertical-align: 1px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
}
.k-scope .cf-tag {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
}
.cf-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}
.cf-title code,
.cf-desc code,
.cf-list code,
.cf-kv code,
.cf-foot code,
.cf-chips code {
  padding: 0 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 400;
  background: var(--el-fill-color);
}
.cf-sec {
  padding: 8px 14px 10px 42px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  font-size: 12px;
}
.cf-sec-head {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.cf-sec-head a {
  color: var(--el-color-primary);
}
.cf-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 4px;
}
.cf-chips code {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}
.cf-kv {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.cf-list {
  margin: 0;
  padding: 8px 14px 10px 58px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
}
.cf-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 42px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.cf-foot .b-lab {
  margin-right: 0;
}
.cf-status {
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
}
.must-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-danger);
}
.fgroups,
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.compat {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.compat-body {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.bug-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
@media (max-width: 1100px) {
  .fgroups,
  .grid2,
  .grid3 {
    grid-template-columns: 1fr;
  }
}
</style>
