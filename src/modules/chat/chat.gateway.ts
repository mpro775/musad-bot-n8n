// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'ws'; // استخدم ws وليس socket.io

@WebSocketGateway({
  path: '/api/chat', // <-- هنا أضف الـ prefix
  transports: ['websocket'], // force raw WS
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    console.log('Client connected' + client);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected' + client);
  }

  @SubscribeMessage('message')
  onMessage(@MessageBody() payload: any) {
    // ابث الردّ إلى كل العملاء
    console.log('Client disconnected' + payload);

    this.server.clients.forEach((c) => {
      c.send(JSON.stringify({ text: 'هذا رد تجريبي' }));
    });
  }
}
