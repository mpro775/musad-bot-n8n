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
    private readonly previewSvc: PromptPreviewService,
    private readonly n8n: N8nWorkflowService,
  ) {}

  async create(createDto: CreateMerchantDto): Promise<MerchantDocument> {
    // 1) حوّل SubscriptionPlanDto إلى SubscriptionPlan
    const subscription = {
      ...createDto.subscription,
      startDate: new Date(createDto.subscription.startDate),
      endDate: createDto.subscription.endDate
        ? new Date(createDto.subscription.endDate)
        : undefined,
    };

    // 2) جهّز المستند بدون تصنيفات TypeScript صارمة
    const doc: any = {
      name: createDto.name,
      storefrontUrl: createDto.storefrontUrl,
      logoUrl: createDto.logoUrl,
      subscription,
      categories: createDto.categories ?? [],
      workingHours: createDto.workingHours ?? [],
      channels: {},
      businessType: createDto.businessType,
      businessDescription: createDto.businessDescription,
      returnPolicy: createDto.returnPolicy,
      exchangePolicy: createDto.exchangePolicy,
      shippingPolicy: createDto.shippingPolicy,
      quickConfig: {
        dialect: createDto.quickConfig?.dialect ?? 'خليجي',
        tone: createDto.quickConfig?.tone ?? 'ودّي',
        customInstructions: createDto.quickConfig?.customInstructions ?? [],
        sectionOrder: createDto.quickConfig?.sectionOrder ?? [
          'products',
          'policies',
          'custom',
        ],
      },
      currentAdvancedConfig: {
        template: createDto.currentAdvancedConfig?.advancedTemplate ?? '',
        note: createDto.currentAdvancedConfig?.note,
        updatedAt: new Date(),
      },
      advancedConfigHistory:
        createDto.advancedConfigHistory?.map((v) => ({
          template: v.advancedTemplate,
          note: v.note,
          updatedAt: new Date(v.updatedAt || Date.now()),
        })) ?? [],
      address: createDto.address, // إذا كان undefined، المينغو يستخدم default({})
    };

    const merchant = new this.merchantModel(doc);
    await merchant.save();

    try {
      // 3) workflow
      const wfId = await this.n8n.createForMerchant(merchant.id);
      merchant.workflowId = wfId;

      // 4) دمج قنوات إن وُجدت
      if (createDto.channels) {
        merchant.channels = {
          whatsapp: mapToChannelConfig(createDto.channels.whatsapp),
          telegram: mapToChannelConfig(createDto.channels.telegram),
          webchat: mapToChannelConfig(createDto.channels.webchat),
        };
      }

      // 5) بناء finalPromptTemplate وحفظ
      merchant.finalPromptTemplate =
        this.promptBuilder.compileTemplate(merchant);
      await merchant.save();

      // 6) تسجيل webhook لتليجرام
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
      await this.merchantModel.findByIdAndDelete(merchant.id).exec();
      throw new InternalServerErrorException(
        `Initialization failed: ${err.message}`,
      );
    }
  }

  /** تحديث تاجر */
  async update(id: string, dto: UpdateMerchantDto): Promise<MerchantDocument> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');

    // 1) تحويل الاشتراك إن وُجد
    if (dto.subscription) {
      merchant.subscription = {
        ...dto.subscription,
        startDate: new Date(dto.subscription.startDate),
        endDate: dto.subscription.endDate
          ? new Date(dto.subscription.endDate)
          : undefined,
      };
    }

    // 2) عنوان إن وُجد
    if (dto.address) {
      merchant.address = dto.address;
    }

    // 3) دمج القنوات
    if (dto.channels) {
      merchant.channels = {
        whatsapp: mapToChannelConfig(
          dto.channels.whatsapp,
          merchant.channels.whatsapp,
        ),
        telegram: mapToChannelConfig(
          dto.channels.telegram,
          merchant.channels.telegram,
        ),
        webchat: mapToChannelConfig(
          dto.channels.webchat,
          merchant.channels.webchat,
        ),
      };
    }

    // 4) بقية الحقول البسيطة
    const {
      subscription,
      address,
      channels,
      quickConfig,
      currentAdvancedConfig,
      advancedConfigHistory,
      ...rest
    } = dto as any;
    Object.assign(merchant, rest);
    console.log({ subscription, address, channels, quickConfig }); // أو أي استخدام آخر

    // 5) خصائص الـ prompt المركّبة إن وُجدت
    // داخل update() في MerchantsService
    const qc = dto.quickConfig;
    if (qc) {
      merchant.quickConfig = {
        // الحقول الأصلية
        dialect: qc.dialect ?? merchant.quickConfig.dialect,
        tone: qc.tone ?? merchant.quickConfig.tone,
        customInstructions:
          qc.customInstructions ?? merchant.quickConfig.customInstructions,
        sectionOrder: qc.sectionOrder ?? merchant.quickConfig.sectionOrder,

        // الحقول الجديدة
        includeStoreUrl:
          qc.includeStoreUrl ?? merchant.quickConfig.includeStoreUrl,
        includeAddress:
          qc.includeAddress ?? merchant.quickConfig.includeAddress,
        includePolicies:
          qc.includePolicies ?? merchant.quickConfig.includePolicies,
        includeWorkingHours:
          qc.includeWorkingHours ?? merchant.quickConfig.includeWorkingHours,
        includeClosingPhrase:
          qc.includeClosingPhrase ?? merchant.quickConfig.includeClosingPhrase,
        closingText: qc.closingText ?? merchant.quickConfig.closingText,
      };
    }
    if (currentAdvancedConfig) {
      merchant.currentAdvancedConfig.template = currentAdvancedConfig.template;
      merchant.currentAdvancedConfig.note = currentAdvancedConfig.note;
    }
    if (advancedConfigHistory) {
      merchant.advancedConfigHistory = advancedConfigHistory.map((v) => ({
        template: v.template,
        note: v.note,
        updatedAt: new Date(v.updatedAt || Date.now()),
      }));
    }

    // 6) إعادة بناء finalPromptTemplate
    merchant.finalPromptTemplate = this.promptBuilder.compileTemplate(merchant);

    await merchant.save();
    return merchant;
  }
  /** جلب كل التجار */
  async findAll(): Promise<MerchantDocument[]> {
    return this.merchantModel.find().exec();
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
        'address',
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
    channelType: 'whatsapp' | 'telegram' | 'webchat', // تحديد نوع القناة
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
    if (dto.address) {
      merchant.address = dto.address;
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
  ): Promise<{ hookUrl: string; telegramResponse: any }> {
    const m = await this.merchantModel.findById(merchantId).exec();
    if (!m || !m.workflowId) {
      throw new BadRequestException('Workflow not initialized');
    }

    const base = this.config.get<string>('N8N_WEBHOOK_BASE');
    if (!base)
      throw new InternalServerErrorException('N8N_WEBHOOK_BASE not set');

    const hookUrl =
      `${base.replace(/\/+$/, '')}` +
      `/webhook/${m.workflowId}/webhooks/incoming/${merchantId}`;

    this.logger.log(`Setting Telegram webhook: ${hookUrl}`);

    const resp = await firstValueFrom(
      this.http.get(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(hookUrl)}`,
      ),
    );

    // احفظ عنوان الويبهوك ضمن القناة
    await this.merchantModel
      .findByIdAndUpdate(
        merchantId,
        { 'channels.telegram.webhookUrl': hookUrl },
        { new: true },
      )
      .exec();

    return { hookUrl, telegramResponse: resp.data };
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
}
