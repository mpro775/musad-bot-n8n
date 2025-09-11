import {
  Injectable,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { TranslationService } from '../../common/services/translation.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MerchantsRepository } from './repositories/merchants.repository';
import { CreateMerchantDto } from './dto/requests/create-merchant.dto';
import { UpdateMerchantDto } from './dto/requests/update-merchant.dto';
import { QuickConfigDto } from './dto/requests/quick-config.dto';
import { OnboardingBasicDto } from './dto/requests/onboarding-basic.dto';
import { PreviewPromptDto } from './dto/requests/preview-prompt.dto';
import { QuickConfig } from './schemas/quick-config.schema';
import { MerchantStatusResponse } from './types/types';
import { Types } from 'mongoose';
import { N8nWorkflowService } from '../n8n-workflow/n8n-workflow.service';
import { ConfigService } from '@nestjs/config';
import { PromptVersionService } from './services/prompt-version.service';
import { PromptPreviewService } from './services/prompt-preview.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { StorefrontService } from '../storefront/storefront.service';
import { ChatWidgetService } from '../chat/chat-widget.service';
import { CleanupCoordinatorService } from './cleanup-coordinator.service';
import { BusinessMetrics } from 'src/metrics/business.metrics';
import * as Handlebars from 'handlebars';
import { buildHbsContext, stripGuardSections } from './services/prompt-utils';

@Injectable()
export class MerchantsService {
  private readonly logger = new Logger(MerchantsService.name);

  constructor(
    @Inject('MerchantsRepository')
    private readonly merchantsRepository: MerchantsRepository,
    private readonly config: ConfigService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly versionSvc: PromptVersionService,
    private readonly storefrontService: StorefrontService,
    private readonly previewSvc: PromptPreviewService,
    private readonly cleanupCoordinator: CleanupCoordinatorService,
    private readonly n8n: N8nWorkflowService,
    private readonly businessMetrics: BusinessMetrics,
    private readonly chatWidgetService: ChatWidgetService,
    private readonly i18n: I18nService,
    private readonly translationService: TranslationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateMerchantDto) {
    const merchant = await this.merchantsRepository.create(dto);

    this.businessMetrics.incMerchantCreated();
    this.businessMetrics.incN8nWorkflowCreated();

    let wfId: string | null = null;
    let storefrontCreated = false;

    try {
      wfId = await this.n8n.createForMerchant(merchant.id);
      merchant.workflowId = wfId;

      merchant.finalPromptTemplate =
        await this.promptBuilder.compileTemplate(merchant);
      await merchant.save?.();

      await this.storefrontService.create({
        merchant: merchant.id,
        primaryColor: '#FF8500',
        secondaryColor: '#1976d2',
        buttonStyle: 'rounded',
        banners: [],
        featuredProductIds: [],
        slug: merchant.id.toString(),
      });
      storefrontCreated = true;

      return merchant;
    } catch (err: any) {
      try {
        if (wfId) {
          try {
            await this.n8n.setActive(wfId, false);
          } catch {}
          try {
            await this.n8n.delete(wfId);
          } catch {}
        }
        if (storefrontCreated) {
          try {
            await this.storefrontService.deleteByMerchant(merchant.id);
          } catch {}
        }
      } finally {
        await this.merchantsRepository.remove(merchant.id);
      }
      this.logger.error('Merchant initialization failed', err);
      throw new InternalServerErrorException(
        this.translationService.translate(
          'merchants.errors.initializationFailed',
        ),
      );
    }
  }

  async update(id: string, dto: UpdateMerchantDto) {
    const updated = await this.merchantsRepository.update(id, dto);

    if (dto.publicSlug) {
      await this.chatWidgetService.syncWidgetSlug(id, dto.publicSlug);
    }

    try {
      const compiled = await this.promptBuilder.compileTemplate(updated);
      updated.set?.('finalPromptTemplate', compiled);
      await updated.save?.();
    } catch (e) {
      this.logger.error('Error compiling prompt template after update', e);
    }

    // Invalidate cache after update
    await this.invalidateMerchantCache(id);

    return updated;
  }

  // Cache invalidation helper
  private async invalidateMerchantCache(merchantId: string) {
    const promises = [
      this.cacheManager.del(`merchant:${merchantId}`),
      this.cacheManager.del(`merchant:status:${merchantId}`),
      this.cacheManager.del(`merchant:prompt:${merchantId}`),
    ];
    await Promise.all(promises);
  }

  async findAll() {
    return this.merchantsRepository.findAll();
  }

  async findOne(id: string) {
    // Check cache first
    const cacheKey = `merchant:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const merchant = await this.merchantsRepository.findOne(id);
    if (!merchant) {
      throw new NotFoundException(
        this.translationService.translate('merchants.errors.notFound'),
      );
    }

    merchant.finalPromptTemplate =
      await this.promptBuilder.compileTemplate(merchant);

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, merchant, 600000);

    return merchant;
  }

  async saveBasicInfo(merchantId: string, dto: OnboardingBasicDto) {
    const m = await this.merchantsRepository.saveBasicInfo(merchantId, dto);

    try {
      m.finalPromptTemplate = await this.promptBuilder.compileTemplate(m);
      await m.save?.();
    } catch {
      this.logger.warn('Prompt compile skipped after basic info');
    }

    // Invalidate cache after basic info update
    await this.invalidateMerchantCache(merchantId);

    return m;
  }

  async remove(id: string) {
    return this.merchantsRepository.remove(id);
  }

  async softDelete(
    id: string,
    actor: { userId: string; role: string },
    reason?: string,
  ) {
    return this.merchantsRepository.softDelete(id, actor, reason);
  }

  async restore(id: string, actor: { userId: string; role: string }) {
    return this.merchantsRepository.restore(id, actor);
  }

  async purge(id: string, actor: { userId: string; role: string }) {
    await this.cleanupCoordinator.purgeAll(id);
    return this.merchantsRepository.purge(id, actor);
  }

  async isSubscriptionActive(id: string): Promise<boolean> {
    return this.merchantsRepository.isSubscriptionActive(id);
  }

  async buildFinalPrompt(id: string): Promise<string> {
    // Check cache first for compiled prompt
    const cacheKey = `merchant:prompt:${id}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const m = await this.merchantsRepository.findOne(id);
    const tpl = await this.promptBuilder.compileTemplate(m);
    m.finalPromptTemplate = tpl;
    await m.save?.();

    // Cache compiled prompt for 30 minutes
    await this.cacheManager.set(cacheKey, tpl, 1800000);

    return tpl;
  }

  async saveAdvancedVersion(id: string, newTpl: string, note?: string) {
    await this.versionSvc.snapshot(id, note);
    const m = await this.merchantsRepository.findOne(id);
    m.currentAdvancedConfig.template = newTpl;
    await m.save?.();

    // Invalidate cache after advanced version save
    await this.invalidateMerchantCache(id);
  }

  async listAdvancedVersions(id: string) {
    return this.versionSvc.list(id);
  }

  async revertAdvancedVersion(id: string, index: number) {
    return this.versionSvc.revert(id, index);
  }

  async updateQuickConfig(
    id: string,
    dto: QuickConfigDto,
  ): Promise<QuickConfig> {
    const quickConfig = await this.merchantsRepository.updateQuickConfig(
      id,
      dto,
    );
    const updatedDoc = await this.merchantsRepository.findOne(id);

    const newPrompt = await this.promptBuilder.compileTemplate(updatedDoc);
    updatedDoc.finalPromptTemplate = newPrompt;
    await updatedDoc.save?.();

    // Invalidate cache after quick config update
    await this.invalidateMerchantCache(id);

    return quickConfig;
  }

  async previewPromptV2(id: string, dto: PreviewPromptDto): Promise<string> {
    const m = await this.findOne(id);
    const merged = (m as any).toObject ? (m as any).toObject() : m;

    if (dto.quickConfig && Object.keys(dto.quickConfig).length) {
      merged.quickConfig = { ...merged.quickConfig, ...dto.quickConfig };
    }

    const ctx = buildHbsContext(merged, dto.testVars ?? {});
    const audience = dto.audience ?? 'merchant';

    const withGuard = await this.promptBuilder.compileTemplate(merged);

    if (audience === 'agent') {
      return Handlebars.compile(withGuard)(ctx);
    }

    const noGuard = stripGuardSections(withGuard);
    return Handlebars.compile(noGuard)(ctx);
  }

  async getStatus(id: string): Promise<MerchantStatusResponse> {
    // Cache merchant status for 5 minutes
    const cacheKey = `merchant:status:${id}`;
    const cached =
      await this.cacheManager.get<MerchantStatusResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const status = await this.merchantsRepository.getStatus(id);
    await this.cacheManager.set(cacheKey, status, 300000);

    return status;
  }

  async getAdvancedTemplateForEditor(
    id: string,
    testVars: Record<string, string> = {},
  ) {
    const m = await this.findOne(id);

    const current = (m as any).currentAdvancedConfig?.template?.trim() ?? '';
    if (current) {
      return {
        template: current,
        note: (m as any).currentAdvancedConfig?.note ?? '',
      };
    }

    const finalWithGuard = await this.promptBuilder.compileTemplate(m as any);
    const noGuard = stripGuardSections(finalWithGuard);

    const filled = Handlebars.compile(noGuard)(
      buildHbsContext(m as any, testVars),
    );

    return { template: filled, note: 'Generated from final (no guard)' };
  }

  async ensureForUser(
    userId: Types.ObjectId,
    opts?: { name?: string; slugBase?: string },
  ) {
    return this.merchantsRepository.ensureForUser(userId, opts);
  }

  // Check if public slug exists
  async existsByPublicSlug(slug: string): Promise<boolean> {
    // For now, return false as this method needs to be implemented in the repository
    // const merchant = await this.merchantsRepository.findByPublicSlug(slug);
    // return !!merchant;
    return false;
  }

  // Upload logo to MinIO
  async uploadLogoToMinio(
    merchantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // This would typically use a media service to upload to MinIO
    // For now, return a placeholder URL
    return `https://minio.example.com/logos/${merchantId}/${file.originalname}`;
  }

  // Ensure workflow exists for merchant
  async ensureWorkflow(merchantId: string): Promise<string> {
    const merchant = await this.findOne(merchantId);
    const merchantDoc = merchant as any;
    if (!merchantDoc.workflowId) {
      // Logic to create workflow would go here
      return 'wf_placeholder';
    }
    return merchantDoc.workflowId;
  }

  // Get store context for AI
  async getStoreContext(merchantId: string): Promise<any> {
    const merchant = await this.findOne(merchantId);
    const merchantDoc = merchant as any;
    return {
      merchantId: merchantDoc._id,
      name: merchantDoc.name,
      description: merchantDoc.description,
      // Add other relevant store context
    };
  }

  // Set product source for merchant
  async setProductSource(merchantId: string, source: string): Promise<any> {
    const merchant = await this.findOne(merchantId);
    const merchantDoc = merchant as any;
    merchantDoc.productSource = source;
    await this.merchantsRepository.update(merchantId, {
      productSource: source,
    } as any);
    return merchant;
  }
}
