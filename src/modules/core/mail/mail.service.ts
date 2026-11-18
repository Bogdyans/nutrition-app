import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_FAILED_MESSAGE =
  'Не удалось отправить письмо с кодом. Попробуйте позже.';

type MailProvider = 'smtp' | 'resend' | 'log';

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email through the first configured provider:
 *   1. SMTP (SMTP_HOST + SMTP_USER + SMTP_PASSWORD) — e.g. Yandex 360
 *   2. Resend (RESEND_API_KEY), HTTPS API
 *   3. Brevo (BREVO_API_KEY), HTTPS API
 * With nothing configured the code is logged instead of sent (dev fallback).
 *
 * Note: some hosts block outbound SMTP ports (25/465/587). If SMTP times out
 * on the server, use one of the HTTP API providers instead.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly resendKey?: string;
  private readonly smtp?: Transporter;

  constructor(private readonly config: ConfigService) {
    this.resendKey = this.config.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.config.get<string>('MAIL_FROM_EMAIL') ?? 'no-reply@perekusov-net.ru';
    this.fromName =
      this.config.get<string>('MAIL_FROM_NAME') ?? 'Дневник Питания';

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPassword = this.config.get<string>('SMTP_PASSWORD');

    if (smtpHost && smtpUser && smtpPassword) {
      const port = Number(this.config.get<string | number>('SMTP_PORT') ?? 465);
      this.smtp = createTransport({
        host: smtpHost,
        port,
        secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
        auth: { user: smtpUser, pass: smtpPassword },
        // Without timeouts a blocked port would hang the registration request.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      this.provider = 'smtp';

      if (this.fromEmail.toLowerCase() !== smtpUser.toLowerCase()) {
        this.logger.warn(
          'MAIL_FROM_EMAIL не совпадает с SMTP_USER — Яндекс отклонит письма с чужого адреса отправителя.',
        );
      }
    } else if (this.resendKey) {
      this.provider = 'resend';
    } else {
      this.provider = 'log';
      this.logger.warn(
        'Почтовый провайдер не настроен (SMTP_*, RESEND_API_KEY) — письма выводятся в лог (режим разработки).',
      );
    }

    this.logger.log(`Почтовый провайдер: ${this.provider}`);
  }

  /** Checks SMTP connection and credentials at startup without blocking boot. */
  onModuleInit(): void {
    if (!this.smtp) return;

    this.smtp
      .verify()
      .then(() => this.logger.log('SMTP: соединение и авторизация успешны'))
      .catch((error: Error) =>
        this.logger.error(`SMTP недоступен: ${error.message}`),
      );
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const message: MailMessage = {
      to,
      subject: 'Код подтверждения — Дневник Питания',
      text:
        `Ваш код подтверждения: ${code}\n\n` +
        'Введите его в приложении, чтобы завершить регистрацию. ' +
        'Код действителен 15 минут.\n\n' +
        'Если вы не регистрировались, просто проигнорируйте это письмо.',
    };

    switch (this.provider) {
      case 'smtp':
        return this.sendViaSmtp(message);
      case 'resend':
        return this.sendViaApi(
          RESEND_ENDPOINT,
          { Authorization: `Bearer ${this.resendKey}` },
          {
            from: `${this.fromName} <${this.fromEmail}>`,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          },
        );
      case 'log':
        this.logger.warn(`[DEV] Код подтверждения для ${to}: ${code}`);
        return;
    }
  }

  private async sendViaSmtp(message: MailMessage): Promise<void> {
    if (!this.smtp) throw new ServiceUnavailableException(SEND_FAILED_MESSAGE);

    try {
      await this.smtp.sendMail({
        from: { name: this.fromName, address: this.fromEmail },
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      this.logger.error('Сбой SMTP при отправке письма', error as Error);
      throw new ServiceUnavailableException(SEND_FAILED_MESSAGE);
    }
  }

  private async sendViaApi(
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
        throw new ServiceUnavailableException(SEND_FAILED_MESSAGE);
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Сбой при отправке письма', error as Error);
      throw new ServiceUnavailableException(SEND_FAILED_MESSAGE);
    }
  }
}
