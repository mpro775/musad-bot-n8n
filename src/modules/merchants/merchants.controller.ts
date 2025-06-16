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
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
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
    schema: {
      example: {
        _id: '6631ee7fa41377dc5cf730e0',
        name: 'متجر وردة',
        email: 'flower@example.com',
        phone: '9665xxxxxxx',
        userId: '6623...',
        status: 'trial',
        channelConfig: {
          whatsapp: { phone: '9665xxxxxxx' },
          telegram: { chatId: '12345678', botToken: 'bot123' },
        },
        promptConfig: {
          dialect: 'gulf',
          tone: 'ودّي',
          template: '',
        },
        apiToken: 'sk-xxxxx',
        trialEndsAt: '2025-06-24T00:00:00.000Z',
        subscriptionExpiresAt: '2025-07-10T00:00:00.000Z',
        planName: 'free',
      },
    },
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

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'جلب بيانات تاجر واحد حسب المعرّف' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر (Mongo ObjectId)' })
  @ApiOkResponse({
    description: 'تفاصيل التاجر',
    schema: {
      example: {
        _id: '6631ee7fa41377dc5cf730e0',
        name: 'متجر تجميل',
        phone: '9665xxxxxxx',
        status: 'active',
        apiToken: 'sk-merchant-token',
        promptConfig: {
          dialect: 'formal',
          tone: 'احترافي',
          template: '',
        },
        channelConfig: {
          whatsapp: { phone: '9665xxxxxxx' },
          telegram: { chatId: '12345678', botToken: 'bot:XXX' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  @ApiUnauthorizedResponse({ description: 'صلاحية الدخول غير كافية' })
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

  @Post(':id/channel')
  @ApiOperation({ summary: 'تحديث إعدادات القنوات' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateChannelDto })
  @ApiOkResponse()
  @ApiNotFoundResponse()
  @Post(':id/channel')
  updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.svc.updateChannelConfig(id, dto);
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
   * يفعّل ويب هوك تلجرام لتاجر معيّن
   * @param id معرّف التاجر
   */
  @Post(':id/webhook')
  async registerTelegramWebhook(@Param('id') id: string) {
    const result = await this.svc.registerTelegramWebhook(id);
    return { success: true, ...result };
  }
}
