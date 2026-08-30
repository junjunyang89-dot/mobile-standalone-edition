<template>
  <div class="login-page">
    <el-card class="login-card" shadow="never">
      <div class="login-head">
        <div class="login-title">{{ bootstrapping ? '创建第一个管理员' : '登录测试平台' }}</div>
        <div class="login-sub">
          {{
            bootstrapping
              ? '平台还没有任何账号，权限校验暂未生效。创建管理员后立即开始生效。'
              : '请使用管理员分配的账号登录'
          }}
        </div>
      </div>

      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="登录名">
          <el-input
            v-model="form.username"
            placeholder="登录名"
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
            placeholder="密码"
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

      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

      <el-button
        type="primary"
        class="login-submit"
        :loading="submitting"
        @click="submit"
      >
        {{ bootstrapping ? '创建并登录' : '登录' }}
      </el-button>

      <div class="login-backend">
        <div class="login-backend-label">控制面地址</div>
        <el-input v-model="apiBase" placeholder="http://192.168.x.x:3000/api" size="small">
          <template #append>
            <el-button :loading="applying" @click="applyBackend">应用</el-button>
          </template>
        </el-input>
        <div class="login-foot">登录失败多半是连错机器。填跑后端那台电脑的局域网 IP，不要填 127.0.0.1。</div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiClient } from '../api'
import { bootstrapAdmin, login } from '../stores/auth'

const router = useRouter()
const route = useRoute()

const bootstrapping = ref(false)
const submitting = ref(false)
const applying = ref(false)
const error = ref('')
const apiBase = ref(apiClient.getBaseUrl?.() || '')

const form = reactive({
  username: '',
  displayName: '',
  password: '',
  confirm: ''
})

onMounted(async () => {
  await refreshBackendStatus()
})

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
    error.value = e?.message || '地址已保存，但连不上控制面'
  } finally {
    applying.value = false
  }
}

async function refreshBackendStatus() {
  try {
    const status = await apiClient.fetchBootstrapStatus()
    bootstrapping.value = status.bootstrapping
    error.value = ''
  } catch (e: any) {
    // 连不上后端时不要显示成「请登录」——那会让人一直试密码，
    // 而真正的问题是后端地址不对或服务没起来
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
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-page);
}

.login-card {
  width: 420px;
  padding: 8px 4px;
}

.login-head {
  margin-bottom: 18px;
}

.login-title {
  font-size: 18px;
  font-weight: 600;
}

.login-sub {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.login-submit {
  width: 100%;
  margin-top: 14px;
}

.login-backend {
  margin-top: 18px;
}
.login-backend-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.login-foot {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-placeholder);
}
</style>
