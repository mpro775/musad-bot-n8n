// ملف جديد src/chat/public-chat-widget.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChatWidgetService } from './chat-widget.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
@UseGuards(JwtAuthGuard)
@Controller('public/chat-widget')
export class PublicChatWidgetController {
  constructor(private readonly svc: ChatWidgetService) {}

  @Get(':widgetSlug')
  @Public()
  getByWidgetSlug(@Param('widgetSlug') widgetSlug: string) {
    return this.svc.getSettingsByWidgetSlug(widgetSlug);
  }
}
