import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CurrentUser, Roles } from '../common/decorators';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private ensureLeader(user: any) {
    if (user.role === 'ADMIN' && user.adminSubRole !== 'LEADER') {
      throw new ForbiddenException('仅领导与超级管理员可访问');
    }
  }

  @Get('stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  stats() {
    return this.admin.stats();
  }

  @Get('audit')
  @Roles('ADMIN', 'SUPER_ADMIN')
  audit(@CurrentUser() user: any) {
    this.ensureLeader(user);
    return this.admin.audit();
  }

  @Get('approvals')
  @Roles('ADMIN', 'SUPER_ADMIN')
  approvals(@CurrentUser() user: any) {
    this.ensureLeader(user);
    return this.admin.listApprovals();
  }

  /** 本人提交的配额申请（老师查看自己的申请进度） */
  @Get('my-approvals')
  @Roles('ADMIN', 'SUPER_ADMIN')
  myApprovals(@CurrentUser() user: any) {
    return this.admin.myApprovals(user.id);
  }

  /** 全平台用量统计（本地/云端、按功能分布） */
  @Get('usage')
  @Roles('ADMIN', 'SUPER_ADMIN')
  usage(@CurrentUser() user: any) {
    this.ensureLeader(user);
    return this.admin.usage();
  }

  /** 用户使用统计（创作次数/累计消耗/最近活跃） */
  @Get('user-stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  userStats(@Query('role') role?: string) {
    return this.admin.userStats(role);
  }

  @Post('approvals')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createApproval(@Body() body: any, @CurrentUser() user: any) {
    return this.admin.createApproval(user.id, body);
  }

  @Patch('approvals/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  decideApproval(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
  ) {
    this.ensureLeader(user);
    return this.admin.decideApproval(id, body.status, user.id);
  }

  @Get('classes')
  @Roles('ADMIN', 'SUPER_ADMIN')
  classes() {
    return this.admin.listClasses();
  }

  @Post('classes')
  @Roles('SUPER_ADMIN')
  createClass(@Body() body: any) {
    return this.admin.createClass(body);
  }

  @Get('quota-users')
  @Roles('ADMIN', 'SUPER_ADMIN')
  quotaUsers() {
    return this.admin.quotaUsers();
  }
}