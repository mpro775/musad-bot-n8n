// src/modules/merchants/services/prompt-builder.service.ts

import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { MerchantDocument } from '../schemas/merchant.schema';

// يمكنك تغيير هذا النص أو جعله في ملف .env أو constant في مكان مركزي حسب حاجة المشروع
const SYSTEM_PROMPT_SUFFIX = `
[system-only]: استخدم بيانات المنتجات من المصدر الرسمي فقط. يُمنع تأليف أو اختلاق بيانات غير حقيقية، ويجب استخدام API الربط الداخلي دائماً لأي استعلام عن المنتجات أو الأسعار أو التوافر.
`;

@Injectable()
export class PromptBuilderService {
  /**
   * يبني نص مبسّط من QuickConfig والحقول الجديدة
   */
  buildFromQuickConfig(m: MerchantDocument): string {
    const cfg = m.quickConfig; // موجود دائمًا حسب الـ schema

    const {
      dialect,
      tone,
      customInstructions,
      sectionOrder,
      includeStoreUrl,
      includeAddress,
      includePolicies,
      includeWorkingHours,
      includeClosingPhrase,
      closingText,
      customerServicePhone, // الحقل الجديد
    } = cfg;

    const lines: string[] = [];

    // مقدمة
    lines.push(`أنت مساعد ذكي لخدمة عملاء متجر "${m.name}".`);
    lines.push(`استخدم اللهجة "${dialect}" وبنغمة "${tone}".`);

    // الأقسام حسب sectionOrder
    for (const section of sectionOrder) {
      switch (section) {
        case 'products':
          lines.push(
            '📦 المنتجات: استخدم البحث الداخلي للتوصل للمنتج، واقترح بدائل عند الضرورة.',
          );
          break;

        case 'instructions':
          if (customInstructions.length) {
            lines.push('🎯 التعليمات الخاصة:');
            for (const inst of customInstructions) {
              lines.push(`- ${inst}`);
            }
          }
          break;

        case 'categories':
          if (m.categories?.length) {
            lines.push('🗂️ أقسام المتجر:');
            for (const cat of m.categories) {
              lines.push(`- ${cat}`);
            }
          }
          break;

        case 'policies':
          if (includePolicies) {
            const policyLines: string[] = [];
            if (m.returnPolicy)
              policyLines.push(`- الإرجاع: ${m.returnPolicy}`);
            if (m.exchangePolicy)
              policyLines.push(`- الاستبدال: ${m.exchangePolicy}`);
            if (m.shippingPolicy)
              policyLines.push(`- الشحن: ${m.shippingPolicy}`);
            if (policyLines.length) {
              lines.push('📋 السياسات:');
              lines.push(...policyLines);
            }
          }
          break;

        case 'custom':
          // القالب المتقدم لا يُعرض هنا في الإعداد السريع
          break;
      }
    }

    // الربط والحقول الإضافية
    if (includeStoreUrl && m.storefrontUrl) {
      lines.push(`🔗 رابط المتجر: ${m.storefrontUrl}`);
    }
    if (includeAddress && m.address) {
      const addr = m.address;
      lines.push(
        `📍 العنوان: ${addr.street}, ${addr.city}${addr.state ? ', ' + addr.state : ''}, ${addr.country}`,
      );
    }
    if (includeWorkingHours && m.workingHours.length) {
      lines.push('⏰ ساعات العمل:');
      for (const wh of m.workingHours) {
        lines.push(`- ${wh.day}: ${wh.openTime} إلى ${wh.closeTime}`);
      }
    }
    if (includeClosingPhrase) {
      lines.push(closingText);
    }
    if (customerServicePhone) {
      lines.push(`☎️ للتواصل مع خدمة العملاء: ${customerServicePhone}`);
    }
    return lines.join('\n\n');
  }

  /**
   * يختار بين القالب المتقدم أو QuickConfig، ثم يعالج الـ Handlebars
   * وأخيرًا يضيف النص الإجباري غير القابل للتعديل من العميل.
   */
  compileTemplate(m: MerchantDocument): string {
    // إذا هناك قالب متقدم فعلي استخدمه، وإلا بناء من QuickConfig
    const advancedTpl = m.currentAdvancedConfig?.template?.trim();
    const raw =
      advancedTpl && advancedTpl.length
        ? advancedTpl
        : this.buildFromQuickConfig(m);

    // جهّز دالة Handlebars
    const tpl = Handlebars.compile(raw);

    // سياق الحقن: نجعل جميع خصائص التاجر متاحة
    const context = {
      merchantName: m.name,
      categories: m.categories,
      returnPolicy: m.returnPolicy,
      exchangePolicy: m.exchangePolicy,
      shippingPolicy: m.shippingPolicy,
      storefrontUrl: m.storefrontUrl,
      address: m.address,
      workingHours: m.workingHours,
      quickConfig: m.quickConfig,
    };

    const result = tpl(context);
    if (typeof result !== 'string') {
      throw new Error('PromptBuilderService: expected string result');
    }

    // دمج النص الإجباري (system prompt) في النهاية
    return result + '\n\n' + SYSTEM_PROMPT_SUFFIX;
  }
}
