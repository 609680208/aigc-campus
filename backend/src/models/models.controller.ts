import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ModelsService } from './models.service';
import { CurrentUser, Roles } from '../common/decorators';

@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  list() {
    return this.models.listEnabled();
  }

  @Get('all')
  @Roles('SUPER_ADMIN')
  listAll() {
    return this.models.listAll();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.models.create(body, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.models.update(id, body, user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.models.remove(id, user);
  }
}