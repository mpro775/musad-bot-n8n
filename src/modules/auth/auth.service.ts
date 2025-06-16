import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // 1. التأكد من عدم تكرار البريد
    if (await this.userModel.findOne({ email })) {
      throw new BadRequestException('Email already in use');
    }

    // 2. تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. إنشاء المستخدم مع أولية firstLogin=true
    const userDoc = new this.userModel({
      name,
      email,
      password: hashedPassword,
      role: 'MERCHANT',
      firstLogin: true,
    });
    await userDoc.save();

    // 4. إنشاء سجل التاجر الافتراضي (بيانات جزئية ستُكمّل لاحقاً في الـ Onboarding)
    const createdMerchant = await this.merchantModel.create({
      userId: userDoc._id,
      name: `متجر ${name}`,
      email: email, // تضيف هذا السطر
      // phone و whatsappNumber يبقيان اختياريّين في الـ schema
      isActive: true,
      planName: 'free',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // 5. ربط الـ merchantId في مستخدم
    userDoc.merchantId = createdMerchant._id as Types.ObjectId;
    await userDoc.save();

    // 6. توقيع JWT
    const payload = {
      userId: userDoc._id,
      role: userDoc.role,
      merchantId: createdMerchant._id,
    };

    // 7. إرجاع الـ token والمستخدم مع العلم firstLogin=true
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        merchantId: createdMerchant._id,
        firstLogin: userDoc.firstLogin,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const userDoc = await this.userModel.findOne({ email });
    if (!userDoc) throw new BadRequestException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, userDoc.password);
    if (!isMatch) throw new BadRequestException('Invalid credentials');

    // جلب التاجر المرتبط
    const merchant = await this.merchantModel.findOne({ userId: userDoc._id });

    const payload = {
      userId: userDoc._id,
      role: userDoc.role,
      merchantId: merchant?._id || null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        merchantId: merchant?._id || null,
        firstLogin: userDoc.firstLogin,
      },
    };
  }
}
