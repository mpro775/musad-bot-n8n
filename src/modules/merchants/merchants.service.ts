// src/merchants/merchants.service.ts

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { QuickConfigDto } from './dto/quick-config.dto';
import { N8nWorkflowService } from '../n8n-workflow/n8n-workflow.service';
import { ConfigService } from '@nestjs/config';
import { PromptVersionService } from './services/prompt-version.service';
import { PromptPreviewService } from './services/prompt-preview.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { ChannelDetailsDto, ChannelsDto } from './dto/channel.dto';
import { mapToChannelConfig } from './utils/channel-mapper';
import { MerchantStatusResponse } from './types/types';
import { QuickConfig } from './schemas/quick-config.schema';
import { buildPromptFromMerchant } from './utils/prompt-builder';
import { EvolutionService } from '../integrations/evolution.service';
import { randomUUID } from 'crypto';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly versionSvc: PromptVersionService,
    private readonly evoService: EvolutionService,

    private readonly previewSvc: PromptPreviewService,
    private readonly n8n: N8nWorkflowService,
  ) {}

  async create(createDto: CreateMerchantDto): Promise<MerchantDocument> {
    // 1) حوّل SubscriptionPlanDto إلى SubscriptionPlan
    const subscription = {
      tier: createDto.subscription.tier,
      startDate: new Date(createDto.subscription.startDate),
      endDate: createDto.subscription.endDate
        ? new Date(createDto.subscription.endDate)
        : undefined,
      features: createDto.subscription.features, // مصفوفة الميزات
    };

    // 2) جهّز المستند مع تزويد جميع الحقول الافتراضية
    const doc: any = {
      name: createDto.name,
      storefrontUrl: createDto.storefrontUrl ?? '',
      logoUrl: createDto.logoUrl ?? '',
      addresses: createDto.addresses ?? {},

      subscription,
      categories: createDto.categories ?? [],
      customCategory: createDto.customCategory ?? undefined,

      domain: createDto.domain,
      businessType: createDto.businessType,
      businessDescription: createDto.businessDescription,

      // ساعات العمل
      workingHours: createDto.workingHours ?? [],

      // القنوات تُنشأ فارغة ثم تُملأ لاحقاً
      channels: {},

      // السياسات
      returnPolicy: createDto.returnPolicy ?? '',
      exchangePolicy: createDto.exchangePolicy ?? '',
      shippingPolicy: createDto.shippingPolicy ?? '',

      // إعدادات البرومبت السريعة مع الحقول الجديدة
      quickConfig: {
        dialect: createDto.quickConfig?.dialect ?? 'خليجي',
        tone: createDto.quickConfig?.tone ?? 'ودّي',
        customInstructions: createDto.quickConfig?.customInstructions ?? [],
        sectionOrder: createDto.quickConfig?.sectionOrder ?? [
          'products',
          'policies',
          'custom',
        ],
        includeStoreUrl: createDto.quickConfig?.includeStoreUrl ?? true,
        includeAddress: createDto.quickConfig?.includeAddress ?? true,
        includePolicies: createDto.quickConfig?.includePolicies ?? true,
        includeWorkingHours: createDto.quickConfig?.includeWorkingHours ?? true,
        includeClosingPhrase:
          createDto.quickConfig?.includeClosingPhrase ?? true,
        closingText:
          createDto.quickConfig?.closingText ?? 'هل أقدر أساعدك بشي ثاني؟ 😊',
      },

      // الإعداد المتقدّم الحالي
      currentAdvancedConfig: {
        template: createDto.currentAdvancedConfig?.template ?? '',
        note: createDto.currentAdvancedConfig?.note ?? '',
        updatedAt: new Date(),
      },

      // تاريخ الإصدارات السابقة
      advancedConfigHistory: (createDto.advancedConfigHistory ?? []).map(
        (v) => ({
          template: v.template,
          note: v.note,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
        }),
      ),

      // إعدادات الدردشة
      chatThemeColor: '#D84315',
      chatGreeting: 'مرحباً! كيف أستطيع مساعدتك اليوم؟',
      chatWebhooksUrl: '/api/webhooks',
      chatApiBaseUrl: '',
    };

    // 3) أنشئ الميرشانت واحفظه
    const merchant = new this.merchantModel(doc);
    await merchant.save();

    try {
      // 4) أنشئ الـ workflow
      const wfId = await this.n8n.createForMerchant(merchant.id);
      merchant.workflowId = wfId;

      // 5) دمج القنوات إذا وجدت في DTO
      if (createDto.channels) {
        merchant.channels = {
          whatsapp: mapToChannelConfig(createDto.channels.whatsapp),
          telegram: mapToChannelConfig(createDto.channels.telegram),
          webchat: mapToChannelConfig(createDto.channels.webchat),
        };
      }

      // 6) أعد بناء وحفظ finalPromptTemplate
      merchant.finalPromptTemplate =
        this.promptBuilder.compileTemplate(merchant);
      await merchant.save();

      // 7) تسجيل ويبهوك تيليجرام إن وُجد توكن
      const tgCfg = merchant.channels.telegram;
      if (tgCfg?.token) {
        const { hookUrl } = await this.registerTelegramWebhook(
          merchant.id,
          tgCfg.token,
        );
        merchant.channels.telegram = {
          ...tgCfg,
          enabled: true,
          webhookUrl: hookUrl,
        };
        await merchant.save();
      }

      return merchant;
    } catch (err) {
      // 8) في حال فشل أي خطوة فرعية، احذف الميرشانت
      await this.merchantModel.findByIdAndDelete(merchant.id).exec();
      throw new InternalServerErrorException(
        `Initialization failed: ${err.message}`,
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
      updated.finalPromptTemplate = this.promptBuilder.compileTemplate(updated);
      await updated.save();
    } catch (err) {
      this.logger.error('Error compiling prompt template after update', err);
      // لا ترمي الاستثناء، فقط سجلّ الخطأ
    }

    return updated;
  }
  /** جلب كل التجار */
  async findAll(): Promise<MerchantDocument[]> {
    return this.merchantModel.find().exec();
  }
  async updateLeadsSettings(merchantId: string, settings: any[]): Promise<any> {
    return this.merchantModel.findByIdAndUpdate(
      merchantId,
      { leadsSettings: settings },
      { new: true },
    );
  }
  /** جلب تاجر واحد */
  async findOne(id: string): Promise<MerchantDocument> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');
    // تأكد من تحديث الـ finalPromptTemplate
    merchant.finalPromptTemplate = this.promptBuilder.compileTemplate(merchant);
    return merchant;
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
    const tpl = this.promptBuilder.compileTemplate(m);
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
        'storefrontUrl',
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
    const newPrompt = buildPromptFromMerchant(updatedDoc);
    await this.merchantModel
      .findByIdAndUpdate(id, { $set: { finalPromptTemplate: newPrompt } })
      .exec();

    // الآن updatedDoc.quickConfig مُعرّفة من MerchantDocument
    return updatedDoc.quickConfig;
  }
  /** معاينة برومبت */
  async previewPrompt(
    id: string,
    testVars: Record<string, string>,
    useAdvanced: boolean,
  ): Promise<string> {
    const m = await this.findOne(id);
    const rawTpl =
      useAdvanced && m.currentAdvancedConfig.template
        ? m.currentAdvancedConfig.template
        : this.promptBuilder.buildFromQuickConfig(m);
    return this.previewSvc.preview(rawTpl, testVars);
  }

  /** تحديث القنوات */
  async updateChannels(
    id: string,
    channelType: string,
    channelDetails: ChannelDetailsDto,
  ): Promise<MerchantDocument> {
    const channelsDto: ChannelsDto = {
      [channelType]: channelDetails, // تحديث القناة المحددة فقط
    };
    return this.update(id, { channels: channelsDto });
  }

  /** إكمال onboarding (شمل الحقول الجديدة) */
  async completeOnboarding(
    merchantId: string,
    dto: OnboardingDto,
  ): Promise<{ merchant: MerchantDocument; webhookInfo?: any }> {
    const merchant = await this.merchantModel.findById(merchantId).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');

    if (!merchant.workflowId) {
      merchant.workflowId = await this.n8n.createForMerchant(merchantId);
    }

    // خريطة الحقول
    merchant.name = dto.name;
    merchant.storefrontUrl = dto.storeUrl;
    merchant.logoUrl = dto.logoUrl;
    merchant.businessType = dto.businessType;
    merchant.businessDescription = dto.businessDescription;
    if (dto.addresses) {
      merchant.addresses = dto.addresses;
    }
    if (dto.subscription) {
      merchant.subscription = {
        ...dto.subscription,
        startDate: new Date(dto.subscription.startDate),
        endDate: dto.subscription.endDate
          ? new Date(dto.subscription.endDate)
          : undefined,
      };
    }
    if (dto.phone !== undefined) {
      merchant.phone = dto.phone;
    }
    if (dto.customCategory) merchant.customCategory = dto.customCategory;

    await merchant.save();

    let webhookInfo;
    if (dto.channels?.telegram?.token) {
      merchant.channels.telegram = {
        ...merchant.channels.telegram,
        enabled: true,
        token: dto.channels.telegram.token,
      };
      await merchant.save();
      webhookInfo = await this.registerTelegramWebhook(
        merchantId,
        dto.channels?.telegram?.token,
      );
    }

    return { merchant, webhookInfo };
  }

  /** تسجيل Webhook لتليجرام */
  public async registerTelegramWebhook(
    merchantId: string,
    botToken: string,
  ): Promise<{ hookUrl: string; telegramResponse?: any }> {
    const m = await this.merchantModel.findById(merchantId).exec();
    if (!m || !m.workflowId) {
      throw new BadRequestException('Workflow not initialized');
    }

    const base = this.config.get<string>('N8N_WEBHOOK_BASE');
    if (!base) {
      throw new InternalServerErrorException('N8N_WEBHOOK_BASE not set');
    }

    const hookUrl = `${base.replace(/\/+$/, '')}/webhook/${m.workflowId}/webhooks/incoming/${merchantId}`;
    this.logger.log(`Setting Telegram webhook: ${hookUrl}`);

    let telegramResponse: any;
    try {
      const resp = await firstValueFrom(
        this.http.get(
          `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(hookUrl)}`,
        ),
      );
      telegramResponse = resp.data;
      this.logger.log('Telegram setWebhook response', telegramResponse);
    } catch (err: any) {
      // نسجل الخطأ ولكن لا نفشل الأونبوردنج
      this.logger.error(
        `Failed to set Telegram webhook (ignored): ${err.message}`,
        err.stack,
      );
    }

    // نحفظ الـ webhookUrl دائماً، حتى لو فشل الطلب
    await this.merchantModel
      .findByIdAndUpdate(
        merchantId,
        { 'channels.telegram.webhookUrl': hookUrl },
        { new: true },
      )
      .exec();

    return { hookUrl, telegramResponse };
  }

  // في merchants.service.ts
  // في merchants.service.ts
  async getStatus(id: string): Promise<MerchantStatusResponse> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

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
      channels: {
        whatsapp: {
          enabled: merchant.channels.whatsapp?.enabled || false,
          connected: !!merchant.channels.whatsapp?.token,
        },
        telegram: {
          enabled: merchant.channels.telegram?.enabled || false,
          connected: !!merchant.channels.telegram?.token,
        },
        webchat: {
          enabled: merchant.channels.webchat?.enabled || false,
          connected: !!merchant.channels.webchat?.widgetSettings,
        },
      },
      lastActivity: merchant.lastActivity,
      promptStatus: {
        configured: !!merchant.finalPromptTemplate,
        lastUpdated: merchant.updatedAt,
      },
    };
  }
  async connectWhatsapp(merchantId: string): Promise<{ qr: string }> {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');

    const instanceName = `whatsapp_${merchantId}`;
    let token = merchant.channels.whatsapp?.token;

    // إذا لا يوجد توكن أو الجلسة انتهت، أنشئ توكن جديد
    if (!token || merchant.channels.whatsapp?.status === 'expired') {
      token = randomUUID();
    }

    // حذف الجلسة السابقة لو كانت موجودة (إعادة تهيئة)
    await this.evoService.deleteInstance(instanceName);

    // **استخدم الدالة المحدثة الآن**
    const { qr, instanceId } = await this.evoService.startSession(
      instanceName,
      token,
    );

    // بناء رابط الـ webhook الخاص بالتاجر
    const webhookUrl = `${this.config.get('N8N_WEBHOOK_BASE')}/webhook/${merchant.workflowId}/webhooks/incoming/${merchantId}`;

    // تعيين الـ webhook من جديد
    await this.evoService.setWebhook(
      instanceName,
      webhookUrl,
      ['MESSAGES_UPSERT'],
      true,
      true,
    );

    merchant.channels.whatsapp = {
      ...merchant.channels.whatsapp,
      enabled: true,
      sessionId: instanceName,
      instanceId,
      webhookUrl,
      qr,
      token,
      status: 'pending',
    };
    await merchant.save();

    return { qr };
  }

  async updateWhatsappWebhook(merchantId: string, newWebhookUrl: string) {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant || !merchant.channels.whatsapp?.sessionId)
      throw new NotFoundException('No whatsapp session');

    await this.evoService.setWebhook(
      merchant.channels.whatsapp.sessionId,
      newWebhookUrl,
      ['MESSAGES_UPSERT'],
      true,
      true,
    );

    merchant.channels.whatsapp.webhookUrl = newWebhookUrl;
    await merchant.save();
    return { ok: true };
  }
  // جلب حالة الجلسة
  async getWhatsappStatus(merchantId: string) {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant || !merchant.channels.whatsapp?.sessionId)
      throw new NotFoundException('No whatsapp session');

    const instanceInfo = await this.evoService.getStatus(
      merchant.channels.whatsapp.sessionId,
    );

    if (!instanceInfo) return { status: 'unknown' };

    // هنا صار كل شيء typesafe
    return {
      status: instanceInfo.status || 'unknown',
      instanceName: instanceInfo.instanceName,
      instanceId: instanceInfo.instanceId,
      integration: instanceInfo.integration,
      // أضف أي حقول أخرى تحتاجها للفرونت
    };
  }

  // إرسال رسالة (اختياري)
  async sendWhatsappMessage(merchantId: string, to: string, text: string) {
    const merchant = await this.merchantModel.findById(merchantId);
    if (!merchant || !merchant.channels.whatsapp?.sessionId)
      throw new NotFoundException('No whatsapp session');
    await this.evoService.sendMessage(
      merchant.channels.whatsapp.sessionId,
      to,
      text,
    );
    return { ok: true };
  }
}
