import { MerchantDocument } from '../schemas/merchant.schema';
export function buildPromptFromMerchant(m: MerchantDocument): string {
  const defaultInclude = {
    products: true,
    instructions: true,
    categories: true,
    policies: true,
    custom: true,
  };
  const cfg = m.promptConfig || {};
  const include = cfg.include || defaultInclude;
  const dialect = cfg.dialect || 'خليجي';
  const tone = cfg.tone || 'ودّي';
  const template = cfg.template || '';
  const categories = m.categories || [];
  const storeurl = m.storeurl || 'https://example.com/';

  const parts: string[] = [];
  parts.push(`أنت مساعد ذكي لخدمة عملاء متجر "${m.name}".`);
  parts.push(`استخدم اللهجة ${dialect} وبنغمة ${tone}.`);

  if (include.products) {
    parts.push(
      '📦 المنتجات: استخدم البحث الداخلي، ثم اقترح بدائل عند الضرورة.',
    );
  }
  if (include.instructions) {
    parts.push('🎯 التعليمات الخاصة:');
    parts.push('- خصم → استخدم كود Berry 🎁');
    parts.push('- فاتورة → أطلب رقم الطلب وغيره.');
    parts.push(`- وش عندكم؟ → ${categories.join('، ')}`);
  }
  if (include.categories && categories.length) {
    parts.push('🗂️ أقسام المتجر:');
    categories.forEach((cat) => parts.push(`- ${cat}`));
  }
  if (include.policies) {
    parts.push('📋 السياسات:');
    if (m.returnPolicy) parts.push(`- الإرجاع: ${m.returnPolicy}`);
    if (m.exchangePolicy) parts.push(`- الاستبدال: ${m.exchangePolicy}`);
    if (m.shippingPolicy) parts.push(`- الشحن: ${m.shippingPolicy}`);
  }
  parts.push(`🔗 رابط المتجر: ${storeurl}`);

  if (include.custom && template.trim()) {
    parts.push('📝 تعليمات مخصصة:');
    parts.push(template.trim());
  }

  parts.push('هل أقدر أساعدك بشي ثاني؟ 😊');
  return parts.join('\n\n');
}
