<template>
  <div class="automation-test">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="card-title">自动化测试</span>
        </div>
      </template>
      <el-tabs v-model="activeTab" type="border-card">
        <!-- 可执行场景：平台折叠 → 模块折叠 → 场景表格 -->
        <el-tab-pane label="可执行场景" name="scenarios">
          <div class="section-desc">选择场景后点击「执行」，指定设备与应用即可创建并运行任务。</div>
          <div class="scenario-toolbar">
            <span class="scenario-toolbar-label">平台筛选</span>
            <el-select
              v-model="scenarioPlatformFilter"
              placeholder="全部平台"
              clearable
              style="width: 200px"
            >
              <el-option label="Android" value="ANDROID" />
              <el-option label="iOS" value="IOS" />
              <el-option label="HarmonyOS" value="HARMONYOS" />
              <el-option label="Pog-Android" value="POG_ANDROID" />
              <el-option label="Pog-iOS" value="POG_IOS" />
            </el-select>
          </div>
          <div v-loading="scenariosLoading" class="scenarios-by-platform">
            <el-collapse v-if="displayedScenarioGroups.length" accordion>
              <el-collapse-item
                v-for="group in displayedScenarioGroups"
                :key="group.platform"
                :name="group.platform"
              >
                <template #title>
                  <span class="collapse-title">{{ group.platformLabel }}</span>
                  <el-tag size="small" type="info" class="collapse-count">
                    {{ group.modules.reduce((sum, m) => sum + m.scenarios.length, 0) }} 个场景
                  </el-tag>
                </template>
                <el-collapse v-if="group.modules.length" class="scenarios-inner-collapse">
                  <el-collapse-item
                    v-for="mod in group.modules"
                    :key="`${group.platform}-${mod.moduleKey}`"
                    :name="`${group.platform}-${mod.moduleKey}`"
                  >
                    <template #title>
                      <span class="collapse-title inner">{{ mod.moduleName }}</span>
                      <el-tag size="small" type="info" class="collapse-count">{{ mod.scenarios.length }} 个场景</el-tag>
                    </template>
                    <el-table
                      :data="mod.scenarios"
                      stripe
                      class="scenarios-table"
                      :header-cell-style="{ background: 'var(--el-fill-color-light)' }"
                    >
                      <el-table-column prop="id" label="场景 ID" min-width="200" show-overflow-tooltip />
                      <el-table-column prop="name" label="场景名称" min-width="160" show-overflow-tooltip />
                      <el-table-column prop="platform" label="平台" width="120">
                        <template #default="{ row }">
                          <el-tag size="small" :type="platformTagType(row.platform)">{{ platformLabel(row.platform) }}</el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column prop="taskType" label="任务类型" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">
                          {{ taskTypeLabel(row.taskType) }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
                      <el-table-column label="操作" width="120">
                        <template #default="{ row }">
                          <el-button type="primary" size="small" @click="openExecuteDialog(row)">执行</el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-collapse-item>
                </el-collapse>
                <el-empty v-else description="暂无测试场景" />
              </el-collapse-item>
            </el-collapse>
            <el-empty v-else-if="!scenariosLoading" description="暂无场景" />
          </div>
        </el-tab-pane>

        <!-- 定时计划 -->
        <el-tab-pane label="定时计划" name="plans">
          <div class="section-desc">配置到点自动执行某场景，或立即触发一次执行。</div>
          <el-alert
            v-if="plansLoadError"
            type="warning"
            :title="plansLoadError"
            show-icon
            closable
            class="section-alert" />
          <div class="section-toolbar">
            <el-button type="primary" @click="openPlanDialog">
              <el-icon><Plus /></el-icon>
              新建计划
            </el-button>
          </div>
          <el-table
            v-loading="plansLoading"
            :data="testPlans"
            stripe
            style="width: 100%"
           :header-cell-style="{ background: 'var(--el-fill-color-light)' }"
          >
            <el-table-column prop="name" label="计划名称" min-width="140" />
            <el-table-column prop="cronExpression" label="Cron" width="140" show-overflow-tooltip />
            <el-table-column prop="scenarioId" label="场景" width="140" />
            <el-table-column prop="enabled" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                  {{ row.enabled ? '已启用' : '已禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="triggerPlan(row.id)">立即执行</el-button>
                <el-button type="primary" link size="small" @click="togglePlanEnabled(row)">
                  {{ row.enabled ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!plansLoading && testPlans.length === 0" description="暂无定时计划" />
        </el-tab-pane>

        <!-- Android 设置测试直调（对接 automation-service，展示应用启动测试数据） -->
        <el-tab-pane label="设置测试直调" name="settingsDirect">
          <div class="section-desc">直调 Android 设置测试接口，执行完成后展示步骤列表及「应用启动测试」数据（加载完成时延、白屏时长）。单次执行约 1～3 分钟，请求超时 120 秒。</div>
          <el-card class="settings-direct-card" shadow="never">
            <template #header>
              <span>Android 设置测试</span>
              <el-button link type="primary" size="small" :loading="settingsHealthLoading" @click="checkAndroidSettingsHealth" style="margin-left: 12px">健康检查</el-button>
            </template>
            <el-form :model="settingsDirectForm" label-width="120px" class="settings-direct-form">
              <el-form-item label="设备 ID">
                <el-input v-model="settingsDirectForm.deviceId" placeholder="默认 AQD68LRCYPNBY5MB" clearable style="width: 320px" />
              </el-form-item>
              <el-form-item label="Appium 地址">
                <el-input v-model="settingsDirectForm.appiumServerUrl" placeholder="默认 http://localhost:4724" clearable style="width: 320px" />
              </el-form-item>
              <el-form-item label="包名">
                <el-input v-model="settingsDirectForm.packageName" placeholder="默认 com.pwrd.steam.esports" clearable style="width: 320px" />
              </el-form-item>
              <el-form-item label="系统版本">
                <el-input v-model="settingsDirectForm.platformVersion" placeholder="默认 13" clearable style="width: 120px" />
              </el-form-item>
              <el-form-item label="设备展示名">
                <el-input v-model="settingsDirectForm.deviceName" placeholder="可选，默认 Android设备-{deviceId}" clearable style="width: 320px" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="settingsExecuteLoading" @click="runAndroidSettingsTest">执行 Android 设置测试</el-button>
              </el-form-item>
            </el-form>
            <div v-if="settingsExecuteResult !== null" class="settings-direct-result">
              <el-alert v-if="settingsExecuteResult.code !== 200" type="error" :title="settingsExecuteResult.message || '执行失败'" show-icon />
              <template v-else>
                <div class="settings-test-data" v-if="settingsExecuteTestData">
                  <h4>应用启动测试</h4>
                  <el-descriptions :column="1" border size="small">
                    <el-descriptions-item label="加载完成时延">{{ formatSettingsDelay(settingsExecuteTestData.loadingCompletionDelayMs) }}</el-descriptions-item>
                    <el-descriptions-item label="白屏时长">{{ formatSettingsDelay(settingsExecuteTestData.whiteScreenDurationMs) }}</el-descriptions-item>
                  </el-descriptions>
                </div>
                <h4 style="margin-top: 16px">步骤列表</h4>
                <el-table v-if="settingsExecuteSteps?.length" :data="settingsExecuteSteps" stripe size="small" max-height="320" class="settings-steps-table" :header-cell-style="{ background: 'var(--el-fill-color-light)' }">
                  <el-table-column prop="stepName" label="步骤" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="status" label="状态" width="90">
                    <template #default="{ row }">
                      <el-tag :type="row.status === 'success' || row.status === 'passed' ? 'success' : row.status === 'fail' || row.status === 'failed' ? 'danger' : 'info'" size="small">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="duration" label="耗时(ms)" width="100" />
                  <el-table-column prop="errorMessage" label="错误信息" min-width="160" show-overflow-tooltip />
                </el-table>
                <p v-else class="settings-no-steps">无步骤数据</p>
              </template>
            </div>
          </el-card>
        </el-tab-pane>

        <!-- 任务列表（筛选 + 卡片展示，参考 DevEco 测试任务） -->
        <el-tab-pane label="任务列表" name="taskList">
          <div class="task-list-toolbar">
            <div class="task-list-filters">
              <el-radio-group v-model="taskListFilters.days" size="small" @change="onTaskListFilterChange" class="time-tabs">
                <el-radio-button :value="0">全部</el-radio-button>
                <el-radio-button :value="3">近三天</el-radio-button>
                <el-radio-button :value="7">近一周</el-radio-button>
              </el-radio-group>
              <el-input
                v-model="taskListFilters.keyword"
                placeholder="任务名或备注"
                size="small"
                clearable
                class="filter-keyword-input"
                @keyup.enter="loadTaskList"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select
                v-model="taskListFilters.serviceType"
                placeholder="请选择服务类型"
                size="small"
                clearable
                class="filter-service-select"
              >
                <el-option label="功能体验基础质量测试" value="FUNCTIONAL_QUALITY_TEST" />
                <el-option label="性能指标监控测试" value="PERFORMANCE_MONITORING_TEST" />
                <el-option label="稳定性基础质量测试" value="STABILITY_QUALITY_TEST" />
                <el-option label="全部" :value="''" />
              </el-select>
              <el-select
                v-model="taskListFilters.status"
                placeholder="选择任务状态"
                size="small"
                clearable
                class="filter-status-select"
                @change="onTaskListFilterChange"
              >
                <el-option label="全部状态" :value="''" />
                <el-option label="完成" value="COMPLETED" />
                <el-option label="停止" value="STOPPED" />
                <el-option label="运行中" value="RUNNING" />
                <el-option label="待运行" value="PENDING" />
                <el-option label="失败" value="FAILED" />
              </el-select>
              <el-button type="primary" size="small" @click="onTaskListFilterChange">筛选</el-button>
            </div>
            <el-button type="danger" size="small" class="delete-report-btn" @click="onDeleteReportClick">
              删除报告
            </el-button>
          </div>
          <div v-loading="taskListLoading" class="task-list-cards">
            <el-row :gutter="16">
              <el-col
                v-for="t in taskList"
                :key="getTaskId(t)"
                :xs="24"
                :sm="12"
                :md="8"
                :lg="6"
              >
                <el-card class="task-card task-card-ref" shadow="hover">
                  <div class="task-card-inner">
                    <div class="task-card-content" @click="viewTaskDetail(t)">
                      <div class="task-card-head">
                        <el-icon class="task-card-icon"><Document /></el-icon>
                        <span class="task-card-id">{{ formatTaskId(getTaskId(t)) }}</span>
                        <el-tag size="small" :type="taskStatusTagType(t.status)" class="task-card-status">
                          {{ taskStatusText(t.status) }}
                        </el-tag>
                      </div>
                      <div class="task-card-body">
                        <div class="task-card-row">
                          <span class="label">任务类型</span>
                          <span class="value">{{ taskDisplayTitle(t) }}</span>
                        </div>
                        <div class="task-card-row">
                          <span class="label">测试服务</span>
                          <span class="value">{{ t.taskName || '—' }}</span>
                        </div>
                        <div class="task-card-row">
                          <span class="label">设备名称</span>
                          <span class="value">{{ t.deviceName || t.deviceId || '—' }}</span>
                        </div>
                        <div class="task-card-row">
                          <span class="label">创建时间</span>
                          <span class="value">{{ formatTaskTime(t.createdAt) }}</span>
                        </div>
                        <div class="task-card-row">
                          <span class="label">备注信息</span>
                          <span class="value remark">{{ t.remarks || '—' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="task-card-footer" @click.stop>
                      <el-button type="primary" size="small" link @click.prevent="viewTaskDetail(t)">查看详情</el-button>
                      <el-button type="danger" size="small" link @click.prevent="deleteTaskFromList(getTaskId(t))">删除</el-button>
                    </div>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </div>
          <div v-if="taskListTotal > 0" class="task-list-pagination">
            <el-pagination
              v-model:current-page="taskListPage"
              v-model:page-size="taskListSize"
              :page-sizes="[10, 20, 50]"
              :total="taskListTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadTaskList"
              @size-change="loadTaskList" />
          </div>
          <el-empty v-if="!taskListLoading && taskList.length === 0" description="暂无任务" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 执行场景对话框 -->
    <el-dialog
      v-model="executeDialogVisible"
      title="执行场景"
      width="520px"
      destroy-on-close
      @close="resetExecuteForm"
    >
      <el-form ref="executeFormRef" :model="executeForm" label-width="100px">
        <el-form-item label="场景">
          <div class="execute-scenario-head">
            <span class="execute-scenario-name">{{ executeScenario?.name }}</span>
          </div>
        </el-form-item>
        <el-form-item v-if="executeScenarioResolvedId" label="场景 ID">
          <code class="execute-scenario-id">{{ executeScenarioResolvedId }}</code>
          <div class="form-hint">提交执行时使用上述 id，须与接口返回列表中的场景 id 完全一致。</div>
        </el-form-item>
        <el-form-item label="设备" required>
          <el-select
            v-model="executeForm.deviceId"
            placeholder="请选择设备"
            style="width: 100%"
            filterable
            :loading="devicesLoading"
            @change="onExecuteDeviceChange"
          >
            <el-option
              v-for="d in executeDevices"
              :key="d.id"
              :label="`${d.name || d.id} (${d.version || ''})`"
              :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="应用" required>
          <div class="execute-app-row">
            <el-select
              v-model="executeForm.applicationId"
              placeholder="请先选择设备，再选该设备上已安装应用"
              class="execute-app-select"
              filterable
              :loading="appsLoading"
              :disabled="!executeForm.deviceId"
            >
              <el-option
                v-for="a in executeApps"
                :key="a.id"
                :label="a.packageName || a.id"
                :value="a.id" />
            </el-select>
            <el-button
              type="primary"
              link
              :loading="appsLoading"
              :disabled="!executeForm.deviceId"
              title="从设备重新拉取应用列表（含新装应用）"
              @click="loadExecuteApps(true)"
            >
              刷新
            </el-button>
          </div>
          <div class="form-hint">applicationId 为所选设备上已安装应用的 id；应用池由后端按场景 platform 与所选设备对齐，无需前端合并请求。</div>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="executeForm.phoneNumber"
            placeholder="登录用手机号，默认 12312340002"
            clearable />
        </el-form-item>
        <el-form-item label="验证码">
          <el-input
            v-model="executeForm.verificationCode"
            placeholder="验证码，默认 521758"
            clearable />
          <div class="form-hint">推荐填写手机号与验证码，多机时每次可传不同值；未填时使用后端默认值。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="executeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="executeSubmitting" @click="submitExecute">执行</el-button>
      </template>
    </el-dialog>

    <!-- 执行结果提示（含轮询状态、成功/失败、停止） -->
    <el-dialog
      v-model="executeResultVisible"
      title="执行结果"
      width="480px"
      :close-on-click-modal="false"
      @close="stopPolling"
    >
      <p v-if="executeResultTaskId" class="execute-result-task">
        任务 ID：<el-link type="primary" :href="taskDetailLink" target="_blank">{{ executeResultTaskId }}</el-link>
      </p>
      <p v-if="executeResultMessage" class="execute-result-msg">{{ executeResultMessage }}</p>
      <!-- 轮询中的状态（含尚未拿到详情的初始态） -->
      <div
        v-if="
          !executeTaskDetail ||
          (executeTaskDetail && isTaskRunning(executeTaskDetail))
        "
        class="execute-status running"
      >
        <el-icon class="is-loading"><Loading /></el-icon>
        执行中…
      </div>
      <!-- 成功：登录成功并已截图 -->
      <div
        v-else-if="
          executeTaskDetail &&
          isTaskCompleted(executeTaskDetail) &&
          (executeTaskDetail.executionStatus || '').toUpperCase() === 'COMPLETED' &&
          executeTaskDetail.reportPath
        "
        class="execute-status success"
      >
        <el-icon><CircleCheck /></el-icon>
        登录成功，已截图。
        <div v-if="executeTaskDetail.reportPath" class="report-path">
          截图路径：<code>{{ executeTaskDetail.reportPath }}</code>
        </div>
      </div>
      <!-- 失败：展示错误信息 -->
      <div
        v-else-if="
          executeTaskDetail &&
          (isTaskFailed(executeTaskDetail) || (executeTaskDetail.executionStatus || '').toUpperCase() === 'FAILED')
        "
        class="execute-status failed"
      >
        <el-icon><CircleClose /></el-icon>
        执行失败。
        <div v-if="executeTaskDetail.errorMessage" class="error-msg">{{ executeTaskDetail.errorMessage }}</div>
      </div>
      <!-- 已停止 -->
      <div
        v-else-if="executeTaskDetail && (executeTaskDetail.status || '').toUpperCase() === 'STOPPED'"
        class="execute-status stopped"
      >
        任务已停止。
      </div>
      <!-- 其它终态（如已完成但无截图） -->
      <div v-else-if="executeTaskDetail && !isTaskRunning(executeTaskDetail)" class="execute-status stopped">
        任务已结束。
      </div>
      <template #footer>
        <el-button
          v-if="executeResultTaskId && (!executeTaskDetail || isTaskRunning(executeTaskDetail))"
          type="warning"
          @click="stopCurrentTask"
        >
          停止
        </el-button>
        <el-button type="primary" @click="goToTasks">前往测试任务</el-button>
        <el-button @click="executeResultVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新建定时计划对话框 -->
    <el-dialog
      v-model="planDialogVisible"
      title="新建定时计划"
      width="540px"
      destroy-on-close
      @close="resetPlanForm"
    >
      <el-form ref="planFormRef" :model="planForm" label-width="110px">
        <el-form-item label="计划名称" required>
          <el-input v-model="planForm.name" placeholder="如：每日登录回归" />
        </el-form-item>
        <el-form-item label="Cron 表达式" required>
          <el-input v-model="planForm.cronExpression" placeholder="如 0 0 9 * * ? 表示每天 9 点" />
        </el-form-item>
        <el-form-item label="时区">
          <el-input v-model="planForm.timezone" placeholder="如 Asia/Shanghai" />
        </el-form-item>
        <el-form-item label="设备 ID" required>
          <el-input v-model="planForm.deviceId" placeholder="执行时使用的设备 ID" />
        </el-form-item>
        <el-form-item label="应用 ID" required>
          <el-input v-model="planForm.appId" placeholder="执行时使用的应用 ID" />
        </el-form-item>
        <el-form-item label="计划类型">
          <el-select v-model="planForm.planType" placeholder="不指定（或与后端约定）" clearable style="width: 100%">
            <el-option label="不指定" value="" />
            <el-option label="Pog-Android" value="POG_ANDROID" />
            <el-option label="Pog-iOS" value="POG_IOS" />
            <el-option label="Pog（兼容旧数据 POGPOG）" value="POGPOG" />
            <el-option label="Android" value="ANDROID" />
            <el-option label="iOS" value="IOS" />
            <el-option label="HarmonyOS" value="HARMONYOS" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景" required>
          <el-select v-model="planForm.scenarioId" placeholder="选择场景" style="width: 100%">
            <el-option
              v-for="s in scenariosFlat"
              :key="s.id"
              :label="s.name"
              :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景配置">
          <el-input
            v-model="planForm.scenarioConfig"
            type="textarea"
            :rows="2"
            placeholder='可选，JSON 如 {"phoneNumber":"13800138000"}' />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="planForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="planSubmitting" @click="submitPlan">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Loading, CircleCheck, CircleClose, Search, Document } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { platformElTagType, platformUiLabel } from '@/utils/platform'

const router = useRouter()
const activeTab = ref('scenarios')

/** 按平台→模块分组的场景（GET /functional-test/scenarios/by-platform-module） */
const scenariosByPlatformModule = ref<
  Array<{
    platform: string
    platformLabel: string
    modules: Array<{ moduleKey: string; moduleName: string; scenarios: any[] }>
  }>
>([])
/** 可执行场景页：按平台筛选；无模块的分组仅 Pog 平台仍展示（0 个场景 + 空状态） */
const scenarioPlatformFilter = ref<string>('')
function isPogExecutablePlatform(platform: string): boolean {
  const u = (platform || '').toUpperCase()
  return u === 'POG_ANDROID' || u === 'POG_IOS'
}
const displayedScenarioGroups = computed(() => {
  const filter = (scenarioPlatformFilter.value || '').toUpperCase()
  let groups = scenariosByPlatformModule.value
    .map((g) => ({
      ...g,
      modules: g.modules
        .map((m) => ({ ...m, scenarios: m.scenarios || [] }))
        .filter((m) => m.scenarios.length > 0)
    }))
    .filter((g) => g.modules.length > 0 || isPogExecutablePlatform(g.platform))
  if (filter) {
    groups = groups.filter((g) => (g.platform || '').toUpperCase() === filter)
  }
  return groups
})

const scenariosLoading = ref(false)
/** 扁平场景列表，供新建计划等下拉使用 */
const scenariosFlat = computed(() =>
  scenariosByPlatformModule.value.flatMap((g) => g.modules.flatMap((m) => m.scenarios))
)
const testPlans = ref<any[]>([])
const plansLoading = ref(false)
const plansLoadError = ref('')

const taskList = ref<any[]>([])
const taskListLoading = ref(false)
const taskListPage = ref(1)
const taskListSize = ref(10)
const taskListTotal = ref(0)
const taskListFilters = reactive({ days: 0, keyword: '', status: '', serviceType: '' })

const platformLabel = (p: string) => platformUiLabel(p)
const platformTagType = (p: string) => platformElTagType(p)
const taskTypeLabel = (t: string) => {
  const m: Record<string, string> = {
    FUNCTIONAL_QUALITY_TEST: '功能体验基础质量测试',
    PERFORMANCE_BASELINE_TEST: '性能基础质量测试',
    PERFORMANCE_MONITORING_TEST: '性能指标监控',
    COMPATIBILITY_TEST: '兼容性测试',
    INSTALL_UNINSTALL_UPGRADE_TEST: '安装卸载升级测试',
    UI_ADAPTATION_TEST: '界面与适配测试'
  }
  return m[t] || t || '—'
}
/** 任务列表/详情「具体做什么」：有 scenarioName 时展示「任务类型 - 场景名」，否则仅任务类型（兼容旧任务无场景） */
const taskDisplayTitle = (task: { taskType?: string; scenarioKey?: string | null; scenarioName?: string | null }) => {
  const typeLabel = taskTypeLabel(task.taskType || '')
  const scenarioName = (task.scenarioName || '').trim()
  return scenarioName ? `${typeLabel} - ${scenarioName}` : typeLabel
}

/** 接口未带 Pog 分组时仍展示 Pog 入口（0 场景）；有数据后沿用接口 modules */
function ensurePogExecutableGroups(
  groups: Array<{ platform: string; platformLabel: string; modules: Array<{ moduleKey: string; moduleName: string; scenarios: any[] }> }>
) {
  const out = [...groups]
  const has = (u: string) => out.some((g) => (g.platform || '').toUpperCase() === u)
  if (!has('POG_ANDROID')) {
    out.push({ platform: 'POG_ANDROID', platformLabel: platformUiLabel('POG_ANDROID'), modules: [] })
  }
  if (!has('POG_IOS')) {
    out.push({ platform: 'POG_IOS', platformLabel: platformUiLabel('POG_IOS'), modules: [] })
  }
  return out
}

/**
 * Pog 分组内只保留「行的 platform」与分组 platform 完全一致的场景。
 * 避免网关/旧后端把 ANDROID 场景挂到 platform=POG_ANDROID 的分组下；旧逻辑只要混入一条误标的 POG_* 行就会整组放行。
 */
function sanitizePogScenarioRowsToMatchGroup<
  G extends {
    platform: string
    platformLabel: string
    modules: Array<{ moduleKey: string; moduleName: string; scenarios: any[] }>
  }
>(g: G): G {
  if (!isPogExecutablePlatform(g.platform)) return g
  const want = (g.platform || '').toUpperCase()
  const modules = (g.modules || []).map((m) => ({
    ...m,
    scenarios: (m.scenarios || []).filter(
      (s: { platform?: string }) => String(s?.platform || '').toUpperCase() === want
    )
  }))
  return { ...g, modules }
}

const loadScenarios = async () => {
  scenariosLoading.value = true
  try {
    const raw = await apiClient.getFunctionalTestScenariosByPlatformModule()
    const list = Array.isArray(raw) ? raw : []
    if (list.length === 0) {
      scenariosByPlatformModule.value = []
      return
    }
    const mapped = list.map((g) => ({
      platform: String(g.platform ?? ''),
      platformLabel: String(g.platformLabel ?? platformUiLabel(String(g.platform ?? ''))),
      modules: Array.isArray(g.modules) ? g.modules : []
    }))
    const stripped = mapped.map(sanitizePogScenarioRowsToMatchGroup)
    scenariosByPlatformModule.value = ensurePogExecutableGroups(stripped)
  } catch (e: any) {
    ElMessage.error(e.message || '加载场景失败')
    scenariosByPlatformModule.value = []
  } finally {
    scenariosLoading.value = false
  }
}

const loadTestPlans = async () => {
  plansLoadError.value = ''
  plansLoading.value = true
  try {
    testPlans.value = await apiClient.getTestPlans()
  } catch (e: any) {
    const msg = e?.message || '加载计划失败'
    plansLoadError.value = msg.includes('static resource') || msg.includes('404')
      ? '定时计划接口暂未开放或后端未提供 GET /api/test-plans，请稍后再试。'
      : msg
    testPlans.value = []
  } finally {
    plansLoading.value = false
  }
}

// 执行场景
const executeDialogVisible = ref(false)
const executeScenario = ref<any>(null)
const executeFormRef = ref()
const executeSubmitting = ref(false)
const executeDevices = ref<any[]>([])
const executeApps = ref<any[]>([])
const devicesLoading = ref(false)
const appsLoading = ref(false)
const defaultPhoneNumber = '12312340002'
const defaultVerificationCode = '521758'
const executeForm = reactive({
  deviceId: '',
  applicationId: '',
  phoneNumber: defaultPhoneNumber,
  verificationCode: defaultVerificationCode
})

/** 提交执行用：与列表行 id / scenarioId 一致（仅使用接口返回的 id） */
const executeScenarioResolvedId = computed(() => {
  const s = executeScenario.value
  if (!s) return ''
  const id = s.id ?? s.scenarioId
  return id != null && String(id).trim() !== '' ? String(id).trim() : ''
})

const openExecuteDialog = async (row: any) => {
  executeScenario.value = row
  executeForm.deviceId = ''
  executeForm.applicationId = ''
  executeForm.phoneNumber = defaultPhoneNumber
  executeForm.verificationCode = defaultVerificationCode
  executeApps.value = []
  executeDialogVisible.value = true
  devicesLoading.value = true
  try {
    const platform = (row.platform || 'ANDROID').toUpperCase()
    executeDevices.value = await apiClient.getDevicesByPlatform(platform as any)
  } catch (e: any) {
    ElMessage.error(e.message || '加载设备失败')
  } finally {
    devicesLoading.value = false
  }
}

const loadExecuteApps = async (refresh = false) => {
  if (!executeForm.deviceId) return
  executeForm.applicationId = ''
  executeApps.value = []
  appsLoading.value = true
  try {
    executeApps.value = await apiClient.getInstalledApps(executeForm.deviceId, refresh)
  } catch (e: any) {
    ElMessage.error(e.message || '加载应用失败')
  } finally {
    appsLoading.value = false
  }
}

const onExecuteDeviceChange = async () => {
  executeForm.applicationId = ''
  executeApps.value = []
  if (!executeForm.deviceId) return
  await loadExecuteApps(false)
}

const resetExecuteForm = () => {
  executeScenario.value = null
  executeForm.deviceId = ''
  executeForm.applicationId = ''
  executeForm.phoneNumber = defaultPhoneNumber
  executeForm.verificationCode = defaultVerificationCode
}

const executeResultVisible = ref(false)
const executeResultMessage = ref('')
const executeResultTaskId = ref('')
const executeTaskDetail = ref<any>(null)

// Android 设置测试直调（对接文档：loadingCompletionDelayMs、whiteScreenDurationMs）
const settingsDirectForm = reactive({
  deviceId: '',
  appiumServerUrl: '',
  packageName: '',
  platformVersion: '',
  deviceName: ''
})
const settingsExecuteLoading = ref(false)
const settingsExecuteResult = ref<{ code: number; message?: string; data?: any } | null>(null)
const settingsHealthLoading = ref(false)
const settingsExecuteTestData = computed(() => {
  const d = settingsExecuteResult.value?.data?.testData
  return d && typeof d === 'object' ? d : null
})
const settingsExecuteSteps = computed(() => settingsExecuteResult.value?.data?.testSteps ?? [])
function formatSettingsDelay(ms: number | undefined | null): string {
  if (ms == null) return '—'
  return `${ms}ms`
}
async function checkAndroidSettingsHealth() {
  settingsHealthLoading.value = true
  try {
    const res = await apiClient.getAndroidSettingsTestHealth()
    ElMessage.success(res?.status === 'UP' ? '服务正常' : JSON.stringify(res))
  } catch (e: any) {
    ElMessage.error(e?.message || '健康检查失败')
  } finally {
    settingsHealthLoading.value = false
  }
}
async function runAndroidSettingsTest() {
  settingsExecuteLoading.value = true
  settingsExecuteResult.value = null
  try {
    const body: Record<string, string> = {}
    if (settingsDirectForm.deviceId.trim()) body.deviceId = settingsDirectForm.deviceId.trim()
    if (settingsDirectForm.appiumServerUrl.trim()) body.appiumServerUrl = settingsDirectForm.appiumServerUrl.trim()
    if (settingsDirectForm.packageName.trim()) body.packageName = settingsDirectForm.packageName.trim()
    if (settingsDirectForm.platformVersion.trim()) body.platformVersion = settingsDirectForm.platformVersion.trim()
    if (settingsDirectForm.deviceName.trim()) body.deviceName = settingsDirectForm.deviceName.trim()
    const res = await apiClient.executeAndroidSettingsTest(body)
    settingsExecuteResult.value = res
    if (res.code === 200) {
      ElMessage.success(res.message || '执行成功')
    } else {
      ElMessage.error(res.message || '执行失败')
    }
  } catch (e: any) {
    settingsExecuteResult.value = { code: 0, message: e?.message || '请求异常' }
    ElMessage.error(e?.message || '请求异常')
  } finally {
    settingsExecuteLoading.value = false
  }
}
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const POLL_INTERVAL_MS = 2500
const taskDetailLink = computed(() => (executeResultTaskId.value ? `#/tasks?taskId=${executeResultTaskId.value}` : ''))

function isTaskRunning(task: any) {
  const s = (task?.status || '').toUpperCase()
  return s === 'PENDING' || s === 'RUNNING'
}

function isTaskCompleted(task: any) {
  return (task?.status || '').toUpperCase() === 'COMPLETED'
}

function isTaskFailed(task: any) {
  return (task?.status || '').toUpperCase() === 'FAILED'
}

async function fetchExecuteTaskDetail() {
  const taskId = executeResultTaskId.value
  if (!taskId) return
  try {
    const detail = await apiClient.getFunctionalTestTask(taskId)
    executeTaskDetail.value = detail
    if (!isTaskRunning(detail)) stopPolling()
  } catch (_) {
    // 轮询忽略单次失败
  }
}

function startPolling() {
  stopPolling()
  executeTaskDetail.value = null
  fetchExecuteTaskDetail()
  pollTimer.value = setInterval(fetchExecuteTaskDetail, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function stopCurrentTask() {
  const taskId = executeResultTaskId.value
  if (!taskId) return
  try {
    await apiClient.stopTask(taskId)
    ElMessage.success('已发送停止请求')
    await fetchExecuteTaskDetail()
  } catch (e: any) {
    ElMessage.error(e?.message || '停止失败')
  }
}

const submitExecute = async () => {
  const deviceId = (executeForm.deviceId || '').trim()
  const applicationId = (executeForm.applicationId || '').trim()
  const scenarioId = executeScenarioResolvedId.value
  if (!executeScenario.value || !deviceId || !applicationId) {
    ElMessage.warning('请选择设备和应用')
    return
  }
  if (!scenarioId) {
    ElMessage.warning('当前场景缺少场景 ID，无法提交执行')
    return
  }
  executeSubmitting.value = true
  try {
    const phoneNumber = (executeForm.phoneNumber || '').trim() || defaultPhoneNumber
    const verificationCode = (executeForm.verificationCode || '').trim() || defaultVerificationCode
    const config = JSON.stringify({ phoneNumber, verificationCode })
    const body = {
      scenarioId,
      deviceId,
      applicationId,
      config
    }
    const res = await apiClient.executeFunctionalTest(body)
    executeDialogVisible.value = false
    executeResultTaskId.value = res?.taskId || ''
    executeResultMessage.value = res?.message || '任务已提交，正在执行…'
    executeResultVisible.value = true
    startPolling()
  } catch (e: any) {
    const msg = e?.message || '执行失败'
    ElMessage.error(msg)
    console.error('[execute]', msg, e)
  } finally {
    executeSubmitting.value = false
  }
}

const goToTasks = () => {
  executeResultVisible.value = false
  stopPolling()
  router.push('/tasks')
}

// 定时计划
const planDialogVisible = ref(false)
const planFormRef = ref()
const planSubmitting = ref(false)
const planForm = reactive({
  name: '',
  cronExpression: '',
  timezone: 'Asia/Shanghai',
  deviceId: '',
  appId: '',
  planType: '' as string,
  scenarioId: '',
  scenarioConfig: '',
  enabled: true
})

const openPlanDialog = () => {
  planDialogVisible.value = true
}

const resetPlanForm = () => {
  planForm.name = ''
  planForm.cronExpression = ''
  planForm.timezone = 'Asia/Shanghai'
  planForm.deviceId = ''
  planForm.appId = ''
  planForm.planType = ''
  planForm.scenarioId = ''
  planForm.scenarioConfig = ''
  planForm.enabled = true
}

const submitPlan = async () => {
  if (!planForm.name?.trim() || !planForm.cronExpression?.trim() || !planForm.deviceId?.trim() || !planForm.appId?.trim() || !planForm.scenarioId?.trim()) {
    ElMessage.warning('请填写计划名称、Cron、设备、应用、场景')
    return
  }
  planSubmitting.value = true
  try {
    const body: Parameters<typeof apiClient.createTestPlan>[0] = {
      name: planForm.name.trim(),
      cronExpression: planForm.cronExpression.trim(),
      timezone: planForm.timezone?.trim() || 'Asia/Shanghai',
      deviceId: planForm.deviceId.trim(),
      appId: planForm.appId.trim(),
      scenarioId: planForm.scenarioId.trim(),
      scenarioConfig: planForm.scenarioConfig?.trim() || undefined,
      enabled: planForm.enabled
    }
    if (planForm.planType?.trim()) {
      body.planType = planForm.planType.trim()
    }
    await apiClient.createTestPlan(body)
    ElMessage.success('创建成功')
    planDialogVisible.value = false
    loadTestPlans()
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    planSubmitting.value = false
  }
}

const triggerPlan = async (id: string) => {
  try {
    await apiClient.triggerTestPlan(id)
    ElMessage.success('已触发执行')
    loadTestPlans()
  } catch (e: any) {
    ElMessage.error(e.message || '触发失败')
  }
}

const togglePlanEnabled = async (row: any) => {
  const next = !row.enabled
  try {
    await apiClient.setTestPlanEnabled(row.id, next)
    ElMessage.success(next ? '已启用' : '已禁用')
    loadTestPlans()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  }
}

// 任务列表：使用 GET /api/tasks（含性能任务），GET /api/functional-test/tasks 不包含性能任务
const loadTaskList = async () => {
  taskListLoading.value = true
  try {
    const filters: { status?: string; taskType?: string } = {}
    if (taskListFilters.status?.trim()) filters.status = taskListFilters.status.trim()
    const data = await apiClient.getTasks(filters, { page: taskListPage.value, size: taskListSize.value })
    const content = Array.isArray(data?.content) ? data.content : []
    taskList.value = content.map((t: any) => ({
      id: t.id,
      taskId: t.id,
      taskName: t.name ?? t.taskName,
      status: (t.status || 'pending').toUpperCase(),
      taskType: t.taskType || (t.platform ? `功能体验-${t.platform}` : '功能体验'),
      platform: (t.platform || '').toUpperCase(),
      createdAt: t.createdAt,
      deviceId: t.deviceId,
      scenarioKey: t.scenarioKey ?? null,
      scenarioName: t.scenarioName ?? null,
      remarks: t.description ?? t.remarks
    }))
    taskListTotal.value = data?.totalElements ?? 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载任务列表失败')
    taskList.value = []
    taskListTotal.value = 0
  } finally {
    taskListLoading.value = false
  }
}

/** 筛选条件变化时重置到第 1 页并加载 */
const onTaskListFilterChange = () => {
  taskListPage.value = 1
  loadTaskList()
}

const resetTaskListFilters = () => {
  taskListFilters.days = 0
  taskListFilters.keyword = ''
  taskListFilters.status = ''
  taskListFilters.serviceType = ''
  taskListPage.value = 1
  loadTaskList()
}

function formatTaskId(id: string | undefined) {
  if (!id) return '—'
  return id.startsWith('Task-') ? id : 'Task-' + id
}

const onDeleteReportClick = () => {
  ElMessage.info('请点击各卡片上的「删除」按钮删除对应报告')
}

function formatTaskTime(val: number | string | undefined) {
  if (val == null) return '—'
  let date: Date
  if (typeof val === 'string') {
    date = new Date(val)
  } else {
    const n = Number(val)
    date = new Date(n < 1e12 ? n * 1000 : n)
  }
  return isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN')
}

function taskStatusText(s: string) {
  const m: Record<string, string> = {
    PENDING: '待运行',
    RUNNING: '运行中',
    COMPLETED: '完成',
    FAILED: '失败',
    STOPPED: '停止'
  }
  return m[(s || '').toUpperCase()] || s || '—'
}

function taskStatusTagType(s: string) {
  const m: Record<string, string> = {
    COMPLETED: 'success',
    RUNNING: 'warning',
    FAILED: 'danger',
    STOPPED: 'warning',
    PENDING: 'info'
  }
  return m[(s || '').toUpperCase()] || 'info'
}

const getTaskId = (task: { id?: string; taskId?: string; [key: string]: any }) => task?.id ?? task?.taskId ?? ''

/** 查看任务详情：跳转到任务概览页，调用 GET /api/functional-test/tasks/{id}/overview */
const viewTaskDetail = (task: { id?: string; taskId?: string; [key: string]: any }) => {
  const id = getTaskId(task)
  if (id) router.push({ name: 'TaskOverview', params: { id } })
}

const deleteTaskFromList = async (taskId: string) => {
  try {
    await ElMessageBox.confirm('确定要删除该任务吗？删除将先停止任务（若正在运行）再删除。', '删除任务', {
      type: 'warning'
    })
    await apiClient.deleteTask(taskId)
    ElMessage.success('删除成功')
    loadTaskList()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => {
  loadScenarios()
})

watch(activeTab, (name) => {
  if (name === 'plans') loadTestPlans()
  if (name === 'taskList') loadTaskList()
})
</script>

<style scoped>
.automation-test {
  width: 100%;
}

.main-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.section-desc {
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
}

.scenario-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.scenario-toolbar-label {
  font-size: 13px;
  color: #606266;
}

.execute-scenario-id {
  display: block;
  font-size: 12px;
  word-break: break-all;
  line-height: 1.5;
  padding: 6px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

/* 可执行场景：平台折叠 → 模块折叠 → 场景表格 */
.scenarios-by-platform {
  min-height: 120px;
}
.scenarios-by-platform .collapse-title {
  font-weight: 500;
  margin-right: 8px;
}
.scenarios-by-platform .collapse-count {
  vertical-align: middle;
}
/* 内层模块折叠：缩进、背景色 */
.scenarios-inner-collapse {
  margin: 8px 0 0 20px;
  padding: 12px 12px 4px 16px;
  border-left: 3px solid #e4e7ed;
  background: #f8f9fc;
  border-radius: 6px;
}
.scenarios-inner-collapse :deep(.el-collapse-item) {
  margin-bottom: 8px;
}
.scenarios-inner-collapse :deep(.el-collapse-item__header) {
  background: var(--el-bg-color-page);
  border-radius: 4px;
  padding-left: 12px;
  border: none;
}
.scenarios-inner-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}
.scenarios-inner-collapse :deep(.el-collapse-item__content) {
  padding: 12px 0 8px 0;
}
.scenarios-inner-collapse .collapse-title.inner {
  font-weight: 400;
  font-size: 13px;
  color: #606266;
}

/* 可执行场景表格：仅增加单元格内边距，列宽用组件默认分配 */
.scenarios-table {
  width: 100%;
}
.scenarios-table :deep(.el-table__header th),
.scenarios-table :deep(.el-table__body td) {
  padding: 12px 16px;
}

.section-alert {
  margin-bottom: 12px;
}

.section-toolbar {
  margin-bottom: 12px;
}

.settings-direct-card {
  max-width: 640px;
}
.settings-direct-card :deep(.el-card__header) {
  display: flex;
  align-items: center;
}
.settings-direct-form {
  margin-bottom: 20px;
}
.settings-direct-result {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
.settings-test-data {
  margin-bottom: 8px;
}
.settings-test-data h4,
.settings-direct-result h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #303133;
}
.settings-steps-table {
  margin-top: 8px;
}
.settings-no-steps {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: #909399;
}

.task-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.task-list-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.task-list-filters .time-tabs {
  margin-right: 4px;
}

.task-list-filters .filter-keyword-input {
  width: 180px;
}

.task-list-filters .filter-service-select,
.task-list-filters .filter-status-select {
  width: 160px;
}

.task-list-toolbar .delete-report-btn {
  flex-shrink: 0;
}

.task-list-cards {
  min-height: 120px;
}

.task-list-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.task-card-ref {
  margin-bottom: 16px;
}

.task-card-ref :deep(.el-card__body) {
  padding: 0;
}

.task-card-inner {
  padding: 0;
}

.task-card-content {
  cursor: pointer;
}

.task-card-content:hover {
  background: #fafbfc;
}

.task-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.task-card-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.task-card-id {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  word-break: break-all;
}

.task-card-status {
  flex-shrink: 0;
}

.task-card-body {
  padding: 12px 16px;
  font-size: 13px;
}

.task-card-row {
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-card-row:last-of-type {
  margin-bottom: 0;
}

.task-card-row .label {
  color: #909399;
  flex-shrink: 0;
  min-width: 72px;
}

.task-card-row .value {
  color: #303133;
  word-break: break-all;
}

.task-card-row .value.remark {
  font-size: 12px;
  color: #606266;
}

.task-card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 12px;
  border-top: 1px solid #f0f0f0;
}

.execute-scenario-name {
  font-weight: 500;
  color: #303133;
}

.execute-result-task {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 13px;
}

.execute-result-msg {
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
}

.execute-status {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.execute-status.running {
  background: #ecf5ff;
  color: var(--el-color-primary);
}

.execute-status.success {
  background: #f0f9eb;
  color: #67c23a;
}

.execute-status.failed {
  background: #fef0f0;
  color: #f56c6c;
}

.execute-status.stopped {
  background: #f4f4f5;
  color: #909399;
}

.execute-status .report-path,
.execute-status .error-msg {
  margin-top: 8px;
  font-size: 12px;
  word-break: break-all;
}

.execute-status .report-path code {
  background: #eee;
  padding: 2px 6px;
  border-radius: 4px;
}

.execute-status .error-msg {
  color: #f56c6c;
}

.execute-app-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.execute-app-row .execute-app-select {
  flex: 1;
  min-width: 0;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.automation-test :deep(.el-tabs--border-card) {
  border: none;
  box-shadow: none;
}

.automation-test :deep(.el-tabs__content) {
  padding: 16px 0 0 0;
}
</style>
