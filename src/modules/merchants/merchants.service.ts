import {
  BadRequestException,
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
import { ChannelsDto } from './dto/update-channel.dto';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { buildPromptFromMerchant } from './utils/prompt-builder';
import { N8nWorkflowService } from '../n8n-workflow/n8n-workflow.service'; // ← استورد الخدمة
import { OnboardingDto } from './dto/onboarding.dto';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    private http: HttpService,

    private readonly n8n: N8nWorkflowService, // ← حقن الخدمة
  ) {}

  /** إنشاء تاجر جديد مع تهيئة workflow وإعداد القنوات */
  async create(createDto: CreateMerchantDto): Promise<MerchantDocument> {
    // 1) احفظ بيانات التاجر
    // 1) احفظ بيانات التاجر
    const doc = { ...createDto, channels: createDto.channels ?? {} };
    const created = new this.merchantModel(doc);
    await created.save();

    try {
      // 2) أنشئ الـ workflow واحفظ الـ workflowId
      const workflowId = await this.n8n.createForMerchant(
        created.id.toString(),
      );
      created.workflowId = workflowId;
      await created.save();

      // 3) سجّل webhook إذا وُجد botToken
      const botToken = created.channels?.telegram?.botToken;
      if (botToken) {
        const { hookUrl } = await this.registerTelegramWebhook(
          created.id.toString(),
          botToken,
        );

        // 4) هيّئ channels لو كانت undefined ثم حدّثها
        const channels = created.channels ?? {};
        channels.telegram = {
          ...(channels.telegram ?? {}),
          webhookUrl: hookUrl,
        };

        created.channels = channels;
        created.webhookUrl = hookUrl;
        await created.save();
      }

      return created;
    } catch (err) {
      await this.merchantModel.findByIdAndDelete(created.id).exec();
      throw new InternalServerErrorException(`فشل التهيئة: ${err.message}`);
    }
  }

  /** تحديث بيانات التاجر وتحديث إعدادات القنوات عبر channels فقط */
  async update(id: string, dto: UpdateMerchantDto): Promise<MerchantDocument> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');

    // تحديث إعدادات القنوات في حال ورودها
    if ((dto as any).channels) {
      merchant.channels = {
        ...merchant.channels,
        ...(dto as any).channels,
      };
    }

    // تحديث بقية البيانات (مع استبعاد channels لمنع الاستبدال الكامل بالخطأ)
    const fieldsToUpdate = { ...dto };
    delete (fieldsToUpdate as any).channels;
    Object.assign(merchant, fieldsToUpdate);

    merchant.finalPromptTemplate = buildPromptFromMerchant(merchant);
    await merchant.save();

    return merchant;
  }

  /** جلب كل التجار */
  async findAll(): Promise<MerchantDocument[]> {
    return this.merchantModel.find().exec();
  }

  /** جلب تاجر واحد */
  async findOne(
    id: string,
  ): Promise<MerchantDocument & { finalPromptTemplate: string }> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');
    merchant.finalPromptTemplate = buildPromptFromMerchant(merchant);
    return merchant;
  }

  /** حذف التاجر */
  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.merchantModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Merchant not found');
    return { message: 'Merchant deleted successfully' };
  }

  /** فحص حالة الاشتراك */
  async isSubscriptionActive(id: string): Promise<boolean> {
    const merchant = await this.findOne(id);
    return merchant.subscriptionExpiresAt.getTime() > Date.now();
  }

  /** تحديث القنوات بشكل احترافي */
  async updateChannels(
    id: string,
    channelsDto: ChannelsDto,
  ): Promise<MerchantDocument> {
    const merchant = await this.merchantModel.findById(id).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');

    merchant.channels = {
      ...merchant.channels,
      ...channelsDto,
    };

    await merchant.save();
    return merchant;
  }

  async completeOnboarding(
    merchantId: string,
    dto: OnboardingDto,
  ): Promise<{ merchant: MerchantDocument; webhookInfo?: any }> {
    // 1) احضار التاجر
    const merchant = await this.merchantModel.findById(merchantId).exec();
    if (!merchant) throw new NotFoundException('Merchant not found');

    // 2) إنشاء workflow إذا كان مفقوداً
    if (!merchant.workflowId) {
      const wfId = await this.n8n.createForMerchant(merchantId);
      merchant.workflowId = wfId;
      await merchant.save();
    }

    // 3) تجهيز DTO للتحديث
    const updateDto: UpdateMerchantDto = {
      name: dto.name,
      businessType: dto.businessType,
      businessDescription: dto.businessDescription,
      phone: dto.phone,
      whatsappNumber: dto.whatsappNumber,
      storeurl: dto.storeurl,
      apiToken: dto.apiToken,
      webhookUrl: dto.webhookUrl,
    };

    // 4) نفّذ التحديث باستخدام الدالة العامة update()
    const updatedMerchant = await this.update(merchantId, updateDto);

    // 5) تسجيل ويبهوك تيليجرام إذا وُجد توكن
    let webhookInfo;
    if (dto.telegramToken) {
      webhookInfo = await this.registerTelegramWebhook(
        merchantId,
        dto.telegramToken,
      );
    }

    return { merchant: updatedMerchant, webhookInfo };
  }

  /** تفعيل Webhook لقناة تيليجرام باستخدام حقل channels */
  public async registerTelegramWebhook(
    merchantId: string,
    botToken: string,
  ): Promise<{ hookUrl: string; telegramResponse: any }> {
    const merchant = await this.merchantModel.findById(merchantId).exec();
    if (!merchant) throw new NotFoundException('...');
    if (!merchant.workflowId) throw new BadRequestException('...');

    let base = 'https://https://n8n.smartagency-ye.com/';
    if (!base.startsWith('http')) base = `https://${base}`;
    const cleanBase = base.replace(/\/+$/, '');
    const hookUrl = `${cleanBase}/webhook/webhooks/incoming/${merchantId}`;
    this.logger.log(`▶️ Using hookUrl: ${hookUrl}`);

    const telegramApi = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(hookUrl)}`;
    this.logger.log(`▶️ Calling Telegram setWebhook: ${telegramApi}`);
    const resp = await firstValueFrom(this.http.get(telegramApi));

    // حفظ رابط الويبهوك
    await this.merchantModel
      .findByIdAndUpdate(
        merchantId,
        {
          'channels.telegram.webhookUrl': hookUrl,
          webhookUrl: hookUrl,
        },
        { new: true },
      )
      .exec();

    return { hookUrl, telegramResponse: resp.data };
  }

  /** استعلام حالة الاشتراك بتفصيل أكبر */
  async getStatus(id: string) {
    const m = await this.findOne(id);
    const now = Date.now();
    const trialDaysLeft = Math.max(
      0,
      Math.ceil((m.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)),
    );
    const channelsConnected = Object.entries(m.channels || {})
      .filter(([, cfg]) => Boolean(cfg && (cfg as any).enabled))
      .map(([k]) => k);
    return {
      merchantId: id,
      isActive: m.subscriptionExpiresAt.getTime() > now,
      trialEndsAt: m.trialEndsAt,
      subscriptionExpiresAt: m.subscriptionExpiresAt,
      planPaid: m.planPaid,
      trialDaysLeft,
      channelsConnected,
    };
  }
}
