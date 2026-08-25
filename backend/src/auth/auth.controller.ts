import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  /** OPC 平台注册时同步调用：创建本系统账号并返回永久 SSO token */
  @Public()
  @Post('sso/register')
  @HttpCode(200)
  ssoRegister(
    @Body()
    body: {
      secret?: string;
      opcUserId: string;
      username?: string;
      name?: string;
      teamId?: string;
      apiKey?: string;
    },
  ) {
    return this.auth.ssoRegister(body);
  }

  /** SSO 中间页自动登录：凭永久 token 换取会话 JWT */
  @Public()
  @Post('sso/login')
  @HttpCode(200)
  ssoLogin(
    @Body()
    body: {
      token: string;
      apikey?: string;
      opcUserId?: string;
      teamId?: string;
      teamTaskId?: string;
    },
  ) {
    return this.auth.ssoLogin(body);
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@CurrentUser() user: any) {
    return this.auth.refresh(user);
  }

  /** 修改个人资料（姓名） */
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: any,
    @Body() body: { name?: string },
  ) {
    return this.auth.updateProfile(user.id, body);
  }

  /** 修改登录密码 */
  @Patch('profile/password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(user.id, body);
  }
}
