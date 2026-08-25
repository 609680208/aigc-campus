<template>
  <div class="sso-page">
    <div class="sso-card">
      <div class="logo-badge">智</div>
      <div class="sso-title">智汇校园 · AI 创作平台</div>

      <!-- 自动登录中 -->
      <template v-if="!errorMsg">
        <el-icon class="sso-loading is-loading"><Loading /></el-icon>
        <div class="sso-text">正在从 OPC 门户自动登录，请稍候…</div>
      </template>

      <!-- 登录失败 / 参数缺失 -->
      <template v-else>
        <el-icon class="sso-error-icon"><CircleCloseFilled /></el-icon>
        <div class="sso-text error">{{ errorMsg }}</div>
        <div class="sso-hint">请返回 OPC 门户，从平台入口重新进入本系统</div>
        <div class="sso-admin-entry">
          <span class="sso-admin-tip">管理员？</span>
          <el-link type="primary" :underline="false" @click="$router.push('/login')">
            前往管理员登录
          </el-link>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { CircleCloseFilled, Loading } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const errorMsg = ref('');

onMounted(async () => {
  const q = route.query as Record<string, string | undefined>;
  const token = q.token || '';
  if (!token) {
    errorMsg.value = '缺少登录凭证，无法自动登录';
    return;
  }
  try {
    await auth.ssoLogin({
      token,
      apikey: q.apikey,
      opcUserId: q.opcUserId,
      teamId: q.teamId,
      teamTaskId: q.teamTaskId,
    });
    router.replace('/');
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    errorMsg.value =
      typeof msg === 'string' ? msg : '自动登录失败，请重新从 OPC 门户进入';
  }
});
</script>

<style scoped>
.sso-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #f0f4ff 0%, #fafbff 45%, #eef4ff 100%);
}
.sso-card {
  width: 420px;
  padding: 48px 40px;
  background: #fff;
  border: 1px solid #e5e9f2;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(43, 90, 253, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
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
.sso-title {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.sso-loading {
  margin-top: 28px;
  font-size: 30px;
  color: #2b5aed;
}
.sso-error-icon {
  margin-top: 28px;
  font-size: 30px;
  color: #dc2626;
}
.sso-text {
  margin-top: 12px;
  font-size: 14px;
  color: #374151;
}
.sso-text.error {
  color: #dc2626;
}
.sso-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.sso-admin-entry {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #e5e9f2;
  width: 100%;
  font-size: 13px;
}
.sso-admin-tip {
  color: #64748b;
  margin-right: 6px;
}
</style>
