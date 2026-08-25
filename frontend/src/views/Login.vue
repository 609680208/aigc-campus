<template>
  <div class="admin-login-page">
    <div class="admin-login-card">
      <div class="logo-badge">智</div>
      <div class="login-title">智汇校园 · AI 创作平台</div>
      <div class="login-sub">管理员登录入口（普通用户请从 OPC 门户进入）</div>

      <el-form class="login-form" @submit.prevent>
        <el-form-item>
          <el-input
            v-model="form.username"
            size="large"
            placeholder="管理员账号"
            :prefix-icon="User"
            @keyup.enter="doLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            show-password
            placeholder="密码"
            :prefix-icon="Lock"
            @keyup.enter="doLogin"
          />
        </el-form-item>
        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="doLogin"
        >登录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { Lock, User } from '@element-plus/icons-vue';

const router = useRouter();
const auth = useAuthStore();

const form = reactive({ username: '', password: '' });
const loading = ref(false);
const errorMsg = ref('');

async function doLogin() {
  if (!form.username || !form.password) {
    errorMsg.value = '请输入账号和密码';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  try {
    await auth.login(form.username, form.password);
    router.replace('/');
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    errorMsg.value = typeof msg === 'string' ? msg : '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #f0f4ff 0%, #fafbff 45%, #eef4ff 100%);
}
.admin-login-card {
  width: 420px;
  padding: 48px 40px;
  background: #fff;
  border: 1px solid #e5e9f2;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(43, 90, 253, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logo-badge {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2b5aed, #4f7bff);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-title {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.login-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}
.login-form {
  width: 100%;
  margin-top: 28px;
}
.login-error {
  font-size: 13px;
  color: #dc2626;
  margin-bottom: 8px;
}
.login-btn {
  width: 100%;
}
</style>
