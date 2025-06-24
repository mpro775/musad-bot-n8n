// src/modules/merchants/controllers/merchant-prompt.controller.ts

import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  ParseIntPipe,
  ValidationPipe,
  UsePipes,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MerchantsService } from '../merchants.service';
import { PromptVersionService } from '../services/prompt-version.service';
import { PromptPreviewService } from '../services/prompt-preview.service';
import { QuickConfigDto } from '../dto/quick-config.dto';
import { AdvancedTemplateDto } from '../dto/advanced-template.dto';
import { PreviewPromptDto } from '../dto/preview-prompt.dto';
import { PromptBuilderService } from '../services/prompt-builder.service';
import { QuickConfig } from '../schemas/quick-config.schema';

@ApiTags('Merchants • Prompt')
@Controller('merchants/:id/prompt')
export class MerchantPromptController {
  constructor(
    private readonly merchantSvc: MerchantsService,
    private readonly versionSvc: PromptVersionService,
    private readonly promptBuild: PromptBuilderService,
    private readonly previewSvc: PromptPreviewService,
  ) {}

  @Get('quick-config')
  @ApiOperation({ summary: 'جلب إعدادات Quick Setup' })
  @ApiResponse({
    status: 200,
    description: 'إعدادات Quick Config',
    type: QuickConfigDto,
  })
  async getQuickConfig(@Param('id') id: string) {
    const m = await this.merchantSvc.findOne(id);
    return m.quickConfig;
  }

  // src/modules/merchants/controllers/merchant-prompt.controller.ts
  @Patch('quick-config')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateQuickConfig(
    @Param('id') id: string,
    @Body() dto: QuickConfigDto,
  ): Promise<QuickConfig> {
    try {
      return await this.merchantSvc.updateQuickConfig(id, dto);
    } catch (err) {
      // إن كان InternalServerErrorException فستخبر العميل، وإلا نمرر الخطأ الأصلي
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      console.error('❌ Unexpected error in controller:', err);
      throw new InternalServerErrorException();
    }
  }

  @Get('advanced-template')
  @ApiOperation({ summary: 'جلب القالب المتقدّم' })
  @ApiResponse({
    status: 200,
    description: 'القالب المتقدم',
    schema: { example: { template: '...' } },
  })
  async getAdvancedTemplate(@Param('id') id: string) {
    const m = await this.merchantSvc.findOne(id);
    return { template: m.currentAdvancedConfig.template };
  }

  @Post('advanced-template')
  @ApiOperation({ summary: 'حفظ قالب متقدّم جديد (وإنشاء نسخة احتياطية)' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async saveAdvancedTemplate(
    @Param('id') id: string,
    @Body() dto: AdvancedTemplateDto,
  ) {
    const tpl = dto.advancedTemplate?.trim();
    if (!tpl) {
      throw new BadRequestException('template is required');
    }
    await this.versionSvc.snapshot(id, dto.note);
    await this.merchantSvc.saveAdvancedVersion(id, tpl, dto.note);
    return { message: 'Advanced template saved' };
  }

  @Get('advanced-versions')
  @ApiOperation({ summary: 'جلب سجلّ نسخ القالب المتقدّم' })
  @ApiResponse({ status: 200, description: 'سجل القوالب المتقدمة' })
  async listVersions(@Param('id') id: string) {
    return this.versionSvc.list(id);
  }

  @Post('advanced-versions/:index/revert')
  @ApiOperation({ summary: 'التراجع إلى نسخة سابقة حسب المؤشر' })
  @ApiResponse({ status: 200, description: 'تم التراجع إلى النسخة المحددة' })
  async revertVersion(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    await this.versionSvc.revert(id, index);
    return { message: `Reverted to version ${index}` };
  }

  @Post('preview')
  @ApiOperation({ summary: 'معاينة البرومبت مع متغيرات اختبارية' })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async preview(@Param('id') id: string, @Body() dto: PreviewPromptDto) {
    const m = await this.merchantSvc.findOne(id);

    // اختر القالب بناءً على QuickConfig أو advanced
    const raw =
      dto.useAdvanced && m.currentAdvancedConfig.template
        ? m.currentAdvancedConfig.template
        : this.promptBuild.buildFromQuickConfig({
            ...m,
            quickConfig: { ...m.quickConfig, ...dto.quickConfig },
          } as any);

    // previewSvc.preview يرجع نصاً (string)، لذا لا نستخدم await
    const preview = this.previewSvc.preview(raw, dto.testVars);

    return { preview };
  }
  @Get('final-prompt')
  @ApiOperation({ summary: 'جلب الـ finalPrompt النص النهائي' })
  @ApiResponse({
    status: 200,
    description: 'النص النهائي للبرومبت',
    schema: { example: { prompt: '...' } },
  })
  async finalPrompt(@Param('id') id: string) {
    const m = await this.merchantSvc.findOne(id);
    if (!m.finalPromptTemplate) {
      throw new BadRequestException('Final prompt not configured');
    }
    return { prompt: m.finalPromptTemplate };
  }
}
