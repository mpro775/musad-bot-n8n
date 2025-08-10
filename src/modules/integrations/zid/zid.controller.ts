// src/integrations/zid/zid.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Req,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { ZidService } from './zid.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../../merchants/schemas/merchant.schema';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
interface ZidWebhookPayload {
  event?: string;
  data?: unknown;
  // لو زد يمرر store_id داخل data:
  // data?: { store_id?: string; id?: string; [k: string]: unknown };
}
@Controller('integrations/zid')
export class ZidController {
  private readonly logger = new Logger(ZidController.name);
  constructor(
    private readonly zid: ZidService,
    private readonly config: ConfigService,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@Req() req: Request, @Res() res: Response) {
    // استخرج userId من JWT (حسب تنفيذك للـ guard)
    const user: any = (req as any).user;
    const merchant = await this.merchantModel
      .findOne({ userId: user.userId })
      .lean();
    if (!merchant) return res.status(400).send('No merchant for user');

    // نبني state موقّع يحتوي merchantId + nonce
    const payload = { merchantId: String(merchant.id), n: Date.now() };
    const secret = this.config.get<string>('JWT_SECRET')!;
    const state = jwt.sign(payload, secret, { expiresIn: '10m' });

    const url = this.zid.getOAuthUrl(state);
    return res.redirect(url);
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      if (!code || !state) return res.status(400).send('Missing code/state');
      const secret = this.config.get<string>('JWT_SECRET')!;
      const decoded = jwt.verify(state, secret) as { merchantId: string };
      const merchantId = decoded.merchantId;

      const tokens = await this.zid.exchangeCodeForToken(code);
      await this.zid.upsertIntegration(new Types.ObjectId(merchantId), tokens);
      await this.zid.registerDefaultWebhooks(new Types.ObjectId(merchantId));

      // رجّع للواجهة مع Query تفيد بالنجاح
      return res.redirect(
        `/dashboard/integrations?provider=zid&connected=1&store_id=${tokens.store_id}`,
      );
    } catch (err: any) {
      this.logger.error('ZID CALLBACK ERROR', err?.stack || err);
      return res.redirect(
        `/dashboard/integrations?provider=zid&connected=0&error=${encodeURIComponent(err?.message || 'failed')}`,
      );
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Body() body: ZidWebhookPayload,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Zid webhook: ${body?.event || 'unknown'}`);

      // TODO: إن كان لدى زد توقيع مخصص، تحقّق هنا (header + secret)
      // راجع صفحات ويبهوكات زد لمعرفة الأحداث المدعومة. :contentReference[oaicite:0]{index=0}

      const event = body?.event ?? '';
      switch (event) {
        case 'product.create':
        case 'product.update':
          // await this.productsService.createOrUpdateFromZid(storeId, body.data);
          break;
        case 'product.delete':
          // await this.productsService.removeByExternalId(storeId, productId);
          break;
        case 'order.create':
        case 'order.update':
        case 'order.status.update':
          // await this.ordersService.upsertFromZid(storeId, body.data);
          break;
        default:
          this.logger.warn(`Unhandled Zid event: ${event}`);
      }

      return res.json({ ok: true });
    } catch (err: any) {
      this.logger.error(`Zid webhook error: ${err?.message}`, err?.stack);
      return res.status(500).json({ ok: false, error: err?.message });
    }
  }
}
