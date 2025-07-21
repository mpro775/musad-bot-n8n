import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  path: '/api/chat',
  cors: {
    origin: ['http://localhost:5173'], // ضف دوميناتك هنا
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  handleConnection(client: Socket) {
    const { sessionId } = client.handshake.query;
    if (sessionId) {
      client.join(sessionId as string);
      console.log('Client joined room:', sessionId);
    }
    client.emit('message', { text: 'أهلاً من الباك اند!' });
  }
  handleDisconnect(client: Socket) {
    console.log('Client disconnected', client.id);
  }

  @SubscribeMessage('message')
  onMessage(@MessageBody() payload: any) {
    console.log('Received message', payload);
    this.server.emit('message', { text: 'هذا رد تجريبي' });
  }

  sendMessageToSession(sessionId: string, message: any) {
    this.server.to(sessionId).emit('message', message);
  }
}
