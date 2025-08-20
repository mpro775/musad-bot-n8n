// src/storefront/storefront.controller.ts
import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Patch,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { StorefrontService } from './storefront.service';
import {
  CreateStorefrontDto,
  UpdateStorefrontDto,
  BannerDto,
} from './dto/create-storefront.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateStorefrontByMerchantDto } from './dto/update-storefront-by-merchant.dto';

/**
 * واجهة تحكم المتجر
 * تتعامل مع عمليات إدارة واجهة المتجر وإعداداتها
 */
@ApiTags('واجهة المتجر')
@Controller('storefront')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(BannerDto)
export class StorefrontController {
  constructor(private svc: StorefrontService) {}

  @Public()
  @Get('slug/check')
  @ApiOperation({ summary: 'التحقق من توفر slug' })
  @ApiResponse({ status: 200, description: 'نتيجة التحقق' })
  async checkSlug(@Query('slug') slug: string) {
    if (!slug) throw new BadRequestException('slug مطلوب');
    return this.svc.checkSlugAvailable(slug);
  }
  @Get(':slugOrId')
  @Public()
  @ApiOperation({
    summary: 'البحث عن واجهة المتجر باستخدام Slug أو المعرف',
    description: 'يسترد إعدادات واجهة المتجر الخاصة بالمعرف أو Slug المحدد',
  })
  @ApiParam({
    name: 'slugOrId',
    required: true,
    description: 'Slug أو المعرف الخاص بواجهة المتجر',
    example: 'store-slug-or-id',
  })
  @ApiResponse({
    status: 200,
    description: 'تم العثور على إعدادات واجهة المتجر',
  })
  @ApiResponse({
    status: 404,
    description: 'لم يتم العثور على إعدادات واجهة المتجر',
  })
  async storefront(@Param('slugOrId') slugOrId: string) {
    return this.svc.getStorefront(slugOrId);
  }
  @Post()
  @ApiOperation({
    summary: 'إنشاء واجهة متجر جديدة',
    description: 'ينشئ إعدادات واجهة متجر جديدة مع التخصيصات المطلوبة',
  })
  @ApiResponse({
    status: 201,
    description: 'تم إنشاء واجهة المتجر بنجاح',
  })
  @ApiResponse({
    status: 400,
    description: 'بيانات الطلب غير صالحة',
  })
  @ApiResponse({
    status: 401,
    description: 'غير مصرح - يلزم تسجيل الدخول',
  })
  @ApiBody({
    type: CreateStorefrontDto,
    description: 'بيانات واجهة المتجر المطلوب إنشاؤها',
  })
  async create(@Body() dto: CreateStorefrontDto) {
    return this.svc.create(dto);
  }

  // جلب بيانات الواجهة عبر معرف التاجر
  @Get('merchant/:merchantId')
  @ApiOperation({
    summary: 'البحث عن واجهة المتجر باستخدام معرف التاجر',
    description: 'يسترد إعدادات واجهة المتجر الخاصة بتاجر معين',
  })
  @ApiParam({
    name: 'merchantId',
    required: true,
    description: 'معرف التاجر',
    example: '60d21b4667d0d8992e610c85',
  })
  @ApiResponse({
    status: 200,
    description: 'تم العثور على إعدادات واجهة المتجر',
  })
  @ApiResponse({
    status: 404,
    description: 'لم يتم العثور على إعدادات واجهة المتجر',
  })
  @Public()
  async findByMerchant(@Param('merchantId') merchantId: string) {
    return this.svc.findByMerchant(merchantId);
  }

  // تحديث حسب معرف واجهة المتجر
  @Patch('merchant/:id')
  @ApiOperation({
    summary: 'تحديث واجهة المتجر باستخدام المعرف',
    description: 'يقوم بتحديث إعدادات واجهة المتجر باستخدام المعرف',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'معرف واجهة المتجر',
    example: '60d21b4667d0d8992e610c86',
  })
  @ApiResponse({
    status: 200,
    description: 'تم تحديث واجهة المتجر بنجاح',
  })
  @ApiResponse({
    status: 404,
    description: 'لم يتم العثور على واجهة المتجر',
  })
  @ApiBody({
    type: UpdateStorefrontDto,
    description: 'بيانات التحديث لواجهة المتجر',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateStorefrontDto) {
    return this.svc.update(id, dto);
  }

  // تحديث حسب معرف التاجر مباشرة (لتسهيل التكامل مع الـ Frontend)
  @Patch('by-merchant/:merchantId')
  @ApiOperation({ summary: 'تحديث واجهة المتجر باستخدام معرف التاجر' })
  @ApiParam({ name: 'merchantId', required: true, description: 'معرف التاجر' })
  @ApiBody({ type: UpdateStorefrontByMerchantDto })
  async updateByMerchant(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateStorefrontByMerchantDto,
  ) {
    return this.svc.updateByMerchant(merchantId, dto);
  }
}
