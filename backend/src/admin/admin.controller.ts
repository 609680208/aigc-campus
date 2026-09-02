import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  stats() {
    return this.admin.stats();
  }

  @Get('audit')
  @Roles('ADMIN', 'SUPER_ADMIN')
  audit() {
    return this.admin.audit();
  }

  /** 全平台用量统计（本地/云端、按功能分布） */
  @Get('usage')
  @Roles('ADMIN', 'SUPER_ADMIN')
  usage() {
    return this.admin.usage();
  }

  /** 用户使用统计（创作次数/累计消耗/最近活跃） */
  @Get('user-stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  userStats(@Query('role') role?: string) {
    return this.admin.userStats(role);
  }
}
