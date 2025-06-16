// src/modules/messaging/message.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageSession, MessageSessionSchema } from './schemas/message.schema';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSession.name, schema: MessageSessionSchema },
    ]),
  ],
  providers: [MessageService],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessagingModule {}
