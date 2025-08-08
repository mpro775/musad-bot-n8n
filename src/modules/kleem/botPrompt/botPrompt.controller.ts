// src/modules/kleem/botPrompt/botPrompt.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { BotPromptService } from './botPrompt.service';
import { CreateBotPromptDto } from './dto/create-botPrompt.dto';
import { UpdateBotPromptDto } from './dto/update-botPrompt.dto';
import { SetActiveDto } from './dto/set-active.dto';

@Controller('admin/kleem/bot-prompts')
export class BotPromptController {
  constructor(private readonly svc: BotPromptService) {}

  @Post()
  create(@Body() dto: CreateBotPromptDto) {
    return this.svc.create(dto);
  }

  @Get()
  list(
    @Query('type') type?: 'system' | 'user',
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.svc.findAll({
      type,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBotPromptDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/active')
  setActive(@Param('id') id: string, @Body() body: SetActiveDto) {
    return this.svc.setActive(id, body.active);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.svc.archive(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Get('system/active/content')
  async activeSystemContent() {
    const content = await this.svc.getActiveSystemPromptOrDefault();
    return { content };
  }
}
