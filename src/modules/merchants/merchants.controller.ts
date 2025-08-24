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
  UseInterceptors,
  UploadedFile,
  Query,
  ParseEnumPipe,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
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
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { OnboardingResponseDto } from './dto/onboarding-response.dto';
import {
  ChecklistGroup,
  MerchantChecklistService,
} from './merchant-checklist.service';
import { OnboardingBasicDto } from './dto/onboarding-basic.dto';
import { UpdateProductSourceDto } from './dto/update-product-source.dto';
import { unlink } from 'fs/promises';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';
import { CatalogService } from '../catalog/catalog.service';
import { OutboxService } from 'src/common/outbox/outbox.service';

@ApiTags('التجار')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly svc: MerchantsService,
    private readonly checklist: MerchantChecklistService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
    private readonly catalog: CatalogService,
    private readonly outbox: OutboxService,
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

  @Get(':id/checklist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'جلب قائمة العناصر في قائمة التحقق' })
  @ApiOkResponse({ description: 'قائمة العناصر في قائمة التحقق' })
  @ApiForbiddenResponse({ description: 'غير مخوّل' })
  @ApiUnauthorizedResponse({ description: 'التوثيق مطلوب' })
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

  @Get('prompt/advanced-template')
  async getAdvancedTemplate(@Param('id') id: string) {
    return this.svc.getAdvancedTemplateForEditor(id, {
      productName: 'منتج تجريبي',
    });
  }

  @Post(':id/logo')
  @ApiOperation({ summary: 'رفع شعار التاجر كملف (MinIO + حذف مؤقت)' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @UseInterceptors(FileInterceptor('file')) // ← يعتمد على MulterModule.register({ dest: './uploads' })
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('لم يتم إرفاق ملف');

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    const maxBytes = 2 * 1024 * 1024; // 2MB

    if (!allowed.includes(file.mimetype)) {
      try {
        await unlink(file.path);
      } catch {
        console.log('Error deleting file', file.path);
      }
      throw new BadRequestException('صيغة الصورة غير مدعومة (PNG/JPG/WEBP)');
    }
    if (file.size > maxBytes) {
      try {
        await unlink(file.path);
      } catch {
        console.log('Error deleting file', file.path);
      }
      throw new BadRequestException('الحجم الأقصى 2MB');
    }

    const url = await this.svc.uploadLogoToMinio(id, file);
    return { url };
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

  @Post(':id/checklist/:itemKey/skip')
  @ApiOperation({ summary: 'تخطي عنصر في قائمة التحقق' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiParam({ name: 'itemKey', description: 'معرّف العنصر' })
  @ApiOkResponse({ description: 'تم تخطي العنصر بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
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

  @Patch(':id/onboarding/basic')
  @ApiOperation({ summary: 'حفظ معلومات onboarding الأساسية' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiBody({ type: OnboardingBasicDto })
  @ApiOkResponse({ description: 'تم حفظ معلومات onboarding بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  saveBasic(@Param('id') id: string, @Body() dto: OnboardingBasicDto) {
    return this.svc.saveBasicInfo(id, dto);
  }

  @Post(':id/workflow/ensure')
  @ApiOperation({ summary: 'إنشاء أو تحديث workflow للتاجر' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiOkResponse({ description: 'تم إنشاء أو تحديث workflow بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  async ensureWorkflow(@Param('id') id: string) {
    const wfId = await this.svc.ensureWorkflow(id);
    return { workflowId: wfId };
  }

  @Public()
  @Get(':id/ai/store-context')
  @ApiOperation({ summary: 'جلب سياق المتجر' })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiOkResponse({ description: 'تم جلب سياق المتجر بنجاح' })
  @ApiNotFoundResponse({ description: 'التاجر غير موجود' })
  async aiStoreContext(@Param('id') id: string) {
    return this.svc.getStoreContext(id);
  }

  @ApiOperation({
    summary: 'تعيين مصدر المنتج (مع تأكيد كلمة المرور واختيار وضع المزامنة)',
  })
  @ApiParam({ name: 'id', description: 'معرّف التاجر' })
  @ApiBody({ type: UpdateProductSourceDto })
  @ApiOkResponse({ description: 'تم التبديل وربما بدأت المزامنة' })
  @Patch(':id/product-source')
  async setSource(
    @Param('id') merchantId: string,
    @Body() dto: UpdateProductSourceDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    const user = await this.userModel
      .findById(userId)
      .select('+password role email name')
      .exec();
    if (!user) throw new BadRequestException('User not found');

    // تأكيد كلمة المرور
    const ok = await bcrypt.compare(dto.confirmPassword, user.password);
    if (!ok) throw new BadRequestException('كلمة المرور غير صحيحة');

    // (اختياري) تحقّق صلاحيات: Only OWNER/ADMIN يبدّل المصدر
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MERCHANT') {
      throw new BadRequestException('ليست لديك صلاحية تغيير المصدر');
    }

    // 1) بدّل المصدر
    const merchant = await this.svc.setProductSource(merchantId, dto.source);

    // 2) أشعر المستخدم بعملية التغيير
    await this.notifications.notifyUser(userId, {
      type: 'productSource.changed',
      title: 'تم تغيير مصدر المنتجات',
      body: `المصدر الحالي: ${dto.source}`,
      merchantId,
      severity: 'info',
      data: { source: dto.source },
    });

    // 3) المزامنة حسب الوضع
    const mode = dto.syncMode ?? 'background';
    if (mode === 'immediate') {
      // مزامنة الآن (قد تستغرق)
      try {
        await this.notifications.notifyUser(userId, {
          type: 'catalog.sync.started',
          title: 'بدء مزامنة الكتالوج',
          body: 'بدأت عملية المزامنة الآن.',
          merchantId,
          severity: 'info',
        });
        const result = await this.catalog.syncForMerchant(merchantId);
        await this.notifications.notifyUser(userId, {
          type: 'catalog.sync.completed',
          title: 'اكتمال مزامنة الكتالوج',
          body: `تم الاستيراد: ${result.imported} | التحديث: ${result.updated}`,
          merchantId,
          severity: 'success',
          data: result,
        });
        return { merchant, sync: { mode, ...result } };
      } catch (e: any) {
        await this.notifications.notifyUser(userId, {
          type: 'catalog.sync.failed',
          title: 'فشل مزامنة الكتالوج',
          body: e?.message || 'حدث خطأ أثناء المزامنة',
          merchantId,
          severity: 'error',
        });
        throw e;
      }
    }

    if (mode === 'background') {
      // أطلق حدث لخلفية/وركر (Outbox/Rabbit أو Cron)
      await this.outbox
        .enqueueEvent({
          aggregateType: 'catalog',
          aggregateId: merchantId,
          eventType: 'catalog.sync.requested',
          payload: { merchantId, requestedBy: userId, source: dto.source },
          exchange: 'catalog.sync',
          routingKey: 'requested',
        })
        .catch(() => {
          /* لو ما عندك Outbox عامل حالياً—تجاهل */
        });

      await this.notifications.notifyUser(userId, {
        type: 'catalog.sync.queued',
        title: 'تم جدولة مزامنة الكتالوج',
        body: 'ستبدأ المزامنة في الخلفية.',
        merchantId,
        severity: 'info',
      });
      return { merchant, sync: { mode: 'background', queued: true } };
    }

    // none
    return { merchant, sync: { mode: 'none' } };
  }
}
