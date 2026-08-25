import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { typeLabel } from '../ai/providers';

@Injectable()
export class WorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, dto: any) {
    const type = dto.type as string;

    // 创作画布：不涉及模型，直接保存
    if (type === 'CANVAS') {
      return this.prisma.work.create({
        data: {
          userId,
          type,
          prompt: dto.prompt || '',
          status: 'SUCCEEDED',
          resultText: '画布内容已保存（模拟）',
          cost: 0,
        },
      });
    }

    const model = await this.prisma.model.findFirst({
      where: { id: dto.modelId, enabled: true },
    });
    if (!model) throw new BadRequestException('请选择有效的模型');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.quotaBalance < model.cost) {
      throw new ForbiddenException('算力配额不足，请联系管理员充值');
    }

    const work = await this.prisma.work.create({
      data: {
        userId,
        modelId: model.id,
        type: type as WorkType,
        prompt: dto.prompt || '',
        status: 'PROCESSING',
        cost: model.cost,
      },
    });

    try {
      const result = await this.ai.generate(model, {
        prompt: dto.prompt || '',
        type,
        image: dto.image,
        images: Array.isArray(dto.images) ? dto.images : undefined,
        aspectRatio: dto.aspectRatio,
        resolution: dto.resolution,
        duration: dto.duration ? Number(dto.duration) : undefined,
        // genzhi 平台按用户维度计费：使用当前用户 SSO 带入的 apikey 调用模型
        userApiKey: user.apiKey || undefined,
      });
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.work.update({
          where: { id: work.id },
          data: {
            status: 'SUCCEEDED',
            resultText: result.resultText ?? null,
            resultUrl: result.resultUrl ?? null,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { quotaBalance: { decrement: model.cost } },
        });
        await tx.quotaLog.create({
          data: {
            userId,
            amount: -model.cost,
            reason: `${typeLabel(type)} · ${model.name}`,
          },
        });
        return updated;
      });
    } catch (e: any) {
      const raw = e?.message || '生成失败';
      await this.prisma.work.update({
        where: { id: work.id },
        data: { status: 'FAILED', error: raw },
      });
      // 把常见技术性错误转成用户友好提示，其余原样透传；以 400 抛出避免 Nest 掩盖为 "Internal server error"
      const friendly = /do request failed/i.test(raw)
        ? '模型上游服务暂时不可用，请稍后重试或更换模型'
        : raw;
      throw new BadRequestException(friendly);
    }
  }

  async list(userId: string, query: any) {
    const where: any = { userId };
    if (query.type) where.type = query.type;
    const size = query.size ? Number(query.size) : 20;
    const page = query.page ? Number(query.page) : 1;
    return this.prisma.work.findMany({
      where,
      include: { model: true },
      orderBy: { createdAt: 'desc' },
      take: size,
      skip: (page - 1) * size,
    });
  }

  /** 门户首页真实统计：总创作次数 + 各功能使用次数 */
  async stats() {
    const grouped = await this.prisma.work.groupBy({
      by: ['type'],
      _count: { _all: true },
    });
    const total = await this.prisma.work.count();
    const byType: Record<string, number> = {};
    for (const g of grouped) byType[g.type] = g._count._all;
    return { total, byType };
  }

  async get(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        model: true,
        user: { select: { name: true, username: true } },
      },
    });
    if (!work) throw new NotFoundException('记录不存在');
    return work;
  }
}