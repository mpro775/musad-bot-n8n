// src/vector/types.ts
export interface EmbeddableProduct {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  category?: string;
  specsBlock?: string[];
  keywords?: string[];
  url?: string;
  price?: number;
  currency?: string;
  attributes?: Record<string, string[]>;
  // عروض:
  hasActiveOffer?: boolean;
  priceOld?: number;
  priceNew?: number;
  priceEffective?: number;
  offerStart?: string; // ISO
  offerEnd?: string;   // ISO
  discountPct?: number;
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
