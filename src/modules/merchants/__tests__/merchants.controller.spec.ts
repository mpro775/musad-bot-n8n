import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsController } from '../merchants.controller';
import { MerchantsService } from '../merchants.service';
import { MerchantChecklistService } from '../merchant-checklist.service';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { UpdateMerchantDto } from '../dto/update-merchant.dto';
import { OnboardingBasicDto } from '../dto/onboarding-basic.dto';

describe('MerchantsController', () => {
  let controller: MerchantsController;
  let merchantsService: jest.Mocked<MerchantsService>;
  let checklistService: jest.Mocked<MerchantChecklistService>;

  const mockMerchant = {
    _id: '64a00000000000000000001',
    name: 'Test Merchant',
    email: 'test@merchant.com',
    slug: 'test-merchant',
    status: 'active',
  };

  beforeEach(async () => {
    const mockMerchantsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      onboardingBasic: jest.fn(),
      uploadLogo: jest.fn(),
      getMerchantBySlug: jest.fn(),
    };

    const mockChecklistService = {
      getChecklistGroups: jest.fn(),
      updateChecklistItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [
        { provide: MerchantsService, useValue: mockMerchantsService },
        { provide: MerchantChecklistService, useValue: mockChecklistService },
      ],
    }).compile();

    controller = module.get<MerchantsController>(MerchantsController);
    merchantsService = module.get(MerchantsService);
    checklistService = module.get(MerchantChecklistService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a merchant', async () => {
      const createDto: CreateMerchantDto = {
        name: 'New Merchant',
        email: 'new@merchant.com',
      } as CreateMerchantDto;

      merchantsService.create.mockResolvedValue(mockMerchant as any);

      const result = await controller.create(createDto, {
        user: { userId: 'user1' },
      } as any);

      expect(merchantsService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockMerchant);
    });
  });

  describe('findAll', () => {
    it('should return all merchants', async () => {
      const merchants = [mockMerchant];
      merchantsService.findAll.mockResolvedValue(merchants as any);

      const result = await controller.findAll();

      expect(merchantsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(merchants);
    });
  });

  describe('findOne', () => {
    it('should return a merchant by id', async () => {
      merchantsService.findOne.mockResolvedValue(mockMerchant as any);

      const result = await controller.findOne('64a00000000000000000001');

      expect(merchantsService.findOne).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockMerchant);
    });
  });

  describe('update', () => {
    it('should update a merchant', async () => {
      const updateDto: UpdateMerchantDto = { name: 'Updated Merchant' };
      const updatedMerchant = { ...mockMerchant, name: 'Updated Merchant' };

      merchantsService.update.mockResolvedValue(updatedMerchant as any);

      const result = await controller.update(
        '64a00000000000000000001',
        updateDto,
      );

      expect(merchantsService.update).toHaveBeenCalledWith(
        '64a00000000000000000001',
        updateDto,
      );
      expect(result).toEqual(updatedMerchant);
    });
  });

  describe('onboardingBasic', () => {
    it('should handle basic onboarding', async () => {
      const onboardingDto: OnboardingBasicDto = {
        businessName: 'Test Business',
        businessType: 'retail',
      } as OnboardingBasicDto;

      merchantsService.onboardingBasic.mockResolvedValue(mockMerchant as any);

      const result = await controller.onboardingBasic(
        '64a00000000000000000001',
        onboardingDto,
        { user: { userId: 'user1' } } as any,
      );

      expect(merchantsService.onboardingBasic).toHaveBeenCalledWith(
        '64a00000000000000000001',
        onboardingDto,
        'user1',
      );
      expect(result).toEqual(mockMerchant);
    });
  });

  describe('getChecklistGroups', () => {
    it('should return checklist groups', async () => {
      const mockGroups = [{ id: 'group1', title: 'Basic Setup', items: [] }];

      checklistService.getChecklistGroups.mockResolvedValue(mockGroups as any);

      const result = await controller.getChecklistGroups(
        '64a00000000000000000001',
      );

      expect(checklistService.getChecklistGroups).toHaveBeenCalledWith(
        '64a00000000000000000001',
      );
      expect(result).toEqual(mockGroups);
    });
  });
});
