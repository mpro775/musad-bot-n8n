// src/modules/integrations/integrations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Integration.name, schema: IntegrationSchema },
    ]),
    forwardRef(() => MerchantsModule),
  ],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
