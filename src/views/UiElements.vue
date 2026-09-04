<template>
  <div class="ui-elements">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">元素库</span>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/ui-inspector-import')">Inspector 导入</el-button>
            <el-button @click="shotVisible = true">Inspector 截图识别</el-button>
            <el-button @click="inspectorVisible = true">真机点选</el-button>
            <el-button type="primary" @click="openNewPage">
              <el-icon><Plus /></el-icon>
              新增页面
            </el-button>
            <el-button type="primary" @click="openAdd">
              <el-icon><Plus /></el-icon>
              新增元素
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="filterScene" class="catalog-tabs" @tab-change="onFilterChange">
        <el-tab-pane v-for="c in sceneTabs" :key="c.value" :label="c.label" :name="c.value" />
      </el-tabs>
      <p v-if="catalogHint" class="catalog-hint">{{ catalogHint }}</p>

      <div class="filter-bar">
        <el-form :inline="true">
          <el-form-item label="应用">
            <el-select v-model="filterAppId" clearable filterable placeholder="选择应用" style="width: 220px" @change="onFilterChange">
              <el-option
                v-for="a in appOptions"
                :key="a.id"
                :label="`${a.nameZh} (${a.id})`"
                :value="a.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filterPlatform" clearable placeholder="平台" style="width: 130px" @change="onFilterChange">
              <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="页面">
            <el-select
              v-model="filterPageId"
              clearable
              filterable
              placeholder="全部页面/弹窗"
              style="width: 220px"
              @change="onFilterChange"
            >
              <el-option
                v-for="p in pageOptions"
                :key="p.pageId"
                :label="`${p.nameZh} (${p.pageId})`"
                :value="p.pageId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="展示">
            <el-radio-group v-model="viewMode" @change="onFilterChange">
              <el-radio-button value="byPage">按页折叠</el-radio-button>
              <el-radio-button value="flat">平铺</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="来源">
            <el-select v-model="filterSource" clearable placeholder="全部" style="width: 130px" @change="onFilterChange">
              <el-option v-for="s in sourceOptions" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filterStatus" clearable placeholder="全部" style="width: 110px" @change="onFilterChange">
              <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="模块">
            <el-input v-model="filterModule" clearable placeholder="如 设置" style="width: 120px" @keyup.enter="onFilterChange" />
          </el-form-item>
          <el-form-item label="搜索">
            <el-input
              v-model="filterKeyword"
              clearable
              placeholder="页面名 / 元素名 / pageId / 定位"
              style="width: 280px"
              @keyup.enter="onFilterChange"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onFilterChange">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-collapse v-if="viewMode === 'byPage'" v-model="expandedPages" class="page-collapse" v-loading="loading">
        <el-collapse-item v-for="g in pageGroups" :key="g.key" :name="g.key">
          <template #title>
            <div class="page-group-title">
              <span class="page-name">{{ g.title }}</span>
              <el-tag size="small" type="info">{{ g.pageId || '未归属' }}</el-tag>
              <!--
                页面是按应用建的、不分平台，元素才分平台。
                所以「Android 下 0 个」和「这个页面共 24 个」可以同时成立——
                只说「被筛选挡住」会让人清空筛选后还是找不到，必须说清楚在哪一端。
              -->
              <el-tag size="small">{{ g.items.length }} 个元素</el-tag>
              <el-tag
                v-if="elsewhereHint(g)"
                size="small"
                type="warning"
                effect="plain"
                title="页面按应用建、不分平台；元素才分平台。删除按钮只在三端都为空时出现"
              >{{ elsewhereHint(g) }}</el-tag>
              <el-button
                v-if="g.pageId"
                type="primary"
                link
                size="small"
                @click.stop="openEditPage(g)"
              >改名</el-button>
              <!--
                删除只在「三端都没有元素」时出现——页面按应用建、不分平台，
                只要任一平台下还挂着元素就删不掉（后端会拒），按钮摆在那只会让人白点一次。
                g.total 是后端给的跨平台总数；拿不到时（后端未重启）退回按当前视图判断。
              -->
              <el-button v-perm:delete
                v-if="g.pageId && (g.total === 0 || (g.total === null && !g.items.length))"
                type="danger"
                link
                size="small"
                @click.stop="removePage(g)"
              >删除</el-button>
            </div>
          </template>
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
        </el-collapse-item>
      </el-collapse>
      <el-empty
        v-if="viewMode === 'byPage' && !loading && pageGroups.length === 0"
        description="暂无页面。可点「新增页面」创建，再「新增元素」挂上去"
      />

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
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑元素' : '新增元素'" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="用途" prop="catalog">
          <el-select v-model="form.catalog" style="width: 100%">
            <el-option
              v-for="c in scopeOptions"
              :key="c.value"
              :label="c.label"
              :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="应用" prop="appId">
          <el-select v-model="form.appId" :disabled="!!editingId" filterable placeholder="请选择应用" style="width: 100%">
            <el-option
              v-for="a in appOptions"
              :key="a.id"
              :label="`${a.nameZh} (${a.id})`"
              :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-select v-model="form.platform" :disabled="!!editingId" style="width: 100%">
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源" prop="source">
          <el-select v-model="form.source" :disabled="!!editingId" style="width: 100%">
            <el-option v-for="s in sourceOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="中文名称" prop="nameZh">
          <el-input v-model="form.nameZh" placeholder="如 登录按钮" />
        </el-form-item>
        <el-form-item label="英文名称" prop="nameEn">
          <el-input v-model="form.nameEn" placeholder="流程引用 key，如 login_btn" />
        </el-form-item>
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
        <el-form-item label="模块标签">
          <el-input v-model="form.moduleTag" placeholder="如 设置（仅分组展示）" />
        </el-form-item>
        <el-form-item label="视觉说明">
          <el-input v-model="form.visualHint" maxlength="120" show-word-limit placeholder="如 左上角三横线汉堡" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="怎么找控件" prop="locatorValue" required>
          <div class="locator-panel">
            <p class="locator-guide">
              <b>怎么用：</b>左侧圆点选「主定位」（执行时优先用）；下面每个框都能填备用方案。
              主定位找不到时，会自动按顺序再试有填值的备用。想用 XPath？点 XPath 那一行的圆点即可。
            </p>
            <el-radio-group
              v-model="form.locatorType"
              class="locator-radio-group"
              @change="onPrimaryTypeChange"
            >
              <div
                v-for="slot in locatorSlots"
                :key="slot.type"
                class="locator-slot"
                :class="{ 'is-primary': form.locatorType === slot.type }"
                @click="selectPrimarySlot(slot.type)"
              >
                <el-radio :value="slot.type" class="locator-radio" @click.stop>
                  主定位
                </el-radio>
                <div class="locator-slot-body" @click.stop>
                  <div class="locator-slot-head">
                    <span class="locator-zh">{{ slot.labelZh }}</span>
                    <el-tag size="small" type="info" effect="plain">{{ slot.type }}</el-tag>
                    <el-tag v-if="form.locatorType === slot.type" size="small" type="warning">当前主定位</el-tag>
                    <el-tag v-else-if="slot.value.trim()" size="small" type="success" effect="plain">备用</el-tag>
                  </div>
                  <p class="locator-tip">{{ slot.tip }}</p>
                  <el-input
                    v-model="slot.value"
                    type="textarea"
                    :autosize="{ minRows: slot.type === 'xpath' || slot.type === 'iosClassChain' ? 2 : 1, maxRows: 4 }"
                    :placeholder="slot.placeholder"
                    @input="onSlotValueChange(slot)"
                  />
                </div>
              </div>
            </el-radio-group>
            <div class="locator-extra">
              <el-select
                v-model="extraLocatorToAdd"
                placeholder="还要加其他定位方式？"
                clearable
                filterable
                style="width: 260px"
                @change="addExtraLocatorSlot"
              >
                <el-option
                  v-for="t in addableLocatorTypes"
                  :key="t"
                  :label="locatorMeta(t).labelZh + '（' + t + '）'"
                  :value="t"
                />
              </el-select>
            </div>
            <div class="form-hint">
              列表随机点一项：把下标写成 <code>[X]</code>（默认随机 1～3），或 <code>[X:1-5]</code>。
              例：<code>.../XCUIElementTypeOther[X]</code>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="预览图">
          <div class="preview-upload">
            <el-upload
              :show-file-list="false"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              :http-request="onUploadPreview"
            >
              <el-button :loading="uploadingPreview">上传图片</el-button>
            </el-upload>
            <el-button v-perm:delete v-if="form.previewImage" link type="danger" @click="clearPreview">清除</el-button>
            <span class="preview-hint">选填，方便辨认元素</span>
          </div>
          <el-image
            v-if="form.previewImage"
            :src="previewSrc(form.previewImage)"
            :preview-src-list="[previewSrc(form.previewImage)]"
            :preview-teleported="true"
            :z-index="4000"
            fit="contain"
            class="preview-preview" />
        </el-form-item>
        <el-form-item label="默认超时(秒)">
          <el-input-number v-model="form.defaultTimeoutSec" :min="1" :max="120" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
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
          <span>{{ appLabel(filterAppId) || '请先在上方筛选选择应用' }}</span>
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
      :app-id="filterAppId"
      :platform="filterPlatform || 'ANDROID'"
      :page-id="filterPageId"
      @saved="loadList"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { apiClient } from '@/api'
import DeviceInspectDrawer from '@/components/DeviceInspectDrawer.vue'
import { normalizePageId, suggestPageId } from '@/utils/uiPage'

const route = useRoute()
const router = useRouter()
const inspectorVisible = ref(false)

const sceneTabs = [
  { value: 'AUTOMATION', label: '自动化' },
  { value: 'TEST', label: '测试' }
]
const scopeOptions = [
  { value: 'SHARED', label: '两边共用（推荐，定位相同只改一处）' },
  { value: 'AUTOMATION', label: '仅自动化' },
  { value: 'ONLINE', label: '仅测试' }
]
const platforms = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IOS', label: 'iOS' },
  { value: 'HARMONYOS', label: 'HarmonyOS' }
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

const filterScene = ref('AUTOMATION')
/**
 * 筛选框的值统一这样取。
 * <p>
 * el-select / el-input 带 clearable 时，点 ✕ 会把 v-model 置成 <b>undefined</b> 而不是空串，
 * 直接 .trim() 就是一句 "Cannot read properties of undefined"——清一下筛选就弹红。
 */
const txt = (v: unknown) => String(v ?? '').trim()

const filterAppId = ref(DEFAULT_APP_ID)
const filterPlatform = ref(DEFAULT_PLATFORM)
const filterPageId = ref('')
const filterSource = ref('')
const filterStatus = ref('')
const filterModule = ref('')
const filterKeyword = ref('')
const viewMode = ref<'byPage' | 'flat'>('byPage')
const expandedPages = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
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
    filterPageId.value = p.pageId
    viewMode.value = 'byPage'
    expandedPages.value = [p.pageId]
    newPageVisible.value = false
    ElMessage.success(`已创建页面「${p.nameZh}」，可继续「新增元素」挂到此页`)
    await loadList()
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
    return '其他平台还有：' + others.map(([pf, n]) => `${platformLabel(pf)} ${n} 个`).join('、')
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

function platformLabel(pf: string) {
  const p = String(pf || '').toUpperCase()
  if (p === 'ANDROID') return 'Android'
  if (p === 'IOS') return 'iOS'
  if (p === 'HARMONYOS' || p === 'HARMONY') return '鸿蒙'
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

function previewSrc(path: string) {
  return apiClient.uiElementPreviewUrl(path)
}

function applyDefaultAppFilter() {
  const hit = appOptions.value.find((a) => a.id === DEFAULT_APP_ID)
    || appOptions.value.find((a) => (a.nameZh || '').includes('完美世界电竞'))
    || appOptions.value[0]
  filterAppId.value = hit?.id || DEFAULT_APP_ID
  filterPlatform.value = DEFAULT_PLATFORM
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

const catalogHint = computed(() => {
  if (viewMode.value === 'byPage') {
    return ''
  }
  if (filterScene.value === 'TEST') {
    return '测试侧可见：仅测试 + 两边共用。列表按应用+平台分页；可用「来源/状态」筛候选；点「选用」设为 ACTIVE。'
  }
  return '自动化侧可见：仅自动化 + 两边共用。列表按应用+平台分页；定位错了点「编辑」；确认无误点「选用」。'
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

function catalogsForScene(scene: string) {
  return scene === 'TEST' ? 'ONLINE,SHARED' : 'AUTOMATION,SHARED'
}

function onFilterChange() {
  currentPage.value = 1
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
      catalogs: catalogsForScene(filterScene.value),
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
  const kw = txt(filterKeyword.value)
  if (!kw || viewMode.value !== 'byPage') {
    if (filterPageId.value) {
      expandedPages.value = [filterPageId.value]
    } else if (pageGroups.value.length && expandedPages.value.length === 0) {
      expandedPages.value = [pageGroups.value[0].key]
    }
    return
  }
  const lower = kw.toLowerCase()
  const keys: string[] = []
  for (const g of pageGroups.value) {
    const titleHit = g.title.includes(kw) || (g.pageId && g.pageId.toLowerCase().includes(lower))
    const elHit = g.items.some(
      (r) =>
        (r.nameZh && r.nameZh.includes(kw)) ||
        (r.nameEn && String(r.nameEn).toLowerCase().includes(lower)) ||
        (r.locatorValue && String(r.locatorValue).toLowerCase().includes(lower))
    )
    if (titleHit || elHit) keys.push(g.key)
  }
  expandedPages.value = keys.length ? keys : pageGroups.value.map((g) => g.key).slice(0, 1)
}

function resetFilters() {
  filterAppId.value = ''
  filterPlatform.value = ''
  filterPageId.value = ''
  filterSource.value = ''
  filterStatus.value = ''
  filterModule.value = ''
  filterKeyword.value = ''
  currentPage.value = 1
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
  catalog: [{ required: true, message: '必选', trigger: 'change' }],
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
  dialogVisible.value = true
}

async function submit() {
  syncPrimaryValueFromSlots()
  await formRef.value?.validate().catch(() => Promise.reject())
  if (!form.locatorValue.trim()) {
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

/** —— 真机点选（逻辑在 DeviceInspectDrawer） —— */

onMounted(async () => {
  await loadApps()
  await loadPages()
  const q = route.query
  if (typeof q.appId === 'string' && q.appId.trim()) {
    filterAppId.value = q.appId.trim()
  }
  if (typeof q.platform === 'string' && q.platform.trim()) {
    filterPlatform.value = q.platform.trim()
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
.page-collapse {
  margin-top: 8px;
}
.page-empty {
  padding: 16px 8px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.page-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  cursor: pointer;
}
.page-name {
  font-weight: 600;
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
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.catalog-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.filter-bar {
  margin-bottom: 12px;
}
.pagination-wrap {
  margin-top: 16px;
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
.preview-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preview-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
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

.locator-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.locator-radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.locator-guide {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f0f7ff;
  border: 1px solid #d6e8ff;
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
}
.locator-slot {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  cursor: pointer;
  width: 100%;
  margin: 0;
  height: auto;
}
.locator-slot.is-primary {
  background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #f59e0b;
  box-shadow: inset 0 0 0 1px #fcd34d;
}
.locator-radio {
  margin-top: 4px;
  flex-shrink: 0;
  width: 72px;
}
.locator-slot-body {
  flex: 1;
  min-width: 0;
}
.locator-slot-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.locator-zh {
  font-weight: 600;
  color: #0f172a;
  font-size: 13px;
}
.locator-tip {
  margin: 0 0 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}
.locator-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fb-count {
  margin-top: 2px;
  font-size: 11px;
  color: #b45309;
  line-height: 1.2;
}

.preview-preview {
  margin-top: 8px;
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
