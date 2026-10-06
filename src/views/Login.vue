<template>
  <div class="login-page">
    <header class="login-chrome">
      <div class="login-chrome-brand">
        <span class="brand-mark brand-mark--sm" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <rect x="3.2" y="4.2" width="17.6" height="11.2" rx="1.8" stroke="currentColor" stroke-width="1.8" />
            <path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </span>
        <span>APP自动化管理平台</span>
      </div>
    </header>

    <main class="login-main">
      <div class="login-panel">
        <div class="login-head">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <rect x="3.2" y="4.2" width="17.6" height="11.2" rx="1.8" stroke="currentColor" stroke-width="1.8" />
              <path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <div class="login-title">
              {{ bootstrapping ? '创建第一个管理员' : 'APP自动化管理平台' }}
            </div>
            <div v-if="bootstrapping" class="login-sub">
              平台还没有任何账号。创建管理员后权限立即生效。
            </div>
          </div>
        </div>

        <el-form class="login-form" :model="form" label-position="top" @submit.prevent="submit">
          <el-form-item label="登录名">
            <el-input
              v-model="form.username"
              placeholder="请输入登录名"
              autofocus
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-form-item v-if="bootstrapping" label="显示名">
            <el-input v-model="form.displayName" placeholder="报告和操作记录上显示的名字（可留空）" />
          </el-form-item>
          <el-form-item :label="bootstrapping ? '设置密码（至少 6 位）' : '密码'">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="请输入密码"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-form-item v-if="bootstrapping" label="再输一次">
            <el-input
              v-model="form.confirm"
              type="password"
              show-password
              placeholder="确认密码"
              @keyup.enter="submit"
            />
          </el-form-item>
        </el-form>

        <div v-if="!bootstrapping" class="login-meta">
          <el-checkbox v-model="rememberLogin" @change="onRememberChange">记住登录</el-checkbox>
          <button type="button" class="login-link" @click="onForgotPassword">忘记密码？</button>
        </div>

        <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

        <el-button
          type="primary"
          class="login-submit"
          :loading="submitting"
          @click="submit"
        >
          {{ bootstrapping ? '创建并登录' : '登录' }}
        </el-button>

        <button type="button" class="server-toggle" @click="showServer = !showServer">
          <span class="server-toggle-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <circle cx="12" cy="18" r="1.4" fill="currentColor" />
              <path d="M8.2 14.4a5.4 5.4 0 0 1 7.6 0M5.6 11.4a9 9 0 0 1 12.8 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </span>
          服务器设置
          <el-icon class="server-chevron" :class="{ open: showServer }"><ArrowDown /></el-icon>
        </button>

        <div v-if="showServer" class="login-backend">
          <div class="login-backend-label">控制面地址</div>
          <el-input v-model="apiBase" placeholder="http://192.168.x.x:3080/api" size="small">
            <template #append>
              <el-button :loading="applying" @click="applyBackend">应用</el-button>
            </template>
          </el-input>
          <div class="login-foot">登录失败多半是连错机器。本机调试可用 127.0.0.1；连别人电脑填那台的局域网 IP。</div>
        </div>
      </div>
    </main>

    <footer class="login-status">
      <span class="status-left">
        <span class="status-dot" :class="backendOk ? 'is-ok' : 'is-down'" />
        {{ serverLabel }}
      </span>
      <span class="status-ver">v{{ appVersion }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { apiClient } from '../api'
import { bootstrapAdmin, login } from '../stores/auth'

const REMEMBER_KEY = 'platform-remember-login'
const LEGACY_USERNAME_KEY = 'platform-login-username'
const APP_NAME = 'APP自动化管理平台'

const router = useRouter()
const route = useRoute()

const bootstrapping = ref(false)
const submitting = ref(false)
const applying = ref(false)
const showServer = ref(false)
const rememberLogin = ref(true)
const backendOk = ref(false)
const error = ref('')
const apiBase = ref(apiClient.getBaseUrl?.() || '')
const appVersion = ref('1.0.0')

const form = reactive({
  username: '',
  displayName: '',
  password: '',
  confirm: ''
})

const serverLabel = computed(() => {
  try {
    const host = new URL(apiBase.value).hostname
    if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
      return '本地服务器'
    }
    return host || '未配置'
  } catch {
    return '未配置'
  }
})

onMounted(async () => {
  document.title = APP_NAME
  restoreRememberedUser()
  await loadAppVersion()
  await refreshBackendStatus()
})

function restoreRememberedUser() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { username?: string; password?: string }
      form.username = parsed.username || ''
      form.password = parsed.password || ''
      rememberLogin.value = true
      return
    }
    const legacy = localStorage.getItem(LEGACY_USERNAME_KEY)
    if (legacy) {
      form.username = legacy
      rememberLogin.value = true
    }
  } catch {
    /* ignore */
  }
}

function persistRememberedUser() {
  try {
    if (rememberLogin.value && form.username.trim()) {
      localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({
          username: form.username.trim(),
          password: form.password
        })
      )
      localStorage.removeItem(LEGACY_USERNAME_KEY)
      return
    }
    localStorage.removeItem(REMEMBER_KEY)
    localStorage.removeItem(LEGACY_USERNAME_KEY)
  } catch {
    /* ignore */
  }
}

function onRememberChange(checked: boolean | string | number) {
  rememberLogin.value = !!checked
  persistRememberedUser()
}

watch(
  () => [form.username, form.password, rememberLogin.value] as const,
  () => {
    persistRememberedUser()
  }
)

async function loadAppVersion() {
  try {
    if (window.electronAPI?.getAppVersion) {
      const v = await window.electronAPI.getAppVersion()
      if (v) appVersion.value = String(v).replace(/^v/i, '')
    }
  } catch {
    /* 桌面端读不到版本时沿用 package 默认 */
  }
}

function onForgotPassword() {
  ElMessage.info('请联系管理员重置密码')
}

async function applyBackend() {
  const url = apiBase.value.trim()
  if (!url) {
    error.value = '请填写控制面地址'
    return
  }
  applying.value = true
  error.value = ''
  try {
    apiClient.setBaseUrl(url)
    apiBase.value = apiClient.getBaseUrl()
    if (window.electronAPI?.setControlPlane) {
      await window.electronAPI.setControlPlane(apiClient.getBaseUrl())
    }
    await refreshBackendStatus()
  } catch (e: any) {
    backendOk.value = false
    error.value = e?.message || '地址已保存，但连不上控制面'
  } finally {
    applying.value = false
  }
}

async function refreshBackendStatus() {
  try {
    const status = await apiClient.fetchBootstrapStatus()
    bootstrapping.value = status.bootstrapping
    backendOk.value = true
    error.value = ''
  } catch (e: any) {
    backendOk.value = false
    error.value = `连不上后端（${apiBase.value}）：${e?.message || '请检查服务是否启动'}`
  }
}

async function submit() {
  error.value = ''
  if (!form.username.trim() || !form.password) {
    error.value = '登录名和密码都要填'
    return
  }
  if (bootstrapping.value) {
    if (form.password.length < 6) {
      error.value = '密码至少 6 位'
      return
    }
    if (form.password !== form.confirm) {
      error.value = '两次输入的密码不一致'
      return
    }
  }
  submitting.value = true
  try {
    persistRememberedUser()
    if (bootstrapping.value) {
      await bootstrapAdmin(form.username.trim(), form.displayName.trim(), form.password)
    } else {
      await login(form.username.trim(), form.password)
    }
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
    router.replace(target)
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: var(--app-text);
}

.login-chrome {
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 16px 0 82px;
  font-size: 12px;
  color: var(--app-text-regular);
  -webkit-app-region: drag;
  app-region: drag;
}

.login-chrome-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.login-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px 8px;
}

.login-panel {
  width: 380px;
}

.login-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  background: var(--el-color-primary);
}

.brand-mark--sm {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.login-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.login-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.login-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.login-form :deep(.el-form-item__label) {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--app-text-regular);
}

.login-form :deep(.el-input__wrapper) {
  padding: 6px 12px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #d8dee8 inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.login-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 16px;
}

.login-link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
}

.login-link:hover {
  color: var(--el-color-primary-dark-2);
}

.login-submit {
  width: 100%;
  height: 40px;
  margin-top: 4px;
  font-size: 15px;
  border-radius: 6px;
}

.server-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 18px;
  border: 0;
  padding: 0;
  background: none;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  cursor: pointer;
}

.server-toggle:hover {
  color: var(--app-text-regular);
}

.server-toggle-icon {
  display: inline-flex;
}

.server-chevron {
  font-size: 12px;
  transition: transform 0.15s ease;
}

.server-chevron.open {
  transform: rotate(180deg);
}

.login-backend {
  margin-top: 12px;
}

.login-backend-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--app-text-regular);
}

.login-foot {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #9aa3b2;
}

.login-status {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.status-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
}

.status-dot.is-ok {
  background: var(--el-color-success);
}

.status-dot.is-down {
  background: var(--el-color-danger);
}

.login-chrome,
.login-status {
  user-select: none;
}

.login-main,
.login-form,
.login-meta,
.login-submit,
.server-toggle,
.login-backend,
.login-link {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
