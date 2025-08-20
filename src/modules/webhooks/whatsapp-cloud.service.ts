import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Merchant, MerchantDocument } from "../merchants/schemas/merchant.schema";
import axios from "axios";

@Injectable()
export class WhatsappCloudService {
  private base = 'https://graph.facebook.com/v19.0';
  constructor(
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
  ) {}

  async detectTransport(
    merchantId: string,
    sessionId: string,
  ): Promise<'api' | 'qr'> {
    // استرجع من وثيقة الجلسة/المحادثة (مثلاً BotChatSession.transport)
    // أو افحص آخر رسالة واردة
    // fallback:
    return 'api';
  }

  private async creds(merchantId: string) {
    const m = await this.merchantModel.findById(merchantId).lean();
    const api = m?.channels?.whatsappApi;
    if (!api?.accessToken || !api?.phoneNumberId) {
      throw new Error('WhatsApp Cloud API not configured');
    }
    return { token: api.accessToken, phoneNumberId: api.phoneNumberId };
  }

  async sendText(merchantId: string, to: string, text: string) {
    const { token, phoneNumberId } = await this.creds(merchantId);
    await axios.post(
      `${this.base}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }
}
