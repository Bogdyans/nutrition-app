import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { AuthModule } from '../../core/auth/auth.module';
import { ChatsGateway } from './chats.gateway';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService, ChatsGateway],
})
export class ChatsModule {}
