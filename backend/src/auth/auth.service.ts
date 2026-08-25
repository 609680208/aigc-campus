import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private serialize(user: any) {
    const { password, ssoToken, ...rest } = user;
    return rest;
  }

  private signToken(user: any, expiresIn?: string) {
    return this.jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        adminSubRole: user.adminSubRole ?? null,
      },
      expiresIn ? { expiresIn } : undefined,
    );
  }

  /** 校验 OPC 侧调用的共享密钥（配置了 SSO_SECRET 时才启用） */
  private assertSsoSecret(secret?: string) {
    const expected = process.env.SSO_SECRET;
    if (expected && secret !== expected) {
      throw new ForbiddenException('SSO 密钥校验失败');
    }
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('账号或密码错误');
    return { accessToken: this.signToken(user), user: this.serialize(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { class: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.serialize(user);
  }

  async refresh(user: any) {
    return { accessToken: this.signToken(user) };
  }

  /* ---------------- OPC SSO 对接 ---------------- */

  /**
   * OPC 平台注册时同步调用：在本系统创建对应账号并返回永久 SSO token。
   * 幂等：同一 opcUserId 重复调用直接返回已签发的 token。
   */
  async ssoRegister(dto: {
    secret?: string;
    opcUserId: string;
    username?: string;
    name?: string;
    teamId?: string;
    apiKey?: string;
  }) {
    this.assertSsoSecret(dto.secret);
    const opcUserId = (dto.opcUserId || '').trim();
    if (!opcUserId) throw new BadRequestException('opcUserId 不能为空');

    const exists = await this.prisma.user.findUnique({
      where: { opcUserId },
    });
    if (exists) {
      return {
        userId: exists.id,
        username: exists.username,
        opcUserId,
        ssoToken: exists.ssoToken,
      };
    }

    // 账号默认取 opcUserId，冲突时加后缀；密码随机生成（SSO 用户不走密码登录）
    let username = (dto.username || opcUserId).trim();
    if (await this.prisma.user.findUnique({ where: { username } })) {
      username = `opc_${opcUserId}`;
    }
    const user = await this.prisma.user.create({
      data: {
        username,
        name: (dto.name || username).trim(),
        password: bcrypt.hashSync(randomBytes(16).toString('hex'), 10),
        role: 'STUDENT',
        quotaBalance: 100,
        opcUserId,
        ssoToken: randomBytes(24).toString('hex'),
        apiKey: dto.apiKey || null,
        teamId: dto.teamId || null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: '注册账号',
        detail: `OPC 平台同步注册（opcUserId=${opcUserId}）`,
      },
    });
    return {
      userId: user.id,
      username: user.username,
      opcUserId,
      ssoToken: user.ssoToken,
    };
  }

  /**
   * SSO 中间页自动登录：凭永久 ssoToken 匹配用户，
   * 同步更新 apikey / teamId / teamTaskId 后签发长期会话 JWT。
   */
  async ssoLogin(dto: {
    token: string;
    apikey?: string;
    opcUserId?: string;
    teamId?: string;
    teamTaskId?: string;
  }) {
    const token = (dto.token || '').trim();
    if (!token) throw new BadRequestException('缺少 token 参数');
    const user = await this.prisma.user.findUnique({
      where: { ssoToken: token },
    });
    if (!user) throw new UnauthorizedException('SSO token 无效，请从 OPC 门户重新进入');
    if (dto.opcUserId && user.opcUserId && dto.opcUserId !== user.opcUserId) {
      throw new UnauthorizedException('token 与用户不匹配');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        apiKey: dto.apikey || user.apiKey,
        teamId: dto.teamId || user.teamId,
        teamTaskId: dto.teamTaskId || user.teamTaskId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SSO 登录',
        detail: `从 OPC 门户进入${dto.teamId ? `（团队 ${dto.teamId}）` : ''}`,
      },
    });
    // SSO 会话签发长期 JWT（1 年），过期前可通过 /auth/refresh 续期
    return {
      accessToken: this.signToken(updated, '365d'),
      user: this.serialize(updated),
    };
  }

  /** 修改个人资料（姓名） */
  async updateProfile(userId: string, dto: { name?: string }) {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('姓名不能为空');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: '修改资料', detail: `姓名改为「${name}」` },
    });
    return this.serialize(user);
  }

  /** 修改登录密码 */
  async changePassword(
    userId: string,
    dto: { oldPassword: string; newPassword: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.oldPassword || '', user.password);
    if (!ok) throw new BadRequestException('原密码错误');
    if ((dto.newPassword || '').length < 6) {
      throw new BadRequestException('新密码至少 6 位');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: bcrypt.hashSync(dto.newPassword, 10) },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: '修改密码',
        detail: `${user.name}（${user.username}）修改了登录密码`,
      },
    });
    return { ok: true };
  }
}