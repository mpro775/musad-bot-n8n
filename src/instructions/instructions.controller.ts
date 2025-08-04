// src/modules/instructions/instructions.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { InstructionsService } from './instructions.service';

@Controller('instructions')
export class InstructionsController {
  constructor(private readonly service: InstructionsService) {}

  @Post()
  async create(
    @Body()
    dto: {
      instruction: string;
      merchantId?: string;
      relatedReplies?: string[];
      type?: 'auto' | 'manual';
    },
  ) {
    return this.service.create(dto);
  }

  @Get()
  async findAll(
    @Query('merchantId') merchantId?: string,
    @Query('active') active?: string,
    @Query('limit') limit = '30',
    @Query('page') page = '1',
  ) {
    return this.service.findAll({
      merchantId,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10),
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    dto: Partial<{
      instruction: string;
      active: boolean;
      relatedReplies: string[];
    }>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  // جلب فقط التوجيهات الفعالة (للبوت)
  @Get('active')
  async getActive(@Query('merchantId') merchantId?: string) {
    return this.service.getActiveInstructions(merchantId);
  }
}
