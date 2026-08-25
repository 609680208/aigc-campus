import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(user: any) {
    if (!user) return user;
    const { password, ...rest } = user;
    return rest;
  }

  private hash(pwd: string) {
    return bcrypt.hashSync(pwd || '123456', 10);
  }

  async listClasses() {
    return this.prisma.class.findMany({ orderBy: { name: 'asc' } });
  }

  async listUsers(query: {
    role?: string;
    keyword?: string;
    classId?: string;
  }) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.classId) where.classId = query.classId;
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { username: { contains: query.keyword } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      include: { class: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.serialize(u));
  }

  async createUser(dto: any, actor: any) {
    if (!dto.username || !dto.name) {
      throw new BadRequestException('账号与姓名不能为空');
    }
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new BadRequestException('账号已存在');
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        password: this.hash(dto.password),
        role: dto.role || 'STUDENT',
        adminSubRole: dto.role === 'ADMIN' ? dto.adminSubRole || 'TEACHER' : null,
        classId: dto.classId || null,
        quotaBalance: dto.quotaBalance ?? 100,
      },
    });
    await this.audit(actor, '创建账号', `${user.name}（${user.username}）`);
    return this.serialize(user);
  }

  async importUsers(users: any[], actor: any) {
    let count = 0;
    for (const dto of users) {
      if (!dto.username || !dto.name) continue;
      const exists = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (exists) continue;
      await this.prisma.user.create({
        data: {
          username: dto.username,
          name: dto.name,
          password: this.hash(dto.password),
          role: dto.role || 'STUDENT',
          adminSubRole:
            dto.role === 'ADMIN' ? dto.adminSubRole || 'TEACHER' : null,
          classId: dto.classId || null,
          quotaBalance: dto.quotaBalance ?? 100,
        },
      });
      count++;
    }
    await this.audit(actor, '批量导入账号', `新增 ${count} 个账号`);
    return { count };
  }

  async updateUser(id: string, dto: any, actor: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.classId !== undefined) data.classId = dto.classId || null;
    if (dto.password) data.password = this.hash(dto.password);
    if (dto.role !== undefined) {
      data.role = dto.role;
      data.adminSubRole =
        dto.role === 'ADMIN' ? dto.adminSubRole || 'TEACHER' : null;
    } else if (dto.adminSubRole !== undefined) {
      data.adminSubRole = dto.adminSubRole;
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    await this.audit(
      actor,
      '变更账号权限',
      `${user.name} → ${data.role ? data.role + (data.adminSubRole ? '/' + data.adminSubRole : '') : '资料更新'}`,
    );
    return this.serialize(updated);
  }

  async setQuota(id: string, amount: number, reason: string | undefined, actor: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (amount < 0) throw new BadRequestException('配额不能为负数');
    const diff = amount - user.quotaBalance;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { quotaBalance: amount },
    });
    await this.prisma.quotaLog.create({
      data: {
        userId: id,
        amount: diff,
        reason: reason || '管理员调整配额',
      },
    });
    await this.audit(
      actor,
      '调整算力配额',
      `${user.name}：${user.quotaBalance} → ${amount}`,
    );
    return this.serialize(updated);
  }

  private async audit(actor: any, action: string, detail: string) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        detail,
      },
    });
  }
}