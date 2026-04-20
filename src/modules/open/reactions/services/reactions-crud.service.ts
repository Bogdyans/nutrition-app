import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateReactionDto } from '../dto/add-reaction.dto';
import { UpdateReactionDto } from '../dto/update-reaction.dto';

@Injectable()
export class ReactionsCRUDService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReactionDto) {
    return this.prisma.reaction.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.reaction.findMany({
      where: { userId },
      orderBy: { name: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateReactionDto) {
    const reaction = await this.prisma.reaction.findFirst({
      where: { id, userId },
    });

    if (!reaction) throw new NotFoundException();

    return this.prisma.reaction.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async remove(userId: string, id: string) {
    const reaction = await this.prisma.reaction.findFirst({
      where: { id, userId },
    });

    if (!reaction) throw new NotFoundException();

    return this.prisma.reaction.delete({
      where: { id },
    });
  }
}
