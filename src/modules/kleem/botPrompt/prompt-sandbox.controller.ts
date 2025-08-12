import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import axios from 'axios';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { SandboxDto } from './dto/sandbox.dto';
import { BotPromptService } from './botPrompt.service';
import { SettingsService } from '../settings/settings.service';
import { IntentService } from '../intent/intent.service';
import { CtaService } from '../cta/cta.service';
import { VectorService } from 'src/modules/vector/vector.service';

// helper بسيط لاستبدال المتغيّرات {KEY}
function renderPrompt(tpl: string, vars: Record<string, string>) {
  return (tpl || '').replace(
    /\{([A-Z0-9_]+)\}/g,
    (_, k) => vars[k] ?? `{${k}}`,
  );
}

@Controller('admin/kleem/prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PromptSandboxController {
  private n8n = axios.create({
    baseURL: process.env.N8N_BASE_URL || 'https://n8n.kaleem-ai.com',
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor(
    private readonly prompts: BotPromptService,
    private readonly settings: SettingsService,
    private readonly intent: IntentService,
    private readonly cta: CtaService,
    private readonly vector: VectorService,
  ) {}

  @Post('sandbox')
  async sandbox(@Body() body: SandboxDto) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('text is required');

    // 1) جلب البرومبت النشط + استبدال المتغيّرات من الإعدادات
    const sysTemplate = await this.prompts.getActiveSystemPrompt();
    const s = await this.settings.get();

    let systemPrompt = renderPrompt(sysTemplate, {
      LAUNCH_DATE: s.launchDate,
      APPLY_URL: s.applyUrl,
      INTEGRATIONS_NOW: s.integrationsNow,
      TRIAL_OFFER: s.trialOffer,
      YEMEN_NEXT: s.yemenNext,
      YEMEN_POSITIONING: s.yemenPositioning,
    });

    // 2) اختياري: إرفاق الـKnowledge من FAQs
    let knowledge: { question: string; answer: string; score: number }[] = [];
    if (body.attachKnowledge !== false) {
      const topK = body.topK && body.topK > 0 ? body.topK : 5;
      const kn = await this.vector.searchBotFaqs(text, topK);
      knowledge = kn.map((r) => ({
        question: String(r.question ?? ''),
        answer: String(r.answer ?? ''),
        score: Number(r.score ?? 0),
      }));
      if (knowledge.length) {
        const lines = knowledge
          .map((r) => `- Q: ${r.question}\n  A: ${r.answer}`)
          .join('\n');
        systemPrompt += `\n\n# Knowledge (use if relevant)\n${lines}\n`;
      }
    }

    // 3) تحليلات النية + سياسة CTA
    const highIntent = this.intent.highIntent(text);
    const ctaAllowed = this.cta.allow('sandbox', highIntent); // جلسة ثابتة للساندبوكس

    // 4) إن كانت معاينة فقط، نرجّع الحِزمة دون LLM
    if (body.dryRun) {
      return { systemPrompt, knowledge, highIntent, ctaAllowed };
    }

    // 5) نداء n8n (يفترض وجود Webhook يعيد الرد فورًا)
    const started = Date.now();
    const resp = await this.n8n.post('/webhook-test/webhooks/kleem/sandbox', {
      text,
      prompt: systemPrompt,
    });
    const latencyMs = Date.now() - started;

    const raw = String(
      resp.data?.message ?? resp.data?.text ?? resp.data ?? '',
    );

    // 6) حارس الخصوصية + توازن CTA (خفيف)
    const pii = (s.piiKeywords || []).map((k) =>
      k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const piiRe =
      pii.length > 0 ? new RegExp(pii.join('|'), 'i') : new RegExp('a^'); // لا شيء

    let final = raw;
    if (piiRe.test(final)) {
      final += `\n\nحرصًا على الخصوصية، لا نجمع بيانات شخصية داخل المحادثة. للبدء يوم الإطلاق: ${s.applyUrl}`;
    }
    if (!ctaAllowed) {
      final = final
        .replace(/(صفحة التقديم[:：]?\s*https?:\/\/\S+)/gi, '')
        .replace(/(للبدء يوم الإطلاق[:：]?\s*https?:\/\/\S+)/gi, '')
        .trim();
    } else if (!/https?:\/\/\S+/i.test(final)) {
      final += `\n\nللبدء يوم الإطلاق: ${s.applyUrl}`;
    }

    return {
      systemPrompt,
      knowledge,
      highIntent,
      ctaAllowed,
      result: { raw, final, latencyMs },
    };
  }
}
