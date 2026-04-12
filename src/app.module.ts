import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './modules/open/products/products.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ProductsModule,
  ],
})
export class AppModule {}
