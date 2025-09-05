// src/vector/types.ts
export interface EmbeddableProduct {
  id: string; // Mongo _id (as string)
  merchantId: string; // as string

  // أساسي
  name: string;
  description?: string;

  // فئة
  categoryId?: string | null;
  categoryName?: string | null;

  // سلاج/روابط
  slug?: string | null;
  storefrontSlug?: string | null;
  domain?: string | null;
  publicUrlStored?: string | null; // إن كنت تخزّنه بمنتجك
  url?: string | null; // سنبنيه كـ absolute

  // تسعير
  price?: number | null;
  priceEffective?: number | null;
  currency?: string | null;

  // عرض
  hasActiveOffer?: boolean;
  priceOld?: number | null;
  priceNew?: number | null;
  offerStart?: string | null; // ISO
  offerEnd?: string | null; // ISO
  discountPct?: number | null;

  // أخرى
  specsBlock?: string[];
  keywords?: string[];
  attributes?: Record<string, string[]>;
  images?: string[]; // أول صورة للعرض في البوت
  isAvailable?: boolean;
  status?: string | null;
  quantity?: number | null;
}

export type FAQData = {
  question?: string;
  answer?: string;
  [key: string]: any;
};
export type DocumentData = {
  text?: string;
  documentId?: string;
  [key: string]: any;
};
export type WebData = { text?: string; url?: string; [key: string]: any };
export interface SearchResult {
  type: 'faq' | 'document' | 'web';
  score: number;
  data: FAQData | DocumentData | WebData;
  id: string | number;
}
export interface EmbeddableOffer {
  id: string;
  name: string;
  description: string;
  type: string;
  code?: string;
  // أي حقول أخرى مهمة لتوصيف العرض
}
export interface BotFaqSearchItem {
  id: string | number;
  question: string;
  answer: string;
  score: number;
}
