import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateWeightRecordDto } from './dto/create-weight-record.dto';
import { UpdateWeightRecordDto } from './dto/update-weight-record.dto';
import { Prisma } from '@prisma/client';
import { normalizeDate } from '../../../shared/utils/date';

@Injectable()
export class WeightHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Всегда пересчитываем currentWeight из БД
   * → устраняет любые рассинхронизации
   */
  private async recomputeCurrentWeight(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const latest = await tx.weightHistory.findFirst({
      where: { userId },
      orderBy: [
        { measuredAt: 'desc' },
        { id: 'desc' }, // стабильность
      ],
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        currentWeight: latest ? latest.weightInKg : null,
      },
    });
  }

  async create(userId: string, dto: CreateWeightRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      const measuredAt = normalizeDate(
        dto.measuredAt ?? new Date().toISOString(),
      );

      // Используем upsert для автоматического создания или обновления
      const record = await tx.weightHistory.upsert({
        where: {
          // Предполагается стандартный составной уникальный ключ в Prisma schema:
          // @@unique([userId, measuredAt])
          userId_measuredAt: {
            userId,
            measuredAt,
          },
        },
        update: {
          weightInKg: dto.weightInKg, // Если запись найдена, просто перезаписываем вес
        },
        create: {
          userId,
          weightInKg: dto.weightInKg, // Если записи нет, создаем новую
          measuredAt,
        },
      });

      // Пересчитываем текущий вес пользователя (сработает корректно и при создании, и при обновлении)
      await this.recomputeCurrentWeight(tx, userId);

      return record;
    });
  }

  /**
   * Cursor-based pagination
   */
  async findAll(userId: string, take = 30, cursor?: string) {
    const records = await this.prisma.weightHistory.findMany({
      where: { userId },
      orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasNextPage = records.length > take;
    const data = hasNextPage ? records.slice(0, take) : records;

    return {
      data,
      nextCursor: hasNextPage ? data[data.length - 1].id : null,
    };
  }

  async update(userId: string, id: string, dto: UpdateWeightRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.weightHistory.findFirst({
        where: { id, userId },
      });

      if (!record) throw new NotFoundException('Запись не найдена');

      const measuredAt = dto.measuredAt
        ? normalizeDate(dto.measuredAt)
        : record.measuredAt;

      try {
        const updated = await tx.weightHistory.update({
          where: { id },
          data: {
            ...(dto.weightInKg !== undefined && {
              weightInKg: dto.weightInKg,
            }),
            ...(dto.measuredAt && {
              measuredAt,
            }),
          },
        });

        await this.recomputeCurrentWeight(tx, userId);

        return updated;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException('Запись веса на эту дату уже существует');
        }
        throw e;
      }
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.weightHistory.findFirst({
        where: { id, userId },
      });

      if (!record) throw new NotFoundException('Запись не найдена');

      await tx.weightHistory.delete({
        where: { id },
      });

      await this.recomputeCurrentWeight(tx, userId);

      return { success: true };
    });
  }
}
