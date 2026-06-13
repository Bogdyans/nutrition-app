import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';

type MxLookupResult = 'has-mx' | 'no-records' | 'no-domain' | 'lookup-failed';

/**
 * Checks whether an email address can plausibly receive mail by inspecting the
 * DNS records of its domain.
 *
 * This is a lightweight existence check, not a guarantee. It confirms that the
 * domain exists and advertises a mail exchanger (or, failing that, an address
 * record — which RFC 5321 §5.1 treats as an implicit MX). It deliberately does
 * not open an SMTP session or probe the specific mailbox: reliable mailbox
 * verification is only possible via a confirmation email. The goal is to reject
 * obvious mistakes at registration time — non-existent domains and typos such
 * as "user@gmial.con".
 */
@Injectable()
export class EmailDomainVerifier {
  private readonly logger = new Logger(EmailDomainVerifier.name);

  /**
   * Resolves to `true` when the domain can accept mail, `false` when it
   * definitively cannot (the domain does not exist, or has neither MX nor
   * address records).
   *
   * Transient resolver failures fail open (return `true`): a flaky DNS lookup
   * on our side must never block a legitimate sign-up.
   */
  async isDeliverable(email: string): Promise<boolean> {
    const domain = this.extractDomain(email);
    if (!domain) return false;

    const mx = await this.lookupMx(domain);

    if (mx === 'has-mx') return true;
    if (mx === 'no-domain') return false;
    // No MX record, but an A/AAAA record still permits delivery (implicit MX).
    if (mx === 'no-records') return this.hasAddressRecord(domain);

    // 'lookup-failed' — transient DNS error: fail open.
    return true;
  }

  private extractDomain(email: string): string | null {
    const at = email.lastIndexOf('@');
    if (at === -1) return null;

    const domain = email.slice(at + 1).trim().toLowerCase();
    return domain.length > 0 ? domain : null;
  }

  private async lookupMx(domain: string): Promise<MxLookupResult> {
    try {
      const records = await dns.resolveMx(domain);
      return records.some((record) => record.exchange.length > 0)
        ? 'has-mx'
        : 'no-records';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ENOTFOUND') return 'no-domain';
      if (code === 'ENODATA') return 'no-records';

      this.logger.warn(
        `MX lookup for "${domain}" failed (${code ?? 'unknown error'}); ` +
          'allowing registration to proceed.',
      );
      return 'lookup-failed';
    }
  }

  private async hasAddressRecord(domain: string): Promise<boolean> {
    try {
      await dns.lookup(domain);
      return true;
    } catch {
      return false;
    }
  }
}
