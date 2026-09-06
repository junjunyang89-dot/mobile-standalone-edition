<template>
  <div class="ui-flows">
    <div class="toolbar">
      <div class="toolbar-tools">
        <el-button
          :disabled="!batchSelection.length"
          @click="openBatch"
        >批量执行{{ batchSelection.length ? `（${batchSelection.length}）` : '' }}</el-button>
      </div>
      <div class="toolbar-create">
        <el-button type="primary" @click="openAdd">
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新建流程
        </el-button>
      </div>
    </div>

    <div class="filter-panel">
      <div class="chip-row">
        <span class="chip-label">产品</span>
        <div class="chip-list">
          <button
            v-for="p in PRODUCTS"
            :key="p.id"
            type="button"
            class="app-chip"
            :class="{ active: filterProduct === p.id }"
            @click="selectProduct(p.id)"
          >{{ p.label }}</button>
        </div>
      </div>
      <div class="chip-row">
        <span class="chip-label">平台</span>
        <div class="chip-list">
          <button
            v-for="p in visiblePlatforms"
            :key="p.value"
            type="button"
            class="plat-chip"
            :class="{ active: filterPlatform === p.value }"
            @click="selectPlatform(p.value)"
          >{{ p.label }}</button>
        </div>
      </div>
      <div class="chip-row">
        <span class="chip-label">环境</span>
        <div class="chip-list">
          <button
            v-for="e in ENV_CHIPS"
            :key="e.value || 'ALL'"
            type="button"
            class="env-chip"
            :class="{ active: filterEnvironment === e.value, prod: e.value === 'PROD', test: e.value === 'TEST' }"
            @click="selectEnvironment(e.value)"
          >{{ e.label }}</button>
        </div>
      </div>
      <div class="chip-row">
        <span class="chip-label">用途</span>
        <div class="chip-list">
          <button
            v-for="c in CATALOG_CHIPS"
            :key="c.value || 'ALL'"
            type="button"
            class="app-chip"
            :class="{ active: filterCatalog === c.value }"
            @click="selectCatalog(c.value)"
          >{{ c.label }}</button>
        </div>
      </div>
      <div class="search-row">
        <el-input
          v-model="filterName"
          clearable
          class="search-input"
          placeholder="搜索流程名称..."
          @keyup.enter="onFilterChange"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <label class="comp-switch">
          <el-switch v-model="componentOnly" @change="onFilterChange" />
          仅组件
        </label>
        <el-button type="primary" @click="onFilterChange">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <span class="search-count">{{ listContextText }}</span>
      </div>
    </div>

    <div class="list-panel">
      <el-table
        v-loading="loading"
        class="flow-list-table"
        :data="pagedList"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#f5f7fa', color: '#1f2329' }"
        row-key="id"
        :row-class-name="flowRowClassName"
        @selection-change="batchSelection = $event"
      >
        <el-table-column type="selection" width="46" :selectable="(row: any) => !row.isComponent" />
        <el-table-column prop="name" label="流程名称" min-width="160">
          <template #default="{ row }">
            <span class="flow-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="步骤数" width="88" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ stepCount(row.steps) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="组件" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isComponent" size="small" type="success">是</el-tag>
            <span class="muted-dash" v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column prop="environment" label="环境" width="120">
          <template #default="{ row }">
            <el-tag
              v-if="row.catalog !== 'AUTOMATION' && (row.envBound === false || row.envBound === 0)"
              size="small"
              type="info"
              effect="plain"
            >
              不绑环境
            </el-tag>
            <el-tag
              v-else
              size="small"
              :type="row.environment === 'TEST' ? 'warning' : 'success'"
              effect="plain"
            >
              {{ row.environment === 'TEST' ? '测试' : '生产' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="catalog" label="用途" width="170">
          <template #default="{ row }">
            <el-tag size="small" :type="catalogTagType(row.catalog)" effect="light">
              {{ catalogLabel(row.catalog) }}
            </el-tag>
            <!--
              存量的装包流程都还标着「回归+自动化」。逐条翻几百行找出来是不现实的，
              所以直接标出来：含安装步骤、用途却不是「装包准备」的，点一下就能改。
            -->
            <el-tooltip
              v-if="looksLikeInstallFlow(row) && row.catalog !== 'INSTALL'"
              content="这条流程包含安装步骤，但用途不是「装包准备」——它会混在回归勾选列表里稀释通过率。点击改用途"
              placement="top"
            >
              <el-tag
                size="small"
                type="warning"
                effect="plain"
                class="catalog-suggest"
                @click.stop="openEdit(row)"
              >建议改为装包</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="110">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.platform === 'IOS' ? 'warning' : row.platform === 'ANDROID' ? 'success' : 'info'"
              effect="plain"
            >
              {{ row.platform || '通用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="148" align="center">
          <template #default="{ row }">
            <div class="result-cell">
              <el-tag
                v-if="row.lastRunStatus"
                size="small"
                :type="runTagType(row.lastRunStatus)"
                :style="row.lastRunTaskId ? 'cursor:pointer' : ''"
                @click="openLastRun(row)"
              >
                {{ runLabel(row.lastRunStatus) }}
              </el-tag>
              <!--
                试跑必须单独挂出来：正式结果在时，旧逻辑会把试跑藏掉——
                人刚点完试跑，列上还是上次正式的「通过」，以为这次没跑或没结果。
              -->
              <el-tag
                v-if="row.lastDebugStatus"
                size="small"
                effect="plain"
                :type="runTagType(row.lastDebugStatus)"
                :style="row.lastDebugTaskId ? 'cursor:pointer' : ''"
                @click="openDebugRun(row)"
              >
                试跑·{{ runLabel(row.lastDebugStatus) }}
              </el-tag>
              <span v-if="!row.lastRunStatus && !row.lastDebugStatus" class="result-idle">未跑</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="flow-desc">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="290" fixed="right">
          <template #default="{ row }">
            <el-button type="success" link size="small" @click="openExecute(row)">试跑</el-button>
            <el-button
              type="warning"
              link
              size="small"
              :loading="scanningId === row.id"
              @click="openEnvScan(row)"
            >
              环境检查
            </el-button>
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm:delete type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="当前筛选下没有流程，可换环境或新建一条" />
      <div v-if="list.length" class="pagination-wrap">
        <el-pagination
          v-model:current-page="listPage"
          v-model:page-size="listPageSize"
          :page-sizes="[10, 20, 50]"
          :total="list.length"
          layout="total, sizes, prev, pager, next"
          @size-change="listPage = 1"
        />
      </div>
    </div>

    <!--
      跨环境可用性：同一条流程要在测试环境和线上都跑，写死的手机号 / 赛事 ID 就是拦路石。
      只报不改——那串数字是手机号还是订单号只有人知道，猜错了会把能跑的流程改坏。
    -->
    <el-dialog v-model="envScanVisible" width="720px" title="跨环境可用性检查" destroy-on-close>
      <el-alert
        :type="envScanHits.length ? 'warning' : 'success'"
        :closable="false"
        :title="envScanSummary"
        show-icon
      />
      <div v-if="envScanHits.length" class="env-scan-list">
        <div v-for="(h, i) in envScanHits" :key="i" class="env-scan-item">
          <div class="env-scan-top">
            <el-tag size="small" type="info">第 {{ h.stepNo }} 步</el-tag>
            <span class="env-scan-param">{{ h.paramName }}</span>
            <code class="env-scan-value">{{ h.value }}</code>
            <el-tag v-if="h.suggestVariable" size="small" type="warning">
              建议改成 {{ h.suggestVariable }}
            </el-tag>
          </div>
          <div class="env-scan-reason">{{ h.reason }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="envScanVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="execVisible"
      width="560px"
      destroy-on-close
      align-center
      class="exec-flow-dialog"
      :show-close="false"
    >
      <template #header>
        <div class="exec-dlg-header">
          <div class="exec-dlg-title">执行流程</div>
          <button type="button" class="exec-dlg-close" aria-label="关闭" @click="execVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>

      <div v-loading="execLoading" element-loading-text="正在读取设备与安装包…" class="exec-dlg-body">
        <div class="exec-flow-card">
          <div class="exec-flow-title-row">
            <span class="exec-flow-name">{{ execFlow?.name || '—' }}</span>
            <span class="exec-plat-pill" :class="'plat-' + execPlatformKey">{{ execPlatformText }}</span>
          </div>
          <div class="exec-flow-meta">{{ execEnvAppText }}</div>
          <div class="exec-flow-stats">
            <span class="exec-stat">
              <el-icon><Operation /></el-icon>
              步骤 <b>{{ execStepCount }} 步</b>
            </span>
            <span class="exec-stat">
              <el-icon><Clock /></el-icon>
              上次 <b :class="'run-' + execLastRunTone">{{ execLastRunLabel }}</b>
            </span>
            <span class="exec-stat">
              <el-icon><CircleCheck /></el-icon>
              覆盖用例 <b>{{ execCaseCountText }}</b>
            </span>
          </div>
        </div>

        <div class="exec-field">
          <div class="exec-dev-head">
            <div class="exec-field-label">选择执行设备</div>
            <el-button
              link
              type="primary"
              class="exec-refresh-btn"
              :loading="execRefreshing"
              @click="refreshExecDevices"
            >
              <el-icon v-if="!execRefreshing"><Refresh /></el-icon>
              刷新设备
            </el-button>
          </div>
          <div v-if="!execDevices.length" class="exec-hint">
            当前没有在线的 {{ execPlatformText }} 设备，点「刷新设备」扫描，或先到设备管理连接
          </div>
          <div v-else class="exec-dev-list">
            <button
              v-for="d in execDevices"
              :key="d.id"
              type="button"
              class="exec-dev-card"
              :class="[
                execDeviceKind(d),
                { selected: execForm.deviceId === d.id }
              ]"
              :disabled="execDeviceKind(d) === 'offline'"
              @click="selectExecDevice(d)"
            >
              <span class="exec-dev-radio" :class="{ on: execForm.deviceId === d.id }" />
              <span class="exec-dev-icon"><el-icon><Iphone /></el-icon></span>
              <span class="exec-dev-main">
                <span class="exec-dev-name">{{ execDeviceTitle(d) }}</span>
                <span class="exec-dev-sub">{{ execDeviceSub(d) }}</span>
              </span>
              <span class="exec-dev-status" :class="execDeviceKind(d)">
                <i />{{ execDeviceStatusText(d) }}
              </span>
            </button>
          </div>
        </div>

        <div v-if="execInstallSummary.mode === 'LOCAL_APK'" class="exec-field">
          <div class="exec-field-label">安装包</div>
          <div class="exec-install-box">
            <div v-if="execInstallSummary.apkPath" class="exec-apk-path">
              <span v-if="apkPathDir(execInstallSummary.apkPath)" class="apk-dir">
                {{ apkPathDir(execInstallSummary.apkPath) }}
              </span>
              <span class="apk-file">{{ apkPathFile(execInstallSummary.apkPath) }}</span>
            </div>
            <div v-if="execInstallSummary.apkArtifactId" class="exec-mono muted">
              applications ID: {{ execInstallSummary.apkArtifactId }}
            </div>
            <div v-if="execInstallSummary.hint" class="exec-hint warn">{{ execInstallSummary.hint }}</div>
          </div>
        </div>
        <div v-else-if="execInstallSummary.mode === 'CHANNEL_PAGE'" class="exec-field">
          <div class="exec-field-label">安装方式</div>
          <div class="exec-hint">{{ execInstallSummary.hint || '渠道页 / 应用商店（流程内已配置）' }}</div>
        </div>
        <div v-else-if="execInstallSummary.mode === 'QR_ASSIST'" class="exec-field">
          <div class="exec-field-label">安装方式</div>
          <div class="exec-hint">扫码辅助安装（执行日志会展示二维码）</div>
        </div>

        <div v-if="pgyerBuilds.length" class="exec-field">
          <div class="exec-field-label">安装版本</div>
          <el-select v-model="execForm.pgyerBuildKey" class="exec-field-control" placeholder="选择要安装的版本">
            <el-option
              v-for="(b, i) in pgyerBuilds"
              :key="b.buildKey"
              :label="`${b.buildVersion} (build ${b.buildBuildVersion})  ${b.buildCreated}${i === 0 ? '  ← 最新' : ''}`"
              :value="b.buildKey" />
          </el-select>
          <div class="exec-hint">默认选中最新一个。装完日志里会写清实际装的是哪个版本</div>
        </div>
        <div v-else-if="pgyerLoadError" class="exec-field">
          <div class="exec-field-label">安装版本</div>
          <div class="exec-hint">{{ pgyerLoadError }}</div>
        </div>

        <div class="exec-field">
          <div class="exec-field-label">执行环境</div>
          <div class="exec-env-toggle">
            <button
              type="button"
              class="exec-env-btn"
              :class="{ active: execForm.environment === 'PROD' }"
              @click="execForm.environment = 'PROD'"
            >生产环境</button>
            <button
              type="button"
              class="exec-env-btn"
              :class="{ active: execForm.environment === 'TEST' }"
              @click="execForm.environment = 'TEST'"
            >测试环境</button>
          </div>
          <!--
            自动化流程本来就不绑环境（同一条流程既跑线上包也跑测试包，差别只在数据），
            对它提示「登记的环境不一致」是错的——那个 environment 字段对自动化流程根本不参与筛选，
            提示只会让人以为自己选错了。只有回归流程才谈环境一致。
          -->
          <div
            v-if="execEnvMismatch"
            class="exec-hint warn"
          >
            这条流程登记的环境是「{{ execFlow.environment === 'TEST' ? '测试环境' : '生产环境' }}」，
            本次要跑另一个环境。确认元素定位和账号在那边也成立再执行。
          </div>
        </div>

        <div v-if="execVars.length" class="exec-field">
          <div class="exec-field-label"><span class="req">*</span>定位变量</div>
          <div class="exec-vars-box">
            <div v-for="v in execVars" :key="v" class="exec-var-row">
              <span class="exec-var-name">{{ v }}</span>
              <el-input v-model="execForm.params[v]" size="default" :placeholder="`填入 ${v} 的值`" />
            </div>
            <div class="exec-hint">这些是流程里写成 ${'{'}变量{'}'} 的定位片段，每次执行按当前数据填</div>
          </div>
        </div>

        <div class="exec-opt-card">
          <div class="exec-opt-row">
            <div class="exec-opt-text">
              <div class="exec-opt-title">立即执行</div>
              <div class="exec-opt-sub">开启后创建任务并马上开始跑；关闭则只创建待执行任务</div>
            </div>
            <el-switch v-model="execForm.runNow" />
          </div>
          <div class="exec-opt-row">
            <div class="exec-opt-text">
              <div class="exec-opt-title">记入统计</div>
              <div class="exec-opt-sub">
                默认关＝试跑：结果不算通过率、不当这条流程的「最近结果」、失败不告警。
                在这里改完步骤跑一下本来就是调试，调试挂两次不该拉低质量数据。
                要作为一次正式执行留档时再打开。
              </div>
            </div>
            <el-switch v-model="execForm.countInStats" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="exec-dlg-footer">
          <div class="exec-picked">
            <template v-if="selectedExecDevice">已选: {{ execDeviceTitle(selectedExecDevice) }}</template>
            <template v-else>尚未选择设备</template>
          </div>
          <div class="exec-dlg-actions">
            <el-button class="exec-btn-cancel" @click="execVisible = false">取消</el-button>
            <el-button type="primary" class="exec-btn-primary" :loading="executing" @click="submitExecute">
              <el-icon v-if="!executing" class="el-icon--left"><VideoPlay /></el-icon>
              {{ execForm.countInStats ? '开始执行' : '开始试跑' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!--
      试跑跑完不该让人自己去找结果。这个弹窗跟着执行接口返回的 taskId 走，
      结果、卡在哪一步、那一刻的截图都在里头。
    -->
    <FlowRunWatch
      v-model:visible="watchVisible"
      :task-id="watchTaskId"
      :flow-name="watchFlowName"
      :debug-run="watchIsDebug"
    />

    <!--
      批量执行：勾一批用例 → 按前置依赖拓扑排序 → 顺序跑。
      跟回归的区别只有顺序怎么来——回归是勾选顺序（人定），这里是依赖决定。
    -->
    <el-dialog v-model="batchVisible" title="批量执行" width="640px" destroy-on-close>
      <el-form label-width="96px">
        <el-form-item label="执行设备">
          <el-select v-model="batchDeviceIds" multiple clearable placeholder="选择已连接设备" style="width: 100%">
            <el-option
              v-for="d in deviceOptions"
              :key="d.id"
              :label="`${d.name || d.id}（${d.platform || '-'}）`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="复位流程">
          <el-select
            v-model="batchResetFlowId"
            clearable
            filterable
            placeholder="留空＝不复位（用例之间会带着上一条的页面状态）"
            style="width: 100%"
            @change="refreshBatchOrder"
          >
            <el-option
              v-for="f in batchResetCandidates"
              :key="f.id"
              :label="f.name"
              :value="f.id"
            />
          </el-select>
          <div class="exec-hint" style="margin-top: 6px">
            每条用例<strong>之前</strong>都跑一次，把设备带回已知起点（建议内容：冷启动 + 清弹窗 + 确认首页）。
            第一条前面不跑——那时 APP 可能还没装。<br />
            跟「前置流程」的区别：前置一批里<strong>只跑一次</strong>，复位<strong>每条都跑</strong>。
            复位不计入通过率，它是基础设施不是用例。
          </div>
        </el-form-item>
        <el-form-item label="已勾选">
          <div style="width: 100%">
            <div class="exec-hint">{{ batchSelection.length }} 条用例</div>
            <div v-if="batchOrderError" class="exec-hint" style="color: #ff4d4f; margin-top: 6px">
              {{ batchOrderError }}
            </div>
            <div v-else-if="!batchOrder.length" class="exec-hint" style="color: #faad14; margin-top: 6px">
              没算出执行顺序，无法开始。多半是后端还没重启（顺序预览接口是新加的），重启后端后重开本弹窗即可。
            </div>
            <template v-else>
              <div v-if="batchAutoAdded.length" class="exec-hint" style="color: #faad14; margin-top: 6px">
                按前置依赖自动补入 {{ batchAutoAdded.length }} 条：{{ batchAutoAddedNames }}
              </div>
              <ol class="batch-order">
                <!-- 复位步骤会重复出现同一个 flowId，key 必须带下标否则 v-for 撞 key -->
                <li v-for="(st, i) in batchOrder" :key="`${st.id}-${i}`">
                  {{ st.label }}
                  <el-tag
                    v-if="st.id === batchResetFlowId"
                    size="small"
                    type="info"
                    effect="plain"
                  >复位</el-tag>
                  <el-tag
                    v-else-if="batchAutoAdded.includes(st.id)"
                    size="small"
                    type="warning"
                    effect="plain"
                  >前置·自动补入</el-tag>
                </li>
              </ol>
            </template>
          </div>
        </el-form-item>
      </el-form>
      <div class="exec-hint">
        被多条用例依赖的前置，一批里<strong>只跑一次</strong>。某条失败时，只有（传递）依赖它的会被跳过，
        不相干的用例继续跑。
      </div>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="batchStarting"
          :disabled="!!batchOrderError || !batchOrder.length"
          @click="submitBatch"
        >开始执行</el-button>
      </template>
    </el-dialog>

    <ProdExecuteConfirm
      v-model="prodDlg"
      :flow-name="prodMeta.flowName"
      :device-name="prodMeta.deviceName"
      @confirm="onProdConfirmed"
      @cancel="onProdCancelled"
    />

    <el-drawer
      v-model="drawerVisible"
      class="ui-flow-drawer"
      size="86%"
      destroy-on-close
      append-to-body
      :close-on-click-modal="false"
      @close="onDrawerClosed"
    >
      <template #header>
        <div class="drawer-header-bar">
          <div class="drawer-header-main">
            <span class="drawer-title">
              <template v-if="editingId">
                编辑流程
                <span v-if="form.name" class="drawer-flow-name">· {{ form.name }}</span>
              </template>
              <template v-else>新建流程</template>
            </span>
            <el-button type="primary" link class="flow-chart-btn" @click="openFlowChart">
              <el-icon><TrendCharts /></el-icon>
              查看流程图
            </el-button>
            <div class="flow-config-summary">
              <el-tag v-for="chip in configSummaryChips" :key="chip.text" size="small" :type="chip.type" effect="plain">
                {{ chip.text }}
              </el-tag>
            </div>
          </div>
          <div class="drawer-header-actions">
            <el-button @click="closeDrawer">取消</el-button>
            <el-button type="primary" :loading="saving" @click="submit">保存流程</el-button>
          </div>
        </div>
      </template>

      <div class="flow-config-section">
        <div class="flow-config-head">流程配置</div>
      <!-- 元信息单独一张 form，避免包住步骤区造成 form 嵌套，浏览器会拆 DOM 导致抽屉关不掉 -->
      <el-form
        ref="formRef"
        class="flow-meta-form"
        :model="form"
        :rules="rules"
        label-position="left"
        label-width="108px"
        require-asterisk-position="right"
        @submit.prevent
      >
        <section class="flow-section">
          <h3 class="flow-section-title">基本信息</h3>
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="如 发现页底部登录" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                排序
                <el-popover placement="top" :width="300" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    回归批次里的列表与执行顺序，数字越小越靠前（默认 100）。装包、登录这类前置流程排最前。
                  </div>
                </el-popover>
              </span>
            </template>
            <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                描述
                <el-popover placement="top" :width="280" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">给人看的说明，执行引擎不读。</div>
                </el-popover>
              </span>
            </template>
            <el-input v-model="form.description" placeholder="一句话说明这条流程做什么（可选）" />
          </el-form-item>
        </section>

        <section class="flow-section">
          <h3 class="flow-section-title">运行与用途</h3>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                运行应用
                <el-popover placement="top" :width="340" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p><strong>清空</strong>表示通用流程：回归选电竞/Pog 等都会列出；卸装/启动跟当次所选 APP。</p>
                    <p>用途为「仅自动化」的流程必须绑定应用，别留空。</p>
                    <p>选具体应用后，点击/输入等步骤可下拉该应用下已「选用」的元素。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-select
              v-model="form.appId"
              clearable
              filterable
              placeholder="不选 = 通用；选则仅该 APP"
              style="width: 100%"
              @change="onFormAppChange"
            >
              <el-option
                v-for="a in appOptions"
                :key="a.id"
                :label="appExecLabel(a)"
                :value="a.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-radio-group v-model="form.platform" class="seg-platform" @change="loadElementsForFlow">
              <el-radio-button v-for="p in platforms" :key="p.value" :label="p.value">
                {{ p.label }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                用途
                <el-popover placement="top" :width="360" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p>决定这条流程出现在哪个入口，<strong>不区分环境</strong>：</p>
                    <p><strong>回归 + 自动化编排</strong>：既进「APP 回归」批次，也能在本页单跑。</p>
                    <p><strong>仅自动化编排</strong>：只在本页单跑，不进回归。只有这一类能关联测试用例。</p>
                    <p><strong>仅回归</strong>：只进回归批次。</p>
                    <p><strong>仅性能测试</strong>：只出现在安卓性能测试。</p>
                    <p><strong>装包准备</strong>：不是用例，不进回归勾选列表，避免稀释通过率。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-select v-model="form.catalog" style="width: 100%" @change="loadLinkableCases">
              <el-option label="回归 + 自动化编排" value="SHARED" />
              <el-option label="仅自动化编排" value="AUTOMATION" />
              <el-option label="仅回归" value="ONLINE" />
              <el-option label="仅性能测试" value="PERFORMANCE" />
              <el-option label="装包准备（不是用例）" value="INSTALL" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                功能阶段
                <el-popover placement="top" :width="360" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p>决定会不会进「APP 线上回归」（那边跑的是上个版本的线上包）。</p>
                    <p><strong>本版新功能</strong>：线上包还没有，只进测试回归和发版前回归。</p>
                    <p><strong>已上线</strong>：三种回归都进。稳定后来这里改，或在用例侧「提升为线上版」。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <div class="stage-chips">
              <button
                type="button"
                class="stage-chip"
                :class="{ active: form.releaseStage === 'TESTING' }"
                @click="form.releaseStage = 'TESTING'"
              >本版新功能</button>
              <button
                type="button"
                class="stage-chip stage-online"
                :class="{ active: form.releaseStage === 'ONLINE' }"
                @click="form.releaseStage = 'ONLINE'"
              >已上线</button>
            </div>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                覆盖用例
                <el-popover placement="top" :width="360" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p>一条流程覆盖多条用例是常态。勾上后这些用例算已实现自动化。</p>
                    <p>装包准备和仅性能测试不能挂用例。列表只有同平台、且没被别的流程占用的用例。</p>
                    <p v-if="!editingId">新建时先保存流程，再回来勾选——关联需要流程 id。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-select
              v-model="form.caseIds"
              multiple
              filterable
              clearable
              :disabled="!linksCases || !editingId"
              :loading="loadingCases"
              :placeholder="caseSelectPlaceholder"
              style="width: 100%"
            >
              <el-option
                v-for="c in linkableCases"
                :key="c.id"
                :label="`${c.caseId || ''} ${c.title}`"
                :value="c.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                前置流程
                <el-popover placement="top" :width="340" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p>批量执行时自动排到本流程之前；多条依赖同一个前置，一批里只跑一次。</p>
                    <p>跟「调用组件」不同：组件是本流程的一部分，每次都跑；前置是执行前提，满足一次就够。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-select
              v-model="form.dependsOn"
              multiple
              filterable
              clearable
              placeholder="留空 = 无前置"
              style="width: 100%"
            >
              <el-option
                v-for="f in dependencyCandidates"
                :key="f.id"
                :label="f.name"
                :value="f.id"
              />
            </el-select>
          </el-form-item>
        </section>

        <section class="flow-section">
          <h3 class="flow-section-title">环境与状态</h3>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                环境
                <el-popover placement="top" :width="340" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <template v-if="form.catalog === 'AUTOMATION'">
                      <p>自动化流程不绑环境——同一条既能跑线上包也能跑测试包，差别只在装哪个包、用哪套变量。</p>
                      <p>这里只是登记，执行时再选环境。</p>
                    </template>
                    <template v-else>
                      <p>这条流程属于哪个环境的用例。环境和用途是两回事：环境是验哪个包，用途是哪个入口用。</p>
                    </template>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-radio-group v-model="form.environment" class="seg-env">
              <el-radio-button label="TEST">测试</el-radio-button>
              <el-radio-button label="PROD">生产</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="存为组件">
            <div class="switch-with-hint">
              <el-switch v-model="form.isComponent" />
              <span class="switch-hint">可被其他流程调用，每次都会跑</span>
            </div>
          </el-form-item>
          <el-form-item label="启用">
            <div class="switch-with-hint">
              <el-switch v-model="form.enabled" />
              <span class="switch-hint">禁用后不出现在批量执行列表</span>
            </div>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                会出现在
                <el-popover placement="top" :width="340" trigger="hover">
                  <template #reference>
                    <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    由用途、环境、功能阶段推出来，改任意一项这里都会跟着变。不是单独要选的字段。
                  </div>
                </el-popover>
              </span>
            </template>
            <div class="appear-box">
              <template v-if="flowScenes.length">
                <el-tag v-for="sc in flowScenes" :key="sc" size="small" type="primary" effect="plain">
                  {{ sc }}
                </el-tag>
              </template>
              <template v-else>
                <el-tag size="small" type="primary" effect="plain">{{ appearFallback.tag }}</el-tag>
                <span class="appear-text">{{ appearFallback.text }}</span>
              </template>
            </div>
          </el-form-item>
        </section>
      </el-form>
      </div>

      <div class="steps-hdr">步骤</div>
      <div class="steps-add-bar">
        <div class="steps-toolbar">
          <el-select v-model="addKeywordCode" placeholder="选择关键字" filterable style="width: 320px">
            <el-option
              v-for="k in keywordsForPicker"
              :key="k.code"
              :label="keywordPickerLabel(k)"
              :value="k.code"
            >
              <span>{{ k.nameZh }}</span>
              <span style="float: right; color: #909399; font-size: 12px">{{ k.code }}</span>
            </el-option>
          </el-select>
          <el-select
            v-model="insertSelId"
            placeholder="插入位置"
            class="insert-pos-select"
            style="width: 360px"
            :disabled="!insertPoints.length"
            popper-class="insert-pos-popper"
            @visible-change="onInsertVisible"
          >
            <el-option disabled value="__search" class="ins-search-opt">
              <el-input
                v-model="insertQuery"
                size="small"
                clearable
                placeholder="按步骤名搜索..."
                :prefix-icon="Search"
                @click.stop
                @mousedown.stop
              />
            </el-option>
            <el-option
              v-if="insertAppendVisible"
              value=""
              label="追加到末尾"
              class="ins-opt-append"
            >
              <div class="ins-append">
                <span class="ins-plus">+</span>
                <span class="ins-append-name">追加到末尾</span>
                <span class="ins-default">默认</span>
              </div>
            </el-option>
            <el-option-group v-if="filteredInsertPoints.length" label="步骤">
              <el-option
                v-for="p in filteredInsertPoints"
                :key="p.id"
                :value="p.id"
                :label="insertAfterClosedLabel(p)"
                :class="['ins-opt', p.depth ? 'is-child' : 'is-root', branchRailClass(p.branch)]"
              >
                <div class="ins-row" :class="{ child: p.depth }">
                  <span
                    v-if="!p.depth"
                    class="ins-no"
                    :style="insertBadgeStyle(p.step.keywordCode)"
                  >{{ p.no }}</span>
                  <div class="ins-body">
                    <div v-if="!p.depth" class="ins-hint">插到之后</div>
                    <div class="ins-name">
                      <template v-if="p.depth">{{ p.no }} {{ keywordName(p.step.keywordCode) }}</template>
                      <template v-else>{{ keywordName(p.step.keywordCode) }}</template>
                    </div>
                  </div>
                  <span v-if="p.branch" class="ins-branch" :class="branchRailClass(p.branch)">{{ p.branch }}</span>
                  <span class="ins-tag" :class="'tone-' + insertMetaTag(p.step.keywordCode).tone">
                    {{ insertMetaTag(p.step.keywordCode).text }}
                  </span>
                  <el-icon v-if="insertSelId === p.id" class="ins-check"><Check /></el-icon>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
          <el-button type="primary" @click="addStep">添加步骤</el-button>
          <el-dropdown trigger="click" @command="onInsertTemplate">
            <span class="template-dropdown-trigger">
              <el-button type="button">
                插入模板
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="sms_login_skeleton">
                  验证码登录骨架（同意 → 手机号/侧栏 → 协议 → 验证码 → 资讯）
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="steps-split">
        <aside class="steps-outline">
          <div class="outline-head">大纲 · {{ outlineRootCount }} 步</div>
          <div v-if="!insertPoints.length" class="outline-empty">还没有步骤</div>
          <button
            v-for="p in visibleOutlinePoints"
            :key="p.step._key || p.no + p.branch"
            type="button"
            class="outline-item"
            :class="{
              active: selectedStep === p.step,
              ['tone-' + stepTone(p.step.keywordCode).category.toLowerCase()]: true
            }"
            :style="{ paddingLeft: 8 + p.depth * 14 + 'px', ...stepToneStyle(p.step.keywordCode) }"
            @click="selectStep(p.step)"
          >
            <span
              v-if="outlineHasChildren(p.step)"
              class="outline-caret"
              :class="{ open: outlineExpanded.has(p.step) }"
              @click="toggleOutlineExpand(p.step, $event)"
            >
              <el-icon><ArrowRight /></el-icon>
            </span>
            <span v-else class="outline-caret-spacer" />
            <span class="outline-no">{{ p.no }}</span>
            <span class="outline-main">
              <span class="outline-name">{{ keywordName(p.step.keywordCode) }}</span>
              <span v-if="p.branch" class="outline-branch">{{ p.branch }}</span>
              <span
                v-if="outlineHasChildren(p.step) && !outlineExpanded.has(p.step)"
                class="outline-kids"
              >{{ outlineChildCount(p.step) }}</span>
              <span v-if="p.step.description" class="outline-desc">{{ p.step.description }}</span>
            </span>
          </button>
        </aside>
        <section class="steps-pane">
        <div v-if="!selectedStep" class="steps-empty">
          {{ insertPoints.length ? '从左侧点一步开始编辑' : '暂无步骤，请从上方添加关键字或插入模板' }}
        </div>

        <div
          v-else
          :key="selectedStep._key || selectedPoint?.no || 'selected'"
          class="step-card"
          :class="`step-card-${stepTone(selectedStep.keywordCode).category.toLowerCase()}`"
          :style="stepToneStyle(selectedStep.keywordCode)"
        >
          <div class="step-head">
            <span class="step-idx">{{ selectedPoint?.no || '·' }}</span>
            <span class="step-name">{{ keywordName(selectedStep.keywordCode) }}</span>
            <span class="step-cat-tag">{{ stepTone(selectedStep.keywordCode).categoryLabel }}</span>
            <el-tag size="small" type="info" effect="plain" class="step-code-tag">{{ selectedStep.keywordCode }}</el-tag>
            <span v-if="selectedPoint?.branch" class="outline-branch">{{ selectedPoint.branch }}</span>
            <span v-if="selectedStep.description" class="step-desc-inline" :title="selectedStep.description">{{ selectedStep.description }}</span>
            <span class="step-spacer" />
            <el-button link size="small" class="step-action-btn" :disabled="!canMoveSelected(-1)" @click="moveSelected(-1)">上移</el-button>
            <el-button link size="small" class="step-action-btn" :disabled="!canMoveSelected(1)" @click="moveSelected(1)">下移</el-button>
            <el-button link size="small" class="step-delete-btn" @click="removeSelected">删除</el-button>
          </div>

          <el-form label-position="top" class="step-form">
            <el-form-item label="备注">
              <el-input
                v-model="selectedStep.description"
                maxlength="120"
                show-word-limit
                placeholder="可选，给自己看的，如：点底部登录入口"
              />
            </el-form-item>
            <el-form-item v-if="needsElement(selectedStep.keywordCode)">
              <template #label>
                <span class="form-label-with-help">
                  {{ elementFieldLabel(selectedStep.keywordCode) }}
                  <el-popover placement="top" :width="320" trigger="hover">
                    <template #reference>
                      <el-icon class="form-help-icon"><QuestionFilled /></el-icon>
                    </template>
                    <div class="form-help-pop">
                      {{ elementScopeHint }}。两端会有同名元素，列表已按流程平台筛过，避免挂错端。
                    </div>
                  </el-popover>
                </span>
              </template>
              <ElementKeySelect
                v-model="selectedStep.elementKey"
                :elements="elementOptions"
                :pages="flowPageOptions"
                :placeholder="elementSelectPlaceholder"
              />
              <div class="element-pick-actions">
                <el-button link type="primary" @click="goDeviceInspect(selectedStep)">记不住？真机点选</el-button>
                <el-button link @click="loadElementsForFlow">刷新列表</el-button>
              </div>
              <div v-if="!form.appId || !form.platform" class="exec-hint" style="margin-top: 6px">
                请先选择「运行应用」和「平台」，再按「页面 → 元素」选择（展示中文名，保存用英文 key）。
              </div>
            </el-form-item>
            <el-form-item v-if="selectedStep.keywordCode === 'IF_ELEMENT_EXISTS'" label="探测超时">
              <el-input-number v-model="selectedStep.params.timeoutSec" :min="1" :max="60" />
              <span class="exec-hint" style="margin-left: 8px">秒</span>
            </el-form-item>
            <!-- 启动 / 冷启动 / 热启动：表单按流程平台渲染，iOS 不显示 appActivity -->
            <LaunchStepFields
              v-if="isLaunchLikeStep(selectedStep.keywordCode)"
              :step="selectedStep"
              :app-options="appOptions"
              :platform="form.platform"
              @app-selected="onLaunchAppSelected"
            />
            <template v-if="isInstallStep(selectedStep.keywordCode)">
              <el-form-item label="安装方式">
                <el-select v-model="selectedStep.params.installMode" style="width: 100%">
                  <el-option label="渠道页 / 应用商店（默认）" value="CHANNEL_PAGE" />
                  <el-option label="蒲公英下载安装" value="PGYER" />
                  <el-option label="已上传本地 APK" value="LOCAL_APK" />
                  <el-option label="扫码辅助安装（人机）" value="QR_ASSIST" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedStep.params.installMode === 'CHANNEL_PAGE'" label="渠道页 URL">
                <el-input
                  v-model="selectedStep.params.channelUrl"
                  clearable
                  placeholder="可选；优先于应用字典 channel_urls / 厂商默认 URI"
                />
              </el-form-item>
              <!--
                蒲公英默认什么都不用填：版本在执行时选，appKey 在应用字典里配。
                buildKey / 直链是少数情况才用的，收进高级区——放在外面新手（和写的人自己）
                都会习惯性去填，而填错一次要走完「下载→安装→看报错」才知道。
                已经有值时自动展开，免得存量流程里的脏值被藏起来。
              -->
              <template v-if="selectedStep.params.installMode === 'PGYER'">
                <el-form-item label="版本">
                  <div class="install-note">
                    这里不用填。<b>执行流程时会列出最近 5 个版本让你选</b>，默认最新的一个。
                    <span v-if="!pgyerReady(selectedStep)">
                      需要先在「应用字典」为该应用配置蒲公英 appKey。
                    </span>
                  </div>
                </el-form-item>
                <el-form-item label=" ">
                  <el-button link type="primary" size="small" @click="toggleInstallAdvanced(selectedStep)">
                    {{ showInstallAdvanced(selectedStep) ? '收起高级设置' : '高级设置（固定版本 / 自定义直链）' }}
                  </el-button>
                </el-form-item>
                <template v-if="showInstallAdvanced(selectedStep)">
                  <el-form-item label="固定 buildKey">
                    <el-input
                      v-model="selectedStep.params.pgyerBuildKey"
                      clearable
                      placeholder="留空即可；填了会锁死装这个版本，每次发版都要来改" />
                  </el-form-item>
                  <el-form-item label="APK/IPA 直链">
                    <el-input
                      v-model="selectedStep.params.pgyerUrl"
                      clearable
                      placeholder="留空即可；只接受以 .apk / .ipa 结尾的直链" />
                    <div class="install-note warn">
                      不要填蒲公英的应用页面链接（如 pgyer.com/pwesports）——那是一张网页，
                      下载下来不是安装包
                    </div>
                  </el-form-item>
                </template>
              </template>
              <template v-if="selectedStep.params.installMode === 'LOCAL_APK'">
                <el-form-item label="上传应用 ID">
                  <el-input v-model="selectedStep.params.apkArtifactId" clearable placeholder="applications 表记录 ID" />
                </el-form-item>
                <el-form-item label="本地路径">
                  <el-input v-model="selectedStep.params.apkPath" clearable placeholder="可选：服务器上的 apk 绝对路径" />
                </el-form-item>
              </template>
              <el-form-item v-if="selectedStep.params.installMode === 'QR_ASSIST'" label="扫码页 URL">
                <el-input
                  v-model="selectedStep.params.qrPayload"
                  clearable
                  placeholder="https 安装页；执行日志会展示二维码，人工扫码后轮询包名"
                />
              </el-form-item>
              <el-form-item label="安装前卸载">
                <el-switch v-model="selectedStep.params.uninstallFirst" />
              </el-form-item>
              <el-alert
                type="info"
                :closable="false"
                show-icon
                style="margin-bottom: 12px"
                title="Android 多方式安装：线上回归默认渠道页；测试环境/专项用蒲公英或本地包；扫码为半自动。iOS 其它方式后续接入。"
              />
            </template>
            <!-- 参数表单由后端 param_schema 驱动，新增关键字前端无需改动 -->
            <KeywordParamFields
              v-if="!isCustomUiKeyword(selectedStep.keywordCode)"
              :schema="keywordSchema(selectedStep.keywordCode)"
              :params="selectedStep.params"
              :keyword-code="selectedStep.keywordCode"
              :environment="form.environment"
              :element-options="elementOptions"
              :page-options="flowPageOptions"
            />
          </el-form>

          <!-- 清理已知弹窗：列表式，出现哪个关哪个 -->
          <DismissPopupsEditor
            v-if="selectedStep.keywordCode === 'DISMISS_POPUPS'"
            :step="selectedStep"
            :element-options="elementOptions"
            :page-options="flowPageOptions"
            @refresh-elements="loadElementsForFlow"
          />

          <!-- 竞速等待：多候选，谁先出现走谁 -->
          <WaitAnyBranchEditor
            v-if="selectedStep.keywordCode === 'WAIT_ANY'"
            :step="selectedStep"
            :path-prefix="selectedPoint?.no || '1'"
            :element-options="elementOptions"
            :page-options="flowPageOptions"
            :keyword-options="keywords"
            :create-step="createStep"
            :keyword-name="keywordName"
            :needs-element="needsElement"
            :keyword-schema="keywordSchema"
            :is-custom-ui="isCustomUiKeyword"
            :app-options="appOptions"
            :platform="form.platform"
            :nest-level="selectedPoint?.depth || 0"
            hide-child-cards
            @added="selectStep"
            @inspect="goDeviceInspect"
            @refresh-elements="loadElementsForFlow"
          />

          <!-- 元素存在判断：存在 / 不存在 两支（支持嵌套） -->
          <IfBranchEditor
            v-if="selectedStep.keywordCode === 'IF_ELEMENT_EXISTS'"
            :step="selectedStep"
            :path-prefix="selectedPoint?.no || '1'"
            :element-options="elementOptions"
            :page-options="flowPageOptions"
            :keyword-options="keywords"
            :create-step="createStep"
            :keyword-name="keywordName"
            :needs-element="needsElement"
            :keyword-schema="keywordSchema"
            :is-custom-ui="isCustomUiKeyword"
            :app-options="appOptions"
            :platform="form.platform"
            :nest-level="selectedPoint?.depth || 0"
            hide-child-cards
            @added="selectStep"
            @inspect="goDeviceInspect"
            @refresh-elements="loadElementsForFlow"
          />
        </div>
        </section>
      </div>
    </el-drawer>

    <FlowChartDialog v-model="flowChartVisible" :steps="steps" />

    <DeviceInspectDrawer
      v-model="inspectVisible"
      :app-id="form.appId"
      :platform="form.platform || 'ANDROID'"
      @saved="onInspectSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { scenesForFlow } from '@/utils/appOnlineRegression'
import { useRoute, useRouter } from 'vue-router'
import KeywordParamFields from '../components/KeywordParamFields.vue'
import FlowRunWatch from '../components/FlowRunWatch.vue'
import ProdExecuteConfirm from '../components/ProdExecuteConfirm.vue'
import ElementKeySelect from '../components/ElementKeySelect.vue'
import WaitAnyBranchEditor from './WaitAnyBranchEditor.vue'
import DismissPopupsEditor from './DismissPopupsEditor.vue'
import LaunchStepFields from './LaunchStepFields.vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowDown, ArrowRight, Check, CircleCheck, Clock, Close, Iphone, Operation, Plus, QuestionFilled, Refresh, Search, TrendCharts, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { stepColorByCode, stepColorStyle } from '@/utils/stepKeywordColor'
import { deviceRowMatchesTaskPlatform, platformUiLabel } from '@/utils/platform'
import IfBranchEditor from './IfBranchEditor.vue'
import DeviceInspectDrawer from '@/components/DeviceInspectDrawer.vue'
import FlowChartDialog from '@/components/FlowChartDialog.vue'

interface FlowStep {
  /** 仅前端列表渲染用，不入库 */
  _key?: string
  keywordCode: string
  elementKey?: string
  /** 给人看的步骤说明（执行引擎忽略） */
  description?: string
  /** 给人看的预期结果，不等于断言（执行引擎忽略） */
  expectation?: string
  params: Record<string, any>
}


/** 建流程时「启动应用程序」默认写入的 Appium capabilities（完美世界电竞） */
const DEFAULT_LAUNCH_APP_PACKAGE = 'com.pwrd.steam.esports'
const DEFAULT_LAUNCH_APP_ACTIVITY = '.ui.activity.launcher.LauncherActivity'

function isScrollUntilStep(code: string) {
  return code === 'SCROLL_UNTIL' || code === 'SCROLL_UNTIL_IOS'
}

function isInstallStep(code: string) {
  return code === 'INSTALL_APP' || code === 'INSTALL_FROM_STORE'
}

/** 启动 / 冷启动 / 热启动：统一由 LaunchStepFields 渲染，是否显示 appActivity 由流程平台决定 */
function isLaunchLikeStep(code: string) {
  const c = String(code || '').toUpperCase()
  return c.startsWith('LAUNCH_APP') || c.startsWith('COLD_START') || c.startsWith('HOT_START')
}

/** 关键字的参数定义，来自后端 param_schema */
function keywordSchema(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  if (!k?.paramSchema) return []
  try {
    const parsed = JSON.parse(k.paramSchema)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 嵌套分支、多方式安装、启动应用等交互由专用编辑器渲染，其余走通用参数表 */
function isCustomUiKeyword(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  return !!k?.customUi
}

/** 该启动步骤是否按 iOS 处理：以流程平台为准，存量 *_IOS 关键字也认 */
function isIosStartStep(code: string) {
  const byPlatform = String(form.platform || '').toUpperCase().includes('IOS')
  return byPlatform || String(code || '').toUpperCase().endsWith('_IOS')
}

/** 任一平台的启动类步骤（同步应用字典包名/BundleId） */
function isAnyLaunchStep(code: string) {
  return (
    code === 'LAUNCH_APP' ||
    code === 'COLD_START' ||
    code === 'HOT_START' ||
    code === 'LAUNCH_APP_IOS' ||
    code === 'COLD_START_IOS' ||
    code === 'HOT_START_IOS'
  )
}

const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' },
]
type ProductId = 'ESPORTS' | 'POGPOG'
const PRODUCTS: { id: ProductId; label: string; platforms: string[] }[] = [
  { id: 'ESPORTS', label: '完美电竞', platforms: ['ANDROID', 'IOS', 'HARMONYOS'] },
  { id: 'POGPOG', label: 'POGPOG', platforms: ['ANDROID', 'IOS'] }
]
const ENV_CHIPS = [
  { value: '', label: '全部' },
  { value: 'TEST', label: '测试' },
  { value: 'PROD', label: '生产' }
]
const CATALOG_CHIPS = [
  { value: '', label: '全部' },
  { value: 'SHARED', label: '回归+自动化' },
  { value: 'AUTOMATION', label: '仅自动化' },
  { value: 'ONLINE', label: '仅回归' },
  { value: 'INSTALL', label: '装包准备' },
  { value: 'PERFORMANCE', label: '仅性能' }
]

const filterProduct = ref<ProductId>('ESPORTS')
const filterAppId = ref('DOMESTIC_ESPORTS')
const filterPlatform = ref('ANDROID')
const filterCatalog = ref('')
const filterName = ref('')
/** 默认测试：测试/生产是两批流程，全铺出来会混在一起 */
const filterEnvironment = ref('TEST')
const componentOnly = ref(false)
const listPage = ref(1)
const listPageSize = ref(20)

const visiblePlatforms = computed(() => {
  const allowed = PRODUCTS.find((p) => p.id === filterProduct.value)?.platforms || []
  return platforms.filter((p) => allowed.includes(p.value))
})

function resolveAppId(product: ProductId, platform: string) {
  if (product === 'POGPOG') return 'OVERSEAS_POGPOG'
  if (String(platform || '').toUpperCase() === 'HARMONYOS') return 'DOMESTIC_ESPORTS_HARMONY'
  return 'DOMESTIC_ESPORTS'
}

function productFromAppId(appId: string): ProductId {
  return String(appId || '').toUpperCase().includes('POGPOG') ? 'POGPOG' : 'ESPORTS'
}

function applyProductSelection(product: ProductId, platform?: string) {
  filterProduct.value = product
  const allowed = PRODUCTS.find((p) => p.id === product)?.platforms || []
  const next = String(platform || filterPlatform.value || 'ANDROID').toUpperCase()
  filterPlatform.value = allowed.includes(next) ? next : allowed[0] || 'ANDROID'
  filterAppId.value = resolveAppId(filterProduct.value, filterPlatform.value)
}

function selectProduct(id: ProductId) {
  if (filterProduct.value === id) return
  applyProductSelection(id)
  onFilterChange()
}

function selectPlatform(value: string) {
  if (filterPlatform.value === value) return
  applyProductSelection(filterProduct.value, value)
  onFilterChange()
}

function selectEnvironment(value: string) {
  if (filterEnvironment.value === value) return
  filterEnvironment.value = value
  onFilterChange()
}

function selectCatalog(value: string) {
  if (filterCatalog.value === value) return
  filterCatalog.value = value
  onFilterChange()
}

function onFilterChange() {
  listPage.value = 1
  loadList()
}

function resetFilters() {
  filterName.value = ''
  filterCatalog.value = ''
  componentOnly.value = false
  applyProductSelection('ESPORTS', 'ANDROID')
  filterEnvironment.value = 'TEST'
  onFilterChange()
}

const loading = ref(false)
const list = ref<any[]>([])

const listContextText = computed(() => {
  const product = PRODUCTS.find((p) => p.id === filterProduct.value)?.label || '产品'
  const pf = platforms.find((p) => p.value === filterPlatform.value)?.label || '平台'
  const env = ENV_CHIPS.find((e) => e.value === filterEnvironment.value)?.label || '全部'
  return `${product} · ${pf} · ${env}  ${list.value.length} 条`
})

const pagedList = computed(() => {
  const all = list.value
  const size = listPageSize.value
  const maxPage = Math.max(1, Math.ceil(all.length / size) || 1)
  const page = Math.min(listPage.value, maxPage)
  const start = (page - 1) * size
  return all.slice(start, start + size)
})

watch(() => list.value.length, () => {
  const maxPage = Math.max(1, Math.ceil(list.value.length / listPageSize.value) || 1)
  if (listPage.value > maxPage) listPage.value = maxPage
})
const deviceOptions = ref<any[]>([])
/** 执行弹窗里的设备卡：含离线 / 占用，跟批量下拉（只列已连接）分开 */
const execDevices = ref<any[]>([])
const execRefreshing = ref(false)
const execVisible = ref(false)
/** 弹窗先开、内容后到时的骨架态：设备枚举走 adb/idevice_id，蒲公英列表要发网络请求 */
const execLoading = ref(false)
const execMeta = reactive({
  lastRunStatus: '' as string,
  caseCount: null as number | null
})

/**
 * 执行环境和流程登记的环境对不上——只对<b>回归流程</b>成立。
 * 自动化流程（仅自动化编排）不绑环境，它的 environment 字段不参与任何筛选，
 * 拿它来提示不一致纯属误导。
 */
const execEnvMismatch = computed(() => {
  const f = execFlow.value
  if (!f) return false
  if (f.catalog === 'AUTOMATION') return false
  return execForm.environment !== (f.environment === 'TEST' ? 'TEST' : 'PROD')
})
const executing = ref(false)
const execFlow = ref<any>(null)
/** 试跑结果弹窗：跟着执行接口返回的 taskId 走 */
const watchVisible = ref(false)
const watchTaskId = ref('')
const watchFlowName = ref('')
const watchIsDebug = ref(true)
const prodDlg = ref(false)
const prodMeta = ref({ flowName: '', deviceName: '' })
let prodResolve: ((ok: boolean) => void) | null = null

function execDeviceModel(d: any) {
  const name = String(d?.name || '').trim()
  const id = String(d?.id || '').trim()
  if (name && name !== id) return name
  return name || id || '—'
}

function askProdConfirm(meta: { flowName?: string; deviceName?: string }) {
  prodMeta.value = { flowName: meta.flowName || '—', deviceName: meta.deviceName || '—' }
  prodDlg.value = true
  return new Promise<boolean>((resolve) => {
    prodResolve = resolve
  })
}

function onProdConfirmed() {
  prodResolve?.(true)
  prodResolve = null
}

function onProdCancelled() {
  prodResolve?.(false)
  prodResolve = null
}
const execForm = reactive({
  deviceId: '',
  runNow: true,
  /** 默认关＝试跑。这个页面是编辑器，在这儿跑就是调试，别污染质量数据 */
  countInStats: false,
  /** 缺省生产：存量行为不能因为加了环境而改变 */
  environment: 'PROD',
  pgyerBuildKey: '',
  params: {} as Record<string, string>
})
/** 本条流程用到的定位变量名 */
const execVars = ref<string[]>([])
/** 蒲公英最近几个版本；仅当流程安装方式为 PGYER 时拉取 */
const pgyerBuilds = ref<any[]>([])
const pgyerLoadError = ref('')
const execInstallSummary = reactive({
  mode: '',
  apkPath: '',
  apkArtifactId: '',
  hint: ''
})
const execLaunchSummary = reactive({
  appId: '',
  appLabel: '—',
  packageName: '',
  activity: '',
  platform: ''
})
const keywords = ref<any[]>([])
const elementOptions = ref<any[]>([])
/** 页面字典，只为把元素下拉里的 pageId 显示成中文名 */
const flowPageOptions = ref<any[]>([])
const appOptions = ref<any[]>([])

const helpOpen = reactive({
  app: false,
  catalog: false,
  cases: false,
  deps: false
})

/** 关键字下拉：关键字已按平台合并，直接按 sortOrder 排即可 */
const keywordsForPicker = computed(() =>
  [...keywords.value].sort(
    (a, b) =>
      (a.sortOrder ?? 100) - (b.sortOrder ?? 100) ||
      String(a.nameZh).localeCompare(String(b.nameZh), 'zh')
  )
)

function keywordPickerLabel(k: { nameZh?: string; code?: string; category?: string }) {
  const cat = k.category === 'DEVICE' ? '设备' : k.category === 'ACTION' ? '操作' : ''
  const head = cat ? `[${cat}] ` : ''
  return `${head}${k.nameZh || k.code} (${k.code})`
}

function appLabel(id: string) {
  if (!id) return '通用'
  const hit = appOptions.value.find((a) => a.id === id)
  return hit ? hit.nameZh : id
}

// ==================== 批量执行 ====================

const batchSelection = ref<any[]>([])
const batchVisible = ref(false)
const batchDeviceIds = ref<string[]>([])
const batchOrder = ref<Array<{ id: string; label: string }>>([])
const batchAutoAdded = ref<string[]>([])
const batchOrderError = ref('')
const batchStarting = ref(false)
const batchResetFlowId = ref('')

/** 复位流程只能从同环境、非组件的流程里挑 */
const batchResetCandidates = computed(() => {
  const envs = new Set(
    batchSelection.value.map((f: any) => (f.environment === 'TEST' ? 'TEST' : 'PROD'))
  )
  return list.value.filter(
    (f: any) => !f.isComponent && envs.has(f.environment === 'TEST' ? 'TEST' : 'PROD')
  )
})

const batchAutoAddedNames = computed(() =>
  batchAutoAdded.value
    .map((id) => batchOrder.value.find((s) => s.id === id)?.label || id)
    .join('、')
)

async function openBatch() {
  batchOrder.value = []
  batchAutoAdded.value = []
  batchOrderError.value = ''
  batchDeviceIds.value = []
  batchResetFlowId.value = ''
  batchVisible.value = true
  await loadConnectedDevices()
  await refreshBatchOrder()
}

/** 顺序由后端算：环检测、补前置、插复位的规则只该有一份，前端再实现一遍必然漂 */
async function refreshBatchOrder() {
  batchOrderError.value = ''
  try {
    const res: any = await apiClient.previewRunOrder(
      batchSelection.value.map((f) => f.id),
      'AUTOMATION',
      batchResetFlowId.value || undefined
    )
    // 老后端这个接口直接返回数组；不兼容的话会得到一个没有任何解释的置灰按钮
    const steps = Array.isArray(res) ? res : res?.steps
    batchOrder.value = (steps || []).map((st: any) => ({ id: st.id, label: st.label }))
    batchAutoAdded.value = (Array.isArray(res) ? [] : res?.autoAddedIds) || []
  } catch (e: any) {
    // 依赖成环等问题在这里就报出来，不用等到开跑
    batchOrder.value = []
    batchOrderError.value = e?.message || '计算执行顺序失败'
  }
}

async function submitBatch() {
  if (!batchDeviceIds.value.length) {
    ElMessage.warning('请选择至少一台设备')
    return
  }
  const appIds = Array.from(
    new Set(batchSelection.value.map((f) => f.appId).filter(Boolean))
  ) as string[]
  if (appIds.length === 0) {
    ElMessage.warning('勾选的用例都没绑定应用，无法确定跑哪个 APP')
    return
  }
  if (appIds.length > 1) {
    ElMessage.warning('一批只能跑同一个应用，请分开执行')
    return
  }
  const envs = Array.from(
    new Set(batchSelection.value.map((f) => (f.environment === 'TEST' ? 'TEST' : 'PROD')))
  )
  if (envs.length > 1) {
    ElMessage.warning('勾选的用例横跨测试和生产环境，请分开执行')
    return
  }
  if (envs[0] === 'PROD') {
    const ok = await askProdConfirm({
      flowName:
        batchSelection.value.length === 1
          ? batchSelection.value[0].name
          : `${batchSelection.value.length} 条用例`,
      deviceName:
        batchDeviceIds.value.length === 1
          ? execDeviceModel(deviceOptions.value.find((d) => d.id === batchDeviceIds.value[0]))
          : `${batchDeviceIds.value.length} 台设备`
    })
    if (!ok) return
  }
  batchStarting.value = true
  try {
    const res = await apiClient.startOnlineRegressionRun({
      appIds,
      deviceIds: batchDeviceIds.value,
      flowIds: batchSelection.value.map((f) => f.id),
      environment: envs[0],
      track: 'AUTOMATION',
      resetFlowId: batchResetFlowId.value || undefined
    })
    batchVisible.value = false
    ElMessage.success(`已开始执行（批次 ${res.id}），可在「APP回归」页看进度与报告`)
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    batchStarting.value = false
  }
}

/** 依赖存的是 JSON 字符串，前端用数组编辑 */
function parseDependsOn(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string')
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x: any) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 能当前置的流程：同环境、非组件、不是自己。
 * 跨环境依赖跑起来必然拿错包或错账号，组件走「调用组件」而不是前置——两条都由后端再校验一次。
 */
const dependencyCandidates = computed(() =>
  list.value.filter(
    (f: any) =>
      f.id !== editingId.value &&
      !f.isComponent &&
      (f.environment === 'TEST' ? 'TEST' : 'PROD') === form.environment
  )
)

/**
 * 用途只讲「哪个入口用」，不带环境——环境是独立一列。
 * 列表里的标签要短，完整说明在编辑表单的下拉里。
 */
/**
 * 这条流程看着像不像「装包」。
 *
 * 存量流程都标着「回归+自动化」，几百条里逐条翻不现实。按步骤里有没有安装类关键字判断——
 * 只做提示不自动改：有些流程<b>就是要测安装本身</b>（安装成功验证、渠道页安装），
 * 那种留在回归里是对的，只有人能分清。
 */
function looksLikeInstallFlow(row: any): boolean {
  const raw = typeof row?.steps === 'string' ? row.steps : JSON.stringify(row?.steps || '')
  if (!raw) return false
  return /INSTALL_APP|INSTALL_FROM_STORE|UNINSTALL_APP/.test(raw)
}

function catalogLabel(c: string) {
  if (c === 'AUTOMATION') return '仅自动化'
  if (c === 'ONLINE') return '仅回归'
  if (c === 'PERFORMANCE') return '仅性能'
  if (c === 'SHARED') return '回归+自动化'
  if (c === 'INSTALL') return '装包准备'
  return c || '—'
}

function catalogLabelFull(c: string) {
  if (c === 'AUTOMATION') return '仅自动化编排'
  if (c === 'ONLINE') return '仅回归'
  if (c === 'PERFORMANCE') return '仅性能测试'
  if (c === 'SHARED') return '回归 + 自动化编排'
  if (c === 'INSTALL') return '装包准备'
  return catalogLabel(c)
}

function catalogTagType(c: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  if (c === 'AUTOMATION') return 'primary'
  if (c === 'ONLINE') return 'success'
  if (c === 'PERFORMANCE') return 'warning'
  if (c === 'SHARED') return 'info'
  return 'info'
}

function appExecLabel(a: any) {
  const pkg = a?.androidPackage || a?.iosBundleId || ''
  return pkg ? `${a.nameZh} · ${pkg}` : `${a.nameZh} (${a.id})`
}

function packageFromApp(appId: string, platform: string) {
  const a = appOptions.value.find((x) => x.id === appId)
  if (!a) return ''
  const ios = String(platform || '').toUpperCase().includes('IOS')
  return (ios ? a.iosBundleId : a.androidPackage) || a.androidPackage || a.iosBundleId || ''
}

function activityForPackage(pkg: string) {
  if (pkg === DEFAULT_LAUNCH_APP_PACKAGE) return DEFAULT_LAUNCH_APP_ACTIVITY
  return ''
}

function matchAppIdByPackage(pkg: string) {
  const p = String(pkg || '').trim()
  if (!p) return ''
  const hit = appOptions.value.find(
    (a) => a.androidPackage === p || a.iosBundleId === p
  )
  return hit?.id || ''
}


function applyLaunchPackage(step: FlowStep, appId: string, pkg: string) {
  step.params.appId = appId || ''
  step.params.packageName = pkg
  if (isIosStartStep(step.keywordCode)) {
    // iOS 用 BundleId，不写 Activity
    if (step.params.activity != null) delete step.params.activity
    return
  }
  const act = activityForPackage(pkg)
  if (act) step.params.activity = act
  else if (!step.params.activity) step.params.activity = DEFAULT_LAUNCH_APP_ACTIVITY
}

function onLaunchAppSelected(appId: string, _pkg: string, ios: boolean) {
  if (!form.appId) form.appId = appId
  if (!form.platform) form.platform = ios ? 'IOS' : 'ANDROID'
  loadElementsForFlow()
}

function onFormAppChange(appId: string) {
  if (appId) {
    for (const s of steps.value) {
      if (!isAnyLaunchStep(s.keywordCode)) continue
      const preferIos = isIosStartStep(s.keywordCode)
      const pkg = preferIos
        ? packageFromApp(appId, 'IOS') || packageFromApp(appId, form.platform)
        : packageFromApp(appId, form.platform) || packageFromApp(appId, 'ANDROID')
      if (pkg) applyLaunchPackage(s, appId, pkg)
    }
  }
  loadElementsForFlow()
}

const elementSelectPlaceholder = computed(() => {
  if (!form.appId || !form.platform) return '请先选择运行应用和平台'
  if (!elementOptions.value.length) return '暂无选用元素，请先在元素管理中标记并选用'
  return '先选页面，再选该页下的元素'
})

/** 当前下拉里列的是哪一端的元素——两端同名元素很常见，必须写出来 */
const elementScopeHint = computed(() => {
  if (!form.appId || !form.platform) return '选好运行应用和平台后才会列元素'
  const label =
    form.platform === 'IOS' ? 'iOS' : form.platform === 'HARMONYOS' ? '鸿蒙' : 'Android'
  return `只列 ${label} 元素（${elementOptions.value.length} 个）`
})

async function loadElementsForFlow() {
  if (!form.appId || !form.platform) {
    elementOptions.value = []
    flowPageOptions.value = []
    return
  }
  try {
    const list = await apiClient.getUiElements({
      appId: form.appId,
      platform: form.platform,
      catalogs: 'AUTOMATION,ONLINE,SHARED',
      status: 'ACTIVE'
    })
    elementOptions.value = Array.isArray(list) ? list : []
    // 页面字典只用来把 pageId 显示成中文名；拉不到就退回显示 pageId 本身，不影响选元素
    try {
      flowPageOptions.value = await apiClient.getUiPages({ appId: form.appId })
    } catch {
      flowPageOptions.value = []
    }
  } catch {
    elementOptions.value = []
    flowPageOptions.value = []
  }
}

/** 当前页直接弹出真机点选，不跳转元素库整页 */
const inspectVisible = ref(false)
/** 从哪个步骤点开的真机点选，保存后回填 elementKey */
const inspectTargetStep = ref<FlowStep | null>(null)

/** 从流程头或启动类步骤推断应用/平台，并回填到表单 */
function ensureFlowAppContext(): boolean {
  if (!form.appId) {
    const launch = steps.value.find((s) => isAnyLaunchStep(s.keywordCode))
    const fromStep =
      String(launch?.params?.appId || '').trim() ||
      matchAppIdByPackage(String(launch?.params?.packageName || ''))
    if (fromStep) form.appId = fromStep
  }
  if (!form.platform) {
    form.platform = 'ANDROID'
  }
  if (!form.appId) {
    ElMessage.warning('请先在上方选择「运行应用」，或在启动步骤里选好应用')
    return false
  }
  return true
}

function goDeviceInspect(step?: FlowStep) {
  if (!ensureFlowAppContext()) return
  inspectTargetStep.value = step || null
  loadElementsForFlow()
  inspectVisible.value = true
}

async function onInspectSaved(payload: { nameEn: string; nameZh?: string; promoted: boolean }) {
  await loadElementsForFlow()
  const key = String(payload?.nameEn || '').trim()
  const target = inspectTargetStep.value
  inspectTargetStep.value = null
  if (key && target) {
    target.elementKey = key
    const label = payload.nameZh ? `${payload.nameZh}（${key}）` : key
    if (payload.promoted) {
      ElMessage.success(`已填入步骤元素：${label}`)
    } else {
      ElMessage.warning(`已填入「${label}」，但仍是候选；流程执行需先在元素库「选用」`)
    }
  } else if (key) {
    ElMessage.success(payload.promoted ? `元素列表已刷新，请选择「${key}」` : '已新建候选，请选用后再选入步骤')
  }
}

function stepCount(stepsRaw: string | any[]) {
  try {
    const arr = typeof stepsRaw === 'string' ? JSON.parse(stepsRaw || '[]') : stepsRaw
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function keywordName(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  return k?.nameZh || code
}

function keywordCategory(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  return k?.category as string | undefined
}

function stepTone(code: string) {
  return stepColorByCode(code, keywordCategory(code))
}

function stepToneStyle(code: string) {
  return stepColorStyle(code, keywordCategory(code))
}

function needsElement(code: string) {
  const k = keywords.value.find((x) => x.code === code)
  if (k) return !!k.needsElement
  // 关键字库尚未刷新时的兜底
  return [
    'CLICK', 'CLICK_WHEN_ENABLED', 'INPUT', 'CLEAR', 'WAIT_ELEMENT', 'IF_ELEMENT_EXISTS',
    'ASSERT_TEXT', 'SCROLL_UNTIL', 'SCROLL_UNTIL_IOS'
  ].includes(code)
}

function elementFieldLabel(code: string) {
  if (code === 'IF_ELEMENT_EXISTS') return '判断元素'
  if (isScrollUntilStep(code)) return '目标元素'
  return '选择元素'
}

function newStepKey() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function createStep(code: string): FlowStep {
  const params: Record<string, any> = {}

  // 参数默认值来自后端 param_schema，前端不再各自维护一份
  for (const def of keywordSchema(code)) {
    if (def.type === 'steps') {
      params[def.name] = []
    } else if (def.default !== undefined && def.default !== null) {
      params[def.name] = def.default
    }
  }

  // 弹窗清理预置一项，提示用户这里要填什么
  if (code === 'DISMISS_POPUPS') {
    params.popups = [{ _key: newStepKey(), elementKey: '', label: '' }]
  }

  // 竞速等待预置两个候选骨架，省得用户一上来面对空列表
  if (code === 'WAIT_ANY') {
    params.candidates = [
      { _key: newStepKey(), elementKey: '', label: '', steps: [] },
      { _key: newStepKey(), elementKey: '', label: '', steps: [] }
    ]
  }

  // 启动类步骤额外按当前流程绑定的应用带出包名/Activity，这是 schema 表达不了的
  if (isLaunchLikeStep(code)) {
    const appId = form.appId || ''
    const ios = String(form.platform || '').toUpperCase().includes('IOS')
    let pkg = appId ? packageFromApp(appId, form.platform) : ''
    if (!pkg && appId) {
      pkg = packageFromApp(appId, ios ? 'IOS' : 'ANDROID')
    }
    const needsActivity = !ios && !String(code).toUpperCase().startsWith('HOT_START')
    if (!pkg && needsActivity) {
      pkg = DEFAULT_LAUNCH_APP_PACKAGE
    }
    params.appId = appId || matchAppIdByPackage(pkg)
    params.packageName = pkg || ''
    if (needsActivity) {
      params.activity = activityForPackage(pkg) || DEFAULT_LAUNCH_APP_ACTIVITY
    }
  }

  return { _key: newStepKey(), keywordCode: code, elementKey: '', description: '', expectation: '', params }
}

function parseStep(s: any): FlowStep {
  const params = { ...(s?.params || {}), ...(s?.text != null ? { text: s.text } : {}) }
  if (Array.isArray(params.thenSteps)) params.thenSteps = params.thenSteps.map(parseStep)
  if (Array.isArray(params.elseSteps)) params.elseSteps = params.elseSteps.map(parseStep)
  if ((s?.keywordCode || s?.action) === 'IF_ELEMENT_EXISTS') {
    if (!Array.isArray(params.thenSteps)) params.thenSteps = []
    if (!Array.isArray(params.elseSteps)) params.elseSteps = []
    if (params.timeoutSec == null) params.timeoutSec = 3
  }
  if ((s?.keywordCode || s?.action) === 'CLICK') {
    if (!params.clickMethod) params.clickMethod = 'AUTO'
    // 兼容旧值展示
    if (params.clickMethod === 'APPIUM') params.clickMethod = 'ELEMENT'
    if (params.clickMethod === 'W3C') params.clickMethod = 'COORDINATE'
    if (params.clickMethod === 'BOTH' || params.clickMethod === 'PREFER_COORD') {
      params.clickMethod = 'ELEMENT_THEN_COORD'
    }
    if (params.waitAfterMs == null) params.waitAfterMs = 0
  }
  return {
    _key: newStepKey(),
    keywordCode: s?.keywordCode || s?.action || 'CLICK',
    elementKey: s?.elementKey || s?.element || '',
    description: s?.description != null ? String(s.description) : '',
    expectation: s?.expectation != null ? String(s.expectation) : '',
    params
  }
}

function parseSteps(raw: string | any[]): FlowStep[] {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    if (!Array.isArray(arr)) return []
    return arr.map(parseStep)
  } catch {
    return []
  }
}

function serializeStep(s: FlowStep): any {
  const params: Record<string, any> = { ...(s.params || {}) }
  if (Array.isArray(params.thenSteps)) params.thenSteps = params.thenSteps.map(serializeStep)
  if (Array.isArray(params.elseSteps)) params.elseSteps = params.elseSteps.map(serializeStep)
  const out: Record<string, any> = {
    keywordCode: s.keywordCode,
    elementKey: s.elementKey || undefined,
    params
  }
  const desc = (s.description || '').trim()
  const exp = (s.expectation || '').trim()
  if (desc) out.description = desc
  if (exp) out.expectation = exp
  return out
}

async function loadList() {
  loading.value = true
  try {
    list.value = await apiClient.getUiFlows({
      appId: filterAppId.value.trim() || undefined,
      platform: filterPlatform.value || undefined,
      catalog: filterCatalog.value || undefined,
      environment: filterEnvironment.value || undefined,
      name: filterName.value.trim() || undefined,
      componentOnly: componentOnly.value || undefined
    })
    void loadLastRuns()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行 schema_ui_assets.sql）')
    list.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 补拉每条流程最近一次执行。
 * <p>不 await：结果列晚一点出来没关系，但不能让它拖住整张表——
 * 这个接口要按 id 逐个查库，流程一多就明显。查失败也只是显示「未跑」。
 * <p>正式结果里已排除试跑（run_track=DEBUG），所以你在这页调试挂几次不会让列表变成一片红；
 * 试跑单独一份跟着回来，没有正式结果时顶上，免得跑完一片空白。
 */
async function loadLastRuns() {
  const ids = list.value.map((f: any) => f?.id).filter(Boolean)
  if (!ids.length) return
  try {
    const map = await apiClient.getUiFlowLastRuns(ids)
    for (const row of list.value as any[]) {
      const hit = map?.[row.id]
      row.lastRunStatus = hit?.lastRunStatus || ''
      row.lastRunTaskId = hit?.lastRunTaskId || ''
      row.lastDebugStatus = hit?.lastDebugStatus || ''
      row.lastDebugTaskId = hit?.lastDebugTaskId || ''
    }
  } catch {
    /* 查不到就保持「未跑」，别挡整张表 */
  }
}

// 试跑弹窗关掉时补拉一次：这次跑的结果得落到列表上，
// 否则关掉弹窗又回到「什么都看不见」的状态
watch(watchVisible, (v) => {
  if (!v) void loadLastRuns()
})

function runLabel(status?: string | null) {
  const u = String(status || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return '通过'
  if (u === 'FAILED') return '失败'
  if (u === 'RUNNING') return '执行中'
  if (u === 'STOPPED') return '已停止'
  if (u === 'PENDING') return '排队'
  return status || '未跑'
}

function runTagType(status?: string | null): 'success' | 'danger' | 'warning' | 'info' {
  const u = String(status || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return 'success'
  if (u === 'FAILED') return 'danger'
  if (u === 'RUNNING' || u === 'PENDING') return 'warning'
  return 'info'
}

/** 点「失败」直接进任务详情。看到红色却不知道去哪看，是这条链路上最没必要的一道摩擦 */
function openLastRun(row: any) {
  const taskId = String(row?.lastRunTaskId || '').trim()
  if (!taskId) return
  void router.push({ name: 'TaskOverview', params: { id: taskId } })
}

/** 试跑结果就地弹，不跳走：调试的时候人还在编辑器里，跳出去等于打断 */
function openDebugRun(row: any) {
  const taskId = String(row?.lastDebugTaskId || '').trim()
  if (!taskId) return
  watchTaskId.value = taskId
  watchFlowName.value = String(row?.name || '')
  watchIsDebug.value = true
  watchVisible.value = true
}

async function loadMeta() {
  try {
    appOptions.value = await apiClient.getUiApps({ enabledOnly: true })
  } catch {
    appOptions.value = []
  }
  try {
    keywords.value = await apiClient.getUiKeywords({ enabledOnly: true })
  } catch {
    keywords.value = []
  }
  // 后端未种子时本地兜底，便于调试立刻用上
  const fallbacks: Array<{ code: string; nameZh: string; needsElement?: boolean; category?: string }> = [
    { code: 'SWIPE', nameZh: '滑动 · Android' },
    { code: 'SWIPE_IOS', nameZh: '滑动 · iOS' },
    { code: 'SCROLL_UNTIL', nameZh: '滑动直到元素 · Android', needsElement: true },
    { code: 'SCROLL_UNTIL_IOS', nameZh: '滑动直到元素 · iOS', needsElement: true },
    { code: 'GO_HOME', nameZh: '回主屏幕', category: 'DEVICE' }
  ]
  for (const fb of fallbacks) {
    if (!keywords.value.some((k) => k.code === fb.code)) {
      keywords.value.push({
        code: fb.code,
        nameZh: fb.nameZh,
        needsElement: !!fb.needsElement,
        enabled: true,
        category: fb.category || 'ACTION',
        sortOrder: fb.code === 'GO_HOME' ? 71 : 100
      })
    }
  }
  await loadElementsForFlow()
}

const drawerVisible = ref(false)
const editingId = ref('')
const saving = ref(false)
const formRef = ref<FormInstance>()
const addKeywordCode = ref('CLICK')
const steps = ref<FlowStep[]>([])
const flowChartVisible = ref(false)
const route = useRoute()
const router = useRouter()
/** 从外链跳入编辑时高亮列表行 */
const highlightFlowId = ref('')
let openingFromQuery = false

function closeDrawer() {
  drawerVisible.value = false
}

function onDrawerClosed() {
  // destroy-on-close 后清理，避免残留状态影响下次打开
  selectedStep.value = null
  insertAfterId.value = ''
  saving.value = false
  flowChartVisible.value = false
  helpOpen.app = false
  helpOpen.catalog = false
  helpOpen.cases = false
  helpOpen.deps = false
  highlightFlowId.value = ''
  try {
    sessionStorage.removeItem('ui-flows-pending-edit')
  } catch {
    /* ignore */
  }
  // 关抽屉后再清 URL；若在打开时清 ?edit=，MainLayout 的 key=fullPath 会重挂载，抽屉当场被拆掉
  if (route.query.edit || route.query.name || route.query._t) {
    const q = { ...route.query }
    delete q.edit
    delete q.name
    delete q._t
    void router.replace({ path: '/ui-flows', query: q })
  }
}

function openFlowChart() {
  if (!steps.value.length) {
    ElMessage.warning('请先添加步骤，再查看流程图')
    return
  }
  flowChartVisible.value = true
}
const form = reactive({
  name: '',
  description: '',
  appId: '',
  platform: '',
  catalog: 'SHARED',
  releaseStage: 'TESTING' as 'TESTING' | 'ONLINE',
  // 存量流程默认绑定环境，新建的也默认绑——装包类是多数，关错了会在生产装 debug 包
  envBound: true,
  caseIds: [] as number[],
  environment: 'PROD',
  /** 装包类默认 true；纯功能验证可关，跨环境出现在回归列表 */
  envBound: true,
  dependsOn: [] as string[],
  isComponent: false,
  enabled: true,
  sortOrder: 100
})
/**
 * 只有「仅自动化编排」的流程才谈覆盖用例。
 * 回归是独立的一套——「回归 + 自动化编排」也进回归批次，属于回归那边，不关联用例。
 */
/**
 * 这条流程会出现在哪几轮回归——四个开关的推导结果，实时显示。
 * 场景不是第五个字段，是算出来的；但没有反馈的话人只能靠试。
 */
const flowScenes = computed(() =>
  scenesForFlow({
    catalog: form.catalog,
    environment: form.environment,
    envBound: form.envBound,
    releaseStage: form.releaseStage
  })
)

const configSummaryChips = computed(() => {
  const platform =
    form.platform === 'IOS' ? 'iOS'
      : form.platform === 'HARMONYOS' ? 'HarmonyOS'
        : form.platform === 'ANDROID' ? 'Android'
          : '通用'
  return [
    { text: appLabel(form.appId), type: 'info' as const },
    { text: platform, type: 'info' as const },
    { text: catalogLabelFull(form.catalog), type: 'info' as const },
    {
      text: form.releaseStage === 'ONLINE' ? '已上线' : '本版新功能',
      type: (form.releaseStage === 'ONLINE' ? 'warning' : 'info') as 'warning' | 'info'
    },
    {
      text: form.enabled ? '启用' : '禁用',
      type: (form.enabled ? 'success' : 'info') as 'success' | 'info'
    }
  ]
})

const appearFallback = computed(() => {
  if (form.catalog === 'AUTOMATION') {
    return { tag: '流程编排', text: '不进任何回归（因「仅自动化编排」）' }
  }
  if (form.catalog === 'PERFORMANCE') {
    return { tag: '性能测试', text: '不进任何回归（因「仅性能测试」）' }
  }
  if (form.catalog === 'INSTALL') {
    return { tag: '装包准备', text: '不进回归勾选列表（装包不是用例）' }
  }
  return { tag: '未进回归', text: '把用途改成含回归的选项才会进回归批次' }
})

/**
 * 能不能关联用例——看这条流程<b>做没做那件事</b>，不看它出现在哪个入口。
 * 排除的只有装包准备（不执行用例步骤）和仅性能测试（采资源曲线、不验功能）。
 */
const linksCases = computed(
  () => form.catalog !== 'INSTALL' && form.catalog !== 'PERFORMANCE'
)

const caseSelectPlaceholder = computed(() => {
  if (!linksCases.value) return '装包准备 / 性能测试不能挂用例'
  if (!editingId.value) return '先保存流程，再回来勾选覆盖用例'
  return '点击选择覆盖的人工用例'
})
const linkableCases = ref<any[]>([])
const loadingCases = ref(false)

/**
 * 拉候选用例并回填已勾选的。
 * 平台跟着流程走——安卓流程只列安卓用例，两端用例是分开的两套。
 */
async function loadLinkableCases() {
  if (!editingId.value || !linksCases.value) {
    linkableCases.value = []
    return
  }
  loadingCases.value = true
  try {
    const [candidates, linked] = await Promise.all([
      apiClient.getFlowLinkableCases(editingId.value, { platform: form.platform || undefined }),
      apiClient.getFlowCases(editingId.value)
    ])
    linkableCases.value = candidates
    form.caseIds = linked.map((c: any) => c.id)
  } catch {
    // 用例关联是可选的，拉不到不该挡住流程编辑
    linkableCases.value = []
  } finally {
    loadingCases.value = false
  }
}

const rules: FormRules = {
  name: [{ required: true, message: '必填', trigger: 'blur' }]
}

function annotate(step: FlowStep, description: string, expectation = ''): FlowStep {
  step.description = description
  step.expectation = expectation
  return step
}

/** 验证码登录骨架：首页可走侧栏；已在登录页则直接填号；勿在「暂无手机号框」时直接 RETURN */
function buildSmsLoginSkeleton(): FlowStep[] {
  const launch = annotate(createStep('LAUNCH_APP'), '启动应用', '进入首页或协议弹窗')

  const clickAgree = annotate(createStep('CLICK'), '点击「同意」', '关闭温馨提示')
  clickAgree.elementKey = 'el_8e83'
  clickAgree.params.waitAfterMs = 1000

  const ifAgree = annotate(createStep('IF_ELEMENT_EXISTS'), '若出现温馨提示「同意」', '无弹窗则跳过')
  ifAgree.elementKey = 'el_8e83'
  ifAgree.params.timeoutSec = 3
  ifAgree.params.thenSteps = [clickAgree]
  ifAgree.params.elseSteps = []

  const inputPhoneDirect = annotate(
    createStep('INPUT'),
    '已在登录页：填写手机号（请改成真实号码）',
    '手机号填入成功'
  )
  inputPhoneDirect.elementKey = 'login_phone_input'
  inputPhoneDirect.params.text = '请替换手机号'

  const clickSide = annotate(createStep('CLICK'), '点击侧栏入口', '侧栏打开')
  clickSide.elementKey = 'side_view'
  clickSide.params.clickMethod = 'ELEMENT'
  clickSide.params.waitAfterMs = 1500

  const ifSide = annotate(createStep('IF_ELEMENT_EXISTS'), '查找侧栏入口 side_view', '能点开侧栏')
  ifSide.elementKey = 'side_view'
  ifSide.params.timeoutSec = 5
  ifSide.params.thenSteps = [clickSide]
  ifSide.params.elseSteps = [
    annotate(createStep('RETURN_MESSAGE'), '侧栏入口不存在，结束流程')
  ]
  ifSide.params.elseSteps[0].params.message = '侧边栏入口按钮不存在'

  const clickLoginEntry = annotate(createStep('CLICK'), '点击「点击登录」', '进入登录页')
  clickLoginEntry.elementKey = 'el_201c'
  clickLoginEntry.params.clickMethod = 'AUTO'
  clickLoginEntry.params.waitAfterMs = 1500

  const ifLoginEntry = annotate(createStep('IF_ELEMENT_EXISTS'), '查找侧栏「点击登录」', '进入登录页')
  ifLoginEntry.elementKey = 'el_201c'
  ifLoginEntry.params.timeoutSec = 5
  ifLoginEntry.params.thenSteps = [clickLoginEntry]
  ifLoginEntry.params.elseSteps = [
    annotate(createStep('RETURN_MESSAGE'), '登录入口不存在，结束流程')
  ]
  ifLoginEntry.params.elseSteps[0].params.message = '侧边栏点击登录元素没有出现'

  const waitPhone = annotate(
    createStep('WAIT_ELEMENT'),
    '等待手机号输入框出现（勿因暂无输入框直接 RETURN）',
    '登录页就绪'
  )
  waitPhone.elementKey = 'login_phone_input'
  waitPhone.params.timeoutSec = 10

  const inputPhoneAfterNav = annotate(
    createStep('INPUT'),
    '填写手机号（请改成真实号码）',
    '手机号填入成功'
  )
  inputPhoneAfterNav.elementKey = 'login_phone_input'
  inputPhoneAfterNav.params.text = '请替换手机号'

  const ifPhone = annotate(
    createStep('IF_ELEMENT_EXISTS'),
    '是否已在登录页（有手机号框）',
    '有则直接填号；无则走侧栏登录'
  )
  ifPhone.elementKey = 'login_phone_input'
  ifPhone.params.timeoutSec = 3
  ifPhone.params.thenSteps = [inputPhoneDirect]
  ifPhone.params.elseSteps = [ifSide, ifLoginEntry, waitPhone, inputPhoneAfterNav]

  const clickPolicy = annotate(createStep('CLICK'), '勾选用户协议', '协议已勾选')
  clickPolicy.elementKey = 'login_policy_checkbox'
  clickPolicy.params.clickMethod = 'ELEMENT'
  clickPolicy.params.waitAfterMs = 500
  clickPolicy.params.assertChecked = true

  const ifPolicy = annotate(createStep('IF_ELEMENT_EXISTS'), '查找协议勾选框', '可勾选协议')
  ifPolicy.elementKey = 'login_policy_checkbox'
  ifPolicy.params.timeoutSec = 5
  ifPolicy.params.thenSteps = [clickPolicy]
  ifPolicy.params.elseSteps = [
    annotate(createStep('RETURN_MESSAGE'), '协议勾选不存在，结束')
  ]
  ifPolicy.params.elseSteps[0].params.message = '异常，「我已同意协议」不存在'

  const clickSend = annotate(createStep('CLICK'), '点击发送验证码', '验证码已发送')
  clickSend.elementKey = 'login_send_code_btn'
  clickSend.params.waitAfterMs = 10000

  const ifSend = annotate(createStep('IF_ELEMENT_EXISTS'), '查找发送验证码按钮', '可发送验证码')
  ifSend.elementKey = 'login_send_code_btn'
  ifSend.params.timeoutSec = 5
  ifSend.params.thenSteps = [clickSend]
  ifSend.params.elseSteps = [
    annotate(createStep('RETURN_MESSAGE'), '发送验证码按钮不存在，结束')
  ]
  ifSend.params.elseSteps[0].params.message = '发送验证码按钮不存在，结束'

  const inputCode = annotate(
    createStep('INPUT'),
    '填写验证码（请改成真实验证码）',
    '验证码填入成功'
  )
  inputCode.elementKey = 'login_code_input'
  inputCode.params.text = '请替换验证码'

  const ifCode = annotate(createStep('IF_ELEMENT_EXISTS'), '查找验证码输入框', '可输入验证码')
  ifCode.elementKey = 'login_code_input'
  ifCode.params.timeoutSec = 8
  ifCode.params.thenSteps = [inputCode]
  ifCode.params.elseSteps = [
    annotate(createStep('RETURN_MESSAGE'), '验证码输入框不存在，结束')
  ]
  ifCode.params.elseSteps[0].params.message = '验证码输入框不存在'

  const okMsg = annotate(createStep('RETURN_MESSAGE'), '登录成功')
  okMsg.params.message = '成功登录'
  const failMsg = annotate(createStep('RETURN_MESSAGE'), '未看到资讯 Tab，登录可能失败')
  failMsg.params.message = '登录失败'

  const ifNews = annotate(
    createStep('IF_ELEMENT_EXISTS'),
    '断言首页「资讯」Tab（文档期望，非 ASSERT 关键字）',
    '已登录进入首页'
  )
  ifNews.elementKey = 'cs_news_tab_news'
  ifNews.params.timeoutSec = 15
  ifNews.params.thenSteps = [okMsg]
  ifNews.params.elseSteps = [failMsg]

  return [launch, ifAgree, ifPhone, ifPolicy, ifSend, ifCode, ifNews]
}

async function onInsertTemplate(cmd: string) {
  if (cmd !== 'sms_login_skeleton') return
  const built = buildSmsLoginSkeleton()
  if (steps.value.length > 0) {
    try {
      await ElMessageBox.confirm(
        '当前已有步骤。追加到末尾，还是替换全部？',
        '插入模板',
        {
          distinguishCancelAndClose: true,
          confirmButtonText: '追加到末尾',
          cancelButtonText: '替换全部',
          type: 'info'
        }
      )
      steps.value.push(...built)
    } catch (action) {
      if (action === 'cancel') {
        steps.value = built
      } else {
        return
      }
    }
  } else {
    steps.value = built
  }
  // 模板是整段骨架，追加/替换都会让「插到第 N 步之后」跟原来那条对不上
  insertAfterId.value = ''
  selectedStep.value = steps.value[0] || null
  if (selectedStep.value) insertAfterId.value = pointIdOfStep(selectedStep.value)
  resetOutlineExpand()
  ElMessage.success('已插入「验证码登录骨架」，请改手机号/验证码后保存')
}

async function openAdd() {
  editingId.value = ''
  Object.assign(form, {
    name: '',
    description: '',
    appId: filterAppId.value || '',
    platform: filterPlatform.value || '',
    catalog: filterCatalog.value || 'SHARED',
    // 新建时沿用当前筛选的环境，连着建同一批用例时不用每条都改
    environment: filterEnvironment.value || 'PROD',
    envBound: true,
    dependsOn: [],
    isComponent: false,
    enabled: true,
    sortOrder: 100
  })
  steps.value = []
  insertAfterId.value = ''
  selectedStep.value = null
  resetOutlineExpand()
  // 关键字目录会随后端重启新增（如 GO_HOME）；抽屉打开时再拉一次，避免整页不刷新就看不到
  await loadMeta()
  addKeywordCode.value =
    keywords.value.find((k) => k.code === 'IF_ELEMENT_EXISTS')?.code ||
    keywords.value.find((k) => k.code === 'LAUNCH_APP')?.code ||
    keywords.value[0]?.code ||
    'CLICK'
  drawerVisible.value = true
}

async function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name || '',
    description: row.description || '',
    appId: row.appId || '',
    platform: row.platform || '',
    catalog: row.catalog || 'SHARED',
    releaseStage: row.releaseStage === 'TESTING' ? 'TESTING' : 'ONLINE',
    envBound: row.envBound !== false,
    environment: row.environment === 'TEST' ? 'TEST' : 'PROD',
    // 缺省按绑处理，跟库默认 1、存量行为一致
    envBound: row.envBound !== false && row.envBound !== 0,
    dependsOn: parseDependsOn(row.dependsOn),
    isComponent: !!row.isComponent,
    enabled: row.enabled !== false,
    sortOrder: row.sortOrder ?? 100,
    caseIds: []
  })
  await loadMeta()
  loadLinkableCases()
  steps.value = parseSteps(row.steps)
  insertAfterId.value = ''
  selectedStep.value = steps.value[0] || null
  if (selectedStep.value) insertAfterId.value = pointIdOfStep(selectedStep.value)
  resetOutlineExpand()
  // 旧流程可能只在启动类步骤里有包名，回填运行应用/平台
  if (!form.appId) {
    const launch = steps.value.find((s) => isAnyLaunchStep(s.keywordCode))
    form.appId =
      String(launch?.params?.appId || '').trim() ||
      matchAppIdByPackage(String(launch?.params?.packageName || '')) ||
      ''
  }
  if (!form.platform && form.appId) form.platform = 'ANDROID'
  drawerVisible.value = true
}

/**
 * 插入锚点：insertPoints 里那一项的 id。空字符串＝追加到当前容器末尾。
 * 必须用 id，不能用步骤对象或摊平下标——对象会被重新 parse，下标会把「第 4 步」对到别的节点。
 */
const insertAfterId = ref('')
/** 右侧只编当前选中的一步；点大纲同步选中并作为插入锚点 */
const selectedStep = ref<any | null>(null)

function pointIdOfStep(step: any | null) {
  if (!step) return ''
  const pts = insertPoints.value
  const hit = pts.find((p) => p.step === step)
    || pts.find((p) => p.step?._key && step._key && p.step._key === step._key)
  return hit?.id || ''
}

function selectStep(step: any | null) {
  selectedStep.value = step
  insertAfterId.value = pointIdOfStep(step)
  if (!step) return
  expandOutlineAncestors(step)
  if (outlineHasChildren(step)) expandOutlineStep(step)
}

function findParentStep(container: (string | number)[]): any | null {
  let cur: any = steps.value
  let lastStep: any = null
  for (const key of container) {
    cur = cur?.[key as any]
    if (cur && typeof cur === 'object' && cur.keywordCode) lastStep = cur
  }
  return lastStep
}

function canMoveSelected(delta: number) {
  const p = selectedPoint.value
  if (!p) return false
  const arr = resolveContainer(p.container)
  if (!arr) return false
  const to = p.index + delta
  return to >= 0 && to < arr.length
}

function moveSelected(delta: number) {
  const p = selectedPoint.value
  if (!p || !canMoveSelected(delta)) return
  const arr = resolveContainer(p.container)
  if (!arr) return
  const [item] = arr.splice(p.index, 1)
  arr.splice(p.index + delta, 0, item)
}

function removeSelected() {
  const p = selectedPoint.value
  if (!p) return
  const arr = resolveContainer(p.container)
  if (!arr) return
  const removed = arr[p.index]
  arr.splice(p.index, 1)
  if (insertAfterId.value && !insertPoints.value.some((x) => x.id === insertAfterId.value)) {
    insertAfterId.value = ''
  }
  if (selectedStep.value === removed) {
    selectedStep.value = arr[Math.min(p.index, arr.length - 1)] || findParentStep(p.container)
    insertAfterId.value = pointIdOfStep(selectedStep.value)
  }
}

/** 一个可插入位置：某个步骤，以及它所在的容器（顶层数组，或某个分支的子步骤数组） */
interface InsertPoint {
  id: string
  step: any
  /** 大纲号，跟步骤卡片上显示的编号一致 */
  no: string
  /** 分支名；then/else 两支编号相同，只能靠这个区分 */
  branch: string
  /** 缩进层级 */
  depth: number
  /** 从 steps 根出发到容器数组的取值路径 */
  container: (string | number)[]
  index: number
}

/**
 * 把整棵步骤树摊平成可插入位置，含分支里的子步骤。
 * 编号规则照抄各分支编辑器，保证下拉里的号跟屏幕上看到的一致。
 */
const insertPoints = computed<InsertPoint[]>(() => {
  const out: InsertPoint[] = []
  walkSteps(steps.value, [], (i) => String(i + 1), '', 0, out)
  return out
})

const selectedPoint = computed(() =>
  insertPoints.value.find((p) => p.step === selectedStep.value) || null
)

/** 大纲默认只露顶层大步骤；点开判断/等待任意再看子步骤 */
const outlineExpanded = ref(new Set<any>())
const outlineRootCount = computed(() => insertPoints.value.filter((p) => !p.depth).length)
const visibleOutlinePoints = computed(() => {
  const expanded = outlineExpanded.value
  return insertPoints.value.filter((p) =>
    ancestorBranchStepsOf(p).every((st) => expanded.has(st))
  )
})

function resetOutlineExpand() {
  outlineExpanded.value = new Set()
}

function isBranchKeyword(code: string) {
  return code === 'IF_ELEMENT_EXISTS' || code === 'WAIT_ANY'
}

function outlineChildCount(step: any): number {
  const prm = step?.params || {}
  if (step?.keywordCode === 'IF_ELEMENT_EXISTS') {
    return (prm.thenSteps?.length || 0) + (prm.elseSteps?.length || 0)
  }
  if (step?.keywordCode === 'WAIT_ANY') {
    const cands = Array.isArray(prm.candidates) ? prm.candidates : []
    const n = cands.reduce((sum: number, c: any) => sum + (c?.steps?.length || 0), 0)
    return n + (prm.noneSteps?.length || 0)
  }
  return 0
}

function outlineHasChildren(step: any) {
  return outlineChildCount(step) > 0
}

function ancestorBranchStepsOf(p: InsertPoint): any[] {
  const ancestors: any[] = []
  let cur: any = steps.value
  for (const key of p.container) {
    cur = cur?.[key as any]
    if (cur && typeof cur === 'object' && isBranchKeyword(cur.keywordCode)) {
      ancestors.push(cur)
    }
  }
  return ancestors
}

function expandOutlineStep(step: any) {
  if (!step || outlineExpanded.value.has(step)) return
  const next = new Set(outlineExpanded.value)
  next.add(step)
  outlineExpanded.value = next
}

function expandOutlineAncestors(step: any) {
  const p = insertPoints.value.find((x) => x.step === step)
  if (!p) return
  const next = new Set(outlineExpanded.value)
  let changed = false
  for (const a of ancestorBranchStepsOf(p)) {
    if (!next.has(a)) {
      next.add(a)
      changed = true
    }
  }
  if (changed) outlineExpanded.value = next
}

function toggleOutlineExpand(step: any, ev?: Event) {
  ev?.stopPropagation()
  ev?.preventDefault()
  const next = new Set(outlineExpanded.value)
  if (next.has(step)) next.delete(step)
  else next.add(step)
  outlineExpanded.value = next
}

watch(insertPoints, (pts) => {
  if (!selectedStep.value) return
  if (!pts.some((p) => p.step === selectedStep.value)) {
    selectedStep.value = pts[0]?.step ?? null
    insertAfterId.value = pointIdOfStep(selectedStep.value)
  }
})

function walkSteps(
  list: any,
  container: (string | number)[],
  noOf: (i: number) => string,
  branch: string,
  depth: number,
  out: InsertPoint[]
) {
  if (!Array.isArray(list) || depth > 6) return
  list.forEach((st: any, i: number) => {
    const no = noOf(i)
    out.push({
      id: [container.join('/'), i, branch, no, st?._key || ''].join('#'),
      step: st,
      no,
      branch,
      depth,
      container,
      index: i
    })
    const prm = st?.params || {}
    if (st?.keywordCode === 'IF_ELEMENT_EXISTS') {
      walkSteps(prm.thenSteps, [...container, i, 'params', 'thenSteps'],
        (j) => no + '.' + (j + 1), '存在时', depth + 1, out)
      walkSteps(prm.elseSteps, [...container, i, 'params', 'elseSteps'],
        (j) => no + '.' + (j + 1), '不存在时', depth + 1, out)
    } else if (st?.keywordCode === 'WAIT_ANY') {
      const cands = Array.isArray(prm.candidates) ? prm.candidates : []
      cands.forEach((cand: any, ci: number) => {
        walkSteps(cand?.steps, [...container, i, 'params', 'candidates', ci, 'steps'],
          (j) => no + '.c' + (ci + 1) + '.' + (j + 1), '候选 ' + (ci + 1), depth + 1, out)
      })
      walkSteps(prm.noneSteps, [...container, i, 'params', 'noneSteps'],
        (j) => no + '.n' + (j + 1), '都没出现', depth + 1, out)
    }
  })
}

/** 每次插入都现场解析容器：分支编辑器的上移下移会整个替换数组，缓存引用会指向旧的 */
function resolveContainer(path: (string | number)[]): any[] | null {
  let cur: any = steps.value
  for (const k of path) {
    if (cur == null) return null
    cur = cur[k as any]
  }
  return Array.isArray(cur) ? cur : null
}

/** el-select 用稳定 id；空字符串＝追加到末尾。不要用摊平下标，第 4 步的下标不是 4。 */
const insertSelId = computed<string>({
  get() {
    return insertAfterId.value
  },
  set(v) {
    insertAfterId.value = v == null ? '' : String(v)
  }
})

function insertPointLabel(p: InsertPoint) {
  return p.branch ? p.no + '（' + p.branch + '）' : p.no
}

const insertQuery = ref('')

function onInsertVisible(open: boolean) {
  if (!open) insertQuery.value = ''
}

const filteredInsertPoints = computed(() => {
  const q = insertQuery.value.trim().toLowerCase()
  if (!q) return insertPoints.value
  return insertPoints.value.filter((p) => {
    const name = keywordName(p.step.keywordCode)
    const desc = String(p.step.description || '')
    return [p.no, name, desc, p.branch, p.step.keywordCode].some((s) =>
      String(s).toLowerCase().includes(q)
    )
  })
})

const insertAppendVisible = computed(() => {
  const q = insertQuery.value.trim().toLowerCase()
  if (!q) return true
  return '追加到末尾默认'.includes(q)
})

function insertAfterClosedLabel(p: InsertPoint) {
  return `插到「${p.no} ${keywordName(p.step.keywordCode)}」之后`
}

function insertBadgeStyle(code: string) {
  if (code === 'IF_ELEMENT_EXISTS' || code === 'WAIT_ANY') {
    return { background: '#fff7ed', color: '#d97706', border: '1px solid #fbbf24' }
  }
  const t = stepTone(code)
  return { background: t.color, color: '#fff', border: '1px solid ' + t.color }
}

function insertMetaTag(code: string) {
  if (code === 'IF_ELEMENT_EXISTS' || code === 'WAIT_ANY') return { text: 'IF', tone: 'if' }
  if (code === 'FINISH_SUCCESS' || code === 'FINISH_FAILED' || code === 'FINISH_SKIPPED' || code === 'RETURN_MESSAGE') {
    return { text: 'END', tone: 'end' }
  }
  const t = stepTone(code)
  return { text: t.categoryLabel, tone: t.category.toLowerCase() }
}

function branchRailClass(branch: string) {
  if (branch === '存在时') return 'rail-then'
  if (branch === '不存在时') return 'rail-else'
  if (String(branch).startsWith('候选')) return 'rail-cand'
  if (branch === '都没出现') return 'rail-none'
  return ''
}

function setInsertAfter(step: any) {
  insertAfterId.value = pointIdOfStep(step)
  const p = insertPoints.value.find((x) => x.id === insertAfterId.value)
  ElMessage.info(p ? '下一个新步骤会插到 ' + insertPointLabel(p) + ' 之后' : '已设为插入位置')
}

/** 下拉右侧完整说明（hover title 用） */
function stepFullLabel(st: any) {
  const desc = String(st?.description || '').trim()
  if (desc) return desc
  return keywordName(st?.keywordCode) || st?.keywordCode || ''
}

/** 下拉右侧短文案：只露前几个字，过长省略；全文靠 title hover */
function stepBriefLabel(st: any) {
  const full = stepFullLabel(st)
  if (!full) return ''
  return full.length > 6 ? full.slice(0, 6) + '…' : full
}

function insertedStepNo(step: any) {
  return insertPoints.value.find((p) => p.step === step)?.no || ''
}

function resolveInsertPoint() {
  const id = insertAfterId.value
  if (!id) return null
  const pts = insertPoints.value
  const exact = pts.find((p) => p.id === id)
  if (exact) return exact
  const parts = id.split('#')
  const no = parts[3]
  const branch = parts[2] || ''
  if (no) {
    return pts.find((p) => p.no === no && p.branch === branch) || pts.find((p) => p.no === no && !p.depth) || null
  }
  return null
}

function insertStep(step: any) {
  const point = resolveInsertPoint()
  if (!point) {
    if (insertAfterId.value) {
      ElMessage.error('插入位置已失效，请重新选择「插到第几步之后」')
      return
    }
    steps.value.push(step)
    selectStep(step)
    const no = insertedStepNo(step)
    ElMessage.success(no ? `已追加为第 ${no} 步` : '已追加到末尾')
    return
  }
  const arr = resolveContainer(point.container)
  if (!arr) {
    ElMessage.error('插入位置已失效，请重新选择「插到第几步之后」')
    return
  }
  arr.splice(point.index + 1, 0, step)
  selectStep(step)
  const no = insertedStepNo(step)
  ElMessage.success(
    point.branch
      ? `已插到 ${point.no} 之后，当前是 ${no}（${point.branch}）`
      : `已插到第 ${point.no} 步后面，现在是第 ${no} 步`
  )
}

function removeStep(idx: number) {
  const removed = steps.value[idx]
  steps.value.splice(idx, 1)
  if (insertAfterId.value && !insertPoints.value.some((x) => x.id === insertAfterId.value)) {
    insertAfterId.value = ''
  }
  if (selectedStep.value === removed) {
    selectedStep.value = steps.value[Math.min(idx, steps.value.length - 1)] || null
    insertAfterId.value = pointIdOfStep(selectedStep.value)
  }
}

function addStep() {
  const code = addKeywordCode.value
  if (!code) {
    ElMessage.warning('请先选择关键字')
    return
  }
  insertStep(createStep(code))
}

function moveStep(idx: number, delta: number) {
  // 锚点存的是步骤对象，移动后「插到这一步之后」仍指同一步，不用作废
  const to = idx + delta
  if (to < 0 || to >= steps.value.length) return
  const next = steps.value.slice()
  const [item] = next.splice(idx, 1)
  next.splice(to, 0, item)
  steps.value = next
}

async function submit() {
  await formRef.value?.validate().catch(() => Promise.reject())
  for (const s of steps.value) {
    if (s.keywordCode === 'IF_ELEMENT_EXISTS' && !s.elementKey?.trim()) {
      ElMessage.warning('「元素存在判断」必须选择要判断的元素')
      return
    }
  }
  const launchErr = findLaunchAppConfigError(steps.value)
  if (launchErr) {
    ElMessage.warning(launchErr)
    return
  }
  const installErr = findInstallConfigError(steps.value)
  if (installErr) {
    ElMessage.warning(installErr)
    return
  }
  saving.value = true
  try {
    const { caseIds, ...rest } = form
    const body = {
      ...rest,
      platform: form.platform || null,
      appId: form.appId || null,
      // 后端存的是 JSON 字符串；空数组也要写成 "[]" 而不是 null，否则清空依赖保存不掉
      dependsOn: JSON.stringify(form.dependsOn || []),
      steps: JSON.stringify(steps.value.map(serializeStep))
    }
    if (editingId.value) {
      await apiClient.updateUiFlow(editingId.value, body)
      // 关联写在用例的 flowId 上，跟流程本身是两次写——流程存成功了、关联失败，
      // 也要让人知道是哪一半失败的，别笼统报「保存失败」让人以为流程没存上
      if (linksCases.value) {
        try {
          await apiClient.setFlowCases(editingId.value, caseIds || [])
        } catch (e: any) {
          ElMessage.warning('流程已保存，但用例关联失败：' + (e?.message || ''))
        }
      }
      ElMessage.success('已更新')
    } else {
      const created = await apiClient.createUiFlow(body)
      editingId.value = created?.id || ''
      if (created?.id) highlightFlowId.value = created.id
      ElMessage.success('已创建，可继续改')
      if (linksCases.value && editingId.value) {
        try {
          await apiClient.setFlowCases(editingId.value, caseIds || [])
        } catch (e: any) {
          ElMessage.warning('流程已保存，但用例关联失败：' + (e?.message || ''))
        }
        loadLinkableCases()
      }
    }
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/**
 * Android 启动/冷启动：手填了包名就该同时填 Activity，否则只能退回 monkey 拉起。
 * iOS 用 BundleId + WDA forceAppLaunch，不需要 Activity——按流程平台判断，不能按关键字名。
 */
/**
 * 拦住填成蒲公英「应用页面链接」的下载 URL。
 *
 * 那种链接（pgyer.com/xxx）打开是一张带二维码和 Install 按钮的网页，直接下载只会得到
 * 几十 KB 的 HTML。存成 .apk 交给 adb 之后只会回一句含糊的安装失败——实测连着踩了三次，
 * 每次都要下载完、装一遍、再看报错才知道。在保存时就挡住，比事后报错省得多。
 */
/** 高级区展开状态按步骤记；已经填了值的默认展开，免得存量脏值被藏起来 */
const installAdvancedOpen = reactive<Record<string, boolean>>({})

function stepKey(step: any) {
  return String(step?.__uid || step?.keywordCode || '') + '#' + steps.value.indexOf(step)
}

function showInstallAdvanced(step: any) {
  const k = stepKey(step)
  if (installAdvancedOpen[k] !== undefined) {
    return installAdvancedOpen[k]
  }
  return !!(String(step?.params?.pgyerBuildKey || '').trim()
    || String(step?.params?.pgyerUrl || '').trim())
}

function toggleInstallAdvanced(step: any) {
  const k = stepKey(step)
  installAdvancedOpen[k] = !showInstallAdvanced(step)
}

/** 该步骤所属应用在字典里配没配蒲公英 appKey */
function pgyerReady(step: any) {
  const appId = String(step?.params?.appId || form.appId || '').trim()
  if (!appId) return false
  const app = appOptions.value.find((a: any) => a.id === appId)
  return !!(app?.pgyerAppKeyAndroid || app?.pgyerAppKeyIos)
}

function findInstallConfigError(list: FlowStep[]): string | null {
  for (const s of list) {
    if (String(s.keywordCode || '').toUpperCase() === 'INSTALL_APP') {
      const url = String(s.params?.pgyerUrl || '').trim()
      if (url && /pgyer\.com\//i.test(url) && !/\.(apk|ipa)(\?|$)/i.test(url)) {
        return '「下载 URL」填的是蒲公英应用页面链接，下载下来是网页不是安装包。请清空它——'
          + '执行流程时可以直接选要装哪个版本'
      }
    }
    for (const key of ['thenSteps', 'elseSteps'] as const) {
      const nested = s.params?.[key]
      if (Array.isArray(nested)) {
        const err = findInstallConfigError(nested)
        if (err) return err
      }
    }
  }
  return null
}

function findLaunchAppConfigError(list: FlowStep[]): string | null {
  for (const s of list) {
    const code = String(s.keywordCode || '').toUpperCase()
    const isAndroidLaunch =
      (code.startsWith('LAUNCH_APP') || code.startsWith('COLD_START')) && !isIosStartStep(s.keywordCode)
    if (isAndroidLaunch) {
      const hasPkg = !!String(s.params?.packageName || '').trim()
      if (hasPkg && !String(s.params?.activity || '').trim()) {
        return '「启动/冷启动 · Android」已填包名时请同时填写 appium:appActivity'
      }
    }
    for (const key of ['thenSteps', 'elseSteps'] as const) {
      const nested = s.params?.[key]
      if (Array.isArray(nested)) {
        const err = findLaunchAppConfigError(nested)
        if (err) return err
      }
    }
  }
  return null
}

const envScanVisible = ref(false)
const envScanSummary = ref('')
const envScanHits = ref<
  Array<{
    stepNo: string
    paramName: string
    value: string
    kind: string
    suggestVariable?: string
    reason: string
  }>
>([])
const scanningId = ref('')

async function openEnvScan(row: any) {
  scanningId.value = row.id
  try {
    const res = await apiClient.scanFlowEnvData(row.id)
    envScanSummary.value = res.summary
    envScanHits.value = res.hits || []
    envScanVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '检查失败')
  } finally {
    scanningId.value = ''
  }
}

async function openExecute(row: any) {
  execFlow.value = row
  execForm.deviceId = ''
  execForm.runNow = true
  execForm.countInStats = false
  // 跟着流程自己的环境走：流程标了测试环境，执行时默认就该是测试环境，
  // 否则会出现「流程写着 TEST、执行记录写着 PROD」这种自相矛盾的报告
  execForm.environment = row?.environment === 'TEST' ? 'TEST' : 'PROD'
  execForm.params = {}
  execVars.value = []
  execForm.pgyerBuildKey = ''
  pgyerBuilds.value = []
  pgyerLoadError.value = ''
  execInstallSummary.mode = ''
  execInstallSummary.apkPath = ''
  execInstallSummary.apkArtifactId = ''
  execInstallSummary.hint = ''
  execDevices.value = []
  execMeta.lastRunStatus = ''
  execMeta.caseCount = null

  // 先把弹窗打开，再去加载。
  // 原来是等 4 个串行请求全跑完才 execVisible=true——其中枚举设备要走 adb / idevice_id，
  // 蒲公英列表还要发网络请求，加起来好几秒。这几秒里按钮毫无反应，
  // 人会以为没点上，于是再点一次，又排一轮
  execLoading.value = true
  execVisible.value = true

  const fromStep = extractLaunchAppFromFlow(row)
  const appId = row.appId || fromStep.appId || matchAppIdByPackage(fromStep.packageName || '') || ''
  const platform = row.platform || 'ANDROID'
  const packageName =
    fromStep.packageName || packageFromApp(appId, platform) || packageFromApp(appId, 'ANDROID')
  const activity = fromStep.activity || activityForPackage(packageName)
  execLaunchSummary.appId = appId
  execLaunchSummary.appLabel = appId ? appLabel(appId) : packageName ? '步骤指定包名' : '未配置启动应用'
  execLaunchSummary.packageName = packageName
  execLaunchSummary.activity = activity
  execLaunchSummary.platform = platform
  applyExecInstallSummary(row)

  try {
    // 三个互不依赖，并行拉。串行的话是三者耗时相加，而最慢那个（枚举设备）本来就要好几秒
    await Promise.all([
      apiClient
        .getFlowLocatorVariables(row.id)
        .then((v) => (execVars.value = v))
        // 取不到变量清单不该挡住执行；真缺变量时后端会明确报出缺哪个
        .catch(() => undefined),
      appOptions.value.length
        ? Promise.resolve()
        : apiClient
            .getUiApps({ enabledOnly: true })
            .then((v) => (appOptions.value = v))
            .catch(() => undefined),
      loadExecDevices(),
      loadExecMeta(row.id)
    ])

    // 这两步依赖设备结果，只能放在后面
    if (execForm.deviceId) {
      await refreshExecForDevice()
    } else if (flowUsesPgyerInstall(row) && appId) {
      // 尚未选设备时，先按流程平台预拉（选设备后会再按设备平台刷新）
      await loadPgyerBuildsForExec(appId, platform)
    }
  } finally {
    execLoading.value = false
  }
}

/** 选设备后：包名按平台切 Android 包名 / iOS BundleId，蒲公英列表用对应 Key */
async function onExecDeviceChange() {
  await refreshExecForDevice()
}

async function refreshExecForDevice() {
  const device =
    execDevices.value.find((d) => d.id === execForm.deviceId) ||
    deviceOptions.value.find((d) => d.id === execForm.deviceId)
  if (!device) return
  const devicePlatform = String(device.platform || '').toUpperCase().includes('IOS') ? 'IOS' : 'ANDROID'
  const appId = execLaunchSummary.appId
  if (appId) {
    const pkg = packageFromApp(appId, devicePlatform)
    if (pkg) {
      execLaunchSummary.packageName = pkg
      execLaunchSummary.platform = devicePlatform
      execLaunchSummary.activity =
        devicePlatform === 'IOS' ? '' : activityForPackage(pkg)
    }
  } else {
    execLaunchSummary.platform = devicePlatform
  }
  if (execFlow.value && flowUsesPgyerInstall(execFlow.value) && appId) {
    await loadPgyerBuildsForExec(appId, devicePlatform)
  }
}

async function loadPgyerBuildsForExec(appId: string, platform: string) {
  execForm.pgyerBuildKey = ''
  pgyerBuilds.value = []
  pgyerLoadError.value = ''
  try {
    const builds = await apiClient.getPgyerAppBuilds(appId, platform, 5)
    pgyerBuilds.value = builds || []
    if (pgyerBuilds.value.length) {
      execForm.pgyerBuildKey = pgyerBuilds.value[0].buildKey
    } else {
      const platLabel = String(platform || '').toUpperCase().includes('IOS') ? 'iOS' : 'Android'
      pgyerLoadError.value = `该应用未配置${platLabel} 蒲公英 Key，请到「应用字典」补上`
    }
  } catch (e: any) {
    pgyerLoadError.value = e?.message || '拉取蒲公英版本失败'
  }
}

function execPlatformLabel(platform?: string) {
  const p = String(platform || '').toUpperCase()
  if (p.includes('IOS')) return 'iOS'
  if (p.includes('HARMONY')) return 'HarmonyOS'
  if (p.includes('ANDROID')) return 'Android'
  return platform || ''
}

function execDeviceTitle(d: any) {
  return String(d?.id || d?.name || '—')
}

function execDeviceSub(d: any) {
  const plat = execPlatformLabel(d?.platform)
  const ver = String(d?.version || '').replace(/^(android|ios|harmonyos)\s*/i, '').trim()
  const model = d?.name && d.name !== d.id ? String(d.name) : ''
  const os = plat + (ver ? ' ' + ver : '')
  return [model, os].filter(Boolean).join(' • ') || '—'
}

function execDeviceKind(d: any): 'idle' | 'busy' | 'offline' {
  if (String(d?.status || '').toUpperCase() !== 'CONNECTED') return 'offline'
  if (d?.locked) return 'busy'
  return 'idle'
}

function execDeviceStatusText(d: any) {
  const k = execDeviceKind(d)
  if (k === 'idle') return '空闲'
  if (k === 'busy') return '执行中'
  return '离线'
}

function selectExecDevice(d: any) {
  if (execDeviceKind(d) === 'offline') return
  execForm.deviceId = d.id
  void onExecDeviceChange()
}

const selectedExecDevice = computed(() =>
  execDevices.value.find((d) => d.id === execForm.deviceId) || null
)

const execStepCount = computed(() => stepCount(execFlow.value?.steps))

const execPlatformKey = computed(() => {
  const p = String(execFlow.value?.platform || execLaunchSummary.platform || '').toUpperCase()
  if (p.includes('IOS')) return 'ios'
  if (p.includes('HARMONY')) return 'harmony'
  return 'android'
})

const execPlatformText = computed(() => {
  const k = execPlatformKey.value
  if (k === 'ios') return 'IOS'
  if (k === 'harmony') return 'HARMONYOS'
  return 'ANDROID'
})

const execEnvAppText = computed(() => {
  const env = execForm.environment === 'TEST' ? '测试环境' : '生产环境'
  const app = execLaunchSummary.appLabel && execLaunchSummary.appLabel !== '—'
    ? execLaunchSummary.appLabel
    : appLabel(execFlow.value?.appId || '')
  return `${env} • ${app || '未指定应用'}`
})

const execLastRunLabel = computed(() => {
  const u = String(execMeta.lastRunStatus || '').toUpperCase()
  if (!u) return '未跑'
  if (u === 'COMPLETED' || u === 'SUCCESS') return '通过'
  if (u === 'FAILED') return '失败'
  if (u === 'RUNNING') return '执行中'
  if (u === 'STOPPED') return '已停止'
  if (u === 'PENDING') return '排队'
  return execMeta.lastRunStatus
})

const execLastRunTone = computed(() => {
  const u = String(execMeta.lastRunStatus || '').toUpperCase()
  if (u === 'COMPLETED' || u === 'SUCCESS') return 'pass'
  if (u === 'FAILED') return 'fail'
  if (u === 'RUNNING' || u === 'PENDING') return 'warn'
  return 'idle'
})

const execCaseCountText = computed(() =>
  execMeta.caseCount == null ? '—' : `${execMeta.caseCount} 条`
)

async function loadExecMeta(flowId: string) {
  try {
    const lastRuns = await apiClient.getUiFlowLastRuns([flowId])
    execMeta.lastRunStatus = String(lastRuns?.[flowId]?.lastRunStatus || '')
  } catch {
    execMeta.lastRunStatus = ''
  }
  try {
    const cases = await apiClient.getFlowCases(flowId)
    execMeta.caseCount = Array.isArray(cases) ? cases.length : 0
  } catch {
    execMeta.caseCount = 0
  }
}

async function refreshExecDevices() {
  execRefreshing.value = true
  try {
    await apiClient.scanDevices()
  } catch {
    /* 扫描失败仍拉现有列表 */
  }
  try {
    await loadExecDevices()
    if (!execDevices.value.some((d) => execDeviceKind(d) === 'idle')) {
      ElMessage.warning(`当前没有空闲的 ${platformUiLabel(execWantedPlatform()) || '匹配'} 设备`)
    }
  } finally {
    execRefreshing.value = false
  }
}

function execWantedPlatform() {
  return String(execFlow.value?.platform || execLaunchSummary.platform || '').trim()
}

function execDeviceMatchesFlow(d: any) {
  const wanted = execWantedPlatform()
  if (!wanted) return true
  return deviceRowMatchesTaskPlatform(d?.platform, wanted)
}

async function loadExecDevices() {
  try {
    const all = await apiClient.getDevices()
    const rows = Array.isArray(all) ? all : []
    const seen = new Set<string>()
    const list = rows.filter((d: any) => {
      const id = d?.id
      if (!id || seen.has(id)) return false
      if (String(d.status || '').toUpperCase() !== 'CONNECTED') return false
      if (!execDeviceMatchesFlow(d)) return false
      seen.add(id)
      return true
    })
    const lockPairs = await Promise.all(
      list
        .filter((d: any) => String(d.status || '').toUpperCase() === 'CONNECTED')
        .map((d: any) =>
          apiClient
            .getDeviceLock(d.id)
            .then((r) => [d.id, !!r?.locked] as const)
            .catch(() => [d.id, false] as const)
        )
    )
    const lockedIds = new Set(lockPairs.filter(([, locked]) => locked).map(([id]) => id))
    execDevices.value = list.map((d: any) => ({ ...d, locked: lockedIds.has(d.id) }))
    const stillOk = execDevices.value.some(
      (d) => d.id === execForm.deviceId && execDeviceKind(d) !== 'offline'
    )
    if (!stillOk) {
      const idle = execDevices.value.find((d) => execDeviceKind(d) === 'idle')
      execForm.deviceId = idle?.id || ''
    }
  } catch {
    execDevices.value = []
  }
}

/** 只列已连接设备：列出离线设备只会让人选中之后再报一次错 */
async function loadConnectedDevices() {
  try {
    const all = await apiClient.getDevices()
    const rows = Array.isArray(all) ? all : []
    const seen = new Set<string>()
    deviceOptions.value = rows.filter((d: any) => {
      const id = d?.id
      if (!id || seen.has(id)) return false
      if (String(d.status || '').toUpperCase() !== 'CONNECTED') return false
      seen.add(id)
      return true
    })
    if (deviceOptions.value.length === 0) {
      ElMessage.warning('当前没有已连接设备，请先在设备管理中连接')
    }
  } catch {
    deviceOptions.value = []
  }
}

async function submitExecute() {
  if (!execFlow.value?.id) return
  if (!execForm.deviceId) {
    ElMessage.warning('请选择设备')
    return
  }
  const picked = selectedExecDevice.value
  if (picked && execDeviceKind(picked) === 'busy') {
    ElMessage.warning('这台设备正在执行中，请换一台空闲设备')
    return
  }
  if (picked && execDeviceKind(picked) === 'offline') {
    ElMessage.warning('这台设备已离线，请换一台或先刷新设备')
    return
  }
  if (!execLaunchSummary.packageName && !execLaunchSummary.appId) {
    ElMessage.warning('流程未配置启动包名，请先编辑流程并在「启动应用程序」中选择要跑的包')
    return
  }
  const missing = execVars.value.filter((v) => !String(execForm.params[v] || '').trim())
  if (missing.length) {
    ElMessage.warning(`请填写定位变量：${missing.join('、')}`)
    return
  }
  if (execForm.environment === 'PROD') {
    const ok = await askProdConfirm({
      flowName: execFlow.value.name,
      deviceName: execDeviceModel(picked)
    })
    if (!ok) return
  }
  executing.value = true
  try {
    const res = await apiClient.executeUiFlow(execFlow.value.id, {
      deviceId: execForm.deviceId,
      platform: execLaunchSummary.platform || undefined,
      appId: execLaunchSummary.appId || undefined,
      packageName: execLaunchSummary.packageName || undefined,
      activity: execLaunchSummary.activity || undefined,
      environment: execForm.environment,
      params: buildExecParams(),
      runNow: execForm.runNow,
      // 不勾「记入统计」就是试跑：后端据此把这次执行从通过率、最近结果和告警里摘出去
      track: execForm.countInStats ? undefined : 'DEBUG'
    })
    execVisible.value = false
    const taskId = String((res as any)?.taskId || '').trim()
    if (taskId) {
      const flow = execFlow.value
      if (flow && !execForm.countInStats) {
        flow.lastDebugStatus = 'RUNNING'
        flow.lastDebugTaskId = taskId
      }
      watchTaskId.value = taskId
      watchFlowName.value = String(execFlow.value?.name || '')
      watchIsDebug.value = !execForm.countInStats
      watchVisible.value = true
    } else {
      // 理论上不会走到：接口一直返回 taskId。真没有的话至少别静默
      ElMessage.success(res.message || '已开始执行')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    executing.value = false
  }
}

/** 选中的版本走执行参数下发：安装关键字本来就会先读执行参数，流程不用改 */
function buildExecParams() {
  const p: Record<string, string> = { ...execForm.params }
  if (execForm.pgyerBuildKey) {
    // 用 override 而不是 pgyerBuildKey：执行时的显式选择必须盖过流程里存的那个，
    // 否则界面上选了 A、实际装 B，日志还显示成功
    p.pgyerBuildKeyOverride = execForm.pgyerBuildKey
  }
  return Object.keys(p).length ? p : undefined
}

/** 流程里有没有蒲公英安装步骤（按 installMode 判断，不靠 JSON 里 pgyer 字段名） */
function parseFlowSteps(flow: any): any[] {
  try {
    const raw = typeof flow?.steps === 'string' ? JSON.parse(flow.steps || '[]') : flow?.steps
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function walkAllFlowSteps(arr: any[], visitor: (step: any) => void) {
  for (const s of arr) {
    if (!s) continue
    visitor(s)
    for (const key of ['thenSteps', 'elseSteps'] as const) {
      if (Array.isArray(s?.params?.[key])) walkAllFlowSteps(s.params[key], visitor)
    }
  }
}

function collectInstallSteps(flow: any): any[] {
  const out: any[] = []
  walkAllFlowSteps(parseFlowSteps(flow), (s) => {
    const code = String(s?.keywordCode || s?.action || '').toUpperCase()
    if (code === 'INSTALL_APP' || code === 'INSTALL_FROM_STORE') out.push(s)
  })
  return out
}

function resolveInstallMode(step: any): string {
  const mode = String(step?.params?.installMode || '').trim().toUpperCase()
  if (mode) return mode
  const code = String(step?.keywordCode || '').toUpperCase()
  if (code === 'INSTALL_FROM_STORE') return 'CHANNEL_PAGE'
  return 'CHANNEL_PAGE'
}

function primaryInstallMode(flow: any): string {
  const steps = collectInstallSteps(flow)
  return steps.length ? resolveInstallMode(steps[0]) : ''
}

/** 本地 APK 路径：目录 / 文件名 */
function apkPathDir(path: string): string {
  const p = String(path || '').trim()
  const slash = p.lastIndexOf('/')
  return slash >= 0 ? p.slice(0, slash + 1) : ''
}

function apkPathFile(path: string): string {
  const p = String(path || '').trim()
  const slash = p.lastIndexOf('/')
  return slash >= 0 ? p.slice(slash + 1) : p
}

function flowUsesPgyerInstall(flow: any): boolean {
  return collectInstallSteps(flow).some((s) => resolveInstallMode(s) === 'PGYER')
}

function applyExecInstallSummary(flow: any) {
  const mode = primaryInstallMode(flow)
  execInstallSummary.mode = mode
  execInstallSummary.apkPath = ''
  execInstallSummary.apkArtifactId = ''
  execInstallSummary.hint = ''
  if (mode === 'LOCAL_APK') {
    const step = collectInstallSteps(flow).find((s) => resolveInstallMode(s) === 'LOCAL_APK')
    execInstallSummary.apkPath = String(step?.params?.apkPath || '').trim()
    execInstallSummary.apkArtifactId = String(step?.params?.apkArtifactId || '').trim()
    if (!execInstallSummary.apkPath && !execInstallSummary.apkArtifactId) {
      execInstallSummary.hint = '流程里未填本地路径或上传应用 ID，执行会失败'
    }
    return
  }
  if (mode === 'CHANNEL_PAGE') {
    execInstallSummary.hint = '执行时按流程配置的渠道页安装，无需选择蒲公英版本'
  }
}

function extractLaunchAppFromFlow(flow: any): { appId?: string; packageName?: string; activity?: string } {
  try {
    const raw = typeof flow?.steps === 'string' ? JSON.parse(flow.steps || '[]') : flow?.steps
    const list = Array.isArray(raw) ? raw : []
    const walk = (arr: any[]): { appId?: string; packageName?: string; activity?: string } | null => {
      for (const s of arr) {
        const code = s?.keywordCode || s?.action
        if (
          code === 'LAUNCH_APP' ||
          code === 'COLD_START' ||
          code === 'HOT_START' ||
          code === 'LAUNCH_APP_IOS' ||
          code === 'COLD_START_IOS' ||
          code === 'HOT_START_IOS'
        ) {
          const packageName = String(s?.params?.packageName || '').trim()
          const activity = String(s?.params?.activity || '').trim()
          const appId = String(s?.params?.appId || '').trim()
          if (packageName || activity || appId) {
            return {
              appId: appId || undefined,
              packageName: packageName || undefined,
              activity: activity || undefined
            }
          }
        }
        for (const key of ['thenSteps', 'elseSteps']) {
          if (Array.isArray(s?.params?.[key])) {
            const found = walk(s.params[key])
            if (found) return found
          }
        }
      }
      return null
    }
    return walk(list) || {}
  } catch {
    return {}
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除流程「${row.name}」？`, '删除', { type: 'warning' })
  try {
    await apiClient.deleteUiFlow(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

function flowRowClassName({ row }: { row: any }) {
  return row?.id && row.id === highlightFlowId.value ? 'flow-row-highlight' : ''
}

function consumePendingEdit(): { id: string; name: string } | null {
  const fromQueryId = String(route.query.edit || '').trim()
  const fromQueryName = String(route.query.name || '').trim()
  if (fromQueryId) {
    return { id: fromQueryId, name: fromQueryName }
  }
  try {
    const raw = sessionStorage.getItem('ui-flows-pending-edit')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: string; name?: string; at?: number }
    const id = String(parsed?.id || '').trim()
    if (!id) return null
    if (parsed.at && Date.now() - parsed.at > 120_000) {
      sessionStorage.removeItem('ui-flows-pending-edit')
      return null
    }
    return { id, name: String(parsed.name || '').trim() }
  } catch {
    return null
  }
}

/** 支持 /ui-flows?edit=<id>：进页直接打开编辑抽屉（打开期间不要改 URL） */
async function openEditFromQuery() {
  if (openingFromQuery || drawerVisible.value) return
  const pending = consumePendingEdit()
  if (!pending) return
  openingFromQuery = true
  try {
    const row = await apiClient.getUiFlow(pending.id)
    if (!row?.id) {
      ElMessage.warning(`未找到流程：${pending.name || pending.id}`)
      return
    }
    // 先打开抽屉，再慢慢补列表；loadMeta 失败也不能挡住打开
    editingId.value = row.id
    highlightFlowId.value = row.id
    Object.assign(form, {
      name: row.name || pending.name || '',
      description: row.description || '',
      appId: row.appId || '',
      platform: row.platform || '',
      catalog: row.catalog || 'SHARED',
      environment: row.environment === 'TEST' ? 'TEST' : 'PROD',
      dependsOn: parseDependsOn(row.dependsOn),
      isComponent: !!row.isComponent,
      enabled: row.enabled !== false,
      sortOrder: row.sortOrder ?? 100,
      caseIds: []
    })
    steps.value = parseSteps(row.steps)
    insertAfterId.value = ''
    selectedStep.value = steps.value[0] || null
    if (selectedStep.value) insertAfterId.value = pointIdOfStep(selectedStep.value)
    resetOutlineExpand()
    if (!form.appId) {
      const launch = steps.value.find((s) => isAnyLaunchStep(s.keywordCode))
      form.appId =
        String(launch?.params?.appId || '').trim() ||
        matchAppIdByPackage(String(launch?.params?.packageName || '')) ||
        ''
    }
    if (!form.platform && form.appId) form.platform = 'ANDROID'
    drawerVisible.value = true
    await nextTick()
    ElMessage.success(`正在编辑：${form.name || pending.id}`)

    try {
      await loadMeta()
      loadLinkableCases()
      if (row.appId) applyProductSelection(productFromAppId(row.appId), row.platform)
      if (row.environment === 'TEST' || row.environment === 'PROD') {
        filterEnvironment.value = row.environment
      }
      filterCatalog.value = ''
      componentOnly.value = false
      await loadList()
    } catch (e) {
      console.warn('编辑抽屉已打开，后台刷新列表失败', e)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '打开流程失败')
  } finally {
    openingFromQuery = false
    // 故意不在这里清 ?edit=：MainLayout 用 fullPath 做 key，一改 query 会重挂载并关掉抽屉
  }
}

watch(
  () => route.query.edit,
  async (id) => {
    if (id && !drawerVisible.value) await openEditFromQuery()
  }
)

onMounted(async () => {
  // 有待编辑目标时优先开抽屉，别先被 loadList 拖住
  const pending = consumePendingEdit()
  if (pending) {
    // consume 只读 query 时不会删 sessionStorage；再写回去供 openEditFromQuery 使用
    try {
      sessionStorage.setItem(
        'ui-flows-pending-edit',
        JSON.stringify({ id: pending.id, name: pending.name, at: Date.now() })
      )
    } catch {
      /* ignore */
    }
    await openEditFromQuery()
    void loadMeta()
    void loadList()
    return
  }
  await loadMeta()
  await loadList()
})
</script>

<style scoped>
.ui-flows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar,
.filter-panel,
.list-panel {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
}
.toolbar-tools,
.toolbar-create {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.filter-panel {
  padding: 14px 16px 12px;
}
.chip-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 10px;
}
.chip-label {
  width: 36px;
  flex-shrink: 0;
  font-size: 13px;
  color: #909399;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.app-chip,
.plat-chip,
.env-chip {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
}
.app-chip.active {
  color: #409eff;
  font-weight: 600;
  background: #ecf5ff;
}
.plat-chip {
  border: 1px solid #e4e7ed;
  background: #f5f7fa;
}
.plat-chip.active {
  border-color: #67c23a;
  background: #67c23a;
  color: #fff;
  font-weight: 600;
}
.env-chip {
  border: 1px solid #e4e7ed;
  background: #f5f7fa;
}
.env-chip.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}
.env-chip.test.active {
  border-color: #e6a23c;
  background: #fdf6ec;
  color: #e6a23c;
}
.env-chip.prod.active {
  border-color: #f56c6c;
  background: #fef0f0;
  color: #f56c6c;
}
.search-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.search-input {
  width: 280px;
  flex: 1 1 200px;
  max-width: 360px;
}
.comp-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}
.search-count {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}
.list-panel {
  padding: 8px 0 12px;
  overflow: hidden;
}
.pagination-wrap {
  margin-top: 16px;
  padding: 0 16px;
  display: flex;
  justify-content: flex-end;
}
.result-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.result-idle {
  color: #c0c4cc;
}

.env-scan-list {
  margin-top: 12px;
  max-height: 420px;
  overflow-y: auto;
}

.env-scan-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--el-border-color);
}

.env-scan-item:last-child {
  border-bottom: none;
}

.env-scan-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.env-scan-param {
  font-weight: 500;
}

.env-scan-value {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: monospace;
}

.env-scan-reason {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.flow-list-table :deep(.el-table__cell) {
  color: var(--app-text);
}
.flow-name {
  font-weight: normal;
  color: #1f2937;
}
.flow-app {
  color: #374151;
  font-weight: normal;
}
.flow-desc {
  color: #4b5563;
}
.muted-dash {
  color: #9ca3af;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-weight: normal;
}
.flow-scene-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.catalog-suggest {
  margin-left: 6px;
  cursor: pointer;
}
.exec-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-placeholder);
}
.exec-hint.warn {
  color: var(--app-warning);
}
.element-scope {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}
.element-pick-actions {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.exec-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--app-text-secondary);
  word-break: break-all;
}
.exec-mono.muted {
  color: var(--el-text-color-placeholder);
}
.exec-install-box {
  width: 100%;
  padding: 10px 12px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.exec-apk-path {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
  overflow-x: auto;
}
.exec-apk-path .apk-dir {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.exec-apk-path .apk-file {
  display: inline-block;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 6px;
  color: #0d7a3a;
  font-weight: 700;
  font-size: 14px;
  background: linear-gradient(135deg, #e8f8ee 0%, #d4f0e0 100%);
  border: 1px solid #52c41a;
  box-shadow: 0 1px 2px rgba(82, 196, 26, 0.15);
}
.filter-bar {
  margin-bottom: 12px;
}
.flow-config-section {
  flex-shrink: 0;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  margin-bottom: 10px;
  overflow: hidden;
}
.flow-config-head {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  background: #f5f7fa;
  color: #303133;
  font-size: 13px;
  font-weight: 600;
}
.flow-config-section .flow-meta-form {
  padding: 12px 16px 4px;
}
.steps-hdr {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid #3b82f6;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.steps-add-bar {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 14px 12px;
  border: 1px solid #e4e7ed;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: #fafafa;
}
.steps-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.template-dropdown-trigger {
  display: inline-flex;
}
.steps-section-hint {
  margin: -8px 0 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}
.steps-split {
  flex: 1 0 auto;
  min-height: calc(100vh - 230px);
  display: grid;
  grid-template-columns: 220px 1fr;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  border-radius: 0 0 10px 10px;
  background: #fff;
}
.steps-outline {
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid #e8e8e8;
  background: #f7f8fa;
}
.outline-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  background: #f7f8fa;
  border-bottom: 1px solid #ebeef5;
}
.outline-empty {
  padding: 20px 12px;
  font-size: 12px;
  color: #c0c4cc;
}
.outline-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 7px 10px 7px 6px;
  border: none;
  border-left: 3px solid var(--step-color, #dcdfe6);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: #303133;
}
.outline-caret,
.outline-caret-spacer {
  flex: 0 0 14px;
  width: 14px;
  height: 16px;
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}
.outline-caret {
  border-radius: 3px;
}
.outline-caret:hover {
  background: #e4e7ed;
  color: #303133;
}
.outline-caret .el-icon {
  font-size: 11px;
  transition: transform 0.15s ease;
}
.outline-caret.open .el-icon {
  transform: rotate(90deg);
}
.outline-kids {
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  color: #909399;
  background: #ebeef5;
  border-radius: 8px;
  padding: 0 6px;
}
.outline-item:hover {
  background: #eef2f7;
}
.outline-item.active {
  background: var(--step-soft-bg, #ecf5ff);
}
.outline-no {
  flex: 0 0 auto;
  min-width: 22px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--step-color, #909399);
  font-variant-numeric: tabular-nums;
}
.outline-main {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
}
.outline-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}
.outline-branch {
  font-size: 11px;
  color: #d48806;
  background: #fff7e6;
  border: 1px solid #ffe7ba;
  border-radius: 4px;
  padding: 0 5px;
  line-height: 18px;
}
.outline-desc {
  flex: 1 1 100%;
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.steps-pane {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 20px;
}
.flow-meta-form :deep(.el-form-item) {
  margin-bottom: 18px;
}
.flow-meta-form :deep(.el-form-item__label) {
  margin-bottom: 0;
  line-height: 32px;
  color: #606266;
  font-weight: 400;
  justify-content: flex-start;
}
.flow-section {
  margin-bottom: 8px;
}
.flow-section + .flow-section {
  margin-top: 20px;
}
.flow-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding-left: 10px;
  border-left: 3px solid #3b82f6;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.flow-config-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.stage-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.stage-chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  line-height: 26px;
}
.stage-chip.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}
.stage-chip.stage-online.active {
  border-color: #f97316;
  background: #f97316;
  color: #fff;
}
.switch-with-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}
.switch-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.appear-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #eff6ff;
}
.appear-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.4;
}
.seg-env :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #22c55e;
  border-color: #22c55e;
  color: #fff;
  box-shadow: -1px 0 0 0 #22c55e;
}
.form-field-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}
.form-field-stack .exec-hint {
  margin: 0;
  line-height: 1.55;
}
.flow-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.flow-form-row-switches :deep(.el-form-item__content) {
  min-height: 32px;
  align-items: center;
}
.form-label-with-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.form-help-icon {
  color: #c0c4cc;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.15s ease;
}
.form-help-icon:hover {
  color: var(--el-color-primary);
}
.form-help-toggle {
  margin-top: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  text-align: left;
}
.form-help-toggle:hover,
.form-help-toggle.open {
  color: var(--el-color-primary);
}
.form-help-body {
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
  line-height: 1.65;
}
.form-help-pop {
  font-size: 12px;
  line-height: 1.65;
  color: #606266;
}
.form-help-pop p {
  margin: 0 0 8px;
}
.form-help-pop p:last-child {
  margin-bottom: 0;
}
.steps-empty {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  padding: 12px 0;
}
.step-desc-inline {
  font-size: 12px;
  color: var(--app-text-secondary);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding-right: 8px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
.drawer-header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
}
.drawer-flow-name {
  color: var(--el-color-primary);
  font-weight: 700;
  margin-left: 2px;
}
.flow-list-table :deep(.flow-row-highlight > td.el-table__cell) {
  background: #ecf5ff !important;
}
.flow-chart-btn {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.exec-dlg-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.exec-flow-card {
  padding: 14px 16px 12px;
  border-radius: 10px;
  background: #f5f7fa;
}
.exec-flow-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.exec-flow-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f2329;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exec-plat-pill {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  background: #e8f8ee;
  color: #237804;
}
.exec-plat-pill.plat-ios {
  background: #fff7e6;
  color: #d48806;
}
.exec-plat-pill.plat-harmony {
  background: #ecf5ff;
  color: #1677ff;
}
.exec-flow-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.exec-flow-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}
.exec-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.exec-stat .el-icon {
  font-size: 14px;
  color: #909399;
}
.exec-stat b {
  font-weight: 600;
  color: #303133;
}
.exec-stat b.run-pass {
  color: #52c41a;
}
.exec-stat b.run-fail {
  color: #f5222d;
}
.exec-stat b.run-warn {
  color: #fa8c16;
}
.exec-stat b.run-idle {
  color: #909399;
  font-weight: 500;
}
.exec-dev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.exec-refresh-btn {
  padding: 0;
  height: auto;
  font-size: 13px;
}
.exec-dev-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}
.exec-dev-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  color: #303133;
}
.exec-dev-card:hover:not(:disabled) {
  border-color: #b3d8ff;
}
.exec-dev-card.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.exec-dev-card.offline {
  opacity: 0.55;
  cursor: not-allowed;
  background: #fafafa;
}
.exec-dev-card.busy:not(.selected) {
  background: #fff;
}
.exec-dev-radio {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  border: 1.5px solid #c0c4cc;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}
.exec-dev-radio.on {
  border-color: #409eff;
  box-shadow: inset 0 0 0 4px #409eff;
}
.exec-dev-icon {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f0f9eb;
  color: #67c23a;
  font-size: 16px;
}
.exec-dev-card.offline .exec-dev-icon {
  background: #f5f7fa;
  color: #c0c4cc;
}
.exec-dev-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.exec-dev-name {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
}
.exec-dev-sub {
  font-size: 12px;
  color: #909399;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exec-dev-status {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
}
.exec-dev-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.exec-dev-status.idle {
  color: #52c41a;
}
.exec-dev-status.busy {
  color: #fa8c16;
}
.exec-dev-status.offline {
  color: #c0c4cc;
}
.exec-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exec-field-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}
.exec-field-label .req {
  color: #f56c6c;
  margin-right: 4px;
}
.exec-field-control {
  width: 100%;
}
.exec-env-toggle {
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: #f0f2f5;
  gap: 2px;
}
.exec-env-btn {
  border: none;
  background: transparent;
  color: #606266;
  font-size: 13px;
  line-height: 1;
  padding: 9px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.exec-env-btn.active {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.exec-vars-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exec-var-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.exec-var-name {
  flex: 0 0 110px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.exec-opt-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.exec-opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}
.exec-opt-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.exec-opt-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.exec-dlg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.exec-picked {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}
.exec-dlg-actions {
  display: flex;
  gap: 8px;
}

.install-note {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}
.install-note.warn {
  color: var(--el-color-warning);
  margin-top: 4px;
}
</style>

<!-- 非 scoped：盖住 append-to-body 的抽屉头，保证右上角 × 可点；插入位置下拉同理 teleport -->
<style>
.ui-flow-drawer.el-drawer,
.ui-flow-drawer .el-drawer__header,
.ui-flow-drawer .el-drawer__close-btn,
.ui-flow-drawer .flow-chart-btn,
.ui-flow-drawer .drawer-header-actions {
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
}
.ui-flow-drawer.el-drawer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.ui-flow-drawer .el-drawer__header {
  flex-shrink: 0;
  margin-bottom: 0;
  padding: 10px 16px;
  min-height: 50px;
}
.ui-flow-drawer .el-drawer__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 16px 12px;
}
.ui-flow-drawer .el-drawer__footer {
  flex-shrink: 0;
}
.ui-flow-drawer .flow-meta-form textarea {
  resize: none;
}

/* 执行流程弹窗（teleport 到 body，需非 scoped） */
.exec-flow-dialog.el-dialog {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
}
.exec-flow-dialog .el-dialog__header {
  margin: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid #ebeef5;
}
.exec-flow-dialog .el-dialog__body {
  padding: 18px 20px;
  max-height: min(70vh, 640px);
  overflow-y: auto;
}
.exec-flow-dialog .el-dialog__footer {
  padding: 14px 20px 18px;
  border-top: 1px solid #ebeef5;
}
.exec-flow-dialog .exec-dlg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.exec-flow-dialog .exec-dlg-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.3;
}
.exec-flow-dialog .exec-dlg-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ecf5ff;
  color: var(--el-color-primary);
  font-size: 14px;
}
.exec-flow-dialog .exec-dlg-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: #f0f2f5;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
}
.exec-flow-dialog .exec-dlg-close:hover {
  background: #e4e7ed;
  color: #606266;
}
.exec-flow-dialog .exec-btn-cancel {
  min-width: 76px;
  border-radius: 8px;
}
.exec-flow-dialog .exec-btn-primary {
  min-width: 96px;
  border-radius: 8px;
}
.exec-flow-dialog .el-select .el-input__wrapper {
  border-radius: 8px;
}
.insert-pos-popper.el-select-dropdown {
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 8px 0 6px;
  min-width: 380px !important;
}
.insert-pos-popper .el-select-dropdown__item {
  height: auto;
  padding: 8px 12px;
  line-height: 1.35;
}
.insert-pos-popper .el-select-dropdown__item.ins-search-opt {
  padding: 6px 12px 10px;
  height: auto;
  cursor: default;
  background: #fff !important;
  color: inherit;
}
.insert-pos-popper .el-select-dropdown__item.ins-search-opt.is-disabled {
  cursor: default;
  color: inherit;
}
.insert-pos-popper .el-select-group__title {
  padding: 6px 12px;
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
}
.insert-pos-popper .ins-append {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.insert-pos-popper .ins-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: #eef2f6;
  color: #606266;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}
.insert-pos-popper .ins-append-name {
  flex: 1;
  font-size: 13px;
  color: #303133;
}
.insert-pos-popper .ins-default {
  font-size: 12px;
  color: #c0c4cc;
}
.insert-pos-popper .ins-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.insert-pos-popper .ins-row.child {
  padding-left: 18px;
}
.insert-pos-popper .el-select-dropdown__item.is-child {
  position: relative;
}
.insert-pos-popper .el-select-dropdown__item.is-child::before {
  content: '';
  position: absolute;
  left: 22px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: #dcdfe6;
}
.insert-pos-popper .el-select-dropdown__item.rail-then::before {
  background: #22c55e;
}
.insert-pos-popper .el-select-dropdown__item.rail-else::before {
  background: #f43f5e;
}
.insert-pos-popper .el-select-dropdown__item.rail-cand::before {
  background: #f59e0b;
}
.insert-pos-popper .el-select-dropdown__item.rail-none::before {
  background: #94a3b8;
}
.insert-pos-popper .ins-no {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.insert-pos-popper .ins-body {
  min-width: 0;
  flex: 1;
}
.insert-pos-popper .ins-hint {
  font-size: 11px;
  color: #909399;
  line-height: 1.2;
}
.insert-pos-popper .el-select-dropdown__item.selected .ins-hint {
  color: #409eff;
}
.insert-pos-popper .ins-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.insert-pos-popper .ins-branch {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background: #fff7e6;
  color: #d48806;
}
.insert-pos-popper .ins-branch.rail-then {
  background: #ecfdf5;
  color: #059669;
}
.insert-pos-popper .ins-branch.rail-else {
  background: #fff1f2;
  color: #e11d48;
}
.insert-pos-popper .ins-branch.rail-none {
  background: #f1f5f9;
  color: #64748b;
}
.insert-pos-popper .ins-tag {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}
.insert-pos-popper .ins-tag.tone-device {
  background: #eff6ff;
  color: #2563eb;
}
.insert-pos-popper .ins-tag.tone-action {
  background: #ecfdf5;
  color: #059669;
}
.insert-pos-popper .ins-tag.tone-if,
.insert-pos-popper .ins-tag.tone-wait {
  background: #fff7ed;
  color: #d97706;
}
.insert-pos-popper .ins-tag.tone-end,
.insert-pos-popper .ins-tag.tone-assert {
  background: #fff1f2;
  color: #e11d48;
}
.insert-pos-popper .ins-check {
  flex-shrink: 0;
  color: #409eff;
  font-size: 14px;
}
.insert-pos-popper .el-select-dropdown__item.selected {
  background: #eff6ff;
  font-weight: inherit;
  color: inherit;
}
</style>

<style scoped>
.step-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 0;
  margin-bottom: 12px;
  background: #fff;
  overflow: hidden;
  border-top: 3px solid var(--step-color, var(--el-color-primary));
}
.step-card-if {
  border-color: #f5dab1;
}
.step-head,
.branch-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  padding: 10px 14px;
  background: var(--step-soft-bg, #f5f7fa);
  border-bottom: 1px solid var(--step-soft-border, #ebeef5);
}
.step-idx {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--step-color, var(--el-color-primary));
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.step-idx-if {
  background: #f97316;
}
.step-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.step-cat-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--step-color, #606266);
  background: #fff;
  border: 1px solid var(--step-soft-border, #ebeef5);
}
.step-code-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.step-action-btn {
  color: #909399 !important;
}
.step-action-btn:hover:not(.is-disabled) {
  color: var(--el-color-primary) !important;
}
.step-delete-btn {
  color: #909399 !important;
  font-weight: 400 !important;
}
.step-delete-btn:hover {
  color: #f56c6c !important;
}
.step-spacer {
  flex: 1;
}
.step-form {
  padding: 12px 14px 4px;
}
.step-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
.step-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  line-height: 1.3;
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}
.step-card :deep(.if-branches),
.step-card :deep(.wait-any-branches),
.step-card :deep(.dp-editor) {
  padding: 0 14px 12px;
}
.branch-box {
  margin-top: 10px;
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed var(--app-border);
  background: #fff;
}
.branch-box.then {
  border-color: #b3e19d;
  background: #f0f9eb;
}
.branch-box.else {
  border-color: #fab6b6;
  background: #fef0f0;
}
.else-msg-form {
  margin-bottom: 8px;
}
.branch-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}
.branch-tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.branch-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.branch-empty {
  font-size: 12px;
  color: #c0c4cc;
  padding: 4px 0;
}
.branch-step {
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  background: #fff;
}
.branch-idx {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.batch-order {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--app-text);
  line-height: 1.9;
  max-height: 220px;
  overflow-y: auto;
}

.batch-order li {
  padding-right: 4px;
}

</style>
