import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { normalizeDate } from '../../../shared/utils/date';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        username: true,
        gender: true,
        birthDate: true,
        heightCm: true,
        currentWeight: true,
        activityLevel: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('Профиль не найден');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const birthDate = dto.birthDate ? normalizeDate(dto.birthDate) : undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(birthDate && { birthDate }),
        ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        ...(dto.activityLevel && { activityLevel: dto.activityLevel }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        gender: true,
        birthDate: true,
        heightCm: true,
        currentWeight: true,
        activityLevel: true,
      },
    });
  }

  async changePassword(
    userId: string,
    currentTokenId: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) throw new NotFoundException('Профиль не найден');

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) throw new BadRequestException('Неверный текущий пароль');

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Отзываем ВСЕ рефреш-токены, кроме текущей сессии
      await tx.refreshToken.updateMany({
        where: {
          userId,
          id: { not: currentTokenId }, // Исключаем текущий токен
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return {
        success: true,
        message: 'Пароль успешно изменен. Остальные сессии завершены.',
      };
    });
  }

  async deleteAccount(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { success: true, message: 'Аккаунт успешно удален' };
    });
  }
}
