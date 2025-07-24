import { VectorService } from './vector.service';
import { HttpService } from '@nestjs/axios';
import { ProductsService } from '../products/products.service';

describe('VectorService', () => {
  it('builds embedding text correctly', () => {
    const service = new VectorService({} as HttpService, {} as ProductsService);
    const text = (service as any).buildTextForEmbedding({
      id: '1',
      name: 'Phone',
      description: 'Nice phone',
      category: 'Electronics',
      specsBlock: ['64GB', 'Black'],
      keywords: ['smartphone', 'mobile'],
      merchantId: 'm1',
    });
    expect(text).toBe(
      'Name: Phone. Description: Nice phone. Category: Electronics. Specs: 64GB, Black. Keywords: smartphone, mobile',
    );
  });
});
