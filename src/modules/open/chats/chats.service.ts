import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatRole, ChatType, GroupRole, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreatePrivateChatDto } from './dto/create-private-chat.dto';
import { CreateConsultationChatDto } from './dto/create-consultation-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';

type PrismaLike = PrismaService | Prisma.TransactionClient;
type ChatMemberRecord = {
  userId: string;
  role: ChatRole;
  user: { id: string; username: string; email: string; createdAt: Date };
};
type ChatMessageRecord = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  sender: { id: string; username: string };
};
type ChatSummaryRecord = {
  id: string;
  name: string | null;
  type: ChatType;
  chatMembers: ChatMemberRecord[];
  messages: ChatMessageRecord[];
};

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly chatMemberSelect = {
    userId: true,
    role: true,
    user: {
      select: { id: true, username: true, email: true, createdAt: true },
    },
  } as const;
  private readonly messageSelect = {
    id: true,
    chatId: true,
    senderId: true,
    content: true,
    createdAt: true,
    deletedAt: true,
    sender: { select: { id: true, username: true } },
  } as const;

  private async ensureUserExists(client: PrismaLike, userId: string) {
    const user = await client.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return user;
  }

  private async ensureChatParticipant(
    client: PrismaLike,
    chatId: string,
    userId: string,
  ) {
    const membership = await client.chatMember.findFirst({
      where: { chatId, userId },
      select: { chatId: true, userId: true, role: true },
    });
    if (!membership) {
      throw new ForbiddenException('Нет доступа к чату');
    }
    return membership;
  }

  private serializeMessage(message: ChatMessageRecord) {
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      sender: message.sender,
      content: message.deletedAt ? null : message.content,
      createdAt: message.createdAt,
      deletedAt: message.deletedAt,
      isDeleted: Boolean(message.deletedAt),
    };
  }

  private serializeChat(chat: ChatSummaryRecord) {
    const lastMessage = chat.messages[0]
      ? this.serializeMessage(chat.messages[0])
      : null;
    return {
      id: chat.id,
      name: chat.name,
      type: chat.type,
      participants: chat.chatMembers.map((member) => ({
        userId: member.userId,
        role: member.role,
        user: member.user,
      })),
      lastMessage,
      lastMessageAt: chat.messages[0]?.createdAt ?? null,
    };
  }

  async createPrivateChat(userId: string, dto: CreatePrivateChatDto) {
    if (userId === dto.targetUserId) {
      throw new BadRequestException('Нельзя создать чат с самим собой');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureUserExists(tx, userId);
      await this.ensureUserExists(tx, dto.targetUserId);
      const existingChats = await tx.chat.findMany({
        where: {
          type: ChatType.PRIVATE,
          chatMembers: { some: { userId } },
          AND: [{ chatMembers: { some: { userId: dto.targetUserId } } }],
        },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      const existing = existingChats.find(
        (chat) => chat.chatMembers.length === 2,
      );
      if (existing) {
        return this.serializeChat(existing);
      }
      const chat = await tx.chat.create({
        data: { type: ChatType.PRIVATE, name: null },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      await tx.chatMember.createMany({
        data: [
          { chatId: chat.id, userId, role: ChatRole.MEMBER },
          {
            chatId: chat.id,
            userId: dto.targetUserId,
            role: ChatRole.MEMBER,
          },
        ],
      });
      const loaded = await tx.chat.findUniqueOrThrow({
        where: { id: chat.id },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      return this.serializeChat(loaded);
    });
  }

  async checkChatAccess(chatId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
      select: { chatId: true },
    });
    return !!membership;
  }

  async createConsultationChat(userId: string, dto: CreateConsultationChatDto) {
    if (userId === dto.consultantId) {
      throw new BadRequestException('Нельзя создать чат с самим собой');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureUserExists(tx, userId);
      const consultant = await tx.user.findFirst({
        where: { id: dto.consultantId, deletedAt: null },
        select: {
          id: true,
          username: true,
          userRoles: { select: { role: true } },
        },
      });
      if (!consultant) {
        throw new NotFoundException('Консультант не найден');
      }
      const hasNutritionistRole = consultant.userRoles.some(
        (userRole) => userRole.role === Role.NUTRITIONIST,
      );
      if (!hasNutritionistRole) {
        throw new BadRequestException('Пользователь не является консультантом');
      }
      const existingChats = await tx.chat.findMany({
        where: {
          type: ChatType.CONSULTATION,
          chatMembers: { some: { userId } },
          AND: [{ chatMembers: { some: { userId: dto.consultantId } } }],
        },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      const existing = existingChats.find(
        (chat) => chat.chatMembers.length === 2,
      );
      if (existing) {
        return this.serializeChat(existing);
      }
      const chat = await tx.chat.create({
        data: {
          type: ChatType.CONSULTATION,
          name: `Консультация: ${consultant.username}`,
        },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      await tx.chatMember.createMany({
        data: [
          { chatId: chat.id, userId, role: ChatRole.MEMBER },
          {
            chatId: chat.id,
            userId: dto.consultantId,
            role: ChatRole.ADMIN,
          },
        ],
      });
      const loaded = await tx.chat.findUniqueOrThrow({
        where: { id: chat.id },
        select: {
          id: true,
          name: true,
          type: true,
          chatMembers: { select: this.chatMemberSelect },
          messages: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: this.messageSelect,
          },
        },
      });
      return this.serializeChat(loaded);
    });
  }

  async createFamilyChat(
    tx: Prisma.TransactionClient,
    input: { name: string },
  ) {
    return tx.chat.create({
      data: {
        type: ChatType.FAMILY,
        name: input.name,
      },
      select: { id: true },
    });
  }

  async syncFamilyChatMembers(tx: Prisma.TransactionClient, groupId: string) {
    const group = await tx.familyGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        chatId: true,
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Семейная группа не найдена');
    }

    await tx.chatMember.deleteMany({
      where: { chatId: group.chatId },
    });

    if (group.members.length === 0) {
      return;
    }

    await tx.chatMember.createMany({
      data: group.members.map((member) => ({
        chatId: group.chatId,
        userId: member.userId,
        role:
          member.role === GroupRole.MEMBER ? ChatRole.MEMBER : ChatRole.ADMIN,
      })),
    });
  }

  async listMyChats(userId: string) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      select: {
        role: true,
        chat: {
          select: {
            id: true,
            name: true,
            type: true,
            chatMembers: { select: this.chatMemberSelect },
            messages: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: this.messageSelect,
            },
          },
        },
      },
    });
    const chats = memberships
      .map((membership) => ({
        ...this.serializeChat(membership.chat),
        myRole: membership.role,
      }))
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    return chats;
  }

  async getChat(userId: string, chatId: string) {
    await this.ensureChatParticipant(this.prisma, chatId, userId);
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        name: true,
        type: true,
        chatMembers: { select: this.chatMemberSelect },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: this.messageSelect,
        },
      },
    });
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }
    return this.serializeChat(chat);
  }

  async getMessages(
    userId: string,
    chatId: string,
    take = 20,
    cursor?: string,
  ) {
    await this.ensureChatParticipant(this.prisma, chatId, userId);
    const messages = await this.prisma.message.findMany({
      where: { chatId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: this.messageSelect,
    });
    const hasNextPage = messages.length > take;
    const data = hasNextPage ? messages.slice(0, take) : messages;
    return {
      data: data.map((message) => this.serializeMessage(message)),
      nextCursor: hasNextPage ? data[data.length - 1].id : null,
      hasNextPage,
    };
  }

  async searchMessages(userId: string, chatId: string, dto: SearchMessagesDto) {
    await this.ensureChatParticipant(this.prisma, chatId, userId);

    const query = dto.q.trim();

    if (!query) {
      throw new BadRequestException('Поисковый запрос не может быть пустым');
    }

    const take = dto.take ?? 20;

    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        content: { contains: query, mode: 'insensitive' },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      select: this.messageSelect,
    });

    const hasNextPage = messages.length > take;
    const data = hasNextPage ? messages.slice(0, take) : messages;

    return {
      data: data.map((message) => this.serializeMessage(message)),
      nextCursor: hasNextPage ? data[data.length - 1].id : null,
      hasNextPage,
    };
  }

  async sendMessage(userId: string, chatId: string, dto: SendMessageDto) {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }
    await this.ensureChatParticipant(this.prisma, chatId, userId);
    const message = await this.prisma.message.create({
      data: { chatId, senderId: userId, content },
      select: this.messageSelect,
    });
    return this.serializeMessage(message);
  }

  async updateMessage(
    userId: string,
    chatId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        chatId,
        senderId: userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Сообщение не может быть пустым');
    }
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content },
      select: this.messageSelect,
    });
    return this.serializeMessage(updated);
  }

  async deleteMessage(userId: string, chatId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        chatId,
        senderId: userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: this.messageSelect,
    });
    return this.serializeMessage(deleted);
  }
}
