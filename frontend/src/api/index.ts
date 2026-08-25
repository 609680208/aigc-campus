import http from './http';

// 认证（仅保留 SSO 与个人接口，登录统一走 OPC 门户）
export const loginApi = (username: string, password: string) =>
  http.post('/auth/login', { username, password }).then((r) => r.data);

export const meApi = () => http.get('/auth/me').then((r) => r.data);

/** SSO 中间页自动登录：凭 OPC 带入的永久 token 换取会话 JWT */
export const ssoLoginApi = (data: {
  token: string;
  apikey?: string;
  opcUserId?: string;
  teamId?: string;
  teamTaskId?: string;
}) => http.post('/auth/sso/login', data).then((r) => r.data);

/** 修改个人资料（姓名） */
export const updateProfileApi = (data: { name: string }) =>
  http.patch('/auth/profile', data).then((r) => r.data);

/** 修改登录密码 */
export const changePasswordApi = (data: {
  oldPassword: string;
  newPassword: string;
}) => http.patch('/auth/profile/password', data).then((r) => r.data);

// 用户
export const listUsersApi = (params: any) =>
  http.get('/users', { params }).then((r) => r.data);

export const listClassesApi = () => http.get('/users/classes').then((r) => r.data);

export const createUserApi = (data: any) =>
  http.post('/users', data).then((r) => r.data);

export const importUsersApi = (users: any[]) =>
  http.post('/users/import', { users }).then((r) => r.data);

export const updateUserApi = (id: string, data: any) =>
  http.patch(`/users/${id}`, data).then((r) => r.data);

export const setQuotaApi = (id: string, amount: number, reason?: string) =>
  http.patch(`/users/${id}/quota`, { amount, reason }).then((r) => r.data);

// 模型
export const listModelsApi = () => http.get('/models').then((r) => r.data);
export const listAllModelsApi = () => http.get('/models/all').then((r) => r.data);
export const createModelApi = (data: any) => http.post('/models', data).then((r) => r.data);
export const updateModelApi = (id: string, data: any) =>
  http.patch(`/models/${id}`, data).then((r) => r.data);
export const deleteModelApi = (id: string) => http.delete(`/models/${id}`).then((r) => r.data);

// 作品 / 创作
export const createWorkApi = (data: any) => http.post('/works', data).then((r) => r.data);
export const listWorksApi = (params: any) => http.get('/works', { params }).then((r) => r.data);
/** 门户首页统计（总创作次数 + 各功能使用次数） */
export const workStatsApi = () => http.get('/works/stats').then((r) => r.data);

// 后台管理
export const adminStatsApi = () => http.get('/admin/stats').then((r) => r.data);
export const auditListApi = () => http.get('/admin/audit').then((r) => r.data);
export const approvalListApi = () => http.get('/admin/approvals').then((r) => r.data);
/** 本人提交的配额申请 */
export const myApprovalsApi = () => http.get('/admin/my-approvals').then((r) => r.data);
/** 全平台用量统计（本地/云端、按功能分布） */
export const adminUsageApi = () => http.get('/admin/usage').then((r) => r.data);
/** 用户使用统计（创作次数/累计消耗/最近活跃） */
export const adminUserStatsApi = (role?: string) =>
  http.get('/admin/user-stats', { params: role ? { role } : {} }).then((r) => r.data);
export const createApprovalApi = (data: any) =>
  http.post('/admin/approvals', data).then((r) => r.data);
export const decideApprovalApi = (id: string, status: string) =>
  http.patch(`/admin/approvals/${id}`, { status }).then((r) => r.data);
export const adminClassesApi = () => http.get('/admin/classes').then((r) => r.data);
export const createClassApi = (data: any) => http.post('/admin/classes', data).then((r) => r.data);
export const quotaUsersApi = () => http.get('/admin/quota-users').then((r) => r.data);