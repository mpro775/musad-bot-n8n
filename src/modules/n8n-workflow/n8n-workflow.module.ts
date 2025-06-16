import { Module } from '@nestjs/common';
import { N8nWorkflowController } from './n8n-workflow.controller';
import { N8nWorkflowService } from './n8n-workflow.service';
import { WorkflowHistoryModule } from '../workflow-history/workflow-history.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [WorkflowHistoryModule, MerchantsModule],
  controllers: [N8nWorkflowController],
  providers: [N8nWorkflowService],
  exports: [N8nWorkflowService], // لو كنت تستخدمه خارج هذه الوحدة
})
export class N8nWorkflowModule {}
