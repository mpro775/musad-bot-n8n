import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios'; // <-- أضف هذا السطر
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { MerchantsModule } from '../merchants/merchants.module';
import { EvolutionService } from './evolution.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Integration.name, schema: IntegrationSchema },
    ]),
    forwardRef(() => MerchantsModule),
    HttpModule, // <-- وهذا هنا
  ],
  providers: [IntegrationsService, EvolutionService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, EvolutionService],
})
export class IntegrationsModule {}
