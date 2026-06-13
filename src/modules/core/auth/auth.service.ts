import {
  BadRequestException,
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
import { EmailDomainVerifier } from './email/email-domain-verifier.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly emailVerifier: EmailDomainVerifier,
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
    if (exists) throw new ConflictException('Эта почта уже используется');

    // Reject non-existent domains / typos before doing any expensive work.
    const deliverable = await this.emailVerifier.isDeliverable(dto.email);
    if (!deliverable) {
      throw new BadRequestException(
        'Похоже, такого адреса электронной почты не существует. Проверьте правильность написания.',
      );
    }

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
    if (!user) throw new UnauthorizedException('Неверный логин или пароль');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');

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

    if (!tokenRecord) throw new UnauthorizedException('Недействительный токен');

    const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (!isMatch) throw new UnauthorizedException('Недействительный токен');

    const user = await this.usersService.findById(payload.id);
    if (!user) throw new UnauthorizedException('Пользователь не найден');

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
      throw new UnauthorizedException('Токен уже отозван или недействителен');
    }

    const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (isMatch) {
      await this.tokenService.revokeToken(tokenRecord.id);
      return { message: 'Вы успешно вышли из системы' };
    }

    throw new UnauthorizedException('Недействительный токен');
  }
}
