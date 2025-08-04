// src/media/media.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaHandlerDto } from './dto/media-handler.dto';

@Controller('media-handler')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  async handleMedia(@Body() dto: MediaHandlerDto) {
    const result = await this.mediaService.handleMedia(dto);
    return result;
  }
}
