import { Module } from '@nestjs/common';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [WorksController],
  providers: [WorksService],
})
export class WorksModule {}