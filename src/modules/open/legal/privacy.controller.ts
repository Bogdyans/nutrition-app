import { Controller, Get, Header } from '@nestjs/common';
import { PRIVACY_POLICY_HTML } from './privacy.page';

/**
 * Public privacy policy page (GET /privacy). Excluded from the global `api`
 * prefix in main.ts so the URL is https://perekusov-net.ru/privacy — the link
 * used in the app and required by app stores.
 */
@Controller('privacy')
export class PrivacyController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacyPolicy(): string {
    return PRIVACY_POLICY_HTML;
  }
}
