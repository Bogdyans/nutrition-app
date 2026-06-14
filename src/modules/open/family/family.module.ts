import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ChatsModule } from '../chats/chats.module';
import { StatsModule } from '../stats/stats.module';
import { ReactionsModule } from '../reactions/reactions.module';
import { FamilyController } from './family.controller';
import { FamilyMembersController } from './family-members.controller';
import { FamilyService } from './family.service';

@Module({
  imports: [PrismaModule, ChatsModule, StatsModule, ReactionsModule],
  controllers: [FamilyController, FamilyMembersController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
