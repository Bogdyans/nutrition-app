import { Module } from '@nestjs/common';
import { WeightHistoryService } from './weight-history.service';
import { WeightHistoryController } from './weight-history.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeightHistoryController],
  providers: [WeightHistoryService],
})
export class WeightHistoryModule {}
