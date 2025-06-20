import { Module } from '@nestjs/common';
import { VectorService } from './vector.service';
import { VectorController } from './vector.controller';

@Module({
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}
