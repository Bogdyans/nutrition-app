import { Role } from '@prisma/client';

export type SessionUserDataFromJwt = {
  id: string;
  email: string;
  roles: Role[];
};

export type JwtPayload = SessionUserDataFromJwt & {
  jti: string;
};

export interface RequestWithUser extends Request {
  user: SessionUserDataFromJwt;
}
