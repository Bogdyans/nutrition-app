import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';

const CODE_TTL_MS = 15 * 60_000; // 15 минут
const RESEND_COOLDOWN_MS = 60_000; // 60 секунд между отправками
const MAX_ATTEMPTS = 5;

/**
 * Email confirmation via a one-time 6-digit code.
 *
 * Codes are stored hashed (bcrypt), single-use, expire after 15 minutes and
 * are throttled: a limited number of guesses, plus a cooldown between resends.
 */
@Injectable()
export class EmailConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Generates a fresh code, replaces any previous codes for the user and emails
   * it. `enforceCooldown` throttles explicit resends; registration passes
   * `false` so a code is always sent immediately.
   */
  async issueAndSend(
    userId: string,
    email: string,
    { enforceCooldown = false }: { enforceCooldown?: boolean } = {},
  ): Promise<void> {
    if (enforceCooldown) {
      const last = await this.prisma.emailVerificationCode.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (last) {
        const elapsed = Date.now() - last.createdAt.getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          throw new BadRequestException(
            `Повторная отправка возможна через ${wait} с`,
          );
        }
      }
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);

    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.deleteMany({ where: { userId } }),
      this.prisma.emailVerificationCode.create({
        data: {
          userId,
          codeHash,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      }),
    ]);

    await this.mail.sendVerificationCode(email, code);
  }

  /**
   * Validates the code for the given email. On success marks the account as
   * verified, clears the codes and returns the user id (for token issue).
   */
  async confirm(email: string, code: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, deletedAt: true },
    });

    // A single, non-revealing message for "no such account / wrong code".
    const invalid = new BadRequestException('Неверный код подтверждения');
    if (!user || user.deletedAt) throw invalid;
    if (user.emailVerified) {
      throw new BadRequestException('Почта уже подтверждена');
    }

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'Код подтверждения не найден. Запросите новый.',
      );
    }

    if (record.expiresAt < new Date()) {
      await this.clearCodes(user.id);
      throw new BadRequestException(
        'Срок действия кода истёк. Запросите новый.',
      );
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.clearCodes(user.id);
      throw new BadRequestException(
        'Слишком много попыток. Запросите новый код.',
      );
    }

    const matches = await bcrypt.compare(code, record.codeHash);
    if (!matches) {
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationCode.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return user.id;
  }

  private clearCodes(userId: string) {
    return this.prisma.emailVerificationCode.deleteMany({ where: { userId } });
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
