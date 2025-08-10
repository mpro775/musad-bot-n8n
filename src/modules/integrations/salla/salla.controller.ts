// src/integrations/salla/salla.controller.ts
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
import { SallaService } from './salla.service';
import { InjectModel } from '@nestjs/mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../../merchants/schemas/merchant.schema';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

@Controller('integrations/salla')
export class SallaController {
  private readonly logger = new Logger(SallaController.name);

  constructor(
    private readonly salla: SallaService,
    private readonly config: ConfigService,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@Req() req: Request, @Res() res: Response) {
    const user: any = (req as any).user;
    const merchant = await this.merchantModel
      .findOne({ userId: user.userId })
      .lean();
    if (!merchant) return res.status(400).send('No merchant for user');

    const state = jwt.sign(
      { merchantId: String(merchant.id), n: Date.now() },
      this.config.get<string>('JWT_SECRET')!,
      { expiresIn: '10m' },
    );
    return res.redirect(this.salla.getOAuthUrl(state));
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
      const decoded = jwt.verify(
        state,
        this.config.get<string>('JWT_SECRET')!,
      ) as { merchantId: string };
      const tokens = await this.salla.exchangeCodeForToken(code);
      await this.salla.upsertIntegration(
        new Types.ObjectId(decoded.merchantId),
        tokens,
      );
      await this.salla.registerDefaultWebhooks(
        new Types.ObjectId(decoded.merchantId),
      );
      return res.redirect(`/dashboard/integrations?provider=salla&connected=1`);
    } catch (err: any) {
      this.logger.error('SALLA CALLBACK ERROR', err?.stack || err);
      return res.redirect(
        `/dashboard/integrations?provider=salla&connected=0&error=${encodeURIComponent(err?.message || 'failed')}`,
      );
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Res() res: Response,
  ) {
    this.logger.log(`Salla webhook received`);
    // راجع توثيق سلة للويبهوكات والاشتراك. :contentReference[oaicite:6]{index=6}
    return res.json({ ok: true });
  }
}
