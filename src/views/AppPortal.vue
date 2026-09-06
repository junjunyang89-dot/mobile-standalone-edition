<template>
  <div class="portal">
    <div class="portal-head">
      <div>
        <h2>APP 门户</h2>
        <p>
          两套 Jenkins、发包页、文档入口收在这里。点卡片就打开，不用再换浏览器找地址。
          Jenkins 一般不能嵌进页面里，所以是新窗口打开。
        </p>
      </div>
      <el-button type="primary" @click="openEdit()">添加入口</el-button>
    </div>

    <div v-loading="loading">
      <section v-for="g in groups" :key="g.key" class="portal-group">
        <h3>{{ g.label }}</h3>
        <div class="card-grid">
          <button
            v-for="link in g.links"
            :key="link.id"
            type="button"
            class="link-card"
            :class="{ ready: link.ready }"
            @click="openLink(link)"
          >
            <div class="link-title">{{ link.title }}</div>
            <div class="link-url">{{ link.ready ? link.url : '还没填地址，点右上角编辑' }}</div>
            <div v-if="link.remark" class="link-remark">{{ link.remark }}</div>
            <div class="link-ops" @click.stop>
              <el-button link type="primary" size="small" @click="openEdit(link)">编辑</el-button>
              <el-button link type="danger" size="small" @click="remove(link)">删除</el-button>
            </div>
          </button>
        </div>
      </section>
      <el-empty v-if="!loading && !groups.length" description="还没有入口" />
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑入口' : '添加入口'" width="520px" destroy-on-close>
      <el-form label-width="72px">
        <el-form-item label="分组">
          <el-select v-model="form.groupKey" style="width: 100%">
            <el-option label="Jenkins" value="jenkins" />
            <el-option label="发包 / 安装包" value="release" />
            <el-option label="文档" value="docs" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.title" placeholder="例如 Jenkins · 电竞" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.url" placeholder="https://jenkins.xxx.com/job/..." />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="这套 Jenkins 干什么用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient } from '../api'

const loading = ref(false)
const saving = ref(false)
const visible = ref(false)
const groups = ref<Array<{ key: string; label: string; links: any[] }>>([])

const form = reactive({
  id: '',
  groupKey: 'jenkins',
  title: '',
  url: '',
  remark: ''
})

async function load() {
  loading.value = true
  try {
    const r = await apiClient.getAppPortal()
    groups.value = r.groups || []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openLink(link: any) {
  if (!link.ready) {
    openEdit(link)
    return
  }
  window.open(link.url, '_blank')
}

function openEdit(link?: any) {
  form.id = link?.id || ''
  form.groupKey = link?.groupKey || 'jenkins'
  form.title = link?.title || ''
  form.url = link?.url || ''
  form.remark = link?.remark || ''
  visible.value = true
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('先填名称')
    return
  }
  saving.value = true
  try {
    await apiClient.saveAppPortalLink({
      id: form.id || undefined,
      groupKey: form.groupKey,
      title: form.title.trim(),
      url: form.url.trim(),
      remark: form.remark.trim()
    })
    visible.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(link: any) {
  try {
    await ElMessageBox.confirm(`删除「${link.title}」？`, '删除入口', { type: 'warning' })
    await apiClient.deleteAppPortalLink(link.id)
    await load()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.portal {
  max-width: 1080px;
}
.portal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}
.portal-head h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
.portal-head p {
  margin: 0;
  color: #8c8c8c;
  font-size: 13px;
  line-height: 1.6;
  max-width: 640px;
}
.portal-group {
  margin-bottom: 28px;
}
.portal-group h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #595959;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.link-card {
  text-align: left;
  border: 1px solid #f0f0f0;
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
}
.link-card.ready:hover {
  border-color: #1890ff;
}
.link-card:not(.ready) {
  background: #fafafa;
}
.link-title {
  font-weight: 600;
  font-size: 15px;
}
.link-url {
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
  word-break: break-all;
}
.link-remark {
  margin-top: 6px;
  font-size: 12px;
  color: #595959;
}
.link-ops {
  margin-top: 10px;
}
</style>
