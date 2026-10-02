<template>
  <div class="ui-elements">
    <div class="toolbar">
      <div class="toolbar-tools">
        <el-button @click="router.push('/ui-inspector-import')">
          <el-icon class="el-icon--left"><Upload /></el-icon>
          Inspector 导入
        </el-button>
        <el-button @click="shotVisible = true">
          <el-icon class="el-icon--left"><Camera /></el-icon>
          Inspector 截图识别
        </el-button>
        <el-button @click="openInspector()">
          <el-icon class="el-icon--left"><Iphone /></el-icon>
          真机点选
        </el-button>
      </div>
      <div class="toolbar-create">
        <el-button type="primary" @click="openNewPage">
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新增页面
        </el-button>
        <el-button type="primary" @click="openAdd">
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新增元素
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
      <div class="search-row">
        <el-input
          v-model="filterKeyword"
          clearable
          class="search-input"
          placeholder="搜索页面名/元素名/pageId/定位值..."
          @keyup.enter="onFilterChange"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterSource" clearable placeholder="来源" style="width: 130px">
          <el-option v-for="s in sourceOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="filterStatus" clearable placeholder="状态" style="width: 110px">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-input
          v-model="filterModule"
          clearable
          placeholder="模块，如 设置"
          style="width: 140px"
          @keyup.enter="onFilterChange"
        />
        <el-button type="primary" @click="onFilterChange">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <span class="search-count">{{ pageCountText }}</span>
      </div>
    </div>

    <div class="list-panel">
      <div class="list-context">
        <span>{{ listContextText }}</span>
        <div class="view-switch">
          展示：
          <b>{{ viewMode === 'byPage' ? '按页折叠' : '平铺' }}</b>
          <el-button type="primary" link @click="toggleViewMode">
            {{ viewMode === 'byPage' ? '切换平铺' : '切换折叠' }}
          </el-button>
        </div>
      </div>

      <div v-if="viewMode === 'byPage'" v-loading="loading" class="page-list">
        <div v-for="g in pagedPageGroups" :key="g.key" class="page-block">
          <div class="page-row" @click="togglePage(g.key)">
            <el-icon class="page-caret" :class="{ open: isPageOpen(g.key) }"><ArrowRight /></el-icon>
            <span class="page-name">{{ g.title }}</span>
            <span class="page-id">{{ g.pageId || '未归属' }}</span>
            <span class="count-tag" :title="elsewhereHint(g) || undefined">{{ g.items.length }}个元素</span>
            <span
              v-if="crossPlatformTag(g)"
              class="other-tag"
              title="页面按应用建、不分平台；元素才分平台。删除按钮只在三端都为空时出现"
            >{{ crossPlatformTag(g) }}</span>
            <span class="page-actions" @click.stop>
              <el-button
                v-if="g.pageId"
                type="primary"
                link
                size="small"
                @click="openEditPage(g)"
              >改名</el-button>
              <el-button
                v-perm:delete
                v-if="g.pageId && (g.total === 0 || (g.total === null && !g.items.length))"
                type="danger"
                link
                size="small"
                @click="removePage(g)"
              >删除</el-button>
            </span>
          </div>
          <div v-if="isPageOpen(g.key)" class="page-body">
            <el-table
              v-if="g.items.length"
              :data="g.items"
              stripe
              size="small"
              :header-cell-style="{ background: '#f5f7fa' }"
            >
              <el-table-column prop="nameZh" label="中文名称" min-width="100" />
              <el-table-column prop="nameEn" label="英文名" min-width="110" show-overflow-tooltip />
              <el-table-column prop="platform" label="平台" width="90" />
              <el-table-column label="定位" width="110">
                <template #default="{ row }">
                  <el-tag size="small" type="info">{{ row.locatorType }}</el-tag>
                  <div v-if="fallbackCount(row)" class="fb-count">另有 {{ fallbackCount(row) }} 备用</div>
                </template>
              </el-table-column>
              <el-table-column prop="locatorValue" label="定位值" min-width="160" show-overflow-tooltip />
              <el-table-column label="状态" width="80" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
                  <el-button
                    v-if="row.status !== 'ACTIVE'"
                    type="success"
                    link
                    size="small"
                    @click="promoteActive(row)"
                  >选用</el-button>
                  <el-button v-perm:delete type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-else class="page-empty">
              该页暂无元素，可
              <el-button type="primary" link @click="openAddForPage(g.pageId)">新增元素</el-button>
              挂到此页
            </div>
          </div>
        </div>
        <el-empty
          v-if="!loading && pageGroups.length === 0"
          description="暂无页面。可点「新增页面」创建，再「新增元素」挂上去"
        />
        <div v-if="pageGroups.length" class="pagination-wrap">
          <el-pagination
            v-model:current-page="groupPage"
            v-model:page-size="groupPageSize"
            :page-sizes="[10, 20, 50]"
            :total="pageGroups.length"
            layout="total, sizes, prev, pager, next"
            @current-change="onGroupPageChange"
            @size-change="onGroupSizeChange"
          />
        </div>
      </div>

      <template v-if="viewMode === 'flat'">
        <el-table v-loading="loading" :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#f5f7fa' }">
          <el-table-column label="预览" width="72" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.previewImage"
                :src="previewSrc(row.previewImage)"
                :preview-src-list="[previewSrc(row.previewImage)]"
                :preview-teleported="true"
                :z-index="4000"
                fit="cover"
                class="preview-thumb" />
              <span v-else class="preview-empty">—</span>
            </template>
          </el-table-column>
          <el-table-column label="应用" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ appLabel(row.appId) }}</template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="100" />
          <el-table-column prop="nameZh" label="中文名称" min-width="110" />
          <el-table-column prop="nameEn" label="英文名" min-width="120" show-overflow-tooltip />
          <el-table-column prop="visualHint" label="视觉说明" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.visualHint || '—' }}</template>
          </el-table-column>
          <el-table-column prop="pageId" label="页面ID" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.pageId || '—' }}</template>
          </el-table-column>
          <el-table-column prop="moduleTag" label="模块" width="90" show-overflow-tooltip>
            <template #default="{ row }">{{ row.moduleTag || '—' }}</template>
          </el-table-column>
          <el-table-column label="来源" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="sourceTagType(row.source)">{{ sourceLabel(row.source) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="定位方式" width="130">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.locatorType }}</el-tag>
              <div v-if="fallbackCount(row)" class="fb-count">另有 {{ fallbackCount(row) }} 备用</div>
            </template>
          </el-table-column>
          <el-table-column prop="locatorValue" label="定位值" min-width="180" show-overflow-tooltip />
          <el-table-column label="用途" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="catalogTagType(row.catalog)">{{ catalogLabel(row.catalog) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabled === false ? 'info' : 'success'" size="small">
                {{ row.enabled === false ? '否' : '是' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
              <el-button
                v-if="row.status !== 'ACTIVE'"
                type="success"
                link
                size="small"
                @click="promoteActive(row)"
              >选用</el-button>
              <el-button v-perm:delete type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="totalElements"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="loadList"
            @size-change="onSizeChange" />
        </div>
        <el-empty v-if="!loading && list.length === 0" description="该应用/平台下暂无元素" />
      </template>
    </div>

    <el-dialog
      v-model="dialogVisible"
      class="element-dialog"
      :title="editingId ? '编辑元素' : '新增元素'"
      width="720px"
      destroy-on-close
      @closed="elementFormTab = 'basic'"
    >
      <el-tabs v-model="elementFormTab" class="element-tabs">
        <el-tab-pane label="基本信息" name="basic" />
        <el-tab-pane name="locator">
          <template #label>
            <span>控件定位</span>
            <sup v-if="locatorFilledCount" class="tab-badge">{{ locatorFilledCount }}</sup>
          </template>
        </el-tab-pane>
        <el-tab-pane label="高级配置" name="advanced" />
      </el-tabs>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" class="element-form">
        <div v-show="elementFormTab === 'basic'" class="tab-pane-body">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="应用" prop="appId">
                <el-select v-model="form.appId" :disabled="!!editingId" filterable placeholder="请选择应用" style="width: 100%">
                  <el-option
                    v-for="a in appOptions"
                    :key="a.id"
                    :label="`${a.nameZh} (${a.id})`"
                    :value="a.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="平台" prop="platform">
                <el-select v-model="form.platform" :disabled="!!editingId" style="width: 100%">
                  <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="来源" prop="source">
                <el-select v-model="form.source" :disabled="!!editingId" style="width: 100%">
                  <el-option v-for="s in sourceOptions" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="状态" prop="status">
                <el-select v-model="form.status" style="width: 100%">
                  <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="中文名称" prop="nameZh">
                <el-input v-model="form.nameZh" placeholder="如 登录按钮" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="英文名称" prop="nameEn">
                <el-input v-model="form.nameEn" placeholder="流程引用 key，如 login_btn" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="归属页面">
                <el-select
                  v-model="form.pageId"
                  clearable
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选页面/弹窗，或输入 pageId"
                  style="width: 100%"
                >
                  <el-option
                    v-for="p in pageOptions"
                    :key="p.pageId"
                    :label="`${p.nameZh} (${p.pageId})`"
                    :value="p.pageId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="模块标签">
                <el-input v-model="form.moduleTag" placeholder="如 设置（仅分组展示）" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="视觉说明">
                <el-input v-model="form.visualHint" maxlength="120" show-word-limit placeholder="如 左上角三横线汉堡" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="描述">
                <el-input v-model="form.description" type="textarea" :rows="3" placeholder="补充说明这个元素的用途、上下文…" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div v-show="elementFormTab === 'locator'" class="tab-pane-body">
          <div class="locator-toolbar">
            <p class="locator-guide">
              点左侧圆点设为「主定位」，执行时优先用。多个框都能填备用，主定位找不到时按顺序再试。
              要用 XPath 当主定位，点 XPath 那一行的圆点即可。
            </p>
            <el-button type="primary" plain :disabled="!form.appId" @click="openFillBackInspect">
              <el-icon class="el-icon--left"><Iphone /></el-icon>
              真机定位
            </el-button>
          </div>
          <el-form-item label-width="0" prop="locatorValue" class="locator-form-item">
            <el-radio-group
              v-model="form.locatorType"
              class="locator-radio-group"
              @change="onPrimaryTypeChange"
            >
              <div
                v-for="slot in locatorSlots"
                :key="slot.type"
                class="locator-slot"
                :class="{ 'is-primary': form.locatorType === slot.type, 'is-open': expandedLocatorTypes.has(slot.type) }"
                @click="selectPrimarySlot(slot.type)"
              >
                <el-radio :value="slot.type" class="locator-radio" @click.stop />
                <div class="locator-slot-body" @click.stop>
                  <div class="locator-row">
                    <span class="locator-type">{{ slot.type }}</span>
                    <el-tag v-if="slot.type === 'accessibilityId'" size="small" type="success" effect="plain">推荐</el-tag>
                    <el-tag v-if="form.locatorType === slot.type" size="small" type="warning">主定位</el-tag>
                    <el-input
                      v-model="slot.value"
                      class="locator-input"
                      :placeholder="slot.placeholder"
                      @input="onSlotValueChange(slot)"
                    />
                    <el-button
                      link
                      class="locator-chevron"
                      :class="{ open: expandedLocatorTypes.has(slot.type) }"
                      @click.stop="toggleLocatorTip(slot.type)"
                    >
                      <el-icon><ArrowRight /></el-icon>
                    </el-button>
                  </div>
                  <p v-if="expandedLocatorTypes.has(slot.type) || form.locatorType === slot.type" class="locator-tip">
                    {{ slot.tip }}
                  </p>
                </div>
              </div>
            </el-radio-group>
          </el-form-item>
          <el-dropdown
            v-if="addableLocatorTypes.length"
            trigger="click"
            placement="top-start"
            popper-class="locator-add-popper"
            @command="addExtraLocatorSlot"
          >
            <button type="button" class="locator-add">+ 还要加其他定位方式</button>
            <template #dropdown>
              <el-dropdown-menu class="locator-add-menu">
                <el-dropdown-item v-for="t in addableLocatorTypes" :key="t" :command="t" class="locator-add-item">
                  <div class="locator-add-item-row">
                    <span class="locator-add-item-zh">{{ locatorMeta(t).labelZh }}</span>
                    <code class="locator-add-item-en">{{ t }}</code>
                  </div>
                  <p class="locator-add-item-tip">{{ locatorMeta(t).tip }}</p>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div class="form-hint locator-rand-hint">
            列表随机点一项：把下标写成 <code>[X]</code>（默认随机 1～3），或 <code>[X:1-5]</code>。
            例：<code>.../XCUIElementTypeOther[X]</code>
          </div>
        </div>

        <div v-show="elementFormTab === 'advanced'" class="tab-pane-body">
          <el-form-item label="预览图">
            <el-upload
              class="preview-drop"
              drag
              :show-file-list="false"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              :http-request="onUploadPreview"
            >
              <el-icon v-if="!form.previewImage" class="preview-drop-icon"><Upload /></el-icon>
              <div v-if="!form.previewImage" class="el-upload__text">
                <em>点击上传图片</em>
                <div class="preview-hint">选填，方便辨认元素 · 支持 PNG / JPG</div>
              </div>
              <el-image
                v-else
                :src="previewSrc(form.previewImage)"
                :preview-src-list="[previewSrc(form.previewImage)]"
                :preview-teleported="true"
                :z-index="4000"
                fit="contain"
                class="preview-preview"
                @click.stop
              />
            </el-upload>
            <el-button v-perm:delete v-if="form.previewImage" link type="danger" @click="clearPreview">清除预览图</el-button>
          </el-form-item>
          <el-form-item label="默认超时">
            <div class="timeout-row">
              <el-input-number v-model="form.defaultTimeoutSec" :min="1" :max="120" />
              <span class="timeout-unit">秒</span>
            </div>
            <div class="preview-hint">定位控件最长等待时间（1～120 秒）</div>
          </el-form-item>
          <el-form-item label="启用">
            <div class="enable-box">
              <div>
                <div class="enable-title">{{ form.enabled ? '元素已启用' : '元素已停用' }}</div>
                <div class="preview-hint">关闭后该元素不参与用例执行</div>
              </div>
              <el-switch v-model="form.enabled" />
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 真机点选：截图点击 → 命中控件 → 入库/选用 -->
    <el-dialog v-model="pageEditVisible" title="编辑页面" width="440px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="页面编码" required>
          <el-input v-model="pageEditForm.pageId" placeholder="英文大写+下划线，如 CS_DISCOVER" />
          <p class="page-edit-hint">修改编码会同步该页下全部元素的归属，勿与其它页编码冲突。</p>
        </el-form-item>
        <el-form-item label="中文名" required>
          <el-input v-model="pageEditForm.nameZh" placeholder="如 CS-发现页" maxlength="64" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pageEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="pageEditSaving" @click="saveEditPage">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="newPageVisible" title="新增页面" width="440px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="归属应用">
          <span>{{ listContextProduct }} · {{ platformChipLabel(filterPlatform) }}</span>
        </el-form-item>
        <el-form-item label="中文名" required>
          <!-- 失焦时问一次 AI，不做输入即时触发：每敲一个字调一次模型是浪费 -->
          <el-input
            v-model="newPageNameZh"
            placeholder="如：赛程详情、侧边栏"
            maxlength="64"
            show-word-limit
            @blur="fillPageCodeByAi"
          />
        </el-form-item>
        <el-form-item label="页面编码" required>
          <el-input v-model="newPageId" placeholder="英文大写+下划线，如 MATCH_DETAIL">
            <template #append>
              <el-button :loading="suggestingCode" @click="fillPageCodeByAi(true)">AI 生成</el-button>
            </template>
          </el-input>
          <p class="page-edit-hint">
            填完中文名会自动翻译成编码，也可以点「AI 生成」重来一次，或者自己改。<br />
            手动加元素时可选这个页面；<strong>编码建议稳定，少改</strong>——流程里引用元素用的就是它。
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newPageVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingPage" @click="submitNewPage">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shotVisible" title="Inspector 截图识别" width="880px" destroy-on-close>
      <el-alert type="info" :closable="false" class="shot-tip">
        <template #title>截 Appium Inspector 的整个窗口，要能看清右边的属性面板</template>
        <div class="shot-tip-body">
          定位器（resource-id / xpath）就在属性面板里，模型是<strong>照着认字</strong>，看不清就认不对。<br />
          <strong>识别结果不会直接入库</strong>——认错一个字符的定位器不会报错，只会在跑流程时超时说
          「找不到元素」，那时候离录入已经很远了。所以下面每条都要你核一眼再存。
        </div>
      </el-alert>

      <el-upload
        drag
        multiple
        accept="image/*"
        :auto-upload="false"
        :file-list="shotFiles"
        :on-change="onShotChange"
        :on-remove="onShotChange"
        class="shot-upload"
      >
        <el-icon class="el-icon--upload"><Plus /></el-icon>
        <div class="el-upload__text">把截图拖进来，或点击选择（一次最多 8 张）</div>
      </el-upload>

      <div class="shot-actions">
        <el-button type="primary" :loading="shotReading" :disabled="!shotFiles.length" @click="runShotRead">
          开始识别
        </el-button>
        <span v-if="shotDrafts.length" class="shot-count">识别出 {{ shotDrafts.length }} 个元素</span>
      </div>

      <el-table v-if="shotDrafts.length" :data="shotDrafts" size="small" class="shot-table">
        <el-table-column label="把握" width="76">
          <template #default="{ row }">
            <!-- 低把握的必须显眼：这条正是最需要人核对的 -->
            <el-tag size="small" :type="row.confidence === 'HIGH' ? 'success'
              : row.confidence === 'MEDIUM' ? 'warning' : 'danger'">
              {{ row.confidence === 'HIGH' ? '高' : row.confidence === 'MEDIUM' ? '中' : '低' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="中文名" width="150">
          <template #default="{ row }"><el-input v-model="row.nameZh" size="small" /></template>
        </el-table-column>
        <el-table-column label="英文键" width="170">
          <template #default="{ row }"><el-input v-model="row.nameEn" size="small" /></template>
        </el-table-column>
        <el-table-column label="定位方式" width="130">
          <template #default="{ row }">
            <el-select v-model="row.locatorType" size="small">
              <el-option v-for="t in LOCATOR_TYPES" :key="t" :label="t" :value="t" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="定位值" min-width="240">
          <template #default="{ row }">
            <el-input v-model="row.locatorValue" size="small" />
            <div v-if="row.note" class="shot-note">{{ row.note }}</div>
            <div v-if="row.visualHint" class="shot-hint">界面文案：{{ row.visualHint }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="right">
          <template #default="{ $index }">
            <el-button v-perm:delete link type="danger" size="small" @click="shotDrafts.splice($index, 1)">删</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <span class="shot-footer-hint">
          将挂到：{{ appLabel(filterAppId) || '（未选应用）' }} · {{ filterPlatform || '（未选平台）' }}
          · {{ shotPageId ? pageTitle(shotPageId) : '未归属' }}
        </span>
        <el-select v-model="shotPageId" size="small" clearable placeholder="归属页面" style="width: 200px">
          <el-option v-for="p in pageOptions" :key="p.pageId" :label="p.nameZh" :value="p.pageId" />
        </el-select>
        <el-button @click="shotVisible = false">取消</el-button>
        <el-button type="primary" :loading="shotSaving" :disabled="!shotDrafts.length" @click="saveShotDrafts">
          核对无误，保存 {{ shotDrafts.length }} 个
        </el-button>
      </template>
    </el-dialog>

    <DeviceInspectDrawer
      v-model="inspectorVisible"
      :app-id="inspectAppId"
      :platform="inspectPlatform"
      :page-id="inspectPageId"
      :fill-back="inspectFillBack"
      @saved="loadList"
      @fill-back="onInspectFillBack"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { ArrowRight, Camera, Iphone, Plus, Search, Upload } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import DeviceInspectDrawer from '@/components/DeviceInspectDrawer.vue'
import { normalizePageId, suggestPageId } from '@/utils/uiPage'

const route = useRoute()
const router = useRouter()
const inspectorVisible = ref(false)
/** true=从编辑弹窗回填定位；false=工具栏采集入库 */
const inspectFillBack = ref(false)

const inspectAppId = computed(() =>
  inspectFillBack.value ? form.appId || filterAppId.value : filterAppId.value
)
const inspectPlatform = computed(() =>
  inspectFillBack.value
    ? form.platform || filterPlatform.value || 'ANDROID'
    : filterPlatform.value || 'ANDROID'
)
const inspectPageId = computed(() =>
  inspectFillBack.value ? form.pageId || filterPageId.value : filterPageId.value
)

function openInspector(fillBack = false) {
  inspectFillBack.value = fillBack
  if (fillBack && !form.appId) {
    elementFormTab.value = 'basic'
    ElMessage.warning('请先选择应用')
    return
  }
  inspectorVisible.value = true
}

function openFillBackInspect() {
  openInspector(true)
}

function onInspectFillBack(payload: {
  primaryType: string
  primaryValue: string
  locators: Array<{ locatorType: string; locatorValue: string }>
  nameZh?: string
  nameEn?: string
  visualHint?: string
}) {
  const primaryType = String(payload?.primaryType || '').trim()
  const primaryValue = String(payload?.primaryValue || '').trim()
  if (!primaryType || !primaryValue) {
    ElMessage.warning('没有可用的定位结果')
    return
  }

  const valueByType = new Map<string, string>()
  for (const slot of locatorSlots.value) {
    if (slot.value.trim()) valueByType.set(slot.type, slot.value)
  }
  for (const loc of payload.locators || []) {
    const t = String(loc?.locatorType || '').trim()
    const v = String(loc?.locatorValue || '').trim()
    if (!t || !v) continue
    if (t.toLowerCase() === 'coordinate') continue
    // 主定位强制覆盖；其它类型只填空槽，避免冲掉人工改过的备用
    if (t === primaryType || !valueByType.get(t)?.trim()) {
      valueByType.set(t, v)
    }
  }
  valueByType.set(primaryType, primaryValue)

  const order: string[] = []
  const pushType = (t: string) => {
    if (!t || order.includes(t)) return
    order.push(t)
  }
  for (const slot of locatorSlots.value) pushType(slot.type)
  pushType(primaryType)
  for (const t of valueByType.keys()) pushType(t)

  locatorSlots.value = order.map((t) => makeSlot(t, valueByType.get(t) || ''))
  form.locatorType = primaryType
  form.locatorValue = primaryValue
  if (!form.nameZh.trim() && payload.nameZh) form.nameZh = payload.nameZh
  if (!form.nameEn.trim() && payload.nameEn) form.nameEn = payload.nameEn
  if (!form.visualHint.trim() && payload.visualHint) form.visualHint = payload.visualHint
  elementFormTab.value = 'locator'
  ElMessage.success(`已回填主定位 ${primaryType}，共 ${locatorSlots.value.filter((s) => s.value.trim()).length} 条`)
}

const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' }
]
/** 产品线 ≠ 应用字典。鸿蒙是完美电竞下的一个平台，库里却单独一条 DOMESTIC_ESPORTS_HARMONY。 */
type ProductId = 'ESPORTS' | 'POGPOG'
const PRODUCTS: { id: ProductId; label: string; platforms: string[] }[] = [
  { id: 'ESPORTS', label: '完美电竞', platforms: ['ANDROID', 'IOS', 'HARMONYOS'] },
  { id: 'POGPOG', label: 'POGPOG', platforms: ['ANDROID', 'IOS'] }
]
const sourceOptions = [
  { value: 'MANUAL', label: '人工添加' },
  { value: 'HUMAN_AI', label: '人机协同' },
  { value: 'SOURCE_CODE', label: '源码解析' },
  { value: 'IMPORT_LEGACY', label: '旧数据导入' },
  { value: 'INSPECTOR_XML', label: 'Inspector导入' }
]
const statusOptions = [
  { value: 'CANDIDATE', label: '候选' },
  { value: 'ACTIVE', label: '选用' },
  { value: 'DEPRECATED', label: '弃用' }
]
const locatorTypes = [
  'id',
  'xpath',
  'text',
  'accessibilityId',
  'iosPredicate',
  'iosClassChain',
  'className',
  'name',
  'coordinate',
  'other'
]

/** 新手可读的定位说明 */
const LOCATOR_META: Record<string, { labelZh: string; tip: string; placeholder: string }> = {
  accessibilityId: {
    labelZh: '无障碍 ID（推荐）',
    tip: 'iOS 常用 name；Android 常用 content-desc。优先选这个当主定位。',
    placeholder: '例如：CS'
  },
  iosPredicate: {
    labelZh: 'iOS 谓词',
    tip: 'Appium 的 -ios predicate string，按属性精确匹配。',
    placeholder: '例如：name == "CS"'
  },
  iosClassChain: {
    labelZh: 'iOS Class Chain',
    tip: '按控件类型 + 属性链式定位，比纯 xpath 更贴 iOS。',
    placeholder: '例如：**/XCUIElementTypeStaticText[`name == "CS"`]'
  },
  xpath: {
    labelZh: 'XPath',
    tip: '万能写法，几乎总能用；想用它当主定位，点左侧「主定位」即可。',
    placeholder: '例如：//XCUIElementTypeStaticText[@name="CS"]'
  },
  id: {
    labelZh: '资源 ID',
    tip: 'Android 的 resource-id，最稳的一种。',
    placeholder: '例如：com.xxx:id/login_btn'
  },
  text: {
    labelZh: '文案',
    tip: '控件上显示的文字；文案会变时别当主定位。',
    placeholder: '例如：登录'
  },
  className: {
    labelZh: '类名',
    tip: '控件类型；页面里常有多个同类，一般不够唯一。',
    placeholder: '例如：android.widget.Button'
  },
  name: {
    labelZh: 'Name',
    tip: '按 name 属性找；iOS 上多数情况等价于无障碍 ID。',
    placeholder: '例如：CS'
  },
  coordinate: {
    labelZh: '坐标点击',
    tip: '按屏幕坐标点；分辨率/布局一变就失效，慎用。',
    placeholder: '例如：120,340'
  },
  other: {
    labelZh: '其他',
    tip: '自定义定位值（少见场景）。',
    placeholder: '自定义定位表达式'
  }
}

type LocatorSlot = { type: string; labelZh: string; tip: string; placeholder: string; value: string }

function locatorMeta(type: string) {
  return (
    LOCATOR_META[type] || {
      labelZh: type,
      tip: '自定义定位方式',
      placeholder: '定位值'
    }
  )
}

function defaultLocatorTypesForPlatform(platform: string): string[] {
  const p = (platform || '').toUpperCase()
  if (p.includes('IOS')) {
    return ['accessibilityId', 'iosPredicate', 'iosClassChain', 'xpath']
  }
  if (p.includes('HARMONY')) {
    return ['id', 'text', 'xpath', 'accessibilityId']
  }
  // Android / Pog-Android / 默认
  return ['id', 'text', 'accessibilityId', 'xpath', 'className']
}

const locatorSlots = ref<LocatorSlot[]>([])
const extraLocatorToAdd = ref('')
const elementFormTab = ref<'basic' | 'locator' | 'advanced'>('basic')
const expandedLocatorTypes = ref<Set<string>>(new Set())

const locatorFilledCount = computed(
  () => locatorSlots.value.filter((s) => s.value.trim()).length
)

const addableLocatorTypes = computed(() => {
  const used = new Set(locatorSlots.value.map((s) => s.type))
  return locatorTypes.filter((t) => !used.has(t))
})

function makeSlot(type: string, value = ''): LocatorSlot {
  const m = locatorMeta(type)
  return {
    type,
    labelZh: m.labelZh,
    tip: m.tip,
    placeholder: m.placeholder,
    value: value || ''
  }
}

function parseFallbacksJson(raw: unknown): { locatorType: string; locatorValue: string }[] {
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(arr)) return []
    return arr
      .map((x: any) => ({
        locatorType: String(x?.locatorType || x?.type || '').trim(),
        locatorValue: String(x?.locatorValue || x?.value || '')
      }))
      .filter((x) => x.locatorType)
  } catch {
    return []
  }
}

function hydrateLocatorSlots(platform: string, primaryType: string, primaryValue: string, fallbacksRaw: unknown) {
  const presets = defaultLocatorTypesForPlatform(platform)
  const valueMap = new Map<string, string>()
  const order: string[] = []

  const push = (type: string, value: string) => {
    if (!type) return
    if (!valueMap.has(type)) {
      order.push(type)
      valueMap.set(type, value || '')
    } else if (value && !valueMap.get(type)) {
      valueMap.set(type, value)
    }
  }

  for (const t of presets) push(t, '')
  if (primaryType) push(primaryType, primaryValue || '')
  for (const fb of parseFallbacksJson(fallbacksRaw)) {
    push(fb.locatorType, fb.locatorValue || '')
  }
  // 主定位尽量靠前且保留其值
  if (primaryType && primaryValue) {
    valueMap.set(primaryType, primaryValue)
  }

  locatorSlots.value = order.map((t) => makeSlot(t, valueMap.get(t) || ''))
  if (!form.locatorType || !valueMap.has(form.locatorType)) {
    form.locatorType = primaryType || presets[0] || 'xpath'
  }
  syncPrimaryValueFromSlots()
}

function syncPrimaryValueFromSlots() {
  const hit = locatorSlots.value.find((s) => s.type === form.locatorType)
  form.locatorValue = hit?.value?.trim() || ''
}

function onPrimaryTypeChange() {
  syncPrimaryValueFromSlots()
}

function selectPrimarySlot(type: string) {
  if (!type || form.locatorType === type) return
  form.locatorType = type
  syncPrimaryValueFromSlots()
}

function onSlotValueChange(slot: LocatorSlot) {
  if (slot.type === form.locatorType) {
    form.locatorValue = slot.value
  }
}

function addExtraLocatorSlot(type: string) {
  if (!type) return
  if (locatorSlots.value.some((s) => s.type === type)) {
    extraLocatorToAdd.value = ''
    return
  }
  locatorSlots.value.push(makeSlot(type, ''))
  extraLocatorToAdd.value = ''
}

function toggleLocatorTip(type: string) {
  const next = new Set(expandedLocatorTypes.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  expandedLocatorTypes.value = next
}

function buildLocatorPayload(): { locatorType: string; locatorValue: string; locatorFallbacks: string } {
  const primaryType = form.locatorType
  const primarySlot = locatorSlots.value.find((s) => s.type === primaryType)
  const primaryValue = (primarySlot?.value || '').trim()
  const fallbacks = locatorSlots.value
    .filter((s) => s.type !== primaryType && s.value.trim())
    .map((s) => ({
      locatorType: s.type,
      locatorValue: s.value.trim(),
      label: locatorMeta(s.type).labelZh
    }))
  return {
    locatorType: primaryType,
    locatorValue: primaryValue,
    locatorFallbacks: fallbacks.length ? JSON.stringify(fallbacks) : ''
  }
}

function fallbackCount(row: any): number {
  return parseFallbacksJson(row?.locatorFallbacks).length
}

const DEFAULT_APP_ID = 'DOMESTIC_ESPORTS'
const DEFAULT_PLATFORM = 'ANDROID'

/**
 * 筛选框的值统一这样取。
 * <p>
 * el-select / el-input 带 clearable 时，点 ✕ 会把 v-model 置成 <b>undefined</b> 而不是空串，
 * 直接 .trim() 就是一句 "Cannot read properties of undefined"——清一下筛选就弹红。
 */
const txt = (v: unknown) => String(v ?? '').trim()

const filterProduct = ref<ProductId>('ESPORTS')
const filterAppId = ref(DEFAULT_APP_ID)
const filterPlatform = ref(DEFAULT_PLATFORM)
const visiblePlatforms = computed(() => {
  const allowed = PRODUCTS.find((p) => p.id === filterProduct.value)?.platforms || []
  return platforms.filter((p) => allowed.includes(p.value))
})
const listContextProduct = computed(
  () => PRODUCTS.find((p) => p.id === filterProduct.value)?.label || '未选产品'
)

function resolveAppId(product: ProductId, platform: string) {
  if (product === 'POGPOG') return 'OVERSEAS_POGPOG'
  if (String(platform || '').toUpperCase() === 'HARMONYOS') return 'DOMESTIC_ESPORTS_HARMONY'
  return 'DOMESTIC_ESPORTS'
}

function productFromAppId(appId: string): ProductId {
  const id = String(appId || '').toUpperCase()
  if (id.includes('POGPOG')) return 'POGPOG'
  return 'ESPORTS'
}

function syncAppIdFromProduct() {
  filterAppId.value = resolveAppId(filterProduct.value, filterPlatform.value)
}

function applyProductSelection(product: ProductId, platform?: string) {
  filterProduct.value = product
  const allowed = PRODUCTS.find((p) => p.id === product)?.platforms || []
  const next = String(platform || filterPlatform.value || DEFAULT_PLATFORM).toUpperCase()
  filterPlatform.value = allowed.includes(next) ? next : allowed[0] || DEFAULT_PLATFORM
  syncAppIdFromProduct()
}
const filterPageId = ref('')
const filterSource = ref('')
const filterStatus = ref('')
const filterModule = ref('')
const filterKeyword = ref('')
const viewMode = ref<'byPage' | 'flat'>('byPage')
const expandedPages = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const groupPage = ref(1)
const groupPageSize = ref(10)
const totalElements = ref(0)
const loading = ref(false)
const list = ref<any[]>([])
const appOptions = ref<any[]>([])
const pageOptions = ref<{ id?: string; pageId: string; nameZh: string }[]>([])
const pageEditVisible = ref(false)
const pageEditSaving = ref(false)
const pageEditForm = reactive({
  id: '',
  pageId: '',
  nameZh: ''
})

const newPageVisible = ref(false)
const creatingPage = ref(false)
const newPageNameZh = ref('')
const newPageId = ref('')

function openNewPage() {
  if (!filterAppId.value) {
    ElMessage.warning('请先选择应用')
    return
  }
  newPageNameZh.value = ''
  newPageId.value = ''
  newPageVisible.value = true
}

watch(newPageNameZh, (n) => {
  if (!newPageVisible.value) return
  if (!newPageId.value || newPageId.value.startsWith('PAGE_')) {
    newPageId.value = suggestPageId(n || '')
  }
})

const suggestingCode = ref(false)

// ---------- Inspector 截图识别 ----------

const LOCATOR_TYPES = ['ID', 'XPATH', 'ACCESSIBILITY_ID', 'TEXT', 'CLASS_NAME']
const shotVisible = ref(false)
const shotFiles = ref<any[]>([])
const shotDrafts = ref<any[]>([])
const shotPageId = ref('')
const shotReading = ref(false)
const shotSaving = ref(false)

function onShotChange(_file: any, fileList: any[]) {
  shotFiles.value = fileList.slice(0, 8)
}

async function runShotRead() {
  const files = shotFiles.value.map((f) => f.raw).filter(Boolean)
  if (!files.length) return
  shotReading.value = true
  try {
    const res = await apiClient.readInspectorShots(files)
    shotDrafts.value = res.drafts || []
    if (!shotDrafts.value.length) {
      ElMessage.warning('没认出元素。确认截图里能看清右侧属性面板（resource-id / xpath 那几行）')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '识别失败')
  } finally {
    shotReading.value = false
  }
}

/**
 * 逐条保存。
 *
 * 不用批量接口，是为了让部分失败可见：8 条里第 3 条重名失败，
 * 整批回滚的话前两条也白录了；而只说「保存失败」你不知道是哪条。
 */
async function saveShotDrafts() {
  if (!filterAppId.value || !filterPlatform.value) {
    ElMessage.warning('请先在上方选好应用和平台——元素是按「应用 + 平台」存的')
    return
  }
  shotSaving.value = true
  let ok = 0
  const failed: string[] = []
  for (const d of shotDrafts.value) {
    try {
      await apiClient.createUiElement({
        appId: filterAppId.value,
        platform: filterPlatform.value,
        nameZh: d.nameZh,
        nameEn: d.nameEn,
        locatorType: d.locatorType,
        locatorValue: d.locatorValue,
        locatorFallbacks: d.fallbacks?.length ? JSON.stringify(d.fallbacks) : undefined,
        visualHint: d.visualHint,
        pageId: shotPageId.value || undefined,
        source: 'AI_INSPECTOR_SHOT',
        status: 'ACTIVE'
      })
      ok++
    } catch (e: any) {
      failed.push(`${d.nameZh || d.nameEn}：${e?.message || '保存失败'}`)
    }
  }
  shotSaving.value = false
  if (ok) ElMessage.success(`已保存 ${ok} 个元素`)
  if (failed.length) {
    ElMessage.error(`${failed.length} 个没存上 —— ${failed[0]}`)
  } else {
    shotVisible.value = false
    shotDrafts.value = []
    shotFiles.value = []
  }
  loadList()
}

/**
 * 中文名翻译成英文编码。
 *
 * 只在「编码还是自动生成的随机码」时覆盖，人手改过的不动——
 * 否则你精心改成 LOGIN_SMS，一回中文名框失个焦就被冲掉了。
 * force=true 是点「AI 生成」按钮，那是明确要求重来，可以覆盖。
 */
async function fillPageCodeByAi(force = false) {
  const name = (newPageNameZh.value || '').trim()
  if (!name) return
  const current = (newPageId.value || '').trim()
  const isAuto = !current || current.startsWith('PAGE_')
  if (!force && !isAuto) return

  suggestingCode.value = true
  try {
    const res = await apiClient.suggestPageCode(name)
    if (res?.code) {
      newPageId.value = res.code
    } else if (force) {
      // 明确点了按钮却没给出结果，要说一声，别让人以为按钮坏了
      ElMessage.info('AI 没能翻译出编码，保留当前编码，可自己改')
    }
  } catch {
    // 翻不出来不影响建页面——随机码兜底，静默即可
  } finally {
    suggestingCode.value = false
  }
}

async function submitNewPage() {
  if (!filterAppId.value) {
    ElMessage.warning('请先选择应用')
    return
  }
  if (!newPageNameZh.value.trim()) {
    ElMessage.warning('请填写中文名')
    return
  }
  if (!newPageId.value.trim()) {
    ElMessage.warning('请填写页面编码')
    return
  }
  const normalized = normalizePageId(newPageId.value)
  creatingPage.value = true
  try {
    const p = await apiClient.ensureUiPage({
      appId: filterAppId.value,
      pageId: normalized,
      nameZh: newPageNameZh.value.trim()
    })
    await loadPages()
    viewMode.value = 'byPage'
    newPageVisible.value = false
    ElMessage.success(`已创建页面「${p.nameZh}」，可继续「新增元素」挂到此页`)
    await loadList()
    revealPageGroup(p.pageId, true)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    creatingPage.value = false
  }
}

function appLabel(id: string) {
  const hit = appOptions.value.find((a) => a.id === id)
  return hit ? `${hit.nameZh}` : id || '—'
}

function platformChipLabel(pf: string) {
  return platforms.find((p) => p.value === pf)?.label || pf || '未选平台'
}

function selectProduct(id: ProductId) {
  if (filterProduct.value === id) return
  filterPageId.value = ''
  applyProductSelection(id)
  onFilterChange()
}

function selectPlatform(value: string) {
  if (filterPlatform.value === value) return
  applyProductSelection(filterProduct.value, value)
  onFilterChange()
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'byPage' ? 'flat' : 'byPage'
  onFilterChange()
}

function isPageOpen(key: string) {
  return expandedPages.value.includes(key)
}

function togglePage(key: string) {
  if (isPageOpen(key)) {
    expandedPages.value = expandedPages.value.filter((k) => k !== key)
  } else {
    expandedPages.value = [...expandedPages.value, key]
  }
}

/**
 * 元素在别处时的提示。
 *
 * 页面不分平台、元素分平台，所以当前平台看着是空的很正常。
 * 另外「按页折叠 + 顶栏关键词」也常把元素筛没，却仍显示页壳子和 total——
 * 这时再说「平台字段为空」就误导了。
 */
function elsewhereHint(g: any): string {
  const total = g?.total
  if (typeof total !== 'number' || total <= 0) return ''
  if (typeof g.items?.length === 'number' && total <= g.items.length) return ''
  const map = (g?.byPlatform || {}) as Record<string, number>
  const cur = String(filterPlatform.value || '').trim().toUpperCase()
  const others = Object.entries(map).filter(([pf, n]) => n > 0 && (!cur || pf.toUpperCase() !== cur))
  if (others.length) {
    return crossPlatformTag(g)
  }
  const kw = txt(filterKeyword.value)
  if (kw) {
    const curCount = cur ? Number(map[cur] ?? map[filterPlatform.value] ?? 0) : 0
    if (curCount > 0) {
      return `本平台共 ${curCount} 个，被关键词「${kw}」筛掉了（元素名/定位不含该词）。清空搜索后再查`
    }
    return `共 ${total} 个，被关键词「${kw}」筛掉了。清空搜索或改关键词后再查`
  }
  return `共 ${total} 个，当前视图看不到（平台字段可能为空或属于别的应用）`
}

function crossPlatformTag(g: any): string {
  const map = (g?.byPlatform || {}) as Record<string, number>
  const cur = String(filterPlatform.value || '').trim().toUpperCase()
  const others = Object.entries(map).filter(([pf, n]) => n > 0 && (!cur || pf.toUpperCase() !== cur))
  if (!others.length) return ''
  return '其他平台: ' + others.map(([pf, n]) => `${platformLabel(pf)} ${n}个`).join('、')
}

function platformLabel(pf: string) {
  const p = String(pf || '').toUpperCase()
  if (p === 'ANDROID') return 'Android'
  if (p === 'IOS') return 'iOS'
  if (p === 'HARMONYOS' || p === 'HARMONY') return 'HarmonyOS'
  if (!p) return '未填平台'
  return pf
}

function pageTitle(pageId: string | null | undefined) {
  if (!pageId) return '未归属页面'
  const hit = pageOptions.value.find((p) => p.pageId === pageId)
  return hit ? hit.nameZh : pageId
}

/**
 * 删空页面。建错的、重名的（「输入手机号」和「输入手机号页面」）就是靠这个清掉。
 *
 * 有元素的页面后端会直接拒绝并报出有几个——不级联删元素，
 * 那会一次毁掉别人采了半天的东西，而且流程里引用它们的步骤会集体失效。
 */
async function removePage(g: { pageId: string; title: string }) {
  const hit = pageOptions.value.find((p) => p.pageId === g.pageId)
  if (!hit?.id) {
    ElMessage.warning('这个页面还没进字典，没有可删的记录')
    return
  }
  try {
    await ElMessageBox.confirm(`删除页面「${g.title}」？页面下没有元素，删掉不影响任何流程。`, '确认删除', {
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await apiClient.deleteUiPage(hit.id)
    ElMessage.success('已删除')
    await loadPages()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

function openEditPage(g: { pageId: string; title: string }) {
  if (!g.pageId) {
    ElMessage.warning('未归属页面无法改名，请先给元素指定 pageId')
    return
  }
  const hit = pageOptions.value.find((p) => p.pageId === g.pageId)
  if (!hit?.id) {
    // 字典里还没有：ensure 一条再编辑
    void (async () => {
      try {
        if (!filterAppId.value) {
          ElMessage.warning('请先选择应用')
          return
        }
        const p = await apiClient.ensureUiPage({
          appId: filterAppId.value,
          pageId: g.pageId,
          nameZh: g.title || g.pageId
        })
        await loadPages()
        pageEditForm.id = p.id
        pageEditForm.pageId = p.pageId
        pageEditForm.nameZh = p.nameZh
        pageEditVisible.value = true
      } catch (e: any) {
        ElMessage.error(e?.message || '无法打开编辑')
      }
    })()
    return
  }
  pageEditForm.id = hit.id
  pageEditForm.pageId = hit.pageId
  pageEditForm.nameZh = hit.nameZh
  pageEditVisible.value = true
}

async function saveEditPage() {
  if (!pageEditForm.id) {
    ElMessage.warning('页面记录不存在')
    return
  }
  if (!pageEditForm.pageId.trim()) {
    ElMessage.warning('请填写页面编码')
    return
  }
  if (!pageEditForm.nameZh.trim()) {
    ElMessage.warning('请填写中文名')
    return
  }
  const oldCode = pageEditForm.pageId
  const normalized = pageEditForm.pageId
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  pageEditSaving.value = true
  try {
    const saved = await apiClient.updateUiPage(pageEditForm.id, {
      pageId: normalized,
      nameZh: pageEditForm.nameZh.trim()
    })
    const newCode = saved?.pageId || normalized
    ElMessage.success(`已更新：${oldCode} → ${newCode}（元素归属已同步）`)
    pageEditVisible.value = false
    if (filterPageId.value) {
      filterPageId.value = newCode
    }
    await loadPages()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败（请确认后端已重启加载最新代码）')
  } finally {
    pageEditSaving.value = false
  }
}

const pageGroups = computed(() => {
  const map = new Map<
    string,
    {
      key: string
      pageId: string
      title: string
      items: any[]
      total: number | null
      byPlatform: Record<string, number> | null
    }
  >()
  const filterPid = txt(filterPageId.value)

  // 先放入页面字典（含空页，新建后也能看见）
  for (const p of pageOptions.value) {
    const pid = (p.pageId || '').trim()
    if (!pid) continue
    if (filterPid && pid !== filterPid) continue
    map.set(pid, {
      key: pid,
      pageId: pid,
      title: p.nameZh || pid,
      items: [],
      // 后端给的真实元素数（不带界面筛选）。items 是筛过的那一份——
      // 两个数不一样时要都显示出来，否则就会出现「界面 0 个、删的时候说还有 2 个」
      total: typeof p.elementCount === 'number' ? p.elementCount : null,
      byPlatform: p.elementCountByPlatform || null
    })
  }

  // 再挂元素；字典没有的页（历史脏数据）也补一组
  for (const row of list.value) {
    const pid = (row.pageId || '').trim()
    if (filterPid && pid !== filterPid) continue
    const key = pid || '__NONE__'
    if (filterPid && key === '__NONE__') continue
    if (!map.has(key)) {
      map.set(key, {
        key,
        pageId: pid,
        title: pageTitle(pid),
        items: [],
        total: null,
        byPlatform: null
      })
    }
    map.get(key)!.items.push(row)
  }

  // 筛了某页但字典/元素都没有时，仍展示空壳（刚新建）
  if (filterPid && !map.has(filterPid)) {
    const hit = pageOptions.value.find((p) => p.pageId === filterPid)
    map.set(filterPid, {
      key: filterPid,
      pageId: filterPid,
      title: hit?.nameZh || filterPid,
      items: [],
      total: typeof hit?.elementCount === 'number' ? hit.elementCount : null,
      byPlatform: hit?.elementCountByPlatform || null
    })
  }

  return Array.from(map.values())
    .filter((g) => {
      const kw = txt(filterKeyword.value)
      if (!kw || filterPid) return true
      const lower = kw.toLowerCase()
      const titleHit = g.title.includes(kw) || (g.pageId && g.pageId.toLowerCase().includes(lower))
      const elHit = g.items.some(
        (r) =>
          (r.nameZh && r.nameZh.includes(kw)) ||
          (r.nameEn && String(r.nameEn).toLowerCase().includes(lower)) ||
          (r.locatorValue && String(r.locatorValue).toLowerCase().includes(lower))
      )
      // 有关键词时只留页名/元素命中的组，避免「安装」搜出一堆空壳无线数据页
      return titleHit || elHit
    })
    .sort((a, b) => {
    if (a.key === '__NONE__') return 1
    if (b.key === '__NONE__') return -1
    // 空页排在有元素的后面一点，但新建当前筛选项优先
    if (filterPid) {
      if (a.key === filterPid) return -1
      if (b.key === filterPid) return 1
    }
    const ae = a.items.length === 0 ? 1 : 0
    const be = b.items.length === 0 ? 1 : 0
    if (ae !== be) return ae - be
    return a.title.localeCompare(b.title, 'zh')
  })
})

const pagedPageGroups = computed(() => {
  const all = pageGroups.value
  const size = groupPageSize.value
  const maxPage = Math.max(1, Math.ceil(all.length / size) || 1)
  const page = Math.min(groupPage.value, maxPage)
  const start = (page - 1) * size
  return all.slice(start, start + size)
})

function revealPageGroup(pageId: string, expand = false) {
  const idx = pageGroups.value.findIndex((g) => g.key === pageId)
  if (idx < 0) return
  groupPage.value = Math.floor(idx / groupPageSize.value) + 1
  if (expand) expandedPages.value = [pageId]
}

function onGroupPageChange() {
  expandedPages.value = []
}

function onGroupSizeChange() {
  groupPage.value = 1
  expandedPages.value = []
}

watch([() => pageGroups.value.length, groupPageSize], () => {
  const maxPage = Math.max(1, Math.ceil(pageGroups.value.length / groupPageSize.value) || 1)
  if (groupPage.value > maxPage) groupPage.value = maxPage
})

const pageCountText = computed(() => {
  if (viewMode.value === 'byPage') return `共 ${pageGroups.value.length} 个页面`
  return `共 ${totalElements.value} 个元素`
})

const listContextText = computed(() => {
  const app = listContextProduct.value
  const pf = platformChipLabel(filterPlatform.value)
  if (viewMode.value === 'byPage') return `${app} · ${pf} ${pageGroups.value.length}个页面`
  return `${app} · ${pf} ${totalElements.value}个元素`
})

function previewSrc(path: string) {
  return apiClient.uiElementPreviewUrl(path)
}

function applyDefaultAppFilter() {
  applyProductSelection('ESPORTS', DEFAULT_PLATFORM)
}

async function loadApps() {
  try {
    appOptions.value = await apiClient.getUiApps({ enabledOnly: true })
  } catch {
    appOptions.value = []
  }
  applyDefaultAppFilter()
}

async function loadPages() {
  if (!filterAppId.value) {
    pageOptions.value = []
    return
  }
  try {
    pageOptions.value = (await apiClient.getUiPages({
      appId: filterAppId.value,
      enabledOnly: true
    })) as any[]
  } catch {
    pageOptions.value = []
  }
}

watch(filterAppId, () => {
  loadPages()
})

function catalogLabel(c: string) {
  if (c === 'SHARED') return '两边共用'
  if (c === 'ONLINE') return '仅测试'
  if (c === 'AUTOMATION') return '仅自动化'
  return c || '两边共用'
}
function catalogTagType(c: string) {
  if (c === 'SHARED') return 'success'
  if (c === 'ONLINE') return 'warning'
  return 'info'
}
function sourceLabel(s: string) {
  return sourceOptions.find((x) => x.value === s)?.label || s || '人工添加'
}
function sourceTagType(s: string) {
  if (s === 'SOURCE_CODE') return 'warning'
  if (s === 'IMPORT_LEGACY' || s === 'INSPECTOR_XML') return 'info'
  if (s === 'MANUAL') return 'success'
  return ''
}
function statusLabel(s: string) {
  return statusOptions.find((x) => x.value === s)?.label || s || '候选'
}
function statusTagType(s: string) {
  if (s === 'ACTIVE') return 'success'
  if (s === 'DEPRECATED') return 'info'
  return 'warning'
}

function onFilterChange() {
  currentPage.value = 1
  groupPage.value = 1
  loadList()
}

function onSizeChange() {
  currentPage.value = 1
  loadList()
}

async function loadList() {
  loading.value = true
  try {
    const byPage = viewMode.value === 'byPage'
    const kw = txt(filterKeyword.value)
    let pageIdParam = txt(filterPageId.value) || undefined
    let keywordParam: string | undefined = kw || undefined
    // 搜索「温馨提示」等中文页名时，映射到 pageId——但按页折叠且未指定页面时，
    // 不能钉死「第一个命中页」：否则其它页壳子还在、元素全空，黄条还会误说平台问题。
    if (!pageIdParam && kw) {
      const pageNameHits = pageOptions.value.filter(
        (p) => p.nameZh.includes(kw) || p.pageId.toLowerCase().includes(kw.toLowerCase())
      )
      if (pageNameHits.length) {
        if (byPage) {
          keywordParam = undefined
        } else {
          pageIdParam = pageNameHits[0].pageId
          keywordParam = undefined
        }
      }
    }
    const data = await apiClient.getUiElements({
      appId: txt(filterAppId.value) || undefined,
      platform: filterPlatform.value || undefined,
      pageId: pageIdParam,
      source: filterSource.value || undefined,
      status: filterStatus.value || undefined,
      moduleTag: txt(filterModule.value) || undefined,
      keyword: keywordParam,
      page: byPage ? 1 : currentPage.value,
      size: byPage ? 500 : pageSize.value
    })
    if (Array.isArray(data)) {
      totalElements.value = data.length
      if (byPage) {
        list.value = data
      } else {
        const start = (currentPage.value - 1) * pageSize.value
        list.value = data.slice(start, start + pageSize.value)
      }
    } else {
      const page = data as {
        content?: any[]
        totalElements?: number
      }
      list.value = page.content || []
      totalElements.value = page.totalElements ?? 0
    }
    syncExpandedByKeyword()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败（请确认已执行元素库迁移 SQL）')
    list.value = []
    totalElements.value = 0
  } finally {
    loading.value = false
  }
}

function syncExpandedByKeyword() {
  if (viewMode.value !== 'byPage') return
  if (filterPageId.value) {
    revealPageGroup(filterPageId.value)
    return
  }
  const kw = txt(filterKeyword.value)
  if (!kw) return
  const lower = kw.toLowerCase()
  const hit = pageGroups.value.find(
    (g) =>
      g.title.includes(kw) ||
      (g.pageId && g.pageId.toLowerCase().includes(lower)) ||
      g.items.some(
        (r) =>
          (r.nameZh && r.nameZh.includes(kw)) ||
          (r.nameEn && String(r.nameEn).toLowerCase().includes(lower)) ||
          (r.locatorValue && String(r.locatorValue).toLowerCase().includes(lower))
      )
  )
  if (hit) revealPageGroup(hit.key)
}

function resetFilters() {
  filterPageId.value = ''
  filterSource.value = ''
  filterStatus.value = ''
  filterModule.value = ''
  filterKeyword.value = ''
  currentPage.value = 1
  groupPage.value = 1
  loadList()
}

const dialogVisible = ref(false)
const editingId = ref('')
const saving = ref(false)
const uploadingPreview = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  catalog: 'SHARED',
  appId: '',
  platform: 'ANDROID',
  source: 'MANUAL',
  status: 'CANDIDATE',
  nameZh: '',
  nameEn: '',
  pageId: '',
  moduleTag: '',
  description: '',
  visualHint: '',
  locatorType: 'xpath',
  locatorValue: '',
  previewImage: '',
  defaultTimeoutSec: 10,
  enabled: true
})
const rules: FormRules = {
  appId: [{ required: true, message: '请选择应用', trigger: 'change' }],
  platform: [{ required: true, message: '必选', trigger: 'change' }],
  source: [{ required: true, message: '必选', trigger: 'change' }],
  status: [{ required: true, message: '必选', trigger: 'change' }],
  nameZh: [{ required: true, message: '必填', trigger: 'blur' }],
  nameEn: [{ required: true, message: '必填', trigger: 'blur' }],
  locatorType: [{ required: true, message: '必选', trigger: 'change' }],
  locatorValue: [{ required: true, message: '请填写当前主定位的值', trigger: 'blur' }]
}

/** 新建时切换平台：保留已填的定位值，按平台补齐常用定位框 */
watch(
  () => form.platform,
  (plat, prev) => {
    if (!dialogVisible.value || !!editingId.value) return
    if (!plat || plat === prev) return
    const primaryVal =
      locatorSlots.value.find((s) => s.type === form.locatorType)?.value || form.locatorValue || ''
    const fakeFallbacks = locatorSlots.value
      .filter((s) => s.type !== form.locatorType && s.value.trim())
      .map((s) => ({ locatorType: s.type, locatorValue: s.value }))
    hydrateLocatorSlots(plat, form.locatorType, primaryVal, fakeFallbacks)
    const still = locatorSlots.value.find((s) => s.type === form.locatorType)
    if (!still) {
      const filled = locatorSlots.value.find((s) => s.value.trim())
      form.locatorType = filled?.type || defaultLocatorTypesForPlatform(plat)[0] || 'xpath'
    }
    syncPrimaryValueFromSlots()
  }
)

function resetForm() {
  elementFormTab.value = 'basic'
  expandedLocatorTypes.value = new Set()
  editingId.value = ''
  Object.assign(form, {
    catalog: 'SHARED',
    appId: filterAppId.value || appOptions.value[0]?.id || '',
    platform: filterPlatform.value || 'ANDROID',
    source: 'MANUAL',
    status: 'CANDIDATE',
    nameZh: '',
    nameEn: '',
    pageId: filterPageId.value || '',
    moduleTag: '',
    description: '',
    visualHint: '',
    locatorType: 'xpath',
    locatorValue: '',
    previewImage: '',
    defaultTimeoutSec: 10,
    enabled: true
  })
  const presets = defaultLocatorTypesForPlatform(form.platform)
  form.locatorType = presets[0] || 'xpath'
  hydrateLocatorSlots(form.platform, form.locatorType, '', null)
}

async function onUploadPreview(options: UploadRequestOptions) {
  const file = options.file as File
  uploadingPreview.value = true
  try {
    const res = await apiClient.uploadUiElementPreview(file)
    form.previewImage = res.previewImage
    ElMessage.success('图片已上传')
    options.onSuccess?.(res as any)
  } catch (e: any) {
    ElMessage.error(e?.message || '上传失败')
    options.onError?.(e)
  } finally {
    uploadingPreview.value = false
  }
}

function clearPreview() {
  form.previewImage = ''
}

function openAdd() {
  resetForm()
  dialogVisible.value = true
}

function openAddForPage(pageId: string) {
  if (pageId) {
    filterPageId.value = pageId
  }
  resetForm()
  if (pageId) {
    form.pageId = pageId
  }
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, {
    catalog: row.catalog || 'SHARED',
    appId: row.appId || '',
    platform: row.platform || 'ANDROID',
    source: row.source || 'HUMAN_AI',
    status: row.status || 'CANDIDATE',
    nameZh: row.nameZh || '',
    nameEn: row.nameEn || '',
    pageId: row.pageId || '',
    moduleTag: row.moduleTag || '',
    description: row.description || '',
    visualHint: row.visualHint || '',
    locatorType: row.locatorType || 'xpath',
    locatorValue: row.locatorValue || '',
    previewImage: row.previewImage || '',
    defaultTimeoutSec: row.defaultTimeoutSec ?? 10,
    enabled: row.enabled !== false
  })
  hydrateLocatorSlots(form.platform, form.locatorType, form.locatorValue, row.locatorFallbacks)
  elementFormTab.value = 'basic'
  expandedLocatorTypes.value = new Set()
  dialogVisible.value = true
}

async function submit() {
  syncPrimaryValueFromSlots()
  try {
    await formRef.value?.validate()
  } catch {
    elementFormTab.value = 'basic'
    return
  }
  if (!form.locatorValue.trim()) {
    elementFormTab.value = 'locator'
    ElMessage.warning('请给「当前主定位」填上定位值，或换一个已有值的方式当主定位')
    return
  }
  saving.value = true
  try {
    const loc = buildLocatorPayload()
    const body = { ...form, ...loc }
    if (editingId.value) {
      await apiClient.updateUiElement(editingId.value, body)
      ElMessage.success('已更新')
    } else {
      await apiClient.createUiElement(body)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function promoteActive(row: any) {
  try {
    await apiClient.updateUiElement(row.id, { status: 'ACTIVE' })
    ElMessage.success(`已选用「${row.nameZh}」`)
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '选用失败')
  }
}

async function handleDelete(row: any) {
  await ElMessageBox.confirm(`确定删除元素「${row.nameZh} / ${row.nameEn}」？`, '删除', { type: 'warning' })
  try {
    await apiClient.deleteUiElement(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(async () => {
  await loadApps()
  await loadPages()
  const q = route.query
  if (typeof q.appId === 'string' && q.appId.trim()) {
    const appId = q.appId.trim()
    const platform =
      appId === 'DOMESTIC_ESPORTS_HARMONY'
        ? 'HARMONYOS'
        : typeof q.platform === 'string'
          ? q.platform.trim()
          : filterPlatform.value
    applyProductSelection(productFromAppId(appId), platform)
  } else if (typeof q.platform === 'string' && q.platform.trim()) {
    applyProductSelection(filterProduct.value, q.platform.trim())
  }
  if (typeof q.pageId === 'string' && q.pageId.trim()) {
    filterPageId.value = q.pageId.trim()
  }
  await loadList()
  if (q.inspect === '1' || q.inspect === 'true') {
    const nextQuery = { ...q } as Record<string, any>
    delete nextQuery.inspect
    await router.replace({ query: nextQuery })
    inspectorVisible.value = true
  }
})
</script>

<style scoped>
.ui-elements {
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
.plat-chip {
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
.search-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.search-input {
  width: 320px;
  flex: 1 1 240px;
  max-width: 420px;
}
.search-count {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}
.list-panel {
  padding: 0 0 8px;
  overflow: hidden;
}
.list-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  font-size: 13px;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
}
.view-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
}
.view-switch b {
  color: #303133;
  font-weight: 600;
}
.page-list {
  min-height: 80px;
}
.page-block + .page-block {
  border-top: 1px solid #eef0f4;
}
.page-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  cursor: pointer;
}
.page-row:hover {
  background: #fafbfc;
}
.page-caret {
  color: #c0c4cc;
  font-size: 12px;
  transition: transform 0.15s;
  flex-shrink: 0;
}
.page-caret.open {
  transform: rotate(90deg);
}
.page-name {
  font-weight: 650;
  color: #1f2329;
  font-size: 14px;
}
.page-id {
  font-size: 12px;
  color: #909399;
  letter-spacing: 0.02em;
}
.count-tag,
.other-tag {
  font-size: 12px;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.count-tag {
  background: #ecf5ff;
  color: #409eff;
}
.other-tag {
  background: #fdf6ec;
  color: #e6a23c;
}
.page-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.page-body {
  padding: 0 16px 14px 38px;
}
.page-empty {
  padding: 16px 8px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.shot-tip {
  margin-bottom: 14px;
}
.shot-tip-body {
  font-size: 13px;
  line-height: 1.7;
  margin-top: 4px;
}
.shot-upload {
  margin-bottom: 12px;
}
.shot-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.shot-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.shot-table {
  max-height: 420px;
  overflow: auto;
}
.shot-note {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-color-danger);
  line-height: 1.5;
}
.shot-hint {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.shot-footer-hint {
  float: left;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 32px;
}
.page-edit-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}
.pagination-wrap {
  margin-top: 16px;
  padding: 0 16px 8px;
  display: flex;
  justify-content: flex-end;
}
.preview-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.preview-empty {
  color: #c0c4cc;
}
.preview-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.45;
}
.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
.form-hint code {
  padding: 0 4px;
  border-radius: 3px;
  background: #f4f4f5;
  color: var(--app-text-secondary);
  font-size: 11px;
}

.element-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}
.element-tabs {
  margin: 0 0 8px;
}
.element-tabs :deep(.el-tabs__header) {
  margin: 0 0 4px;
}
.element-tabs :deep(.el-tabs__content) {
  display: none;
}
.tab-badge {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  line-height: 1;
  vertical-align: super;
}
.tab-pane-body {
  padding-top: 8px;
}
.element-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.locator-form-item {
  margin-bottom: 12px;
}
.locator-radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.locator-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.locator-guide {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
}
.locator-toolbar .el-button {
  flex-shrink: 0;
  margin-top: 2px;
}
.locator-slot {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  cursor: pointer;
  width: 100%;
  margin: 0;
  height: auto;
}
.locator-slot.is-primary {
  background: #fffbeb;
  border-color: #f59e0b;
  box-shadow: inset 0 0 0 1px #fcd34d;
}
.locator-radio {
  margin-top: 8px;
  flex-shrink: 0;
  height: auto;
}
.locator-radio :deep(.el-radio__label) {
  display: none;
}
.locator-slot-body {
  flex: 1;
  min-width: 0;
}
.locator-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.locator-type {
  flex-shrink: 0;
  min-width: 118px;
  font-weight: 600;
  color: #303133;
  font-size: 13px;
}
.locator-input {
  flex: 1;
  min-width: 0;
}
.locator-chevron {
  flex-shrink: 0;
  padding: 0 2px;
  color: #909399;
}
.locator-chevron :deep(.el-icon) {
  transition: transform 0.15s;
}
.locator-chevron.open :deep(.el-icon) {
  transform: rotate(90deg);
}
.locator-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.tab-pane-body :deep(.el-dropdown) {
  display: block;
  width: 100%;
}
.locator-add {
  display: block;
  width: 100%;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fafafa;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
}
.locator-add:hover {
  border-color: #409eff;
  color: #409eff;
  background: #f5f9ff;
}
.locator-rand-hint {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f7fa;
}

.preview-drop {
  width: 100%;
}
.preview-drop :deep(.el-upload),
.preview-drop :deep(.el-upload-dragger) {
  width: 100%;
}
.preview-drop :deep(.el-upload-dragger) {
  padding: 28px 16px;
}
.preview-drop-icon {
  font-size: 28px;
  color: #409eff;
  margin-bottom: 8px;
}
.timeout-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeout-unit {
  color: #606266;
  font-size: 13px;
}
.enable-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.enable-title {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.preview-preview {
  margin: 0 auto;
  width: 160px;
  height: 120px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
}

.ui-elements :deep(.el-image-viewer__wrapper) {
  z-index: 4000 !important;
}

.ui-elements :deep(.el-image-viewer__mask) {
  backdrop-filter: blur(2px);
}
</style>

<!-- 下拉挂到 body，scoped 套不上 -->
<style>
.locator-add-popper.el-popper {
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  min-width: 360px;
}
.locator-add-popper .el-dropdown-menu {
  padding: 0;
  border: none;
  background: transparent;
}
.locator-add-popper .el-dropdown-menu__item {
  display: block;
  height: auto;
  line-height: 1.4;
  padding: 10px 12px;
  margin: 2px 0;
  border-radius: 8px;
  white-space: normal;
}
.locator-add-popper .el-dropdown-menu__item:not(.is-disabled):hover,
.locator-add-popper .el-dropdown-menu__item:focus {
  background: #f5f9ff;
  color: inherit;
}
.locator-add-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.locator-add-item-zh {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.locator-add-item-en {
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 4px;
}
.locator-add-item-tip {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.45;
}
</style>
