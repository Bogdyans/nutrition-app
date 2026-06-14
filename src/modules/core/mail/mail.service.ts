import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends email via a transactional HTTP API (HTTPS:443) — Resend or Brevo,
 * whichever key is configured.
 *
 * An HTTP API is used instead of SMTP because the host blocks outbound SMTP
 * ports (25/465/587), a common cloud restriction, while HTTPS is open.
 *
 * With neither key set the code is logged instead of sent (dev fallback).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendKey?: string;
  private readonly brevoKey?: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.resendKey = this.config.get<string>('RESEND_API_KEY');
    this.brevoKey = this.config.get<string>('BREVO_API_KEY');
    this.fromEmail =
      this.config.get<string>('MAIL_FROM_EMAIL') ?? 'no-reply@perekusov-net.ru';
    this.fromName =
      this.config.get<string>('MAIL_FROM_NAME') ?? 'Дневник Питания';

    if (!this.resendKey && !this.brevoKey) {
      this.logger.warn(
        'RESEND_API_KEY/BREVO_API_KEY не заданы — письма выводятся в лог (режим разработки).',
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

    if (this.resendKey) {
      return this.send(
        RESEND_ENDPOINT,
        { Authorization: `Bearer ${this.resendKey}` },
        {
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [to],
          subject,
          text,
        },
      );
    }

    if (this.brevoKey) {
      return this.send(
        BREVO_ENDPOINT,
        { 'api-key': this.brevoKey },
        {
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject,
          textContent: text,
        },
      );
    }

    this.logger.warn(`[DEV] Код подтверждения для ${to}: ${code}`);
  }

  private async send(
    url: string,
    authHeaders: Record<string, string>,
    body: unknown,
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(`Email API ${url} → ${response.status}: ${detail}`);
        throw new ServiceUnavailableException(
          'Не удалось отправить письмо с кодом. Попробуйте позже.',
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Сбой при отправке письма', error as Error);
      throw new ServiceUnavailableException(
        'Не удалось отправить письмо с кодом. Попробуйте позже.',
      );
    }
  }
}
