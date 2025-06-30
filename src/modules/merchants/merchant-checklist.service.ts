// src/merchants/merchant-checklist.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MerchantDocument } from './schemas/merchant.schema';
import { ProductDocument } from '../products/schemas/product.schema';

export type ChecklistItem = {
  key: string; // معرف رقمي أو نصي لكل عنصر
  title: string; // عنوان قصير
  isComplete: boolean; // الحالة
  message?: string; // رسالة توضيحية إذا ناقص
  actionPath?: string; // رابط الصفحة لإكمال العنصر
};

@Injectable()
export class MerchantChecklistService {
  constructor(
    @InjectModel('Merchant') private merchantModel: Model<MerchantDocument>,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
  ) {}

  async getChecklist(merchantId: string): Promise<ChecklistItem[]> {
    const m = await this.merchantModel.findById(merchantId).lean();
    if (!m) return [];

    const items: ChecklistItem[] = [];

    // — بيانات المتجر —
    items.push({
      key: 'name',
      title: 'اسم المتجر',
      isComplete: !!m.name,
      message: m.name ? undefined : 'يرجى إضافة اسم المتجر',
      actionPath: '/settings/merchant',
    });
    items.push({
      key: 'storeUrl',
      title: 'رابط المتجر',
      isComplete: !!m.storefrontUrl,
      message: m.storefrontUrl ? undefined : 'أضف رابط المتجر لعرضه للعملاء',
      actionPath: '/settings/merchant',
    });
    items.push({
      key: 'logo',
      title: 'شعار المتجر',
      isComplete: !!m.logoUrl,
      message: m.logoUrl && 'ارفع شعار المتجر',
      actionPath: '/settings/merchant',
    });
    items.push({
      key: 'address',
      title: 'عنوان المتجر',
      isComplete:
        !!m.address?.street && !!m.address?.city && !!m.address?.country,
      message: 'اكمل حقول العنوان (الشارع، المدينة، الدولة)',
      actionPath: '/settings/merchant',
    });
    items.push({
      key: 'phone',
      title: 'رقم الجوال الرسمي',
      isComplete: !!m.phone,
      message: 'أضف رقم الجوال الرسمي للاتصال',
      actionPath: '/settings/merchant',
    });

    // — البرومبت —
    items.push({
      key: 'quickConfig',
      title: 'إعدادات البرومبت السريع',
      isComplete: !!m.quickConfig.dialect && !!m.quickConfig.tone,
      message: 'اختر اللهجة والنغمة لتخصيص ردود البوت',
      actionPath: '/onboarding/step3',
    });

    // — المنتجات —
    const productCount = await this.productModel.countDocuments({
      merchantId,
    });
    items.push({
      key: 'products',
      title: 'إضافة منتجات',
      isComplete: productCount > 0,
      message:
        productCount > 0
          ? undefined
          : 'أضف منتجًا واحدًا على الأقل حتى يتمكن البوت من عرضه',
      actionPath: '/dashboard/products/new',
    });

    return items;
  }
}
