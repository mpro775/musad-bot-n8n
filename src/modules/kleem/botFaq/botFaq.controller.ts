// src/modules/kleem/botFaq/botFaq.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { BotFaqService } from './botFaq.service';
import { CreateBotFaqDto } from './dto/create-botFaq.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('admin/kleem/bot-faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BotFaqController {
  constructor(private readonly svc: BotFaqService) {}

  @Post()
  async create(@Body() dto: CreateBotFaqDto) {
    return this.svc.create(dto);
  }

  @Get()
  async list() {
    return this.svc.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateBotFaqDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
  @Get('semantic-search')
  @Public()
  async semanticSearch(@Query('q') q: string, @Query('topK') topK?: string) {
    if (!q || !q.trim()) {
      return [];
    }
    const results = await this.svc.semanticSearch(q, Number(topK) || 5);
    return results;
  }
}
