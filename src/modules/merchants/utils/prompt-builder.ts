// src/merchants/utils/prompt-builder.ts

import { MerchantDocument } from '../schemas/merchant.schema';

export function buildPromptFromMerchant(m: MerchantDocument): string {
  const qc = m.quickConfig;
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
  } = qc;

  const categories = m.categories || [];
  const storeUrl = m.storefrontUrl;
  const address = m.address;
  const workingHours = m.workingHours || [];
  const advancedTpl = m.currentAdvancedConfig.template.trim();

  const parts: string[] = [];

  // مقدمة ثابتة
  parts.push(`أنت مساعد ذكي لخدمة عملاء متجر "${m.name}".`);
  parts.push(`استخدم اللهجة "${dialect}" وبنغمة "${tone}".`);

  sectionOrder.forEach((section) => {
    switch (section) {
      case 'products':
        parts.push(
          '📦 المنتجات: استخدم البحث الداخلي للتوصل للمنتج واقترح بدائل عند الضرورة.',
        );
        break;

      case 'instructions':
        if (customInstructions.length) {
          parts.push('🎯 التعليمات الخاصة:');
          customInstructions.forEach((inst) => parts.push(`- ${inst}`));
        }
        break;

      case 'categories':
        if (categories.length) {
          parts.push('🗂️ أقسام المتجر:');
          categories.forEach((cat) => parts.push(`- ${cat}`));
        }
        break;

      case 'policies':
        if (includePolicies) {
          const lines: string[] = [];
          if (m.returnPolicy) lines.push(`- الإرجاع: ${m.returnPolicy}`);
          if (m.exchangePolicy) lines.push(`- الاستبدال: ${m.exchangePolicy}`);
          if (m.shippingPolicy) lines.push(`- الشحن: ${m.shippingPolicy}`);
          if (lines.length) {
            parts.push('📋 السياسات:');
            lines.forEach((ln) => parts.push(ln));
          }
        }
        break;

      case 'custom':
        if (advancedTpl) {
          parts.push('📝 قالب متقدم:');
          parts.push(advancedTpl);
        }
        break;
    }
  });

  // خيارات سهل config الإضافية
  if (includeStoreUrl && storeUrl) {
    parts.push(`🔗 رابط المتجر: ${storeUrl}`);
  }

  if (includeAddress && address) {
    parts.push(
      `📍 العنوان: ${address.street}, ${address.city}${
        address.state ? ', ' + address.state : ''
      }, ${address.country}`,
    );
  }

  if (includeWorkingHours && workingHours.length) {
    parts.push('⏰ ساعات العمل:');
    workingHours.forEach((wh) =>
      parts.push(`- ${wh.day}: ${wh.openTime} إلى ${wh.closeTime}`),
    );
  }

  // الخاتمة
  if (includeClosingPhrase) {
    parts.push(closingText);
  }

  return parts.join('\n\n');
}
