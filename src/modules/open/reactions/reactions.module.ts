import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './services/reactions.service';
import { ReactionsCRUDService } from './services/reactions-crud.service';


@Module({
  imports: [PrismaModule],
  controllers: [ReactionsController],
  providers: [ReactionsService, ReactionsCRUDService],
})
export class ReactionsModule {}
