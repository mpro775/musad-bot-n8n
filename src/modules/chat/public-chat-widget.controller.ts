// ملف جديد src/chat/public-chat-widget.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ChatWidgetService } from './chat-widget.service';

@Controller('public/chat-widget')
export class PublicChatWidgetController {
  constructor(private readonly svc: ChatWidgetService) {}

  @Get(':widgetSlug')
  getByWidgetSlug(@Param('widgetSlug') widgetSlug: string) {
    return this.svc.getSettingsByWidgetSlug(widgetSlug);
  }
}
