import { Module } from '@nestjs/common';
import { AuthModule } from './modules/core/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  envValidationOptions,
  envValidationSchema,
} from './config/env.validation';
import { ProductsModule } from './modules/open/products/products.module';
import { MealsModule } from './modules/open/meals/meals.module';
import { WeightHistoryModule } from './modules/open/weight-history/weight-history.module';
import { ProfileModule } from './modules/open/profile/profile.module';
import { StatsModule } from './modules/open/stats/stats.module';
import { ReactionsModule } from './modules/open/reactions/reactions.module';
import { RecommendationsModule } from './modules/open/recommendations/recommendations.module';
import { FamilyModule } from './modules/open/family/family.module';
import { MealVisionModule } from './modules/open/recognition/recognition.module';
import { OpenUsersModule } from './modules/open/users/open-users.module';
import { LegalModule } from './modules/open/legal/legal.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: envValidationOptions,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    ProductsModule,
    MealsModule,
    WeightHistoryModule,
    ProfileModule,
    StatsModule,
    ReactionsModule,
    RecommendationsModule,
    FamilyModule,
    MealVisionModule,
    OpenUsersModule,
    LegalModule,
  ],
})
export class AppModule {}
