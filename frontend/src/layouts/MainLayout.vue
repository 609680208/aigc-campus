<template>
  <div>
    <header>
      <div class="container header-inner">
        <div class="logo">
          <div class="logo-badge">智</div>
          <div>
            <div class="logo-name">智汇校园 · AI 创作平台</div>
            <div class="logo-sub">AIGC 内容创作工作台</div>
          </div>
        </div>
        <nav class="platform-tabs">
          <button
            class="platform-tab"
            :class="{ active: isPortal }"
            @click="$router.push('/')"
          >AIGC创作平台</button>
          <button
            v-if="auth.isAdmin"
            class="platform-tab"
            :class="{ active: $route.path.startsWith('/admin') }"
            @click="$router.push('/admin')"
          >后台管理</button>
          <button
            v-if="auth.isSuper"
            class="platform-tab"
            :class="{ active: $route.path.startsWith('/settings') }"
            @click="$router.push('/settings')"
          >系统设置</button>
        </nav>
        <div class="header-right">
          <template v-if="auth.user">
            <el-tooltip content="当前可用算力点数" placement="bottom">
              <span class="quota-chip">
                <el-icon><Lightning /></el-icon>
                {{ auth.user.quotaBalance }} 点
              </span>
            </el-tooltip>
            <el-dropdown trigger="click" @command="handleCommand">
              <button class="user-info" type="button">
                <span class="user-avatar">{{ auth.user.name[0] }}</span>
                <span class="user-meta">
                  <span class="user-name">{{ auth.user.name }}</span>
                  <span class="role-tag" :class="auth.roleBadgeClass">{{ auth.roleLabel }}</span>
                </span>
                <el-icon class="menu-caret"><ArrowDown /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    <el-icon><User /></el-icon>个人资料
                  </el-dropdown-item>
                  <!-- 仅本地管理员账号（非 SSO）可退出，退出后回隐藏登录页 /login -->
                  <el-dropdown-item v-if="!auth.isSsoUser" command="logout" divided>
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </div>
      </div>
    </header>

    <div class="notice">
      <div class="container">
        <el-icon><Bell /></el-icon>
        <span>平台已接入「本地 + 云端」混合算力，支持文生图、图生图、文生视频、图生视频四大核心功能，以及创作画布、AI对话助手等智能工具。</span>
      </div>
    </div>

    <router-view />

    <!-- 个人资料弹窗 -->
    <el-dialog
      v-model="profileVisible"
      title="个人资料"
      width="480px"
      align-center
    >
      <el-form label-width="88px">
        <el-form-item label="账号">
          <el-input :model-value="auth.user?.username" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <el-input :model-value="auth.roleLabel" disabled />
        </el-form-item>
        <el-form-item label="班级">
          <el-input :model-value="auth.user?.class?.name || '—'" disabled />
        </el-form-item>
        <el-form-item label="算力余额">
          <el-input :model-value="`${auth.user?.quotaBalance ?? 0} 点`" disabled />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="profileName" maxlength="20" placeholder="请输入姓名" />
        </el-form-item>
      </el-form>
      <div class="dialog-msg" :class="{ ok: profileMsgOk }">{{ profileMsg }}</div>
      <template #footer>
        <el-button @click="profileVisible = false">关闭</el-button>
        <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { updateProfileApi } from '../api';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const isPortal = computed(
  () => !route.path.startsWith('/admin') && !route.path.startsWith('/settings'),
);

function handleCommand(cmd: string | number) {
  if (cmd === 'profile') openProfile();
  else if (cmd === 'logout') doLogout();
}

function doLogout() {
  auth.logout();
  router.push('/login');
}

/* ---------- 个人资料 ---------- */
const profileVisible = ref(false);
const profileName = ref('');
const profileMsg = ref('');
const profileMsgOk = ref(false);
const profileSaving = ref(false);

function openProfile() {
  profileName.value = auth.user?.name || '';
  profileMsg.value = '';
  profileVisible.value = true;
}

async function saveProfile() {
  const name = profileName.value.trim();
  if (!name) {
    profileMsgOk.value = false;
    profileMsg.value = '姓名不能为空';
    return;
  }
  if (name === auth.user?.name) {
    profileMsgOk.value = false;
    profileMsg.value = '姓名未变更';
    return;
  }
  profileSaving.value = true;
  profileMsg.value = '';
  try {
    await updateProfileApi({ name });
    await auth.fetchMe().catch(() => {});
    profileMsgOk.value = true;
    profileMsg.value = '保存成功';
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    profileMsgOk.value = false;
    profileMsg.value = typeof msg === 'string' ? msg : '保存失败，请稍后重试';
  } finally {
    profileSaving.value = false;
  }
}
</script>

<style scoped>
.dialog-msg {
  min-height: 20px;
  font-size: 13px;
  color: #dc2626;
  margin-top: 4px;
}
.dialog-msg.ok {
  color: #16a34a;
}
</style>