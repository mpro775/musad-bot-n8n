import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
import { MailService } from '../mail/mail.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { MerchantsService } from '../merchants/merchants.service';
import {
  generateNumericCode,
  minutesFromNow,
  sha256,
} from './utils/verification-code';
import {
  EmailVerificationToken,
  EmailVerificationTokenDocument,
} from './schemas/email-verification-token.schema';
import { PlanTier } from '../merchants/schemas/subscription-plan.schema';
import { BusinessMetrics } from 'src/metrics/business.metrics';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfigService } from '@nestjs/config';
import { generateSecureToken } from './utils/password-reset';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
    @InjectModel(EmailVerificationToken.name)
    private tokenModel: Model<EmailVerificationTokenDocument>,
    @InjectModel(PasswordResetToken.name)
    private prtModel: Model<PasswordResetTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly merchants: MerchantsService,
    private readonly mailService: MailService,
    private readonly businessMetrics: BusinessMetrics,
    private readonly config: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { password, confirmPassword, email, name } = registerDto;
    if (password !== confirmPassword) {
      throw new BadRequestException('كلمتا المرور غير متطابقتين');
    }

    try {
      // نحاول الحفظ مباشرة والاعتماد على unique index لالتقاط السباقات
      const userDoc = await new this.userModel({
        name,
        email,
        password, // pre-save hash
        role: 'MERCHANT',
        firstLogin: true,
        emailVerified: false,
      }).save();

      // أنشئ رمز تفعيل بهيكل TTL Collection
      const code = generateNumericCode(6);
      await this.tokenModel.create({
        userId: userDoc._id,
        codeHash: sha256(code),
        expiresAt: minutesFromNow(15),
      });

      // أرسل الإيميل (لا يُفشل المسار إذا تعطل)
      try {
        await this.mailService.sendVerificationEmail(email, code);
        this.businessMetrics.incEmailSent();
      } catch {
        this.businessMetrics.incEmailFailed();
      }
      // لا Merchant الآن
      const payload = {
        userId: userDoc._id,
        role: userDoc.role,
        merchantId: null,
      };
      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: userDoc._id,
          name: userDoc.name,
          email: userDoc.email,
          role: userDoc.role,
          merchantId: null,
          firstLogin: userDoc.firstLogin,
          emailVerified: userDoc.emailVerified,
        },
      };
    } catch (err: any) {
      // التقاط 11000 Duplicates
      if (err?.code === 11000 && err?.keyPattern?.email) {
        throw new ConflictException('Email already in use');
      }
      throw new InternalServerErrorException('Failed to register');
    }
  }
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const userDoc = await this.userModel.findOne({ email }).select('+password');
    if (!userDoc) throw new BadRequestException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, userDoc.password);
    if (!isMatch) throw new BadRequestException('Invalid credentials');

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
        emailVerified: userDoc.emailVerified, // 👈 جديد
      },
    };
  }
  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const { email, code } = dto;
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new BadRequestException('رمز التفعيل غير صحيح');

    const token = await this.tokenModel
      .findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .exec();
    if (!token || token.codeHash !== sha256(code)) {
      throw new BadRequestException('رمز التفعيل غير صحيح');
    }
    if (token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('رمز التفعيل منتهي الصلاحية');
    }

    user.emailVerified = true;
    user.firstLogin = false;
    await user.save();

    // نظّف التوكنات
    await this.tokenModel.deleteMany({ userId: user._id });

    // (اختياري) ابدأ تهيئة Merchant هنا (أو اتركها لأول دخول)
    // حاول/التقط حتى لا تفشل الاستجابة:
    try {
      if (!user.merchantId) {
        const merchant = await this.merchants.create({
          userId: String(user._id),
          name: `متجر ${user.name}`,
          addresses: [],
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
            template: '',
            updatedAt: new Date(),
            note: '',
          },
          advancedConfigHistory: [],
          returnPolicy: '',
          exchangePolicy: '',
          shippingPolicy: '',
        } as any);
        user.merchantId = merchant._id as Types.ObjectId;
        await user.save();
      }
    } catch (e: any) {
      this.logger.error('Failed to create merchant', e);
      // سجل فقط، لا تعطل تفعيل الإيميل
    }
  }

  async resendVerification(dto: ResendVerificationDto): Promise<void> {
    const { email } = dto;
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new BadRequestException('البريد الإلكتروني غير مسجل');
    if (user.emailVerified)
      throw new BadRequestException('البريد الإلكتروني مُفعّل مسبقًا');

    // (اختياري) حد من الوتيرة: لا تنشئ أكثر من توكن خلال 60 ثانية
    const recent = await this.tokenModel
      .findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select({ createdAt: 1 })
      .lean<{ createdAt: Date }>();
    if (recent && Date.now() - new Date(recent.createdAt).getTime() < 60_000) {
      // لا تفجر الطلب؛ فقط تجاهل/أعد 204 (تصميم اختياري)
      return;
    }

    const code = generateNumericCode(6);
    await this.tokenModel.create({
      userId: user._id,
      codeHash: sha256(code),
      expiresAt: minutesFromNow(15),
    });

    try {
      await this.mailService.sendVerificationEmail(email, code);
    } catch (e: any) {
      this.logger.error('Failed to send verification email', e);
    }
  }
  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const { email } = dto;
    const user = await this.userModel.findOne({ email }).select('_id').lean();

    // لا نكشف وجود البريد: نرجع 204 دائمًا
    if (!user) return;

    // Rate control بسيط: لا نصدر أكثر من طلب كل 60 ثانية
    const last = await this.prtModel
      .findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select({ createdAt: 1 })
      .lean<{ createdAt: Date }>();
    if (last && Date.now() - new Date(last.createdAt).getTime() < 60_000) {
      return; // صمتًا
    }

    // إنشاء توكن آمن (غير قابل للتخمين)
    const token = generateSecureToken(32); // 256-bit
    const tokenHash = sha256(token);

    await this.prtModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: minutesFromNow(30), // صلاحية 30 دقيقة
    });

    const base = (this.config.get<string>('FRONTEND_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await this.mailService.sendPasswordResetEmail(email, link);

    this.businessMetrics.incEmailSent(); // (اختياري)
  }
  async validatePasswordResetToken(
    email: string,
    token: string,
  ): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).select('_id').lean();
    if (!user) return false;
    const doc = await this.prtModel
      .findOne({ userId: user._id, used: false })
      .sort({ createdAt: -1 })
      .lean();
    if (!doc) return false;
    if (doc.expiresAt.getTime() < Date.now()) return false;
    return doc.tokenHash === sha256(token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { email, token, newPassword, confirmPassword } = dto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('كلمتا المرور غير متطابقتين');
    }

    const user = await this.userModel
      .findOne({ email })
      .select('+password')
      .exec();
    // لا نكشف التفاصيل
    if (!user) return; // 204

    const doc = await this.prtModel
      .findOne({ userId: user._id, used: false })
      .sort({ createdAt: -1 })
      .exec();
    if (!doc) return; // 204

    if (doc.expiresAt.getTime() < Date.now()) {
      return; // 204
    }

    const ok = doc.tokenHash === sha256(token);
    if (!ok) return; // 204

    // عدّل كلمة المرور (اعتمد pre-save hook للهاش)
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // علّم التوكن بأنه مستعمل واحذف البقية
    doc.used = true;
    await doc.save();
    await this.prtModel.deleteMany({ userId: user._id, _id: { $ne: doc._id } });

    // (اختياري) this.businessMetrics.incPasswordResetCompleted?.();
  }
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = dto;
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('كلمتا المرور غير متطابقتين');
    }

    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) throw new BadRequestException('مستخدم غير موجود');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new BadRequestException('كلمة المرور الحالية غير صحيحة');

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // نظّف أي توكنات إعادة تعيين سابقة
    await this.prtModel.deleteMany({ userId });

    this.businessMetrics.incPasswordChangeCompleted?.();
  }
  async ensureMerchant(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    // لو في merchantId خلاص رجّع payload جديد (لتحديث التوكن إن أردت)
    if (user.merchantId) {
      const payload = {
        userId: user._id,
        role: user.role,
        merchantId: user.merchantId,
      };
      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          merchantId: user.merchantId,
          firstLogin: user.firstLogin,
          emailVerified: user.emailVerified,
        },
      };
    }

    // لو البريد غير مفعّل، لا تنشئ Merchant
    if (!user.emailVerified) {
      throw new BadRequestException('Email not verified');
    }

    // أنشئ Merchant الآن (نفس منطق create عندك)
    const merchant = await this.merchants.create({
      userId: String(user._id),
      name: `متجر ${user.name}`,
      addresses: [],
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
      currentAdvancedConfig: { template: '', updatedAt: new Date(), note: '' },
      advancedConfigHistory: [],
      returnPolicy: '',
      exchangePolicy: '',
      shippingPolicy: '',
    } as any);

    user.merchantId = merchant._id as any;
    await user.save();

    const payload = {
      userId: user._id,
      role: user.role,
      merchantId: user.merchantId,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        merchantId: user.merchantId,
        firstLogin: user.firstLogin,
        emailVerified: user.emailVerified,
      },
    };
  }
}
