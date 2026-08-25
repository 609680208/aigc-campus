import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** 支持的服务商格式（与前端下拉一致） */
export const PROVIDER_OPTIONS = [
  { value: 'OPENAI', label: 'OpenAI 格式' },
  { value: 'DEEPSEEK', label: 'DeepSeek 格式' },
  { value: 'DASHSCOPE', label: 'DashScope 格式' },
  { value: 'CLAUDE', label: 'Claude 格式' },
  { value: 'COMFYUI', label: 'ComfyUI 格式' },
] as const;

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEnabled() {
    return this.prisma.model.findMany({
      where: { enabled: true },
      orderBy: [{ type: 'asc' }, { cost: 'asc' }],
    });
  }

  async listAll() {
    return this.prisma.model.findMany({
      orderBy: [{ type: 'asc' }, { cost: 'asc' }],
    });
  }

  async create(dto: any, actor: any) {
    const model = await this.prisma.model.create({
      data: {
        name: dto.name,
        type: dto.type,
        loc: dto.loc || 'CLOUD',
        cost: dto.cost ?? 1,
        enabled: dto.enabled ?? true,
        provider: this.normalizeProvider(dto.provider),
        apiKey: dto.apiKey || null,
        baseUrl: dto.baseUrl || null,
        externalId: dto.externalId || null,
      },
    });
    await this.audit(actor, '新增模型', `${model.name}（${model.type}）`);
    return model;
  }

  async update(id: string, dto: any, actor: any) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.loc !== undefined) data.loc = dto.loc;
    if (dto.cost !== undefined) data.cost = dto.cost;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.provider !== undefined) data.provider = this.normalizeProvider(dto.provider);
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey || null;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl || null;
    if (dto.externalId !== undefined) data.externalId = dto.externalId || null;

    const model = await this.prisma.model.update({ where: { id }, data });
    await this.audit(actor, '更新模型', model.name);
    return model;
  }

  async remove(id: string, actor: any) {
    const model = await this.prisma.model.delete({ where: { id } });
    await this.audit(actor, '删除模型', model.name);
    return { id };
  }

  private normalizeProvider(p?: string): string {
    const pv = String(p || 'OPENAI').toUpperCase();
    const valid = PROVIDER_OPTIONS.map((o) => o.value);
    return valid.includes(pv as any) ? pv : 'OPENAI';
  }

  private async audit(actor: any, action: string, detail: string) {
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action, detail },
    });
  }
}