import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser, Roles } from '../common/decorators';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  list(
    @Query('role') role?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.users.listUsers({ role, keyword });
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.users.createUser(body, user);
  }

  @Post('import')
  @Roles('SUPER_ADMIN')
  importUsers(
    @Body() body: { users: any[] },
    @CurrentUser() user: any,
  ) {
    return this.users.importUsers(body.users || [], user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.users.updateUser(id, body, user);
  }
}