// src/modules/integrations/integrations.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchants/:merchantId/integrations')
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available integrations for merchant' })
  list(@Param('merchantId') merchantId: string) {
    return this.svc.list(merchantId);
  }

  @Post(':key/connect')
  @ApiOperation({ summary: 'Connect an integration' })
  connect(
    @Param('merchantId') merchantId: string,
    @Param('key') key: string,
    @Body() config: Record<string, any>,
  ) {
    return this.svc.connect(merchantId, key as any, config);
  }

  @Delete(':key/disconnect')
  @ApiOperation({ summary: 'Disconnect an integration' })
  disconnect(
    @Param('merchantId') merchantId: string,
    @Param('key') key: string,
  ) {
    return this.svc.disconnect(merchantId, key as any);
  }
}
