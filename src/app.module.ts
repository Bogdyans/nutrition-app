import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './modules/open/products/products.module';
import { MealsModule } from './modules/open/meals/meals.module';
import { WeightHistoryModule } from './modules/open/weight-history/weight-history.module';
import { ProfileModule } from './modules/open/profile/profile.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ProductsModule,
    MealsModule,
    WeightHistoryModule,
    ProfileModule,
  ],
})
export class AppModule {}
