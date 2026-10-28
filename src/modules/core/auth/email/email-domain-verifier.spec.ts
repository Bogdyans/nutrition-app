jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
    lookup: jest.fn(),
  },
}));

import { promises as dns } from 'dns';
import { EmailDomainVerifier } from './email-domain-verifier.service';

const resolveMx = dns.resolveMx as jest.Mock;
const lookup = dns.lookup as jest.Mock;

const dnsError = (code: string) => Object.assign(new Error(code), { code });

describe('EmailDomainVerifier', () => {
  let verifier: EmailDomainVerifier;

  beforeEach(() => {
    jest.clearAllMocks();
    verifier = new EmailDomainVerifier();
  });

  it('accepts an address whose domain advertises MX records', async () => {
    resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);

    await expect(verifier.isDeliverable('user@example.com')).resolves.toBe(
      true,
    );
    expect(resolveMx).toHaveBeenCalledWith('example.com');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects an address whose domain does not exist', async () => {
    resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));

    await expect(verifier.isDeliverable('user@nope.invalid')).resolves.toBe(
      false,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('falls back to an address record when the domain has no MX', async () => {
    resolveMx.mockRejectedValue(dnsError('ENODATA'));
    lookup.mockResolvedValue({ address: '1.2.3.4', family: 4 });

    await expect(
      verifier.isDeliverable('user@a-record-only.com'),
    ).resolves.toBe(true);
    expect(lookup).toHaveBeenCalledWith('a-record-only.com');
  });

  it('rejects when the domain has neither MX nor address records', async () => {
    resolveMx.mockResolvedValue([]); // resolves, but no usable exchanger
    lookup.mockRejectedValue(dnsError('ENODATA'));

    await expect(verifier.isDeliverable('user@empty.com')).resolves.toBe(false);
  });

  it('fails open on transient resolver errors', async () => {
    resolveMx.mockRejectedValue(dnsError('ETIMEOUT'));

    await expect(verifier.isDeliverable('user@flaky.com')).resolves.toBe(true);
  });

  it('rejects a malformed address with no domain without touching DNS', async () => {
    await expect(verifier.isDeliverable('not-an-email')).resolves.toBe(false);
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it('normalizes the domain to lower case before lookup', async () => {
    resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);

    await verifier.isDeliverable('User@Example.COM');
    expect(resolveMx).toHaveBeenCalledWith('example.com');
  });
});
