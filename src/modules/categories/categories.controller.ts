// src/modules/categories/categories.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('الفئات')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'إضافة فئة جديدة' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'جلب كل الفئات (flat or tree)' })
  async findAll(@Query('tree') tree?: string) {
    if (tree === 'true') return this.categoriesService.findAllTree();
    return this.categoriesService.findAllFlat();
  }

  @Get(':id')
  @ApiOperation({ summary: 'جلب فئة واحدة' })
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'تعديل فئة' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف فئة' })
  async remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
