// categories.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Patch,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiSuccessResponse,
  ApiCreatedResponse as CommonApiCreatedResponse,
  CurrentUser,
} from '../../common';
import { TranslationService } from '../../common/services/translation.service';
import multer from 'multer';
import os from 'os';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly translationService: TranslationService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'categories.operations.create.summary',
    description: 'categories.operations.create.description',
  })
  @CommonApiCreatedResponse(
    CreateCategoryDto,
    'categories.responses.success.created',
  )
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'categories.operations.findAll.summary',
    description: 'categories.operations.findAll.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiQuery({ name: 'tree', required: false, type: 'boolean' })
  @ApiSuccessResponse(Array, 'categories.responses.success.found')
  findAll(
    @Query('merchantId') merchantId: string,
    @Query('tree') tree?: string,
  ) {
    return tree === 'true'
      ? this.categories.findAllTree(merchantId)
      : this.categories.findAllFlat(merchantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'categories.operations.findOne.summary',
    description: 'categories.operations.findOne.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.found',
  })
  @ApiResponse({
    status: 404,
    description: 'categories.responses.error.notFound',
  })
  findOne(@Param('id') id: string, @Query('merchantId') merchantId: string) {
    return this.categories.findOne(id, merchantId);
  }

  @Get(':id/breadcrumbs')
  @ApiOperation({
    summary: 'categories.operations.breadcrumbs.summary',
    description: 'categories.operations.breadcrumbs.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.found',
  })
  breadcrumbs(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
  ): Promise<any> {
    return this.categories.breadcrumbs(id, merchantId);
  }

  @Get(':id/subtree')
  @ApiOperation({
    summary: 'categories.operations.subtree.summary',
    description: 'categories.operations.subtree.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.found',
  })
  subtree(@Param('id') id: string, @Query('merchantId') merchantId: string) {
    return this.categories.subtree(id, merchantId);
  }

  @Patch(':id/move')
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiOperation({
    summary: 'categories.operations.move.summary',
    description: 'categories.operations.move.description',
  })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.updated',
  })
  move(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.categories.move(id, merchantId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'categories.operations.remove.summary',
    description: 'categories.operations.remove.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiQuery({ name: 'cascade', required: false, type: 'boolean' })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'categories.responses.error.notFound',
  })
  remove(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
    @Query('cascade') cascade?: string,
  ) {
    return this.categories.remove(id, merchantId, cascade === 'true');
  }

  @Post(':id/image')
  @ApiOperation({
    summary: 'categories.operations.uploadImage.summary',
    description: 'categories.operations.uploadImage.description',
  })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: os.tmpdir(), // تخزين مؤقت على القرص
        filename: (_req, file, cb) => {
          const ext = (
            file.originalname.split('.').pop() || 'img'
          ).toLowerCase();
          cb(null, `cat-${Date.now()}.${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req, file, cb) => {
        const ok = /^(image\/png|image\/jpe?g|image\/webp)$/i.test(
          file.mimetype,
        );
        cb(
          ok
            ? null
            : new BadRequestException(
                'categories.responses.error.unsupportedFormat',
              ),
          ok,
        );
      },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('لم يتم إرفاق ملف');
    const url = await this.categories.uploadCategoryImageToMinio(
      id,
      merchantId,
      file,
    );
    return { url };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'categories.operations.update.summary',
    description: 'categories.operations.update.description',
  })
  @ApiParam({ name: 'id', description: 'categories.fields.merchantId' })
  @ApiQuery({ name: 'merchantId', required: true })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({
    status: 200,
    description: 'categories.responses.success.updated',
  })
  @ApiResponse({
    status: 404,
    description: 'categories.responses.error.notFound',
  })
  async update(
    @Param('id') id: string,
    @Query('merchantId') merchantId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, merchantId, dto);
  }
}
