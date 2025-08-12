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
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { seconds, Throttle } from '@nestjs/throttler';
import { BotFaqService } from './botFaq.service';
import { CreateBotFaqDto } from './dto/create-botFaq.dto';
import { UpdateBotFaqDto } from './dto/update-botFaq.dto';
import { BulkImportDto } from './dto/bulk-import.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/kleem/bot-faqs')
export class BotFaqController {
  constructor(private readonly svc: BotFaqService) {}

  @Post()
  create(@Body() dto: CreateBotFaqDto) {
    return this.svc.create(dto);
  }

  @Get()
  list() {
    return this.svc.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBotFaqDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }

  @Post('import')
  bulk(@Body() body: BulkImportDto) {
    return this.svc.bulkImport(body);
  }

  // رفع ملف JSON من لوحة التحكم (بديل اختياري)
  @Post('import/file')
  @UseInterceptors(FileInterceptor('file'))
  async bulkFile(@UploadedFile() file: Express.Multer.File) {
    const text = file?.buffer?.toString('utf8') || '[]';
    const items = JSON.parse(text);
    return this.svc.bulkImport({ items });
  }

  @Post('reindex')
  reindex() {
    return this.svc.reindexAll();
  }
}

// مسار عام للبحث الدلالي (للاستخدام من الودجت)
@Controller('kleem/faq')
export class BotFaqPublicController {
  constructor(private readonly svc: BotFaqService) {}

  @Throttle({ public: { limit: 30, ttl: seconds(60) } }) // ← وسيط واحد: اسم المجموعة
  @Get('semantic-search')
  @Public()
  async semanticSearch(@Query('q') q: string, @Query('topK') topK?: string) {
    if (!q?.trim()) return [];
    return this.svc.semanticSearch(q, Number(topK) || 5);
  }
}
