<template>
  <div class="ui-flows">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">流程编排</span>
            <p class="card-sub">支持冷启动/热启动、启动应用、点击输入，以及「元素存在判断」分支</p>
          </div>
          <el-button
            :disabled="!batchSelection.length"
            @click="openBatch"
          >批量执行{{ batchSelection.length ? `（${batchSelection.length}）` : '' }}</el-button>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>
            新建流程
          </el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-form :inline="true">
          <el-form-item label="应用">
            <el-select v-model="filterAppId" clearable filterable placeholder="选择应用" style="width: 220px">
              <el-option
                v-for="a in appOptions"
                :key="a.id"
                :label="`${a.nameZh} (${a.id})`"
                :value="a.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filterPlatform" clearable style="width: 140px">
              <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="环境">
            <el-select v-model="filterEnvironment" clearable style="width: 130px" placeholder="全部">
              <el-option label="生产环境" value="PROD" />
              <el-option label="测试环境" value="TEST" />
            </el-select>
          </el-form-item>
          <el-form-item label="用途">
            <el-select v-model="filterCatalog" clearable style="width: 190px" placeholder="全部">
              <el-option label="回归 + 自动化编排" value="SHARED" />
              <el-option label="仅自动化编排" value="AUTOMATION" />
              <el-option label="仅回归" value="ONLINE" />
              <el-option label="仅性能测试" value="PERFORMANCE" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅组件">
            <el-switch v-model="componentOnly" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadList">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table
        v-loading="loading"
        class="flow-list-table"
        :data="list"
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
        <el-table-column prop="environment" label="环境" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.environment === 'TEST' ? 'warning' : 'success'"
              effect="plain"
            >
              {{ row.environment === 'TEST' ? '测试' : '生产' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="catalog" label="用途" width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="catalogTagType(row.catalog)" effect="light">
              {{ catalogLabel(row.catalog) }}
            </el-tag>
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
        <el-table-column label="应用" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="flow-app">{{ appLabel(row.appId) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="flow-desc">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="success" link size="small" @click="openExecute(row)">执行</el-button>
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无流程，可新建一条「登录」试编排" />
    </el-card>

    <el-dialog
      v-model="execVisible"
      width="520px"
      destroy-on-close
      align-center
      class="exec-flow-dialog"
      :show-close="false"
    >
      <template #header>
        <div class="exec-dlg-header">
          <div class="exec-dlg-title">
            <span class="exec-dlg-icon"><el-icon><VideoPlay /></el-icon></span>
            <span>执行流程</span>
          </div>
          <button type="button" class="exec-dlg-close" aria-label="关闭" @click="execVisible = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </template>

      <div v-loading="execLoading" element-loading-text="正在读取设备与安装包…" class="exec-dlg-body">
        <div class="exec-info-card">
          <div class="exec-info-row">
            <div class="exec-info-label">流程</div>
            <div class="exec-info-value">{{ execFlow?.name || '—' }}</div>
          </div>
          <div class="exec-info-row">
            <div class="exec-info-label">启动配置</div>
            <div class="exec-info-value">
              <div>{{ execLaunchSummary.appLabel }}</div>
              <div class="exec-mono">{{ execLaunchSummary.packageName || '—' }}</div>
              <div v-if="execLaunchSummary.activity" class="exec-mono muted">{{ execLaunchSummary.activity }}</div>
            </div>
          </div>
        </div>

        <div class="exec-field">
          <div class="exec-field-label"><span class="req">*</span>设备</div>
          <el-select
            v-model="execForm.deviceId"
            filterable
            placeholder="选择已连接设备"
            class="exec-field-control"
            @change="onExecDeviceChange"
          >
            <el-option
              v-for="d in deviceOptions"
              :key="d.id"
              :label="`${d.name || d.id} (${d.platform || ''})`"
              :value="d.id" />
          </el-select>
          <div v-if="deviceOptions.length === 0" class="exec-hint">暂无已连接设备，请先在设备管理中连接</div>
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

        <div class="exec-runnow-card">
          <div class="exec-runnow-text">
            <div class="exec-runnow-title">立即执行</div>
            <div class="exec-runnow-sub">开启后创建任务并马上开始跑；关闭则只创建待执行任务</div>
          </div>
          <el-switch v-model="execForm.runNow" />
        </div>
      </div>

      <template #footer>
        <div class="exec-dlg-footer">
          <el-button class="exec-btn-cancel" @click="execVisible = false">取消</el-button>
          <el-button type="primary" class="exec-btn-primary" :loading="executing" @click="submitExecute">
            开始执行
          </el-button>
        </div>
      </template>
    </el-dialog>

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

    <el-drawer
      v-model="drawerVisible"
      class="ui-flow-drawer"
      size="92%"
      destroy-on-close
      append-to-body
      :close-on-click-modal="false"
      @close="onDrawerClosed"
    >
      <template #header>
        <div class="drawer-header-row">
          <span class="drawer-title">
            <template v-if="editingId">
              编辑流程
              <span v-if="form.name" class="drawer-flow-name">· {{ form.name }}</span>
            </template>
            <template v-else>新建流程</template>
          </span>
          <el-button type="primary" link class="flow-chart-btn" @click="openFlowChart">
            查看流程图
          </el-button>
        </div>
      </template>
      <!-- 元信息单独一张 form，避免包住步骤区造成 form 嵌套，浏览器会拆 DOM 导致抽屉关不掉 -->
      <el-form
        ref="formRef"
        class="flow-meta-form"
        :model="form"
        :rules="rules"
        label-position="top"
        require-asterisk-position="left"
        @submit.prevent
      >
        <el-divider content-position="left">基本信息</el-divider>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如 登录" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选，说明这条流程做什么" />
        </el-form-item>
        <div class="flow-form-row">
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                运行应用
                <el-popover placement="top" :width="340" trigger="click">
                  <template #reference>
                    <el-icon class="form-help-icon" @click.stop><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p><strong>清空</strong>表示通用流程：回归选电竞/Pog 等都会列出；卸装/启动跟当次所选 APP（应用字典包名）。</p>
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
            <button
              type="button"
              class="form-help-toggle"
              :class="{ open: helpOpen.app }"
              @click="helpOpen.app = !helpOpen.app"
            >
              ▸ 清空表示通用流程 · 点击了解更多
            </button>
            <div v-if="helpOpen.app" class="form-help-body">
              <strong>清空</strong>表示通用流程：回归选电竞/Pog 等都会列出；卸装/启动跟当次所选 APP（应用字典包名）。
              用途为「仅自动化」的流程必须绑定应用，别留空。选具体应用后，点击/输入等步骤可下拉该应用下已「选用」的元素。
            </div>
          </el-form-item>
          <el-form-item label="平台">
            <el-select
              v-model="form.platform"
              clearable
              placeholder="如 Android"
              style="width: 100%"
              @change="loadElementsForFlow"
            >
              <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
        </div>

        <el-divider content-position="left">执行配置</el-divider>
        <div class="flow-form-row">
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                环境
                <el-popover placement="top" :width="340" trigger="click">
                  <template #reference>
                    <el-icon class="form-help-icon" @click.stop><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <template v-if="linksCases">
                      <p><strong>自动化流程不绑环境</strong>——同一条流程既能跑线上包也能跑测试包，差别只在装哪个包、用哪套数据（数据在「环境变量」里按环境配，流程里写 <code v-pre>${phone}</code> 即可）。</p>
                      <p>这里选的值不参与筛选，执行时再选环境。</p>
                    </template>
                    <template v-else>
                      <p>这条流程属于哪个环境的用例。<strong>环境和用途是两回事</strong>：环境说的是「验哪个包」，用途说的是「哪个入口用」。</p>
                      <p>两个环境跑的是两批不同的流程，不会互相串。</p>
                    </template>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-radio-group v-model="form.environment">
              <el-radio-button label="PROD">生产</el-radio-button>
              <el-radio-button label="TEST">测试</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-with-help">
                用途
                <el-popover placement="top" :width="360" trigger="click">
                  <template #reference>
                    <el-icon class="form-help-icon" @click.stop><QuestionFilled /></el-icon>
                  </template>
                  <div class="form-help-pop">
                    <p>决定这条流程出现在哪个入口，<strong>不区分环境</strong>（环境单独选）：</p>
                    <p><strong>回归 + 自动化编排</strong>：既进「APP 回归」批次，也能在本页单跑——大多数用例选这个。</p>
                    <p><strong>仅自动化编排</strong>：只在本页单跑，不进回归。<u>只有这一类能关联测试用例</u>。</p>
                    <p><strong>仅回归</strong>：只进回归批次。</p>
                    <p><strong>仅性能测试</strong>：只出现在安卓性能测试。请单独建，别和回归混。</p>
                  </div>
                </el-popover>
              </span>
            </template>
            <el-select v-model="form.catalog" style="width: 100%">
              <el-option label="回归 + 自动化编排" value="SHARED" />
              <el-option label="仅自动化编排" value="AUTOMATION" />
              <el-option label="仅回归" value="ONLINE" />
              <el-option label="仅性能测试" value="PERFORMANCE" />
            </el-select>
            <button
              type="button"
              class="form-help-toggle"
              :class="{ open: helpOpen.catalog }"
              @click="helpOpen.catalog = !helpOpen.catalog"
            >
              ▸ 了解各选项区别
            </button>
            <div v-if="helpOpen.catalog" class="form-help-body">
              决定这条流程出现在哪个入口，<strong>不区分环境</strong>（环境单独选）：<br />
              <strong>回归 + 自动化编排</strong>：既进「APP 回归」的批次，也能在本页单跑调试——大多数用例选这个。<br />
              <strong>仅自动化编排</strong>：只在本页单跑，不进回归批次。<u>只有这一类能关联测试用例</u>——
              它替代的是「人工执行某条用例」，而回归验的是「这个包能不能用」，两条轨互不相干。<br />
              <strong>仅回归</strong>：只进回归批次。<br />
              <strong>仅性能测试</strong>：只出现在安卓性能测试。性能流程请单独建，别和回归用例混。
            </div>
          </el-form-item>
        </div>
        <!--
          只在用途包含「自动化编排」时显示。回归流程在验「这个包能不能用」，
          不对应任何用例——「安装+启动」硬要挂就得造一条假用例，
          而且一旦算进覆盖率，那个数字就不能看了。
        -->
        <el-form-item v-if="linksCases" label="覆盖用例">
          <el-select
            v-model="form.caseIds"
            multiple
            filterable
            clearable
            :loading="loadingCases"
            placeholder="这条流程替代了哪几条人工用例"
            style="width: 100%"
          >
            <el-option
              v-for="c in linkableCases"
              :key="c.id"
              :label="`${c.caseId || ''} ${c.title}`"
              :value="c.id"
            />
          </el-select>
          <button
            type="button"
            class="form-help-toggle"
            :class="{ open: helpOpen.cases }"
            @click="helpOpen.cases = !helpOpen.cases"
          >
            ▸ 了解覆盖规则
          </button>
          <div v-if="helpOpen.cases" class="form-help-body">
            <strong>一条流程覆盖多条用例是常态</strong>——跑一遍登录流程，顺带把手机号登录、区号选择都验了。<br />
            勾上之后那几条用例的「是否已实现自动化」就变成已覆盖，执行状态也跟着这条流程走。<br />
            列表里只有<strong>同平台、且没被别的流程占用</strong>的用例：两端用例是分开的两套，
            要把用例从别的流程转过来，请去用例那边明确改，免得原流程被悄悄抢走还没有提示。
            <template v-if="!editingId">
              <br /><strong>新建时先保存流程，再回来勾选</strong>——关联需要流程 id。
            </template>
          </div>
        </el-form-item>
        <el-form-item label="前置流程">
          <el-select
            v-model="form.dependsOn"
            multiple
            filterable
            clearable
            placeholder="留空＝无前置。批量执行时会自动排在本流程之前"
            style="width: 100%"
          >
            <el-option
              v-for="f in dependencyCandidates"
              :key="f.id"
              :label="f.name"
              :value="f.id"
            />
          </el-select>
          <button
            type="button"
            class="form-help-toggle"
            :class="{ open: helpOpen.deps }"
            @click="helpOpen.deps = !helpOpen.deps"
          >
            ▸ 前置与「调用组件」的区别
          </button>
          <div v-if="helpOpen.deps" class="form-help-body">
            批量执行时，前置会自动排到本流程之前；<strong>多条用例依赖同一个前置，一批里只跑一次</strong>。
            没勾的前置也会被自动补进来。<br />
            跟「调用组件」的区别：调用组件是<strong>本流程的一部分</strong>，每次执行都跑（清弹窗、切 tab）；
            前置流程是<strong>执行前提</strong>，一批里满足一次就够（装包、登录）。
          </div>
        </el-form-item>
        <div class="flow-form-row flow-form-row-switches">
          <el-form-item label="存为组件">
            <el-switch v-model="form.isComponent" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <span class="form-label-with-help">
              排序
              <el-popover placement="top" :width="300" trigger="click">
                <template #reference>
                  <el-icon class="form-help-icon" @click.stop><QuestionFilled /></el-icon>
                </template>
                <div class="form-help-pop">
                  回归批次里的列表与执行顺序，数字越小越靠前（默认 100）。装包、登录这类前置流程排最前，后面的流程直接复用设备上的状态。
                </div>
              </el-popover>
            </span>
          </template>
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">步骤</el-divider>
      <p class="steps-section-hint">从上到下执行 · 编号 1 / 1.1 / 1.1.1 表示归属</p>

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
          <!--
            插入位置就放在添加区：调试时常常是「第 8 步后要补一步」，
            让人先滚到第 8 步点按钮、再滚回来选关键字，比加到最后一路上移还烦。
          -->
          <el-select
            v-model="insertSelIdx"
            placeholder="插入位置"
            class="insert-pos-select"
            filterable
            style="width: 280px"
            :disabled="!insertPoints.length"
            popper-class="insert-pos-popper"
          >
            <el-option :value="null" label="追加到末尾（默认）" />
            <el-option
              v-for="(p, i) in insertPoints"
              :key="i"
              :value="i"
              :label="`插到 ${insertPointLabel(p)} 之后`"
            >
              <div class="insert-opt">
                <span class="insert-opt-left" :style="{ paddingLeft: p.depth * 12 + 'px' }">
                  插到 <b>{{ p.no }}</b
                  ><span v-if="p.branch" style="color: #faad14">（{{ p.branch }}）</span> 之后
                </span>
                <span class="insert-opt-right" :title="stepFullLabel(p.step)">
                  {{ stepBriefLabel(p.step) }}
                </span>
              </div>
            </el-option>
          </el-select>
          <el-button type="primary" @click="addStep">{{ insertButtonText }}</el-button>
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
        <div class="keyword-quick">
          <span class="keyword-quick-label">常用</span>
          <el-button
            v-for="k in quickKeywordsPrimary"
            :key="k.code"
            size="small"
            round
            :title="`${k.nameZh} (${k.code})`"
            @click="quickAdd(k.code)"
          >
            {{ quickKeywordLabel(k) }}
          </el-button>
          <template v-if="quickKeywordsMore.length">
            <el-button
              v-if="!quickMoreOpen"
              size="small"
              round
              class="keyword-more-btn"
              @click="quickMoreOpen = true"
            >
              更多…
            </el-button>
            <template v-else>
              <el-button
                v-for="k in quickKeywordsMore"
                :key="k.code"
                size="small"
                round
                :title="`${k.nameZh} (${k.code})`"
                @click="quickAdd(k.code)"
              >
                {{ quickKeywordLabel(k) }}
              </el-button>
              <el-button size="small" round class="keyword-more-btn" @click="quickMoreOpen = false">
                收起
              </el-button>
            </template>
          </template>
        </div>

        <div v-if="steps.length === 0" class="steps-empty">暂无步骤，请从上方添加关键字或插入模板</div>

        <div
          v-for="(step, idx) in steps"
          :key="step._key || 'step-' + idx"
          class="step-card"
          :class="`step-card-${stepTone(step.keywordCode).category.toLowerCase()}`"
          :style="stepToneStyle(step.keywordCode)"
        >
          <div class="step-head">
            <span class="step-idx">{{ idx + 1 }}</span>
            <span class="step-name">{{ keywordName(step.keywordCode) }}</span>
            <span class="step-cat-tag">{{ stepTone(step.keywordCode).categoryLabel }}</span>
            <el-tag size="small" type="info" effect="plain" class="step-code-tag">{{ step.keywordCode }}</el-tag>
            <span v-if="step.description" class="step-desc-inline" :title="step.description">{{ step.description }}</span>
            <span class="step-spacer" />
            <el-button link size="small" class="step-action-btn" @click="setInsertAfter(step)">在此后插入</el-button>
            <el-button link size="small" class="step-action-btn" :disabled="idx === 0" @click="moveStep(idx, -1)">上移</el-button>
            <el-button link size="small" class="step-action-btn" :disabled="idx === steps.length - 1" @click="moveStep(idx, 1)">下移</el-button>
            <el-button link size="small" class="step-delete-btn" @click="removeStep(idx)">删除</el-button>
          </div>

          <el-form label-position="top" class="step-form">
            <el-form-item label="描述">
              <el-input
                v-model="step.description"
                maxlength="120"
                show-word-limit
                placeholder="这步干什么，如：点击「同意」按钮"
              />
            </el-form-item>
            <el-form-item label="期望">
              <el-input
                v-model="step.expectation"
                maxlength="120"
                show-word-limit
                placeholder="给人看的预期，如：进入验证码页（不等于断言，不会自动失败）"
              />
            </el-form-item>
            <el-form-item v-if="needsElement(step.keywordCode)" :label="elementFieldLabel(step.keywordCode)">
              <ElementKeySelect
                v-model="step.elementKey"
                :elements="elementOptions"
                :pages="flowPageOptions"
                :placeholder="elementSelectPlaceholder"
              />
              <div class="element-pick-actions">
                <!--
                  两端会有同名元素（warm_tip 安卓一个、iOS 一个），
                  光看名字分不出这条是哪端的。列表本来就按流程平台筛过了，
                  但不写出来人没法确认——只能凭感觉，而凭感觉迟早会挂错端。
                -->
                <span class="element-scope">{{ elementScopeHint }}</span>
                <el-button link type="primary" @click="goDeviceInspect(step)">记不住？真机点选</el-button>
                <el-button link @click="loadElementsForFlow">刷新列表</el-button>
              </div>
              <div v-if="!form.appId || !form.platform" class="exec-hint" style="margin-top: 6px">
                请先选择「运行应用」和「平台」，再按「页面 → 元素」选择（展示中文名，保存用英文 key）。
              </div>
            </el-form-item>
            <el-form-item v-if="step.keywordCode === 'IF_ELEMENT_EXISTS'" label="探测超时">
              <el-input-number v-model="step.params.timeoutSec" :min="1" :max="60" />
              <span class="exec-hint" style="margin-left: 8px">秒</span>
            </el-form-item>
            <!-- 启动 / 冷启动 / 热启动：表单按流程平台渲染，iOS 不显示 appActivity -->
            <LaunchStepFields
              v-if="isLaunchLikeStep(step.keywordCode)"
              :step="step"
              :app-options="appOptions"
              :platform="form.platform"
              @app-selected="onLaunchAppSelected"
            />
            <template v-if="isInstallStep(step.keywordCode)">
              <el-form-item label="安装方式">
                <el-select v-model="step.params.installMode" style="width: 100%">
                  <el-option label="渠道页 / 应用商店（默认）" value="CHANNEL_PAGE" />
                  <el-option label="蒲公英下载安装" value="PGYER" />
                  <el-option label="已上传本地 APK" value="LOCAL_APK" />
                  <el-option label="扫码辅助安装（人机）" value="QR_ASSIST" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="step.params.installMode === 'CHANNEL_PAGE'" label="渠道页 URL">
                <el-input
                  v-model="step.params.channelUrl"
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
              <template v-if="step.params.installMode === 'PGYER'">
                <el-form-item label="版本">
                  <div class="install-note">
                    这里不用填。<b>执行流程时会列出最近 5 个版本让你选</b>，默认最新的一个。
                    <span v-if="!pgyerReady(step)">
                      需要先在「应用字典」为该应用配置蒲公英 appKey。
                    </span>
                  </div>
                </el-form-item>
                <el-form-item label=" ">
                  <el-button link type="primary" size="small" @click="toggleInstallAdvanced(step)">
                    {{ showInstallAdvanced(step) ? '收起高级设置' : '高级设置（固定版本 / 自定义直链）' }}
                  </el-button>
                </el-form-item>
                <template v-if="showInstallAdvanced(step)">
                  <el-form-item label="固定 buildKey">
                    <el-input
                      v-model="step.params.pgyerBuildKey"
                      clearable
                      placeholder="留空即可；填了会锁死装这个版本，每次发版都要来改" />
                  </el-form-item>
                  <el-form-item label="APK/IPA 直链">
                    <el-input
                      v-model="step.params.pgyerUrl"
                      clearable
                      placeholder="留空即可；只接受以 .apk / .ipa 结尾的直链" />
                    <div class="install-note warn">
                      不要填蒲公英的应用页面链接（如 pgyer.com/pwesports）——那是一张网页，
                      下载下来不是安装包
                    </div>
                  </el-form-item>
                </template>
              </template>
              <template v-if="step.params.installMode === 'LOCAL_APK'">
                <el-form-item label="上传应用 ID">
                  <el-input v-model="step.params.apkArtifactId" clearable placeholder="applications 表记录 ID" />
                </el-form-item>
                <el-form-item label="本地路径">
                  <el-input v-model="step.params.apkPath" clearable placeholder="可选：服务器上的 apk 绝对路径" />
                </el-form-item>
              </template>
              <el-form-item v-if="step.params.installMode === 'QR_ASSIST'" label="扫码页 URL">
                <el-input
                  v-model="step.params.qrPayload"
                  clearable
                  placeholder="https 安装页；执行日志会展示二维码，人工扫码后轮询包名"
                />
              </el-form-item>
              <el-form-item label="安装前卸载">
                <el-switch v-model="step.params.uninstallFirst" />
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
              v-if="!isCustomUiKeyword(step.keywordCode)"
              :schema="keywordSchema(step.keywordCode)"
              :params="step.params"
              :element-options="elementOptions"
              :page-options="flowPageOptions"
            />
          </el-form>

          <!-- 清理已知弹窗：列表式，出现哪个关哪个 -->
          <DismissPopupsEditor
            v-if="step.keywordCode === 'DISMISS_POPUPS'"
            :step="step"
            :element-options="elementOptions"
            :page-options="flowPageOptions"
            @refresh-elements="loadElementsForFlow"
          />

          <!-- 竞速等待：多候选，谁先出现走谁 -->
          <WaitAnyBranchEditor
            v-if="step.keywordCode === 'WAIT_ANY'"
            :step="step"
            :path-prefix="String(idx + 1)"
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
            :nest-level="0"
            @inspect="goDeviceInspect"
            @refresh-elements="loadElementsForFlow"
          />

          <!-- 元素存在判断：存在 / 不存在 两支（支持嵌套） -->
          <IfBranchEditor
            v-if="step.keywordCode === 'IF_ELEMENT_EXISTS'"
            :step="step"
            :path-prefix="String(idx + 1)"
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
            :nest-level="0"
            @inspect="goDeviceInspect"
            @refresh-elements="loadElementsForFlow"
          />
        </div>
      <template #footer>
        <el-button type="button" @click="closeDrawer">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存流程</el-button>
      </template>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import KeywordParamFields from '../components/KeywordParamFields.vue'
import ElementKeySelect from '../components/ElementKeySelect.vue'
import WaitAnyBranchEditor from './WaitAnyBranchEditor.vue'
import DismissPopupsEditor from './DismissPopupsEditor.vue'
import LaunchStepFields from './LaunchStepFields.vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowDown, Close, Plus, QuestionFilled, VideoPlay } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { stepColorByCode, stepColorStyle } from '@/utils/stepKeywordColor'
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

/** 关键字已按平台合并，编排时不用再选端——平台由任务/设备决定。前 10 个常显，其余进「更多…」 */
const QUICK_CODES = [
  'COLD_START',
  'HOT_START',
  'LAUNCH_APP',
  'CLICK',
  'INPUT',
  'WAIT_ELEMENT',
  'SWIPE',
  'SCREENSHOT',
  'IF_ELEMENT_EXISTS',
  'WAIT',
  'UNINSTALL_APP',
  'INSTALL_APP',
  'DISMISS_POPUPS',
  'WAIT_ANY',
  'RETURN_MESSAGE',
  'SCROLL_UNTIL',
  'BACK',
  'GO_HOME',
  'ASSERT_NO_ERROR'
]
const QUICK_PRIMARY_COUNT = 10

/** 常用条太挤时用短名，悬停仍看完整中文+code */
const QUICK_SHORT_LABEL: Record<string, string> = {
  GO_HOME: '回主屏',
  IF_ELEMENT_EXISTS: '元素存在判断',
  DISMISS_POPUPS: '清弹窗',
  WAIT_ANY: '竞速等待',
  ASSERT_NO_ERROR: '无报错'
}

function quickKeywordLabel(k: { code?: string; nameZh?: string }) {
  const code = String(k.code || '')
  return QUICK_SHORT_LABEL[code] || k.nameZh || code
}

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

const filterAppId = ref('')
const filterPlatform = ref('')
const filterCatalog = ref('')
/** 空＝全部环境。默认不过滤，免得新人以为用例丢了 */
const filterEnvironment = ref('')
const componentOnly = ref(false)
const loading = ref(false)
const list = ref<any[]>([])
const deviceOptions = ref<any[]>([])
const execVisible = ref(false)
/** 弹窗先开、内容后到时的骨架态：设备枚举走 adb/idevice_id，蒲公英列表要发网络请求 */
const execLoading = ref(false)

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
const execForm = reactive({
  deviceId: '',
  runNow: true,
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

const quickKeywords = computed(() => {
  const map = new Map(keywords.value.map((k) => [k.code, k]))
  return QUICK_CODES.map((code) => map.get(code)).filter(Boolean) as any[]
})
const quickKeywordsPrimary = computed(() => quickKeywords.value.slice(0, QUICK_PRIMARY_COUNT))
const quickKeywordsMore = computed(() => quickKeywords.value.slice(QUICK_PRIMARY_COUNT))
const quickMoreOpen = ref(false)
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
function catalogLabel(c: string) {
  if (c === 'AUTOMATION') return '仅自动化'
  if (c === 'ONLINE') return '仅回归'
  if (c === 'PERFORMANCE') return '仅性能'
  if (c === 'SHARED') return '回归+自动化'
  return c || '—'
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
      componentOnly: componentOnly.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行 schema_ui_assets.sql）')
    list.value = []
  } finally {
    loading.value = false
  }
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

function closeDrawer() {
  drawerVisible.value = false
}

function onDrawerClosed() {
  // destroy-on-close 后清理，避免残留状态影响下次打开
  saving.value = false
  flowChartVisible.value = false
  quickMoreOpen.value = false
  helpOpen.app = false
  helpOpen.catalog = false
  helpOpen.cases = false
  helpOpen.deps = false
  highlightFlowId.value = ''
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
  caseIds: [] as number[],
  environment: 'PROD',
  dependsOn: [] as string[],
  isComponent: false,
  enabled: true,
  sortOrder: 100
})
/**
 * 只有「仅自动化编排」的流程才谈覆盖用例。
 * 回归是独立的一套——「回归 + 自动化编排」也进回归批次，属于回归那边，不关联用例。
 */
const linksCases = computed(() => form.catalog === 'AUTOMATION')
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
  insertAfterStep.value = null
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
    dependsOn: [],
    isComponent: false,
    enabled: true,
    sortOrder: 100
  })
  steps.value = []
  insertAfterStep.value = null
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
    environment: row.environment === 'TEST' ? 'TEST' : 'PROD',
    dependsOn: parseDependsOn(row.dependsOn),
    isComponent: !!row.isComponent,
    enabled: row.enabled !== false,
    sortOrder: row.sortOrder ?? 100,
    caseIds: []
  })
  await loadMeta()
  loadLinkableCases()
  steps.value = parseSteps(row.steps)
  insertAfterStep.value = null
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
 * 新步骤插到哪一步之后。null＝追加到末尾（默认，跟以前行为一致）。
 * <p>
 * 存的是<b>步骤对象本身</b>而不是下标：下标会被上移/下移/删别的步骤搞错位，
 * 而对象引用在这些操作里始终是同一个，「插到这一步之后」永远指同一步。
 */
const insertAfterStep = ref<any | null>(null)

/** 一个可插入位置：某个步骤，以及它所在的容器（顶层数组，或某个分支的子步骤数组） */
interface InsertPoint {
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
    out.push({ step: st, no, branch, depth, container, index: i })
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

/** el-select 用下标绑定；getter 每次现算，锚点步骤被移动后下拉跟着显示新位置 */
const insertSelIdx = computed<number | null>({
  get() {
    if (!insertAfterStep.value) return null
    const i = insertPoints.value.findIndex((p) => p.step === insertAfterStep.value)
    return i >= 0 ? i : null
  },
  set(i) {
    insertAfterStep.value = i == null ? null : insertPoints.value[i]?.step || null
  }
})

function insertPointLabel(p: InsertPoint) {
  return p.branch ? p.no + '（' + p.branch + '）' : p.no
}

const insertButtonText = computed(() => {
  const i = insertSelIdx.value
  if (i == null) return '添加步骤'
  const p = insertPoints.value[i]
  return p ? '插到 ' + insertPointLabel(p) + ' 之后' : '添加步骤'
})

function setInsertAfter(step: any) {
  insertAfterStep.value = step
  const p = insertPoints.value.find((x) => x.step === step)
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

function insertStep(step: any) {
  const anchor = insertAfterStep.value
  if (!anchor) {
    steps.value.push(step)
    return
  }
  const point = insertPoints.value.find((p) => p.step === anchor)
  const arr = point ? resolveContainer(point.container) : null
  if (!point || !arr) {
    // 锚点那一步被删了（可能是在分支编辑器里删的，这边收不到通知）
    steps.value.push(step)
    insertAfterStep.value = null
    ElMessage.warning('原来的插入位置已不存在，本步已追加到末尾')
    return
  }
  arr.splice(point.index + 1, 0, step)
  // 连着插几步时顺次往后排，而不是每次都插在同一个位置倒着堆
  insertAfterStep.value = step
}

function removeStep(idx: number) {
  const removed = steps.value[idx]
  steps.value.splice(idx, 1)
  if (insertAfterStep.value === removed) insertAfterStep.value = null
}

function addStep() {
  const code = addKeywordCode.value
  if (!code) {
    ElMessage.warning('请先选择关键字')
    return
  }
  insertStep(createStep(code))
}

function quickAdd(code: string) {
  addKeywordCode.value = code
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
      await apiClient.createUiFlow(body)
      ElMessage.success('已创建')
    }
    drawerVisible.value = false
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

async function openExecute(row: any) {
  execFlow.value = row
  execForm.deviceId = ''
  execForm.runNow = true
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
      loadConnectedDevices()
    ])

    // 这两步依赖设备结果，只能放在后面
    if (deviceOptions.value.length === 1) {
      execForm.deviceId = deviceOptions.value[0].id
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
  const device = deviceOptions.value.find((d) => d.id === execForm.deviceId)
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
    try {
      await ElMessageBox.confirm(
        '当前您选择的是<span style="color:#ff4d4f;font-weight:700">生产环境</span>',
        '生产环境提醒',
        {
          type: 'error',
          dangerouslyUseHTMLString: true,
          confirmButtonText: '仍要执行',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger'
        }
      )
    } catch {
      return
    }
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
      runNow: execForm.runNow
    })
    ElMessage.success(res.message || '已开始执行')
    execVisible.value = false
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

const route = useRoute()
const router = useRouter()
/** 从外链跳入编辑时高亮列表行 */
const highlightFlowId = ref('')

function flowRowClassName({ row }: { row: any }) {
  return row?.id && row.id === highlightFlowId.value ? 'flow-row-highlight' : ''
}

/** 支持 /ui-flows?edit=<flowId>&name=xxx：从 APP 回归等入口点芯片跳进编辑 */
async function openEditFromQuery() {
  const editId = String(route.query.edit || '').trim()
  if (!editId) return
  const hintName = String(route.query.name || '').trim()
  try {
    let row = list.value.find((f) => f.id === editId)
    if (!row) {
      row = await apiClient.getUiFlow(editId)
    }
    if (!row?.id) {
      ElMessage.warning(`未找到流程：${hintName || editId}`)
      return
    }
    // 把筛选对齐到这条流程，列表里也能对上是哪一条
    if (row.appId) filterAppId.value = row.appId
    if (row.platform) filterPlatform.value = row.platform
    if (row.environment === 'TEST' || row.environment === 'PROD') {
      filterEnvironment.value = row.environment
    }
    filterCatalog.value = ''
    componentOnly.value = false
    await loadList()
    highlightFlowId.value = row.id
    await openEdit(row)
    ElMessage.success(`正在编辑：${row.name || hintName || row.id}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '打开流程失败')
  } finally {
    const q = { ...route.query }
    delete q.edit
    delete q.name
    await router.replace({ query: q })
  }
}

watch(
  () => route.query.edit,
  async (id) => {
    if (id) await openEditFromQuery()
  }
)

onMounted(async () => {
  await loadMeta()
  await loadList()
  await openEditFromQuery()
})
</script>

<style scoped>
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
.steps-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.template-dropdown-trigger {
  display: inline-flex;
}
.keyword-quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.keyword-quick-label {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-right: 2px;
}
.keyword-more-btn {
  color: var(--el-color-primary) !important;
  border-color: var(--el-color-primary-light-5) !important;
  background: #ecf5ff !important;
}
.steps-section-hint {
  margin: -8px 0 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}
.flow-meta-form :deep(.el-form-item) {
  margin-bottom: 14px;
}
.flow-meta-form :deep(.el-form-item__label) {
  margin-bottom: 6px;
  line-height: 1.3;
  color: #606266;
  font-weight: 500;
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
.drawer-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding-right: 28px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
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
.exec-info-card {
  border-radius: 10px;
  background: #f5f7fa;
  overflow: hidden;
}
.exec-info-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  padding: 12px 14px;
}
.exec-info-row + .exec-info-row {
  border-top: 1px solid #ebeef5;
}
.exec-info-label {
  color: #909399;
  font-size: 13px;
  line-height: 1.5;
  padding-top: 1px;
}
.exec-info-value {
  color: #303133;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
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
.exec-runnow-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f5f7fa;
}
.exec-runnow-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}
.exec-runnow-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.exec-dlg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
.ui-flow-drawer .flow-chart-btn {
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
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
.insert-pos-popper .insert-opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.insert-pos-popper .insert-opt-left {
  flex: 0 0 9em;
  white-space: nowrap;
}
.insert-pos-popper .insert-opt-right {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
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
