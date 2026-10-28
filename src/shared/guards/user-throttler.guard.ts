import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUserDataFromJwt } from '../../modules/core/auth/types';

type TrackedRequest = Partial<Request> & {
  user?: SessionUserDataFromJwt;
};

/**
 * Rate-limits by authenticated user id instead of IP, so the budget is
 * per-account (several users behind one NAT don't share it, and one user can't
 * dodge the limit by switching networks). Falls back to IP when there is no
 * authenticated user. Must run *after* the auth guard so `req.user` is set.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackedRequest): Promise<string> {
    return Promise.resolve(req.user?.id ?? req.ip ?? 'unknown');
  }
}
