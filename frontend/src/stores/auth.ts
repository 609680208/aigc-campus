import { defineStore } from 'pinia';
import { loginApi, meApi, ssoLoginApi } from '../api';
import type { User } from '../types';

interface AuthState {
  token: string;
  user: User | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('token') || '',
    user: null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    /** 是否为 OPC SSO 账号（本地管理员账号为 false，可手动退出） */
    isSsoUser: (s) => !!s.user?.opcUserId,
    role: (s) => s.user?.role || null,
    isAdmin: (s) => s.user?.role === 'ADMIN' || s.user?.role === 'SUPER_ADMIN',
    isSuper: (s) => s.user?.role === 'SUPER_ADMIN',
    // 后台角色：admin（管理员）/ super（超级管理员）
    backendRole: (s): string => {
      if (s.user?.role === 'SUPER_ADMIN') return 'super';
      return 'admin';
    },
    // 头像旁角色标签样式（原型 badge 映射）
    roleBadgeClass: (s): string => {
      if (s.user?.role === 'SUPER_ADMIN') return 'rt-leader';
      if (s.user?.role === 'ADMIN') return 'rt-school';
      return 'rt-teacher';
    },
    roleLabel: (s): string => {
      const u = s.user;
      if (!u) return '';
      if (u.role === 'SUPER_ADMIN') return '超级管理员';
      if (u.role === 'ADMIN') return '管理员';
      return '用户';
    },
  },
  actions: {
    setToken(token: string) {
      this.token = token;
      localStorage.setItem('token', token);
    },
    /** 管理员账号密码登录（隐藏入口，仅超管使用） */
    async login(username: string, password: string) {
      const res = await loginApi(username, password);
      this.setToken(res.accessToken);
      this.user = res.user;
    },
    /** SSO 中间页自动登录：凭 OPC 带入的永久 token 换取会话 JWT */
    async ssoLogin(payload: {
      token: string;
      apikey?: string;
      opcUserId?: string;
      teamId?: string;
      teamTaskId?: string;
    }) {
      const res = await ssoLoginApi(payload);
      this.setToken(res.accessToken);
      this.user = res.user;
    },
    async fetchMe() {
      this.user = await meApi();
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
    },
  },
});
