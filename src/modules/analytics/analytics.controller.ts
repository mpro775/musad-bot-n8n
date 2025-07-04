import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { StatsService } from './stats.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly statsService: StatsService,
  ) {}

  @Get('session-count')
  async getSessionCount(
    @Query('merchantId') merchantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const count = await this.analyticsService.countSessions(
      merchantId,
      fromDate,
      toDate,
    );

    return { merchantId, count, from: fromDate, to: toDate };
  }
  @Get('message-role-stats')
  async getMessageRoleStats(@Query('merchantId') merchantId: string) {
    const stats = await this.analyticsService.countMessagesByRole(merchantId);
    return stats;
  }
  @Get('top-questions')
  async getTopQuestions(
    @Query('merchantId') merchantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.topCustomerMessages(
      merchantId,
      Number(limit) || 10,
    );
  }
  @Get('daily-sessions')
  async getDailySessions(
    @Query('merchantId') merchantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.analyticsService.sessionsPerDay(
      merchantId,
      new Date(from),
      new Date(to),
    );
  }
  @Get('channel-usage')
  async getChannelUsage(@Query('merchantId') merchantId: string) {
    return this.analyticsService.channelDistribution(merchantId);
  }
  @Get('top-products-requested')
  async getTopRequestedProducts(
    @Query('merchantId') merchantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.topRequestedProducts(
      merchantId,
      Number(limit) || 10,
    );
  }
  @Get('merchants/:id/stats')
  async getStats(
    @Param('id') merchantId: string,
    @Query('period') period: 'daily' | 'weekly' | 'monthly',
    @Query('date') dateStr?: string,
  ) {
    // 1) حوّل السلسلة إلى Date إذا وُجِدت
    const date = dateStr ? new Date(dateStr) : new Date();

    // 2) استدعِ الخدمة مع كائن Date
    return this.statsService.findStats(merchantId, period, date);
  }
  @Post('events')
  createEvent(
    @Body()
    dto: {
      merchantId: string;
      type: string;
      channel: string;
      payload: any;
    },
  ) {
    return this.analyticsService.logEvent(dto.merchantId, dto.type, {
      channel: dto.channel,
      ...dto.payload,
    });
  }

  @Get('top-keywords')
  async getTopKeywords(
    @Query('merchantId') merchantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.topCustomerKeywords(
      merchantId,
      Number(limit) || 20,
    );
  }
}
