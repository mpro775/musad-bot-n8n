// src/modules/n8n-workflow/dto/update-workflow.dto.ts

import { IsObject } from 'class-validator';
import { WorkflowDefinition } from '../n8n-workflow.service';

export class UpdateWorkflowDto {
  @IsObject()
  jsonPatch: Partial<WorkflowDefinition>;
}
