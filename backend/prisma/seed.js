/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const pwd = (p) => bcrypt.hashSync(p, 10);

  // 1. 迁移旧演示账号（去学生/老师/领导化：统一改名为 用户/管理员）
  const renames = [
    ['student', 'user'],
    ['student2', 'user2'],
    ['student3', 'user3'],
    ['teacher', 'manager'],
    ['leader', 'manager2'],
  ];
  for (const [from, to] of renames) {
    const old = await prisma.user.findUnique({ where: { username: from } });
    if (!old) continue;
    const conflict = await prisma.user.findUnique({ where: { username: to } });
    if (conflict && conflict.id !== old.id) continue; // 目标账号已存在则跳过
    await prisma.user.update({ where: { id: old.id }, data: { username: to } });
  }

  // 2. 用户（三类角色：普通用户 / 管理员 / 超级管理员）
  const users = [
    { username: 'user', password: '123456', name: '陈晓', role: UserRole.USER },
    { username: 'user2', password: '123456', name: '李雷', role: UserRole.USER },
    { username: 'user3', password: '123456', name: '韩梅梅', role: UserRole.USER },
    { username: 'manager', password: '123456', name: '张明', role: UserRole.ADMIN },
    { username: 'manager2', password: '123456', name: '王芳', role: UserRole.ADMIN },
    { username: 'admin', password: 'admin', name: '系统管理员', role: UserRole.SUPER_ADMIN },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        password: pwd(u.password),
        name: u.name,
        role: u.role,
      },
      create: {
        username: u.username,
        password: pwd(u.password),
        name: u.name,
        role: u.role,
      },
    });
  }

  // 3. 模型配置（与 huobao-drama 项目实际配置对齐：中转站 8083 文本/图片 + ComfyUI 视频/配音；
  //    按要求不配置 seedance / 可灵，视频仅配置一个 minimax-h3）
  //    cost 仅用于前端展示「单次消耗积分」，实际计费在中转站算力平台侧
  //    注意：中转站 glm-5.2 渠道实测被映射到 deepseek-v4-flash（2026-08-20 验证），
  //    已替换为实测身份一致的 Qwen3.6-27B；如中转站修复 GLM 渠道可再换回
  const RELAY_BASE = 'http://118.195.196.120:8083/v1';
  const RELAY_KEY = 'sk-1wdCHBcK3CQCavUwUqr5DO9FxilHkOQOhv5IWIBG4paWhHfI';
  const COMFY_VIDEO = 'http://118.195.196.120:8189';
  const COMFY_TTS = 'http://118.195.196.120:8199';

  const models = [
    // 文本
    { name: '中转站Qwen3.6', type: 'TEXT', provider: 'OPENAI', externalId: 'Qwen3.6-27B', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 1 },
    { name: 'deepseek-v4-flash', type: 'TEXT', provider: 'OPENAI', externalId: 'deepseek-v4-flash', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 1 },
    // 文生图
    { name: 'gpt-image-2-文生图', type: 'TXT2IMG', provider: 'OPENAI', externalId: 'gpt-image-2-t2t', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 2 },
    { name: 'seedream-5-0-文生图', type: 'TXT2IMG', provider: 'OPENAI', externalId: 'doubao-seedream-5-0-260128-t2t', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 2 },
    { name: 'seedream-pro-文生图', type: 'TXT2IMG', provider: 'OPENAI', externalId: 'doubao-seedream-5-0-pro-260628', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 3 },
    // 图生图
    { name: 'gpt-图生图', type: 'IMG2IMG', provider: 'OPENAI', externalId: 'gpt-image-2-i2t', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 2 },
    { name: 'seedream-5.0-图生图', type: 'IMG2IMG', provider: 'OPENAI', externalId: 'doubao-seedream-5-0-260128-i2t', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 2 },
    { name: 'seedream-5.0pro-图生图', type: 'IMG2IMG', provider: 'OPENAI', externalId: 'doubao-seedream-5-0-pro-260628', baseUrl: RELAY_BASE, apiKey: RELAY_KEY, loc: 'CLOUD', cost: 3 },
    // 文生视频（ComfyUI MiniMax H3，不包含 seedance / 可灵）
    { name: 'minimax-h3正常模式', type: 'TXT2VIDEO', provider: 'COMFYUI', externalId: 'minimax-h3', baseUrl: COMFY_VIDEO, apiKey: null, loc: 'CLOUD', cost: 8 },
    // 图生视频（ComfyUI MiniMax H3 首尾帧）
    { name: 'minimax-h3-i2v', type: 'IMG2VIDEO', provider: 'COMFYUI', externalId: 'minimax-h3-i2v', baseUrl: COMFY_VIDEO, apiKey: null, loc: 'CLOUD', cost: 10 },
    // 配音（ComfyUI Qwen3-TTS）
    { name: 'qwen3-tts-default', type: 'AUDIO', provider: 'COMFYUI', externalId: 'qwen3-tts-default', baseUrl: COMFY_TTS, apiKey: null, loc: 'CLOUD', cost: 2 },
  ];

  for (const m of models) {
    await prisma.model.upsert({
      where: { name_type: { name: m.name, type: m.type } },
      update: {
        provider: m.provider,
        externalId: m.externalId,
        baseUrl: m.baseUrl,
        apiKey: m.apiKey,
        loc: m.loc,
        cost: m.cost,
        enabled: true,
      },
      create: m,
    });
  }

  // 清理已废弃的模型记录（glm-5.2 渠道失效后不再出现在种子中，需从库里移除）
  await prisma.work.updateMany({
    where: { model: { name: { in: ['中转站glm5.2'] } } },
    data: { modelId: null },
  });
  await prisma.model.deleteMany({ where: { name: { in: ['中转站glm5.2'] } } });

  console.log('种子数据初始化完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
