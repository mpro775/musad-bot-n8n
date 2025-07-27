import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatWidgetService } from './chat-widget.service';
import { UpdateWidgetSettingsDto } from './dto/update-widget-settings.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { HandoffDto } from './dto/handoff.dto';

@ApiTags('Chat Widget')
@UseGuards(JwtAuthGuard, RolesGuard) // تأكد من أنك عدلت الـ Guards ليتحققوا من الصلاحيات
@Controller('merchants/:merchantId/widget-settings')
export class ChatWidgetController {
  constructor(private readonly svc: ChatWidgetService) {}

  @Get()
  @ApiOperation({ summary: 'Get widget settings for merchant' })
  getSettings(@Param('merchantId') merchantId: string) {
    return this.svc.getSettings(merchantId);
  }

  @Put()
  @ApiOperation({ summary: 'Update widget settings for merchant' })
  updateSettings(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateWidgetSettingsDto,
  ) {
    return this.svc.updateSettings(merchantId, dto);
  }

  @Post(':merchantId/handoff')
  @ApiOperation({ summary: 'Initiate human handoff for a session' })
  async handoff(
    @Param('merchantId') merchantId: string,
    @Body() dto: HandoffDto,
  ) {
    return this.svc.handleHandoff(merchantId, dto);
  }
  @Get('embed-settings')
  @ApiOperation({ summary: 'Get embed settings (mode + shareable URL)' })
  async getEmbedSettings(@Param('merchantId') merchantId: string) {
    return this.svc.getEmbedSettings(merchantId);
  }
  @Get('share-url')
  async getShareUrl(@Param('merchantId') merchantId: string) {
    const settings = await this.svc.getSettings(merchantId);
    return { url: `http://localhost:5173/chat/${settings.widgetSlug}` };
  }
  @Post('slug')
  generateSlug(@Param('merchantId') merchantId: string) {
    return this.svc.generateWidgetSlug(merchantId);
  }

  @Put('embed-settings')
  @ApiOperation({ summary: 'Update default embed mode' })
  async updateEmbedSettings(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateWidgetSettingsDto,
  ) {
    // نقبِل فقط الحقل embedMode من dto
    return this.svc.updateEmbedSettings(merchantId, {
      embedMode: dto.embedMode,
    });
  }
}
