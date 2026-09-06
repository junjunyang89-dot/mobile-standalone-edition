<template>
  <div class="app-regression">
    <div class="top-grid">
      <!-- 1. 配置面板 -->
      <el-card class="config-card" shadow="never">
        <template #header>
          <div class="card-head">
            <span>配置面板</span>
            <el-tag size="small" type="info">阶段一：手动触发</el-tag>
          </div>
        </template>

        <!--
          四个场景而不是两个开关。
          环境（后端连哪边）和包（新 debug 还是线上正式）是两个正交维度，摆成两个开关时
          人要自己组合，最容易漏的是「③ 老包 · 向后兼容」——后端已经发版、线上还跑着老 APP 包，
          接口变更会不会把它搞挂。那一轮影响的是当下全部真实用户，比新包的问题严重得多。
        -->
        <section class="cfg-section">
          <div class="cfg-title">步骤 0 · 这次跑的是哪一轮</div>
          <div class="scene-grid">
            <button
              v-for="s in REGRESSION_SCENES"
              :key="s.key"
              type="button"
              class="scene-card"
              :class="{ active: sceneKey === s.key }"
              @click="applyScene(s.key)"
            >
              <div class="scene-title">{{ s.title }}</div>
              <div class="scene-sub">{{ s.sub }}</div>
              <!--
                只标「装哪个包」。后端连哪边是你在包里切的，平台并不控制它——
                把它印在卡片上会让人以为选这张卡就切了后端。
              -->
              <div class="scene-meta">
                <el-tag size="small" :type="s.releasedPackage ? 'info' : 'primary'" effect="plain">
                  {{ s.releasedPackage ? '线上正式包' : '新版 debug 包' }}
                </el-tag>
              </div>
            </button>
          </div>

          <!-- 选了 ② 就提醒 ③，这一条是整块改造的目的 -->
          <el-alert
            v-if="sceneKey === 'PROD_NEW'"
            type="warning"
            :closable="false"
            show-icon
            class="cfg-alert"
            title="别忘了还要跑「③ 老包 · 向后兼容」"
          >
            后端和 H5 已经发版，而线上还跑着上个版本的 APP 包。接口/H5 变更会不会把老包搞挂，
            只有拿<strong>线上正式包</strong>跑一轮才知道——这一轮影响的是当下全部真实用户，
            比新包的问题严重。跑完这轮记得切到 ③ 再跑一次。
          </el-alert>

          <div class="cfg-hint">
            候选用例＝流程编排里用途为「仅回归」或「回归+自动化编排」的流程。
            <strong>装包类</strong>按环境隔离；<strong>纯功能验证</strong>（流程上关掉「绑定环境」）两个环境都能勾到。
            跑<strong>线上正式包</strong>时只列「已上线」的流程——本版新功能在那个包里还没有。
          </div>
        </section>

        <!-- 步骤 1：目标 APP -->
        <section class="cfg-section">
          <div class="step-head">
            <span class="step-badge">步骤 1</span>
            <div class="step-head-text">
              <div class="step-head-title">选择目标 APP</div>
              <div class="step-head-sub">单选 · 切换后下方用例列表会同步变化</div>
            </div>
          </div>
          <div class="app-cards">
            <button
              v-for="app in REGRESSION_APPS"
              :key="app.id"
              type="button"
              class="app-card"
              :class="{ active: selectedApps.includes(app.id) }"
              @click="selectApp(app.id)"
            >
              <div class="app-card-top">
                <div class="app-card-icon" :class="`tone-${app.iconTone}`">{{ app.iconLabel }}</div>
                <span class="app-card-radio" :class="{ checked: selectedApps.includes(app.id) }" aria-hidden="true">
                  <el-icon v-if="selectedApps.includes(app.id)"><Select /></el-icon>
                </span>
              </div>
              <div class="app-card-body">
                <div class="app-card-name">{{ app.name }}</div>
                <div class="app-card-sub">{{ app.subtitle }}</div>
                <div class="app-card-tags">
                  <span
                    v-for="tag in app.tags"
                    :key="tag.label"
                    class="app-tag"
                    :class="`tag-${tag.tone}`"
                  >{{ tag.label }}</span>
                </div>
              </div>
            </button>
          </div>
          <el-alert
            v-if="needsOverseasProxy"
            type="warning"
            :closable="false"
            show-icon
            class="cfg-alert"
            title="已选海外 PogPog：开跑时会传 enableOverseasProxy；请确认执行端海外代理（VPN）就绪。" />
        </section>

        <!-- 步骤 2：设备 -->
        <section class="cfg-section">
          <div class="cfg-title-row">
            <div class="cfg-title">步骤 2 · 选择执行设备（可多选）</div>
            <el-button size="small" :loading="deviceStore.loading" @click="refreshDevices">
              <el-icon><Refresh /></el-icon>
              刷新设备
            </el-button>
          </div>
          <div class="device-groups" v-loading="deviceStore.loading">
            <div v-if="!harmonyAppSelected" class="device-group">
              <div class="device-group-label">Android</div>
              <el-checkbox-group v-model="selectedDeviceIds">
                <el-checkbox
                  v-for="d in androidDevices"
                  :key="d.id"
                  :value="d.id"
                  :disabled="!isDeviceSelectable(d)"
                >
                  <span class="dev-name">{{ d.name || d.id }}</span>
                  <span class="dev-status" :class="deviceStatusClass(d.status)">{{ deviceStatusDot(d.status) }} {{ deviceStatusText(d.status) }}</span>
                </el-checkbox>
              </el-checkbox-group>
              <el-empty v-if="androidDevices.length === 0" description="暂无 Android 设备" :image-size="48" />
            </div>
            <div v-if="!harmonyAppSelected" class="device-group">
              <div class="device-group-label">iOS</div>
              <el-checkbox-group v-model="selectedDeviceIds">
                <el-checkbox
                  v-for="d in iosDevices"
                  :key="d.id"
                  :value="d.id"
                  :disabled="!isDeviceSelectable(d)"
                >
                  <span class="dev-name">{{ d.name || d.id }}</span>
                  <span class="dev-status" :class="deviceStatusClass(d.status)">{{ deviceStatusDot(d.status) }} {{ deviceStatusText(d.status) }}</span>
                </el-checkbox>
              </el-checkbox-group>
              <el-empty v-if="iosDevices.length === 0" description="暂无 iOS 设备" :image-size="48" />
            </div>
            <div v-if="harmonyAppSelected" class="device-group">
              <div class="device-group-label">鸿蒙</div>
              <el-checkbox-group v-model="selectedDeviceIds">
                <el-checkbox
                  v-for="d in harmonyDevices"
                  :key="d.id"
                  :value="d.id"
                  :disabled="!isDeviceSelectable(d)"
                >
                  <span class="dev-name">{{ d.name || d.id }}</span>
                  <span class="dev-status" :class="deviceStatusClass(d.status)">{{ deviceStatusDot(d.status) }} {{ deviceStatusText(d.status) }}</span>
                </el-checkbox>
              </el-checkbox-group>
              <el-empty
                v-if="harmonyDevices.length === 0"
                description="暂无鸿蒙设备（连上数据线后点右上角「刷新设备」）"
                :image-size="48"
              />
            </div>
          </div>
        </section>

        <!-- 步骤 3：流程用例（按端分开勾选，顺序互不影响） -->
        <section class="cfg-section">
          <div class="cfg-title-row">
            <div class="cfg-title">步骤 3 · 勾选回归用例（流程编排）</div>
            <div class="preset-btns">
              <el-button size="small" :loading="flowsLoading" @click="loadRegressionFlows">刷新用例</el-button>
              <el-button size="small" link type="primary" @click="selectAllFlows">全选全部</el-button>
              <el-button size="small" link @click="clearAllFlows">清空全部</el-button>
            </div>

          <!--
            缺前置的提示。不自动补是刻意的——回归批次的顺序是人刻意排的，
            静默塞流程进去会让人发现「勾了 12 条怎么跑了 14 条」。
          -->
          <el-alert
            v-if="depError"
            type="error"
            :closable="false"
            show-icon
            class="cfg-alert"
            :title="depError"
          />
          <el-alert
            v-else-if="missingDeps.length"
            type="warning"
            :closable="false"
            show-icon
            class="cfg-alert"
            title="有流程的前置没勾上"
          >
            <div class="dep-tip">
              <span>
                勾选的流程依赖
                <b>{{ missingDeps.map((d) => d.name).join('、') }}</b>
                ，但它们没被勾上。前置没跑的话，后面依赖它的流程会全部失败——
                而失败现象看着像功能 bug，很难联想到是少跑了第一步。
              </span>
              <el-button size="small" type="primary" @click="fillMissingDeps">补上前置</el-button>
            </div>
          </el-alert>
          </div>

          <div class="flow-platform-panels" v-loading="flowsLoading">
            <div v-if="!harmonyAppSelected" class="flow-platform-panel">
              <div class="flow-platform-head">
                <div class="flow-platform-title">
                  <el-tag size="small" type="success" effect="plain">Android</el-tag>
                  <span>用例 · 勾选顺序 = Android 设备执行顺序</span>
                </div>
                <div class="preset-btns">
                  <el-button size="small" link type="primary" @click="selectAllAndroidFlows">全选</el-button>
                  <el-button size="small" link @click="selectedAndroidFlowIds = []">清空</el-button>
                </div>
              </div>
              <el-checkbox-group v-model="selectedAndroidFlowIds" class="feature-grid">
                <el-checkbox
                  v-for="(f, idx) in androidFlows"
                  :key="f.id"
                  :value="f.id"
                  class="feature-item"
                >
                  <div class="feature-text">
                    <div class="feature-title-row">
                      <span class="feature-idx">A{{ idx + 1 }}</span>
                      <el-tooltip :content="f.name" placement="top" :show-after="200">
                        <div class="feature-name-wrap">
                          <span class="feature-name">{{ f.name }}</span>
                        </div>
                      </el-tooltip>
                      <div class="feature-meta">
                        <el-tag size="small" effect="plain">{{ catalogLabel(f.catalog) }}</el-tag>
                        <el-tag v-if="f.platform" size="small" type="success" effect="plain">{{ f.platform }}</el-tag>
                      </div>
                    </div>
                    <el-tooltip
                      v-if="f.description"
                      :content="f.description"
                      placement="top"
                      :show-after="200"
                    >
                      <div class="feature-desc">{{ f.description }}</div>
                    </el-tooltip>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
              <el-empty
                v-if="!flowsLoading && androidFlows.length === 0"
                description="暂无 Android 用例"
                :image-size="48"
              />
              <div v-if="androidOrderedPreview.length" class="order-preview order-preview-android">
                <div class="order-head">
                  <span class="order-title">Android 执行顺序</span>
                  <span class="order-hint">
                    <el-icon><InfoFilled /></el-icon>
                    点击可编辑对应流程
                  </span>
                </div>
                <div class="order-chips">
                  <button
                    v-for="(s, i) in androidOrderedPreview"
                    :key="`a-${s.id}`"
                    type="button"
                    class="order-chip-btn order-chip-btn-android"
                    :title="`打开编辑：${s.label}`"
                    @click.stop.prevent="openFlowEditor(s.id, s.label)"
                  >
                    <span class="order-num">{{ i + 1 }}</span>
                    <span class="order-name">{{ s.label }}</span>
                    <el-icon class="order-jump"><TopRight /></el-icon>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="!harmonyAppSelected" class="flow-platform-panel">
              <div class="flow-platform-head">
                <div class="flow-platform-title">
                  <el-tag size="small" type="info" effect="plain">iOS</el-tag>
                  <span>用例 · 勾选顺序 = iOS 设备执行顺序</span>
                </div>
                <div class="preset-btns">
                  <el-button size="small" link type="primary" @click="selectAllIosFlows">全选</el-button>
                  <el-button size="small" link @click="selectedIosFlowIds = []">清空</el-button>
                </div>
              </div>
              <el-checkbox-group v-model="selectedIosFlowIds" class="feature-grid">
                <el-checkbox
                  v-for="(f, idx) in iosFlows"
                  :key="f.id"
                  :value="f.id"
                  class="feature-item"
                >
                  <div class="feature-text">
                    <div class="feature-title-row">
                      <span class="feature-idx">i{{ idx + 1 }}</span>
                      <el-tooltip :content="f.name" placement="top" :show-after="200">
                        <div class="feature-name-wrap">
                          <span class="feature-name">{{ f.name }}</span>
                        </div>
                      </el-tooltip>
                      <div class="feature-meta">
                        <el-tag size="small" effect="plain">{{ catalogLabel(f.catalog) }}</el-tag>
                        <el-tag v-if="f.platform" size="small" type="info" effect="plain">{{ f.platform }}</el-tag>
                      </div>
                    </div>
                    <el-tooltip
                      v-if="f.description"
                      :content="f.description"
                      placement="top"
                      :show-after="200"
                    >
                      <div class="feature-desc">{{ f.description }}</div>
                    </el-tooltip>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
              <el-empty
                v-if="!flowsLoading && iosFlows.length === 0"
                description="暂无 iOS 用例"
                :image-size="48"
              />
              <div v-if="iosOrderedPreview.length" class="order-preview order-preview-ios">
                <div class="order-head">
                  <span class="order-title">iOS 执行顺序</span>
                  <span class="order-hint">
                    <el-icon><InfoFilled /></el-icon>
                    点击可编辑对应流程
                  </span>
                </div>
                <div class="order-chips">
                  <button
                    v-for="(s, i) in iosOrderedPreview"
                    :key="`i-${s.id}`"
                    type="button"
                    class="order-chip-btn order-chip-btn-ios"
                    :title="`打开编辑：${s.label}`"
                    @click.stop.prevent="openFlowEditor(s.id, s.label)"
                  >
                    <span class="order-num">{{ i + 1 }}</span>
                    <span class="order-name">{{ s.label }}</span>
                    <el-icon class="order-jump"><TopRight /></el-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- 鸿蒙独立应用：切到鸿蒙卡才显示这一栏（空也是预期——元素还没采） -->
            <div v-if="harmonyAppSelected" class="flow-platform-panel">
              <div class="flow-platform-head">
                <div class="flow-platform-title">
                  <el-tag size="small" type="warning" effect="plain">鸿蒙</el-tag>
                  <span>用例 · 勾选顺序 = 鸿蒙设备执行顺序</span>
                </div>
                <div class="preset-btns">
                  <el-button size="small" link type="primary" @click="selectAllHarmonyFlows">全选</el-button>
                  <el-button size="small" link @click="selectedHarmonyFlowIds = []">清空</el-button>
                </div>
              </div>
              <el-checkbox-group v-model="selectedHarmonyFlowIds" class="feature-grid">
                <el-checkbox
                  v-for="(f, idx) in harmonyFlows"
                  :key="f.id"
                  :value="f.id"
                  class="feature-item"
                >
                  <div class="feature-text">
                    <div class="feature-title-row">
                      <span class="feature-idx">h{{ idx + 1 }}</span>
                      <el-tooltip :content="f.name" placement="top" :show-after="200">
                        <div class="feature-name-wrap">
                          <span class="feature-name">{{ f.name }}</span>
                        </div>
                      </el-tooltip>
                      <div class="feature-meta">
                        <el-tag size="small" effect="plain">{{ catalogLabel(f.catalog) }}</el-tag>
                        <el-tag v-if="f.platform" size="small" type="warning" effect="plain">{{ f.platform }}</el-tag>
                      </div>
                    </div>
                    <el-tooltip
                      v-if="f.description"
                      :content="f.description"
                      placement="top"
                      :show-after="200"
                    >
                      <div class="feature-desc">{{ f.description }}</div>
                    </el-tooltip>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
              <div v-if="!flowsLoading && harmonyFlows.length === 0" class="empty-hint">
                还没有鸿蒙用例。纯血鸿蒙和安卓完全是两套控件，元素要单独采一遍：<br />
                先去「资产管理 · 元素管理」选应用「完美世界电竞（鸿蒙）」、平台切到鸿蒙采集元素，再回流程编排建鸿蒙流程。
              </div>
              <div v-if="harmonyOrderedPreview.length" class="order-preview order-preview-harmony">
                <div class="order-head">
                  <span class="order-title">鸿蒙 执行顺序</span>
                  <span class="order-hint">
                    <el-icon><InfoFilled /></el-icon>
                    点击可编辑对应流程
                  </span>
                </div>
                <div class="order-chips">
                  <button
                    v-for="(s, i) in harmonyOrderedPreview"
                    :key="`h-${s.id}`"
                    type="button"
                    class="order-chip-btn order-chip-btn-harmony"
                    :title="`打开编辑：${s.label}`"
                    @click.stop.prevent="openFlowEditor(s.id, s.label)"
                  >
                    <span class="order-num">{{ i + 1 }}</span>
                    <span class="order-name">{{ s.label }}</span>
                    <el-icon class="order-jump"><TopRight /></el-icon>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="sharedFlows.length" class="flow-platform-panel shared">
              <div class="flow-platform-head">
                <div class="flow-platform-title">
                  <el-tag size="small" effect="plain">双端</el-tag>
                  <span>未指定平台（两端都会跑）</span>
                </div>
                <div class="preset-btns">
                  <el-button size="small" link type="primary" @click="selectAllSharedFlows">全选</el-button>
                  <el-button size="small" link @click="selectedSharedFlowIds = []">清空</el-button>
                </div>
              </div>
              <el-checkbox-group v-model="selectedSharedFlowIds" class="feature-grid">
                <el-checkbox
                  v-for="(f, idx) in sharedFlows"
                  :key="f.id"
                  :value="f.id"
                  class="feature-item"
                >
                  <div class="feature-text">
                    <div class="feature-title-row">
                      <span class="feature-idx">S{{ idx + 1 }}</span>
                      <el-tooltip :content="f.name" placement="top" :show-after="200">
                        <div class="feature-name-wrap">
                          <span class="feature-name">{{ f.name }}</span>
                        </div>
                      </el-tooltip>
                      <div class="feature-meta">
                        <el-tag size="small" effect="plain">{{ catalogLabel(f.catalog) }}</el-tag>
                      </div>
                    </div>
                    <el-tooltip
                      v-if="f.description"
                      :content="f.description"
                      placement="top"
                      :show-after="200"
                    >
                      <div class="feature-desc">{{ f.description }}</div>
                    </el-tooltip>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>

          <el-empty
            v-if="!flowsLoading && availableFlows.length === 0"
            :description="flowsEmptyHint"
            :image-size="64"
          />
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="cfg-alert"
            title="Android / iOS 分开勾选：两端并发执行时互不影响顺序。每端内按勾选先后排队。装包/卸包请在流程中使用 UNINSTALL_APP / INSTALL_FROM_STORE。"
          />
        </section>

        <!-- 账号与环境 -->
        <section class="cfg-section">
          <div class="cfg-title">前置配置 · 账号 / 代理</div>
          <el-form label-width="96px" size="small" class="env-form">
            <el-form-item label="测试账号">
              <div class="dual-accounts">
                <el-select
                  v-model="selectedAccountIds[0]"
                  placeholder="账号 A（手机号1）"
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="a in accountOptions"
                    :key="a.id"
                    :label="`${a.label || a.phoneNumber}（${a.phoneNumber}）`"
                    :value="a.id"
                    :disabled="a.id === selectedAccountIds[1]" />
                </el-select>
                <el-select
                  v-model="selectedAccountIds[1]"
                  placeholder="账号 B（手机号2）"
                  clearable
                  style="width: 100%"
                >
                  <el-option
                    v-for="a in accountOptions"
                    :key="`b-${a.id}`"
                    :label="`${a.label || a.phoneNumber}（${a.phoneNumber}）`"
                    :value="a.id"
                    :disabled="a.id === selectedAccountIds[0]" />
                </el-select>
              </div>
              <div class="account-hint">两部手机请选两个不同账号；启动后随机分配到各设备（需登录的流程会带上账号参数）</div>
            </el-form-item>
            <el-form-item label="自定义账号">
              <div class="custom-account dual">
                <div class="custom-account-row">
                  <el-input v-model="customPhones[0]" placeholder="手机号 A（可选，优先生效）" />
                  <el-input v-model="customCodes[0]" placeholder="验证码 A" />
                </div>
                <div class="custom-account-row">
                  <el-input v-model="customPhones[1]" placeholder="手机号 B（可选）" />
                  <el-input v-model="customCodes[1]" placeholder="验证码 B" />
                </div>
              </div>
            </el-form-item>
            <el-form-item label="装包">
              <div class="install-strategy">
                <el-select v-model="installStrategy" style="width: 260px">
                  <el-option label="不装包，用设备上现有的" value="NONE" />
                  <el-option label="装最新版（常规回归）" value="LATEST" />
                  <el-option label="装指定版本" value="SPECIFIC" />
                  <el-option label="升级测试：先装上一版，跑完再覆盖装最新版" value="PREVIOUS_THEN_LATEST" />
                </el-select>
                <el-input
                  v-if="installStrategy === 'SPECIFIC'"
                  v-model="installBuildKey"
                  style="width: 240px"
                  placeholder="蒲公英 buildKey"
                />
                <div v-if="installStrategyHint" class="install-strategy-hint">
                  {{ installStrategyHint }}
                </div>
              </div>
            </el-form-item>
            <el-form-item label="执行参数">
              <div class="exec-params">
                <el-input
                  v-model="execParamsText"
                  type="textarea"
                  :rows="3"
                  placeholder="每行一个，形如&#10;phone=13800000000&#10;matchId=12345"
                />
                <div class="install-strategy-hint">
                  本批次覆盖流程里的 <code>${变量}</code>，只影响这一次。
                  常规数据请配在「环境变量」里按环境自动注入——改那边会影响所有人，
                  这里适合「同一批用例这次换个账号/换个赛事跑一遍」。
                  <br />账号池分配的手机号验证码优先级更高，不会被这里覆盖（多台机共用一个号会互相踢下线）。
                </div>
              </div>
            </el-form-item>
            <el-form-item label="海外代理">
              <el-switch
                v-model="enableOverseasProxy"
                :disabled="!needsOverseasProxy"
                active-text="启用 VPN / Proxy"
                inactive-text="关闭" />
            </el-form-item>
          </el-form>
        </section>

        <!-- 矩阵预览 -->
        <section v-if="matrixJobs.length" class="cfg-section">
          <div class="cfg-title">APP × 设备矩阵（可移除单条以灵活配对）</div>
          <div class="matrix-list">
            <div v-for="job in matrixJobs" :key="job.key" class="matrix-row">
              <el-tag
                size="small"
                :type="
                  job.appId === 'OVERSEAS_POGPOG'
                    ? 'success'
                    : 'warning'
                "
              >
                {{ job.appName }}
              </el-tag>
              <span class="matrix-arrow">×</span>
              <el-tag
                size="small"
                :type="
                  job.endpoint === 'android'
                    ? 'success'
                    : job.endpoint === 'harmony'
                      ? 'warning'
                      : 'info'
                "
              >
                {{
                  job.endpoint === 'android'
                    ? 'Android'
                    : job.endpoint === 'harmony'
                      ? '鸿蒙'
                      : 'iOS'
                }}
                · {{ job.deviceName }}
              </el-tag>
              <el-button v-perm:delete link type="danger" size="small" @click="excludeMatrixKey(job.key)">移除</el-button>
            </div>
          </div>
          <el-button v-if="excludedMatrixKeys.length" size="small" link @click="excludedMatrixKeys = []">
            恢复全部配对
          </el-button>
        </section>

        <div class="start-wrap">
          <el-button
            type="primary"
            size="large"
            class="start-btn"
            :loading="running"
            :disabled="!canStart"
            @click="startRegression"
          >
            {{ running ? '回归执行中…' : '一键开始回归' }}
          </el-button>
          <el-button v-if="running" size="large" @click="stopRegression">停止</el-button>
        </div>
      </el-card>

      <!-- 2. 实时执行看板 -->
      <el-card class="monitor-card" shadow="never">
        <template #header>
          <div class="card-head">
            <span>实时执行看板</span>
            <el-tag v-if="running" size="small" type="warning">Running</el-tag>
            <el-tag v-else-if="currentReport" size="small" type="success">Idle</el-tag>
          </div>
        </template>

        <div v-if="!liveJobs.length && !running" class="monitor-empty">
          <el-empty description="点击左侧「一键开始回归」后，此处展示双端并发进度与各用例截图" />
        </div>

        <template v-else>
          <div class="cfg-title">设备并发运行状态</div>
          <div class="live-jobs">
            <div v-for="job in liveJobs" :key="job.key" class="live-job">
              <div class="live-job-head">
                <span class="live-dot" :class="job.status" />
                <strong>{{ job.deviceName }}</strong>
                <el-tag size="small" effect="plain">{{ job.appName }}</el-tag>
                <span class="live-pct">{{ job.progress }}%</span>
              </div>
              <el-progress
                :percentage="job.progress"
                :status="progressStatus(job.status)"
                :stroke-width="10" />
              <div class="live-step">当前：{{ job.currentStepLabel || '等待中' }}</div>
              <el-steps :active="job.activeStepIndex" finish-status="success" align-center class="live-steps">
                <el-step
                  v-for="st in job.steps"
                  :key="st.id"
                  :title="st.shortLabel"
                  :description="stepDesc(st.status)"
                  :status="stepUiStatus(st.status)"
                  :class="{ 'is-skipped-step': st.status === 'skipped' }" />
              </el-steps>
            </div>
          </div>

          <div class="cfg-title shot-title">各用例截图</div>
          <div class="live-shots">
            <div v-for="job in liveJobs" :key="`shot-${job.key}`" class="live-shot">
              <div class="live-shot-label">{{ job.appName }} · {{ job.endpointLabel }} · {{ job.deviceName }}</div>
              <div class="live-step-shots">
                <div
                  v-for="(st, idx) in job.steps"
                  :key="`shot-${job.key}-${st.id}`"
                  class="live-step-shot"
                >
                  <div class="live-step-shot-cap">
                    <span class="live-step-shot-idx">{{ idx + 1 }}</span>
                    <span class="live-step-shot-name" :title="st.label">{{ st.shortLabel || st.label }}</span>
                    <el-tag size="small" :type="stepResultTagType(st.status)">{{ stepResultLabel(st.status) }}</el-tag>
                  </div>
                  <div
                    class="live-shot-frame"
                    @click="st.screenshot ? previewImage(st.screenshot) : undefined"
                  >
                    <img
                      v-if="st.screenshot"
                      :src="st.screenshot"
                      :alt="st.label"
                      @error="st.screenshot = undefined"
                    />
                    <div v-else class="shot-placeholder">
                      {{
                        st.status === 'pending' || st.status === 'running'
                          ? '等待截图…'
                          : st.status === 'skipped'
                            ? '已跳过'
                            : '本步无截图'
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </el-card>
    </div>

    <!-- 3. 结果与截图报告 -->
    <el-card class="report-card" shadow="never">
      <template #header>
        <div class="card-head">
          <span>回归结果与截图报告</span>
          <el-button size="small" :disabled="!history.length" @click="clearHistory">清空历史</el-button>
        </div>
      </template>

      <div v-if="!currentReport && !history.length" class="monitor-empty">
        <el-empty description="执行完成后，此处按功能步骤展示 iOS / Android 分端截图对比" />
      </div>

      <template v-if="currentReport">
        <div class="report-meta">
          <span>报告时间：{{ currentReport.finishedAtText }}</span>
          <el-divider direction="vertical" />
          <span>通过率：{{ currentReport.passRate }}%（跳过不计；不稳定算通过）</span>
          <el-divider direction="vertical" />
          <span>耗时：{{ currentReport.durationText }}</span>
          <el-divider direction="vertical" />
          <span>矩阵：{{ currentReport.jobs.length }} 条</span>
          <el-button size="small" type="primary" link @click="downloadReportLog(currentReport)">
            下载完整 Log
          </el-button>
        </div>

        <!-- 失败归类：一批红 20 条，先看清「其实是几个问题」，再逐条查 -->
        <div v-if="failureClusters.length" class="fail-clusters">
          <div class="fail-clusters-head" v-html="failureSummary"></div>
          <div v-for="c in failureClusters" :key="c.rank" class="fail-cluster">
            <div class="fail-cluster-top">
              <el-tag size="small" :type="c.rank === 1 ? 'danger' : 'warning'">
                {{ c.count }} 条
              </el-tag>
              <span class="fail-cluster-reason">{{ c.reason }}</span>
            </div>
            <div v-if="c.hint" class="fail-cluster-hint">{{ c.hint }}</div>
            <div v-if="c.samples?.length" class="fail-cluster-samples">
              涉及：{{ c.samples.join('、') }}<span v-if="c.count > c.samples.length"> 等 {{ c.count }} 条</span>
            </div>
          </div>
        </div>

        <div v-for="group in currentReport.comparisonGroups" :key="group.stepId" class="compare-block">
          <div class="compare-title">{{ group.stepLabel }}</div>
          <div class="compare-grid">
            <div v-for="shot in group.shots" :key="shot.key" class="compare-item">
              <div class="compare-item-head">
                <el-tag
                  size="small"
                  :type="
                    shot.endpoint === 'android'
                      ? 'success'
                      : shot.endpoint === 'harmony'
                        ? 'warning'
                        : 'info'
                  "
                >
                  {{
                    shot.endpoint === 'android'
                      ? 'Android'
                      : shot.endpoint === 'harmony'
                        ? '鸿蒙'
                        : 'iOS'
                  }}
                </el-tag>
                <span>{{ shot.appName }} · {{ shot.deviceName }}</span>
                <el-tag size="small" :type="stepResultTagType(shot.status)">
                  {{ stepResultLabel(shot.status) }}
                </el-tag>
              </div>
              <div class="compare-img" @click="shot.imageUrl ? previewImage(shot.imageUrl) : undefined">
                <img
                  v-if="shot.imageUrl"
                  :src="shot.imageUrl"
                  :alt="group.stepLabel"
                  @error="onCompareShotError(shot)"
                />
                <div v-else class="shot-placeholder">
                  {{ shot.status === 'skipped' ? '已跳过 · 暂未接入' : '本步无截图' }}
                </div>
              </div>
              <div class="compare-actions">
                <el-button
                  v-if="shot.status === 'failed'"
                  size="small"
                  type="danger"
                  plain
                  @click="reportDefect(group, shot)"
                >
                  一键报错
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-if="history.length" ref="historyBlockRef" class="history-block">
        <div class="history-head">
          <div class="cfg-title">历史记录</div>
          <div v-if="historyDateFilter" class="history-filter">
            <el-tag type="warning" effect="plain" size="small">
              仅显示 {{ historyDateLabel }} · {{ filteredHistory.length }} 批
            </el-tag>
            <el-button size="small" link type="primary" @click="clearHistoryDateFilter">查看全部日期</el-button>
          </div>
        </div>
        <el-empty
          v-if="!filteredHistory.length"
          :description="`${historyDateLabel}暂无执行记录`"
          :image-size="64"
        />
        <el-table
          v-else
          :data="filteredHistory"
          size="small"
          max-height="280"
          :header-cell-style="{ background: '#f5f7fa' }"
        >
          <el-table-column prop="finishedAtText" label="时间" width="170" />
          <el-table-column label="环境" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.environment === 'TEST'" size="small" type="warning" effect="plain">测试</el-tag>
              <el-tag v-else size="small" type="success" effect="plain">线上</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="轨道" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.track === 'AUTOMATION'" size="small" type="primary" effect="plain">自动化</el-tag>
              <el-tag v-else size="small" type="info" effect="plain">回归</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">{{ row.statusText || '-' }}</template>
          </el-table-column>
          <el-table-column label="通过率" width="90">
            <template #default="{ row }">{{ row.passRate ?? '-' }}{{ row.passRate != null ? '%' : '' }}</template>
          </el-table-column>
          <el-table-column prop="durationText" label="耗时" width="100" />
          <el-table-column label="矩阵" width="80">
            <template #default="{ row }">{{ row.jobCount ?? row.jobs?.length ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" size="small" :loading="viewingRunId === row.id" @click="viewHistory(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-dialog v-model="previewVisible" title="截图预览" width="720px" destroy-on-close>
      <img v-if="previewUrl" :src="previewUrl" class="preview-full" alt="preview" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, Refresh, Select, TopRight } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import { useDeviceStore, type Device } from '@/stores/device'
import {
  DEFAULT_ACCOUNT_POOL,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY,
  REGRESSION_APPS,
  SEED_FLOW_IDS,
  flowNeedsAccount,
  isHarmonyRegressionApp,
  type RegressionAppId,
  type RegressionFlowOption
} from '@/constants/appOnlineRegression'
import {
  buildAppDeviceMatrix,
  buildOrderedSteps,
  formatDurationMs,
  flowPlatformBucket,
  mergePlatformOrderedFlowIds,
  partitionRegressionFlows,
  regressionAppLabel,
  resolvePassRate,
  stepResultLabel,
  stepResultTagType
} from '@/utils/appOnlineRegression'
import { isAndroidFamilyPlatform, isIosFamilyPlatform } from '@/utils/platform'

const route = useRoute()
const router = useRouter()

type StepRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'unstable'
type JobRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'stopped'

interface LiveStep {
  id: string
  label: string
  shortLabel: string
  status: StepRunStatus
  screenshot?: string
  error?: string
}

interface LiveJob {
  key: string
  appId: RegressionAppId
  appName: string
  deviceId: string
  deviceName: string
  endpoint: 'android' | 'ios' | 'harmony' | 'other'
  endpointLabel: string
  status: JobRunStatus
  progress: number
  currentStepLabel: string
  activeStepIndex: number
  steps: LiveStep[]
  latestScreenshot?: string
  logs: string[]
}

interface CompareShot {
  key: string
  endpoint: 'android' | 'ios' | 'harmony' | 'other'
  appName: string
  deviceName: string
  status: StepRunStatus
  imageUrl?: string
}

interface CompareGroup {
  stepId: string
  stepLabel: string
  shots: CompareShot[]
}

interface RegressionReport {
  id: string
  finishedAt: number
  finishedAtText: string
  durationMs: number
  durationText: string
  passRate: number
  jobs: LiveJob[]
  comparisonGroups: CompareGroup[]
  logText: string
  /** 列表摘要字段（未拉详情前也可能有） */
  statusText?: string
  jobCount?: number
  detailLoaded?: boolean
  /** PROD / TEST；本地临时报告按当时选的环境记 */
  environment?: string
  /** REGRESSION / AUTOMATION；自动化批次是从流程编排页发起的 */
  track?: string
}

const deviceStore = useDeviceStore()

const selectedApps = ref<RegressionAppId[]>(['DOMESTIC_ESPORTS'])
/**
 * 本批次跑哪个环境。默认 PROD——线上回归的行为必须跟加这个选项之前一模一样。
 * 环境只决定「候选用例取哪批 catalog」和报告上的标签，不改任何执行逻辑。
 */
const environment = ref<'PROD' | 'TEST'>('PROD')
const selectedDeviceIds = ref<string[]>([])
const availableFlows = ref<RegressionFlowOption[]>([])
const selectedAndroidFlowIds = ref<string[]>([])
const selectedIosFlowIds = ref<string[]>([])
const selectedSharedFlowIds = ref<string[]>([])
// 鸿蒙独立一档：后端 platformMatches 里 ANDROID 只匹配 ANDROID/POG_ANDROID，
// 鸿蒙流程混在 Android 栏里勾上，执行时会被静默跳过——勾了等于没勾，最难查
const selectedHarmonyFlowIds = ref<string[]>([])
/** 跑的是已发布的线上包（上个版本）还是本次待发布的包 */
const releasedPackage = ref(false)

/**
 * 四个场景。
 * 环境和包是两个正交维度，摆成两个开关时人要自己组合，最容易漏 ③——
 * 而 ③ 恰恰是风险最大的一轮。
 */
const REGRESSION_SCENES = [
  {
    key: 'TEST_NEW',
    title: '① 提测回归',
    sub: '提测后第一轮，验新包的老功能 + 新功能',
    environment: 'TEST' as const,
    releasedPackage: false
  },
  {
    key: 'PROD_NEW',
    title: '② 新包 · 生产环境验证',
    sub: '同一个 debug 包切到线上环境，再验一遍',
    environment: 'PROD' as const,
    releasedPackage: false
  },
  {
    key: 'PROD_OLD',
    title: '③ 老包 · 向后兼容',
    sub: '线上还是上个版本的包，验后端/H5 发版后它有没有被搞挂',
    environment: 'PROD' as const,
    releasedPackage: true
  },
  {
    key: 'PROD_DAILY',
    title: '④ 日常线上回归',
    sub: '线上正式包的例行巡检',
    environment: 'PROD' as const,
    releasedPackage: true
  }
]

const sceneKey = ref('TEST_NEW')

/**
 * ③ 和 ④ 技术上一样（都是生产 + 线上包），分开列是因为<b>触发时机和关注点不同</b>：
 * ③ 是后端发版当天必须补跑的一轮，④ 是例行巡检。合并成一个的话，
 * ③ 就会被当成"日常那个我天天跑"而漏掉。
 */
function applyScene(key: string) {
  const scene = REGRESSION_SCENES.find((x) => x.key === key)
  if (!scene) return
  sceneKey.value = key
  environment.value = scene.environment
  releasedPackage.value = scene.releasedPackage
  loadFlows()
}
const flowsLoading = ref(false)
const excludedMatrixKeys = ref<string[]>([])

const selectedAccountIds = ref<string[]>(['', ''])
const customPhones = ref<string[]>(['', ''])
const customCodes = ref<string[]>(['', ''])
const enableOverseasProxy = ref(false)
/**
 * 装包是批次级的，不是流程步骤。
 * 默认「不装」——调试同一条流程时省掉每次重装的几分钟；正式跑一轮回归要手动选「装最新版」，
 * 这个顺序是有意的：装错包跑出来的绿色比红色更糟，它验的是另一个包。
 */
const installStrategy = ref('NONE')
/** 批次级执行参数，每行 key=value */
const execParamsText = ref('')

/** 解析成对象；空行、没有等号的行、空 key 一律忽略，别让一个手滑的空格把整批跑挂 */
function parseExecParams(): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const raw of String(execParamsText.value || '').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}
const installBuildKey = ref('')

const installStrategyHint = computed(() => {
  if (installStrategy.value === 'NONE') {
    return '设备上现在装的是哪个包，这轮验的就是哪个——正式回归记得改成「装最新版」'
  }
  if (installStrategy.value === 'PREVIOUS_THEN_LATEST') {
    return '勾选列表前几条要能产生本地数据（登录、看一次赛程），否则覆盖装上去也没有旧数据可验'
  }
  return ''
})
const accountPool = ref([...DEFAULT_ACCOUNT_POOL])
const activeRunId = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const running = ref(false)
const stopFlag = ref(false)
const liveJobs = ref<LiveJob[]>([])
const currentReport = ref<RegressionReport | null>(null)
const history = ref<RegressionReport[]>([])
/** 工作台跳转带入：YYYY-MM-DD，只看当天批次 */
const historyDateFilter = ref('')
const historyBlockRef = ref<HTMLElement | null>(null)
const viewingRunId = ref('')

function toDateKey(ms: number): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHistoryDateLabel(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, day] = dateStr.split('-')
  if (!y || !m || !day) return dateStr
  return `${Number(y)}年${Number(m)}月${Number(day)}日`
}

const historyDateLabel = computed(() => formatHistoryDateLabel(historyDateFilter.value))

const filteredHistory = computed(() => {
  const date = historyDateFilter.value
  if (!date) return history.value
  return history.value.filter((h) => toDateKey(h.finishedAt) === date)
})

function applyHistoryDateFromRoute() {
  const raw = route.query.date
  const date = typeof raw === 'string' ? raw.trim() : ''
  historyDateFilter.value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}

function clearHistoryDateFilter() {
  historyDateFilter.value = ''
  const q = { ...route.query } as Record<string, any>
  delete q.date
  delete q.focus
  router.replace({ path: route.path, query: q })
}

async function focusHistoryFromWorkbench() {
  applyHistoryDateFromRoute()
  await nextTick()
  historyBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const list = filteredHistory.value
  if (list.length) {
    // 默认打开该日最新一批详情
    await viewHistory(list[0])
  } else if (historyDateFilter.value) {
    ElMessage.info(`${historyDateLabel.value}暂无回归批次`)
  }
}

const previewVisible = ref(false)
const previewUrl = ref('')

const needsOverseasProxy = computed(() =>
  selectedApps.value.includes('OVERSEAS_POGPOG')
)

const harmonyAppSelected = computed(() =>
  selectedApps.value.some((id) => isHarmonyRegressionApp(id))
)

watch(needsOverseasProxy, (v) => {
  if (v) enableOverseasProxy.value = true
})

const androidDevices = computed(() =>
  deviceStore.devices.filter((d) => isAndroidFamilyPlatform(d.platform))
)
const iosDevices = computed(() =>
  deviceStore.devices.filter((d) => isIosFamilyPlatform(d.platform))
)
/** 鸿蒙机两个 family 判定都不认，不单独列出来就等于这个页面看不见它 */
const harmonyDevices = computed(() =>
  deviceStore.devices.filter((d) => String(d.platform || '').toUpperCase().startsWith('HARMONY'))
)

const selectedDevices = computed(() =>
  deviceStore.devices.filter((d) => selectedDeviceIds.value.includes(d.id))
)

const partitionedFlows = computed(() => partitionRegressionFlows(availableFlows.value))
const androidFlows = computed(() => partitionedFlows.value.android)
const iosFlows = computed(() => partitionedFlows.value.ios)
const harmonyFlows = computed(() => partitionedFlows.value.harmony)
const sharedFlows = computed(() => partitionedFlows.value.shared)

/** 提交后端：Android 顺序 + 双端 + iOS 顺序（各端过滤后相对顺序独立） */
/**
 * 缺的前置流程。
 *
 * 回归轨刻意<b>不自动补</b>：批次有人盯着、顺序是刻意排的，静默塞两条进去会让人
 * 发现「我勾了 12 条怎么跑了 14 条」。但忘勾「切环境」这类前置的话，后面十几条会全挂，
 * 而失败现象看着像功能 bug——没人会联想到是少跑了第一步。所以当场提示，补不补由人定。
 */
const missingDeps = ref<Array<{ id: string; name: string }>>([])
const depError = ref('')

let depCheckSeq = 0
async function checkDependencies() {
  const ids = selectedFlowIds.value
  const seq = ++depCheckSeq
  if (!ids.length) {
    missingDeps.value = []
    depError.value = ''
    return
  }
  try {
    const res = await apiClient.resolveFlowDependencies(ids)
    // 勾选变化很快，只认最后一次的结果，否则会闪回旧提示
    if (seq !== depCheckSeq) return
    missingDeps.value = res.missing || []
    depError.value = ''
  } catch (e: any) {
    if (seq !== depCheckSeq) return
    missingDeps.value = []
    // 成环这类错要显示出来——它是配置错误，不补前置也解决不了
    depError.value = e?.message || ''
  }
}

/** 把缺的前置补进对应平台那一栏，放在最前面（前置就该先跑） */
function fillMissingDeps() {
  for (const dep of missingDeps.value) {
    const flow = availableFlows.value.find((f) => f.id === dep.id)
    const bucket = flow ? flowPlatformBucket(flow.platform) : 'shared'
    const target =
      bucket === 'android' ? selectedAndroidFlowIds
      : bucket === 'ios' ? selectedIosFlowIds
      : bucket === 'harmony' ? selectedHarmonyFlowIds
      : selectedSharedFlowIds
    if (!target.value.includes(dep.id)) {
      target.value = [dep.id, ...target.value]
    }
  }
  missingDeps.value = []
}

const selectedFlowIds = computed(() =>
  mergePlatformOrderedFlowIds(
    selectedAndroidFlowIds.value,
    selectedSharedFlowIds.value,
    selectedIosFlowIds.value,
    selectedHarmonyFlowIds.value
  )
)

// 勾选一变就重新检查，不用等到点执行才发现缺前置
watch(selectedFlowIds, checkDependencies)

const androidOrderedPreview = computed(() =>
  buildOrderedSteps(selectedAndroidFlowIds.value, androidFlows.value)
)
const iosOrderedPreview = computed(() =>
  buildOrderedSteps(selectedIosFlowIds.value, iosFlows.value)
)
const harmonyOrderedPreview = computed(() =>
  buildOrderedSteps(selectedHarmonyFlowIds.value, harmonyFlows.value)
)

const matrixJobs = computed(() =>
  buildAppDeviceMatrix(
    selectedApps.value,
    selectedDevices.value.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      status: d.status
    })),
    excludedMatrixKeys.value
  )
)

const accountOptions = computed(() =>
  accountPool.value.map((a) => ({
    id: a.id || `${a.app}:${a.phoneNumber}`,
    phoneNumber: a.phoneNumber,
    verificationCode: a.verificationCode,
    label: a.label,
    app: a.app,
    appLabel: regressionAppLabel(a.app)
  }))
)

const featuresNeedAccount = computed(() =>
  selectedFlowIds.value.some((id) => {
    const f = availableFlows.value.find((x) => x.id === id)
    return f ? flowNeedsAccount(f) : false
  })
)

const canStart = computed(
  () =>
    !running.value &&
    selectedApps.value.length > 0 &&
    selectedFlowIds.value.length > 0 &&
    matrixJobs.value.length > 0
)

function catalogLabel(c?: string) {
  if (c === 'ONLINE') return '仅线上'
  if (c === 'SHARED') return '共用'
  return c || '—'
}

/** 跳到流程编排并直接打开该流程编辑抽屉 */
function openFlowEditor(flowId: string, flowName?: string) {
  const id = String(flowId || '').trim()
  if (!id) {
    ElMessage.warning('流程 ID 为空，无法打开编辑')
    return
  }
  const name = String(flowName || '').trim()
  try {
    sessionStorage.setItem(
      'ui-flows-pending-edit',
      JSON.stringify({ id, name, at: Date.now() })
    )
  } catch {
    /* ignore */
  }
  // 带 edit + 时间戳：强制 fullPath 变化以触发流程页挂载；
  // 注意：打开编辑后不能立刻清 query，否则 key=fullPath 会重挂载把抽屉冲掉
  void router
    .push({
      path: '/ui-flows',
      query: { edit: id, ...(name ? { name } : {}), _t: String(Date.now()) }
    })
    .catch((e) => {
      console.error(e)
      ElMessage.error('跳转流程编排失败')
    })
}

function mapFlowRow(row: any): RegressionFlowOption {
  return {
    id: row.id,
    name: row.name || row.id,
    description: row.description || '',
    catalog: row.catalog,
    appId: row.appId,
    platform: row.platform,
    sortOrder: row.sortOrder ?? 100,
    needsAccount: flowNeedsAccount(row)
  }
}

async function loadRegressionFlows() {
  flowsLoading.value = true
  try {
    const apps = selectedApps.value.length ? selectedApps.value : (['DOMESTIC_ESPORTS'] as RegressionAppId[])
    const lists = await Promise.all(
      apps.map((appId) =>
        apiClient.getUiFlows({
          appId,
          forRegression: true,
          environment: environment.value,
          releasedPackage: releasedPackage.value
        })
      )
    )
    const byId = new Map<string, RegressionFlowOption>()
    for (const list of lists) {
      for (const row of list || []) {
        const f = mapFlowRow(row)
        byId.set(f.id, f)
      }
    }
    const next = Array.from(byId.values()).sort(
      (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name, 'zh')
    )
    availableFlows.value = next
    const parts = partitionRegressionFlows(next)
    const visible = new Set(next.map((f) => f.id))

    const keepAndroid = selectedAndroidFlowIds.value.filter((id) => visible.has(id))
    const keepIos = selectedIosFlowIds.value.filter((id) => visible.has(id))
    const keepShared = selectedSharedFlowIds.value.filter((id) => visible.has(id))
    const keepHarmony = selectedHarmonyFlowIds.value.filter((id) => visible.has(id))

    if (keepAndroid.length || keepIos.length || keepShared.length || keepHarmony.length) {
      selectedAndroidFlowIds.value = keepAndroid
      selectedIosFlowIds.value = keepIos
      selectedSharedFlowIds.value = keepShared
      selectedHarmonyFlowIds.value = keepHarmony
    } else {
      const androidDefaults = [
        SEED_FLOW_IDS.loginLogoutAndroid,
        SEED_FLOW_IDS.installVerifyAndroid
      ].filter((id) => parts.android.some((f) => f.id === id))
      selectedAndroidFlowIds.value = androidDefaults.length
        ? androidDefaults
        : parts.android.map((f) => f.id)
      selectedIosFlowIds.value = parts.ios.map((f) => f.id)
      selectedSharedFlowIds.value = parts.shared.map((f) => f.id)
      selectedHarmonyFlowIds.value = parts.harmony.map((f) => f.id)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载回归用例失败')
    availableFlows.value = []
  } finally {
    flowsLoading.value = false
  }
}

function selectAllAndroidFlows() {
  selectedAndroidFlowIds.value = androidFlows.value.map((f) => f.id)
}
function selectAllIosFlows() {
  selectedIosFlowIds.value = iosFlows.value.map((f) => f.id)
}
function selectAllHarmonyFlows() {
  selectedHarmonyFlowIds.value = harmonyFlows.value.map((f) => f.id)
}
function selectAllSharedFlows() {
  selectedSharedFlowIds.value = sharedFlows.value.map((f) => f.id)
}
function selectAllFlows() {
  selectAllAndroidFlows()
  selectAllIosFlows()
  selectAllHarmonyFlows()
  selectAllSharedFlows()
}
function clearAllFlows() {
  selectedAndroidFlowIds.value = []
  selectedIosFlowIds.value = []
  selectedHarmonyFlowIds.value = []
  selectedSharedFlowIds.value = []
}

/** 目标 APP 单选：点哪个就切到哪个；切卡时清掉对端设备勾选，避免矩阵错配 */
function selectApp(id: RegressionAppId) {
  if (selectedApps.value.length === 1 && selectedApps.value[0] === id) return
  selectedApps.value = [id]
  const keepHarmony = isHarmonyRegressionApp(id)
  selectedDeviceIds.value = selectedDeviceIds.value.filter((did) => {
    const d = deviceStore.devices.find((x) => x.id === did)
    if (!d) return false
    const p = String(d.platform || '').toUpperCase()
    const isHarmony = p.startsWith('HARMONY')
    return keepHarmony ? isHarmony : !isHarmony
  })
  if (keepHarmony) {
    selectedAndroidFlowIds.value = []
    selectedIosFlowIds.value = []
    selectedSharedFlowIds.value = []
  } else {
    selectedHarmonyFlowIds.value = []
  }
}

const flowsEmptyHint = computed(() => {
  if (harmonyAppSelected.value) {
    return '鸿蒙应用下暂无用例。请先在元素管理采集鸿蒙元素，再在流程编排为 DOMESTIC_ESPORTS_HARMONY 创建流程。'
  }
  if (selectedApps.value.includes('OVERSEAS_POGPOG') && !selectedApps.value.includes('DOMESTIC_ESPORTS')) {
    return '海外 PogPog 暂无可用用例。国内「完美世界电竞」用例不会出现在此列表；请在流程编排中为 OVERSEAS_POGPOG 创建 ONLINE/SHARED 流程。'
  }
  return '当前应用下暂无可用用例。请在「流程编排」创建 catalog=ONLINE/SHARED、启用、非组件的流程。'
})

watch(environment, () => {
  loadRegressionFlows()
})

watch(selectedApps, () => {
  loadRegressionFlows()
})

function excludeMatrixKey(key: string) {
  if (!excludedMatrixKeys.value.includes(key)) excludedMatrixKeys.value.push(key)
}

function isDeviceSelectable(d: Device) {
  const s = (d.status || '').toLowerCase()
  return s === 'connected' || s === 'idle' || s === 'online' || s === 'available' || !s
}

function deviceStatusText(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'connected' || s === 'online' || s === 'idle' || s === 'available') return '空闲'
  if (s === 'busy' || s === 'running' || s === 'occupied') return '占用中'
  if (s === 'offline' || s === 'disconnected') return '离线'
  return status || '未知'
}

function deviceStatusDot(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'connected' || s === 'online' || s === 'idle' || s === 'available') return '🟢'
  if (s === 'busy' || s === 'running' || s === 'occupied') return '🔴'
  return '⚪'
}

function deviceStatusClass(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'connected' || s === 'online' || s === 'idle' || s === 'available') return 'ok'
  if (s === 'busy' || s === 'running' || s === 'occupied') return 'busy'
  return 'off'
}

async function refreshDevices() {
  try {
    await deviceStore.scanAndFetchDevices()
    ElMessage.success(`已刷新，共 ${deviceStore.devices.length} 台设备`)
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新设备失败')
  }
}

function progressStatus(status: JobRunStatus) {
  if (status === 'success') return 'success'
  if (status === 'failed' || status === 'stopped') return 'exception'
  return undefined
}

function stepUiStatus(status: StepRunStatus) {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'running') return 'process'
  // 不稳定：功能是好的（重跑通过了），但别当成完全正常，用告警色提醒去治理
  if (status === 'unstable') return 'warning'
  // skipped / pending：灰色 wait，不当失败
  return 'wait'
}

function stepDesc(status: StepRunStatus) {
  if (status === 'skipped') return '已跳过'
  if (status === 'failed') return '失败'
  if (status === 'unstable') return '不稳定（重跑才过）'
  if (status === 'success') return '成功'
  if (status === 'running') return '执行中'
  return ''
}

function shortLabel(label: string) {
  return label.length > 6 ? label.slice(0, 6) : label
}

/** 收集本次要提交的账号（自定义手机号优先；否则账号池多选） */
function collectAccountPayload() {
  const phones = customPhones.value.map((p) => p.trim()).filter(Boolean)
  const codes = customCodes.value.map((c) => (c || '').trim())
  if (phones.length > 0) {
    return {
      accountIds: [] as string[],
      customPhones: phones,
      customCodes: phones.map((_, i) => codes[i] || '')
    }
  }
  const ids = selectedAccountIds.value.filter(Boolean)
  if (ids.length > 0) {
    return { accountIds: ids, customPhones: [] as string[], customCodes: [] as string[] }
  }
  // 未选手动时，按当前 APP 从池中取前两个不同账号
  const byApp = accountPool.value.filter((a) => selectedApps.value.includes(a.app))
  const fallback = byApp.slice(0, 2).map((a) => a.id || '').filter(Boolean)
  return { accountIds: fallback, customPhones: [] as string[], customCodes: [] as string[] }
}

function accountCountReady(): number {
  const p = collectAccountPayload()
  return p.customPhones.length > 0 ? p.customPhones.length : p.accountIds.length
}

function shotSrc(url?: string | null) {
  if (!url) return ''
  const raw = String(url).trim()
  if (!raw) return ''
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('blob:')) {
    return raw
  }
  const base = apiClient.getBaseUrl().replace(/\/$/, '')
  return `${base}/${raw.replace(/^\//, '')}`
}

function buildComparisonGroups(jobs: LiveJob[]): CompareGroup[] {
  const stepIds: string[] = []
  for (const job of jobs) {
    for (const st of job.steps) {
      if (!stepIds.includes(st.id)) stepIds.push(st.id)
    }
  }
  return stepIds.map((stepId) => {
    const label = jobs.flatMap((j) => j.steps).find((s) => s.id === stepId)?.label || stepId
    const shots: CompareShot[] = []
    for (const job of jobs) {
      const st = job.steps.find((s) => s.id === stepId)
      if (!st) continue
      shots.push({
        key: `${job.key}-${stepId}`,
        endpoint: job.endpoint,
        appName: job.appName,
        deviceName: job.deviceName,
        status: st.status,
        imageUrl: st.screenshot
      })
    }
    return { stepId, stepLabel: label, shots }
  })
}

function persistHistory() {
  try {
    const slim = history.value.slice(0, MAX_HISTORY).map((r) => ({
      ...r,
      // 截图为 data URL，历史体积可能偏大，仅保留最近若干
      jobs: r.jobs.map((j) => ({
        ...j,
        logs: j.logs.slice(-30)
      }))
    }))
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(slim))
  } catch {
    /* quota */
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) history.value = parsed
  } catch {
    history.value = []
  }
}

async function startRegression() {
  if (!canStart.value) return

  if (featuresNeedAccount.value) {
    const need = Math.min(2, Math.max(1, selectedDeviceIds.value.length))
    const ready = accountCountReady()
    if (ready < need) {
      ElMessage.warning(
        featuresNeedAccount.value && selectedDeviceIds.value.length >= 2
          ? '两部手机执行需登录的流程时，请配置两个不同登录手机号（账号 A / B）'
          : '已选需登录的流程，请配置测试账号'
      )
      return
    }
    const phones = customPhones.value.map((p) => p.trim()).filter(Boolean)
    if (phones.length >= 2 && phones[0] === phones[1]) {
      ElMessage.warning('两个自定义手机号不能相同')
      return
    }
    const ids = selectedAccountIds.value.filter(Boolean)
    if (ids.length >= 2 && ids[0] === ids[1]) {
      ElMessage.warning('请选择两个不同的测试账号')
      return
    }
  }

  const busy = selectedDevices.value.filter((d) => {
    const s = (d.status || '').toLowerCase()
    return s === 'busy' || s === 'running' || s === 'occupied' || s === 'offline' || s === 'disconnected'
  })
  if (busy.length) {
    try {
      await ElMessageBox.confirm(
        `有 ${busy.length} 台设备状态可能不可用（占用/离线），是否仍继续？`,
        '设备状态提醒',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }

  const accountPayload = collectAccountPayload()
  stopFlag.value = false
  running.value = true
  currentReport.value = null
  activeRunId.value = ''
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  if (needsOverseasProxy.value && enableOverseasProxy.value) {
    ElMessage.info('海外 PogPog：已标记启用海外代理（VPN），请确认执行端网络就绪')
  }

  const startedAt = Date.now()
  try {
    const res = await apiClient.startOnlineRegressionRun({
      appIds: selectedApps.value,
      deviceIds: selectedDeviceIds.value,
      flowIds: selectedFlowIds.value,
      excludeJobKeys: excludedMatrixKeys.value,
      accountIds: accountPayload.accountIds.length ? accountPayload.accountIds : undefined,
      accountId: accountPayload.accountIds[0] || undefined,
      customPhones: accountPayload.customPhones.length ? accountPayload.customPhones : undefined,
      customCodes: accountPayload.customCodes.length ? accountPayload.customCodes : undefined,
      customPhone: accountPayload.customPhones[0] || undefined,
      customCode: accountPayload.customCodes[0] || undefined,
      enableOverseasProxy: enableOverseasProxy.value,
      installStrategy: installStrategy.value,
      installBuildKey: installStrategy.value === 'SPECIFIC' ? installBuildKey.value : undefined,
      params: parseExecParams(),
      environment: environment.value
    })
    activeRunId.value = res.id
    applyRunSnapshot(res)

    await new Promise<void>((resolve) => {
      pollTimer = setInterval(async () => {
        if (stopFlag.value) {
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = null
          resolve()
          return
        }
        try {
          const detail = await apiClient.fetchOnlineRegressionRun(res.id)
          applyRunSnapshot(detail)
          const st = (detail.status || '').toUpperCase()
          if (st === 'COMPLETED' || st === 'FAILED' || st === 'SKIPPED' || st === 'STOPPED') {
            if (pollTimer) clearInterval(pollTimer)
            pollTimer = null
            resolve()
          }
        } catch (e: any) {
          console.warn('poll run failed', e)
        }
      }, 2000)
    })

    const detail = await apiClient.fetchOnlineRegressionRun(res.id)
    applyRunSnapshot(detail)
    finishReportFromLive(startedAt, detail.passRate)
    if (stopFlag.value || (detail.status || '').toUpperCase() === 'STOPPED') {
      ElMessage.warning(`回归已停止，通过率 ${currentReport.value?.passRate ?? 0}%（跳过步骤不计失败）`)
    } else {
      ElMessage.success(`回归完成，通过率 ${currentReport.value?.passRate ?? 0}%（跳过步骤不计失败）`)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '启动回归失败（请确认已执行 schema_online_regression.sql 与 migration_online_regression_environment.sql 并重启后端）')
    running.value = false
  } finally {
    running.value = false
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }
}

interface FailureClusterVo {
  reason: string
  count: number
  samples?: string[]
  rank: number
  hint?: string
}

/** 后端按「失败步骤 + 报错指纹」归的类，最多的一类排在前 */
const failureClusters = ref<FailureClusterVo[]>([])
const failureSummary = ref('')

function applyRunSnapshot(detail: {
  failureSummary?: string
  failureClusters?: FailureClusterVo[]
  jobs: Array<{
    key: string
    appId: string
    appName: string
    deviceId: string
    deviceName: string
    endpoint: string
    endpointLabel?: string
    status: string
    progress: number
    currentStepLabel?: string
    latestScreenshotUrl?: string | null
    steps: Array<{ id: string; stepId: string; label: string; status: string; error?: string; screenshotUrl?: string | null }>
  }>
}) {
  failureClusters.value = detail.failureClusters || []
  failureSummary.value = detail.failureSummary || ''
  liveJobs.value = detail.jobs.map((job) => {
    const steps = (job.steps || []).map((s) => ({
      id: s.stepId || s.id,
      label: s.label,
      shortLabel: shortLabel(s.label),
      status: (s.status || 'pending') as StepRunStatus,
      screenshot: s.screenshotUrl ? shotSrc(s.screenshotUrl) : undefined,
      error: s.error
    }))
    const active = steps.findIndex((s) => s.status === 'running')
    const lastDone = [...steps]
      .reverse()
      .findIndex((s) => s.status === 'success' || s.status === 'failed' || s.status === 'skipped')
    return {
      key: job.key,
      appId: job.appId as RegressionAppId,
      appName: job.appName,
      deviceId: job.deviceId,
      deviceName: job.deviceName,
      endpoint: (job.endpoint === 'ios'
        ? 'ios'
        : job.endpoint === 'harmony'
          ? 'harmony'
          : 'android') as LiveJob['endpoint'],
      endpointLabel:
        job.endpointLabel ||
        (job.endpoint === 'ios' ? 'iOS' : job.endpoint === 'harmony' ? '鸿蒙' : 'Android'),
      status: (job.status || 'pending') as JobRunStatus,
      progress: job.progress || 0,
      currentStepLabel: job.currentStepLabel || '',
      activeStepIndex: active >= 0 ? active : lastDone >= 0 ? steps.length - 1 - lastDone : 0,
      steps,
      latestScreenshot: job.latestScreenshotUrl
        ? shotSrc(job.latestScreenshotUrl)
        : [...steps].reverse().find((s) => s.screenshot)?.screenshot,
      logs: [`[remote] ${job.appName} × ${job.deviceName}`]
    } as LiveJob
  })
}

function buildReportFromJobs(
  runId: string,
  jobs: LiveJob[],
  opts?: {
    passRate?: number | null
    startedAtMs?: number
    finishedAtMs?: number
    statusText?: string
  }
): RegressionReport {
  const finishedAt = opts?.finishedAtMs ?? Date.now()
  const startedAt = opts?.startedAtMs ?? finishedAt
  const durationMs = Math.max(0, finishedAt - startedAt)
  const passRate = resolvePassRate(
    jobs.flatMap((j) => j.steps),
    opts?.passRate
  )
  return {
    id: runId,
    finishedAt,
    finishedAtText: new Date(finishedAt).toLocaleString('zh-CN'),
    durationMs,
    durationText: formatDurationMs(durationMs),
    passRate,
    jobs: JSON.parse(JSON.stringify(jobs)),
    comparisonGroups: buildComparisonGroups(jobs),
    logText: jobs
      .map((j) =>
        [
          `===== ${j.appName} / ${j.deviceName} =====`,
          ...j.steps.map((s) => `${stepResultLabel(s.status)} ${s.label}${s.error ? ' ' + s.error : ''}`)
        ].join('\n')
      )
      .join('\n\n'),
    statusText: opts?.statusText,
    jobCount: jobs.length,
    // 本地生成的报告用当时选的环境；服务端历史以库里的为准
    environment: environment.value,
    track: 'REGRESSION',
    detailLoaded: true
  }
}

function finishReportFromLive(startedAt: number, passRateOverride?: number | null) {
  const report = buildReportFromJobs(activeRunId.value || `reg-${Date.now()}`, liveJobs.value, {
    passRate: passRateOverride,
    startedAtMs: startedAt,
    finishedAtMs: Date.now(),
    statusText: '已完成'
  })
  currentReport.value = report
  history.value = [report, ...history.value.filter((h) => h.id !== report.id)].slice(0, MAX_HISTORY)
  persistHistory()
}

function parseServerTime(v?: string | null): number | undefined {
  if (!v) return undefined
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : undefined
}

function summarizeRunStatus(status?: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED') return '已完成'
  if (s === 'FAILED') return '失败'
  if (s === 'SKIPPED') return '已跳过'
  if (s === 'STOPPED') return '已停止'
  if (s === 'RUNNING') return '执行中'
  if (s === 'PENDING') return '排队中'
  return status || '-'
}

async function loadServerHistory() {
  try {
    const rows = await apiClient.listOnlineRegressionRuns(MAX_HISTORY)
    if (!Array.isArray(rows) || !rows.length) return
    const mapped: RegressionReport[] = rows.map((r) => {
      const finishedAt = parseServerTime(r.finishedAt) || parseServerTime(r.createdAt) || Date.now()
      const startedAt = parseServerTime(r.startedAt) || finishedAt
      return {
        id: r.id,
        finishedAt,
        finishedAtText: new Date(finishedAt).toLocaleString('zh-CN'),
        durationMs: Math.max(0, finishedAt - startedAt),
        durationText: formatDurationMs(Math.max(0, finishedAt - startedAt)),
        passRate: r.passRate ?? 0,
        jobs: [],
        comparisonGroups: [],
        logText: '',
        statusText: summarizeRunStatus(r.status),
        jobCount: r.jobCount ?? 0,
        environment: r.environment || 'PROD',
        track: r.track || 'REGRESSION',
        detailLoaded: false
      }
    })
    // 服务端历史优先；本地未入库的临时报告排后面
    const localOnly = history.value.filter((h) => !mapped.some((m) => m.id === h.id))
    history.value = [...mapped, ...localOnly].slice(0, MAX_HISTORY)
    persistHistory()
  } catch {
    /* 后端未起或未升级时保留 localStorage */
  }
}

async function viewHistory(row: RegressionReport) {
  if (!row?.id) return
  if (row.detailLoaded && row.jobs?.length && currentReport.value?.id === row.id) {
    document.querySelector('.report-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ElMessage.info('已是当前报告')
    return
  }
  viewingRunId.value = row.id
  try {
    const detail = await apiClient.fetchOnlineRegressionRun(row.id)
    applyRunSnapshot(detail)
    const report = buildReportFromJobs(detail.id, liveJobs.value, {
      passRate: detail.passRate,
      startedAtMs: parseServerTime(detail.startedAt),
      finishedAtMs: parseServerTime(detail.finishedAt) || Date.now(),
      statusText: summarizeRunStatus(detail.status)
    })
    currentReport.value = report
    history.value = history.value.map((h) => (h.id === report.id ? report : h))
    persistHistory()
    document.querySelector('.report-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ElMessage.success('已加载历史报告')
  } catch (e: any) {
    // 回退：本地已有完整报告时直接展示
    if (row.detailLoaded && row.jobs?.length) {
      currentReport.value = row
      document.querySelector('.report-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    ElMessage.error(e?.message || '加载历史详情失败')
  } finally {
    viewingRunId.value = ''
  }
}

async function stopRegression() {
  stopFlag.value = true
  if (activeRunId.value) {
    try {
      await apiClient.stopOnlineRegressionRun(activeRunId.value)
    } catch {
      /* ignore */
    }
  }
  ElMessage.warning('正在停止回归…')
}

function previewImage(url?: string) {
  if (!url) return
  previewUrl.value = shotSrc(url)
  previewVisible.value = true
}

/** 历史/报告里可能残留无效截图 URL（404），避免裂图 */
function onCompareShotError(shot: CompareShot) {
  shot.imageUrl = undefined
}

function downloadReportLog(report: RegressionReport) {
  const blob = new Blob([report.logText], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `app-online-regression-${report.id}.log`
  a.click()
  URL.revokeObjectURL(a.href)
}

function reportDefect(group: CompareGroup, shot: CompareShot) {
  ElMessage.success(
    `已记录报错意向：${group.stepLabel} / ${shot.appName} / ${shot.deviceName}（后续可对接缺陷系统）`
  )
}

async function clearHistory() {
  try {
    await ElMessageBox.confirm('将清空服务端与本地的全部历史批次，模块本身保留。是否继续？', '清空历史', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await apiClient.clearOnlineRegressionHistory()
  } catch (e: any) {
    // 后端未重启时仍清本地，避免列表假数据
    console.warn('clear server history failed', e)
  }
  history.value = []
  currentReport.value = null
  viewingRunId.value = ''
  localStorage.removeItem(HISTORY_STORAGE_KEY)
  ElMessage.success('历史记录已清空')
}

onMounted(async () => {
  loadHistory()
  await loadServerHistory()
  applyHistoryDateFromRoute()
  if (route.query.focus === 'history') {
    await focusHistoryFromWorkbench()
  } else if (history.value.length && history.value[0].detailLoaded) {
    currentReport.value = history.value[0]
  }
  await loadRegressionFlows()
  try {
    const accounts = await apiClient.getOnlineRegressionAccounts()
    if (Array.isArray(accounts) && accounts.length) {
      accountPool.value = accounts.map((a) => ({
        id: a.id,
        label: a.label,
        phoneNumber: a.phoneNumber,
        verificationCode: a.verificationCode,
        app: a.appId as RegressionAppId
      }))
    }
  } catch {
    /* 后端未建表时仍用本地默认账号池 */
  }
  // 默认预填两个国内账号，便于双机登录回归
  const domestic = accountPool.value.filter((a) => a.app === 'DOMESTIC_ESPORTS')
  if (domestic.length >= 2) {
    selectedAccountIds.value = [domestic[0].id || '', domestic[1].id || '']
  } else if (accountPool.value.length >= 2) {
    selectedAccountIds.value = [accountPool.value[0].id || '', accountPool.value[1].id || '']
  }
  try {
    await deviceStore.scanAndFetchDevices()
  } catch {
    try {
      await deviceStore.fetchDevices()
    } catch {
      /* ignore */
    }
  }
})

onUnmounted(() => {
  stopFlag.value = true
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.app-regression {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 1200px) {
  .top-grid {
    grid-template-columns: 1fr;
  }
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.config-card,
.monitor-card {
  margin: 4px 0 18px;
}

/* 失败聚类才用浅红提醒；别套到配置/看板整块背景上 */
.fail-clusters {
  margin: 4px 0 18px;
  padding: 12px 14px;
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 8px;
  background: var(--el-color-danger-light-9);
}

.fail-clusters-head {
  font-size: 14px;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.fail-cluster {
  padding: 8px 0;
  border-top: 1px dashed var(--el-border-color);
}

.fail-cluster:first-of-type {
  border-top: none;
}

.fail-cluster-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fail-cluster-reason {
  font-weight: 500;
}

.fail-cluster-hint,
.fail-cluster-samples {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.install-strategy {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.install-strategy-hint {
  flex-basis: 100%;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.report-card {
  border-radius: 10px;
}

.cfg-section {
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eef0f3;
}

.cfg-section:last-of-type {
  border-bottom: none;
}

.cfg-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 12px;
}

.cfg-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.cfg-title-row .cfg-title {
  margin-bottom: 0;
}

.cfg-hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.6;
}

.cfg-alert {
  margin-top: 12px;
}

.app-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .app-cards {
    grid-template-columns: 1fr;
  }
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.dep-tip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  line-height: 1.7;
}
.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.scene-card {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.15s;
}
.scene-card:hover {
  border-color: var(--el-color-primary-light-5);
}
.scene-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}
.scene-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.scene-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.scene-meta {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pkg-stage-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.pkg-stage-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.step-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: #3b82f6;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  margin-top: 2px;
}

.step-head-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.3;
}

.step-head-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.app-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  border: 1.5px solid #e8edf3;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.15s;
}

.app-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
  transform: translateY(-1px);
}

.app-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.25), 0 4px 12px rgba(59, 130, 246, 0.1);
}

.app-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.app-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.app-card-icon.tone-domestic {
  background: #1e3a5f;
}

.app-card-icon.tone-harmony {
  background: #60a5fa;
}

.app-card-icon.tone-overseas {
  background: #7c3aed;
}

.app-card-radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 12px;
  transition: border-color 0.15s, background 0.15s;
}

.app-card-radio.checked {
  border-color: #3b82f6;
  background: #3b82f6;
}

.app-card-body {
  min-width: 0;
}

.app-card-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.app-card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}

.app-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.app-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.app-tag.tag-region {
  background: #f1f5f9;
  color: #64748b;
}

.app-tag.tag-overseas {
  background: #ffedd5;
  color: #c2410c;
}

.app-tag.tag-android {
  background: #dcfce7;
  color: #15803d;
}

.app-tag.tag-ios {
  background: #dbeafe;
  color: #1d4ed8;
}

.app-tag.tag-harmony {
  background: #e0f2fe;
  color: #0284c7;
}

.device-groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 80px;
}

.device-group {
  background: #fafbfc;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
}

.device-group-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--app-text-secondary);
}

.device-group :deep(.el-checkbox) {
  display: flex;
  margin-right: 0;
  margin-bottom: 8px;
  height: auto;
  white-space: normal;
}

.dev-name {
  margin-right: 8px;
}

.dev-status {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.dev-status.ok {
  color: var(--app-success);
}

.dev-status.busy {
  color: var(--app-danger);
}

.dev-status.off {
  color: var(--el-text-color-placeholder);
}

.preset-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.flow-platform-panels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flow-platform-panel {
  padding: 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
}

.flow-platform-panel.shared {
  background: #fafbfc;
}

.flow-platform-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.flow-platform-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px 12px;
  width: 100%;
}

.feature-item {
  margin-right: 0 !important;
  height: auto !important;
  width: 100%;
  max-width: 100%;
  align-items: center !important;
  white-space: normal !important;
  padding: 8px 12px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #eef0f3;
  box-sizing: border-box;
}

.feature-item :deep(.el-checkbox__input) {
  margin-top: 0;
}

.feature-item :deep(.el-checkbox__label) {
  width: 100%;
  min-width: 0;
  white-space: normal !important;
  line-height: 1.35;
  overflow: visible;
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.35;
  width: 100%;
}

.feature-title-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  width: 100%;
}

.feature-idx {
  flex: 0 0 auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.feature-name-wrap {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.feature-name {
  display: block;
  min-width: 0;
  max-width: 100%;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}

/* tooltip 包裹节点要参与 flex 收缩，否则截断后 hover 也不稳 */
.feature-title-row > .el-tooltip__trigger {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.feature-meta {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  margin-left: auto;
}

.feature-desc {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 22px;
  cursor: default;
}

.feature-desc.warn {
  color: var(--app-warning);
}

.order-preview {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--app-surface);
  border-radius: 10px;
}

.order-preview-android {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}

.order-preview-ios {
  background: var(--el-color-primary-light-9);
  border: 1px solid #d9ecff;
}

.order-preview-harmony {
  background: #fdf6ec;
  border: 1px solid #faecd8;
}

.order-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 10px;
}

.order-title {
  font-size: 13px;
  font-weight: 700;
}

.order-preview-android .order-title {
  color: #529b2e;
}

.order-preview-ios .order-title {
  color: #337ecc;
}

.order-preview-harmony .order-title {
  color: #b88230;
}

.order-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
}

.order-preview-android .order-hint {
  color: #85ce61;
}

.order-preview-ios .order-hint {
  color: #79bbff;
}

.order-preview-harmony .order-hint {
  color: #e6a23c;
}

.order-hint .el-icon {
  font-size: 14px;
}

.order-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.order-chip-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 6px 12px 6px 8px;
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
  max-width: 100%;
  background: #fff;
  transition: box-shadow 0.15s, border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s;
}

.order-chip-btn-android {
  border: 1px solid #b3e19d;
  color: #529b2e;
}

.order-chip-btn-ios {
  border: 1px solid #a0cfff;
  color: #337ecc;
}

.order-chip-btn-harmony {
  border: 1px solid #f3d19e;
  color: #b88230;
}

.order-chip-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.order-chip-btn-android:hover {
  border-color: #67c23a;
  background: #e1f3d8;
  color: #3d8b1e;
}

.order-chip-btn-ios:hover {
  border-color: var(--el-color-primary);
  background: #d9ecff;
  color: #1d6fb8;
}

.order-chip-btn-harmony:hover {
  border-color: #e6a23c;
  background: #fdf6ec;
  color: #a87016;
}

.order-chip-btn-android:hover .order-num {
  background: #529b2e;
}

.order-chip-btn-ios:hover .order-num {
  background: #337ecc;
}

.order-chip-btn-harmony:hover .order-num {
  background: #b88230;
}

.order-num {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  transition: background 0.15s;
}

.order-chip-btn-android .order-num {
  background: #67c23a;
}

.order-chip-btn-ios .order-num {
  background: var(--el-color-primary);
}

.order-chip-btn-harmony .order-num {
  background: #e6a23c;
}

.order-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.order-jump {
  flex: 0 0 auto;
  font-size: 14px;
  opacity: 0.75;
  transition: opacity 0.15s, transform 0.15s;
}

.order-chip-btn:hover .order-jump {
  opacity: 1;
  transform: translate(1px, -1px);
}

.dual-accounts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.account-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.custom-account {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.custom-account.dual {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-account-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.matrix-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.matrix-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #eef0f3;
}

.matrix-arrow {
  color: var(--el-text-color-placeholder);
}

.start-wrap {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.start-btn {
  min-width: 180px;
  font-weight: 600;
  letter-spacing: 1px;
}

.monitor-empty {
  padding: 24px 0;
}

.live-jobs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.live-job {
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: #fafbfc;
}

.live-job-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}

.live-dot.running {
  background: var(--app-warning);
  box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.25);
}

.live-dot.success {
  background: var(--app-success);
}

.live-dot.failed,
.live-dot.stopped {
  background: var(--app-danger);
}

.live-pct {
  margin-left: auto;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.live-step {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.live-steps {
  margin-top: 12px;
}

.live-steps :deep(.el-step__title) {
  font-size: 11px;
  line-height: 1.2;
}

.live-steps :deep(.el-step__description) {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.live-steps :deep(.is-skipped-step .el-step__description) {
  color: var(--el-text-color-placeholder);
}

.live-steps :deep(.is-skipped-step .el-step__head) {
  color: #c0c4cc;
  border-color: #c0c4cc;
}

.live-steps :deep(.is-skipped-step .el-step__title) {
  color: var(--el-text-color-placeholder);
}

.shot-title {
  margin-top: 20px;
}

.live-shots {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.live-shot-label {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.live-step-shots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.live-step-shot-cap {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  min-width: 0;
}

.live-step-shot-idx {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.live-step-shot-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-shot-frame,
.compare-img {
  aspect-ratio: 9 / 16;
  max-height: 220px;
  border-radius: 10px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid var(--app-border);
  cursor: zoom-in;
  display: flex;
  align-items: center;
  justify-content: center;
}

.live-shot-frame img,
.compare-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shot-placeholder {
  color: #94a3b8;
  font-size: 13px;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 0;
  margin-bottom: 16px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.compare-block {
  margin-bottom: 20px;
}

.compare-title {
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--app-text);
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.compare-item {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 10px;
  background: #fff;
}

.compare-item-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.compare-actions {
  margin-top: 8px;
}

.history-block {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #eef0f3;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.history-head .cfg-title {
  margin-bottom: 0;
}

.history-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-full {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
</style>
