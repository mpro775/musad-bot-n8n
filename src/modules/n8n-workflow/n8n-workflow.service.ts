// src/modules/n8n-workflow/n8n-workflow.service.ts

import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import templateJson from './workflow-template.json';

import { WorkflowHistoryService } from '../workflow-history/workflow-history.service';
import { MerchantsService } from '../merchants/merchants.service';

/**
 * الهيكل الكامل الذي يعيده n8n عند GET /workflows/:id
 */
export interface WorkflowDefinition {
  id?: string;
  name: string;
  nodes: Array<{
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, { name: string }>;
  }>;
  connections: Record<string, unknown>;
  active: boolean;
  settings: Record<string, unknown>;
  pinData: Record<string, unknown>;
  // قد يحتوي على حقول أخرى مثل 'createdAt' و 'updatedAt'، يمكنك إضافتها إذا استعملتها
}

/**
 * الهيكل المسموح به عند POST /workflows
 */
interface WorkflowCreatePayload {
  name: string;
  nodes: Array<{
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, { name: string }>;
  }>;
  connections: Record<string, unknown>;
  active?: boolean;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
}

@Injectable()
export class N8nWorkflowService {
  private api: AxiosInstance;
  private readonly logger = new Logger(N8nWorkflowService.name);

  constructor(
    private readonly history: WorkflowHistoryService,
    @Inject(forwardRef(() => MerchantsService))
    private readonly merchants: MerchantsService,
  ) {
    const keyName = 'X-N8N-API-KEY';
    const apiKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZWExMTI3Yi0zZDg3LTQ1ODAtODlhNi00ZmZkOTU0ZTg1YWUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzUwMjAzODk3fQ.eSJGKYsoQ3ZY4FLUF1fmuHgSM3uxTDyQAkPavpzJcnY';
    const baseUrl = 'https://n8n.kaleem-ai.com'.replace(/\/+$/, '');

    this.logger.log(`▶️ [n8n.baseURL] = ${baseUrl}`);
    this.logger.log(`▶️ [n8n.header]  = ${keyName}: ${apiKey}`);

    this.api = axios.create({
      baseURL: `${baseUrl}/api/v1`,
      headers: { [keyName]: apiKey },
      timeout: 5000,
    });
  }

  private wrapError(err: any, action: string): never {
    this.logger.error(`n8n API ${action} raw error`, {
      status: err.response?.status,
      data: err.response?.data,
      msg: err.message,
    });
    const status = err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      err.response?.data?.message || err.message || 'Unknown error';
    throw new HttpException(`n8n API ${action} failed: ${message}`, status);
  }

  /** نظّف القالب من الحقول غير المدعومة */
  private sanitizeTemplate(raw: any): WorkflowCreatePayload {
    // ننشئ نسخة قابلة للتعديل
    const cleanRaw: any = { ...raw };
    const {
      ...rest // כל השאר
    } = raw;
    // نحذف الحقول العلوية الزائدة
    delete cleanRaw.id;
    delete cleanRaw.versionId;
    delete cleanRaw.meta;
    delete cleanRaw.tags;

    const staticData = cleanRaw.pinData ?? {};
    delete cleanRaw.pinData;

    // نُعرّف نوعًا للعُقدة
    type NodeDef = WorkflowCreatePayload['nodes'][number];
    const nodes: NodeDef[] = (rest.nodes as any[]).map((n) => {
      const node: NodeDef = {
        name: n.name,
        type: n.type,
        typeVersion: n.typeVersion,
        position: n.position as [number, number],
        parameters: n.parameters,
        ...(n.credentials && {
          credentials: Object.fromEntries(
            Object.entries(n.credentials).map(([k, cred]: [string, any]) => [
              k,
              { name: cred.name },
            ]),
          ) as Record<string, { name: string }>,
        }),
      };
      return node;
    });

    // 4) בונים את ה־payload הסופי
    const payload: WorkflowCreatePayload = {
      name: rest.name,
      nodes,
      connections: rest.connections,
      ...(typeof rest.active === 'boolean' && { active: rest.active }),
      ...(rest.settings && { settings: rest.settings }),
      ...(Object.keys(staticData).length > 0 && { staticData }),
    };

    return payload;
  }

  /** إنشاء workflow جديد */
  async createForMerchant(merchantId: string): Promise<string> {
    // clone
    const raw = JSON.parse(JSON.stringify(templateJson));
    raw.name = `wf-${merchantId}`;
    const aiPath = (merchantId: string) => `ai-agent-${merchantId}`;

    // ✔️ هكذا Route سيكون صحيحاً: /webhook/webhooks/incoming/...
    raw.nodes[0].parameters.path = aiPath(merchantId); // كان ثابت، الآن فريد لكل تاجر

    const payload = this.sanitizeTemplate(raw);

    this.logger.log('▶️ Payload to n8n:', JSON.stringify(payload, null, 2));

    try {
      const resp = await this.api.post('/workflows', payload);
      const wfId = (resp.data as { id: string }).id;

      await this.merchants.update(merchantId, { workflowId: wfId });
      await this.history.create({
        merchantId,
        workflowId: wfId,
        version: 1,
        workflowJson: payload,
        updatedBy: 'system',
        isRollback: false,
      });
      return wfId;
    } catch (err) {
      this.wrapError(err, 'CREATE');
    }
  }
  /** جلب الـ JSON الكامل */
  async get(workflowId: string): Promise<WorkflowDefinition> {
    try {
      const resp = await this.api.get<WorkflowDefinition>(
        `/workflows/${workflowId}`,
      );
      return resp.data;
    } catch (err) {
      this.wrapError(err, 'GET');
    }
  }

  /** تعديل الـ workflow */
  async update(
    workflowId: string,
    updateFn: (json: WorkflowDefinition) => WorkflowDefinition,
    updatedBy: string,
  ): Promise<void> {
    try {
      const current = await this.get(workflowId);
      const prev = await this.history.findAllByWorkflow(workflowId);
      const nextVer = prev.length ? prev[0].version + 1 : 1;
      const newJson = updateFn(current);

      await this.api.patch(`/workflows/${workflowId}`, newJson);
      await this.history.create({
        merchantId: current.name.replace('wf-', ''),
        workflowId,
        version: nextVer,
        workflowJson: newJson,
        updatedBy,
        isRollback: false,
      });
    } catch (err) {
      this.wrapError(err, 'UPDATE');
    }
  }

  /** استرجاع نسخة قديمة */
  async rollback(
    workflowId: string,
    version: string | number,
    updatedBy: string,
  ): Promise<void> {
    try {
      const hist = await this.history.findVersion(workflowId, +version);
      if (!hist) {
        throw new HttpException(
          'Requested version not found',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.api.patch(`/workflows/${workflowId}`, hist.workflowJson);
      await this.history.create({
        merchantId: hist.merchantId,
        workflowId,
        version: hist.version + 1,
        workflowJson: hist.workflowJson,
        updatedBy,
        isRollback: true,
      });
    } catch (err) {
      this.wrapError(err, 'ROLLBACK');
    }
  }

  /** استنساخ workflow */
  async cloneToMerchant(
    sourceId: string,
    targetMerchantId: string,
    createdBy: string,
  ): Promise<string> {
    try {
      const source = await this.get(sourceId);
      source.name = `wf-${targetMerchantId}`;
      source.nodes[0].parameters.path = `/webhooks/incoming/${targetMerchantId}`;

      const resp = await this.api.post('/workflows', source);
      const wfId = (resp.data as { id: string }).id;

      await this.merchants.update(targetMerchantId, { workflowId: wfId });
      await this.history.create({
        merchantId: targetMerchantId,
        workflowId: wfId,
        version: 1,
        workflowJson: source,
        updatedBy: createdBy,
        isRollback: false,
      });
      return wfId;
    } catch (err) {
      this.wrapError(err, 'CLONE');
    }
  }

  /** تفعيل/تعطيل workflow */
  async setActive(workflowId: string, active: boolean): Promise<void> {
    try {
      const action = active ? 'activate' : 'deactivate';
      await this.api.post(`/workflows/${workflowId}/${action}`);
    } catch (err) {
      this.wrapError(err, 'SET ACTIVE');
    }
  }
}
