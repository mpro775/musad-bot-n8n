// src/merchants/merchant-checklist.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { MerchantDocument } from './schemas/merchant.schema';
import { ProductDocument } from '../products/schemas/product.schema';
import { CategoryDocument } from '../categories/schemas/category.schema';
import { StorefrontService } from '../storefront/storefront.service';

// ✅ القنوات الجديدة
import {
  Channel,
  ChannelDocument,
  ChannelProvider,
  ChannelStatus,
} from '../channels/schemas/channel.schema';

export type ChecklistItem = {
  key: string;
  title: string;
  isComplete: boolean;
  isSkipped?: boolean;
  skippable?: boolean;
  message?: string;
  actionPath?: string;
};

export type ChecklistGroup = {
  key: string;
  title: string;
  items: ChecklistItem[];
};

@Injectable()
export class MerchantChecklistService {
  constructor(
    @InjectModel('Merchant') private merchantModel: Model<MerchantDocument>,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    @InjectModel('Category') private categoryModel: Model<CategoryDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>, // ✅
    private readonly storefrontService: StorefrontService,
  ) {}

  private inferSource(m: MerchantDocument | any): 'internal' | 'salla' | 'zid' {
    const sallaActive = !!m?.productSourceConfig?.salla?.active;
    const zidActive = !!m?.productSourceConfig?.zid?.active;
    if (zidActive) return 'zid';
    if (sallaActive) return 'salla';
    return 'internal';
  }

  // ✅ Helper: جلب قناة افتراضية/مفعّلة لكل مزوّد
  private async getDefaultChannelFor(
    merchantId: string,
    provider: ChannelProvider,
  ) {
    const q = { merchantId: new Types.ObjectId(merchantId), provider, deletedAt: null } as any;
    const def = await this.channelModel.findOne({ ...q, isDefault: true }).lean();
    if (def) return def;
    // fallback: أول قناة مفعلة أو أحدث قناة
    const enabled = await this.channelModel.findOne({ ...q, enabled: true }).sort({ updatedAt: -1 }).lean();
    if (enabled) return enabled;
    return this.channelModel.findOne(q).sort({ updatedAt: -1 }).lean();
  }

  private isConnected(c?: ChannelDocument | null) {
    if (!c) return false;
    // اعتبره مكتملًا عندما enabled=true و status=CONNECTED
    return !!c.enabled && c.status === ChannelStatus.CONNECTED;
  }

  async getChecklist(merchantId: string): Promise<ChecklistGroup[]> {
    const m = await this.merchantModel.findById(merchantId).lean();
    if (!m) return [];

    const source = this.inferSource(m);
    const isInternal = source === 'internal';
    const skipped = Array.isArray((m as any).skippedChecklistItems)
      ? (m as any).skippedChecklistItems
      : [];

    const storefront = await this.storefrontService.findByMerchant(merchantId);

    const [productCount, categoryCount, tgCh, waQrCh, waApiCh, webCh] =
      await Promise.all([
        this.productModel.countDocuments({ merchantId: new Types.ObjectId(merchantId) }),
        this.categoryModel.countDocuments({ merchantId: new Types.ObjectId(merchantId) }),
        this.getDefaultChannelFor(merchantId, ChannelProvider.TELEGRAM),
        this.getDefaultChannelFor(merchantId, ChannelProvider.WHATSAPP_QR),
        this.getDefaultChannelFor(merchantId, ChannelProvider.WHATSAPP_CLOUD),
        this.getDefaultChannelFor(merchantId, ChannelProvider.WEBCHAT),
      ]);

    // 1) معلومات المتجر
    const storeInfo: ChecklistItem[] = [
      {
        key: 'logo',
        title: 'شعار المتجر',
        isComplete: !!m.logoUrl,
        isSkipped: skipped.includes('logo'),
        message: m.logoUrl ? undefined : 'ارفع شعار المتجر',
        actionPath: '/dashboard/marchinfo',
        skippable: true,
      },

      {
        key: 'address',
        title: 'عنوان المتجر',
        isComplete:
          !!m.addresses?.length &&
          !!m.addresses[0]?.street &&
          !!m.addresses[0]?.city &&
          !!m.addresses[0]?.country,
        isSkipped: skipped.includes('address'),
        message: 'اكمل حقول العنوان (الشارع، المدينة، الدولة)',
        actionPath: '/dashboard/marchinfo',
        skippable: true,
      },
    ];

    // 2) قنوات التواصل — ✅ الآن من collection القنوات
    const channels: ChecklistItem[] = [
      {
        key: 'channel_whatsapp_qr',
        title: 'واتساب (QR / Evolution)',
        isComplete: this.isConnected(waQrCh),
        isSkipped: skipped.includes('channel_whatsapp_qr'),
        message: this.isConnected(waQrCh)
          ? undefined
          : 'اربط جلسة Evolution وفعّل الويبهوك',
        actionPath: '/dashboard/channels', // واجهة القنوات الجديدة
        skippable: true,
      },
      {
        key: 'channel_whatsapp_api',
        title: 'واتساب الرسمي (Cloud API)',
        isComplete: this.isConnected(waApiCh),
        isSkipped: skipped.includes('channel_whatsapp_api'),
        message: this.isConnected(waApiCh)
          ? undefined
          : 'أدخل بيانات WABA (Access Token / Phone Number ID / App Secret)',
        actionPath: '/dashboard/channels',
        skippable: true,
      },
      {
        key: 'channel_telegram',
        title: 'تيليجرام',
        isComplete: this.isConnected(tgCh),
        isSkipped: skipped.includes('channel_telegram'),
        message: this.isConnected(tgCh)
          ? undefined
          : 'أدخل توكن البوت واضبط Webhook تلقائياً',
        actionPath: '/dashboard/channels',
        skippable: true,
      },
      {
        key: 'channel_webchat',
        title: 'الويب شات',
        isComplete: this.isConnected(webCh),
        isSkipped: skipped.includes('channel_webchat'),
        message: this.isConnected(webCh)
          ? undefined
          : 'فعّل الويب شات واستخرج كود الويدجت',
        actionPath: '/dashboard/channels',
        skippable: true,
      },
    ];

    // 3) إعدادات البرومبت
    const quickConfig: ChecklistItem[] = [
      {
        key: 'quickConfig_dialect',
        title: 'اختيار اللهجة',
        isComplete: !!m.quickConfig?.dialect,
        isSkipped: skipped.includes('quickConfig_dialect'),
        message: m.quickConfig?.dialect ? undefined : 'اختر لهجة البوت',
        actionPath: '/dashboard/prompt',
        skippable: false,
      },
      {
        key: 'quickConfig_tone',
        title: 'اختيار الاسلوب',
        isComplete: !!m.quickConfig?.tone,
        isSkipped: skipped.includes('quickConfig_tone'),
        message: m.quickConfig?.tone ? undefined : 'حدد نغمة الردود',
        actionPath: '/dashboard/prompt',
        skippable: false,
      },
    ];

    // 4) متفرقات
    const misc: ChecklistItem[] = [];
    if (isInternal) {
      misc.push(
        {
          key: 'categories',
          title: 'تصنيفات المتجر',
          isComplete: categoryCount > 0,
          message: 'حدد تصنيفات المنتجات',
          actionPath: '/dashboard/category',
          skippable: true,
        },
        {
          key: 'configureProducts',
          title: 'اضافة منتجات',
          isComplete: productCount > 0,
          message: productCount > 0 ? undefined : 'أضف منتجًا واحدًا على الأقل',
          actionPath: '/dashboard/products/new',
          skippable: false,
        },
       
        {
          key: 'banners',
          title: 'البانرات',
          isComplete: !!(storefront as any)?.banners?.length,
          message: 'أضف بانرات لمتجرك',
          actionPath: '/dashboard/banners',
          skippable: true,
        },
  
      );
    } else {
      misc.push({
        key: 'syncExternal',
        title: 'مزامنة المنتجات الخارجية',
        isComplete: productCount > 0,
        message: productCount > 0 ? undefined : 'قم بمزامنة المنتجات من المزوّد',
        actionPath: '/onboarding/sync',
        skippable: true,
      });
    }

    misc.push(
      {
        key: 'workingHours',
        title: 'مواعيد العمل',
        isComplete:
          Array.isArray(m.workingHours) &&
          m.workingHours.every((w: any) => w.openTime && w.closeTime),
        message: 'اضبط مواعيد عمل المتجر',
        actionPath: '/dashboard/marchinfo',
        skippable: true,
      },
      {
        key: 'returnPolicy',
        title: 'سياسة الاسترجاع',
        isComplete: !!m.returnPolicy && m.returnPolicy.trim().length > 0,
        message: 'أضف سياسة الاسترجاع',
        actionPath: '/dashboard/marchinfo',
        skippable: true,
      },
      {
        key: 'exchangePolicy',
        title: 'سياسة الاستبدال',
        isComplete: !!m.exchangePolicy && m.exchangePolicy.trim().length > 0,
        message: 'أضف سياسة الاستبدال',
        actionPath: '/dashboard/marchinfo',
        skippable: true,
      },
      {
        key: 'shippingPolicy',
        title: 'سياسة الشحن',
        isComplete: !!m.shippingPolicy && m.shippingPolicy.trim().length > 0,
        message: 'أضف سياسة الشحن',
        actionPath: '/dashboard/marchinfos',
        skippable: true,
      },
    );

    const groups: ChecklistGroup[] = [
      { key: 'storeInfo', title: 'معلومات المتجر', items: storeInfo },
      { key: 'channels', title: 'قنوات التواصل', items: channels },
      { key: 'quickConfig', title: 'إعدادات البرومبت', items: quickConfig },
      { key: 'misc', title: 'متفرقات', items: misc },
    ];

    return groups;
  }
}
