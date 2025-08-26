// src/modules/webhooks/whatsapp-qr.webhook.controller.ts
import {
    Body, Controller, ForbiddenException, NotFoundException, Param, Post, Req,
  } from '@nestjs/common';
  import { Public } from 'src/common/decorators/public.decorator';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import { ConfigService } from '@nestjs/config';
  import { Channel, ChannelDocument, ChannelStatus } from '../channels/schemas/channel.schema';
  import { WebhooksController } from './webhooks.controller'; // لإعادة استخدام المعالجة الموحّدة
  import { mapEvoStatus } from '../channels/utils/evo-status.util';
  
  @Public()
  @Controller('webhooks/whatsapp_qr')
  export class WhatsappQrWebhookController {
    constructor(
      @InjectModel(Channel.name) private readonly channelModel: Model<ChannelDocument>,
      private readonly config: ConfigService,
      private readonly webhooksController: WebhooksController,
    ) {}
  
    @Post(':channelId')
    async incoming(
      @Param('channelId') channelId: string,
      @Req() req: any,
      @Body() body: any,
    ) {
      // تحقّق اختياري: لو أرسلت Evolution هيدر apikey نلزمه يطابق مفاتيحنا
      const got = req.headers['apikey'] || req.headers['x-evolution-apikey'];
      const expected = this.config.get<string>('EVOLUTION_APIKEY');
      if (got && expected && got !== expected) {
        throw new ForbiddenException('Bad apikey');
      }
  
      const ch = await this.channelModel.findById(channelId);
      if (!ch) throw new NotFoundException('channel not found');
  
      // حدّث حالة القناة لو وصلتنا حالة من Evolution (connected/…)
      const evoState =
        body?.status || body?.instance?.status || body?.connection || body?.event?.status;
      const mapped = mapEvoStatus(evoState);
      if (mapped) {
        ch.status = mapped;
        if (mapped === ChannelStatus.CONNECTED) ch.qr = undefined;
        await ch.save();
      }
  
      // مرّر الحمولة كما هي (أو طبّعها) إلى المعالج الموحّد:
      // ملاحظة: handleIncoming عندك أصلاً (مستخدَم في تيليجرام)
      return this.webhooksController.handleIncoming(String(ch.merchantId), {
        provider: 'whatsapp_qr',
        channelId,
        raw: body,
      }, req);
    }
  }
  