// src/modules/channels/channels-dispatcher.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { EvolutionService } from '../integrations/evolution.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class ChannelsDispatcherService {
  constructor(
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
    private readonly evo: EvolutionService,
    private readonly waCloud: WhatsappCloudService,
    private readonly chatGateway: ChatGateway, // للـ webchat
  ) {}

  async send(
    merchantId: string,
    channel: 'telegram' | 'whatsapp' | 'webchat',
    sessionId: string,
    text: string,
    transport?: 'api' | 'qr',
  ) {
    const merchant = await this.merchantModel.findById(merchantId).lean();
    if (!merchant) throw new Error('Merchant not found');

    if (channel === 'telegram') {
      const token = merchant.channels?.telegram?.token;
      if (!token) throw new Error('Telegram not configured');
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: sessionId,
        text,
      });
      return;
    }

    if (channel === 'whatsapp') {
      // حدّد المزود
      const use =
        transport ||
        (await this.waCloud.detectTransport(merchantId, sessionId));
      if (use === 'api') {
        await this.waCloud.sendText(merchantId, sessionId, text);
      } else {
        const s = merchant.channels?.whatsappQr?.sessionId;
        if (!s) throw new Error('WhatsApp QR not configured');
        await this.evo.sendMessage(s, sessionId, text);
      }
      return;
    }

    if (channel === 'webchat') {
      this.chatGateway.sendMessageToSession(sessionId, {
        role: 'bot',
        text,
        ts: Date.now(),
      });
      return;
    }

    throw new Error(`Unsupported channel: ${channel}`);
  }
}
