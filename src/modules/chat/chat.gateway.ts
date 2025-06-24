// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // أو حدد نطاقك https://dashboard.smartagency-ye.com
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway {
  server: Server;

  handleConnection() {
    // لا حاجة للـ socket هنا، فالدالة فارغة
  }

  @SubscribeMessage('message')
  onMessage(
    @MessageBody()
    payload: { merchantId: string; sessionId: string; text: string },
    @ConnectedSocket() socket: Socket,
  ) {
    // هنا ترسل إلى الـ AI عبر n8n أو الـ message service
    // ثم تبث الرد:
    socket.emit('botMessage', { text: 'هذه رسالة اختبار' });
  }
}
