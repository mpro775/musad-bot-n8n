// src/modules/merchants/merchants.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  BadRequestException,
  HttpCode,
  Req,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ChannelsDto } from './dto/update-channel.dto';
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
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { OnboardingResponseDto } from './dto/onboarding-response.dto';
import { OnboardingDto } from './dto/onboarding.dto';

@ApiTags('التجار')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly svc: MerchantsService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء تاجر جديد مع الإعدادات الأولية' })
  @ApiBody({ type: CreateMerchantDto })
  @ApiCreatedResponse({
    description: 'تم إنشاء التاجر بنجاح',
  })
  @ApiBadRequestResponse({ description: 'بيانات ناقصة أو غير صحيحة' })
  @ApiUnauthorizedResponse({ description: 'التوثيق مطلوب' })
  create(@Body() dto: CreateMerchantDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'جلب جميع التجار' })
  @ApiOkResponse()
  findAll() {
    return this.svc.findAll();
  }
  @Get('actions/onboarding')
  @Public()
  test() {
    console.log('▶️ test endpoint reached');
    return { ok: true };
  }
  // src/modules/merchants/merchants.controller.ts
  @Put('actions/onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @Req() { user }: RequestWithUser,
    @Body() dto: OnboardingDto, // ← dto أصبح مُلزَماً، لا علامة ?
  ): Promise<{ message: string } & OnboardingResponseDto> {
    console.log('▶️ reached completeOnboarding', {
      merchantId: user.merchantId,
      dto,
    });
    const { merchant, webhookInfo } = await this.svc.completeOnboarding(
      user.merchantId,
      dto,
    );
    return {
      message: 'Onboarding completed',
      merchant,
      webhookInfo,
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'جلب بيانات تاجر واحد حسب المعرّف' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر (Mongo ObjectId)' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث بيانات التاجر بالكامل' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
    @Request() req: RequestWithUser,
  ) {
    const user = req.user;
    return this.svc.findOne(id).then((merchant) => {
      if (user.role !== 'ADMIN' && user.userId !== merchant.userId.toString()) {
        throw new HttpException('ممنوع', HttpStatus.FORBIDDEN);
      }
      return this.svc.update(id, dto);
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف التاجر' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse()
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    const user = req.user;
    if (user.role !== 'ADMIN' && user.userId !== id) {
      throw new HttpException('ممنوع', HttpStatus.FORBIDDEN);
    }
    return this.svc.remove(id);
  }

  @Get(':id/subscription-status')
  @ApiOperation({ summary: 'التحقق من صلاحية الاشتراك الحالي للتاجر' })
  @ApiOkResponse({
    description: 'نتيجة الفحص',
    schema: {
      example: {
        merchantId: '6631ee7fa41377dc5cf730e0',
        subscriptionActive: true,
      },
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

  @Post(':id/channels')
  @ApiOperation({ summary: 'تحديث إعدادات القنوات (واتساب/تلجرام)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ChannelsDto })
  @ApiOkResponse()
  @ApiNotFoundResponse()
  updateChannels(@Param('id') id: string, @Body() dto: ChannelsDto) {
    return this.svc.updateChannels(id, dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'جلب حالة التاجر التفصيلية' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  getStatus(@Param('id') id: string) {
    return this.svc.getStatus(id);
  }

  /**
   * يفعّل ويب هوك تلجرام لتاجر معيّن. يجب إرسال botToken إما عبر Body أو أن يكون محفوظاً بقنوات التاجر.
   */
  @Post(':id/telegram-webhook')
  @ApiOperation({ summary: 'تفعيل Webhook تلجرام للتاجر' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: { example: { botToken: '12345:ABCDEF...' } } })
  async registerTelegram(
    @Param('id') id: string,
    @Body('botToken') botToken: string,
  ) {
    if (!botToken) {
      throw new BadRequestException('botToken مطلوب في جسم الطلب');
    }
    const result = await this.svc.registerTelegramWebhook(id, botToken);
    return { message: 'تم تسجيل الويبهوك بنجاح', ...result };
  }
}
