// src/vector/vector.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { VectorService } from './vector.service';

@Controller('semantic')
export class VectorController {
  constructor(private readonly vector: VectorService) {}

  @Post('products')
  async semanticProducts(@Body() body: { text: string }) {
    // استدعاء البحث الدلالي
    const recs = await this.vector.querySimilarProducts(body.text, 5);
    return { recommendations: recs };
  }
}
