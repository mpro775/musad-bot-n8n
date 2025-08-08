import { Public } from 'src/common/decorators/public.decorator';
import {
  Body,
  // Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  // Headers,
  // Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ZidService } from './zid.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('auth/zid')
export class ZidController {
  private readonly logger = new Logger(ZidController.name);

  constructor(
    private readonly zidService: ZidService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
  ) {}
  @Public()
  @Get('connect')
  connect(@Res() res: Response) {
    const url = this.zidService.getOAuthUrl();
    return res.redirect(url);
  }
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Res() res: Response,
  ) {
    // 1. تحقق أمان التوقيع (اختياري حسب دعم زد)
    // if (!this.zidSignatureService.isValid(headers, body)) {
    //   this.logger.warn('Invalid webhook signature from Zid');
    //   return res.status(401).json({ ok: false, message: 'Invalid signature' });
    // }

    // 2. سجل كل الطلبات للرجوع وقت الديبق
    this.logger.log(`Received Zid webhook: ${body.event}`);

    const { event, data } = body;

    try {
      switch (event) {
        case 'product.create':
        case 'product.update':
          // يجب تمرير معرف التاجر إذا احتجته (store_id أو merchantId)
          await this.productsService.createOrUpdateFromZid(data.store_id, data);
          break;

        case 'product.delete':
          await this.productsService.removeByExternalId(data.store_id, data.id);
          break;

        case 'order.create':
        case 'order.update':
          await this.ordersService.upsertFromZid(data.store_id, data);
          break;

        case 'order.status.update':
          await this.ordersService.updateOrderStatusFromZid(
            data.store_id,
            data,
          );
          break;

        // يمكنك إضافة أحداث أخرى مثل: المخزون، العملاء، الكوبونات…
        default:
          this.logger.warn(`Unhandled event from Zid: ${event}`);
          break;
      }
      // (يمكنك إرسال response خاص إذا زد تحتاج ذلك)
      return res.json({ ok: true });
    } catch (err) {
      this.logger.error(
        `Webhook handling failed for event ${event}: ${err?.message}`,
        err?.stack,
      );
      return res.status(500).json({ ok: false, error: err?.message });
    }
  }
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      if (!code) return res.status(400).send('Missing code');
      console.log('[ZID CALLBACK] Received code:', code);

      const tokens = await this.zidService.exchangeCodeForToken(code);
      console.log('[ZID CALLBACK] Tokens from Zid:', tokens);

      const userId = '686193862cab82971d21ddcb';

      console.log('[ZID CALLBACK] userId used:', userId);

      await this.zidService.linkStoreToUser(userId, tokens);
      await this.zidService.registerDefaultWebhooks(tokens.access_token);

      return res.redirect(`/dashboard?store_id=${tokens.store_id}`);
    } catch (error) {
      console.error('[ZID CALLBACK ERROR]', error);
      return res.status(500).send('OAuth process failed');
    }
  }
}
