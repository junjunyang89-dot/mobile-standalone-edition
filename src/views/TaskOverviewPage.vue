<template>
  <div class="task-overview-page">
    <!-- 顶部：返回 + 标题 -->
    <div class="page-topbar">
      <el-button link class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h1 class="page-title">{{ pageTitle }}</h1>
    </div>

    <template v-if="loading">
      <div class="overview-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载中...
      </div>
    </template>
    <template v-else-if="error">
      <div class="overview-error">{{ error }}</div>
    </template>
    <template v-else-if="overview && overviewReady">
      <!-- 整块用 key 包裹，强制全新挂载，避免 Element 内部访问已移除 DOM -->
      <div :key="taskId + '-content'" class="overview-content-keyed">
      <div class="overview-header">
        <div class="header-inner">
          <div class="header-col header-col-task">
            <div class="header-col-icon">
              <el-icon><Document /></el-icon>
            </div>
            <div class="header-col-body">
              <div class="header-task-title">{{ overview.title || '—' }}</div>
              <div v-if="overview.remarks" class="header-task-remarks">{{ overview.remarks }}</div>
              <div class="header-task-id">{{ formatTaskId(overview.taskId || taskId) }}</div>
              <div class="header-task-scenario">测试场景 {{ (overview.scenarioName != null && overview.scenarioName !== '') ? overview.scenarioName : '-' }}</div>
            </div>
          </div>
          <div class="header-col header-col-app">
            <div class="header-col-icon">
              <el-icon><Grid /></el-icon>
            </div>
            <div class="header-col-body">
              <div class="header-block-title">测试类型 应用</div>
              <div class="header-kv">测试类型 {{ overview.testType ?? '—' }}</div>
              <div v-if="overview.scenarioName != null && overview.scenarioName !== '' || overview.scenarioKey" class="header-kv">场景 {{ overview.scenarioName || overview.scenarioKey || '—' }}</div>
              <div class="header-kv">应用包名 {{ overview.appPackageName ?? '—' }}</div>
              <div class="header-kv">应用版本 {{ overview.appVersion ?? '—' }}</div>
              <div class="header-kv">API版本 {{ overview.apiVersion ?? '—' }}</div>
            </div>
          </div>
          <div class="header-col header-col-exec">
            <div class="header-col-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="header-col-body">
              <div class="header-block-title">执行信息</div>
              <div class="header-kv">开始时间 {{ formatStartTime(overview.startTime) }}</div>
              <div class="header-kv">持续时间 {{ overview.duration ?? '—' }}</div>
              <div class="header-kv">执行人 {{ overview.executor ?? '—' }}</div>
              <div v-if="overview.executionVariables && (overview.executionVariables.phoneNumberMasked || overview.executionVariables.verificationCodeMasked)" class="header-execution-vars">
                <span v-if="overview.executionVariables.phoneNumberMasked" class="header-kv">手机号 {{ overview.executionVariables.phoneNumberMasked }}</span>
                <span v-if="overview.executionVariables.verificationCodeMasked" class="header-kv">验证码 {{ overview.executionVariables.verificationCodeMasked }}</span>
              </div>
              <div class="header-actions">
                <el-button link type="primary" size="small" class="header-action-btn">环境参数</el-button>
                <el-button v-if="taskId" link type="primary" size="small" class="header-action-btn" @click="openScreenshotReport">查看报告</el-button>
                <el-button link type="primary" size="small" class="header-action-btn" @click="onExecutionLog">执行日志</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab：概览 | 检测规则 -->
      <div class="overview-tabs-wrap">
        <el-tabs v-model="activeTab" type="card" class="overview-tabs">
          <el-tab-pane label="概览" name="overview">
            <div class="tab-overview">
              <!-- 达标率标题根据测试类型动态展示 -->
              <div class="overview-block">
                <div class="overview-block-title">{{ overviewSummaryTitle }}</div>
                <template v-if="showCompatibilityCircle">
                  <div class="overview-metrics">
                    <span>实际测试项: {{ compatibilitySummary.actualTestItemCount }}</span>
                    <span>测试通过项: {{ compatibilitySummary.passedCount }}</span>
                    <span>测试不通过项: {{ compatibilitySummary.failedCount }}</span>
                    <span>告警项: {{ compatibilitySummary.warningCount }}</span>
                  </div>
                  <div class="overview-progress-wrap">
                    <el-progress
                      type="circle"
                      :percentage="compatibilityPercent"
                      :stroke-width="12"
                      :width="160"
                      :color="compatibilityPercent === 100 ? '#67c23a' : compatibilityPercent >= 60 ? '#e6a23c' : '#f56c6c'"
                    >
                      <template #default>
                        <span class="progress-text">{{ compatibilityPercent }}%</span>
                        <span class="progress-label">{{ overviewSummaryShortLabel }}</span>
                      </template>
                    </el-progress>
                  </div>
                </template>
                <div v-else class="overview-performance-placeholder">
                  执行完成后可查看检测规则与执行日志
                </div>
              </div>
              <!-- 测试结果分布：使用 resultDistribution，含设备依赖 -->
              <div class="overview-block">
                <div class="overview-block-title">测试结果分布</div>
                <div class="result-distribution">
                  <div
                    v-for="item in resultDistributionList"
                    :key="item.categoryName"
                    class="dist-bar-row"
                  >
                    <span class="dist-label">{{ item.categoryName }}</span>
                    <div class="dist-bars">
                      <span v-if="(item.passed ?? 0) > 0" class="dist-bar dist-bar-passed" :style="{ width: barWidth(item.passed!, item.total) + '%' }" :title="'通过 ' + item.passed"></span>
                      <span v-if="(item.warning ?? 0) > 0" class="dist-bar dist-bar-warning" :style="{ width: barWidth(item.warning!, item.total) + '%' }" :title="'告警 ' + item.warning"></span>
                      <span v-if="(item.failed ?? 0) > 0" class="dist-bar dist-bar-failed" :style="{ width: barWidth(item.failed!, item.total) + '%' }" :title="'不通过 ' + item.failed"></span>
                      <span v-if="(item.deviceDependent ?? 0) > 0" class="dist-bar dist-bar-device" :style="{ width: barWidth(item.deviceDependent!, item.total) + '%' }" :title="'设备依赖 ' + item.deviceDependent"></span>
                    </div>
                    <span class="dist-value">{{ item.total ? (item.passed ?? 0) + '/' + item.total : '—' }}</span>
                  </div>
                </div>
                <div class="result-legend">
                  <span class="legend-item"><i class="legend-dot legend-passed"></i> 通过</span>
                  <span class="legend-item"><i class="legend-dot legend-warning"></i> 告警</span>
                  <span class="legend-item"><i class="legend-dot legend-failed"></i> 不通过</span>
                  <span class="legend-item"><i class="legend-dot legend-device"></i> 设备依赖</span>
                </div>
              </div>
              <!-- 性能报告：仅性能任务展示，参考「性能测试报告」设计：Tab 整体评估 / 遍历统计 / 资源数据 / 操作详情 -->
              <div v-if="isPerformanceTask" class="overview-block performance-report-block">
                <div class="performance-report-head">
                  <span class="performance-report-head-title">性能测试报告</span>
                </div>
                <div class="performance-report-wrap">
                  <template v-if="performanceReportError || !performanceReport">
                    <div v-loading="performanceReportLoading" class="performance-report-loading-wrap">
                      <div class="performance-report-message">{{ performanceReportEmptyMessage }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <!-- 锚点导航：置于 v-loading 外，.stop 防止被父级拦截 -->
                    <div class="performance-report-anchors" @click.stop>
                      <button
                        type="button"
                        class="perf-anchor-btn"
                        :class="{ active: perfReportTab === 'overall' }"
                        @click.stop="scrollToPerfSection('overall')"
                      >
                        整体评估
                      </button>
                      <button
                        type="button"
                        class="perf-anchor-btn"
                        :class="{ active: perfReportTab === 'traversal' }"
                        @click.stop="scrollToPerfSection('traversal')"
                      >
                        遍历统计
                      </button>
                      <button
                        type="button"
                        class="perf-anchor-btn"
                        :class="{ active: perfReportTab === 'resource' }"
                        @click.stop="scrollToPerfSection('resource')"
                      >
                        资源数据
                      </button>
                      <button
                        type="button"
                        class="perf-anchor-btn"
                        :class="{ active: perfReportTab === 'operations' }"
                        @click.stop="scrollToPerfSection('operations')"
                      >
                        操作详情
                      </button>
                    </div>
                    <!-- 有报告后不再对内容区使用 v-loading，避免遮罩阻挡锚点/子选项点击 -->
                    <div class="performance-report-sections">
                      <section id="perf-section-overall" class="perf-section-block">
                        <h3 class="perf-section-title">| 整体评估</h3>
                          <p class="perf-conclusion">
                            测试结论: 总共遍历 <strong class="perf-conclusion-num">{{ performanceReport.traversalDurationMinutes ?? 0 }}</strong> 分钟，
                            执行操作 <strong class="perf-conclusion-num">{{ performanceReport.totalOperations ?? 0 }}</strong> 次，
                            发现较好体验问题 <strong class="perf-conclusion-num perf-conclusion-num--issue">{{ performanceReport.issueSummary?.totalIssueCount ?? 0 }}</strong> 次。
                          </p>
                          <div class="perf-overall-row">
                            <div class="perf-donut-wrap">
                              <div ref="issueDonutRef" class="perf-donut-chart"></div>
                              <div v-if="issueDonutLegend.length" class="perf-donut-legend">
                                <div v-for="item in issueDonutLegend" :key="item.name" class="perf-legend-item">
                                  <i class="perf-legend-dot" :style="{ background: item.color }"></i>
                                  <span>{{ item.name }} {{ item.value }}次</span>
                                </div>
                              </div>
                            </div>
                            <div class="perf-issue-table-wrap">
                              <el-table :data="issueTableRows" stripe class="perf-issue-table" :header-cell-style="{ background: '#f5f7fa' }">
                                <el-table-column prop="opLabel" label="操作类型(次数)" width="140" />
                                <el-table-column prop="responseDelay" label="响应时延" width="90" align="center">
                                  <template #default="{ row }">
                                    <span :class="{ 'perf-issue-value': row.responseDelay > 0 }">{{ row.responseDelay }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="completionDelay" label="完成时延" width="90" align="center">
                                  <template #default="{ row }">
                                    <span :class="{ 'perf-issue-value': row.completionDelay > 0 }">{{ row.completionDelay }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="stutter" label="卡顿" width="70" align="center">
                                  <template #default="{ row }">
                                    <span :class="{ 'perf-issue-value': row.stutter > 0 }">{{ row.stutter }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="av" label="音视频" width="70" align="center">
                                  <template #default="{ row }">
                                    <span :class="{ 'perf-issue-value': row.av > 0 }">{{ row.av }}</span>
                                  </template>
                                </el-table-column>
                                <el-table-column prop="bw" label="黑白块" width="80" align="center">
                                  <template #default="{ row }">
                                    <span :class="{ 'perf-issue-value': row.bw > 0 }">{{ row.bw }}</span>
                                  </template>
                                </el-table-column>
                              </el-table>
                            </div>
                          </div>
                      </section>
                      <section id="perf-section-traversal" class="perf-section-block">
                        <h3 class="perf-section-title">| 遍历统计</h3>
                          <div class="perf-traversal-row">
                            <div class="perf-stats-cards">
                              <div class="perf-stat-card">
                                <div class="perf-stat-value">
                                  <span class="perf-stat-num">{{ performanceReport.traversalDurationMinutes ?? 0 }}</span>
                                  <span class="perf-stat-unit">分钟</span>
                                </div>
                                <span class="perf-stat-label">遍历时长</span>
                              </div>
                              <div class="perf-stat-card">
                                <div class="perf-stat-value">
                                  <span class="perf-stat-num">{{ performanceReport.launchCount ?? 0 }}</span>
                                  <span class="perf-stat-unit">次</span>
                                </div>
                                <span class="perf-stat-label">启动次数</span>
                              </div>
                              <div class="perf-stat-card">
                                <div class="perf-stat-value">
                                  <span class="perf-stat-num">{{ performanceReport.clickCount ?? 0 }}</span>
                                  <span class="perf-stat-unit">次</span>
                                </div>
                                <span class="perf-stat-label">点击次数</span>
                              </div>
                              <div class="perf-stat-card">
                                <div class="perf-stat-value">
                                  <span class="perf-stat-num">{{ performanceReport.swipeCount ?? 0 }}</span>
                                  <span class="perf-stat-unit">次</span>
                                </div>
                                <span class="perf-stat-label">滑动次数</span>
                              </div>
                              <div class="perf-stat-card">
                                <div class="perf-stat-value">
                                  <span class="perf-stat-num">0</span>
                                  <span class="perf-stat-unit">次</span>
                                </div>
                                <span class="perf-stat-label">观看视频</span>
                              </div>
                            </div>
                            <div v-if="(performanceReport.screenshotCount ?? 0) > 0" class="perf-screenshots-strip">
                              <div class="perf-screenshots-scroll">
                                <div
                                  v-for="idx in (performanceReport.screenshotCount ?? 0)"
                                  :key="idx - 1"
                                  class="perf-screenshot-item"
                                  role="button"
                                  tabindex="0"
                                  @click="openPerfScreenshotPreview(idx - 1)"
                                  @keydown.enter="openPerfScreenshotPreview(idx - 1)"
                                >
                                  <img
                                    :src="performanceScreenshotSrc(idx - 1)"
                                    :alt="'截图 ' + (idx - 1)"
                                    loading="lazy"
                                    class="perf-screenshot-img"
                                    @error="onPerfScreenshotError($event, idx - 1)" />
                                  <span v-if="screenshotTimeLabel(idx - 1)" class="perf-screenshot-time">{{ screenshotTimeLabel(idx - 1) }}</span>
                                  <template v-if="perfScreenshotOperations[idx - 1]">
                                    <span class="perf-screenshot-action">{{ perfScreenshotOperations[idx - 1]!.actionLabel }}</span>
                                    <span v-if="perfScreenshotOperations[idx - 1]?.pageName" class="perf-screenshot-page">{{ perfScreenshotOperations[idx - 1]!.pageName }}</span>
                                  </template>
                                </div>
                              </div>
                            </div>
                            <div v-else class="perf-screenshots-placeholder">
                              <span class="perf-placeholder-text">暂无步骤截图</span>
                            </div>
                          </div>
                      </section>
                      <section id="perf-section-resource" class="perf-section-block">
                        <h3 class="perf-section-title">| 资源数据</h3>
                          <el-tabs v-model="resourceSubTab" class="perf-resource-subtabs">
                            <el-tab-pane label="CPU" name="cpu">
                              <div class="perf-resource-metric-options" @click.stop>
                                <button
                                  v-for="opt in cpuMetricOptions"
                                  :key="opt.id"
                                  type="button"
                                  class="perf-metric-pill"
                                  :class="{ active: cpuMetricActive === opt.id && opt.hasData, disabled: !opt.hasData }"
                                  :disabled="!opt.hasData"
                                  @click.stop="opt.hasData && (cpuMetricActive = opt.id)"
                                >{{ opt.label }}</button>
                              </div>
                              <div class="perf-resource-content">
                                <div class="perf-chart-wrap">
                                  <div ref="resourceLineRef" class="perf-line-chart"></div>
                                </div>
                                <div class="perf-resource-summary">
                                  <div class="perf-resource-summary-title">应用CPU负载占比</div>
                                  <div v-if="peakCpuStep" class="perf-peak-step">
                                    <span class="perf-peak-step-label">峰值步骤:</span>
                                    <a
                                      href="javascript:;"
                                      class="perf-peak-step-link"
                                      @click.prevent="scrollToPerfSection('operations')"
                                    >应用启动测试 -> {{ peakCpuStep.index }}.{{ peakCpuStep.actionLabel || peakCpuStep.type }}</a>
                                  </div>
                                  <el-table v-if="cpuSummaryRows.length" :data="cpuSummaryRows" stripe class="perf-summary-table" :show-header="true" :header-cell-style="{ background: '#f5f7fa' }">
                                    <el-table-column label="类型" prop="name" width="70" />
                                    <el-table-column label="峰值(%)" width="90">
                                      <template #default="{ row }">{{ formatResourceValue(row.peak) }}</template>
                                    </el-table-column>
                                    <el-table-column label="最小值(%)" width="90">
                                      <template #default="{ row }">{{ formatResourceValue(row.min) }}</template>
                                    </el-table-column>
                                    <el-table-column label="平均值(%)" width="90">
                                      <template #default="{ row }">{{ formatResourceValue(row.avg) }}</template>
                                    </el-table-column>
                                  </el-table>
                                  <div v-else class="performance-report-message">暂无 CPU 数据</div>
                                </div>
                              </div>
                            </el-tab-pane>
                            <el-tab-pane label="内存" name="memory">
                              <div class="perf-resource-metric-options" @click.stop>
                                <button
                                  v-for="opt in memoryMetricOptions"
                                  :key="opt.id"
                                  type="button"
                                  class="perf-metric-pill"
                                  :class="{ active: memoryMetricActive === opt.id && opt.hasData, disabled: !opt.hasData }"
                                  :disabled="!opt.hasData"
                                  @click.stop="opt.hasData && (memoryMetricActive = opt.id)"
                                >{{ opt.label }}</button>
                              </div>
                              <div class="perf-resource-content">
                                <div class="perf-chart-wrap">
                                  <div ref="memoryLineRef" class="perf-line-chart"></div>
                                </div>
                                <div class="perf-resource-summary">
                                  <div class="perf-resource-summary-title">应用内存</div>
                                  <div v-if="peakMemoryStep" class="perf-peak-step">
                                    <span class="perf-peak-step-label">峰值步骤:</span>
                                    <a
                                      href="javascript:;"
                                      class="perf-peak-step-link"
                                      @click.prevent="scrollToPerfSection('operations')"
                                    >应用启动测试 -> {{ peakMemoryStep.index }}.{{ peakMemoryStep.actionLabel || peakMemoryStep.type }}</a>
                                  </div>
                                  <el-table v-if="memorySummaryRows.length" :data="memorySummaryRows" stripe class="perf-summary-table" :show-header="true" :header-cell-style="{ background: '#f5f7fa' }">
                                    <el-table-column label="类型" prop="name" width="70" />
                                    <el-table-column label="峰值(MB)" prop="peak" width="95" />
                                    <el-table-column label="最小值(MB)" prop="min" width="95" />
                                    <el-table-column label="平均值(MB)" prop="avg" width="95" />
                                  </el-table>
                                  <div v-else class="performance-report-message">暂无内存数据</div>
                                </div>
                              </div>
                            </el-tab-pane>
                            <el-tab-pane label="网络" name="network">
                              <div class="perf-resource-metric-options" @click.stop>
                                <button
                                  v-for="opt in networkMetricOptions"
                                  :key="opt.id"
                                  type="button"
                                  class="perf-metric-pill"
                                  :class="{ active: networkMetricActive === opt.id && opt.hasData, disabled: !opt.hasData }"
                                  :disabled="!opt.hasData"
                                  @click.stop="opt.hasData && (networkMetricActive = opt.id)"
                                >{{ opt.label }}</button>
                              </div>
                              <div v-if="hasNetworkData" class="perf-resource-content">
                                <div class="perf-chart-wrap">
                                  <div ref="networkLineRef" class="perf-line-chart"></div>
                                </div>
                                <div class="perf-resource-summary">
                                  <div class="perf-resource-summary-title">网络速率 (Kb/s)</div>
                                  <el-table v-if="networkSummaryRows.length" :data="networkSummaryRows" stripe class="perf-summary-table" :show-header="true" :header-cell-style="{ background: '#f5f7fa' }">
                                    <el-table-column label="类型" prop="name" width="100" />
                                    <el-table-column label="峰值(Kb/s)" prop="peak" width="110" />
                                    <el-table-column label="最小值(Kb/s)" prop="min" width="110" />
                                    <el-table-column label="平均值(Kb/s)" prop="avg" width="110" />
                                  </el-table>
                                  <div v-else class="performance-report-message">暂无网络汇总</div>
                                </div>
                              </div>
                              <div v-else class="perf-resource-content">
                                <div class="perf-resource-placeholder">
                                  <span class="performance-report-message">暂无网络数据，后续版本支持网络流量等指标采集与展示。</span>
                                </div>
                              </div>
                            </el-tab-pane>
                            <el-tab-pane label="温度" name="temperature">
                              <div class="perf-resource-metric-options" @click.stop>
                                <button
                                  v-for="opt in temperatureMetricOptions"
                                  :key="opt.id"
                                  type="button"
                                  class="perf-metric-pill"
                                  :class="{ active: temperatureMetricActive === opt.id && opt.hasData, disabled: !opt.hasData }"
                                  :disabled="!opt.hasData"
                                  @click.stop="opt.hasData && (temperatureMetricActive = opt.id)"
                                >{{ opt.label }}</button>
                              </div>
                              <div v-if="hasTemperatureData" class="perf-resource-content">
                                <div class="perf-chart-wrap">
                                  <div ref="temperatureLineRef" class="perf-line-chart"></div>
                                </div>
                                <div class="perf-resource-summary">
                                  <div class="perf-resource-summary-title">设备温度 (℃)</div>
                                  <el-table v-if="temperatureSummaryRows.length" :data="temperatureSummaryRows" stripe class="perf-summary-table" :show-header="true" :header-cell-style="{ background: '#f5f7fa' }">
                                    <el-table-column label="峰值(℃)" prop="peak" width="100" />
                                    <el-table-column label="最小值(℃)" prop="min" width="100" />
                                    <el-table-column label="平均值(℃)" prop="avg" width="100" />
                                  </el-table>
                                  <div v-else class="performance-report-message">暂无温度汇总</div>
                                </div>
                              </div>
                              <div v-else class="perf-resource-content">
                                <div class="perf-resource-placeholder">
                                  <span class="performance-report-message">暂无温度数据，后续版本支持设备温度采集与展示。</span>
                                </div>
                              </div>
                            </el-tab-pane>
                          </el-tabs>
                      </section>
                      <section id="perf-section-operations" class="perf-section-block">
                        <h3 class="perf-section-title">| 操作详情</h3>
                          <el-table
                            v-if="performanceReport.operations?.length"
                            :data="performanceReport.operations"
                            stripe
                            max-height="360"
                            class="performance-operations-table"
                           :header-cell-style="{ background: \'#f5f7fa\' }"
                          >
                            <!-- 5.4：操作类型 = index + actionLabel，列顺序与文档一致 -->
                            <el-table-column label="操作类型" min-width="160" show-overflow-tooltip>
                              <template #default="{ row }">{{ row.index }}.{{ row.actionLabel ?? row.type ?? '—' }}</template>
                            </el-table-column>
                            <el-table-column label="操作前" width="100" align="center">
                              <template #default="{ row }">
                                <template v-if="row.screenshotBeforeIndex != null">
                                  <img
                                    :src="performanceScreenshotSrc(row.screenshotBeforeIndex)"
                                    class="perf-op-thumb"
                                    alt="操作前"
                                    @click="openPerfScreenshotPreview(row.screenshotBeforeIndex)" />
                                </template>
                                <span v-else>—</span>
                              </template>
                            </el-table-column>
                            <el-table-column label="操作后" width="100" align="center">
                              <template #default="{ row }">
                                <template v-if="row.screenshotAfterIndex != null">
                                  <img
                                    :src="performanceScreenshotSrc(row.screenshotAfterIndex)"
                                    class="perf-op-thumb"
                                    alt="操作后"
                                    @click="openPerfScreenshotPreview(row.screenshotAfterIndex)" />
                                </template>
                                <span v-else>—</span>
                              </template>
                            </el-table-column>
                            <el-table-column label="响应时延(ms)" width="110">
                              <template #default="{ row }">{{ row.responseDelayMs ?? '—' }}</template>
                            </el-table-column>
                            <el-table-column label="完成时延(ms)" width="110">
                              <template #default="{ row }">{{ row.completionDelayMs ?? '—' }}</template>
                            </el-table-column>
                            <el-table-column label="卡顿/音视频/黑白块" min-width="140" show-overflow-tooltip>
                              <template #default="{ row }">{{ formatOperationIssueSummary(row) }}</template>
                            </el-table-column>
                            <el-table-column label="维测数据" min-width="120" show-overflow-tooltip>
                              <template #default="{ row }">{{ formatOperationDimension(row) }}</template>
                            </el-table-column>
                          </el-table>
                          <div v-else class="performance-report-message">暂无操作明细</div>
                      </section>
                    </div>
                  </template>
                </div>
              </div>
              <!-- 执行结果截图：遍历 executionLog，对每条有 screenshotUrl 的条目展示对应截图；无则回退为单张任务截图 -->
              <div class="overview-block">
                <div class="overview-block-title">执行结果截图</div>
                <div v-if="overviewStepScreenshots.length" class="overview-screenshots-strip">
                  <div
                    v-for="(entry, index) in overviewStepScreenshots"
                    :key="(entry.screenshotUrl || '') + '-' + index"
                    class="overview-screenshot-item overview-screenshot-item--clickable"
                    @click="openOverviewScreenshotPreview(index)"
                  >
                    <img
                      :src="stepScreenshotSrc(entry.screenshotUrl)"
                      :alt="entry.step || `步骤 ${index + 1} 截图`"
                      loading="lazy"
                      class="overview-screenshot-img"
                      @error="hideStepScreenshot" />
                    <span v-if="entry.step" class="overview-screenshot-step">{{ entry.step }}</span>
                  </div>
                </div>
                <div v-else class="overview-screenshot-wrap">
                  <img
                    v-if="screenshotUrl && !screenshotLoadError"
                    :src="screenshotUrl"
                    alt="执行截图"
                    class="overview-screenshot-img overview-screenshot-img--clickable"
                    loading="lazy"
                    @error="screenshotLoadError = true"
                    @click="openOverviewScreenshotPreview(0)" />
                  <div v-if="!screenshotUrl || screenshotLoadError" class="overview-screenshot-placeholder">暂无截图</div>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="检测规则" name="rules">
            <div class="tab-rules">
              <el-table
                v-if="overview.testResultItems?.length"
                :data="overview.testResultItems"
                stripe
                class="rules-table"
               :header-cell-style="{ background: \'#f5f7fa\' }"
              >
                <el-table-column prop="testItemCategory" label="测试项分类" width="140" />
                <el-table-column prop="testItemName" label="测试项名称" min-width="220" />
                <el-table-column prop="testResult" label="测试结果" width="120">
                  <template #default="{ row }">
                    <span class="result-pill" :class="'result-pill--' + testResultClass(taskStatusAwareResult(row.testResult))">
                      {{ taskStatusAwareResult(row.testResult) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="详细日志" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="detail-log-cell">
                      <span v-if="row.detailMessage != null && row.detailMessage !== ''" class="detail-log-message">{{ row.detailMessage }}</span>
                      <el-button v-else-if="row.detailLogLink" link type="primary" size="small" @click="openDetailLog(row.detailLogLink)">查看</el-button>
                      <span v-else class="no-log">—</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else class="rules-empty">暂无检测规则数据</div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      </div>
    </template>

    <!-- 执行日志弹窗：步骤记录 + 每步 screenshotUrl 展示截图 -->
    <el-dialog
      v-model="executionLogVisible"
      title="执行日志"
      width="640px"
      destroy-on-close
      class="execution-log-dialog"
      @open="fetchExecutionLog"
      @close="executionLogSteps = []; executionLogError = ''; executionLogLevelFilter = ''"
    >
      <div v-loading="executionLogLoading" class="execution-log-body">
        <template v-if="executionLogError">
          <div class="execution-log-error">{{ executionLogError }}</div>
        </template>
        <template v-else>
          <div class="execution-log-steps">
            <div class="execution-log-steps-header">
              <span class="execution-log-section-title">步骤记录</span>
              <el-select
                v-model="executionLogLevelFilter"
                placeholder="日志级别"
                size="small"
                class="execution-log-level-filter"
                clearable
              >
                <el-option label="全部" value="" />
                <el-option label="Info" value="Info" />
                <el-option label="Error" value="Error" />
              </el-select>
            </div>
            <template v-if="filteredExecutionLogSteps.length">
              <div
                v-for="(item, index) in filteredExecutionLogSteps"
                :key="index"
                class="execution-log-step"
                :class="executionLogStepLevel(item) === 'Error' ? 'execution-log-step--fail' : 'execution-log-step--success'"
              >
                <span v-if="item.timestamp" class="step-time">{{ formatLogTime(item.timestamp) }}</span>
                <el-tag :type="executionLogStepLevel(item) === 'Error' ? 'danger' : 'info'" size="small" class="step-level-tag">
                  {{ executionLogStepLevel(item) }}
                </el-tag>
                <div class="step-content">
                  <span class="step-message-line">{{ formatLogMessage(item) }}</span>
                  <div v-if="executionLogStepLevel(item) === 'Error' && item.selector" class="step-selector">未定位到元素：{{ maskDeviceId(item.selector) }}</div>
                  <img
                    v-if="item.screenshotUrl"
                    :src="stepScreenshotSrc(item.screenshotUrl)"
                    :alt="item.step || '步骤截图'"
                    loading="lazy"
                    class="step-screenshot-img"
                    @error="hideStepScreenshot" />
                </div>
              </div>
            </template>
            <div v-else class="execution-log-empty">{{ executionLogSteps.length ? '当前筛选无记录' : '暂无步骤记录' }}</div>
          </div>
        </template>
      </div>
    </el-dialog>

    <!-- 遍历统计截图放大预览：支持左右切换浏览 -->
    <el-dialog
      v-model="perfScreenshotPreviewVisible"
      title="截图预览"
      width="360px"
      destroy-on-close
      class="perf-screenshot-preview-dialog"
      align-center
    >
      <div class="perf-screenshot-preview-body">
        <img
          :key="perfScreenshotPreviewIndex"
          :src="performanceScreenshotSrc(perfScreenshotPreviewIndex)"
          :alt="'截图 ' + perfScreenshotPreviewIndex"
          class="perf-screenshot-preview-img" />
        <div v-if="screenshotTimeLabel(perfScreenshotPreviewIndex)" class="perf-screenshot-preview-time">
          {{ screenshotTimeLabel(perfScreenshotPreviewIndex) }}
        </div>
        <div v-if="perfScreenshotPreviewCurrentOp" class="perf-screenshot-preview-op">
          {{ perfScreenshotPreviewCurrentOp.actionLabel }}
          <span v-if="perfScreenshotPreviewCurrentOp.pageName" class="perf-screenshot-preview-op-page">{{ perfScreenshotPreviewCurrentOp.pageName }}</span>
        </div>
      </div>
      <template v-if="perfScreenshotPreviewTotal > 1" #footer>
        <div class="perf-screenshot-preview-nav">
          <el-button
            :disabled="perfScreenshotPreviewIndex <= 0"
            :icon="ArrowLeft"
            size="small"
            @click="prevPerfScreenshot"
          >
            上一张
          </el-button>
          <span class="perf-screenshot-preview-counter">{{ perfScreenshotPreviewIndex + 1 }} / {{ perfScreenshotPreviewTotal }}</span>
          <el-button
            :disabled="perfScreenshotPreviewIndex >= perfScreenshotPreviewTotal - 1"
            :icon="ArrowRight"
            size="small"
            @click="nextPerfScreenshot"
          >
            下一张
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 执行结果截图放大预览：点击放大，支持左右滑动/按钮/键盘切换 -->
    <el-dialog
      v-model="overviewScreenshotPreviewVisible"
      title="执行结果截图"
      width="min(90vw, 420px)"
      destroy-on-close
      class="overview-screenshot-preview-dialog"
      align-center
      @open="onOverviewScreenshotPreviewOpen"
    >
      <div
        class="overview-screenshot-preview-body"
        @touchstart.passive="onOverviewPreviewTouchStart"
        @touchmove="onOverviewPreviewTouchMove"
        @touchend="onOverviewPreviewTouchEnd"
      >
        <img
          v-if="currentOverviewPreviewEntry"
          :key="overviewScreenshotPreviewIndex"
          :src="stepScreenshotSrc(currentOverviewPreviewEntry.screenshotUrl)"
          :alt="currentOverviewPreviewEntry.step || '步骤截图'"
          class="overview-screenshot-preview-img"
          draggable="false" />
        <div v-if="currentOverviewPreviewEntry?.step" class="overview-screenshot-preview-step">
          {{ currentOverviewPreviewEntry.step }}
        </div>
      </div>
      <template v-if="overviewPreviewList.length > 1" #footer>
        <div class="overview-screenshot-preview-nav">
          <el-button
            :disabled="overviewScreenshotPreviewIndex <= 0"
            :icon="ArrowLeft"
            size="small"
            @click="prevOverviewScreenshot"
          >
            上一张
          </el-button>
          <span class="overview-screenshot-preview-counter">{{ overviewScreenshotPreviewIndex + 1 }} / {{ overviewPreviewList.length }}</span>
          <el-button
            :disabled="overviewScreenshotPreviewIndex >= overviewPreviewList.length - 1"
            :icon="ArrowRight"
            size="small"
            @click="nextOverviewScreenshot"
          >
            下一张
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Loading, Document, Grid, Clock, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { apiClient } from '@/api'

type Overview = {
  taskId: string
  title: string
  remarks: string | null
  testType: string
  scenarioKey?: string | null
  scenarioName?: string | null
  status?: string | null
  executionStatus?: string | null
  appPackageName: string | null
  appVersion: string | null
  apiVersion: string | null
  startTime: string | null
  duration: string | null
  executor: string | null
  reportPath: string | null
  summarySectionTitle?: string | null
  executionVariables?: { phoneNumberMasked?: string; verificationCodeMasked?: string }
  compatibilitySummary: {
    actualTestItemCount: number
    passedCount: number
    failedCount: number
    warningCount: number
  } | null
  resultDistribution: Array<{
    categoryName: string
    passed?: number
    warning?: number
    failed?: number
    deviceDependent?: number
  }> | null
  testResultItems: Array<{
    testItemCategory: string
    testItemName: string
    testResult: string
    detailLogLink: string | null
    detailMessage: string | null
  }>
  /** 执行日志步骤列表，与任务详情/execution-log 结构一致；有则用此渲染执行日志弹窗 */
  executionLog?: Array<{ step: string; status?: string; level?: 'Info' | 'Error'; message?: string; selector?: string | null; timestamp?: string; screenshotUrl?: string | null }>
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const overview = ref<Overview | null>(null)
/** 延迟一帧再渲染概览内容，避免与 loading 切换同 tick 时 Element Plus 访问到已移除的 DOM（parentNode 报错） */
const overviewReady = ref(false)
const activeTab = ref('overview')

const executionLogVisible = ref(false)
const executionLogSteps = ref<Array<{ step: string; status?: 'success' | 'fail'; level?: 'Info' | 'Error'; message?: string; selector?: string | null; timestamp?: string; screenshotUrl?: string | null }>>([])
const executionLogLoading = ref(false)
const executionLogError = ref('')
const screenshotLoadError = ref(false)
const executionLogLevelFilter = ref<'Info' | 'Error' | ''>('')

/** 遍历统计截图放大预览 */
const perfScreenshotPreviewVisible = ref(false)
const perfScreenshotPreviewIndex = ref(0)
const perfScreenshotPreviewTotal = computed(() => performanceReport.value?.screenshotCount ?? 0)
const perfScreenshotPreviewCurrentOp = computed(() => perfScreenshotOperations.value[perfScreenshotPreviewIndex.value] ?? null)
function openPerfScreenshotPreview(index: number) {
  perfScreenshotPreviewIndex.value = index
  perfScreenshotPreviewVisible.value = true
}
function prevPerfScreenshot() {
  if (perfScreenshotPreviewIndex.value > 0) perfScreenshotPreviewIndex.value -= 1
}
function nextPerfScreenshot() {
  const total = performanceReport.value?.screenshotCount ?? 0
  if (perfScreenshotPreviewIndex.value < total - 1) perfScreenshotPreviewIndex.value += 1
}

/** 执行结果截图放大预览 */
const overviewScreenshotPreviewVisible = ref(false)
const overviewScreenshotPreviewIndex = ref(0)
const overviewPreviewList = computed(() => {
  if (overviewStepScreenshots.value.length) return overviewStepScreenshots.value
  if (screenshotUrl.value) return [{ screenshotUrl: screenshotUrl.value, step: '执行截图' }]
  return []
})
const currentOverviewPreviewEntry = computed(() => overviewPreviewList.value[overviewScreenshotPreviewIndex.value] ?? null)
function openOverviewScreenshotPreview(index: number) {
  if (!overviewPreviewList.value.length) return
  overviewScreenshotPreviewIndex.value = Math.max(0, Math.min(index, overviewPreviewList.value.length - 1))
  overviewScreenshotPreviewVisible.value = true
}
function onOverviewScreenshotPreviewOpen() {
  const n = overviewPreviewList.value.length
  if (n && overviewScreenshotPreviewIndex.value >= n) overviewScreenshotPreviewIndex.value = n - 1
}
function prevOverviewScreenshot() {
  if (overviewScreenshotPreviewIndex.value > 0) overviewScreenshotPreviewIndex.value -= 1
}
function nextOverviewScreenshot() {
  const n = overviewPreviewList.value.length
  if (overviewScreenshotPreviewIndex.value < n - 1) overviewScreenshotPreviewIndex.value += 1
}
/** 键盘左右键切换 */
function onOverviewScreenshotPreviewKeydown(e: KeyboardEvent) {
  if (!overviewScreenshotPreviewVisible.value || overviewPreviewList.value.length <= 1) return
  if (e.key === 'ArrowLeft') {
    prevOverviewScreenshot()
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    nextOverviewScreenshot()
    e.preventDefault()
  }
}
/** 触摸滑动：记录起始 X，touchend 时根据位移判断上一张/下一张 */
let overviewPreviewTouchStartX = 0
function onOverviewPreviewTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) overviewPreviewTouchStartX = e.touches[0].clientX
}
function onOverviewPreviewTouchMove(_e: TouchEvent) {
  // 不阻止默认，允许页面滚动；仅用 touchend 的 clientX 与 start 比较
}
function onOverviewPreviewTouchEnd(e: TouchEvent) {
  if (overviewPreviewList.value.length <= 1 || e.changedTouches.length !== 1) return
  const endX = e.changedTouches[0].clientX
  const delta = endX - overviewPreviewTouchStartX
  const threshold = 50
  if (delta > threshold) prevOverviewScreenshot()
  else if (delta < -threshold) nextOverviewScreenshot()
}

/** 性能报告锚点：点击滚动到对应区块（同一页内） */
function scrollToPerfSection(name: 'overall' | 'traversal' | 'resource' | 'operations') {
  perfReportTab.value = name
  const el = document.getElementById('perf-section-' + name)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 性能报告（性能基础质量测试任务时拉取） */
const performanceReport = ref<Awaited<ReturnType<typeof apiClient.getPerformanceReport>> | null>(null)
const performanceReportLoading = ref(false)
const performanceReportError = ref('')
const perfReportTab = ref<'overall' | 'traversal' | 'resource' | 'operations'>('overall')
const resourceSubTab = ref<'cpu' | 'memory' | 'network' | 'temperature'>('cpu')
/** 当前选中的子指标（可点击切换）；仅展示有内容的子项 */
const cpuMetricActive = ref('应用CPU负载占比')
const memoryMetricActive = ref('应用内存')
const networkMetricActive = ref('下行速率')
const temperatureMetricActive = ref('前壳温度')
const issueDonutRef = ref<HTMLElement | null>(null)
const resourceLineRef = ref<HTMLElement | null>(null)
const memoryLineRef = ref<HTMLElement | null>(null)
const networkLineRef = ref<HTMLElement | null>(null)
const temperatureLineRef = ref<HTMLElement | null>(null)
let issueDonutChart: echarts.ECharts | null = null
let resourceLineChart: echarts.ECharts | null = null
let memoryLineChart: echarts.ECharts | null = null
let networkLineChart: echarts.ECharts | null = null
let temperatureLineChart: echarts.ECharts | null = null

const taskId = computed(() => (route.params.id as string) || '')

/** 轮询定时器：任务执行中时轮询 GET task detail，完成后停止并刷新概览 */
let pollTimerId: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL_MS = 3000
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'STOPPED']

function clearPolling() {
  if (pollTimerId != null) {
    clearInterval(pollTimerId)
    pollTimerId = null
  }
}

/** 轮询任务状态：使用 GET /api/tasks/{id} 获取最新 status，长压测期间每 3～5 秒请求一次，终态时停止并刷新概览 */
async function pollTaskStatus() {
  const id = taskId.value
  if (!id) return
  try {
    const task = await apiClient.getTask(id)
    const status = (task?.status ?? '').toUpperCase()
    const execStatus = (task?.executionStatus ?? '').toUpperCase()
    if (TERMINAL_STATUSES.includes(status) || TERMINAL_STATUSES.includes(execStatus)) {
      clearPolling()
      await loadOverview()
    }
  } catch (_) {
    // 忽略单次轮询失败，继续轮询
  }
}

function startPollingIfNeeded() {
  clearPolling()
  const status = (overview.value?.status ?? overview.value?.executionStatus ?? '').toUpperCase()
  if (status !== 'RUNNING' && status !== 'PENDING') return
  pollTimerId = setInterval(pollTaskStatus, POLL_INTERVAL_MS)
}

const screenshotUrl = computed(() => (taskId.value ? apiClient.getFunctionalTestTaskScreenshotUrl(taskId.value) : ''))

/** 执行日志兜底：当 overview 的 executionLog 为空时，尝试从 execution-log 或任务详情接口获取（后端可能未在 overview 中返回） */
const executionLogFallback = ref<Array<{ step: string; message?: string; timestamp?: string; level?: string; status?: string; selector?: string | null; screenshotUrl?: string | null }>>([])

/** 概览中带截图的执行日志条目（用于「执行结果截图」区：对每条有 screenshotUrl 的日志展示对应截图） */
const overviewStepScreenshots = computed(() => {
  const fromOverview = normalizeExecutionLogList(overview.value?.executionLog ?? [])
  const list = fromOverview.length > 0 ? fromOverview : normalizeExecutionLogList(executionLogFallback.value)
  return list.filter((entry): entry is typeof entry & { screenshotUrl: string } => !!(entry.screenshotUrl && (entry.screenshotUrl as string).trim()))
})

/** 是否可确定任务已处于终态（已完成/失败/停止），仅此时才展示具体错误；否则一律显示「暂无结果」避免出现 Network error */
const isTaskTerminalState = computed(() => {
  const status = (overview.value?.status ?? overview.value?.executionStatus ?? '').toUpperCase()
  return status === 'COMPLETED' || status === 'FAILED' || status === 'STOPPED'
})

/** 性能报告无数据时的提示文案：仅当任务已处于终态时显示具体错误，其余（运行中/未运行/状态未知）均显示「暂无结果」 */
const performanceReportEmptyMessage = computed(() => {
  if (!isTaskTerminalState.value) return '暂无结果'
  return performanceReportError.value || '暂无性能报告数据'
})

/** 页面标题：有 scenarioName 时展示「测试类型 - 场景名」，否则用 title/testType（兼容旧任务无场景） */
const pageTitle = computed(() => {
  const ov = overview.value
  if (!ov) return '任务详情'
  const scenarioName = (ov.scenarioName || '').trim()
  if (scenarioName) return `${ov.testType || '任务'} - ${scenarioName}`
  return ov.title || ov.testType || '任务详情'
})

function formatTaskId(id: string) {
  if (!id) return '—'
  return id.startsWith('Task-') ? id : 'Task-' + id
}

/** 开始时间格式化为 yyyy-MM-dd HH:mm:ss */
function formatStartTime(isoOrNull: string | null | undefined): string {
  if (!isoOrNull) return '—'
  const date = new Date(isoOrNull)
  if (isNaN(date.getTime())) return '—'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/** 是否为性能基础质量测试任务（用于展示性能报告与简化达标率区块） */
const isPerformanceTask = computed(() => {
  const t = (overview.value?.testType || '').trim()
  const title = (overview.value?.summarySectionTitle || '').trim()
  return /性能/.test(t) || title === '性能测试结果'
})

// 概览达标率区块标题：优先用接口 summarySectionTitle，否则按 testType 推断
const overviewSummaryTitle = computed(() => {
  const fromApi = overview.value?.summarySectionTitle
  if (fromApi != null && String(fromApi).trim()) return String(fromApi).trim()
  const t = (overview.value?.testType || '').trim()
  if (/性能/.test(t)) return '性能测试结果'
  if (/功能体验|功能质量/.test(t)) return '功能质量达标率'
  if (/兼容性|兼容/.test(t)) return '兼容性满足度'
  return t ? '达标率' : '兼容性满足度'
})

const overviewSummaryShortLabel = computed(() => {
  const t = (overview.value?.testType || '').trim()
  if (/性能/.test(t)) return '性能'
  if (/功能体验|功能质量/.test(t)) return '达标率'
  if (/兼容性|兼容/.test(t)) return '兼容性'
  return t ? '达标率' : '兼容性'
})

// 使用 compatibilitySummary，无则给默认值
const compatibilitySummary = computed(() => {
  const s = overview.value?.compatibilitySummary
  if (s) return s
  return {
    actualTestItemCount: 0,
    passedCount: 0,
    failedCount: 0,
    warningCount: 0
  }
})

/** 性能任务且无达标率数据时，不展示环形图，改为提示文案 */
const showCompatibilityCircle = computed(() => {
  if (!isPerformanceTask.value) return true
  const s = compatibilitySummary.value
  return (s.actualTestItemCount ?? 0) > 0
})

const compatibilityPercent = computed(() => {
  const total = compatibilitySummary.value.actualTestItemCount
  if (!total) return 0
  return Math.round((compatibilitySummary.value.passedCount / total) * 100)
})

// 测试结果分布：使用 resultDistribution，并计算每项 total
const resultDistributionList = computed(() => {
  const list = overview.value?.resultDistribution ?? []
  return list.map((item) => {
    const total =
      (item.passed ?? 0) + (item.warning ?? 0) + (item.failed ?? 0) + (item.deviceDependent ?? 0)
    return { ...item, total }
  })
})

function barWidth(n: number, total: number) {
  if (!total || total <= 0) return 0
  return Math.max(0, (n / total) * 100)
}

/** 内存 KB 格式化：≥1024 显示 MB，否则 KB */
function formatMemoryKb(kb: number | undefined | null): string {
  if (kb == null || Number.isNaN(kb)) return '—'
  if (kb >= 1024) return (kb / 1024).toFixed(2) + ' MB'
  return kb + ' KB'
}

/** 资源数据-表格数值格式化：避免错位或过长，数字保留最多 2 位小数 */
function formatResourceValue(v: number | string | undefined | null): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'string') return v
  if (Number.isNaN(v)) return '—'
  if (Number.isInteger(v)) return String(v)
  return Number(v).toFixed(2)
}

/** 操作详情-维测数据展示：字符串原样，对象 JSON 短显，空为 — */
function formatDimensionData(v: string | Record<string, unknown> | null | undefined): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v.trim() || '—'
  try {
    const s = JSON.stringify(v)
    return s.length > 80 ? s.slice(0, 77) + '...' : s
  } catch {
    return '—'
  }
}

/** 操作详情-卡顿/音视频/黑白块：白屏时长、黑白块、卡顿/音视频（后端暂未采集显示 —） */
function formatOperationIssueSummary(row: { whiteScreenMs?: number | null; blackWhiteBlockCount?: number | null }): string {
  const white = row.whiteScreenMs != null ? `${row.whiteScreenMs}ms` : '0ms'
  const block = row.blackWhiteBlockCount != null ? String(row.blackWhiteBlockCount) : '—'
  return `白屏: ${white}；黑白块: ${block}；卡顿/音视频: —`
}

/** 操作详情-维测数据：优先展示该步 CPU 均值、内存 PSS（doc 5.4），有 dimensionData 时一并展示 */
function formatOperationDimension(row: {
  cpuAvgDuringStep?: number | null
  memoryPssKbDuringStep?: number | null
  dimensionData?: string | Record<string, unknown> | null
}): string {
  const cpu = row.cpuAvgDuringStep != null ? `${row.cpuAvgDuringStep}%` : '—'
  const mem = row.memoryPssKbDuringStep != null ? `${row.memoryPssKbDuringStep} KB` : '—'
  const base = `CPU均: ${cpu}, 内存: ${mem}`
  const dim = formatDimensionData(row.dimensionData)
  if (dim !== '—') return `${base}；${dim}`
  return base
}

/** 整体评估-问题类型颜色（与参考图一致：浅蓝/青绿/浅橙/灰/黄，每种区分） */
const ISSUE_TYPE_COLORS: Record<string, string> = {
  响应时延: '#6eb5e0',
  完成时延: '#4db6ac',
  卡顿: '#ffb74d',
  黑白块: '#9e9e9e',
  音视频: '#f2c94c',
  其他: '#909399',
  问题总数: '#909399'
}

/** 整体评估-问题分布环形图图例（响应时延、完成时延、卡顿、黑白块、音视频，与后端 issueSummary 一致） */
const issueDonutLegend = computed(() => {
  const report = performanceReport.value
  if (!report?.issueSummary) return []
  const total = report.issueSummary.totalIssueCount ?? 0
  const resp = report.issueSummary.responseDelayCount ?? 0
  const comp = report.issueSummary.completionDelayCount ?? 0
  const stutter = report.issueSummary.stutterCount ?? 0
  const bw = report.issueSummary.blackWhiteBlockCount ?? 0
  const av = report.issueSummary.avCount ?? 0
  const list: { name: string; value: number; color: string }[] = []
  if (resp > 0) list.push({ name: '响应时延', value: resp, color: ISSUE_TYPE_COLORS['响应时延'] })
  if (comp > 0) list.push({ name: '完成时延', value: comp, color: ISSUE_TYPE_COLORS['完成时延'] })
  if (stutter > 0) list.push({ name: '卡顿', value: stutter, color: ISSUE_TYPE_COLORS['卡顿'] })
  if (bw > 0) list.push({ name: '黑白块', value: bw, color: ISSUE_TYPE_COLORS['黑白块'] })
  if (av > 0) list.push({ name: '音视频', value: av, color: ISSUE_TYPE_COLORS['音视频'] })
  const other = total - resp - comp - stutter - bw - av
  if (other > 0) list.push({ name: '其他', value: other, color: ISSUE_TYPE_COLORS['其他'] })
  if (list.length === 0 && total > 0) list.push({ name: '问题总数', value: total, color: ISSUE_TYPE_COLORS['问题总数'] })
  return list
})

/** 整体评估-按操作类型的问题统计表行（后端 byOperationType 键为「启动操作」「滑动操作」「点击操作」「观看视频」） */
const issueTableRows = computed(() => {
  const report = performanceReport.value
  if (!report) return []
  const byOp = report.issueSummary?.byOperationType ?? {}
  const row = (label: string, count: number, v: { responseDelayCount?: number; completionDelayCount?: number; stutterCount?: number; avCount?: number; blackWhiteBlockCount?: number } | undefined) => {
    const o = v ?? {}
    return {
      opLabel: `${label}(${count})`,
      responseDelay: o.responseDelayCount ?? 0,
      completionDelay: o.completionDelayCount ?? 0,
      stutter: o.stutterCount ?? 0,
      av: o.avCount ?? 0,
      bw: o.blackWhiteBlockCount ?? 0
    }
  }
  return [
    row('启动操作', report.launchCount ?? 0, byOp['启动操作']),
    row('滑动操作', report.swipeCount ?? 0, byOp['滑动操作']),
    row('点击操作', report.clickCount ?? 0, byOp['点击操作']),
    row('观看视频', 0, byOp['观看视频'])
  ]
})

/** 资源数据-CPU 汇总行（与图表一致：从 resourceSamples 计算前台/后台的峰值、最小值、平均值，保证「前台峰值」「后台峰值」与图中一致） */
const cpuSummaryRows = computed(() => {
  const report = performanceReport.value
  const samples = report?.resourceSamples as Array<{ cpuPercent?: number; cpuPercentForeground?: number; cpuPercentBackground?: number }> | undefined
  if (samples?.length) {
    const fg = samples.map((s) => s.cpuPercentForeground ?? s.cpuPercent ?? 0)
    const bg = samples.map((s) => s.cpuPercentBackground ?? 0)
    const toStat = (arr: number[]) => {
      if (!arr.length) return { peak: 0, min: 0, avg: 0 }
      const peak = Math.max(...arr)
      const min = Math.min(...arr)
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length
      return { peak, min, avg }
    }
    const fmt = (v: number) => (v == null ? '—' : Number(v.toFixed(2)))
    const fStat = toStat(fg)
    const bStat = toStat(bg)
    return [
      { name: '前台', peak: fmt(fStat.peak), min: fmt(fStat.min), avg: fmt(fStat.avg) },
      { name: '后台', peak: fmt(bStat.peak), min: fmt(bStat.min), avg: fmt(bStat.avg) }
    ]
  }
  const cpu = report?.resourceSummary?.cpuApp as { peak?: number; min?: number; avg?: number; foreground?: { peak?: number; min?: number; avg?: number }; background?: { peak?: number; min?: number; avg?: number } } | undefined
  if (!cpu) return []
  const f = cpu.foreground ?? cpu
  const b = cpu.background
  return [
    { name: '前台', peak: f.peak ?? '—', min: f.min ?? '—', avg: f.avg ?? '—' },
    { name: '后台', peak: b?.peak ?? 0, min: b?.min ?? 0, avg: b?.avg ?? 0 }
  ]
})

/** 资源数据-峰值步骤：operations 中 cpuAvgDuringStep 最大的一项，含 actionLabel 供参考图格式展示 */
const peakCpuStep = computed(() => {
  const ops = performanceReport.value?.operations
  if (!ops?.length) return null
  let max = -1
  let found: { index: number; type: string; actionLabel?: string | null } | null = null
  for (const o of ops) {
    const v = o.cpuAvgDuringStep ?? -1
    if (v > max) {
      max = v
      found = { index: o.index, type: o.type || '—', actionLabel: o.actionLabel ?? null }
    }
  }
  return found
})

/** 资源数据-内存汇总行（与图表一致：从 resourceSamples 计算前台/后台的峰值、最小值、平均值 MB） */
const memorySummaryRows = computed(() => {
  const report = performanceReport.value
  const samples = report?.resourceSamples as Array<{ memoryPssKb?: number; memoryPssKbForeground?: number; memoryPssKbBackground?: number }> | undefined
  if (samples?.length) {
    const fgKb = samples.map((s) => (s.memoryPssKbForeground ?? s.memoryPssKb ?? 0))
    const bgKb = samples.map((s) => s.memoryPssKbBackground ?? 0)
    const toStat = (arr: number[]) => {
      if (!arr.length) return { peak: 0, min: 0, avg: 0 }
      return {
        peak: Math.max(...arr),
        min: Math.min(...arr),
        avg: arr.reduce((a, b) => a + b, 0) / arr.length
      }
    }
    const toMb = (v: number) => (v == null ? '—' : (v / 1024).toFixed(2))
    const fStat = toStat(fgKb)
    const bStat = toStat(bgKb)
    return [
      { name: '前台', peak: toMb(fStat.peak), min: toMb(fStat.min), avg: toMb(fStat.avg) },
      { name: '后台', peak: toMb(bStat.peak), min: toMb(bStat.min), avg: toMb(bStat.avg) }
    ]
  }
  const mem = report?.resourceSummary?.memoryPss as { peak?: number; min?: number; avg?: number; foreground?: { peak?: number; min?: number; avg?: number }; background?: { peak?: number; min?: number; avg?: number } } | undefined
  if (!mem) return []
  const toMb = (v: number | undefined) => (v != null ? (v / 1024).toFixed(2) : '—')
  const f = mem.foreground ?? mem
  const b = mem.background
  return [
    { name: '前台', peak: toMb(f.peak), min: toMb(f.min), avg: toMb(f.avg) },
    { name: '后台', peak: b ? toMb(b.peak) : '0.00', min: b ? toMb(b.min) : '0.00', avg: b ? toMb(b.avg) : '0.00' }
  ]
})

/** 资源数据-内存峰值步骤：operations 中 memoryPssKbDuringStep 最大的一项 */
const peakMemoryStep = computed(() => {
  const ops = performanceReport.value?.operations
  if (!ops?.length) return null
  let max = -1
  let found: { index: number; type: string; actionLabel?: string | null } | null = null
  for (const o of ops) {
    const v = o.memoryPssKbDuringStep ?? -1
    if (v > max) {
      max = v
      found = { index: o.index, type: o.type || '—', actionLabel: o.actionLabel ?? null }
    }
  }
  return found
})

/** 资源数据-子选项完整列表（全部展示，有数据的可点击，无数据的置灰）；有 resourceSummary 或 resourceSamples 中有 CPU 数据即可点 */
const cpuMetricOptions = computed(() => {
  const report = performanceReport.value
  const hasCpuFromSummary = !!(report?.resourceSummary?.cpuApp)
  const hasCpuFromSamples = (report?.resourceSamples?.length && (report.resourceSamples as any[]).some((s: any) => s.cpuPercent != null || s.cpuPercentForeground != null)) ?? false
  const hasCpuApp = hasCpuFromSummary || hasCpuFromSamples
  return [
    { id: '应用CPU负载占比', label: '应用CPU负载占比', hasData: hasCpuApp },
    { id: '应用CPU使用率', label: '应用CPU使用率', hasData: false },
    { id: '整机CPU使用率', label: '整机CPU使用率', hasData: false },
    { id: 'CPU0频率', label: 'CPU0频率', hasData: false },
    { id: 'CPU4频率', label: 'CPU4频率', hasData: false },
    { id: 'CPU10频率', label: 'CPU10频率', hasData: false }
  ]
})

const memoryMetricOptions = computed(() => {
  const report = performanceReport.value
  const hasMemFromSummary = !!(report?.resourceSummary?.memoryPss)
  const hasMemFromSamples = (report?.resourceSamples?.length && (report.resourceSamples as any[]).some((s: any) => s.memoryPssKb != null || s.memoryPssKbForeground != null)) ?? false
  const hasMem = hasMemFromSummary || hasMemFromSamples
  return [
    { id: '应用内存', label: '应用内存', hasData: hasMem },
    { id: '堆内存', label: '堆内存', hasData: false },
    { id: 'gpu内存', label: 'gpu内存', hasData: false },
    { id: '图形内存', label: '图形内存', hasData: false },
    { id: 'arkts 内存', label: 'arkts 内存', hasData: false },
    { id: 'native 内存', label: 'native 内存', hasData: false },
    { id: '栈内存', label: '栈内存', hasData: false },
    { id: '整机可用内存', label: '整机可用内存', hasData: false },
    { id: '整机空闲内存', label: '整机空闲内存', hasData: false }
  ]
})

const networkMetricOptions = computed(() => {
  const hasNet = hasNetworkData.value
  return [
    { id: '下行速率', label: '下行速率', hasData: hasNet },
    { id: '上行速率', label: '上行速率', hasData: hasNet },
    { id: '应用流量上行速率', label: '应用流量上行速率', hasData: false },
    { id: '应用流量下行速率', label: '应用流量下行速率', hasData: false }
  ]
})

const temperatureMetricOptions = computed(() => {
  const hasTemp = hasTemperatureData.value
  return [
    { id: '前壳温度', label: '前壳温度', hasData: hasTemp },
    { id: '后壳温度', label: '后壳温度', hasData: false },
    { id: '芯片温度', label: '芯片温度', hasData: false }
  ]
})

/** 同步子指标选中项：当前选中无数据时切到第一个有数据的 */
function syncResourceMetricActive() {
  const cpuFirst = cpuMetricOptions.value.find((o) => o.hasData)?.id
  if (cpuFirst && !cpuMetricOptions.value.find((o) => o.id === cpuMetricActive.value)?.hasData) cpuMetricActive.value = cpuFirst
  const memFirst = memoryMetricOptions.value.find((o) => o.hasData)?.id
  if (memFirst && !memoryMetricOptions.value.find((o) => o.id === memoryMetricActive.value)?.hasData) memoryMetricActive.value = memFirst
  const netFirst = networkMetricOptions.value.find((o) => o.hasData)?.id
  if (netFirst && !networkMetricOptions.value.find((o) => o.id === networkMetricActive.value)?.hasData) networkMetricActive.value = netFirst
  const tempFirst = temperatureMetricOptions.value.find((o) => o.hasData)?.id
  if (tempFirst && !temperatureMetricOptions.value.find((o) => o.id === temperatureMetricActive.value)?.hasData) temperatureMetricActive.value = tempFirst
}

/** 是否有网络数据（resourceSamples 或 resourceSummary） */
const hasNetworkData = computed(() => {
  const report = performanceReport.value
  if (!report) return false
  const samples = report.resourceSamples
  if (samples?.some((s) => s.networkRxBytes != null || s.networkTxBytes != null)) return true
  const sum = report.resourceSummary
  return !!(sum?.networkRxBytes || sum?.networkTxBytes)
})

/** 资源数据-网络速率汇总（Kb/s）：从 resourceSummary 或由 samples 计算 */
const networkSummaryRows = computed(() => {
  const report = performanceReport.value
  const sum = report?.resourceSummary
  const samples = report?.resourceSamples ?? []
  const rows: { name: string; peak: string; min: string; avg: string }[] = []
  if (sum?.networkRxBytes && (sum.networkRxBytes.peak != null || sum.networkRxBytes.avg != null)) {
    rows.push({
      name: '下行(接收)',
      peak: formatResourceValue(sum.networkRxBytes.peak),
      min: formatResourceValue(sum.networkRxBytes.min),
      avg: formatResourceValue(sum.networkRxBytes.avg)
    })
  }
  if (sum?.networkTxBytes && (sum.networkTxBytes.peak != null || sum.networkTxBytes.avg != null)) {
    rows.push({
      name: '上行(发送)',
      peak: formatResourceValue(sum.networkTxBytes.peak),
      min: formatResourceValue(sum.networkTxBytes.min),
      avg: formatResourceValue(sum.networkTxBytes.avg)
    })
  }
  if (rows.length > 0) return rows
  if (samples.length < 2) return []
  let maxRx = 0, minRx = 0, sumRx = 0, countRx = 0
  let maxTx = 0, minTx = 0, sumTx = 0, countTx = 0
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].timestampMs - samples[i - 1].timestampMs) / 1000
    if (dt <= 0) continue
    const rx = samples[i].networkRxBytes != null && samples[i - 1].networkRxBytes != null
      ? ((samples[i].networkRxBytes - samples[i - 1].networkRxBytes) * 8) / (dt * 1000)
      : 0
    const tx = samples[i].networkTxBytes != null && samples[i - 1].networkTxBytes != null
      ? ((samples[i].networkTxBytes - samples[i - 1].networkTxBytes) * 8) / (dt * 1000)
      : 0
    if (samples[i].networkRxBytes != null) {
      maxRx = countRx === 0 ? rx : Math.max(maxRx, rx)
      minRx = countRx === 0 ? rx : Math.min(minRx, rx)
      sumRx += rx
      countRx++
    }
    if (samples[i].networkTxBytes != null) {
      maxTx = countTx === 0 ? tx : Math.max(maxTx, tx)
      minTx = countTx === 0 ? tx : Math.min(minTx, tx)
      sumTx += tx
      countTx++
    }
  }
  if (countRx > 0) rows.push({ name: '下行(接收)', peak: maxRx.toFixed(2), min: minRx.toFixed(2), avg: (sumRx / countRx).toFixed(2) })
  if (countTx > 0) rows.push({ name: '上行(发送)', peak: maxTx.toFixed(2), min: minTx.toFixed(2), avg: (sumTx / countTx).toFixed(2) })
  return rows
})

/** 是否有温度数据 */
const hasTemperatureData = computed(() => {
  const report = performanceReport.value
  if (!report) return false
  if (report.resourceSamples?.some((s) => s.temperatureTenthsC != null)) return true
  return !!(report.resourceSummary?.temperature && (report.resourceSummary.temperature.peak != null || report.resourceSummary.temperature.avg != null))
})

/** 资源数据-温度汇总（℃） */
const temperatureSummaryRows = computed(() => {
  const temp = performanceReport.value?.resourceSummary?.temperature
  if (!temp || (temp.peak == null && temp.avg == null)) return []
  return [{
    peak: formatResourceValue(temp.peak),
    min: formatResourceValue(temp.min),
    avg: formatResourceValue(temp.avg)
  }]
})

/** 性能测试第 i 张截图 URL（与 performance-report 同 taskId，index 来自 operations[i].screenshotBeforeIndex/screenshotAfterIndex） */
function performanceScreenshotSrc(index: number): string {
  return apiClient.getPerformanceScreenshotUrl(taskId.value, index)
}

/** 截图时间轴文案：从 screenshotTimeline 取 timestampMs 格式化为 HH:mm:ss */
function screenshotTimeLabel(index: number): string {
  const timeline = performanceReport.value?.screenshotTimeline
  if (!timeline?.length) return ''
  const entry = timeline.find((e) => e.index === index)
  if (entry?.timestampMs == null) return ''
  const d = new Date(entry.timestampMs)
  if (isNaN(d.getTime())) return ''
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/** 截图时间点对应的操作（用于遍历条展示：在哪个页面、执行了什么操作） */
function screenshotOperationAt(screenshotIndex: number): { actionLabel: string; pageName?: string } | null {
  const report = performanceReport.value
  const timeline = report?.screenshotTimeline
  const ops = report?.operations
  if (!timeline?.length || !ops?.length) return null
  const entry = timeline.find((e) => e.index === screenshotIndex)
  const ts = entry?.timestampMs
  if (ts == null) return null
  const op = ops.find((o) => ts >= o.startTimeMs && ts <= o.endTimeMs)
  if (!op) return null
  const label = (op.actionLabel || op.type || '').trim()
  if (!label) return null
  return { actionLabel: label, pageName: (op.pageName || '').trim() || undefined }
}

/** 遍历条中每张截图对应的操作（按截图 index 缓存，避免模板重复计算） */
const perfScreenshotOperations = computed(() => {
  const n = performanceReport.value?.screenshotCount ?? 0
  const list: ({ actionLabel: string; pageName?: string } | null)[] = []
  for (let i = 0; i < n; i++) list.push(screenshotOperationAt(i))
  return list
})

function onPerfScreenshotError(e: Event, _index: number) {
  const el = (e.target as HTMLImageElement)
  if (el) el.style.display = 'none'
}

/** 任务未执行/待执行/运行中时检测规则表格不展示结果数据，展示空（—）；仅终态展示真实结果（const 确保模板/表格插槽内可访问） */
const taskStatusAwareResult = (rowTestResult: string): string => {
  const status = (overview.value?.status ?? overview.value?.executionStatus ?? '').toUpperCase()
  if (!TERMINAL_STATUSES.includes(status)) return '—' // 未执行、待执行、运行中等：数据未就绪，显示空
  return (rowTestResult || '').trim() || '—' // 终态（已完成/失败/已停止）时显示真实结果或空
}

const testResultClass = (result: string): string => {
  if (!result) return 'info'
  const r = result.trim()
  if (r === '通过') return 'passed'
  if (r === '不通过') return 'failed'
  if (r === '告警') return 'warning'
  if (r === '设备依赖') return 'device'
  // 未执行/待执行/执行中/空 都显示中性色
  if (r === '未执行' || r === '待执行' || r === '执行中' || r === '—') return 'info'
  return 'info'
}

/** 单条日志的 level：优先用 level，否则 status 映射 success→Info、fail→Error */
function executionLogStepLevel(item: { level?: string; status?: string }): 'Info' | 'Error' {
  if (item.level === 'Info' || item.level === 'Error') return item.level
  return (item.status || '').toLowerCase() === 'fail' ? 'Error' : 'Info'
}

/** 设备 ID 脱敏：前 4 位 + **** + 后 4 位（如 23E00020 → 23E0****0020），仅对 8 位及以上十六进制段脱敏 */
function maskDeviceId(text: string): string {
  if (!text || typeof text !== 'string') return text
  return text.replace(/([0-9A-Fa-f]{4})[0-9A-Fa-f]{1,}([0-9A-Fa-f]{4})/g, (_, head, tail) => head + '****' + tail)
}

/** 执行日志主文案：优先 message，为空时用 step（与参考格式一致），并对设备 ID 脱敏 */
function formatLogMessage(item: { step?: string; message?: string }): string {
  const msg = (item.message || '').trim()
  const step = (item.step || '').trim()
  const main = msg || step || '—'
  return maskDeviceId(main)
}

/** 执行日志时间格式：yyyy-MM-dd HH:mm:ss */
function formatLogTime(timestamp: string | undefined): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/** 步骤截图完整 URL：baseUrl + entry.screenshotUrl */
function stepScreenshotSrc(screenshotUrl: string): string {
  const base = apiClient.getBaseUrl()
  const path = (screenshotUrl || '').trim()
  if (!path) return ''
  return path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path)
}

function hideStepScreenshot(e: Event) {
  const el = (e.target as HTMLImageElement)
  if (el) el.style.display = 'none'
}

/** 按 level 筛选后的执行日志列表 */
const filteredExecutionLogSteps = computed(() => {
  const list = executionLogSteps.value
  const level = executionLogLevelFilter.value
  if (!level) return list
  return list.filter((item) => executionLogStepLevel(item) === level)
})

function onExecutionLog() {
  executionLogVisible.value = true
}

/** 查看报告：使用截图接口 URL 在新窗口打开（与页面内截图 img 同源），不用 reportPath 或文件名（const 确保模板内可访问） */
const openScreenshotReport = () => {
  const id = taskId.value
  if (!id) return
  const url = apiClient.getFunctionalTestTaskScreenshotUrl(id)
  window.open(url, '_blank')
}

/** 从接口返回值中解析出执行日志步骤数组（兼容 data / steps / executionLog 或直接为数组），保留 screenshotUrl */
function normalizeExecutionLogList(raw: any): Array<{ step: string; message?: string; timestamp?: string; level?: string; status?: string; selector?: string | null; screenshotUrl?: string | null }> {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const arr = raw.data ?? raw.steps ?? raw.executionLog ?? raw.list
    if (Array.isArray(arr)) return arr
  }
  return []
}

/** 执行日志：优先用 overview 返回的 executionLog（与任务详情/execution-log 结构一致），无则请求任务详情或 execution-log 接口（当前任务 ID） */
async function fetchExecutionLog() {
  const id = taskId.value
  if (!id) {
    executionLogError.value = '缺少任务 ID'
    return
  }
  executionLogError.value = ''
  if (overview.value && Array.isArray(overview.value.executionLog)) {
    executionLogSteps.value = normalizeExecutionLogList(overview.value.executionLog)
    return
  }
  executionLogLoading.value = true
  try {
    let list: any[] = []
    try {
      const taskDetail = await apiClient.getFunctionalTestTask(id)
      list = normalizeExecutionLogList(taskDetail?.executionLog)
    } catch (_) {}
    if (list.length === 0) {
      const raw = await apiClient.getFunctionalTestTaskExecutionLog(id)
      list = normalizeExecutionLogList(raw)
    }
    executionLogSteps.value = list
  } catch (e: any) {
    if (e?.message && (e.message.includes('404') || e.message.includes('Not Found'))) {
      executionLogError.value = '暂无执行日志'
    } else {
      executionLogError.value = e?.message || '加载执行日志失败'
    }
    executionLogSteps.value = []
  } finally {
    executionLogLoading.value = false
  }
}

function openDetailLog(link: string) {
  if (link?.startsWith('http')) {
    window.open(link, '_blank')
  } else {
    ElMessage.info(link || '暂无详细日志')
  }
}

/** 整体评估-问题分布环形图 */
function updateIssueDonutChart() {
  const el = issueDonutRef.value
  const report = performanceReport.value
  if (!el || !report) return
  if (!issueDonutChart) {
    issueDonutChart = echarts.init(el)
  }
  const total = report.issueSummary?.totalIssueCount ?? 0
  const resp = report.issueSummary?.responseDelayCount ?? 0
  const comp = report.issueSummary?.completionDelayCount ?? 0
  const stutter = report.issueSummary?.stutterCount ?? 0
  const bw = report.issueSummary?.blackWhiteBlockCount ?? 0
  const av = report.issueSummary?.avCount ?? 0
  const data: { value: number; name: string; itemStyle: { color: string } }[] = []
  if (resp > 0) data.push({ value: resp, name: '响应时延', itemStyle: { color: ISSUE_TYPE_COLORS['响应时延'] } })
  if (comp > 0) data.push({ value: comp, name: '完成时延', itemStyle: { color: ISSUE_TYPE_COLORS['完成时延'] } })
  if (stutter > 0) data.push({ value: stutter, name: '卡顿', itemStyle: { color: ISSUE_TYPE_COLORS['卡顿'] } })
  if (bw > 0) data.push({ value: bw, name: '黑白块', itemStyle: { color: ISSUE_TYPE_COLORS['黑白块'] } })
  if (av > 0) data.push({ value: av, name: '音视频', itemStyle: { color: ISSUE_TYPE_COLORS['音视频'] } })
  const other = total - resp - comp - stutter - bw - av
  if (other > 0) data.push({ value: other, name: '其他', itemStyle: { color: ISSUE_TYPE_COLORS['其他'] } })
  if (data.length === 0 && total > 0) data.push({ value: total, name: '问题', itemStyle: { color: ISSUE_TYPE_COLORS['问题总数'] } })
  const option: EChartsOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: total ? `{b}\n{c}次` : '' },
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } }
      }
    ]
  }
  if (total > 0) {
    option.graphic = [
      { type: 'text', left: 'center', top: 'center', style: { text: `${total}\n问题总数`, fontSize: 14, fontWeight: 'bold', textAlign: 'center' } }
    ]
  }
  issueDonutChart.setOption(option, true)
}

/** 资源数据-时间轴格式（与参考图一致：HH:mm:ss.SSS） */
function formatChartTime(timestampMs: number): string {
  const d = new Date(timestampMs)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/** 资源数据-CPU 曲线（参考图：网格线、图例在上、双线、下箭头峰值标记、底部时间范围条） */
function updateResourceLineChart() {
  const el = resourceLineRef.value
  const report = performanceReport.value
  if (!el || !report?.resourceSamples?.length) return
  if (!resourceLineChart) resourceLineChart = echarts.init(el)
  const samples = report.resourceSamples as Array<{ timestampMs: number; cpuPercent?: number; cpuPercentForeground?: number; cpuPercentBackground?: number }>
  const xData = samples.map((s) => formatChartTime(s.timestampMs))
  const foregroundData = samples.map((s) => s.cpuPercentForeground ?? s.cpuPercent ?? 0)
  const backgroundData = samples.map((s) => s.cpuPercentBackground ?? 0)
  const fgMax = Math.max(0, ...foregroundData)
  const bgMax = Math.max(0, ...backgroundData)
  const peakLabel = { position: 'right' as const, fontSize: 11, distance: 8 }
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['应用CPU负载占比-前台', '应用CPU负载占比-后台'], top: 6, left: 12, itemGap: 24, itemWidth: 20, itemHeight: 12, textStyle: { fontSize: 12 } },
    grid: { left: 52, right: 20, bottom: 76, top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: { fontSize: 11, interval: 'auto' },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.06)' } }
    },
    yAxis: {
      type: 'value',
      name: '单位: %',
      nameGap: 36,
      axisLabel: { formatter: '{value}%', fontSize: 11 },
      min: 0,
      max: 60,
      splitLine: { show: true, lineStyle: { color: '#f0f0f0' } }
    },
    dataZoom: [
      { type: 'slider', show: true, xAxisIndex: 0, bottom: 6, height: 26, start: 0, end: 100, borderColor: '#e4e7ed', fillerColor: 'rgba(64, 158, 255, 0.2)', backgroundColor: '#fafbfc', handleStyle: { color: '#409eff' }, textStyle: { fontSize: 11 } },
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
    ],
    series: [
      {
        name: '应用CPU负载占比-前台',
        type: 'line',
        data: foregroundData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#409eff' },
        ...(fgMax > 0 && {
          markPoint: {
            symbol: 'arrow',
            symbolSize: 14,
            symbolRotate: 180,
            label: { formatter: '前台峰值', ...peakLabel },
            itemStyle: { color: '#409eff' },
            data: [{ type: 'max', name: '前台峰值' }]
          }
        })
      },
      {
        name: '应用CPU负载占比-后台',
        type: 'line',
        data: backgroundData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#67c23a' },
        ...(bgMax > 0 && {
          markPoint: {
            symbol: 'arrow',
            symbolSize: 14,
            symbolRotate: 180,
            label: { formatter: '后台峰值', ...peakLabel },
            itemStyle: { color: '#67c23a' },
            data: [{ type: 'max', name: '后台峰值' }]
          }
        })
      }
    ]
  }
  resourceLineChart.setOption(option, true)
}

/** 资源数据-内存曲线（与 CPU 图样式一致：网格线、下箭头峰值、时间 HH:mm:ss.SSS） */
function updateMemoryLineChart() {
  const el = memoryLineRef.value
  const report = performanceReport.value
  if (!el || !report?.resourceSamples?.length) return
  if (!memoryLineChart) memoryLineChart = echarts.init(el)
  const samples = report.resourceSamples as Array<{ timestampMs: number; memoryPssKb?: number; memoryPssKbForeground?: number; memoryPssKbBackground?: number }>
  const xData = samples.map((s) => formatChartTime(s.timestampMs))
  const foregroundMb = samples.map((s) => ((s.memoryPssKbForeground ?? s.memoryPssKb ?? 0) / 1024))
  const backgroundMb = samples.map((s) => ((s.memoryPssKbBackground ?? 0) / 1024))
  const fgMax = Math.max(0, ...foregroundMb)
  const bgMax = Math.max(0, ...backgroundMb)
  const peakLabel = { position: 'right' as const, fontSize: 11, distance: 8 }
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) + ' MB' : v) },
    legend: { data: ['应用内存-前台', '应用内存-后台'], top: 6, left: 12, itemGap: 24, itemWidth: 20, itemHeight: 12, textStyle: { fontSize: 12 } },
    grid: { left: 52, right: 20, bottom: 76, top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: { fontSize: 11, interval: 'auto' },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.06)' } }
    },
    yAxis: {
      type: 'value',
      name: '单位: MB',
      nameGap: 36,
      axisLabel: { fontSize: 11 },
      min: 0,
      splitLine: { show: true, lineStyle: { color: '#f0f0f0' } }
    },
    dataZoom: [
      { type: 'slider', show: true, xAxisIndex: 0, bottom: 6, height: 26, start: 0, end: 100, borderColor: '#e4e7ed', fillerColor: 'rgba(103, 194, 58, 0.2)', backgroundColor: '#fafbfc', handleStyle: { color: '#67c23a' }, textStyle: { fontSize: 11 } },
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
    ],
    series: [
      {
        name: '应用内存-前台',
        type: 'line',
        data: foregroundMb,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#409eff' },
        ...(fgMax > 0 && {
          markPoint: {
            symbol: 'arrow',
            symbolSize: 14,
            symbolRotate: 180,
            label: { formatter: '前台峰值', ...peakLabel },
            itemStyle: { color: '#409eff' },
            data: [{ type: 'max', name: '前台峰值' }]
          }
        })
      },
      {
        name: '应用内存-后台',
        type: 'line',
        data: backgroundMb,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#67c23a' },
        ...(bgMax > 0 && {
          markPoint: {
            symbol: 'arrow',
            symbolSize: 14,
            symbolRotate: 180,
            label: { formatter: '后台峰值', ...peakLabel },
            itemStyle: { color: '#67c23a' },
            data: [{ type: 'max', name: '后台峰值' }]
          }
        })
      }
    ]
  }
  memoryLineChart.setOption(option, true)
}

/** 资源数据-网络速率曲线（Kb/s）：由 resourceSamples 相邻点计算速率，含 dataZoom 与峰值 */
function updateNetworkLineChart() {
  const el = networkLineRef.value
  const report = performanceReport.value
  const samples = report?.resourceSamples ?? []
  if (!el || samples.length < 2) return
  if (!networkLineChart) networkLineChart = echarts.init(el)
  const xData: string[] = []
  const rxData: number[] = []
  const txData: number[] = []
  for (let i = 0; i < samples.length; i++) {
    xData.push(formatChartTime(samples[i].timestampMs))
    if (i === 0) {
      rxData.push(0)
      txData.push(0)
    } else {
      const dt = (samples[i].timestampMs - samples[i - 1].timestampMs) / 1000
      const rx = dt > 0 && samples[i].networkRxBytes != null && samples[i - 1].networkRxBytes != null
        ? ((samples[i].networkRxBytes - samples[i - 1].networkRxBytes) * 8) / (dt * 1000)
        : 0
      const tx = dt > 0 && samples[i].networkTxBytes != null && samples[i - 1].networkTxBytes != null
        ? ((samples[i].networkTxBytes - samples[i - 1].networkTxBytes) * 8) / (dt * 1000)
        : 0
      rxData.push(Math.max(0, rx))
      txData.push(Math.max(0, tx))
    }
  }
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) + ' Kb/s' : v) },
    legend: { data: ['下行(接收)', '上行(发送)'], top: 6, left: 12, itemGap: 24, itemWidth: 20, itemHeight: 12, textStyle: { fontSize: 12 } },
    grid: { left: 52, right: 20, bottom: 76, top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: { fontSize: 11, interval: 'auto' },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.06)' } }
    },
    yAxis: {
      type: 'value',
      name: '单位: Kb/s',
      nameGap: 36,
      axisLabel: { fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: '#f0f0f0' } }
    },
    dataZoom: [
      { type: 'slider', show: true, xAxisIndex: 0, bottom: 6, height: 26, start: 0, end: 100, borderColor: '#e4e7ed', fillerColor: 'rgba(64, 158, 255, 0.2)', backgroundColor: '#fafbfc', handleStyle: { color: '#409eff' }, textStyle: { fontSize: 11 } },
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
    ],
    series: [
      { name: '下行(接收)', type: 'line', data: rxData, smooth: true, symbol: 'none', lineStyle: { color: '#409eff' }, markPoint: { symbol: 'arrow', symbolSize: 14, symbolRotate: 180, label: { formatter: '峰值', position: 'right', fontSize: 11, distance: 8 }, itemStyle: { color: '#409eff' }, data: [{ type: 'max', name: '峰值' }] } },
      { name: '上行(发送)', type: 'line', data: txData, smooth: true, symbol: 'none', lineStyle: { color: '#67c23a' }, markPoint: { symbol: 'arrow', symbolSize: 14, symbolRotate: 180, label: { formatter: '峰值', position: 'right', fontSize: 11, distance: 8 }, itemStyle: { color: '#67c23a' }, data: [{ type: 'max', name: '峰值' }] } }
    ]
  }
  networkLineChart.setOption(option, true)
}

/** 资源数据-温度曲线（℃）：与 CPU 图样式一致 */
function updateTemperatureLineChart() {
  const el = temperatureLineRef.value
  const report = performanceReport.value
  if (!el || !report?.resourceSamples?.length) return
  if (!temperatureLineChart) temperatureLineChart = echarts.init(el)
  const samples = report.resourceSamples
  const xData = samples.map((s) => formatChartTime(s.timestampMs))
  const tempData = samples.map((s) => (s.temperatureTenthsC != null ? s.temperatureTenthsC / 10 : 0))
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(1) + ' ℃' : v) },
    legend: { data: ['温度'], top: 6, left: 12, itemGap: 24, itemWidth: 20, itemHeight: 12, textStyle: { fontSize: 12 } },
    grid: { left: 52, right: 20, bottom: 76, top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: { fontSize: 11, interval: 'auto' },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.06)' } }
    },
    yAxis: {
      type: 'value',
      name: '单位: ℃',
      nameGap: 36,
      axisLabel: { fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: '#f0f0f0' } }
    },
    dataZoom: [
      { type: 'slider', show: true, xAxisIndex: 0, bottom: 6, height: 26, start: 0, end: 100, borderColor: '#e4e7ed', fillerColor: 'rgba(230, 162, 60, 0.2)', backgroundColor: '#fafbfc', handleStyle: { color: '#e6a23c' }, textStyle: { fontSize: 11 } },
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 }
    ],
    series: [{
      name: '温度',
      type: 'line',
      data: tempData,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#e6a23c' },
      markPoint: { symbol: 'arrow', symbolSize: 14, symbolRotate: 180, label: { formatter: '峰值', position: 'right', fontSize: 11, distance: 8 }, itemStyle: { color: '#e6a23c' }, data: [{ type: 'max', name: '峰值' }] }
    }]
  }
  temperatureLineChart.setOption(option, true)
}

function disposePerformanceCharts() {
  if (issueDonutChart) {
    issueDonutChart.dispose()
    issueDonutChart = null
  }
  if (resourceLineChart) {
    resourceLineChart.dispose()
    resourceLineChart = null
  }
  if (memoryLineChart) {
    memoryLineChart.dispose()
    memoryLineChart = null
  }
  if (networkLineChart) {
    networkLineChart.dispose()
    networkLineChart = null
  }
  if (temperatureLineChart) {
    temperatureLineChart.dispose()
    temperatureLineChart = null
  }
}

/** 拉取性能报告（仅性能任务调用；404 等错误时置空并设 performanceReportError） */
async function loadPerformanceReport() {
  const id = taskId.value
  if (!id) return
  performanceReport.value = null
  performanceReportError.value = ''
  performanceReportLoading.value = true
  disposePerformanceCharts()
  try {
    const data = await apiClient.getPerformanceReport(id)
    performanceReport.value = data
    syncResourceMetricActive()
    await nextTick()
    updateIssueDonutChart()
    updateResourceLineChart()
    updateMemoryLineChart()
    updateNetworkLineChart()
    updateTemperatureLineChart()
  } catch (e: any) {
    if (e?.message && (e.message.includes('404') || e.message.includes('Not Found'))) {
      performanceReportError.value = '暂无性能报告数据'
    } else {
      performanceReportError.value = e?.message || '加载性能报告失败'
    }
  } finally {
    performanceReportLoading.value = false
  }
}

async function loadOverview() {
  const id = taskId.value
  if (!id) {
    error.value = '缺少任务 ID'
    return
  }
  loading.value = true
  error.value = ''
  overview.value = null
  overviewReady.value = false
  executionLogFallback.value = []
  performanceReport.value = null
  performanceReportError.value = ''
  try {
    const data = await apiClient.getFunctionalTestTaskOverview(id)
    overview.value = data
    screenshotLoadError.value = false
    // 当 overview 的 executionLog 为空时，尝试从 execution-log、任务详情或 screenshot-list 获取（兜底多步骤截图，按 taskId 匹配展示）
    const hasLog = data?.executionLog && Array.isArray(data.executionLog) && data.executionLog.length > 0
    if (!hasLog) {
      let fallbackList: Array<{ step: string; screenshotUrl?: string | null }> = []
      try {
        const logRaw = await apiClient.getFunctionalTestTaskExecutionLog(id)
        fallbackList = normalizeExecutionLogList(logRaw)
      } catch (_) {}
      if (fallbackList.length === 0) {
        try {
          const taskDetail = await apiClient.getFunctionalTestTask(id)
          fallbackList = normalizeExecutionLogList(taskDetail?.executionLog)
        } catch (_) {}
      }
      if (fallbackList.length === 0) {
        try {
          const screenshotList = await apiClient.getFunctionalTestTaskScreenshotList(id)
          if (screenshotList?.length) {
            fallbackList = screenshotList.map((s) => ({ step: s.step, screenshotUrl: s.screenshotUrl }))
          }
        } catch (_) {}
      }
      if (fallbackList.length > 0) executionLogFallback.value = fallbackList
    }
    // 下一帧再挂载 el-tabs/el-table，避免与 loading 移除同 tick 导致 parentNode 报错
    await nextTick()
    overviewReady.value = true
    // 任务未结束时轮询 GET task detail，直到 status/executionStatus 为完成/失败后刷新
    startPollingIfNeeded()
    // 性能任务时拉取性能报告（接口可能尚未实现则 404，前端友好展示）
    const t = (data?.testType || '').trim()
    const title = (data?.summarySectionTitle || '').trim()
    if (/性能/.test(t) || title === '性能测试结果') {
      loadPerformanceReport().catch(() => {})
    }
  } catch (e: any) {
    if (e?.message && (e.message.includes('404') || e.message.includes('Not Found'))) {
      error.value = '任务不存在或该任务类型暂不支持概览'
    } else {
      error.value = e?.message || '加载概览失败'
    }
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'AutomationTest' })
}

function onWindowResize() {
  issueDonutChart?.resize()
  resourceLineChart?.resize()
  memoryLineChart?.resize()
  networkLineChart?.resize()
  temperatureLineChart?.resize()
}

onMounted(() => {
  loadOverview()
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onOverviewScreenshotPreviewKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onOverviewScreenshotPreviewKeydown)
  clearPolling()
  disposePerformanceCharts()
})

watch(taskId, (id) => {
  clearPolling()
  if (id) loadOverview()
})

watch([perfReportTab, resourceSubTab], () => {
  nextTick(() => {
    if (perfReportTab.value === 'overall' && performanceReport.value) updateIssueDonutChart()
    if (perfReportTab.value === 'resource' && performanceReport.value?.resourceSamples?.length) {
      if (resourceSubTab.value === 'cpu') updateResourceLineChart()
      else if (resourceSubTab.value === 'memory') updateMemoryLineChart()
      else if (resourceSubTab.value === 'network') updateNetworkLineChart()
      else if (resourceSubTab.value === 'temperature') updateTemperatureLineChart()
    }
    issueDonutChart?.resize()
    resourceLineChart?.resize()
    memoryLineChart?.resize()
    networkLineChart?.resize()
    temperatureLineChart?.resize()
  })
})
</script>

<style scoped>
.task-overview-page {
  width: 100%;
  min-height: 100%;
  background: #f5f7fa;
}

.page-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #606266;
}

.back-btn:hover {
  color: #409eff;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.overview-loading,
.overview-error {
  padding: 48px 32px;
  text-align: center;
  font-size: 15px;
  background: #fff;
  margin: 16px;
  border-radius: 8px;
}

.overview-error {
  color: #f56c6c;
}

/* 蓝色信息头 */
.overview-header {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  padding: 20px 24px;
  color: #fff;
}

.header-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  max-width: 1200px;
  margin: 0;
  margin-right: auto;
}

.header-col {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 240px;
}

.header-col-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.header-col-body {
  flex: 1;
  min-width: 0;
}

.header-task-title,
.header-block-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}

.header-task-meta,
.header-task-remarks,
.header-kv {
  font-size: 13px;
  opacity: 0.95;
  margin-bottom: 4px;
}

.header-execution-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.header-execution-vars .header-kv {
  margin-bottom: 0;
}

.header-task-id {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 6px;
  word-break: break-all;
}

.header-task-scenario {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.header-actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.header-action-btn {
  color: #fff !important;
  opacity: 0.95;
}

.header-action-btn:hover {
  opacity: 1;
}

/* Tab 区域 */
.overview-tabs-wrap {
  margin: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.overview-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.overview-tabs :deep(.el-tabs__item) {
  font-size: 14px;
}

.overview-tabs :deep(.el-tabs__content) {
  padding: 20px 24px;
}

.tab-overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
  pointer-events: auto;
}

.overview-block {
  padding: 16px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.overview-block-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
  margin-bottom: 12px;
}

.overview-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 16px;
}

.overview-progress-wrap {
  display: flex;
  justify-content: flex-start;
}

.overview-progress-wrap :deep(.el-progress__text) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.progress-text {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.progress-label {
  font-size: 12px;
  color: #909399;
}

.overview-performance-placeholder {
  padding: 16px 0;
  font-size: 14px;
  color: #909399;
}

.result-distribution {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.dist-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.dist-label {
  width: 100px;
  flex-shrink: 0;
  color: #606266;
}

.dist-bars {
  flex: 1;
  display: flex;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
}

.dist-bar {
  display: block;
  min-width: 4px;
  transition: width 0.2s;
}

.dist-bar-passed {
  background: #67c23a;
}

.dist-bar-warning {
  background: #e6a23c;
}

.dist-bar-failed {
  background: #f56c6c;
}

.dist-bar-device {
  background: #909399;
}

.dist-value {
  width: 48px;
  text-align: right;
  font-size: 13px;
  color: #303133;
}

.result-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #606266;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-passed {
  background: #67c23a;
}

.legend-warning {
  background: #e6a23c;
}

.legend-failed {
  background: #f56c6c;
}

.participating-teams-wrap {
  margin-top: 8px;
}

.participating-teams-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.participating-team-tag {
  display: inline-block;
  padding: 4px 12px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 13px;
}

.participating-teams-summary {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}

.overview-screenshot-wrap {
  min-height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.overview-screenshots-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.overview-screenshot-item {
  flex: 0 0 auto;
  max-width: 200px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}
.overview-screenshot-item--clickable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.overview-screenshot-item--clickable:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.overview-screenshot-item .overview-screenshot-img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: contain;
}

.overview-screenshot-step {
  display: block;
  font-size: 12px;
  color: #606266;
  padding: 6px 8px;
  line-height: 1.3;
  word-break: break-all;
}

.overview-screenshot-img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: 6px;
}

.overview-screenshot-placeholder {
  color: #909399;
  font-size: 14px;
  padding: 24px;
}

.overview-screenshot-img--clickable {
  cursor: pointer;
}

/* 执行结果截图放大预览弹窗 */
.overview-screenshot-preview-dialog :deep(.el-dialog__body) {
  padding: 12px 20px 20px;
}
.overview-screenshot-preview-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  touch-action: pan-y;
  user-select: none;
}
.overview-screenshot-preview-img {
  max-width: 100%;
  width: 320px;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #f5f7fa;
}
.overview-screenshot-preview-step {
  font-size: 13px;
  color: #606266;
  text-align: center;
  word-break: break-all;
}
.overview-screenshot-preview-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.overview-screenshot-preview-counter {
  font-size: 13px;
  color: #606266;
  min-width: 4em;
  text-align: center;
}

.legend-device {
  background: #909399;
}

/* 性能报告（参考「性能测试报告」设计） */
.performance-report-block {
  padding: 0;
  overflow: hidden;
}

.performance-report-head {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;
}

.performance-report-head-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}

.performance-report-wrap {
  min-height: 200px;
  padding: 0;
  pointer-events: auto;
}

.performance-report-loading-wrap {
  min-height: 120px;
  position: relative;
}

/* 锚点导航：点击滚动到对应区块 */
.performance-report-anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 0 12px;
  border-bottom: 1px solid #ebeef5;
  position: relative;
  z-index: 1;
}

.perf-anchor-btn {
  padding: 8px 16px;
  font-size: 14px;
  color: #606266;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.perf-anchor-btn:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
.perf-anchor-btn.active {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.performance-report-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
  pointer-events: auto;
}

.perf-section-block {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  scroll-margin-top: 16px;
}

.performance-report-message {
  padding: 24px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

/* 各区块内标题与内容 */
.perf-section {
  background: #fff;
  border-radius: 8px;
}

.perf-section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  padding-left: 10px;
  padding-bottom: 8px;
  border-left: 3px solid #409eff;
  border-bottom: none;
}

.perf-conclusion {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}
.perf-conclusion-num {
  color: #409eff;
  font-weight: 700;
  padding: 0 2px;
}
.perf-conclusion-num--issue {
  color: #f56c6c;
}

/* 整体评估：左侧环形图 + 右侧表格 */
.perf-overall-row {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.perf-donut-wrap {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.perf-donut-chart {
  width: 220px;
  height: 220px;
}

.perf-donut-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.perf-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.perf-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.perf-issue-table-wrap {
  flex: 1;
  min-width: 320px;
}

.perf-issue-table :deep(.el-table__header th),
.perf-issue-table :deep(.el-table__body td) {
  font-size: 13px;
}

.perf-issue-value {
  color: #f56c6c;
  font-weight: 500;
}

/* 遍历统计：左侧统计卡片 + 右侧截图占位 */
.perf-traversal-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.perf-stats-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 12px 20px;
}

.perf-stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.perf-stat-value {
  display: flex;
  align-items: baseline;
  flex-wrap: nowrap;
  line-height: 1.2;
}

.perf-stat-num {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.perf-stat-unit {
  font-size: 13px;
  color: #909399;
  margin-left: 4px;
}

.perf-stat-label {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.perf-screenshots-placeholder {
  flex: 1;
  min-height: 140px;
  min-width: 200px;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.perf-placeholder-text {
  font-size: 14px;
  color: #909399;
}

/* 遍历统计 - 截图时间轴条（每秒一张） */
.perf-screenshots-strip {
  flex: 1;
  min-width: 200px;
  min-height: 120px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.perf-screenshots-scroll {
  display: flex;
  gap: 8px;
  padding: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-end;
}

.perf-screenshot-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.perf-screenshot-item:hover {
  transform: translateY(-2px);
}
.perf-screenshot-item:focus {
  outline: none;
}
.perf-screenshot-item:focus-visible .perf-screenshot-img {
  box-shadow: 0 0 0 2px var(--el-color-primary);
}

.perf-screenshot-img {
  width: 120px;
  height: auto;
  max-height: 180px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.perf-screenshot-item:hover .perf-screenshot-img {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.perf-screenshot-time {
  font-size: 11px;
  color: #909399;
}
.perf-screenshot-action {
  font-size: 12px;
  color: #303133;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.perf-screenshot-page {
  font-size: 10px;
  color: #909399;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

/* 遍历统计截图放大预览弹窗 */
.perf-screenshot-preview-dialog :deep(.el-dialog__body) {
  padding: 12px 20px 20px;
}
.perf-screenshot-preview-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.perf-screenshot-preview-img {
  max-width: 100%;
  width: 320px;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #f5f7fa;
}
.perf-screenshot-preview-time {
  font-size: 13px;
  color: #606266;
}
.perf-screenshot-preview-op {
  font-size: 12px;
  color: #303133;
}
.perf-screenshot-preview-op-page {
  margin-left: 6px;
  font-size: 12px;
  color: #909399;
}
.perf-screenshot-preview-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.perf-screenshot-preview-counter {
  font-size: 13px;
  color: #606266;
  min-width: 4em;
  text-align: center;
}

/* 资源数据：参考图 - 主 Tab 与子选项均居中，子选项间距与字号适中 */
.perf-resource-metric-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 8px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.perf-metric-pill {
  display: inline-block;
  padding: 5px 12px;
  font-size: 12px;
  color: #606266;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #dcdfe6;
  transition: all 0.2s;
  cursor: pointer;
  font-family: inherit;
  position: relative;
  z-index: 1;
}
.perf-metric-pill:hover {
  border-color: #c0c4cc;
  color: #303133;
}
.perf-metric-pill.active {
  color: #409eff;
  background: #ecf5ff;
  border-color: #409eff;
  font-weight: 500;
}
.perf-metric-pill.disabled {
  color: #c0c4cc;
  cursor: default;
}

.perf-resource-subtabs {
  margin-top: 16px;
}

.perf-resource-subtabs :deep(.el-tabs__header) {
  margin: 0 0 20px 0;
  border-bottom: 1px solid #e4e7ed;
}

.perf-resource-subtabs :deep(.el-tabs__nav-wrap) {
  display: flex;
  justify-content: center;
}

.perf-resource-subtabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.perf-resource-subtabs :deep(.el-tabs__item) {
  font-size: 15px;
  color: #606266;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
}
.perf-resource-subtabs :deep(.el-tabs__item.is-active) {
  color: #409eff;
  font-weight: 600;
}

.perf-resource-subtabs :deep(.el-tabs__active-bar) {
  height: 3px;
  background-color: #409eff;
}

.perf-resource-subtabs :deep(.el-tabs__item:hover) {
  color: #409eff;
}

.perf-resource-subtabs :deep(.el-tabs__content) {
  overflow: visible;
  padding: 0;
}

.perf-resource-content {
  display: flex;
  flex-direction: row;
  gap: 24px;
  align-items: stretch;
  width: 100%;
  min-height: 320px;
}

.perf-resource-placeholder {
  flex: 1;
  width: 100%;
  padding: 32px 24px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.perf-resource-placeholder .performance-report-message {
  padding: 0;
}

.perf-chart-wrap {
  flex: 1;
  min-width: 360px;
  min-height: 320px;
  height: 320px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  padding: 12px;
  box-sizing: border-box;
}

.perf-line-chart {
  width: 100%;
  height: 100%;
  min-height: 260px;
}

.perf-resource-summary {
  width: 280px;
  flex-shrink: 0;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.perf-resource-summary-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.perf-peak-step {
  font-size: 12px;
  color: #606266;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.perf-peak-step-label {
  color: #909399;
  font-weight: 500;
  font-size: 12px;
}
.perf-peak-step-desc {
  color: #303133;
  line-height: 1.5;
}
.perf-peak-step-link {
  color: #409eff;
  text-decoration: none;
  cursor: pointer;
  line-height: 1.6;
  font-size: 12px;
}
.perf-peak-step-link:hover {
  text-decoration: underline;
}

.perf-summary-table {
  margin-top: 4px;
}

.perf-summary-table :deep(.el-table__header th),
.perf-summary-table :deep(.el-table__body td) {
  font-size: 13px;
}

.performance-operations-table :deep(.el-table__header th),
.performance-operations-table :deep(.el-table__body td) {
  font-size: 13px;
}

.perf-op-thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  cursor: pointer;
  display: block;
  margin: 0 auto;
}
.perf-op-thumb:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.4);
}

/* 检测规则表格 */
.tab-rules {
  min-height: 200px;
}

.rules-table :deep(.el-table__header th) {
  font-size: 14px;
  color: #606266;
  font-weight: 600;
}

.rules-table :deep(.el-table__body td) {
  font-size: 14px;
}

.result-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  background: #f0f0f0;
  color: #606266;
}

.result-pill--passed {
  background: #e1f3d8;
  color: #67c23a;
}

.result-pill--failed {
  background: #fde2e2;
  color: #f56c6c;
}

.result-pill--warning {
  background: #faecd8;
  color: #e6a23c;
}

.result-pill--info {
  background: #f4f4f5;
  color: #909399;
}

.result-pill--device {
  background: #e9e9eb;
  color: #606266;
}

.detail-log-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.detail-log-message {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  word-break: break-all;
}

.no-log {
  color: #c0c4cc;
  font-size: 13px;
}

.rules-empty {
  padding: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

/* 执行日志弹窗 */
.execution-log-dialog :deep(.el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}

.execution-log-body {
  min-height: 120px;
}

.execution-log-error {
  padding: 24px;
  text-align: center;
  color: #f56c6c;
  font-size: 14px;
}

.execution-log-section-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 10px;
}

.execution-log-screenshot {
  margin-bottom: 20px;
}

.execution-log-screenshot .screenshot-img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  display: block;
}

.execution-log-steps {
  margin-top: 16px;
}

.execution-log-steps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.execution-log-level-filter {
  width: 120px;
}

.execution-log-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  font-size: 13px;
}

.execution-log-step .step-time {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  width: 72px;
}

.execution-log-step .step-level-tag {
  flex-shrink: 0;
}

.execution-log-step .step-message-line {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  line-height: 1.5;
}

.execution-log-step--success {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}

.execution-log-step--fail {
  background: #fef0f0;
  border: 1px solid #fde2e2;
}

.execution-log-step .step-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-icon--success {
  color: #67c23a;
}

.step-icon--fail {
  color: #f56c6c;
}

.execution-log-step .step-content {
  flex: 1;
  min-width: 0;
}

.execution-log-step .step-name {
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.execution-log-step .step-message,
.execution-log-step .step-selector,
.execution-log-step .step-timestamp {
  color: #606266;
  font-size: 12px;
  margin-top: 2px;
}

.execution-log-step .step-selector {
  color: #f56c6c;
  word-break: break-all;
}

.execution-log-step .step-screenshot-img {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin-top: 8px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  object-fit: contain;
}

.execution-log-empty {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
</style>
