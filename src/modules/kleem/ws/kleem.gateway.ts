// src/modules/kleem/ws/kleem.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { KleemChatService } from '../chat/kleem-chat.service';
import {
  KleemWsMessage,
  TypingPayload,
  UserMessagePayload,
} from './kleem-ws.types';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  path: '/api/kaleem/ws',
  cors: {
    origin: [
      'http://localhost:5173',
      'https://app.kaleem-ai.com',
      'https://kaleem-ai.com',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class KleemGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(KleemGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly kleem: KleemChatService,
    private readonly jwt: JwtService,
  ) {}

  handleConnection(client: Socket) {
    const auth = client.handshake.auth as any;
    const token = auth?.token as string | undefined;

    let userId: string | undefined;
    let merchantId: string | undefined;
    let roleFromToken: string | undefined;

    // استخلص الهويّة من JWT إن وُجد
    try {
      if (token) {
        const payload: any = this.jwt.verify(token);
        userId = payload?.userId || payload?.sub || payload?._id;
        merchantId = payload?.merchantId;
        roleFromToken = (payload?.role || '').toString().toUpperCase();
      }
    } catch {
      // تجاهل التوكن غير صالح: يسمح للضيف بالاتصال بغرفة sessionId فقط
    }

    // غرف هوية المستخدم/التاجر
    if (userId) client.join(`user:${userId}`);
    if (merchantId) client.join(`merchant:${merchantId}`);

    // غرفة الجلسة (للزائر/الليندنج)
    const q = client.handshake.query as any;
    const sessionId = q?.sessionId as string | undefined;
    const roleQ = (q?.role || '').toString().toLowerCase();
    if (sessionId) client.join(sessionId);

    // الأدمن/الوكيل
    const isAdmin =
      roleQ === 'admin' ||
      roleQ === 'agent' ||
      roleFromToken === 'ADMIN' ||
      roleFromToken === 'AGENT';
    if (isAdmin) client.join('kleem_admin');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected ${client.id}`);
  }

  // اشتراك أدمن صريح (اختياري)
  @SubscribeMessage('admin:subscribe')
  onAdminSubscribe(@ConnectedSocket() client: Socket) {
    client.join('kleem_admin');
    client.emit('admin:notification', { type: 'joined', title: 'subscribed' });
  }

  // -------- بث أحداث قادمة من الخدمات --------
  @OnEvent('kleem.bot_reply')
  onBotReply(payload: { sessionId: string; message: KleemWsMessage }) {
    this.server.to(payload.sessionId).emit('bot_reply', payload.message);
  }

  @OnEvent('kleem.admin_new_message')
  onAdminFeed(payload: { sessionId: string; message: KleemWsMessage }) {
    this.server.to('kleem_admin').emit('admin_new_message', payload);
  }

  @OnEvent('admin:notification')
  onAdminNotification(payload: any) {
    this.server.to('kleem_admin').emit('admin:notification', payload);
  }

  // إشعارات موجّهة للمستخدم
  @OnEvent('notify.user')
  onNotifyUser(payload: any & { userId: string }) {
    this.server.to(`user:${payload.userId}`).emit('notification', payload);
  }

  // إشعارات موجّهة لكل مستخدمي التاجر
  @OnEvent('notify.merchant')
  onNotifyMerchant(payload: any & { merchantId: string }) {
    this.server.to(`merchant:${payload.merchantId}`).emit('notification', payload);
  }

  // typing للبوت (لو تبثه من الخدمة)
  @OnEvent('kleem.typing')
  onBotTyping(p: { sessionId: string; role: 'bot' }) {
    this.server.to(p.sessionId).emit('typing', p);
  }

  // -------- استقبال رسائل العميل عبر WS وتمريرها للخدمة --------
  @SubscribeMessage('user_message')
  async onUserMessage(
    @MessageBody() body: UserMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // بث فوري لمؤشر "user is typing"
      if (body?.sessionId) {
        client.emit('typing', { sessionId: body.sessionId, role: 'user' });
      }

      const { sessionId, text, metadata } = body;
      if (!sessionId || !text) return;
      await this.kleem.handleUserMessage(sessionId, text, metadata);
      return { ok: true };
    } catch (e) {
      this.logger.error('onUserMessage error', e as Error);
      return { ok: false };
    }
  }

  @SubscribeMessage('typing')
  onTyping(@MessageBody() payload: TypingPayload) {
    if (!payload?.sessionId) return;
    this.server.to(payload.sessionId).emit('typing', payload);
  }
}
