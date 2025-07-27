import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
    // لا ترسل أي رسالة تلقائية هنا!
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected', client.id);
  }

  sendMessageToSession(sessionId: string, message: any) {
    this.server.to(sessionId).emit('message', message);
  }
}
