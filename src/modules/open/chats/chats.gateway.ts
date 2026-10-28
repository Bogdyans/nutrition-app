import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { SessionUserDataFromJwt } from '../../core/auth/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthSocket extends Socket {
  user: SessionUserDataFromJwt;
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

@WebSocketGateway({
  namespace: 'chats',
  cors: { origin: '*', credentials: true },
  transports: ['websocket'],
})
export class ChatsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatsGateway.name);

  /**
   * userId → Set<socketId>
   *
   * Tracks all open sockets per user so we can exclude the message sender
   * from broadcasts — they already have the data from the HTTP response.
   */
  private readonly userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatsService: ChatsService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterInit(server: Server) {
    /**
     * Socket.IO middleware — runs for every connection attempt *before*
     * the socket is accepted. Validates the JWT and attaches the decoded
     * payload to `socket.user`. On failure the connection is rejected.
     */
    server.use((socket: AuthSocket, next) => {
      // handshake.auth типизирован как `any`, поэтому сужаем явно.
      const rawToken: unknown = socket.handshake.auth?.token;
      const token = typeof rawToken === 'string' ? rawToken : undefined;

      if (!token) {
        return next(new Error('Unauthorized: no token'));
      }
      try {
        const payload = this.jwtService.verify<SessionUserDataFromJwt>(token);
        socket.user = payload;
        next();
      } catch {
        next(new Error('Unauthorized: invalid or expired token'));
      }
    });

    this.logger.log('ChatsGateway initialized on namespace /chats');
  }

  handleConnection(client: AuthSocket) {
    const userId = client.user?.id;
    // The middleware already rejected unauthenticated sockets,
    // but guard again just in case.
    if (!userId) return client.disconnect(true);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.debug(`+ ${client.id}  (user: ${userId})`);
  }

  handleDisconnect(client: AuthSocket) {
    const userId = client.user?.id;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      sockets?.delete(client.id);
      if (!sockets?.size) this.userSockets.delete(userId);
    }
    this.logger.debug(`- ${client.id}`);
  }

  // ── Room management ────────────────────────────────────────────────────────

  @SubscribeMessage('chat:join')
  async handleJoinChat(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { chatId: string },
  ) {
    const hasAccess = await this.chatsService.checkChatAccess(
      data.chatId,
      client.user.id,
    );
    if (!hasAccess) throw new WsException('Нет доступа к чату');

    await client.join(data.chatId);
    this.logger.debug(`${client.user.id} joined room ${data.chatId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { chatId: string },
  ) {
    await client.leave(data.chatId);
    return { ok: true };
  }

  // ── Broadcast helper (called by ChatsController) ───────────────────────────

  /**
   * Emits `event` to all sockets in `chatId` room, excluding the sockets
   * that belong to `excludeUserId` (the user who triggered the HTTP action).
   * They don't need the WS push — they already applied an optimistic update
   * and will replace it with the HTTP response.
   */
  emitToChat(
    chatId: string,
    event: string,
    data: unknown,
    excludeUserId?: string,
  ): void {
    if (!this.server) return;

    const excludeSocketIds = excludeUserId
      ? [...(this.userSockets.get(excludeUserId) ?? [])]
      : [];

    const target =
      excludeSocketIds.length > 0
        ? this.server.to(chatId).except(excludeSocketIds)
        : this.server.to(chatId);

    target.emit(event, data);
  }
}
