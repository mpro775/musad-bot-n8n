import { MerchantDocument } from '../schemas/merchant.schema';

export function buildPromptFromMerchant(m: MerchantDocument): string {
  // التحقق من وجود بيانات المتجر الأساسية
  if (!m) throw new Error('بيانات المتجر مطلوبة');
  if (!m.name) throw new Error('اسم المتجر غير محدد');

  // نأخذ quickConfig أو كائن فارغ مع القيم الافتراضية
  const cfg = m.quickConfig ?? {};

  // القيم الأساسية مع القيم الافتراضية
  const dialect = cfg.dialect ?? 'خليجي';
  const tone = cfg.tone ?? 'ودّي';
  const customInstructions = Array.isArray(cfg.customInstructions)
    ? cfg.customInstructions.filter(Boolean)
    : [];

  // ترتيب الأقسام مع القيمة الافتراضية
  const sectionOrder =
    Array.isArray(cfg.sectionOrder) && cfg.sectionOrder.length > 0
      ? cfg.sectionOrder
      : ['products', 'instructions', 'categories', 'policies', 'custom'];

  // الحقول الاختيارية مع القيم الافتراضية
  const includeStoreUrl = cfg.includeStoreUrl ?? true;
  const includeAddress = cfg.includeAddress ?? true;
  const includePolicies = cfg.includePolicies ?? true;
  const includeWorkingHours = cfg.includeWorkingHours ?? true;
  const includeClosingPhrase = cfg.includeClosingPhrase ?? true;
  const closingText = cfg.closingText ?? 'هل أقدر أساعدك بشي ثاني؟ 😊';

  const lines: string[] = [];

  // مقدمة البرومبت
  lines.push(`أنت مساعد ذكي لخدمة عملاء متجر "${m.name.trim()}".`);
  lines.push(`استخدم اللهجة "${dialect}" وبنغمة "${tone}".`);

  // بناء الأقسام حسب الترتيب المحدد
  for (const section of sectionOrder) {
    switch (section) {
      case 'products':
        lines.push(
          '📦 المنتجات: استخدم البحث الداخلي للتوصل للمنتج، واقترح بدائل عند الضرورة.',
        );
        break;

      case 'instructions':
        if (customInstructions.length > 0) {
          lines.push('🎯 التعليمات الخاصة:');
          customInstructions.forEach((inst) => lines.push(`- ${inst}`));
        }
        break;

      case 'categories':
        if (m.categories?.length) {
          lines.push('🗂️ أقسام المتجر:');
          m.categories.forEach((cat) => {
            if (cat) lines.push(`- ${cat}`);
          });
        }
        break;

      case 'policies':
        if (includePolicies) {
          const policyLines: string[] = [];
          if (m.returnPolicy) policyLines.push(`- الإرجاع: ${m.returnPolicy}`);
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
        // قسم مخصص لإضافات مستقبلية
        break;
    }
  }

  // الحقول الاختيارية
  if (includeStoreUrl && m.storefrontUrl) {
    lines.push(`🔗 رابط المتجر: ${m.storefrontUrl}`);
  }

  if (includeAddress && m.addresses) {
    const addrParts = [
      m.addresses[0].street,
      m.addresses[0].city,
      m.addresses[0].state,
      m.addresses[0].country,
    ].filter(Boolean);

    if (addrParts.length) {
      lines.push(`📍 العنوان: ${addrParts.join('، ')}`);
    }
  }

  if (includeWorkingHours && m.workingHours?.length) {
    lines.push('⏰ ساعات العمل:');
    m.workingHours.forEach((wh) => {
      if (wh.day && wh.openTime && wh.closeTime) {
        lines.push(`- ${wh.day}: ${wh.openTime} إلى ${wh.closeTime}`);
      }
    });
  }

  if (includeClosingPhrase) {
    lines.push(closingText);
  }

  return lines.join('\n\n');
}
