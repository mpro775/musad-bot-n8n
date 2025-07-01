// src/vector/types.ts
export interface EmbeddableProduct {
  id: string; // Product._id.toString()
  name: string;
  description?: string;
  category?: string;
  specsBlock?: string[];
  keywords?: string[];
  merchantId: string;
  price?: number;
  url?: string; // ← نضيفه لأننا نستخدمه في Qdrant payload
}
export interface EmbeddableOffer {
  id: string;
  name: string;
  description: string;
  type: string;
  code?: string;
  // أي حقول أخرى مهمة لتوصيف العرض
}
