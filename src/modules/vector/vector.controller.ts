// src/vector/vector.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { VectorService } from './vector.service';
import { SemanticRequestDto } from './dto/semantic-request.dto';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('Semantic Search')
@Controller('semantic')
export class VectorController {
  constructor(private readonly vector: VectorService) {}

  // POST endpoint for semantic search on products
  @Post('products')
  @ApiOperation({ summary: 'بحث دلالي في المنتجات' })
  @ApiBody({ type: SemanticRequestDto })
  @ApiOkResponse()
  async semanticSProducts(@Body() dto: SemanticRequestDto) {
    const recs = await this.vector.querySimilarProducts(
      dto.text,
      dto.merchantId,
      dto.topK ?? 5,
    );
    return { recommendations: recs };
  }
  // GET endpoint with optional topK parameter
  @Get('products')
  @ApiOperation({ summary: 'بحث دلالي في المنتجات عبر النص' })
  @ApiQuery({ name: 'text', description: 'نص البحث' })
  @ApiQuery({ name: 'merchantId', description: 'معرف التاجر' })
  @ApiQuery({ name: 'topK', required: false, type: Number })
  @ApiOkResponse()
  async semanticSearchProductsByQuery(
    @Query('text') text: string,
    @Query('merchantId') merchantId: string,
    @Query('topK') topK = '5',
  ) {
    const count = parseInt(topK, 10);
    const recs = await this.vector.querySimilarProducts(
      text,
      merchantId,
      count,
    );
    return { recommendations: recs };
  }

  // GET endpoint for semantic search on offers
  @Get('offers')
  @ApiOperation({ summary: 'بحث دلالي في العروض' })
  @ApiQuery({ name: 'text', description: 'نص البحث' })
  @ApiQuery({ name: 'topK', required: false, type: Number })
  @ApiOkResponse()
  async semanticSearchOffers(
    @Query('text') text: string,
    @Query('topK') topK = '5',
  ) {
    const count = parseInt(topK, 10);
    const recs = await this.vector.querySimilarOffers(text, count);
    return { recommendations: recs };
  }
}
