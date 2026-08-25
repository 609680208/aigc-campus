import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sso/login', name: 'sso-login', component: () => import('../views/SsoLogin.vue') },
    // 兼容大写拼写的 SSO 链接（如 /SSO/login）
    { path: '/SSO/login', redirect: (to) => ({ path: '/sso/login', query: to.query }) },
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      children: [
        { path: '', name: 'portal', component: () => import('../views/portal/Portal.vue') },
        { path: 'tool/canvas', name: 'canvas', component: () => import('../views/workbench/CanvasTool.vue') },
        { path: 'tool/chat', name: 'chat', component: () => import('../views/workbench/ChatTool.vue') },
        { path: 'tool/:id(\\d+)', name: 'tool', component: () => import('../views/workbench/ToolDetail.vue') },
        { path: 'admin', name: 'admin', component: () => import('../views/admin/Admin.vue'), meta: { roles: ['ADMIN', 'SUPER_ADMIN'] } },
        { path: 'settings', name: 'settings', component: () => import('../views/settings/Settings.vue'), meta: { roles: ['SUPER_ADMIN'] } },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  // SSO 中间页与管理员登录页（隐藏入口，仅超管手动访问）免登录校验
  if (to.path === '/sso/login' || to.path === '/login') return true;
  if (!auth.isLoggedIn) return { path: '/sso/login' };
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return { path: '/sso/login' };
    }
  }
  const roles = (to.meta.roles as string[] | undefined) || [];
  if (roles.length && !roles.includes(auth.role || '')) {
    return { path: '/' };
  }
  return true;
});

export default router;
