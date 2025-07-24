import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StorefrontService } from './storefront.service';
import { Merchant } from '../merchants/schemas/merchant.schema';
import { Product } from '../products/schemas/product.schema';
import { Category } from '../categories/schemas/category.schema';
import { NotFoundException } from '@nestjs/common';

describe('StorefrontService', () => {
  let service: StorefrontService;
  let merchantModel: any;
  let productModel: any;
  let categoryModel: any;

  beforeEach(async () => {
    merchantModel = { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
    productModel = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) };
    categoryModel = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontService,
        { provide: getModelToken(Merchant.name), useValue: merchantModel },
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: getModelToken(Category.name), useValue: categoryModel },
      ],
    }).compile();

    service = module.get<StorefrontService>(StorefrontService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when merchant not found', async () => {
    await expect(service.getStorefront('bad')).rejects.toBeInstanceOf(NotFoundException);
  });
});
