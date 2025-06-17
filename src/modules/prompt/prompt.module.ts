// src/modules/prompt/prompt.module.ts
import { Module } from '@nestjs/common';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  providers: [PromptBuilderService],
  exports: [PromptBuilderService], // ضروري لتستخدمها في WebhooksService أو غيره
})
export class PromptModule {}
