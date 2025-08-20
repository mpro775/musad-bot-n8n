// src/storefront/storefront.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { UpdateStorefrontDto } from './dto/update-storefront.dto';
import { Storefront, StorefrontDocument } from './schemas/storefront.schema';
import { CreateStorefrontDto } from './dto/create-storefront.dto';
import { FilterQuery } from 'mongoose';
export interface StorefrontResult {
  merchant: Merchant;
  products: Product[];
  categories: Category[];
}
@Injectable()
export class StorefrontService {
  constructor(
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Storefront.name)
    private storefrontModel: Model<StorefrontDocument>,
  ) {}
  async create(dto: CreateStorefrontDto): Promise<Storefront> {
    return this.storefrontModel.create(dto);
  }

  async update(id: string, dto: UpdateStorefrontDto): Promise<Storefront> {
    const storefront = await this.storefrontModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!storefront) throw new NotFoundException('Storefront not found');
    return storefront;
  }

  async getStorefront(slugOrId: string): Promise<StorefrontResult> {
    // احضر storefront عبر slug أو _id
    const sf = await this.storefrontModel
      .findOne(
        Types.ObjectId.isValid(slugOrId)
          ? { $or: [{ _id: slugOrId }, { slug: slugOrId }] }
          : { slug: slugOrId },
      )
      .lean();

    if (!sf) throw new NotFoundException('Storefront not found');

    // ثم احضر merchant المرتبط
    const merchant = await this.merchantModel.findById(sf.merchant).lean();
    if (!merchant) throw new NotFoundException('Merchant not found');

    const products = await this.productModel
      .find({ merchantId: merchant._id, status: 'active', isAvailable: true })
      .sort({ createdAt: -1 })
      .lean();

    const categories = await this.categoryModel
      .find({ merchantId: merchant._id })
      .sort({ name: 1 })
      .lean();

    return { merchant, products, categories };
  }
  async deleteByMerchant(merchantId: string) {
    await this.storefrontModel.deleteOne({ merchant: merchantId }).exec();
  }
  private merchantFilter(merchantId: string): FilterQuery<Storefront> {
    // نبحث بالـ string وبـ ObjectId لو صالح
    const or: any[] = [{ merchant: merchantId }];
    if (Types.ObjectId.isValid(merchantId)) {
      or.push({ merchant: new Types.ObjectId(merchantId) });
    }
    return { $or: or };
  }

  private normalizeSlug(input: string): string {
    let s = (input || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    s = s.replace(/[^a-z0-9-]/g, '');
    s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length < 3 || s.length > 50) {
      throw new BadRequestException('slug يجب أن يكون بين 3 و 50 حرفًا');
    }
    return s;
  }

  async checkSlugAvailable(slug: string): Promise<{ available: boolean }> {
    if (!slug) throw new BadRequestException('slug مطلوب');
    const n = this.normalizeSlug(slug);
    const exists = await this.storefrontModel.exists({ slug: n }).lean();
    return { available: !exists };
  }

  async findByMerchant(merchantId: string): Promise<StorefrontDocument | null> {
    return this.storefrontModel.findOne(this.merchantFilter(merchantId)).exec();
  }
  async updateByMerchant(merchantId: string, dto: UpdateStorefrontDto) {
    let sf = await this.storefrontModel.findOne(
      this.merchantFilter(merchantId),
    );
    if (!sf) {
      // إنشاء افتراضي إن لم توجد (علشان ما ترجع 404 للتجّار القدامى)
      const base: Partial<Storefront> = {
        merchant: Types.ObjectId.isValid(merchantId)
          ? new Types.ObjectId(merchantId)
          : (merchantId as any),
        primaryColor: '#FF8500',
        secondaryColor: '#1976d2',
        buttonStyle: 'rounded',
        slug: undefined!,
      };
      if (dto.slug) {
        const n = this.normalizeSlug(dto.slug);
        const conflict = await this.storefrontModel.exists({ slug: n }).lean();
        if (conflict) throw new BadRequestException('هذا الـ slug محجوز');
        base.slug = n;
      } else {
        // توليد slug افتراضي (merchantId أو merchant.name عند الحاجة)
        const fallback = Types.ObjectId.isValid(merchantId)
          ? merchantId.toString().slice(-8)
          : merchantId;
        let n = this.normalizeSlug(`store-${fallback}`);
        // حلّ تعارض تلقائيًا
        let i = 1;
        while (await this.storefrontModel.exists({ slug: n }).lean()) {
          n = this.normalizeSlug(`store-${fallback}-${i++}`);
        }
        base.slug = n;
      }
      sf = await this.storefrontModel.create(
        base as unknown as CreateStorefrontDto,
      );
    }

    // لا نسمح بتعديل merchant من البودي
    const update: Partial<Storefront> = { ...(dto as any) };
    delete (update as any).merchant;

    if (dto.slug) {
      const n = this.normalizeSlug(dto.slug);
      const conflict = await this.storefrontModel.exists({
        slug: n,
        _id: { $ne: sf._id },
      });
      if (conflict) throw new BadRequestException('هذا الـ slug محجوز');
      update.slug = n;
    }

    Object.assign(sf, update);
    await sf.save();
    return sf;
  }
}
