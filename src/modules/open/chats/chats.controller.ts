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

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

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
  sendMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatsService.sendMessage(user.id, chatId, dto);
  }

  @Patch(':chatId/messages/:messageId')
  updateMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatsService.updateMessage(user.id, chatId, messageId, dto);
  }

  @Delete(':chatId/messages/:messageId')
  deleteMessage(
    @CurrentUser() user: SessionUserDataFromJwt,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatsService.deleteMessage(user.id, chatId, messageId);
  }
}
