<template>
  <div class="page">
    <div class="users-card">
      <div class="card-head">
        <span class="card-title">账号与权限</span>
        <el-button type="primary" class="create-btn" @click="openCreate">新建账号</el-button>
      </div>

      <!--
        建第一个账号的那一瞬间鉴权就生效了，而当前这个会话是没有令牌的，
        下一个请求就会被踢到登录页。不提前说的话，用户会以为是自己把平台点坏了
      -->
      <el-alert
        v-if="bootstrapping"
        type="warning"
        :closable="false"
        show-icon
        class="boot-alert"
        title="平台目前还没有账号，权限校验未生效——所有人都能进所有页面"
      >
        <div class="boot-alert-body">
          建好第一个<b>管理员</b>账号后，权限立即开始生效。你当前这个会话还没有登录，
          会被要求用刚建的账号重新登录一次。建议先把管理员建出来，再逐个加人。
        </div>
      </el-alert>

      <el-table :data="list" v-loading="loading" class="users-table" style="width: 100%">
        <el-table-column label="登录名" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.username }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="displayName" label="显示名" min-width="160" />
        <el-table-column width="120">
          <template #header>
            <span class="th-with-tip">
              角色
              <el-tooltip placement="top" :show-after="150">
                <template #content>
                  <div class="role-tip">
                    <div class="role-tip-title">三档角色是包含关系：管理员能做测试能做的一切</div>
                    <div v-for="r in roles" :key="r.code"><b>{{ r.label }}</b> —— {{ r.description }}</div>
                  </div>
                </template>
                <span class="th-tip">?</span>
              </el-tooltip>
            </span>
          </template>
          <template #default="{ row }">
            <span class="pill" :class="'pill-' + roleTone(row.role)">{{ row.roleLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="pill" :class="row.enabled ? 'pill-success' : 'pill-muted'">
              {{ row.enabled ? '启用' : '已停用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" width="150">
          <template #default="{ row }">
            <span v-if="row.lastLoginAt" class="mono login-at" :title="row.lastLoginAt">
              {{ loginParts(row.lastLoginAt).date }}
              <span class="login-time">{{ loginParts(row.lastLoginAt).time }}</span>
            </span>
            <span v-else class="never">从未登录</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="240">
          <template #default="{ row }">
            <div class="ops">
              <button type="button" class="op op-primary" @click="openEdit(row)">编辑</button>
              <button type="button" class="op op-warning" @click="openReset(row)">重置密码</button>
              <button type="button" class="op" :class="row.enabled ? 'op-plain' : 'op-success'" @click="toggleEnabled(row)">
                {{ row.enabled ? '停用' : '启用' }}
              </button>
              <button
                v-perm:delete
                type="button"
                class="op op-danger"
                :class="{ 'is-self': row.id === currentUserId }"
                :disabled="row.id === currentUserId"
                :title="row.id === currentUserId ? '不能删除自己' : ''"
                @click="remove(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <span class="never">还没有账号</span>
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="editVisible"
      :title="editing ? '编辑账号' : '新建账号'"
      width="680px"
      class="pu-dialog"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="88px" size="large" class="account-form" @submit.prevent="save">
        <el-form-item>
          <template #label>
            <span class="lbl">登录名<i v-if="!editing" class="req">*</i></span>
          </template>
          <el-input v-model="form.username" :disabled="!!editing" placeholder="登录名" autocomplete="off" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="lbl">显示名<em class="opt">选填</em></span>
          </template>
          <el-input v-model="form.displayName" placeholder="报告上显示的名字" />
        </el-form-item>
        <el-form-item v-if="!editing">
          <template #label>
            <span class="lbl">初始密码<i class="req">*</i></span>
          </template>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="至少 6 位"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item class="role-item">
          <template #label>
            <span class="lbl">角色<i class="req">*</i></span>
          </template>
          <div class="role-field">
            <el-radio-group v-model="form.role" class="role-seg">
              <el-radio-button v-for="r in roles" :key="r.code" :value="r.code">{{ r.label }}</el-radio-button>
            </el-radio-group>
            <div v-if="roleDesc" class="role-desc">{{ roleDesc }}</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dlg-foot">
          <span class="foot-hint">带 * 的必填</span>
          <div class="foot-btns">
            <el-button class="foot-btn" @click="editVisible = false">取消</el-button>
            <el-button type="primary" class="foot-btn" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置密码" width="420px" class="pu-dialog">
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
const roleDesc = computed(() => roles.value.find((r) => r.code === form.role)?.description || '')

const resetVisible = ref(false)
const resetTarget = ref<PlatformUserVo | null>(null)
const resetPassword = ref('')

const currentUserId = ref(user.value?.id || '')
const bootstrapping = computed(() => !!user.value?.bootstrapping)

function roleTone(role: string) {
  if (role === 'ADMIN') return 'danger'
  if (role === 'TESTER') return 'warning'
  return 'muted'
}

/** 列表里只看「哪天几点」；不是今年的才带年份，完整时间放 title */
function loginParts(v: string) {
  const d = new Date(String(v).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return { date: v, time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return {
    date: d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}-${md}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
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
  if (saving.value) return
  if (!editing.value) {
    if (!form.username.trim()) return ElMessage.warning('请填写登录名')
    if (form.password.length < 6) return ElMessage.warning('初始密码至少 6 位')
  }
  saving.value = true
  try {
    if (editing.value) {
      await apiClient.updatePlatformUser(editing.value.id, {
        displayName: form.displayName,
        role: form.role
      })
    } else {
      await apiClient.createPlatformUser({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
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
  if (row.id === currentUserId.value) return
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

.users-card {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.create-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
}

.boot-alert {
  width: auto;
  margin: 0 20px 14px;
}

.boot-alert-body {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.8;
}

.users-table {
  --el-table-header-bg-color: #fafbfc;
  --el-table-border-color: #f0f1f3;
  --el-table-row-hover-bg-color: #f7f8fa;
  border-top: 1px solid #f0f1f3;
}

.users-table :deep(th.el-table__cell) {
  height: 40px;
  font-size: 12px;
  font-weight: 500;
  color: #86909c;
}

.users-table :deep(td.el-table__cell) {
  height: 52px;
  font-size: 13px;
  color: #1f2329;
}

.users-table :deep(.el-table__cell:first-child .cell) {
  padding-left: 20px;
}

.users-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.mono {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
}

.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.th-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #f2f3f5;
  font-size: 10px;
  color: #86909c;
  cursor: help;
}

.role-tip {
  max-width: 320px;
  font-size: 12px;
  line-height: 1.8;
}

.role-tip-title {
  margin-bottom: 4px;
  font-weight: 600;
}

.pill {
  display: inline-block;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
}

.pill-danger {
  border-color: #fbc4c4;
  background: #fef0f0;
  color: #e5484d;
}

.pill-warning {
  border-color: #f8d9a6;
  background: #fdf6ec;
  color: #d97706;
}

.pill-success {
  border-color: #b7e4b9;
  background: #f0f9f0;
  color: #2f9e44;
}

.pill-muted {
  border-color: #e5e6eb;
  background: #f7f8fa;
  color: #86909c;
}

.login-at {
  color: #1f2329;
}

.login-time {
  margin-left: 2px;
  color: #86909c;
}

.never {
  font-size: 12.5px;
  color: #a0a6ae;
}

.ops {
  display: flex;
  align-items: center;
  gap: 16px;
}

.op {
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  cursor: pointer;
}

.op:disabled,
.op.is-disabled,
.op.is-self {
  opacity: 0.4;
  cursor: not-allowed;
}

.op:not(:disabled):not(.is-self):hover {
  opacity: 0.75;
}

.op-primary {
  color: var(--el-color-primary);
}

.op-warning {
  color: #d97706;
}

.op-plain {
  color: #1f2329;
}

.op-success {
  color: #2f9e44;
}

.op-danger {
  color: #e5484d;
}

.account-form {
  padding: 4px 8px 0 0;
}

.account-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.account-form :deep(.el-form-item__label) {
  padding-right: 16px;
  font-size: 13px;
  color: #4e5969;
}

.lbl {
  display: inline-flex;
  align-items: center;
}

.req {
  margin-left: 3px;
  font-style: normal;
  color: #e5484d;
}

.opt {
  margin-left: 6px;
  font-size: 11px;
  font-style: normal;
  color: #a0a6ae;
}

.account-form :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.role-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-seg :deep(.el-radio-button__inner) {
  min-width: 66px;
  font-weight: 500;
}

.role-seg :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 8px 0 0 8px;
}

.role-seg :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 8px 8px 0;
}

.role-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #86909c;
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.foot-hint {
  font-size: 12px;
  color: #a0a6ae;
}

.foot-btn {
  height: 36px;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 500;
}
</style>

<style>
/* 弹窗挂在 body 下，外壳样式只能写成全局的 */
.el-dialog.pu-dialog {
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
}

.pu-dialog .el-dialog__header {
  padding: 18px 24px;
  margin: 0;
  border-bottom: 1px solid #f0f1f3;
}

.pu-dialog .el-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.pu-dialog .el-dialog__headerbtn {
  top: 6px;
  right: 8px;
}

.pu-dialog .el-dialog__body {
  padding: 24px 24px 4px;
}

.pu-dialog .el-dialog__footer {
  padding: 14px 24px;
  border-top: 1px solid #f0f1f3;
  background: #fafbfc;
}
</style>
