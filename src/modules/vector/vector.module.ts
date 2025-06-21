import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { VectorController } from './vector.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule, // ← أضف هذا
    // … بقية الوحدات
  ],
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}
