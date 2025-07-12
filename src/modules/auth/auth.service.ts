import { Connection } from 'mongoose';
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';
import { RegisterDto } from './dto/register.dto';
import { MailService } from '../mail/mail.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { PlanTier } from '../merchants/schemas/subscription-plan.schema';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}
  async register(registerDto: RegisterDto) {
    // فكّ فقط الحقلين اللذين نريد أن نستخدمهما هنا
    const { password, confirmPassword } = registerDto;

    // استخدم الحقلين للتحقق من تطابق كلمة المرور
    if (password !== confirmPassword) {
      throw new BadRequestException('كلمتا المرور غير متطابقتين');
    }

    // بقية الحقول نأخذها مباشرة من registerDto حين الحاجة
    const email = registerDto.email;
    const username = registerDto.username; // سمّيتها username لتجنّب الاصطدام

    // 1) تأكد من عدم وجود مستخدم بالإيميل نفسه
    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Email already in use');
    }

    // 2) هشّ لكلمة المرور
    const hashed = await bcrypt.hash(password, 10);

    // 3) أنشئ المستخدم باستخدام الحقول الواضحة
    let userDoc: UserDocument;
    try {
      userDoc = await this.userModel.create({
        name: username,
        email,
        password: hashed,
        role: 'MERCHANT',
        firstLogin: true,
      });
    } catch (err: any) {
      this.logger.error('Failed to create user', err.stack || err);
      if (err.code === 11000) {
        throw new ConflictException('Email already in use');
      }
      throw new InternalServerErrorException('Failed to create user');
    }
    // 3) ارسال كود التفعيل
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    userDoc.emailVerificationCode = code;
    userDoc.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await userDoc.save().catch((err) => {
      this.logger.error('Failed to save verification code', err);
    });
    this.mailService.sendVerificationEmail(email, code).catch((err) => {
      this.logger.error('Failed sending verification email', err);
    });

    // 4) إنشاء التاجر
    let merchant: MerchantDocument;
    try {
      merchant = await this.merchantModel.create({
        userId: userDoc._id,
        name: `متجر ${username}`,
        storefrontUrl: '',
        logoUrl: '',
        address: {},
        subscription: {
          tier: PlanTier.Free,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          features: [
            'basic_support',
            'chat_bot',
            'analytics',
            'multi_channel',
            'api_access',
            'webhook_integration',
          ],
        },
        categories: [],
        quickConfig: {
          dialect: 'خليجي',
          tone: 'ودّي',
          customInstructions: [],
          sectionOrder: ['products', 'policies', 'custom'],
          includeStoreUrl: true,
          includeAddress: true,
          includePolicies: true,
          includeWorkingHours: true,
          includeClosingPhrase: true,
          closingText: 'هل أقدر أساعدك بشي ثاني؟ 😊',
        },
        currentAdvancedConfig: {
          template: '', // <-- تمّ تصحيح اسم الحقل هنا
          updatedAt: new Date(),
          note: '',
        },
        advancedConfigHistory: [],
        finalPromptTemplate: '',
        returnPolicy: '',
        exchangePolicy: '',
        shippingPolicy: '',
        channels: {},
        chatThemeColor: '#D84315',
        chatGreeting: 'مرحباً! كيف أستطيع مساعدتك اليوم؟',
        chatWebhooksUrl: '/api/webhooks',
        chatApiBaseUrl: '',
        workingHours: [],
      });
    } catch (err: any) {
      this.logger.error('Failed to create merchant', err.stack || err);
      // rollback: حذف المستخدم
      await this.userModel.findByIdAndDelete(userDoc._id).exec();
      throw new InternalServerErrorException('Failed to create merchant');
    }

    // 5) ربط merchantId ثم حفظ
    userDoc.merchantId = merchant._id as Types.ObjectId;
    await userDoc.save().catch((err) => {
      this.logger.error('Failed to link merchantId', err);
    });

    // 6) إصدار JWT والرد
    const payload = {
      userId: userDoc._id,
      role: userDoc.role,
      merchantId: merchant._id,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        merchantId: merchant._id,
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
    this.logger.debug(
      'All merchants in DB:',
      await this.merchantModel.find().lean(),
    );

    // جلب التاجر المرتبط
    const merchant = await this.merchantModel.findOne({ userId: userDoc._id });
    this.logger.debug('Found merchant for user:', merchant);

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
  // src/auth/auth.service.ts
  // src/auth/auth.service.ts
  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const { code } = dto;
    const user = await this.userModel
      .findOne({ emailVerificationCode: code })
      .exec();

    if (!user) {
      throw new BadRequestException('رمز التفعيل غير صحيح');
    }
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('رمز التفعيل منتهي الصلاحية');
    }

    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.firstLogin = false;
    await user.save();
  }
  async resendVerification(dto: ResendVerificationDto): Promise<void> {
    const { email } = dto;

    // 1) ابحث عن المستخدم
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new BadRequestException('البريد الإلكتروني غير مسجل');
    }

    // 2) إذا كان مفعلًا بالفعل، لا حاجة للإرسال
    if (user.emailVerified) {
      throw new BadRequestException('البريد الإلكتروني مُفعّل مسبقًا');
    }

    // 3) أنشئ كود جديد وصلاحيته
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationCode = code;
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // 4) أرسل الإيميل (إذا فشل لا تُفشل الطلب)
    try {
      await this.mailService.sendVerificationEmail(email, code);
    } catch (err) {
      this.logger.error('Failed sending verification email', err);
    }
  }
}
