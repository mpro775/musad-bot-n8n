// src/merchants/merchants.service.ts

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { QuickConfigDto } from './dto/quick-config.dto';
import { N8nWorkflowService } from '../n8n-workflow/n8n-workflow.service';
import { ConfigService } from '@nestjs/config';
import { PromptVersionService } from './services/prompt-version.service';
import { PromptPreviewService } from './services/prompt-preview.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { MerchantStatusResponse } from './types/types';
import { QuickConfig } from './schemas/quick-config.schema';
import { OnboardingBasicDto } from './dto/onboarding-basic.dto';
import { BusinessMetrics } from 'src/metrics/business.metrics';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Client as MinioClient } from 'minio';
import { unlink } from 'fs/promises';
import { buildHbsContext, stripGuardSections } from './services/prompt-utils';
import { PreviewPromptDto } from './dto/preview-prompt.dto';
import { ChannelsService } from '../channels/channels.service';
import { StorefrontService } from '../storefront/storefront.service';

function toRecord(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (input instanceof Map) {
    for (const [key, value] of input as Map<unknown, unknown>) {
      if (typeof value !== 'string') continue;
      if (typeof key === 'string') out[key] = value;
      else if (typeof key === 'number') out[String(key)] = value;
    }
    return out;
  }
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

const normUrl = (u?: string) =>
  u && u.trim()
    ? /^https?:\/\//i.test(u)
      ? u.trim()
      : `https://${u.trim()}`
    : undefined;

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);
  public minio: MinioClient;

  constructor(
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    private readonly config: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly versionSvc: PromptVersionService,
    private readonly storefrontService: StorefrontService,
    private readonly previewSvc: PromptPreviewService,
    private readonly n8n: N8nWorkflowService,
    private readonly businessMetrics: BusinessMetrics,
  ) {
    this.minio = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }

  async create(createDto: CreateMerchantDto): Promise<MerchantDocument> {
    const subscription = {
      tier: createDto.subscription.tier,
      startDate: new Date(createDto.subscription.startDate),
      endDate: createDto.subscription.endDate
        ? new Date(createDto.subscription.endDate)
        : undefined,
      features: createDto.subscription.features,
    };

    const doc: Partial<MerchantDocument> = {
      userId: createDto.userId,
      name: createDto.name,
      logoUrl: createDto.logoUrl ?? '',
      addresses: createDto.addresses ?? [],
      subscription,
      categories: createDto.categories ?? [],
      customCategory: createDto.customCategory ?? undefined,
      businessType: createDto.businessType,
      businessDescription: createDto.businessDescription,
      workingHours: createDto.workingHours ?? [],
      returnPolicy: createDto.returnPolicy ?? '',
      exchangePolicy: createDto.exchangePolicy ?? '',
      shippingPolicy: createDto.shippingPolicy ?? '',
      quickConfig: {
        dialect: createDto.quickConfig?.dialect ?? 'خليجي',
        tone: createDto.quickConfig?.tone ?? 'ودّي',
        customInstructions: createDto.quickConfig?.customInstructions ?? [],
        includeClosingPhrase:
          createDto.quickConfig?.includeClosingPhrase ?? true,
        customerServicePhone: createDto.quickConfig?.customerServicePhone ?? '',
        customerServiceWhatsapp:
          createDto.quickConfig?.customerServiceWhatsapp ?? '',
        closingText:
          createDto.quickConfig?.closingText ?? 'هل أقدر أساعدك بشي ثاني؟ 😊',
      },
      currentAdvancedConfig: {
        template: createDto.currentAdvancedConfig?.template ?? '',
        note: createDto.currentAdvancedConfig?.note ?? '',
        updatedAt: new Date(),
      },
      advancedConfigHistory: (createDto.advancedConfigHistory ?? []).map(
        (v) => ({
          template: v.template,
          note: v.note,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
        }),
      ),
    } as any;

    const merchant = new this.merchantModel(doc);
    await merchant.save();

    this.businessMetrics.incMerchantCreated();
    this.businessMetrics.incN8nWorkflowCreated();

    let wfId: string | null = null;
    let storefrontCreated = false;

    try {
      // n8n فقط
      wfId = await this.n8n.createForMerchant(merchant.id);
      merchant.workflowId = wfId;

      // ابنِ الـ prompt واحفظ
      merchant.finalPromptTemplate =
        await this.promptBuilder.compileTemplate(merchant);
      await merchant.save();

      // Storefront
      await this.storefrontService.create({
        merchant: merchant.id,
        primaryColor: '#FF8500',
        secondaryColor: '#1976d2',
        buttonStyle: 'rounded',
        banners: [],
        featuredProductIds: [],
        slug: merchant.id.toString(),
      });
      storefrontCreated = true;

      return merchant;
    } catch (err: any) {
      // Rollback خارجي فقط (n8n, storefront). لا شيء مرتبط بالقنوات هنا
      try {
        if (wfId) {
          try {
            await this.n8n.setActive(wfId, false);
          } catch {}
          try {
            await this.n8n.delete(wfId);
          } catch {}
        }
        if (storefrontCreated) {
          try {
            await this.storefrontService.deleteByMerchant(merchant.id);
          } catch {}
        }
      } finally {
        await this.merchantModel.findByIdAndDelete(merchant.id).exec();
      }
      throw new InternalServerErrorException(
        `Initialization failed: ${err?.message || 'unknown'}`,
      );
    }
  }

  /** تحديث تاجر */
  async update(id: string, dto: UpdateMerchantDto): Promise<MerchantDocument> {
    // 1) تأكد من وجود التاجر
    const existing = await this.merchantModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Merchant not found');
    }

    // 2) حضّر كائن التحديث بالتخلص من الحقول undefined
    const updateData: Partial<
      Omit<MerchantDocument, 'createdAt' | 'updatedAt'>
    > = {};
    for (const [key, value] of Object.entries(dto) as [
      keyof typeof dto,
      any,
    ][]) {
      if (value !== undefined) {
        // إذا كان الاشتراك، حوّل التواريخ
        if (key === 'subscription') {
          updateData.subscription = {
            ...value,
            startDate: new Date(value.startDate),
            endDate: value.endDate ? new Date(value.endDate) : undefined,
          };
        }
        // خلاف ذلك انسخ القيمة كما هي
        else {
          (updateData as any)[key] = value;
        }
      }
    }

    // 3) طبق التحديث عبر findByIdAndUpdate لتفعيل runValidators
    const updated = await this.merchantModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new InternalServerErrorException('Failed to update merchant');
    }

    // 4) أعد بناء finalPromptTemplate بحذر
    try {
      updated.finalPromptTemplate =
        await this.promptBuilder.compileTemplate(updated);
      await updated.save();
    } catch (err) {
      this.logger.error('Error compiling prompt template after update', err);
      // لا ترمي الاستثناء، فقط سجلّ الخطأ
    }

    return updated;
  }

  private async ensureBucket(bucket: string) {
    try {
      const exists = await this.minio.bucketExists(bucket);
      if (!exists) {
        await this.minio.makeBucket(
          bucket,
          process.env.MINIO_REGION || 'us-east-1',
        );
        this.logger.log(`Created MinIO bucket: ${bucket}`);
      }
    } catch (e) {
      this.logger.error(`MinIO bucket check/creation failed for ${bucket}`, e);
      throw new InternalServerErrorException('STORAGE_INIT_FAILED');
    }
  }
  async previewPromptV2(id: string, dto: PreviewPromptDto): Promise<string> {
    const m = await this.findOne(id);
    const merged = m.toObject ? m.toObject() : m;

    // دمج quickConfig مؤقتًا (إن وُجد) للمعاينة فقط
    if (dto.quickConfig && Object.keys(dto.quickConfig).length) {
      merged.quickConfig = { ...merged.quickConfig, ...dto.quickConfig };
    }

    const ctx = buildHbsContext(merged, dto.testVars ?? {});
    const audience = dto.audience ?? 'merchant';

    if (audience === 'agent') {
      // Final بالحارس (لا نعرضه في لوحة التاجر عادةً)
      const withGuard = await this.promptBuilder.compileTemplate(merged);
      return Handlebars.compile(withGuard)(ctx);
    }

    // merchant: Final بدون الحارس
    const withGuard = await this.promptBuilder.compileTemplate(merged);
    const noGuard = stripGuardSections(withGuard);
    return Handlebars.compile(noGuard)(ctx);
  }
  async uploadLogoToMinio(
    merchantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const merchant = await this.merchantModel.findById(merchantId).exec();
    if (!merchant) throw new NotFoundException('التاجر غير موجود');

    const bucket = process.env.MINIO_BUCKET!;
    await this.ensureBucket(bucket);

    const ext = this.extFromMime(file.mimetype);
    const key = `merchants/${merchantId}/logo-${Date.now()}.${ext}`;
    this.logger.log(`Uploading merchant logo to MinIO: ${bucket}/${key}`);

    try {
      // نرفع من المسار المؤقت الذي وضعه Multer (dest: ./uploads)
      await this.minio.fPutObject(bucket, key, file.path, {
        'Content-Type': file.mimetype,
      });

      const cdnBase = (process.env.ASSETS_CDN_BASE_URL || '').replace(
        /\/+$/,
        '',
      );
      const minioPublic = (process.env.MINIO_PUBLIC_URL || '').replace(
        /\/+$/,
        '',
      );
      let url: string;

      if (cdnBase) {
        url = `${cdnBase}/${bucket}/${key}`;
      } else if (minioPublic) {
        url = `${minioPublic}/${bucket}/${key}`;
      } else {
        // آخر حل: رابط موقّت (يفضل عدم استخدامه للشعار في الإنتاج)
        url = await this.minio.presignedUrl(
          'GET',
          bucket,
          key,
          7 * 24 * 60 * 60,
        );
      }

      merchant.logoUrl = url;
      await merchant.save();

      this.logger.log(`Logo uploaded and merchant updated. URL=${url}`);
      return url;
    } catch (e: any) {
      this.logger.error('MinIO upload failed', e);
      // لو كانت مشكلة اتصال/إعدادات
      throw new InternalServerErrorException('STORAGE_UPLOAD_FAILED');
    } finally {
      try {
        await unlink(file.path);
      } catch {
        // تجاهل
      }
    }
  }
  /** جلب كل التجار */
  async findAll(): Promise<MerchantDocument[]> {
    return this.merchantModel.find().exec();
  }

  async saveBasicInfo(
    merchantId: string,
    dto: OnboardingBasicDto,
  ): Promise<MerchantDocument> {
    const m = await this.merchantModel.findById(merchantId).exec();
    if (!m) throw new NotFoundException('Merchant not found');

    m.name = dto.name ?? m.name;
    m.logoUrl = dto.logoUrl ?? m.logoUrl;
    m.businessType = dto.businessType ?? m.businessType;
    m.businessDescription = dto.businessDescription ?? m.businessDescription;
    if (dto.phone !== undefined) m.phone = dto.phone;
    if (dto.categories) m.categories = dto.categories;
    if (dto.customCategory) m.customCategory = dto.customCategory;
    if (dto.addresses) m.addresses = dto.addresses;

    await m.save();

    // (اختياري) أعِد بناء prompt بعد اكتمال الأساسيات
    try {
      m.finalPromptTemplate = await this.promptBuilder.compileTemplate(m);
      await m.save();
    } catch {
      this.logger.warn('Prompt compile skipped after basic info');
    }

    return m;
  }
  /** جلب تاجر واحد */
  async findOne(id: string): Promise<MerchantDocument> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');
    // تأكد من تحديث الـ finalPromptTemplate
    merchant.finalPromptTemplate =
      await this.promptBuilder.compileTemplate(merchant);
    return merchant;
  }
  private extFromMime(m: string): string {
    if (m === 'image/png') return 'png';
    if (m === 'image/jpeg') return 'jpg';
    if (m === 'image/webp') return 'webp';
    return 'bin';
  }
  async uploadLogo(id: string, file: Express.Multer.File): Promise<string> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('التاجر غير موجود');

    // حفظ محليًا داخل public/uploads/merchants/:id
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'merchants',
      id,
    );
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = this.extFromMime(file.mimetype);
    const filename = `logo-${Date.now()}.${ext}`;
    const full = path.join(uploadDir, filename);
    await fs.writeFile(full, file.buffer);

    // حدّد الـ Base URL (بيئة) — إن عندك CDN استخدمه
    const base = process.env.CDN_BASE_URL || process.env.APP_BASE_URL || '';

    const publicPath = `/uploads/merchants/${id}/${filename}`;
    const url = base ? `${base}${publicPath}` : publicPath;

    merchant.logoUrl = url;
    await merchant.save();

    return url;
  }
  /** حذف تاجر */
  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.merchantModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Merchant not found');
    return { message: 'Merchant deleted successfully' };
  }

  /** تحقق من نشاط الاشتراك */
  async isSubscriptionActive(id: string): Promise<boolean> {
    const m = await this.findOne(id);
    // إذا لم يُحدد endDate => اشتراك دائم
    if (!m.subscription.endDate) return true;
    return m.subscription.endDate.getTime() > Date.now();
  }

  /** إعادة بناء وحفظ finalPromptTemplate */
  async buildFinalPrompt(id: string): Promise<string> {
    const m = await this.merchantModel.findById(id).exec();
    if (!m) throw new NotFoundException('Merchant not found');
    const tpl = await this.promptBuilder.compileTemplate(m);
    m.finalPromptTemplate = tpl;
    await m.save();
    return tpl;
  }

  /** حفظ نسخة متقدمة جديدة */
  async saveAdvancedVersion(
    id: string,
    newTpl: string,
    note?: string,
  ): Promise<void> {
    await this.versionSvc.snapshot(id, note);
    const m = await this.findOne(id);
    m.currentAdvancedConfig.template = newTpl;
    await m.save();
  }

  /** قائمة النسخ المتقدمة */
  async listAdvancedVersions(id: string): Promise<unknown> {
    return this.versionSvc.list(id);
  }
  /** استرجاع نسخة متقدمة */
  async revertAdvancedVersion(id: string, index: number): Promise<void> {
    await this.versionSvc.revert(id, index);
  }

  /** تحديث الإعداد السريع */
  async updateQuickConfig(
    id: string,
    dto: QuickConfigDto,
  ): Promise<QuickConfig> {
    // جهّز partial التحديث
    const partial: Partial<QuickConfig> = { ...dto };
    Object.keys(partial).forEach(
      (k) =>
        partial[k as keyof QuickConfig] === undefined &&
        delete partial[k as keyof QuickConfig],
    );

    // حدِّث quickConfig وأرجع المستند المحدث من النوع MerchantDocument
    const updatedDoc = await this.merchantModel
      .findByIdAndUpdate<MerchantDocument>(
        id,
        { $set: { quickConfig: partial } },
        { new: true, runValidators: true },
      )
      .select([
        'quickConfig',
        'categories',
        'addresses',
        'workingHours',
        'returnPolicy',
        'exchangePolicy',
        'shippingPolicy',
        'name',
        'currentAdvancedConfig.template',
      ])
      .exec();

    if (!updatedDoc) {
      throw new NotFoundException('Merchant not found');
    }

    // أعد بناء finalPromptTemplate
    const newPrompt = await this.promptBuilder.compileTemplate(updatedDoc);

    await this.merchantModel
      .findByIdAndUpdate(id, { $set: { finalPromptTemplate: newPrompt } })
      .exec();

    // الآن updatedDoc.quickConfig مُعرّفة من MerchantDocument
    return updatedDoc.quickConfig;
  }

  async getStoreContext(merchantId: string) {
    const m = await this.merchantModel
      .findById(merchantId)
      .select([
        'addresses',
        'workingHours',
        'returnPolicy',
        'exchangePolicy',
        'shippingPolicy',
        'phone',
        'socialLinks',
        'productSourceConfig.salla.storeUrl',
        'storefront',
      ])
      .lean();
  
    if (!m) throw new NotFoundException('Merchant not found');
  
    const raw = toRecord((m as any).socialLinks);
    const socials: Record<string, string> = {};
    const SIMPLE = ['facebook','twitter','instagram','linkedin','youtube','website'];
    for (const key of SIMPLE) {
      const v = normUrl(raw[key]); if (v) socials[key] = v;
    }
  
    // ❌ تيليجرام من القنوات — احذفه هنا
    // ✅ واتساب من رقم التاجر كـ fallback
    const waNum = m?.phone ? String(m.phone) : '';
    if (waNum) {
      const digits = waNum.replace(/\D/g, '');
      if (digits) socials.whatsapp = `https://wa.me/${digits}`;
    }
  
    if (!socials.website && m?.productSourceConfig?.salla?.storeUrl) {
      const u = normUrl(m.productSourceConfig.salla.storeUrl);
      if (u) socials.website = u;
    }
  
    let website: string | undefined = socials.website;
    try {
      if (!website && m.storefront) {
        const sf = await this.storefrontService.findByMerchant(merchantId);
        const fromDoc = (sf as any)?.storefrontUrl as string | undefined;
        if (fromDoc) website = normUrl(fromDoc);
        if (!website && (sf as any)?.slug) {
          const base = this.config.get<string>('PUBLIC_STOREFRONT_BASE');
          if (base) website = `${base.replace(/\/+$/, '')}/s/${(sf as any).slug}`;
        }
      }
    } catch {}
  
    if (website && !socials.website) socials.website = website;
  
    return {
      merchantId,
      addresses: m.addresses ?? [],
      workingHours: m.workingHours ?? [],
      policies: {
        returnPolicy: m.returnPolicy || '',
        exchangePolicy: m.exchangePolicy || '',
        shippingPolicy: m.shippingPolicy || '',
      },
      website: website || null,
      socials,
    };
  }
  
  /** معاينة برومبت */
  async previewPrompt(
    id: string,
    testVars: Record<string, string>,
    useAdvanced: boolean,
    quickOverride?: Partial<QuickConfig>, // ← جديد اختياري
  ): Promise<string> {
    const m = await this.findOne(id);

    // إن أرسلت quickOverride ندمجه مؤقتًا للمعاينة
    const mergedMerchant = m.toObject ? m.toObject() : m;
    if (quickOverride && Object.keys(quickOverride).length) {
      mergedMerchant.quickConfig = {
        ...mergedMerchant.quickConfig,
        ...quickOverride,
      };
    }

    const rawTpl =
      useAdvanced && mergedMerchant.currentAdvancedConfig?.template
        ? mergedMerchant.currentAdvancedConfig.template
        : this.promptBuilder.buildFromQuickConfig(
            mergedMerchant as MerchantDocument,
          );

    return this.previewSvc.preview(rawTpl, testVars);
  }

  async ensureWorkflow(merchantId: string): Promise<string> {
    const m = await this.merchantModel
      .findById(merchantId)
      .select('workflowId')
      .exec();
    if (!m) throw new NotFoundException('Merchant not found');
    if (m.workflowId) return String(m.workflowId);
    const wfId = await this.n8n.createForMerchant(merchantId);
    await this.merchantModel
      .updateOne({ _id: merchantId }, { $set: { workflowId: wfId } })
      .exec();
    return wfId;
  }

  async setProductSource(id: string, source: 'internal' | 'salla' | 'zid') {
    const m = await this.merchantModel.findById(id);
    if (!m) throw new NotFoundException('Merchant not found');

    m.productSource = source as any;
    m.productSourceConfig = m.productSourceConfig || {};

    if (source === 'internal') {
      m.productSourceConfig.internal = { enabled: true };
      // عطّل الباقي
      if (m.productSourceConfig.salla)
        m.productSourceConfig.salla.active = false;
      if (m.productSourceConfig.zid) m.productSourceConfig.zid.active = false;
    } else if (source === 'salla') {
      m.productSourceConfig.internal = { enabled: false };
      m.productSourceConfig.salla = {
        ...(m.productSourceConfig.salla || {}),
        active: true,
      };
    } else {
      m.productSourceConfig.internal = { enabled: false };
      m.productSourceConfig.zid = {
        ...(m.productSourceConfig.zid || {}),
        active: true,
      };
    }

    await m.save();
    return m;
  }
  // في merchants.service.ts
  async getStatus(id: string): Promise<MerchantStatusResponse> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');
  
    const isSubscriptionActive = merchant.subscription.endDate
      ? merchant.subscription.endDate > new Date()
      : true;
  
    return {
      status: merchant.status as 'active' | 'inactive' | 'suspended',
      subscription: {
        tier: merchant.subscription.tier,
        status: isSubscriptionActive ? 'active' : 'expired',
        startDate: merchant.subscription.startDate,
        endDate: merchant.subscription.endDate,
      },
      lastActivity: merchant.lastActivity,
      promptStatus: {
        configured: !!merchant.finalPromptTemplate,
        lastUpdated: merchant.updatedAt,
      },
    };
  }
  

  async getAdvancedTemplateForEditor(
    id: string,
    testVars: Record<string, string> = {},
  ) {
    const m = await this.findOne(id);

    const current = m.currentAdvancedConfig?.template?.trim() ?? '';
    if (current) {
      return { template: current, note: m.currentAdvancedConfig?.note ?? '' };
    }

    // لا يوجد قالب متقدّم → نبني اقتراح من Final بدون الحارس
    const finalWithGuard = await this.promptBuilder.compileTemplate(m);
    const noGuard = stripGuardSections(finalWithGuard);

    // نمرّره على Handlebars لتعبئة المتغيرات (إن وجدت)
    const filled = Handlebars.compile(noGuard)(buildHbsContext(m, testVars));

    return { template: filled, note: 'Generated from final (no guard)' };
  }
}
