import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import {
  SendMessageResponse,
  SetWebhookResponse,
  StatusResponse,
} from '../merchants/types/evolution.types';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl = 'http://31.97.155.167:8080';
  private readonly apiKey = 'any-secret-key';

  private getHeaders() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /** حذف الجلسة إذا كانت موجودة ثم إنشاء جديدة بتوكن جديد */
  async ensureFreshInstance(
    instanceName: string,
  ): Promise<{ qr: string; token: string }> {
    // 1. حذف الجلسة القديمة لو موجودة
    try {
      await this.getStatus(instanceName);
      this.logger.log(`Instance ${instanceName} already exists. Deleting...`);
      await this.deleteInstance(instanceName);
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
    }
    // 2. أنشئ توكن جديد
    const token = uuidv4();
    // 3. أنشئ جلسة جديدة (ترجع qr + token)
    const { qr } = await this.startSession(instanceName, token);
    return { qr, token };
  }

  /** حذف الجلسة */
  async deleteInstance(instanceName: string): Promise<void> {
    const url = `${this.baseUrl}/instance/delete/${instanceName}`;
    try {
      await axios.delete(url, { headers: this.getHeaders() });
      this.logger.log(`Instance ${instanceName} deleted successfully.`);
    } catch (err: any) {
      this.logger.error(
        'deleteInstance failed',
        err.response?.data || err.message,
      );
      if (err.response?.status !== 404) throw err;
    }
  }

  /** بدء جلسة جديدة وإرجاع qr + token */
  async startSession(
    instanceName: string,
    token: string,
  ): Promise<{ qr: string; token: string }> {
    const url = `${this.baseUrl}/instance/create`;
    try {
      const res = await axios.post(
        url,
        {
          instanceName,
          token,
          qrcode: true, // <-- ضروري لإرجاع QR
        },
        { headers: this.getHeaders() },
      );
      const qr = res.data?.qrcode?.base64 || '';
      return { qr, token };
    } catch (err: any) {
      this.logger.error(
        'startSession failed',
        err.response?.data || err.message,
      );
      throw err;
    }
  }

  /** جلب حالة الجلسة (متصل/ينتظر..) */
  async getStatus(instanceName: string): Promise<StatusResponse> {
    const url = `${this.baseUrl}/instance/connectionState/${instanceName}`;
    try {
      const res = await axios.get<StatusResponse>(url, {
        headers: this.getHeaders(),
      });
      return res.data;
    } catch (err: any) {
      this.logger.error('getStatus failed', err.response?.data || err.message);
      throw err;
    }
  }

  /** إرسال رسالة */
  async sendMessage(
    instanceName: string,
    to: string,
    message: string,
  ): Promise<SendMessageResponse> {
    const url = `${this.baseUrl}/message/sendText`;
    try {
      const res = await axios.post<SendMessageResponse>(
        url,
        { instanceName, to, message },
        { headers: this.getHeaders() },
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(
        'sendMessage failed',
        err.response?.data || err.message,
      );
      throw err;
    }
  }

  /** تعيين webhook */
  async setWebhook(
    instanceName: string,
    webhookUrl: string,
  ): Promise<SetWebhookResponse> {
    const url = `${this.baseUrl}/instance/webhook`;
    try {
      const res = await axios.post<SetWebhookResponse>(
        url,
        {
          instanceName,
          webhook: webhookUrl,
          events: ['onMessage'],
        },
        { headers: this.getHeaders() },
      );
      return res.data;
    } catch (err: any) {
      this.logger.error('setWebhook failed', err.response?.data || err.message);
      throw err;
    }
  }
}
