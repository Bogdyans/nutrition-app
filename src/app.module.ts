import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './modules/open/products/products.module';
import { MealsModule } from './modules/open/meals/meals.module';
import { WeightHistoryModule } from './modules/open/weight-history/weight-history.module';
import { ProfileModule } from './modules/open/profile/profile.module';
import { StatsModule } from './modules/open/stats/stats.module';
import { ReactionsModule } from './modules/open/reactions/reactions.module';
import { RecommendationsModule } from './modules/open/recommendations/recommendations.module';
import { FamilyModule } from './modules/open/family/family.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ProductsModule,
    MealsModule,
    WeightHistoryModule,
    ProfileModule,
    StatsModule,
    ReactionsModule,
    RecommendationsModule,
    FamilyModule,
  ],
})
export class AppModule {}
