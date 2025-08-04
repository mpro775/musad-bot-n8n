// ---------------------------
// File: src/modules/webhooks/webhooks.controller.ts
// ---------------------------
import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from '../messaging/message.service';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { normalizeIncomingMessage } from './schemas/utils/normalize-incoming';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { OrdersService } from '../orders/orders.service';
import {
  buildOrderDetailsMessage,
  buildOrdersListMessage,
} from './helpers/order-format';
import { mapOrderDocumentToOrder } from './helpers/order-map';
import {
  downloadRemoteFile,
  downloadTelegramFile,
} from './schemas/utils/download-files';
import { ChatMediaService } from '../media/chat-media.service';
function detectOrderIntent(msg: string): {
  step: string;
  orderId?: string;
  phone?: string;
} {
  const phoneRegex = /^77\d{7}$/;
  const orderIdRegex = /^[0-9a-fA-F]{24}$/;

  msg = msg.trim();

  if (orderIdRegex.test(msg)) {
    return { step: 'orderDetails', orderId: msg };
  } else if (msg.includes('تفاصيل الطلب')) {
    const idMatch = msg.match(/[0-9a-fA-F]{24}/);
    if (idMatch) return { step: 'orderDetails', orderId: idMatch[0] };
  }
  if (phoneRegex.test(msg)) {
    return { step: 'orders', phone: msg };
  } else if (/طلباتي|حاله طلبي|الطلب/.test(msg)) {
    return { step: 'askPhone' };
  }
  return { step: 'normal' };
}

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly messageService: MessageService,
    private readonly ordersServices: OrdersService,
    private readonly chatMediaService: ChatMediaService,
    @InjectModel(Merchant.name)
    private readonly merchantModel: Model<MerchantDocument>,
  ) {}
  async sendReplyToChannel({ sessionId, text, channel, merchantId }) {
    const merchant = await this.merchantModel.findById(merchantId).lean();
    if (!merchant) {
      throw new Error('Merchant not found');
    }
    if (channel === 'telegram') {
      if (!merchant.channels?.telegram || !merchant.channels.telegram.token) {
        throw new Error('Telegram channel is not configured for this merchant');
      }
      const telegramToken = merchant.channels.telegram.token;
      await axios.post(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          chat_id: sessionId,
          text,
        },
      );
    } else if (channel === 'whatsapp') {
      if (
        !merchant.channels?.whatsapp ||
        !merchant.channels.whatsapp.instanceId
      ) {
        throw new Error('WhatsApp channel is not configured for this merchant');
      }
      const instanceId = merchant.channels.whatsapp.instanceId;
      await axios.post(
        `http://your-whatsapp-api/message/sendText/${instanceId}`,
        {
          number: sessionId,
          textMessage: { text },
        },
      );
    } else if (channel === 'webchat') {
      // socket.emit('botReply', { sessionId, text });
    }
  }
  @Public()
  @Post('incoming/:merchantId')
  async handleIncoming(
    @Param('merchantId') merchantId: string,
    @Body() body: any,
  ) {
    // 1. Normalize الرسالة
    const normalized = normalizeIncomingMessage(body, merchantId);
    if (normalized.fileId || normalized.fileUrl) {
      let tmpPath: string | undefined;
      let originalName: string | undefined;
      const mimeType: string =
        normalized.mimeType || 'application/octet-stream';

      // Telegram
      if (normalized.channel === 'telegram' && normalized.fileId) {
        const merchant = await this.merchantModel.findById(merchantId).lean();
        const telegramToken = merchant?.channels?.telegram?.token;
        if (!telegramToken) throw new Error('Telegram token missing');
        const dl = await downloadTelegramFile(normalized.fileId, telegramToken);
        tmpPath = dl.tmpPath;
        originalName = normalized.fileName || dl.originalName;
      }
      // WhatsApp/WebChat أو أي رابط مباشر
      else if (normalized.fileUrl) {
        const dl = await downloadRemoteFile(
          normalized.fileUrl,
          normalized.fileName,
        );
        tmpPath = dl.tmpPath;
        originalName = normalized.fileName || dl.originalName;
      }
      if (!originalName) originalName = 'file';

      // رفع الملف على MinIO
      if (!tmpPath) throw new Error('File path missing');
      const { presignedUrl } = await this.chatMediaService.uploadChatMedia(
        merchantId,
        tmpPath,
        originalName,
        mimeType,
      );

      // حفظ الرسالة مع معلومات الملف
      await this.messageService.createOrAppend({
        merchantId,
        sessionId: normalized.sessionId,
        channel: normalized.channel,
        messages: [
          {
            role: normalized.role,
            text: normalized.text || '[تم استقبال ملف]',
            timestamp: normalized.timestamp,
            metadata: {
              ...normalized.metadata,
              mediaUrl: presignedUrl,
              mediaType: normalized.mediaType,
              fileName: originalName,
              mimeType,
            },
          },
        ],
      });

      // يمكن إرسال النص المستخرج للذكاء الاصطناعي، أو فقط رسالة وصول الملف
      return { status: 'ok', sessionId: normalized.sessionId };
    }
    if (
      !normalized.merchantId ||
      !normalized.sessionId ||
      !normalized.text ||
      !normalized.channel
    ) {
      throw new BadRequestException('Payload missing required fields');
    }

    // 2. خزّن الرسالة
    const session = await this.messageService.createOrAppend({
      merchantId: normalized.merchantId,
      sessionId: normalized.sessionId,
      channel: normalized.channel,
      messages: [
        {
          role: normalized.role,
          text: normalized.text,
          timestamp: normalized.timestamp,
          metadata: normalized.metadata,
        },
      ],
    });
    const intent = detectOrderIntent(normalized.text);

    if (intent.step === 'orderDetails') {
      // هنا جلب الطلب من DB أو خدمة منفصلة
      const order = await this.ordersServices.findOne(intent.orderId!);
      const reply = buildOrderDetailsMessage(order);
      await this.sendReplyToChannel({
        sessionId: normalized.sessionId,
        text: reply.text,
        channel: normalized.channel,
        merchantId,
      });
      return {
        sessionId: normalized.sessionId,
        action: 'orderDetails',
        handoverToAgent: false,
        role: normalized.role,
      };
    }

    if (intent.step === 'orders') {
      // جلب الطلبات من DB
      const ordersFromDb = await this.ordersServices.findByCustomer(
        merchantId,
        intent.phone!,
      );
      const orders = ordersFromDb.map(mapOrderDocumentToOrder);

      const reply = buildOrdersListMessage(orders);
      await this.sendReplyToChannel({
        sessionId: normalized.sessionId,
        text: reply.text,
        channel: normalized.channel,
        merchantId,
      });
      return {
        sessionId: normalized.sessionId,
        action: 'ordersList',
        handoverToAgent: false,
        role: normalized.role,
      };
    }

    if (intent.step === 'askPhone') {
      const reply = { text: 'يرجى تزويدنا برقم الجوال الذي تم الطلب به.' };
      await this.sendReplyToChannel({
        sessionId: normalized.sessionId,
        text: reply.text,
        channel: normalized.channel,
        merchantId,
      });
      return {
        sessionId: normalized.sessionId,
        action: 'askPhone',
        handoverToAgent: false,
        role: normalized.role,
      };
    }

    // منطق handover أو وكيل (كما هو عندك)
    const messages = session.messages;
    const lastRole = messages.length
      ? messages[messages.length - 1].role
      : 'customer';
    const isHandover = session.handoverToAgent === true;

    const merchant = await this.merchantModel.findById(merchantId).lean();
    const isBotEnabled =
      merchant?.channels?.[normalized.channel]?.enabled === true;

    if (lastRole === 'agent' || isHandover) {
      return {
        sessionId: normalized.sessionId,
        action: 'wait_agent',
        handoverToAgent: true,
        role: normalized.role,
      };
    }
    try {
      // الآن: أي رسالة لم يتم التقاطها كـ intent (أي step: 'normal') تذهب للذكاء الاصطناعي
      if (lastRole === 'customer' && !isHandover && isBotEnabled) {
        // أرسل الرسالة إلى n8n مباشرة
        await axios.post(
          `https://n8n.smartagency-ye.com/webhook-test/webhook/ai-agent`,
          {
            merchantId: normalized.merchantId,
            sessionId: normalized.sessionId,
            channel: normalized.channel,
            text: normalized.text,
          },
        );
        return {
          sessionId: normalized.sessionId,
          action: 'ask_ai',
          handoverToAgent: false,
          role: normalized.role,
        };
      }

      return {
        sessionId: normalized.sessionId,
        action: 'wait',
        handoverToAgent: !!session.handoverToAgent,
        role: normalized.role,
      };
    } catch (err) {
      // لو حصل أي خطأ، سجله لكن أرسل 200 للويب هوك!
      console.error('Webhook error:', err);
      return {
        sessionId: normalized.sessionId,
        status: 'received_with_error',
        error: err.message,
      };
    }
  }
  @Public()
  @Post('bot-reply/:merchantId')
  async handleBotReply(
    @Param('merchantId') merchantId: string,
    @Body() body: any,
  ) {
    const { sessionId, text, channel, metadata } = body;
    if (!merchantId || !sessionId || !text || !channel) {
      throw new BadRequestException('Payload missing required fields');
    }

    // خزّن الرسالة role='bot' في الجلسة
    await this.messageService.createOrAppend({
      merchantId,
      sessionId,
      channel,
      messages: [
        {
          role: 'bot',
          text,
          timestamp: new Date(),
          metadata: metadata || {},
        },
      ],
    });

    // أرسل الرد للعميل في القناة المناسبة
    await this.sendReplyToChannel({ sessionId, text, channel, merchantId });

    return { sessionId, status: 'ok' };
  }
  @Post('agent-reply/:merchantId')
  async handleAgentReply(
    @Param('merchantId') merchantId: string,
    @Body() body: any,
  ) {
    const { sessionId, text, channel, metadata, agentId } = body;
    if (!merchantId || !sessionId || !text || !channel) {
      throw new BadRequestException('Payload missing required fields');
    }

    // خزّن الرسالة role='agent' في الجلسة
    await this.messageService.createOrAppend({
      merchantId,
      sessionId,
      channel,
      messages: [
        {
          role: 'agent',
          text,
          timestamp: new Date(),
          metadata: { ...metadata, agentId },
        },
      ],
    });

    // أرسل الرد للعميل في القناة المناسبة
    await this.sendReplyToChannel({ sessionId, text, channel, merchantId });

    return { sessionId };
  }
}
