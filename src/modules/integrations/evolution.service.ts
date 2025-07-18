import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface EvolutionWebhookResponse {
  webhook?: {
    instanceName: string;
    webhook: {
      url: string;
      webhook_by_events: boolean;
      webhook_base64: boolean;
      events: string[];
      enabled: boolean;
    };
  };
  [key: string]: any;
}
@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl = 'http://31.97.155.167:8080';
  private readonly apiKey = 'any-secret-key';

  private getHeaders() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    };
  }

  /** حذف الجلسة إذا كانت موجودة ثم إنشاء جديدة بتوكن جديد */
  async ensureFreshInstance(
    instanceName: string,
  ): Promise<{ qr: string; token: string }> {
    try {
      await this.getStatus(instanceName);
      this.logger.log(`Instance ${instanceName} already exists. Deleting...`);
      await this.deleteInstance(instanceName);
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
    }
    const token = uuidv4();
    const { qr } = await this.startSession(instanceName, token);
    return { qr, token };
  }

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

  async startSession(
    instanceName: string,
    token: string,
  ): Promise<{ qr: string; token: string }> {
    const url = `${this.baseUrl}/instance/create`;
    try {
      const res = await axios.post(
        url,
        { instanceName, token, qrcode: true },
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

  async getStatus(instanceName: string): Promise<any> {
    const url = `${this.baseUrl}/instance/connectionState/${instanceName}`;
    try {
      const res = await axios.get(url, { headers: this.getHeaders() });
      return res.data;
    } catch (err: any) {
      this.logger.error('getStatus failed', err.response?.data || err.message);
      throw err;
    }
  }

  async sendMessage(
    instanceName: string,
    to: string,
    message: string,
  ): Promise<any> {
    const url = `${this.baseUrl}/message/sendText`;
    try {
      const res = await axios.post(
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

  /** تعيين Webhook حسب الوثائق الجديدة */
  async setWebhook(
    instanceName: string,
    webhookUrl: string,
    events: string[] = ['MESSAGES_UPSERT'],
    webhook_by_events = false,
    webhook_base64 = false,
  ): Promise<EvolutionWebhookResponse> {
    const url = `${this.baseUrl}/webhook/instance`;
    try {
      const res = await axios.post<EvolutionWebhookResponse>(
        url,
        {
          instanceName,
          url: webhookUrl,
          enabled: true,
          webhook_by_events,
          webhook_base64,
          events,
        },
        { headers: this.getHeaders() },
      );
      return res.data;
    } catch (err: any) {
      this.logger.error('setWebhook failed', err.response?.data || err.message);
      throw err;
    }
  }

  // دالة تحديث الويبهوك
  async updateWebhook(
    instanceName: string,
    webhookUrl: string,
    events: string[] = ['MESSAGES_UPSERT'],
    webhook_by_events = false,
    webhook_base64 = false,
  ): Promise<EvolutionWebhookResponse> {
    // هنا النوع مضبوط ولن يظهر التحذير
    return this.setWebhook(
      instanceName,
      webhookUrl,
      events,
      webhook_by_events,
      webhook_base64,
    );
  }
}
