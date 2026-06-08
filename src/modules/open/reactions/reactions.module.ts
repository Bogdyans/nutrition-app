import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './services/reactions.service';
import { ReactionsCRUDService } from './services/reactions-crud.service';
import { ReactionStatsDomainService } from './services/reaction-stats.domain.service';
import { ReactionStatsQueryService } from './services/reaction-stats.query.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReactionsController],
  providers: [
    ReactionsService,
    ReactionsCRUDService,
    ReactionStatsDomainService,
    ReactionStatsQueryService,
  ],
})
export class ReactionsModule {}
