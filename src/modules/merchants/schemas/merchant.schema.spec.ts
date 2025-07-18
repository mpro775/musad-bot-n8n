import { MerchantSchema } from './merchant.schema';

describe('MerchantSchema', () => {
  it('should be defined', () => {
    expect(MerchantSchema).toBeDefined();
  });

  it('should contain userId field', () => {
    const path = MerchantSchema.path('userId');
    expect(path).toBeDefined();
  });
});
