// kleem.module.ts
import { Module } from '@nestjs/common';
import { KleemChatService } from './chat/kleem-chat.service';
import { BotChatsModule } from './botChats/botChats.module';
import { BotPromptModule } from './botPrompt/botPrompt.module';
import { SettingsModule } from './settings/settings.module';
import { VectorModule } from '../vector/vector.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BotFaqModule } from './botFaq/botFaq.module';

@Module({
  imports: [
    BotChatsModule,
    BotPromptModule,
    BotFaqModule,
    SettingsModule,
    VectorModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [KleemChatService],
  exports: [KleemChatService],
})
export class KleemModule {}
