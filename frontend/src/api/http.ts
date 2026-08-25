import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 600000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      // 登录统一走 OPC 门户：会话失效后回 SSO 中间页（无参数时展示引导提示）
      if (location.pathname !== '/sso/login') {
        location.href = '/sso/login';
      }
    }
    return Promise.reject(error);
  },
);

export default http;