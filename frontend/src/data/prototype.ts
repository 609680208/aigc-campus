/* 前端静态配置与工具函数
   说明：仅保留「功能目录、角色导航」等产品配置；
   所有业务数据（用户/作品/统计/日志）均来自后端数据库。 */

export const IMG_API = (p: string) =>
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent(p) + '&image_size=landscape_16_9';

export function fmt(n: number): string {
  return n >= 10000 ? (n / 10000).toFixed(1) + 'w' : String(n);
}

export const CATS = [
  { id: 'all', name: '全部', icon: '' },
  { id: 'image', name: '🖼️ 生图', icon: '' },
  { id: 'video', name: '🎬 生视频', icon: '' },
  { id: 'canvas', name: '🧩 智能创作', icon: '' },
  { id: 'chat', name: '💬 AI对话', icon: '' },
];

export const MODEL_TYPES = [
  { key: 'text', type: 'TEXT', label: '文本模型', icon: '💬', desc: '用于 AI对话助手' },
  { key: 'txt2img', type: 'TXT2IMG', label: '文生图模型', icon: '🖼️', desc: '用于 文生图' },
  { key: 'img2img', type: 'IMG2IMG', label: '图生图模型', icon: '🎨', desc: '用于 图生图' },
  { key: 'txt2video', type: 'TXT2VIDEO', label: '文生视频模型', icon: '🎬', desc: '用于 文生视频' },
  { key: 'img2video', type: 'IMG2VIDEO', label: '图生视频模型', icon: '📹', desc: '用于 图生视频' },
  { key: 'audio', type: 'AUDIO', label: '配音模型', icon: '🎙️', desc: '用于 创作画布配音节点' },
];

export interface ToolInput {
  type: 'textarea' | 'select' | 'upload' | 'text';
  label: string;
  req?: boolean;
  rows?: number;
  ph?: string;
  hint?: string;
  options?: string[];
  /** 提交创作时的参数键名（如 aspectRatio / resolution / duration），无键名的仅拼入提示词 */
  key?: 'aspectRatio' | 'resolution' | 'duration';
}

/** 画面比例选项（与 huobao-drama 能力配置一致） */
export const ASPECT_RATIO_OPTIONS = ['自适应', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
/** 视频分辨率选项（与 huobao-drama 能力配置一致） */
export const RESOLUTION_OPTIONS = ['480p', '720p', '1080p'];

export interface ToolCase {
  t: string;
  p: string;
  cover: string;
  /** 案例视频（有值时缩略图用 video 播放，cover 作为首帧海报） */
  video?: string;
}

export interface Tool {
  id: number;
  cat: string;
  catName: string;
  icon: string;
  name: string;
  slogan: string;
  tags: string[];
  featured: boolean;
  status: string;
  out: 'image' | 'video' | 'canvas' | 'chat';
  modelKey: string | null;
  sched: 'cloud' | 'hybrid' | 'local';
  cost: string;
  inputs: ToolInput[];
  cases: ToolCase[];
}

/** 工具对应的数据库作品类型（用于真实使用统计） */
export function toolWorkType(t: Tool): string {
  if (t.out === 'canvas') return 'CANVAS';
  return (t.modelKey || 'text').toUpperCase();
}

export const TOOLS: Tool[] = [
  /* ---------- 生图 ---------- */
  {
    id: 1, cat: 'image', catName: '生图', icon: '🖼️', name: '文生图',
    slogan: '输入文字描述，一键生成高质量图片',
    tags: ['文生图', 'AI绘画', '图像生成'], featured: true, status: 'online',
    out: 'image', modelKey: 'txt2img', sched: 'hybrid', cost: '1-4 积分',
    inputs: [
      { type: 'textarea', label: '图片描述', req: true, rows: 5, ph: '示例：大学校园春天的樱花大道，学生们在树下漫步，阳光透过花瓣洒下，清新明亮的日系风格。' },
      { type: 'select', label: '画面风格', options: ['真实写实', '日系清新', '油画风格', '动漫风', '水墨画', '赛博朋克'] },
      { type: 'select', label: '画面比例', options: ASPECT_RATIO_OPTIONS, key: 'aspectRatio' },
    ],
    cases: [
      { t: '校园春景 · 樱花大道', p: '大学校园春天的樱花大道，学生们在树下漫步，阳光透过花瓣洒下，清新明亮的日系风格', cover: '/cases/sakura.jpeg' },
      { t: '未来图书馆 · 赛博朋克', p: '科技感十足的未来图书馆，全息投影书架，学生戴着AR眼镜阅读，霓虹灯光，赛博朋克风格', cover: '/cases/library.jpeg' },
    ],
  },
  {
    id: 2, cat: 'image', catName: '生图', icon: '🎨', name: '图生图',
    slogan: '上传参考图，基于图片生成新的创意图片',
    tags: ['图生图', '图片编辑', '风格迁移'], featured: false, status: 'online',
    out: 'image', modelKey: 'img2img', sched: 'cloud', cost: '3-4 积分',
    inputs: [
      { type: 'upload', label: '上传参考图片', hint: '支持 JPG / PNG，建议清晰的主体图片' },
      { type: 'textarea', label: '修改/创意描述', req: true, rows: 4, ph: '示例：保持人物姿态不变，将背景换成海边日落，整体色调调整为暖金色。' },
      { type: 'select', label: '画面比例', options: ASPECT_RATIO_OPTIONS, key: 'aspectRatio' },
    ],
    cases: [
      { t: '人像换景 · 海边日落', p: '保持人物姿态不变，将背景换成海边日落，整体色调调整为暖金色', cover: 'portrait photo with beautiful sunset beach background, warm golden hour lighting, cinematic color grading' },
      { t: '风格迁移 · 油画肖像', p: '将照片转换为古典油画风格，笔触明显，色彩浓郁，伦勃朗光影', cover: 'classical oil painting portrait, visible brushstrokes, rich colors, rembrandt lighting, fine art style' },
    ],
  },
  /* ---------- 生视频 ---------- */
  {
    id: 3, cat: 'video', catName: '生视频', icon: '🎬', name: '文生视频',
    slogan: '输入文字描述，生成高质量动态视频',
    tags: ['文生视频', 'AI视频', '视频生成'], featured: true, status: 'online',
    out: 'video', modelKey: 'txt2video', sched: 'cloud', cost: '4-10 积分',
    inputs: [
      { type: 'textarea', label: '视频描述', req: true, rows: 5, ph: '示例：清晨的大学校园，阳光慢慢照进教室，粉笔在黑板上写下"AIGC"三个字，镜头缓慢推近，光影流动。' },
      { type: 'select', label: '画面风格', options: ['真实写实', '电影感', '动漫风', '3D动画'] },
      { type: 'select', label: '画面比例', options: ASPECT_RATIO_OPTIONS, key: 'aspectRatio' },
      { type: 'select', label: '分辨率', options: RESOLUTION_OPTIONS, key: 'resolution' },
      { type: 'select', label: '视频时长', options: ['5 秒', '10 秒'], key: 'duration' },
    ],
    cases: [
      { t: '校园晨光 · 教室', p: '清晨的大学校园，阳光慢慢照进教室，粉笔在黑板上写下"AIGC"三个字，镜头缓慢推近，光影流动', cover: '', video: '/cases/classroom.mp4' },
      { t: '实验室 · 科技感', p: '现代化AI实验室里，全息屏幕显示神经网络动画，科研人员在操作台前工作，镜头环绕运动', cover: '', video: '/cases/lab.mp4' },
    ],
  },
  {
    id: 4, cat: 'video', catName: '生视频', icon: '📹', name: '图生视频',
    slogan: '上传图片，让静态图片动起来生成视频',
    tags: ['图生视频', '图片动画', '动态视频'], featured: false, status: 'online',
    out: 'video', modelKey: 'img2video', sched: 'cloud', cost: '8-10 积分',
    inputs: [
      { type: 'upload', label: '上传起始图片', hint: '支持 JPG / PNG，图片将作为视频第一帧' },
      { type: 'textarea', label: '运动描述', req: true, rows: 4, ph: '示例：镜头缓慢向前推近，树叶随风轻轻摆动，阳光在地面上移动，人物头发微风吹起。' },
      { type: 'select', label: '画面比例', options: ASPECT_RATIO_OPTIONS, key: 'aspectRatio' },
      { type: 'select', label: '分辨率', options: RESOLUTION_OPTIONS, key: 'resolution' },
      { type: 'select', label: '视频时长', options: ['5 秒', '10 秒'], key: 'duration' },
    ],
    cases: [
      { t: '风景动效 · 山间湖泊', p: '镜头缓慢向前推近，湖面泛起涟漪，云雾在山间流动，阳光穿透云层', cover: '/cases/lake_ff.jpeg', video: '/cases/lake.mp4' },
      { t: '人像动效 · 微笑', p: '人物缓缓转头，露出自然的微笑，头发随风轻拂，背景光斑闪烁', cover: '/cases/portrait_ff.jpeg', video: '/cases/smile.mp4' },
    ],
  },
  /* ---------- 智能创作 ---------- */
  {
    id: 5, cat: 'canvas', catName: '智能创作', icon: '🧩', name: '创作画布',
    slogan: '节点式工作流编排，自由串联文/图/视频/提示词全流程',
    tags: ['工作流', '节点编排', '批量生成'], featured: true, status: 'online',
    out: 'canvas', modelKey: null, sched: 'hybrid', cost: '按节点累计',
    inputs: [], cases: [],
  },
  /* ---------- AI对话 ---------- */
  {
    id: 6, cat: 'chat', catName: 'AI对话', icon: '💬', name: 'AI对话助手',
    slogan: '智能对话助手，支持创意问答、提示词优化、脚本整理',
    tags: ['AI对话', '提示词', '创意助手'], featured: false, status: 'online',
    out: 'chat', modelKey: 'text', sched: 'hybrid', cost: '1-3 积分',
    inputs: [], cases: [],
  },
];

export function schedBadge(t: Tool): string {
  if (t.sched === 'cloud') return 'cloud';
  if (t.sched === 'hybrid') return 'hybrid';
  return 'local';
}

/* ---------- AI 对话快捷提示词 ---------- */
export const CHAT_PROMPTS = [
  { title: '生成视频提示词', desc: '帮我生成一个专业的视频生成提示词' },
  { title: '优化视频脚本', desc: '优化我的视频创意脚本' },
  { title: '图生视频提示词', desc: '根据图片生成视频提示词' },
  { title: '创意灵感建议', desc: '获取视频创作灵感' },
  { title: '文生图提示词优化', desc: '优化AI绘图提示词' },
  { title: '视频分镜脚本', desc: '生成专业的视频分镜脚本' },
];

/* ---------- 后台管理 · 角色与导航 ---------- */
export const ROLES: Record<string, { name: string; icon: string; desc: string }> = {
  admin: { name: '管理员', icon: '🧑‍💼', desc: '管理员 · 创作与运营管理' },
  super: { name: '超级管理员', icon: '🛡️', desc: '系统管理 · 用户与模型配置' },
};

export const ROLE_NAV: Record<string, { id: string; name: string; icon: string }[]> = {
  admin: [
    { id: 'a-history', name: '创作历史', icon: '📋' },
    { id: 'a-overview', name: '全局看板', icon: '📊' },
    { id: 'a-audit', name: '审计日志', icon: '📜' },
    { id: 'a-trend', name: '运营趋势', icon: '📈' },
    { id: 'a-users', name: '用户管理', icon: '👥' },
  ],
  super: [
    { id: 's-perms', name: '权限管理', icon: '🔑' },
    { id: 's-users', name: '用户管理', icon: '👥' },
  ],
};

/* ---------- 权限标签 ---------- */
export const PERM_LABELS: Record<string, string> = {
  user: '用户',
  admin: '管理员',
  super: '超级管理员',
};

/* ---------- 通用工具函数 ---------- */
export function outTypeName(out: string): string {
  return ({ video: '视频', image: '图片', canvas: '工作流', chat: '对话' } as Record<string, string>)[out] || out;
}

export const WORK_TYPE_LABEL: Record<string, string> = {
  TEXT: 'AI对话助手',
  TXT2IMG: '文生图',
  IMG2IMG: '图生图',
  TXT2VIDEO: '文生视频',
  IMG2VIDEO: '图生视频',
  AUDIO: 'AI 配音',
  CANVAS: '创作画布',
};

export function fmtTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
