export type Role = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';
export type AdminSubRole = 'TEACHER' | 'LEADER' | null;
export type ModelType = 'TEXT' | 'TXT2IMG' | 'IMG2IMG' | 'TXT2VIDEO' | 'IMG2VIDEO';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  adminSubRole: AdminSubRole;
  classId?: string | null;
  class?: { id: string; name: string } | null;
  quotaBalance: number;
  /** OPC 平台用户 ID，有值即为 SSO 账号 */
  opcUserId?: string | null;
  createdAt?: string;
}

export interface ModelItem {
  id: string;
  name: string;
  type: ModelType;
  loc: 'CLOUD' | 'LOCAL';
  cost: number;
  enabled: boolean;
  provider: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  externalId?: string | null;
}

export interface Work {
  id: string;
  type: string;
  prompt: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  resultText?: string | null;
  resultUrl?: string | null;
  cost: number;
  error?: string | null;
  model?: ModelItem | null;
  createdAt: string;
}

export interface ClassItem {
  id: string;
  name: string;
  grade?: string | null;
  _count?: { students: number };
}

export type WorkType = 'TEXT' | 'TXT2IMG' | 'IMG2IMG' | 'TXT2VIDEO' | 'IMG2VIDEO' | 'CANVAS';

export const MODEL_TYPE_LABEL: Record<ModelType, string> = {
  TEXT: '文本模型',
  TXT2IMG: '文生图模型',
  IMG2IMG: '图生图模型',
  TXT2VIDEO: '文生视频模型',
  IMG2VIDEO: '图生视频模型',
};

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: '学生·普通',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员',
};