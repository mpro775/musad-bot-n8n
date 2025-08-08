import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import axios from 'axios';
import { HttpService } from '@nestjs/axios';
export interface ZidOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  store_id: string;
  token_type: string;
  expires_in: number;
  [key: string]: any; // لأي حقول إضافية لاحقًا
}
@Injectable()
export class ZidService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
  ) {}

  getOAuthUrl(): string {
    const clientId = 4983;
    const redirectUri =
      'https://compile-excluded-ted-flickr.trycloudflare.com/api/auth/zid/callback';
    const scopes = [
      'store.products.read',
      'store.orders.read',
      'store.categories.read',
      'store.account.read',
      'store.coupons.read',
      'store.countries_cities.read',
      'store.webhooks.read',
      'store.webhooks.write',
      'store.product_inventory_stock.read',
      'store.reverse_orders.read',
      'store.product_availability_notifications.read',
      'store.vats.read',
      // أضف المزيد إذا فعّلتها لاحقًا
    ].join(' ');

    return `https://oauth.zid.sa/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
  }

  async exchangeCodeForToken(code: string): Promise<ZidOAuthTokenResponse> {
    const clientId = '4983';
    const clientSecret = 'OF8IqmOUWE2ybvyrPb9Vhg14Yn4yylz9sdKyf2mw';
    const redirectUri =
      'https://compile-excluded-ted-flickr.trycloudflare.com/api/auth/zid/callback';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const { data } = await firstValueFrom(
      this.http.post<ZidOAuthTokenResponse>(
        'https://oauth.zid.sa/oauth/token',
        body,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    );
    return data;
  }

  async fetchZidProducts(accessToken: string): Promise<any[]> {
    const products: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await axios.get(
        `https://api.zid.sa/v1/products?page=${page}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      products.push(...(data.data || []));
      hasMore = !!data.links?.next; // يوجد صفحات أخرى؟
      page++;
    }
    return products;
  }
  async linkStoreToUser(userId: string, tokens: any) {
    // يفترض أنك تحدد الـ merchant أو userId المناسب هنا
    await this.merchantModel.findOneAndUpdate(
      { userId },
      {
        zidIntegration: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          storeId: tokens.store_id,
          tokenType: tokens.token_type,
          expiresIn: tokens.expires_in,
          lastSync: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async registerDefaultWebhooks(accessToken: string) {
    const targetUrl = this.config.get('ZID_WEBHOOK_URL');
    const events = [
      'product.create',
      'product.update',
      'order.create',
      'order.status.update',
      // أضف ما تحتاج
    ];
    for (const event of events) {
      await firstValueFrom(
        this.http.post(
          'https://api.zid.sa/v1/webhooks',
          { target_url: targetUrl, event },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    }
  }

  // توسيع لاحق: تجديد التوكن، حذف الربط، إلخ
}
