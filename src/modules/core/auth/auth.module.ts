import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../../main/users/users.module';
import { TokenService } from './token/token.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), PrismaModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, TokenService],
  exports: [AuthService],
})
export class AuthModule {}
