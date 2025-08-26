// src/modules/public/public-router.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { ChatWidgetSettings } from '../chat/schema/chat-widget.schema';
import { Storefront } from '../storefront/schemas/storefront.schema';

@ApiTags('Public Router')
@Controller('public')
export class PublicRouterController {
  constructor(
    @InjectModel(Merchant.name) private merchants: Model<MerchantDocument>,
    @InjectModel(ChatWidgetSettings.name) private widgets: Model<any>,
    @InjectModel(Storefront.name) private stores: Model<any>,
  ) {}

  private async resolve(slug: string) {
    const m = await this.merchants
      .findOne({ publicSlug: slug, publicSlugEnabled: true })
      .lean();
    if (!m) throw new NotFoundException('Merchant slug not found or disabled');
    const [store, widget] = await Promise.all([
      this.stores.findOne({ merchant: m._id }).lean(),
      this.widgets.findOne({ merchantId: String(m._id) }).lean(),
    ]);
    return { merchant: m, store, widget };
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Resolve slug',
    description: 'معلومات عامة وروابط جاهزة',
  })
  async getSummary(@Param('slug') slug: string) {
    const { merchant, store, widget } = await this.resolve(slug);
    return {
      merchant: { id: merchant._id, name: merchant.name },
      urls: {
        store: `/${merchant.publicSlug}/store`,
        chat: `/${merchant.publicSlug}/chat`,
      },
      embedModes: (widget as any)?.embedMode
        ? [(widget as any).embedMode, 'bubble', 'iframe', 'bar', 'conversational']
        : ['bubble', 'iframe', 'bar', 'conversational'],
      theme: {
        primaryColor: (store as any)?.primaryColor,
        secondaryColor: (store as any)?.secondaryColor,
      },
    };
  }

  @Get(':slug/storefront')
  @ApiOperation({ summary: 'Get Storefront by slug' })
  async getStore(@Param('slug') slug: string) {
    const { store } = await this.resolve(slug);
    if (!store) throw new NotFoundException('Storefront missing');
    return store;
  }

  @Get(':slug/chat')
  @ApiOperation({ summary: 'Get Chat Widget by slug' })
  async getChat(@Param('slug') slug: string) {
    const { widget } = await this.resolve(slug);
    if (!widget) throw new NotFoundException('Chat widget missing');
    return widget;
  }
}
