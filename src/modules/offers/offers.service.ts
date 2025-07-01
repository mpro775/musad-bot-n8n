// src/modules/offers/offers.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Offer, OfferDocument } from './schemas/offer.schema';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { VectorService } from '../vector/vector.service';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly vectorService: VectorService,
  ) {}

  // 🟢 إنشاء عرض جديد
  async create(
    dto: CreateOfferDto,
    merchantId: string,
  ): Promise<OfferDocument> {
    // حماية: منع تجاوز الحد الأقصى للعروض حسب خطة التاجر
    const offersCount = await this.offerModel
      .countDocuments({ merchantId })
      .exec();
    // TODO: اجلب الحد من خطة التاجر بدلاً من رقم ثابت!
    const MAX_OFFERS_PER_MERCHANT = 50;
    if (offersCount >= MAX_OFFERS_PER_MERCHANT) {
      throw new ForbiddenException('تم تجاوز الحد الأقصى لعدد العروض في خطتك');
    }

    // تحقق من عدم تكرار اسم العرض أو الكود لنفس التاجر
    if (dto.code) {
      const exists = await this.offerModel
        .findOne({ merchantId, code: dto.code })
        .exec();
      if (exists) throw new BadRequestException('كود الكوبون مستخدم بالفعل');
    }
    const nameExists = await this.offerModel
      .findOne({ merchantId, name: dto.name })
      .exec();
    if (nameExists) throw new BadRequestException('اسم العرض مستخدم بالفعل');

    // تحقق أن كل المنتجات تخص التاجر
    let productIds: Types.ObjectId[] = [];
    if (dto.products && dto.products.length) {
      const foundProducts = await this.productModel
        .find({
          _id: { $in: dto.products.map((id) => new Types.ObjectId(id)) },
          merchantId,
        })
        .exec();
      if (foundProducts.length !== dto.products.length) {
        throw new BadRequestException('منتجات غير صالحة أو لا تتبع التاجر');
      }
      productIds = foundProducts.map((p) => p._id);
    }

    // حماية التواريخ
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد البداية');
    }

    // بناء وثيقة العرض
    const offer = new this.offerModel({
      merchantId,
      name: dto.name,
      type: dto.type,
      value: dto.value,
      products: productIds,
      category: dto.category || null,
      description: dto.description || '',
      startDate: dto.startDate,
      endDate: dto.endDate,
      code: dto.code || null,
      usageLimit: dto.usageLimit || 0,
      usedCount: 0,
      active: true,
      meta: {},
    });
    await this.vectorService.upsertOffers([
      {
        id: offer._id.toString(),
        name: offer.name,
        description: offer.description,
        type: offer.type,
        code: offer.code,
      },
    ]);
    await offer.save();
    return offer;
  }
  async getOfferByIdList(
    ids: string[],
    merchantId: string,
  ): Promise<OfferDocument[]> {
    if (!ids.length) return [];

    return this.offerModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        merchantId: new Types.ObjectId(merchantId),
      })
      .lean()
      .exec();
  }

  async searchOffers(merchantId: string, query: string) {
    const mId =
      typeof merchantId === 'string'
        ? new Types.ObjectId(merchantId)
        : merchantId;

    return this.offerModel
      .find({
        merchantId: mId,
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
      .sort({ validUntil: 1 })
      .limit(10)
      .lean();
  }

  // 🟢 جلب كل العروض الخاصة بتاجر
  // في OffersService
  async findAllByMerchant(
    merchantId: string,
    filter: any = {},
  ): Promise<OfferDocument[]> {
    return this.offerModel
      .find({ merchantId, ...filter })
      .populate('products')
      .sort({ createdAt: -1 })
      .exec();
  }

  // 🟢 جلب عرض واحد
  async findOne(id: string, merchantId: string): Promise<OfferDocument> {
    const offer = await this.offerModel
      .findById(id)
      .populate('products')
      .exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.merchantId.toString() !== merchantId)
      throw new ForbiddenException('ليس لديك صلاحية');
    return offer;
  }

  // 🟢 تحديث عرض
  async update(
    id: string,
    dto: UpdateOfferDto,
    merchantId: string,
  ): Promise<OfferDocument> {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.merchantId.toString() !== merchantId)
      throw new ForbiddenException('ليس لديك صلاحية');

    // حماية: لا يسمح بتغيير المنتجات إلى منتجات من تاجر آخر
    let productIds: Types.ObjectId[] | undefined = undefined;
    if (dto.products && dto.products.length) {
      const foundProducts = await this.productModel
        .find({
          _id: { $in: dto.products.map((id) => new Types.ObjectId(id)) },
          merchantId,
        })
        .exec();
      if (foundProducts.length !== dto.products.length) {
        throw new BadRequestException('منتجات غير صالحة أو لا تتبع التاجر');
      }
      productIds = foundProducts.map((p) => p._id);
    }

    // حماية التواريخ
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد البداية');
    }

    // تحديث العرض
    Object.assign(offer, {
      ...dto,
      ...(productIds && { products: productIds }),
    });
    await offer.save();
    await this.vectorService.upsertOffers([
      {
        id: offer._id.toString(),
        name: offer.name,
        description: offer.description,
        type: offer.type,
        code: offer.code,
      },
    ]);
    return offer;
  }

  // 🟢 حذف عرض
  async remove(id: string, merchantId: string): Promise<void> {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.merchantId.toString() !== merchantId)
      throw new ForbiddenException('ليس لديك صلاحية');
    await this.offerModel.findByIdAndDelete(id).exec();
  }

  // 🟢 تفعيل/تعطيل عرض يدويًا
  async setActive(
    id: string,
    merchantId: string,
    active: boolean,
  ): Promise<OfferDocument> {
    const offer = await this.offerModel.findById(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.merchantId.toString() !== merchantId)
      throw new ForbiddenException('ليس لديك صلاحية');
    offer.active = active;
    await offer.save();
    return offer;
  }

  // 🟢 تحديث العداد عند استخدام العرض (ممكن ربطها بخدمة الطلبات)
  async incrementUsedCount(id: string): Promise<void> {
    await this.offerModel
      .findByIdAndUpdate(id, { $inc: { usedCount: 1 } })
      .exec();
  }

  async updateAfterScrape(
    productId: string,
    updateData: Partial<Product>,
  ): Promise<ProductDocument> {
    const updated = await this.productModel
      .findByIdAndUpdate(productId, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Product not found');

    return updated;
  }

  // 🟢 جلب العروض المرتبطة بمنتج
  async findOffersByProduct(
    productId: string,
    merchantId: string,
  ): Promise<OfferDocument[]> {
    return this.offerModel
      .find({
        merchantId,
        products: productId,
        active: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      })
      .exec();
  }

  // 🟢 عند حذف منتج يجب إزالة مرجعه من كل العروض
  async removeProductFromOffers(productId: string): Promise<void> {
    await this.offerModel
      .updateMany({ products: productId }, { $pull: { products: productId } })
      .exec();
  }

  // 🟢 جدولة تعطيل العروض المنتهية تلقائيًا (يمكن عملها بـ @Cron)
}
