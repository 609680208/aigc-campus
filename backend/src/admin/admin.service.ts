import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [userTotal, normalCount, adminCount, superCount, workTotal, modelCount] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: 'USER' } }),
        this.prisma.user.count({ where: { role: 'ADMIN' } }),
        this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
        this.prisma.work.count(),
        this.prisma.model.count(),
      ]);

    return {
      userTotal,
      userCount: normalCount,
      adminCount,
      superCount,
      workTotal,
      modelCount,
    };
  }

  async audit() {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** 全平台用量统计（真实数据）：按功能分类的本地/云端分布与消耗（积分仅作展示，计费在中转站侧） */
  async usage() {
    const works = await this.prisma.work.findMany({
      select: {
        type: true,
        cost: true,
        status: true,
        createdAt: true,
        model: { select: { loc: true } },
      },
    });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const byTypeMap: Record<
      string,
      { type: string; local: number; cloud: number; count: number; cost: number }
    > = {};
    let totalCost = 0;
    let localCost = 0;
    let cloudCost = 0;
    let monthCost = 0;
    let succeeded = 0;
    for (const w of works) {
      const isLocal = w.model?.loc === 'LOCAL';
      const entry =
        byTypeMap[w.type] ||
        (byTypeMap[w.type] = { type: w.type, local: 0, cloud: 0, count: 0, cost: 0 });
      entry.count++;
      entry.cost += w.cost;
      if (isLocal) {
        entry.local++;
        localCost += w.cost;
      } else {
        entry.cloud++;
        cloudCost += w.cost;
      }
      totalCost += w.cost;
      if (w.createdAt >= monthStart) monthCost += w.cost;
      if (w.status === 'SUCCEEDED') succeeded++;
    }
    return {
      byType: Object.values(byTypeMap),
      totalCost,
      localCost,
      cloudCost,
      monthCost,
      workTotal: works.length,
      successRate: works.length
        ? Math.round((succeeded / works.length) * 1000) / 10
        : 100,
    };
  }

  /** 用户使用统计（真实数据）：创作次数 / 累计消耗（展示）/ 最近活跃 */
  async userStats(role?: string) {
    const where: any = role ? { role } : {};
    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }],
    });
    const works = await this.prisma.work.groupBy({
      by: ['userId'],
      _count: { _all: true },
      _sum: { cost: true },
      _max: { createdAt: true },
    });
    const map = new Map(works.map((w) => [w.userId, w]));
    return users.map((u) => {
      const w = map.get(u.id);
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        workCount: w?._count._all || 0,
        totalCost: w?._sum.cost || 0,
        lastActiveAt: w?._max.createdAt || null,
      };
    });
  }
}
