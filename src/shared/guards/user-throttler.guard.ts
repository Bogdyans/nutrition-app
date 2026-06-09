import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits by authenticated user id instead of IP, so the budget is
 * per-account (several users behind one NAT don't share it, and one user can't
 * dodge the limit by switching networks). Falls back to IP when there is no
 * authenticated user. Must run *after* the auth guard so `req.user` is set.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(req.user?.id ?? req.ip);
  }
}
