import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ModelsModule } from './models/models.module';
import { AiModule } from './ai/ai.module';
import { WorksModule } from './works/works.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { AppController } from './app.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ModelsModule,
    AiModule,
    WorksModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [AppController],
})
export class AppModule {}