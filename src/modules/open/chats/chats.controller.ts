import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { SessionUserDataFromJwt } from '../../core/auth/types';
import { ChatsService } from './chats.service';
import { CreatePrivateChatDto } from './dto/create-private-chat.dto';
import { CreateConsultationChatDto } from './dto/create-consultation-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { SearchMessagesDto } from './dto/search-messages.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { ChatsGateway } from './chats.gateway';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsGateway: ChatsGateway,
  ) {}

  @Get()
  listMyChats(@CurrentUser() user: SessionUserDataFromJwt) {
    return this.chatsService.listMyChats(user.id);
  }

  @Post('private')
  createPrivateChat(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreatePrivateChatDto,
  ) {
    return this.chatsService.createPrivateChat(user.id, dto);
  }

  @Post('consultation')
  createConsultationChat(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Body() dto: CreateConsultationChatDto,
  ) {
    return this.chatsService.createConsultationChat(user.id, dto);
  }

  @Get(':chatId')
  getChat(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
  ) {
    return this.chatsService.getChat(user.id, chatId);
  }

  @Get(':chatId/messages')
  getMessages(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatsService.getMessages(user.id, chatId, dto.take, dto.cursor);
  }

  @Get(':chatId/messages/search')
  searchMessages(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Query() dto: SearchMessagesDto,
  ) {
    return this.chatsService.searchMessages(user.id, chatId, dto);
  }

  @Post(':chatId/messages')
  async sendMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatsService.sendMessage(user.id, chatId, dto);
    this.chatsGateway.emitToChat(chatId, 'message:new', message, user.id);
    return message;
  }

  @Patch(':chatId/messages/:messageId')
  async updateMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    const message = await this.chatsService.updateMessage(
      user.id,
      chatId,
      messageId,
      dto,
    );
    this.chatsGateway.emitToChat(chatId, 'message:updated', message, user.id);
    return message;
  }

  @Delete(':chatId/messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    const message = await this.chatsService.deleteMessage(
      user.id,
      chatId,
      messageId,
    );
    this.chatsGateway.emitToChat(chatId, 'message:deleted', message, user.id);
    return message;
  }
}
