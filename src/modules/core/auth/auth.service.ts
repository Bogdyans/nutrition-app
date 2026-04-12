import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { SessionUserDataFromJwt } from './types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import { UsersService } from '../../closed/users/users.service';
import { TokenService } from './token/token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  private toSessionUser(
    user: User & { userRoles: UserRole[] },
  ): SessionUserDataFromJwt {
    return {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role),
    };
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      username: dto.username,
    });

    const tokens = await this.tokenService.generateTokens(
      this.toSessionUser(user),
    );
    return { user: this.toSessionUser(user), ...tokens };
  }

  async validateLocalUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.toSessionUser(user);
  }

  async issueTokens(user: SessionUserDataFromJwt) {
    const tokens = await this.tokenService.generateTokens(user);
    return { user, ...tokens };
  }

  async refresh(refreshToken: string) {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    // Ищем конкретный токен по jti
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti, revokedAt: null },
    });

    if (!tokenRecord) throw new UnauthorizedException('Invalid token');

    const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (!isMatch) throw new UnauthorizedException('Invalid token');

    const user = await this.usersService.findById(payload.id);
    if (!user) throw new UnauthorizedException('User not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });
      return this.tokenService.generateTokens(this.toSessionUser(user));
    });
  }

  async logout(refreshToken: string) {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti, revokedAt: null },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Token already revoked or invalid');
    }

    const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (isMatch) {
      await this.tokenService.revokeToken(tokenRecord.id);
      return { message: 'Logged out successfully' };
    }

    throw new UnauthorizedException('Invalid token');
  }
}
