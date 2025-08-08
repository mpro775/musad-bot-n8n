// src/modules/kleem/botFaq/botFaq.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotFaq, BotFaqSchema } from './schemas/botFaq.schema';
import { BotFaqService } from './botFaq.service';
import { BotFaqController } from './botFaq.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BotFaq.name, schema: BotFaqSchema }]),
  ],
  providers: [BotFaqService],
  controllers: [BotFaqController],
  exports: [BotFaqService],
})
export class BotFaqModule {}
