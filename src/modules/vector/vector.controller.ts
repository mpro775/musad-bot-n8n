// src/vector/vector.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { VectorService } from './vector.service';
import { SemanticRequestDto } from './dto/semantic-request.dto';

@Controller('semantic')
export class VectorController {
  constructor(private readonly vector: VectorService) {}

  // POST endpoint for semantic search on products
  @Post('products')
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
  async semanticSearchOffers(
    @Query('text') text: string,
    @Query('topK') topK = '5',
  ) {
    const count = parseInt(topK, 10);
    const recs = await this.vector.querySimilarOffers(text, count);
    return { recommendations: recs };
  }
}
