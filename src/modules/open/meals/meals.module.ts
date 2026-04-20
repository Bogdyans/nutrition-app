import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
import { ReactionStatsDomainService } from '../reactions/services/reaction-stats.domain.service';

@Module({
  imports: [PrismaModule],
  controllers: [MealsController],
  providers: [MealsService, ReactionStatsDomainService],
  exports: [MealsService],
})
export class MealsModule {}
