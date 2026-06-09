import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateReactionDto } from '../dto/add-reaction.dto';
import { UpdateReactionDto } from '../dto/update-reaction.dto';

@Injectable()
export class ReactionsCRUDService {
  constructor(private prisma: PrismaService) {}

  private static readonly MAX_REACTIONS_PER_USER = 10;

  async create(userId: string, dto: CreateReactionDto) {
    const count = await this.prisma.reaction.count({ where: { userId } });

    if (count >= ReactionsCRUDService.MAX_REACTIONS_PER_USER) {
      throw new BadRequestException(
        `Можно создать не более ${ReactionsCRUDService.MAX_REACTIONS_PER_USER} реакций`,
      );
    }

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

    if (!reaction) {
      throw new NotFoundException();
    }

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
      include: {
        mealReactions: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!reaction) {
      throw new NotFoundException();
    }

    if (reaction.mealReactions.length > 0) {
      throw new BadRequestException(
        'Reaction is already used in meals and cannot be deleted',
      );
    }

    return this.prisma.reaction.delete({
      where: { id },
    });
  }
}
