import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteDto } from './dto/invite.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import {
  ChatRole,
  GroupRole,
  InvitationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class FamilyService {
  constructor(private prisma: PrismaService) {}

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

  // ==============================
  // CREATE GROUP
  // ==============================
  async createGroup(userId: string, dto: CreateGroupDto) {
    const existing = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('User already in a group');
    }

    return this.prisma.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          type: 'GROUP',
          name: dto.name,
        },
      });

      const group = await tx.familyGroup.create({
        data: {
          name: dto.name,
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

      await tx.chatMember.create({
        data: {
          chatId: chat.id,
          userId,
          role: ChatRole.ADMIN,
        },
      });

      return group;
    });
  }

  // ==============================
  // GET MY GROUP
  // ==============================
  async getMyGroup(userId: string) {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!membership) return null;

    return membership.group;
  }

  // ==============================
  // INVITE
  // ==============================
  async createInvitation(userId: string, dto: InviteDto) {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
    });

    if (!membership) throw new ForbiddenException('Not in group');

    if (membership.role === GroupRole.MEMBER) {
      throw new ForbiddenException('No permission');
    }

    if (dto.invitedUserId === userId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    const invitedUser = await this.prisma.user.findUnique({
      where: { id: dto.invitedUserId },
    });

    if (!invitedUser) {
      throw new NotFoundException('User not found');
    }

    const invitedMembership = await this.prisma.familyGroupMember.findUnique({
      where: { userId: dto.invitedUserId },
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
      },
    });
  }

  // ==============================
  // ACCEPT INVITE
  // ==============================
  async acceptInvitation(userId: string, token: string) {
    const existing = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('Already in group');
    }

    const invitation = await this.prisma.familyGroupInvitation.findUnique({
      where: { token },
      include: {
        group: true,
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
        },
      });

      await tx.chatMember.create({
        data: {
          chatId: invitation.group.chatId,
          userId,
          role: ChatRole.MEMBER,
        },
      });

      await tx.familyGroupInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      return { success: true };
    });
  }

  // ==============================
  // LEAVE GROUP
  // ==============================
  async leaveGroup(userId: string) {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId },
      include: { group: true },
    });

    if (!membership) {
      throw new BadRequestException('Not in group');
    }

    if (membership.role === GroupRole.OWNER) {
      throw new BadRequestException('Owner must transfer ownership');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.familyGroupMember.delete({
        where: {
          userId_groupId: {
            userId,
            groupId: membership.groupId,
          },
        },
      });

      await tx.chatMember.delete({
        where: {
          chatId_userId: {
            chatId: membership.group.chatId,
            userId,
          },
        },
      });

      await this.deleteGroupIfEmpty(tx, membership.groupId, membership.group.chatId);

      return { success: true };
    });
  }

  // ==============================
  // REMOVE MEMBER
  // ==============================
  async removeMember(currentUserId: string, targetUserId: string) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      include: { group: true },
    });

    if (!current || current.role === GroupRole.MEMBER) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: targetUserId },
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
        where: {
          userId_groupId: {
            userId: targetUserId,
            groupId: current.groupId,
          },
        },
      });

      await tx.chatMember.delete({
        where: {
          chatId_userId: {
            chatId: current.group.chatId,
            userId: targetUserId,
          },
        },
      });

      await this.deleteGroupIfEmpty(tx, current.groupId, current.group.chatId);

      return { success: true };
    });
  }

  // ==============================
  // UPDATE ROLE
  // ==============================
  async updateRole(currentUserId: string, dto: UpdateRoleDto) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      include: { group: true },
    });

    if (!current || current.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only owner');
    }

    if (dto.userId === currentUserId) {
      throw new BadRequestException('Use transferOwnership instead');
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: dto.userId },
    });

    if (!target || target.groupId !== current.groupId) {
      throw new NotFoundException();
    }

    await this.prisma.familyGroupMember.update({
      where: {
        userId_groupId: {
          userId: dto.userId,
          groupId: current.groupId,
        },
      },
      data: {
        role: dto.role,
      },
    });

    return { success: true };
  }

  // ==============================
  // TRANSFER OWNERSHIP
  // ==============================
  async transferOwnership(currentUserId: string, newOwnerId: string) {
    const current = await this.prisma.familyGroupMember.findUnique({
      where: { userId: currentUserId },
      include: { group: true },
    });

    if (!current || current.role !== GroupRole.OWNER) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.familyGroupMember.findUnique({
      where: { userId: newOwnerId },
    });

    if (!target || target.groupId !== current.groupId) {
      throw new NotFoundException();
    }

    if (newOwnerId === currentUserId) {
      throw new BadRequestException('Already owner');
    }

    await this.prisma.$transaction([
      this.prisma.familyGroupMember.update({
        where: {
          userId_groupId: {
            userId: currentUserId,
            groupId: current.groupId,
          },
        },
        data: { role: GroupRole.ADMIN },
      }),
      this.prisma.familyGroupMember.update({
        where: {
          userId_groupId: {
            userId: newOwnerId,
            groupId: current.groupId,
          },
        },
        data: { role: GroupRole.OWNER },
      }),
    ]);

    return { success: true };
  }
}
