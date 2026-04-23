import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class RecommendationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, content: string) {
    return this.prisma.recommendation.create({
      data: {
        userId,
        content,
      },
    });
  }

  findLatest(userId: string, take = 5) {
    return this.prisma.recommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
