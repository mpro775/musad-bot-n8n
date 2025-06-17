// src/modules/prompt/prompt-builder.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptBuilderService {
  /**
   * يبني برومبت المستخدم للـ LLM:
   * 1) يبدأ بـ merchant.finalPromptTemplate الذي يحتوي:
   *    - معلومات المتجر
   *    - السياسات
   *    - (ضمنياً) تعليمات استدعاء الأدوات دون ظهورها للعميل
   * 2) يدمج سجل المحادثة (اختياري)
   * 3) يضيف سؤال العميل فقط
   */
  buildPrompt(params: {
    merchant: any;
    message: string;
    chatHistory?: Array<{ role: 'customer' | 'ai'; text: string }>;
  }): string {
    const { merchant, message, chatHistory = [] } = params;

    // 1) أساس البرومبت من finalPromptTemplate
    let prompt: string = merchant.finalPromptTemplate;
    if (!prompt) {
      throw new Error(
        'finalPromptTemplate is missing on merchant. Ensure it is generated in the merchant schema pre-save hook.',
      );
    }

    // 2) دمج سجل المحادثة إن وجد
    if (chatHistory.length > 0) {
      const historyBlock = chatHistory
        .map(
          (m) => `[${m.role === 'customer' ? 'العميل' : 'المساعد'}]: ${m.text}`,
        )
        .join('\n');
      prompt += `\n\n## سجل المحادثة:\n${historyBlock}`;
    }

    // 3) إضافة سؤال العميل في النهاية
    prompt += `\n\n## سؤال العميل:\n${message}`;

    return prompt;
  }
}
