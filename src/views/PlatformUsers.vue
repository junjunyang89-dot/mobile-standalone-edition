<template>
  <div class="page">
    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <span>账号与权限</span>
          <el-button type="primary" size="small" @click="openCreate">新建账号</el-button>
        </div>
      </template>

      <!--
        建第一个账号的那一瞬间鉴权就生效了，而当前这个会话是没有令牌的，
        下一个请求就会被踢到登录页。不提前说的话，用户会以为是自己把平台点坏了
      -->
      <el-alert
        v-if="bootstrapping"
        type="warning"
        :closable="false"
        show-icon
        class="role-legend"
        title="平台目前还没有账号，权限校验未生效——所有人都能进所有页面"
      >
        <div class="role-legend-body">
          建好第一个<b>管理员</b>账号后，权限立即开始生效。你当前这个会话还没有登录，
          会被要求用刚建的账号重新登录一次。建议先把管理员建出来，再逐个加人。
        </div>
      </el-alert>

      <el-alert type="info" :closable="false" show-icon class="role-legend">
        <template #title>三档角色是包含关系：管理员能做测试能做的一切</template>
        <div class="role-legend-body">
          <div v-for="r in roles" :key="r.code">
            <b>{{ r.label }}</b> —— {{ r.description }}
          </div>
        </div>
      </el-alert>

      <el-table :data="list" v-loading="loading" size="small" style="width: 100%">
        <el-table-column prop="username" label="登录名" width="160" />
        <el-table-column prop="displayName" label="显示名" width="160" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="roleTagType(row.role)">{{ row.roleLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" width="180">
          <template #default="{ row }">
            <span class="dim">{{ row.lastLoginAt || '从未登录' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="260">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="warning" link size="small" @click="openReset(row)">重置密码</el-button>
            <el-button
              :type="row.enabled ? 'info' : 'success'"
              link
              size="small"
              @click="toggleEnabled(row)"
            >
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-button v-perm:delete
              type="danger"
              link
              size="small"
              :disabled="row.id === currentUserId"
              @click="remove(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !list.length" description="还没有账号" />

      <!--
        停用而不是删除是默认做法：删了之后这个人做过的操作记录就成了孤儿，
        「谁跑的这批回归」查不到人，而人员离职恰恰是最需要能回溯的时候
      -->
      <div class="page-tip">
        人员离职建议用「停用」而不是「删除」——删掉之后他跑过的批次就查不到是谁跑的了。
      </div>
    </el-card>

    <el-dialog v-model="editVisible" :title="editing ? '编辑账号' : '新建账号'" width="460px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="登录名">
          <el-input v-model="form.username" :disabled="!!editing" placeholder="登录名" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="form.displayName" placeholder="报告上显示的名字（可留空）" />
        </el-form-item>
        <el-form-item v-if="!editing" label="初始密码">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="r in roles" :key="r.code" :label="r.label" :value="r.code">
              <span>{{ r.label }}</span>
              <span class="opt-desc">{{ r.description }}</span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <el-form label-width="90px">
        <el-form-item label="账号">
          <span>{{ resetTarget?.username }}</span>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="resetPassword" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doReset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiClient, type PlatformUserVo } from '../api'
import { user } from '../stores/auth'

const list = ref<PlatformUserVo[]>([])
const roles = ref<Array<{ code: string; label: string; description: string }>>([])
const loading = ref(false)
const saving = ref(false)

const editVisible = ref(false)
const editing = ref<PlatformUserVo | null>(null)
const form = reactive({ username: '', displayName: '', password: '', role: 'TESTER' })

const resetVisible = ref(false)
const resetTarget = ref<PlatformUserVo | null>(null)
const resetPassword = ref('')

const currentUserId = ref(user.value?.id || '')
const bootstrapping = computed(() => !!user.value?.bootstrapping)

function roleTagType(role: string) {
  if (role === 'ADMIN') return 'danger'
  if (role === 'TESTER') return 'warning'
  return 'info'
}

async function load() {
  loading.value = true
  try {
    const [users, roleList] = await Promise.all([
      apiClient.fetchPlatformUsers(),
      apiClient.fetchPlatformRoles()
    ])
    list.value = users
    roles.value = roleList
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.username = ''
  form.displayName = ''
  form.password = ''
  form.role = 'TESTER'
  editVisible.value = true
}

function openEdit(row: PlatformUserVo) {
  editing.value = row
  form.username = row.username
  form.displayName = row.displayName || ''
  form.password = ''
  form.role = row.role
  editVisible.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await apiClient.updatePlatformUser(editing.value.id, {
        displayName: form.displayName,
        role: form.role
      })
    } else {
      await apiClient.createPlatformUser({
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role
      })
    }
    editVisible.value = false
    ElMessage.success('已保存')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openReset(row: PlatformUserVo) {
  resetTarget.value = row
  resetPassword.value = ''
  resetVisible.value = true
}

async function doReset() {
  if (!resetTarget.value) return
  saving.value = true
  try {
    await apiClient.resetPlatformUserPassword(resetTarget.value.id, resetPassword.value)
    resetVisible.value = false
    ElMessage.success('密码已重置，请把新密码告诉本人')
  } catch (e: any) {
    ElMessage.error(e?.message || '重置失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: PlatformUserVo) {
  try {
    await apiClient.updatePlatformUser(row.id, { enabled: !row.enabled })
    ElMessage.success(row.enabled ? '已停用' : '已启用')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function remove(row: PlatformUserVo) {
  try {
    await ElMessageBox.confirm(
      `删除后，${row.username} 跑过的批次就查不到是谁跑的了。确定要删除而不是停用吗？`,
      '删除账号',
      { type: 'warning', confirmButtonText: '仍然删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await apiClient.deletePlatformUser(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.role-legend {
  margin-bottom: 14px;
}

.role-legend-body {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.8;
}

.opt-desc {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dim {
  color: var(--el-text-color-secondary);
}

.page-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
