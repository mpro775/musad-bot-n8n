// src/vector/vector.controller.ts
import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { VectorService } from './vector.service';
import { SemanticRequestDto } from './dto/semantic-request.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('semantic')
@UseGuards(JwtAuthGuard)
export class VectorController {
  constructor(private readonly vector: VectorService) {}

  // POST endpoint for semantic search on products
  @Post('products')
  @Public()
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
  @Public()
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

  @Post('all')
  @Public()
  async unifiedSearchBody(
    @Body('merchantId') merchantId: string,
    @Body('query') query: string,
    @Body('topK') topK?: number,
  ) {
    if (!merchantId || !query) {
      return {
        status: 400,
        error: 'merchantId and query are required',
      };
    }

    const k = topK ?? 5;

    try {
      const results = await this.vector.unifiedSemanticSearch(
        query,
        merchantId,
        k,
      );
      return {
        status: 200,
        results,
        count: results.length,
      };
    } catch (err) {
      return {
        status: 500,
        error: err.message || 'Unknown error',
      };
    }
  }
}
