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

  private async updateCurrentWeightIfLatest(
    tx: Prisma.TransactionClient,
    userId: string,
    weightInKg: number,
    measuredAt: Date,
  ) {
    const latest = await tx.weightHistory.findFirst({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      select: { measuredAt: true },
    });

    if (!latest || measuredAt >= latest.measuredAt) {
      await tx.user.update({
        where: { id: userId },
        data: { currentWeight: weightInKg },
      });
    }
  }

  async create(userId: string, dto: CreateWeightRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      const measuredAt = normalizeDate(dto.measuredAt);

      try {
        const newRecord = await tx.weightHistory.create({
          data: {
            userId,
            weightInKg: dto.weightInKg,
            measuredAt,
          },
        });

        await this.updateCurrentWeightIfLatest(
          tx,
          userId,
          dto.weightInKg,
          measuredAt,
        );

        return newRecord;
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

  async findAll(userId: string, take = 50, skip = 0) {
    return this.prisma.weightHistory.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      take,
      skip,
    });
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

        await this.updateCurrentWeightIfLatest(
          tx,
          userId,
          updated.weightInKg,
          measuredAt,
        );

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

      const latest = await tx.weightHistory.findFirst({
        where: { userId },
        orderBy: { measuredAt: 'desc' },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          currentWeight: latest ? latest.weightInKg : null,
        },
      });

      return { success: true };
    });
  }
}
