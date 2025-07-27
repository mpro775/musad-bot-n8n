// src/modules/merchants/merchants.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  BadRequestException,
  HttpCode,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ChannelDetailsDto } from './dto/channel.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { OnboardingResponseDto } from './dto/onboarding-response.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import {
  ChecklistGroup,
  MerchantChecklistService,
} from './merchant-checklist.service';

@ApiTags('التجار')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly svc: MerchantsService,
    private readonly checklist: MerchantChecklistService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء تاجر جديد مع الإعدادات الأولية' })
  @ApiBody({ type: CreateMerchantDto })
  @ApiCreatedResponse({ description: 'تم إنشاء التاجر بنجاح' })
  create(@Body() dto: CreateMerchantDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'جلب جميع التجار' })
  @ApiOkResponse({ description: 'قائمة التجار' })
  findAll() {
    return this.svc.findAll();
  }

  @Get('actions/onboarding/test')
  @Public()
  @ApiOperation({ summary: 'نقطة اختبار onboarding' })
  test() {
    return { ok: true };
  }

  @Put('actions/onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إكمال عملية onboarding للتاجر الحالي' })
  @ApiBody({ type: OnboardingDto })
  @ApiOkResponse({
    description: 'تم إكمال onboarding',
    type: OnboardingResponseDto,
  })
  completeOnboarding(
    @Req() { user }: RequestWithUser,
    @Body() dto: OnboardingDto,
  ): Promise<{ message: string } & OnboardingResponseDto> {
    return this.svc
      .completeOnboarding(user.merchantId, dto)
      .then(({ merchant, webhookInfo }) => ({
        message: 'Onboarding completed',
        merchant,
        webhookInfo,
      }));
  }
  @Get(':id/checklist')
  async getChecklist(
    @Param('id') merchantId: string,
  ): Promise<ChecklistGroup[]> {
    return this.checklist.getChecklist(merchantId);
  }
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'جلب بيانات تاجر واحد حسب المعرّف' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر (ObjectId)' })
  @ApiOkResponse({ description: 'بيانات التاجر' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث بيانات التاجر بالكامل' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiBody({ type: UpdateMerchantDto })
  @ApiOkResponse({ description: 'تم التحديث بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  @ApiForbiddenResponse({ description: 'غير مخوّل' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
    @Request() req: RequestWithUser,
  ) {
    const user = req.user;
    return this.svc.findOne(id).then((merchant) => {
      if (!merchant) {
        throw new NotFoundException('التاجر غير موجود');
      }
      if (user.role !== 'ADMIN' && user.merchantId !== id) {
        throw new HttpException('ممنوع', HttpStatus.FORBIDDEN);
      }
      return this.svc.update(id, dto);
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف التاجر' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiOkResponse({ description: 'تم الحذف بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  @ApiForbiddenResponse({ description: 'غير مخوّل' })
  @ApiUnauthorizedResponse({ description: 'التوثيق مطلوب' })
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    const user = req.user;
    if (user.role !== 'ADMIN' && user.merchantId !== id) {
      throw new HttpException('ممنوع', HttpStatus.FORBIDDEN);
    }
    return this.svc.remove(id);
  }

  @Get(':id/subscription-status')
  @ApiOperation({ summary: 'التحقق من صلاحية الاشتراك الحالي' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiOkResponse({
    schema: {
      example: { merchantId: '...', subscriptionActive: true },
    },
  })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  checkSubscription(@Param('id') id: string) {
    return this.svc.isSubscriptionActive(id).then((active) => ({
      merchantId: id,
      subscriptionActive: active,
    }));
  }

  /**
   * تحديث قناة محددة (واتساب/تلجرام/ويبشات)
   */
  @Patch(':id/channels/:channelType')
  @ApiOperation({ summary: 'تحديث إعدادات قناة منفردة' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiParam({
    name: 'channelType',
    description: 'نوع القناة: whatsapp | telegram | webchat',
    enum: ['whatsapp', 'telegram', 'webchat'],
  })
  @ApiBody({ type: ChannelDetailsDto })
  @ApiOkResponse({ description: 'تم تحديث القناة' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  updateChannel(
    @Param('id') id: string,
    @Param('channelType') channelType: 'whatsapp' | 'telegram' | 'webchat',
    @Body() channelDetails: ChannelDetailsDto,
  ) {
    return this.svc.updateChannels(id, channelType, channelDetails);
  }

  @Post(':id/telegram-webhook')
  @ApiOperation({ summary: 'تفعيل Webhook تلجرام للتاجر' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiBody({ schema: { example: { botToken: '12345:ABCDEF...' } } })
  @ApiOkResponse({ description: 'تم تسجيل الويبهوك بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر أو الـ workflow غير موجود' })
  registerTelegram(
    @Param('id') id: string,
    @Body('botToken') botToken: string,
  ) {
    if (!botToken) {
      throw new BadRequestException('botToken مطلوب في جسم الطلب');
    }
    return this.svc.registerTelegramWebhook(id, botToken).then((result) => ({
      message: 'تم تسجيل الويبهوك بنجاح',
      ...result,
    }));
  }
  @Post(':id/whatsapp/start-session')
  async startSession(@Param('id') id: string) {
    return this.svc.connectWhatsapp(id);
  }

  // جلب حالة الاتصال
  @Get(':id/whatsapp/status')
  async getStatus(@Param('id') id: string) {
    return this.svc.getWhatsappStatus(id);
  }

  // إرسال رسالة (اختياري للاختبار/التجربة)
  @Post(':id/whatsapp/send-message')
  async sendMsg(
    @Param('id') id: string,
    @Body() body: { to: string; text: string },
  ) {
    return this.svc.sendWhatsappMessage(id, body.to, body.text);
  }
  @Post(':id/checklist/:itemKey/skip')
  async skipChecklistItem(
    @Param('id') merchantId: string,
    @Param('itemKey') itemKey: string,
    @Req() req: RequestWithUser,
  ) {
    // تحقق أن المستخدم مالك المتجر
    if (req.user.role !== 'ADMIN' && req.user.merchantId !== merchantId) {
      throw new HttpException('ممنوع', HttpStatus.FORBIDDEN);
    }

    // أضف الـ key إلى skippedChecklistItems إن لم يكن موجودًا
    const merchant = await this.svc.findOne(merchantId);
    if (!merchant) throw new NotFoundException('التاجر غير موجود');

    if (!merchant.skippedChecklistItems.includes(itemKey)) {
      merchant.skippedChecklistItems.push(itemKey);
      await merchant.save();
    }

    return {
      message: 'تم التخطي',
      skippedChecklistItems: merchant.skippedChecklistItems,
    };
  }
  @Patch(':merchantId/leads-settings')
  updateLeadsSettings(
    @Param('merchantId') merchantId: string,
    @Body('settings') settings: any[],
  ) {
    return this.svc.updateLeadsSettings(merchantId, settings);
  }
}
