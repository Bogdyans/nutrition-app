import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupRole, InvitationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ChatsService } from '../chats/chats.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteDto } from './dto/invite.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatsService: ChatsService,
  ) {}

  private async syncFamilyChatMembers(
    tx: Prisma.TransactionClient,
    groupId: string,
  ) {
    await this.chatsService.syncFamilyChatMembers(tx, groupId);
  }

  private async deleteGroupIfEmpty(
    tx: Prisma.TransactionClient,
    groupId: string,
    chatId: string,
  ) {
    const remainingMembers = await tx.familyGroupMember.count({
      where: { groupId },
    });

    if (remainingMembers > 0) {
      return false;
    }

    await tx.familyGroupInvitation.deleteMany({ where: { groupId } });
    await tx.message.deleteMany({ where: { chatId } });
    await tx.chatMember.deleteMany({ where: { chatId } });
    await tx.familyGroup.delete({ where: { id: groupId } });
    await tx.chat.delete({ where: { id: chatId } });

    return true;
  }

  async createGroup(userId: string, dto: CreateGroupDto) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Название группы не может быть пустым');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.familyGroupMember.findUnique({
        where: { userId },
        select: { userId: true },
      });

      if (existing) {
        throw new BadRequestException('User already in a group');
      }

      const chat = await this.chatsService.createFamilyChat(tx, { name });

      const group = await tx.familyGroup.create({
        data: {
          name,
          chatId: chat.id,
        },
      });

      await tx.familyGroupMember.create({
        data: {
          userId,
          groupId: group.id,
          role: GroupRole.OWNER,
        },
      });

      await this.syncFamilyChatMembers(tx, group.id);

      return group;
    });
  }

  async getMyGroupAndInvitations(userId: string) {
    // 1. Ищем группу, в которой состоит юзер, и вытаскиваем её со всеми связями
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            chatId: true,
            members: {
              select: {
                userId: true,
                groupId: true,
                role: true,
                created_at: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 2. Ищем все активные инвайты, которые были отправлены ЭТОМУ пользователю
    // (В схеме Prisma это связь receivecFamilyGroupInvitation)
    const pendingInvitations = await this.prisma.familyGroupInvitation.findMany(
      {
        where: {
          invitedUserId: userId,
          status: 'PENDING', // Вытаскиваем только со статусом PENDING
        },
        // Если фронтенду внутри инвайта нужны данные о том, КТО пригласил или какая группа:
        include: {
          group: true,
          invitedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    );

    // 3. Возвращаем строго ту структуру, которую ждет интерфейс FamilyMeResponse
    if (!membership) {
      return {
        group: null,
        pendingInvitations,
      };
    }

    return {
      group: membership.group,
      pendingInvitations,
    };
  }

  async createInvitation(userId: string, dto: InviteDto) {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      select: {
        userId: true,
        groupId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not in group');
    }

    if (membership.role === GroupRole.MEMBER) {
      throw new ForbiddenException('No permission');
    }

    if (dto.invitedUserId === userId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    const invitedUser = await this.prisma.user.findFirst({
      where: { id: dto.invitedUserId, deletedAt: null },
      select: { id: true },
    });

    if (!invitedUser) {
      throw new NotFoundException('User not found');
    }

    const invitedMembership = await this.prisma.familyGroupMember.findUnique({
      where: { userId: dto.invitedUserId },
      select: { userId: true },
    });

    if (invitedMembership) {
      throw new BadRequestException('User already in a group');
    }

    return this.prisma.familyGroupInvitation.create({
      data: {
        token: randomUUID(),
        groupId: membership.groupId,
        invitedById: userId,
        invitedUserId: dto.invitedUserId,
        expiresAt: addDays(new Date(), 2),
        status: InvitationStatus.PENDING,
      },
    });
  }

  async acceptInvitation(userId: string, token: string) {
    const existing = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      select: { userId: true },
    });

    if (existing) {
      throw new BadRequestException('Already in group');
    }

    const invitation = await this.prisma.familyGroupInvitation.findUnique({
      where: { token },
      include: {
        group: {
          select: {
            id: true,
            chatId: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invalid invitation status');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation expired');
    }

    if (!invitation.invitedUserId || invitation.invitedUserId !== userId) {
      throw new ForbiddenException('Invitation is not for this user');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.create({
        data: {
          userId,
          groupId: invitation.groupId,
          role: GroupRole.MEMBER,
        },
      });

      await this.syncFamilyChatMembers(tx, invitation.groupId);

      await tx.familyGroupInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      return { success: true };
    });
  }

  async leaveGroup(userId: string) {
    // 1. Ищем мембера и сразу тянем количество участников в этой группе
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      select: {
        userId: true,
        groupId: true,
        role: true,
        group: {
          select: {
            chatId: true,
            _count: {
              select: { members: true }, // Считаем, сколько всего людей в группе
            },
          },
        },
      },
    });

    if (!membership) {
      throw new BadRequestException('Not in group');
    }

    // 2. Если это OWNER, проверяем количество людей в группе
    if (membership.role === GroupRole.OWNER) {
      const totalMembers = membership.group._count.members;

      // Если кроме него кто-то есть — выходить нельзя, пусть передает права
      if (totalMembers > 1) {
        throw new BadRequestException(
          'Owner must transfer ownership before leaving',
        );
      }
    }

    // 3. Запускаем транзакцию удаления
    return this.prisma.$transaction(async (tx) => {
      // Удаляем единственного владельца (или обычного мембера) из таблицы маппинга
      await tx.familyGroupMember.delete({
        where: { userId },
      });

      // Синхронизируем участников чата
      await this.syncFamilyChatMembers(tx, membership.groupId);

      // Этот метод теперь сработает триггером: так как участников стало 0,
      // он полностью удалит запись группы из family_groups и связанный чат
      await this.deleteGroupIfEmpty(
        tx,
        membership.groupId,
        membership.group.chatId,
      );

      return { success: true };
    });
  }

  async removeMember(currentUserId: string, targetUserId: string) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      select: {
        userId: true,
        groupId: true,
        role: true,
        group: {
          select: {
            chatId: true,
          },
        },
      },
    });

    if (!current || current.role === GroupRole.MEMBER) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: targetUserId },
      select: {
        userId: true,
        groupId: true,
        role: true,
      },
    });

    if (!target || target.groupId !== current.groupId) {
      throw new NotFoundException();
    }

    if (target.role === GroupRole.OWNER) {
      throw new BadRequestException('Cannot remove owner');
    }

    if (target.role === GroupRole.ADMIN && current.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only owner can remove admin');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.delete({
        where: { userId: targetUserId },
      });

      await this.syncFamilyChatMembers(tx, current.groupId);

      await this.deleteGroupIfEmpty(tx, current.groupId, current.group.chatId);

      return { success: true };
    });
  }

  async updateRole(currentUserId: string, dto: UpdateRoleDto) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      select: {
        userId: true,
        groupId: true,
        role: true,
        group: {
          select: {
            chatId: true,
          },
        },
      },
    });

    if (!current || current.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only owner');
    }

    if (dto.userId === currentUserId) {
      throw new BadRequestException('Use transferOwnership instead');
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: dto.userId },
      select: {
        userId: true,
        groupId: true,
        role: true,
      },
    });

    if (!target || target.groupId !== current.groupId) {
      throw new NotFoundException();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.update({
        where: { userId: dto.userId },
        data: {
          role: dto.role,
        },
      });

      await this.syncFamilyChatMembers(tx, current.groupId);
    });

    return { success: true };
  }

  async transferOwnership(currentUserId: string, newOwnerId: string) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      select: {
        userId: true,
        groupId: true,
        role: true,
        group: {
          select: {
            chatId: true,
          },
        },
      },
    });

    if (!current || current.role !== GroupRole.OWNER) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: newOwnerId },
      select: {
        userId: true,
        groupId: true,
        role: true,
      },
    });

    if (!target || target.groupId !== current.groupId) {
      throw new NotFoundException();
    }

    if (newOwnerId === currentUserId) {
      throw new BadRequestException('Already owner');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.update({
        where: { userId: currentUserId },
        data: {
          role: GroupRole.ADMIN,
        },
      });

      await tx.familyGroupMember.update({
        where: { userId: newOwnerId },
        data: {
          role: GroupRole.OWNER,
        },
      });

      await this.syncFamilyChatMembers(tx, current.groupId);

      return { success: true };
    });
  }
}
