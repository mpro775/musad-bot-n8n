// src/modules/n8n-workflow/n8n-workflow.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { N8nWorkflowService, WorkflowDefinition } from './n8n-workflow.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { RollbackDto } from './dto/rollback.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('n8n Workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('n8n/workflows')
export class N8nWorkflowController {
  constructor(private readonly service: N8nWorkflowService) {}

  @Post(':merchantId')
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create workflow for a merchant' })
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiOkResponse({ description: 'Workflow created', schema: { example: { workflowId: '123' } } })
  async createForMerchant(
    @Param('merchantId') merchantId: string,
  ): Promise<{ workflowId: string }> {
    console.log('🔗 Using n8n.baseURL=', process.env.N8N_BASE_URL);
    console.log('🔑 Using N8N_API_KEY=', process.env.N8N_API_KEY);

    console.log('👣 ENTER createForMerchant for merchantId=', merchantId);
    const wfId = await this.service.createForMerchant(merchantId);
    console.log('👣 EXIT createForMerchant, got wfId=', wfId);
    return { workflowId: wfId };
  }

  @Get(':workflowId')
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Get workflow definition' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  async get(
    @Param('workflowId') workflowId: string,
  ): Promise<WorkflowDefinition> {
    return await this.service.get(workflowId);
  }

  @Patch(':workflowId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update workflow definition' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  @ApiBody({ type: UpdateWorkflowDto })
  @ApiOkResponse({ description: 'Workflow updated' })
  async update(
    @Param('workflowId') workflowId: string,
    @Body() body: UpdateWorkflowDto,
  ): Promise<{ message: string }> {
    // استعمل Partial<WorkflowDefinition> مباشرة
    await this.service.update(
      workflowId,
      (json) => ({
        ...json,
        ...body.jsonPatch,
      }),
      'admin',
    );
    return { message: 'Workflow updated and history recorded' };
  }

  @Post(':workflowId/rollback')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rollback workflow to a previous version' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  @ApiBody({ type: RollbackDto })
  @ApiOkResponse({ description: 'Rollback successful' })
  async rollback(
    @Param('workflowId') workflowId: string,
    @Body() dto: RollbackDto,
  ): Promise<{ message: string }> {
    await this.service.rollback(workflowId, dto.version, 'admin');
    return { message: `Rolled back to version ${dto.version}` };
  }

  @Post(':workflowId/clone/:targetMerchantId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Clone workflow to another merchant' })
  @ApiParam({ name: 'workflowId', description: 'Source workflow ID' })
  @ApiParam({ name: 'targetMerchantId', description: 'Target merchant ID' })
  @ApiOkResponse({ description: 'Cloned successfully' })
  async clone(
    @Param('workflowId') sourceId: string,
    @Param('targetMerchantId') targetMerchantId: string,
  ): Promise<{ message: string; newWorkflowId: string }> {
    const newId = await this.service.cloneToMerchant(
      sourceId,
      targetMerchantId,
      'admin',
    );
    return { message: 'Cloned successfully', newWorkflowId: newId };
  }

  @Patch(':workflowId/active')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activate or deactivate workflow' })
  @ApiParam({ name: 'workflowId', description: 'Workflow ID' })
  @ApiBody({ type: SetActiveDto })
  @ApiOkResponse({ description: 'Status updated' })
  async setActive(
    @Param('workflowId') workflowId: string,
    @Body() dto: SetActiveDto,
  ): Promise<{ message: string }> {
    await this.service.setActive(workflowId, dto.active);
    return { message: `Workflow ${dto.active ? 'activated' : 'deactivated'}` };
  }
}
