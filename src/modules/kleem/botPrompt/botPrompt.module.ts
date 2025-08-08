// src/modules/kleem/botPrompt/botPrompt.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotPrompt, BotPromptSchema } from './schemas/botPrompt.schema';
import { BotPromptService } from './botPrompt.service';
import { BotPromptController } from './botPrompt.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotPrompt.name, schema: BotPromptSchema },
    ]),
  ],
  providers: [BotPromptService],
  controllers: [BotPromptController],
  exports: [BotPromptService],
})
export class BotPromptModule {}
