import { Test, TestingModule } from '@nestjs/testing';
import { MerchantPromptController } from '../controllers/merchant-prompt.controller';
import { MerchantsService } from '../merchants.service';
import { PromptVersionService } from '../services/prompt-version.service';
import { PromptPreviewService } from '../services/prompt-preview.service';
import { StorefrontService } from '../../storefront/storefront.service';
import { PromptBuilderService } from '../services/prompt-builder.service';
import { QuickConfigDto } from '../dto/quick-config.dto';
import { AdvancedTemplateDto } from '../dto/advanced-template.dto';
import { PreviewPromptDto } from '../dto/preview-prompt.dto';

describe('MerchantPromptController', () => {
  let controller: MerchantPromptController;
  let merchantsService: jest.Mocked<MerchantsService>;
  let versionService: jest.Mocked<PromptVersionService>;
  let previewService: jest.Mocked<PromptPreviewService>;
  let storefrontService: jest.Mocked<StorefrontService>;
  let promptBuilder: jest.Mocked<PromptBuilderService>;

  const mockMerchant = {
    _id: '64a00000000000000000001',
    name: 'Test Merchant',
    quickConfig: {
      businessName: 'Test Business',
      businessType: 'retail',
      targetAudience: 'general',
    },
    advancedConfig: {
      template: 'default',
      customizations: {},
    },
  };

  beforeEach(async () => {
    const mockMerchantsService = {
      findOne: jest.fn(),
      updateQuickConfig: jest.fn(),
      updateAdvancedConfig: jest.fn(),
    };

    const mockVersionService = {
      createVersion: jest.fn(),
      getVersions: jest.fn(),
      activateVersion: jest.fn(),
    };

    const mockPreviewService = {
      generatePreview: jest.fn(),
    };

    const mockStorefrontService = {
      findByMerchantId: jest.fn(),
    };

    const mockPromptBuilder = {
      buildPrompt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantPromptController],
      providers: [
        { provide: MerchantsService, useValue: mockMerchantsService },
        { provide: PromptVersionService, useValue: mockVersionService },
        { provide: PromptPreviewService, useValue: mockPreviewService },
        { provide: StorefrontService, useValue: mockStorefrontService },
        { provide: PromptBuilderService, useValue: mockPromptBuilder },
      ],
    }).compile();

    controller = module.get<MerchantPromptController>(MerchantPromptController);
    merchantsService = module.get(MerchantsService);
    versionService = module.get(PromptVersionService);
    previewService = module.get(PromptPreviewService);
    storefrontService = module.get(StorefrontService);
    promptBuilder = module.get(PromptBuilderService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getQuickConfig', () => {
    it('should return quick config for merchant', async () => {
      merchantsService.findOne.mockResolvedValue(mockMerchant as any);

      const result = await controller.getQuickConfig('64a00000000000000000001');

      expect(merchantsService.findOne).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockMerchant.quickConfig);
    });
  });

  describe('updateQuickConfig', () => {
    it('should update quick config', async () => {
      const quickConfigDto: QuickConfigDto = {
        businessName: 'Updated Business',
        businessType: 'ecommerce',
        targetAudience: 'young adults',
      } as QuickConfigDto;

      const updatedMerchant = {
        ...mockMerchant,
        quickConfig: quickConfigDto,
      };

      merchantsService.updateQuickConfig.mockResolvedValue(
        updatedMerchant as any,
      );

      const result = await controller.updateQuickConfig(
        '64a00000000000000000001',
        quickConfigDto,
      );

      expect(merchantsService.updateQuickConfig).toHaveBeenCalledWith(
        '64a00000000000000000001',
        quickConfigDto,
      );
      expect(result).toEqual(updatedMerchant.quickConfig);
    });
  });

  describe('getAdvancedConfig', () => {
    it('should return advanced config for merchant', async () => {
      merchantsService.findOne.mockResolvedValue(mockMerchant as any);

      const result = await controller.getAdvancedConfig(
        '64a00000000000000000001',
      );

      expect(merchantsService.findOne).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockMerchant.advancedConfig);
    });
  });

  describe('updateAdvancedConfig', () => {
    it('should update advanced config', async () => {
      const advancedDto: AdvancedTemplateDto = {
        template: 'custom',
        customizations: {
          greeting: 'Welcome to our store!',
        },
      } as AdvancedTemplateDto;

      const updatedMerchant = {
        ...mockMerchant,
        advancedConfig: advancedDto,
      };

      merchantsService.updateAdvancedConfig.mockResolvedValue(
        updatedMerchant as any,
      );

      const result = await controller.updateAdvancedConfig(
        '64a00000000000000000001',
        advancedDto,
      );

      expect(merchantsService.updateAdvancedConfig).toHaveBeenCalledWith(
        '64a00000000000000000001',
        advancedDto,
      );
      expect(result).toEqual(updatedMerchant.advancedConfig);
    });
  });

  describe('previewPrompt', () => {
    it('should generate prompt preview', async () => {
      const previewDto: PreviewPromptDto = {
        userMessage: 'Hello, I need help with my order',
      } as PreviewPromptDto;

      const mockPreview = {
        prompt: 'Generated prompt content',
        context: { businessName: 'Test Business' },
      };

      previewService.generatePreview.mockResolvedValue(mockPreview as any);

      const result = await controller.previewPrompt(
        '64a00000000000000000001',
        previewDto,
      );

      expect(previewService.generatePreview).toHaveBeenCalledWith(
        '64a00000000000000000001',
        previewDto,
      );
      expect(result).toEqual(mockPreview);
    });
  });

  describe('createVersion', () => {
    it('should create a new prompt version', async () => {
      const mockVersion = {
        _id: 'version1',
        merchantId: '64a00000000000000000001',
        version: 1,
        isActive: false,
      };

      versionService.createVersion.mockResolvedValue(mockVersion as any);

      const result = await controller.createVersion('64a00000000000000000001');

      expect(versionService.createVersion).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockVersion);
    });
  });

  describe('getVersions', () => {
    it('should return all versions for merchant', async () => {
      const mockVersions = [
        { _id: 'version1', version: 1, isActive: true },
        { _id: 'version2', version: 2, isActive: false },
      ];

      versionService.getVersions.mockResolvedValue(mockVersions as any);

      const result = await controller.getVersions('64a00000000000000000001');

      expect(versionService.getVersions).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockVersions);
    });
  });

  describe('activateVersion', () => {
    it('should activate a specific version', async () => {
      const mockActivatedVersion = {
        _id: 'version2',
        merchantId: '64a00000000000000000001',
        version: 2,
        isActive: true,
      };

      versionService.activateVersion.mockResolvedValue(
        mockActivatedVersion as any,
      );

      const result = await controller.activateVersion(
        '64a00000000000000000001',
        2,
      );

      expect(versionService.activateVersion).toHaveBeenCalledWith(
        '64a00000000000000000001',
        2,
      );
      expect(result).toEqual(mockActivatedVersion);
    });
  });
});
