import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../modules/core/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens() {
    this.logger.log('Началась очистка просроченных токенов...');

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } }, // Время жизни вышло
            { revokedAt: { not: null } }, // Токен был отозван (использован или логаут)
          ],
        },
      });

      this.logger.log(`Очистка завершена. Удалено токенов: ${result.count}`);
    } catch (error) {
      this.logger.error('Ошибка при очистке токенов', error);
    }
  }
}
