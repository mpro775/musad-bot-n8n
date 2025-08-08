import { Public } from 'src/common/decorators/public.decorator';
// src/analytics/analytics.controller.ts

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AnalyticsService,
  Overview,
  KeywordCount,
  TopProduct,
} from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { Request } from 'express';
import { CreateMissingResponseDto } from './dto/create-missing-response.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Get analytics overview for the merchant
   * Returns comprehensive analytics data including sessions, messages, keywords, products, and channels
   */
  @Get('overview')
  @ApiOperation({
    summary: 'Get analytics overview',
    description:
      'Retrieves comprehensive analytics overview for the authenticated merchant including sessions, messages, top keywords, top products, and channel breakdown',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for analytics data',
    required: false,
    enum: ['week', 'month', 'quarter'],
    example: 'week',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics overview retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1250 },
            changePercent: { type: 'number', example: 15.5 },
          },
        },
        messages: { type: 'number', example: 3420 },
        topKeywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string', example: 'تسوق' },
              count: { type: 'number', example: 45 },
            },
          },
        },
        topProducts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', example: 'prod_123' },
              name: { type: 'string', example: 'منتج رائج' },
              views: { type: 'number', example: 89 },
            },
          },
        },
        channels: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 5 },
            breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  channel: { type: 'string', example: 'whatsapp' },
                  count: { type: 'number', example: 1250 },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async overview(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
  ): Promise<Overview> {
    const merchantId = req.user.merchantId;
    const result = await this.analytics.getOverview(merchantId, period);
    return result;
  }

  /**
   * Get top keywords used by customers
   * Returns the most frequently used keywords in customer interactions
   */
  @Get('top-keywords')
  @ApiOperation({
    summary: 'Get top keywords',
    description:
      'Retrieves the most frequently used keywords in customer interactions for the authenticated merchant',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for keyword analysis',
    required: false,
    enum: ['week', 'month', 'quarter'],
    example: 'week',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of keywords to return',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Top keywords retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string', example: 'تسوق' },
          count: { type: 'number', example: 45 },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async topKeywords(
    @Req() req: Request & { user: { merchantId: string } },
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
    @Query('limit') limit = '10',
  ): Promise<KeywordCount[]> {
    const merchantId = req.user.merchantId;
    const kws = await this.analytics.getTopKeywords(merchantId, period, +limit);
    return kws;
  }
  /**
   * Get messages timeline data
   * Returns message counts grouped by day or hour for timeline visualization
   */
  @Get('messages-timeline')
  @ApiOperation({
    summary: 'Get messages timeline',
    description:
      'Retrieves message counts grouped by day or hour for timeline visualization',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for timeline data',
    required: false,
    enum: ['week', 'month', 'quarter'],
    example: 'week',
  })
  @ApiQuery({
    name: 'groupBy',
    description: 'Grouping interval for timeline data',
    required: false,
    enum: ['day', 'hour'],
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages timeline retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2024-01-15' },
          count: { type: 'number', example: 125 },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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

  /**
   * Get total products count
   * Returns the total number of products for the merchant
   */
  @Get('products-count')
  @ApiOperation({
    summary: 'Get products count',
    description:
      'Returns the total number of products for the authenticated merchant',
  })
  @ApiResponse({
    status: 200,
    description: 'Products count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 156 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async productsCount(@Req() req: Request & { user: { merchantId: string } }) {
    return {
      total: await this.analytics.getProductsCount(req.user.merchantId),
    };
  }
  /**
   * Webhook endpoint for analytics events
   * Public endpoint to receive analytics data from external sources
   */
  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Analytics webhook',
    description:
      'Public webhook endpoint to receive analytics data from external sources and services',
  })
  @ApiBody({
    description: 'Analytics event data',
    type: CreateMissingResponseDto,
    examples: {
      example1: {
        summary: 'Example webhook payload',
        value: {
          event: 'product_view',
          data: {
            productId: 'prod_123',
            userId: 'user_456',
            timestamp: '2024-01-15T10:30:00Z',
          },
          source: 'webhook',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook data processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid payload format',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async webhook(@Body() body: CreateMissingResponseDto) {
    const doc = await this.analytics.createFromWebhook(body);
    return { success: true, id: doc._id };
  }
  /**
   * Get top products by views/interactions
   * Returns the most popular products based on customer interactions
   */
  @Get('top-products')
  @ApiOperation({
    summary: 'Get top products',
    description:
      'Retrieves the most popular products based on customer interactions and views for the authenticated merchant',
  })
  @ApiQuery({
    name: 'period',
    description: 'Time period for product analysis',
    required: false,
    enum: ['week', 'month', 'quarter'],
    example: 'week',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of products to return',
    required: false,
    type: Number,
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Top products retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: 'prod_123456' },
          name: { type: 'string', example: 'منتج رائج' },
          views: { type: 'number', example: 89 },
          interactions: { type: 'number', example: 156 },
          conversionRate: { type: 'number', example: 0.12 },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
