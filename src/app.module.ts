import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule,
  ],
})
export class AppModule {}
