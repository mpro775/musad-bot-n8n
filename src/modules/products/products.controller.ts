import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Types } from 'mongoose';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('المنتجات')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء منتج جديد (للتاجر)' })
  @ApiBody({ type: CreateProductDto, description: 'بيانات إنشاء المنتج' })
  @ApiCreatedResponse({
    description: 'تم إنشاء المنتج ووضعه في قائمة الانتظار للمعالجة',
    type: ProductResponseDto,
    schema: {
      example: {
        _id: '60f8f0e5e1d3c42f88a7b9a1',
        merchantId: '5f7e1a3b4c9d0e2f1a2b3c4d',
        originalUrl: 'https://example.com/product/123',
        name: 'منتج تجريبي',
        price: 99.99,
        isAvailable: true,
        keywords: ['test', 'demo'],
        platform: 'ExampleShop',
        description: 'هذا وصف تفصيلي للمنتج.',
        images: ['https://.../img1.jpg', 'https://.../img2.jpg'],
        category: 'إلكترونيات',
        errorState: 'queued',
        createdAt: '2025-06-09T13:45:00.000Z',
        updatedAt: '2025-06-09T13:45:00.000Z',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'غير مصرح: توكن JWT غير صالح أو مفقود',
  })
  @ApiForbiddenResponse({ description: 'ممنوع: دور المستخدم غير كافٍ' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    if (req.user.role !== 'MERCHANT' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient role');
    }

    const merchantId = req.user.merchantId;
    const merchantObjectId = new Types.ObjectId(merchantId);

    // 1) إنشاء الوثيقة في الـ DB
    const productDoc = await this.productsService.create({
      merchantId: merchantObjectId,
      originalUrl: dto.originalUrl,
      name: dto.name ?? '',
      price: dto.price ?? 0,
      isAvailable: dto.isAvailable ?? true,
      keywords: dto.keywords ?? [],
      errorState: 'queued',
    });

    // 2) إرسال مهمة السكريبنغ مع تحديد الـ mode
    await this.productsService.enqueueScrapeJob({
      productId: productDoc._id.toString(),
      url: dto.originalUrl,
      merchantId,
      mode: 'full', // أو 'minimal' حسب حاجتك
    });

    // 3) ترحيل الـ Document إلى DTO
    return plainToInstance(ProductResponseDto, productDoc, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'جلب جميع المنتجات للتاجر الحالي' })
  @ApiOkResponse({
    description: 'تم إرجاع قائمة المنتجات بنجاح',
    type: ProductResponseDto,
    isArray: true,
    schema: {
      example: [
        {
          _id: '60f8f0e5e1d3c42f88a7b9a1',
          merchantId: '5f7e1a3b4c9d0e2f1a2b3c4d',
          originalUrl: 'https://example.com/product/123',
          name: 'منتج تجريبي',
          price: 99.99,
          isAvailable: true,
          keywords: ['test', 'demo'],
          platform: 'ExampleShop',
          description: 'هذا وصف تفصيلي للمنتج.',
          images: ['https://.../img1.jpg', 'https://.../img2.jpg'],
          category: 'إلكترونيات',
          errorState: 'ready',
          createdAt: '2025-06-09T13:45:00.000Z',
          updatedAt: '2025-06-09T14:00:00.000Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'غير مصرح: توكن JWT غير صالح أو مفقود',
  })
  @ApiForbiddenResponse({ description: 'ممنوع: دور المستخدم غير كافٍ' })
  async findAll(
    @Query('merchantId') merchantId: string,
  ): Promise<ProductResponseDto[]> {
    if (!merchantId) {
      throw new BadRequestException('merchantId is required');
    }

    const merchantObjectId = new Types.ObjectId(merchantId);
    const docs = await this.productsService.findAllByMerchant(merchantObjectId);

    return plainToInstance(ProductResponseDto, docs);
  }
  @Public()
  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف المنتج' })
  @ApiOperation({ summary: 'جلب منتج واحد حسب المعرّف' })
  @ApiOkResponse({
    description: 'تم إرجاع بيانات المنتج بنجاح',
    type: ProductResponseDto,
    schema: {
      example: {
        _id: '60f8f0e5e1d3c42f88a7b9a1',
        merchantId: '5f7e1a3b4c9d0e2f1a2b3c4d',
        originalUrl: 'https://example.com/product/123',
        name: 'منتج تجريبي',
        price: 99.99,
        isAvailable: true,
        keywords: ['test', 'demo'],
        platform: 'ExampleShop',
        description: 'هذا وصف تفصيلي للمنتج.',
        images: ['https://.../img1.jpg', 'https://.../img2.jpg'],
        category: 'إلكترونيات',
        errorState: 'ready',
        createdAt: '2025-06-09T13:45:00.000Z',
        updatedAt: '2025-06-09T14:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'المنتج غير موجود' })
  @ApiUnauthorizedResponse({
    description: 'غير مصرح: توكن JWT غير صالح أو مفقود',
  })
  @ApiForbiddenResponse({ description: 'ممنوع: ليس مالك المنتج' })
  async findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      product.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف المنتج' })
  @ApiOperation({ summary: 'تحديث منتج (لصاحب المنتج فقط)' })
  @ApiBody({ type: UpdateProductDto, description: 'الحقول المراد تحديثها' })
  @ApiOkResponse({
    description: 'تم تحديث المنتج بنجاح',
    type: ProductResponseDto,
    schema: {
      example: {
        _id: '60f8f0e5e1d3c42f88a7b9a1',
        /* باقي الحقول كما في الأمثلة السابقة */
      },
    },
  })
  @ApiNotFoundResponse({ description: 'المنتج غير موجود' })
  @ApiUnauthorizedResponse({
    description: 'غير مصرح: توكن JWT غير صالح أو مفقود',
  })
  @ApiForbiddenResponse({ description: 'ممنوع: ليس مالك المنتج' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: RequestWithUser,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      product.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }
    const updated = await this.productsService.update(id, dto);
    return plainToInstance(ProductResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: 'string', description: 'معرّف المنتج' })
  @ApiOperation({ summary: 'حذف منتج' })
  @ApiOkResponse({
    description: 'تم حذف المنتج بنجاح',
    schema: { example: { message: 'Product removed successfully' } },
  })
  @ApiNotFoundResponse({ description: 'المنتج غير موجود' })
  @ApiUnauthorizedResponse({
    description: 'غير مصرح: توكن JWT غير صالح أو مفقود',
  })
  @ApiForbiddenResponse({ description: 'ممنوع: ليس مالك المنتج' })
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<{ message: string }> {
    const product = await this.productsService.findOne(id);
    if (
      req.user.role !== 'ADMIN' &&
      product.merchantId.toString() !== req.user.merchantId
    ) {
      throw new ForbiddenException('Not allowed');
    }
    return this.productsService.remove(id);
  }
}
