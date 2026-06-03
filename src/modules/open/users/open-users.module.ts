import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { UsersController } from './users.controller';
import { OpenUsersService } from './open-users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [OpenUsersService],
})
export class OpenUsersModule {}
