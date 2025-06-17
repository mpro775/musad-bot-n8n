// src/modules/offers/offers.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('العروض')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء عرض جديد' })
  @ApiBody({ type: CreateOfferDto })
  @ApiResponse({ status: 201, description: 'تم إنشاء العرض' })
  async create(@Body() dto: CreateOfferDto, @Request() req: any) {
    const merchantId = req.user.merchantId;
    return this.offersService.create(dto, merchantId);
  }

  @Get()
  @ApiOperation({ summary: 'جلب جميع العروض الخاصة بالتاجر' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'type', required: false, type: String })
  async findAll(
    @Request() req: any,
    @Query('active') active?: boolean,
    @Query('type') type?: string,
  ) {
    const merchantId = req.user.merchantId;
    const filter: any = { merchantId };
    if (typeof active !== 'undefined') filter.active = active;
    if (type) filter.type = type;
    return this.offersService.findAllByMerchant(merchantId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جلب تفاصيل عرض واحد' })
  @ApiParam({ name: 'id', required: true, description: 'معرّف العرض' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const merchantId = req.user.merchantId;
    return this.offersService.findOne(id, merchantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تحديث عرض' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({ type: UpdateOfferDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
    @Request() req: any,
  ) {
    const merchantId = req.user.merchantId;
    return this.offersService.update(id, dto, merchantId);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'تفعيل/تعطيل عرض' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({ schema: { example: { active: true } } })
  async setActive(
    @Param('id') id: string,
    @Body('active') active: boolean,
    @Request() req: any,
  ) {
    const merchantId = req.user.merchantId;
    return this.offersService.setActive(id, merchantId, active);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف عرض' })
  @ApiParam({ name: 'id', required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    const merchantId = req.user.merchantId;
    await this.offersService.remove(id, merchantId);
  }

  @Get('/product/:productId')
  @ApiOperation({ summary: 'جلب كل العروض النشطة لمنتج معيّن' })
  @ApiParam({ name: 'productId', required: true })
  async findByProduct(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    const merchantId = req.user.merchantId;
    return this.offersService.findOffersByProduct(productId, merchantId);
  }
}
