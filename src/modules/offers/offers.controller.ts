// src/modules/offers/offers.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OfferResponseDto } from './dto/offer-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('العروض')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء عرض جديد' })
  @ApiCreatedResponse({ type: OfferResponseDto })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح أو مفقود' })
  @ApiForbiddenResponse({ description: 'دور المستخدم غير كافٍ' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateOfferDto,
  ): Promise<OfferResponseDto> {
    if (!['MERCHANT', 'ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    const merchantObjectId = new Types.ObjectId(req.user.merchantId);
    const offerDoc = await this.offersService.create({
      merchantId: merchantObjectId,
      originalUrl: dto.originalUrl,
      name: dto.name ?? '',
      price: dto.price ?? 0,
      description: dto.description ?? '',
      images: dto.images ?? [],
      platform: dto.platform ?? '',
      errorState: 'queued',
    });

    await this.offersService.enqueueScrapeJob({
      offerId: offerDoc._id.toString(),
      url: dto.originalUrl,
      merchantId: req.user.merchantId,
      mode: 'full',
    });

    return plainToInstance(OfferResponseDto, offerDoc, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @ApiOperation({ summary: 'جلب جميع العروض لتاجر معين' })
  @ApiOkResponse({ type: OfferResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'merchantId is required' })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح أو مفقود' })
  async findAll(
    @Query('merchantId') merchantId: string,
  ): Promise<OfferResponseDto[]> {
    if (!merchantId) {
      throw new BadRequestException('merchantId is required');
    }

    const merchantObjectId = new Types.ObjectId(merchantId);
    const docs = await this.offersService.findAllByMerchant(merchantObjectId);
    return plainToInstance(OfferResponseDto, docs, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جلب عرض واحد حسب المعرّف' })
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف العرض' })
  @ApiOkResponse({ type: OfferResponseDto })
  @ApiNotFoundResponse({ description: 'العرض غير موجود' })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح أو مفقود' })
  @ApiForbiddenResponse({ description: 'ليس مالك العرض' })
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<OfferResponseDto> {
    const offer = await this.offersService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      offer.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }
    return plainToInstance(OfferResponseDto, offer, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'تحديث عرض (لصاحب العرض فقط)' })
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف العرض' })
  @ApiCreatedResponse({ type: OfferResponseDto })
  @ApiNotFoundResponse({ description: 'العرض غير موجود' })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح أو مفقود' })
  @ApiForbiddenResponse({ description: 'ليس مالك العرض' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
    @Request() req: RequestWithUser,
  ): Promise<OfferResponseDto> {
    const existing = await this.offersService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      existing.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }

    const updated = await this.offersService.update(id, dto);
    return plainToInstance(OfferResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف عرض' })
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف العرض' })
  @ApiOkResponse({
    schema: { example: { message: 'Offer deleted successfully' } },
  })
  @ApiNotFoundResponse({ description: 'العرض غير موجود' })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح أو مفقود' })
  @ApiForbiddenResponse({ description: 'ليس مالك العرض' })
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<{ message: string }> {
    const existing = await this.offersService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      existing.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }
    return this.offersService.remove(id);
  }
}
