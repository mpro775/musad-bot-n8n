import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('session-count')
  @ApiOperation({ summary: 'عدد الجلسات خلال فترة' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiQuery({ name: 'from', description: 'بداية الفترة', type: String })
  @ApiQuery({ name: 'to', description: 'نهاية الفترة', type: String })
  @ApiOkResponse({ description: 'إحصائية عدد الجلسات' })
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
  @ApiOperation({ summary: 'إحصائية عدد الرسائل حسب الدور' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiOkResponse()
  async getMessageRoleStats(@Query('merchantId') merchantId: string) {
    const stats = await this.analyticsService.countMessagesByRole(merchantId);
    return stats;
  }
  @Get('top-questions')
  @ApiOperation({ summary: 'أكثر الأسئلة تكرارًا من العملاء' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse()
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
  @ApiOperation({ summary: 'عدد الجلسات يوميًا' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiQuery({ name: 'from', description: 'بداية الفترة', type: String })
  @ApiQuery({ name: 'to', description: 'نهاية الفترة', type: String })
  @ApiOkResponse()
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
  @ApiOperation({ summary: 'توزيع استخدام القنوات' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiOkResponse()
  async getChannelUsage(@Query('merchantId') merchantId: string) {
    return this.analyticsService.channelDistribution(merchantId);
  }
  @Get('top-products-requested')
  @ApiOperation({ summary: 'أكثر المنتجات طلبًا' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse()
  async getTopRequestedProducts(
    @Query('merchantId') merchantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.topRequestedProducts(
      merchantId,
      Number(limit) || 10,
    );
  }
  @Get('top-keywords')
  @ApiOperation({ summary: 'أكثر الكلمات استخدامًا من العملاء' })
  @ApiQuery({ name: 'merchantId', description: 'معرّف التاجر' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse()
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
