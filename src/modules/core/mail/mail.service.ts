import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Thin wrapper around an SMTP transport (Nodemailer).
 *
 * When SMTP is not configured (no SMTP_HOST/USER/PASS) the service falls back
 * to logging the message instead of sending it — so the verification flow can
 * be exercised end-to-end in development without real credentials.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const port = Number(this.config.get('SMTP_PORT')) || 465;

    this.from =
      this.config.get<string>('SMTP_FROM') ?? user ?? 'no-reply@perekusov.net';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // SSL for 465, STARTTLS for 587
        auth: { user, pass },
        // Force IPv4: Docker bridge networks usually have no IPv6 route, so
        // resolving Gmail to an AAAA address first causes a CONN timeout.
        family: 4,
        connectionTimeout: 15_000,
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP не настроен — письма выводятся в лог (режим разработки).',
      );
    }
  }

  /** Checks SMTP credentials at startup so misconfiguration is obvious early. */
  async onModuleInit(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log('SMTP-подключение установлено — отправка писем готова.');
    } catch (error) {
      this.logger.error(
        'Не удалось подключиться к SMTP — проверьте переменные SMTP_* в .env.',
        error as Error,
      );
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = 'Код подтверждения — Дневник Питания';
    const text =
      `Ваш код подтверждения: ${code}\n\n` +
      'Введите его в приложении, чтобы завершить регистрацию. ' +
      'Код действителен 15 минут.\n\n' +
      'Если вы не регистрировались, просто проигнорируйте это письмо.';

    if (!this.transporter) {
      this.logger.warn(`[DEV] Код подтверждения для ${to}: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      this.logger.error(`Не удалось отправить письмо на ${to}`, error as Error);
      throw new ServiceUnavailableException(
        'Не удалось отправить письмо с кодом. Попробуйте позже.',
      );
    }
  }
}
