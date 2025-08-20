// src/modules/merchants/services/prompt-preview.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as Handlebars from 'handlebars';

@Injectable()
export class PromptPreviewService {
  /**
   * تُعيد النص بعد استبدال المتغيّرات في القالب الخام
   * وتتحقق أنّ الناتج فعلاً سلسلة نصّية
   */
  preview(rawTemplate: string, context: Record<string, any>): string {
    const tpl: Handlebars.TemplateDelegate = Handlebars.compile(rawTemplate);
    const output: unknown = tpl(context);

    if (typeof output !== 'string') {
      throw new BadRequestException(
        'PromptPreviewService: compiled template did not return a string',
      );
    }
    return output;
  }
}
