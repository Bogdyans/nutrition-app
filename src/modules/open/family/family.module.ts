import { Module } from '@nestjs/common';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { PrismaService } from '../../core/prisma/prisma.service';

@Module({
  controllers: [FamilyController],
  providers: [FamilyService, PrismaService],
})
export class FamilyModule {}
