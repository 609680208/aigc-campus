import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WorksService } from './works.service';
import { CurrentUser } from '../common/decorators';

@Controller('works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.works.create(user.id, body);
  }

  @Get()
  list(@Query() query: any, @CurrentUser() user: any) {
    return this.works.list(user.id, query);
  }

  /** 门户首页统计（需登录） */
  @Get('stats')
  stats() {
    return this.works.stats();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.works.get(id);
  }
}