import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [
      userTotal,
      studentCount,
      adminCount,
      superCount,
      workTotal,
      modelCount,
      quotaAgg,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
      this.prisma.work.count(),
      this.prisma.model.count(),
      this.prisma.quotaLog.aggregate({
        where: { amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);

    return {
      userTotal,
      studentCount,
      adminCount,
      superCount,
      workTotal,
      modelCount,
      quotaConsumed: Math.abs(quotaAgg._sum.amount || 0),
    };
  }

  async audit() {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listApprovals() {
    return this.prisma.approval.findMany({
      include: { requester: { select: { name: true, username: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createApproval(requesterId: string, dto: any) {
    return this.prisma.approval.create({
      data: {
        requesterId,
        type: dto.type || '配额申请',
        amount: dto.amount ?? 0,
        reason: dto.reason,
      },
    });
  }

  async decideApproval(id: string, status: string, approverId: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
    });
    if (!approval) throw new NotFoundException('申请不存在');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }
    if (status === 'APPROVED') {
      // 通过：为申请人增加算力并记录流水与审计
      await this.prisma.$transaction([
        this.prisma.approval.update({
          where: { id },
          data: { status, approverId },
        }),
        this.prisma.user.update({
          where: { id: approval.requesterId },
          data: { quotaBalance: { increment: approval.amount } },
        }),
        this.prisma.quotaLog.create({
          data: {
            userId: approval.requesterId,
            amount: approval.amount,
            reason: `配额申请通过${approval.reason ? ' · ' + approval.reason : ''}`,
          },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: approverId,
            action: '审批通过',
            detail: `为申请人增加 ${approval.amount} 算力点`,
          },
        }),
      ]);
      return this.prisma.approval.findUnique({ where: { id } });
    }
    const updated = await this.prisma.approval.update({
      where: { id },
      data: { status, approverId },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: '审批驳回',
        detail: `驳回配额申请 · ${approval.amount} 点`,
      },
    });
    return updated;
  }

  /** 我的配额申请（老师/管理员本人提交的） */
  async myApprovals(userId: string) {
    return this.prisma.approval.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 全平台用量统计（真实数据）：按功能分类的本地/云端分布与消耗 */
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

  /** 用户使用统计（真实数据）：创作次数 / 累计消耗 / 最近活跃 */
  async userStats(role?: string) {
    const where: any = role ? { role } : {};
    const users = await this.prisma.user.findMany({
      where,
      include: { class: true },
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
        adminSubRole: u.adminSubRole,
        className: u.class?.name || null,
        quotaBalance: u.quotaBalance,
        workCount: w?._count._all || 0,
        totalCost: w?._sum.cost || 0,
        lastActiveAt: w?._max.createdAt || null,
      };
    });
  }

  async listClasses() {
    return this.prisma.class.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { students: true } } },
    });
  }

  async createClass(dto: any) {
    return this.prisma.class.create({
      data: { name: dto.name, grade: dto.grade },
    });
  }

  async quotaUsers() {
    const users = await this.prisma.user.findMany({
      where: { role: { not: 'SUPER_ADMIN' } },
      include: { class: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      adminSubRole: u.adminSubRole,
      quotaBalance: u.quotaBalance,
      className: u.class?.name || null,
    }));
  }
}