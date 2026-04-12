import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenCleanupService } from './tasks/token-cleanup.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule,
    TokenCleanupService,
  ],
})
export class AppModule {}
