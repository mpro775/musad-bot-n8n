// src/analytics/analytics.controller.ts

import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  AnalyticsService,
  Overview,
  KeywordCount,
  TopProduct,
} from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiOkResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /api/analytics/overview?period=week|month|quarter
   * Returns:
   *   {
   *     sessions: { count, changePercent },
   *     messages: totalMessages,
   *     topKeywords: KeywordCount[],
   *     topProducts: TopProduct[],
   *     channels: { total, breakdown }
   *   }
  */
  @Get('overview')
  @ApiOperation({ summary: 'Overview statistics' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiOkResponse({ description: 'Overview stats' })
  async overview(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
  ): Promise<Overview> {
    console.log('USER:', req.user); // <--- أضف هذا السطر

    const merchantId = req.user.merchantId;
    const result = await this.analytics.getOverview(merchantId, period);
    return result;
  }

  /**
   * GET /api/analytics/top-keywords?period=...&limit=...
   * Returns KeywordCount[]
  */
  @Get('top-keywords')
  @ApiOperation({ summary: 'Top keywords' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'List of top keywords' })
  async topKeywords(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
    @Query('limit') limit = '10',
  ): Promise<KeywordCount[]> {
    const merchantId = req.user.merchantId;
    const kws = await this.analytics.getTopKeywords(merchantId, period, +limit);
    return kws;
  }
  @Get('messages-timeline')
  @ApiOperation({ summary: 'Messages timeline' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'hour'] })
  @ApiOkResponse({ description: 'Timeline data' })
  async messagesTimeline(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
    @Query('groupBy') groupBy: 'day' | 'hour' = 'day',
  ) {
    return this.analytics.getMessagesTimeline(
      req.user.merchantId,
      period,
      groupBy,
    );
  }

  @Get('products-count')
  @ApiOperation({ summary: 'Total products count' })
  @ApiOkResponse({ description: 'Products count' })
  async productsCount(@Req() req: Request & { user: { merchantId: string } }) {
    return {
      total: await this.analytics.getProductsCount(req.user.merchantId),
    };
  }

  /**
   * GET /api/analytics/top-products?period=...&limit=...
   * Returns TopProduct[]
  */
  @Get('top-products')
  @ApiOperation({ summary: 'Top products' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'List of top products' })
  async topProducts(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
    @Query('limit') limit = '5',
  ): Promise<TopProduct[]> {
    const merchantId = req.user.merchantId;
    const prods = await this.analytics.getTopProducts(
      merchantId,
      period,
      +limit,
    );
    return prods;
  }
}
