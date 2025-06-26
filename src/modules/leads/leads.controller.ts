import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchants/:merchantId/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead for merchant' })
  createLead(
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.create(merchantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leads for merchant' })
  getLeads(@Param('merchantId') merchantId: string) {
    return this.leadsService.findAllForMerchant(merchantId);
  }
}
