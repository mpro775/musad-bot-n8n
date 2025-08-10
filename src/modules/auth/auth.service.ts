import { ClientSession, Connection } from 'mongoose';
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  private async hasReplicaSet(): Promise<boolean> {
    try {
      // يضمن أن العميل موجود ومتصل
      const client = this.connection.getClient(); // MongoClient
      const res = await client.db().admin().command({ replSetGetStatus: 1 });
      return res?.ok === 1;
    } catch {
      return false;
    }
  }

  async register(registerDto: RegisterDto) {
    const { password, confirmPassword, email, name } = registerDto;
    if (password !== confirmPassword)
      throw new BadRequestException('كلمتا المرور غير متطابقتين');

    if (await this.userModel.exists({ email }))
      throw new ConflictException('Email already in use');

    const useTxn = await this.hasReplicaSet(); // 👈 شغّل المعاملة فقط إذا متوفرة
    let session: ClientSession | undefined;

    try {
      if (useTxn) {
        session = await this.connection.startSession();
        await session.withTransaction(async () => {
          await this._registerWork({ name, email, password }, session);
        });
      } else {
        // بدون معاملة + تعويض (Compensation) عند الفشل
        await this._registerWork({ name, email, password }, undefined);
      }

      return await this._issueTokenAndReturn(email);
    } catch (err) {
      if (session) await session.endSession();
      this.logger.error('Register failed', err?.stack || err);
      throw new InternalServerErrorException('Failed to register');
    } finally {
      if (session) await session.endSession();
    }
  }

  private async _registerWork(
    data: { name: string; email: string; password: string },
    session?: ClientSession,
  ) {
    const { name, email, password } = data;

    // 1) أنشئ المستخدم
    const userDoc = await new this.userModel({
      name,
      email,
      password, // pre-save يعمل الهاش
      role: 'MERCHANT',
      firstLogin: true,
    }).save(session ? { session } : undefined);

    try {
      // 2) كود التفعيل
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      userDoc.emailVerificationCode = code;
      userDoc.emailVerificationExpiresAt = new Date(
        Date.now() + 15 * 60 * 1000,
      );
      await userDoc.save(session ? { session } : undefined);

      // 3) أنشئ التاجر (مطابق للـ schema الحالية)
      const merchantDoc = await new this.merchantModel({
        userId: userDoc._id,
        name: `متجر ${name}`,
        // لا ترسل address مفردة، schema تعتمد addresses []
        addresses: [],
        // الاشتراك مطلوب
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
        socialLinks: {},

        // يطابق QuickConfig/AdvancedConfig Schemas
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
        finalPromptTemplate: '',
        returnPolicy: '',
        exchangePolicy: '',
        shippingPolicy: '',

        // channels مطابق للـ schema (سيترجم ChannelConfigSchema داخليًا)
        channels: {},
        // workingHours حسب schema
        workingHours: [],
      }).save(session ? { session } : undefined);

      // 4) اربط merchantId بالمستخدم
      userDoc.merchantId = merchantDoc._id as any;
      await userDoc.save(session ? { session } : undefined);

      // 5) أرسل الإيميل (خارج المعاملة)
      this.mailService
        .sendVerificationEmail(email, userDoc.emailVerificationCode)
        .catch((err) =>
          this.logger.error('Failed sending verification email', err),
        );
    } catch (e) {
      // تعويض عند عدم وجود معاملة: احذف المستخدم الذي تم إنشاؤه
      if (!session) {
        await this.userModel.deleteOne({ _id: userDoc._id });
      }
      throw e;
    }
  }

  private async _issueTokenAndReturn(email: string) {
    const userDoc = await this.userModel.findOne({ email });
    const payload = {
      userId: userDoc!._id,
      role: userDoc!.role,
      merchantId: userDoc!.merchantId,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userDoc!._id,
        name: userDoc!.name,
        email: userDoc!.email,
        role: userDoc!.role,
        merchantId: userDoc!.merchantId,
        firstLogin: userDoc!.firstLogin,
        emailVerified: userDoc!.emailVerified,
      },
    };
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
    const user = await this.userModel
      .findOne({ email, emailVerificationCode: code })
      .exec();
    if (!user) throw new BadRequestException('رمز التفعيل غير صحيح');

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
