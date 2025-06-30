// src/modules/n8n-workflow/dto/update-workflow.dto.ts

import { IsObject } from 'class-validator';
import { WorkflowDefinition } from '../n8n-workflow.service';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  @ApiProperty({ type: Object, description: 'التعديلات على JSON الخاص بالورك فلو' })
  @IsObject()
  jsonPatch: Partial<WorkflowDefinition>;
}
