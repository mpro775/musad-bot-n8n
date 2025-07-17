import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  QrResponse,
  SendMessageResponse,
  SetWebhookResponse,
  StartSessionResponse,
  StatusResponse,
} from '../merchants/types/evolution.types';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl =
    process.env.EVOLUTION_API_URL || 'http://31.97.155.167:8080';
  private readonly apiKey = 'any-secret-key';

  constructor(private readonly http: HttpService) {
    this.logger.log('apiKey used in EvolutionService:', this.apiKey);
    this.logger.log('headers:', this.getHeaders());
  }
  private getHeaders() {
    return {
      apikey: 'any-secret-key',
      'Content-Type': 'application/json',
    };
  }

  async startSession(instanceName: string): Promise<StartSessionResponse> {
    const url = `${this.baseUrl}/instance/create`;
    const res = await firstValueFrom(
      this.http.post<StartSessionResponse>(
        url,
        { instanceName },
        { headers: this.getHeaders() },
      ),
    );
    return res.data;
  }

  async getQr(instanceName: string): Promise<QrResponse> {
    const url = `${this.baseUrl}/instance/qr/${instanceName}`;
    const res = await firstValueFrom(
      this.http.get<QrResponse>(url, { headers: this.getHeaders() }),
    );

    return res.data;
  }

  async getStatus(instanceName: string): Promise<StatusResponse> {
    const url = `${this.baseUrl}/instance/state/${instanceName}`;
    const res = await firstValueFrom(
      this.http.get<StatusResponse>(url, { headers: this.getHeaders() }),
    );
    return res.data;
  }

  async sendMessage(
    instanceName: string,
    to: string,
    message: string,
  ): Promise<SendMessageResponse> {
    const url = `${this.baseUrl}/message/sendText`;
    const res = await firstValueFrom(
      this.http.post<SendMessageResponse>(
        url,
        { instanceName, to, message },
        { headers: this.getHeaders() },
      ),
    );
    return res.data;
  }

  async setWebhook(
    instanceName: string,
    webhookUrl: string,
  ): Promise<SetWebhookResponse> {
    const url = `${this.baseUrl}/instance/webhook`;
    const res = await firstValueFrom(
      this.http.post<SetWebhookResponse>(
        url,
        {
          instanceName,
          webhook: webhookUrl,
          events: ['onMessage'],
        },
        { headers: this.getHeaders() },
      ),
    );
    return res.data;
  }
}
