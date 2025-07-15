// src/modules/categories/categories.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return this.categoryModel.create(dto);
  }

  async findAllFlat(): Promise<(Category & { _id: any })[]> {
    return this.categoryModel.find().lean();
  }

  // جلب كل الفئات كشجرة متداخلة
  async findAllTree(): Promise<any[]> {
    const all = await this.categoryModel.find().lean();
    // بناء الشجرة
    const idMap = new Map<string, any>();
    all.forEach((cat) =>
      idMap.set(cat._id.toString(), { ...cat, children: [] }),
    );
    const tree: any[] = [];
    all.forEach((cat) => {
      if (cat.parent) {
        idMap
          .get(cat.parent.toString())
          ?.children.push(idMap.get(cat._id.toString()));
      } else {
        tree.push(idMap.get(cat._id.toString()));
      }
    });
    return tree;
  }

  async findOne(id: string): Promise<CategoryDocument> {
    const cat = await this.categoryModel.findById(id); // ← بدون .lean()
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const updated = await this.categoryModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.categoryModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Category not found');
    return { message: 'Category deleted successfully' };
  }
}
