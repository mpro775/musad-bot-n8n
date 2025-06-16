import {
  Controller,
  Post,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

import { MerchantsService } from '../merchants/merchants.service';
import { UsersService } from '../users/users.service';

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('المصادقة')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly merchantService: MerchantsService,
    private readonly userService: UsersService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'تسجيل مستخدم جديد (الحقول: اسم، إيميل، كلمة المرور)',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'تم التسجيل بنجاح' })
  @ApiBadRequestResponse({ description: 'خطأ في البيانات أو الإيميل موجود' })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'تسجيل الدخول وإرجاع توكن JWT' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'تم تسجيل الدخول بنجاح' })
  @ApiUnauthorizedResponse({ description: 'بيانات الاعتماد غير صحيحة' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('onboarding')
  @ApiBody({
    description: 'جميع بيانات التهيئة مع شعار المتجر كـ multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        logo: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        businessType: { type: 'string' },
        businessDescription: { type: 'string' },
        phone: { type: 'string' },
        whatsappNumber: { type: 'string' },
        webhookUrl: { type: 'string' },
        telegramToken: { type: 'string' },
        telegramChatId: { type: 'string' },
        preferredDialect: { type: 'string' },
        tone: { type: 'string' },
        template: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ description: 'تم إتمام التهيئة بنجاح' })
  @ApiUnauthorizedResponse({ description: 'توكن JWT غير صالح' })
  @UseInterceptors(FileInterceptor('logo'))
  async completeOnboarding(
    @Req() { user }: RequestWithUser,
    @UploadedFile() logo: Express.Multer.File,
    @Body() dto: OnboardingDto,
  ) {
    // تأكد من وجود الـ IDs
    if (!user.merchantId) throw new BadRequestException('merchantId missing');
    if (!user.userId) throw new BadRequestException('userId missing');

    // جهز جسم التحديث
    const updateData: Record<string, any> = {
      name: dto.name,
      businessType: dto.businessType,
      businessDescription: dto.businessDescription,
      phone: dto.phone,
      apiToken: dto.apiToken,
      whatsappNumber: dto.whatsappNumber,
      webhookUrl: dto.webhookUrl, // يجب أن يكون موجوداً في الـ schema
      channelConfig: {
        telegram: {
          chatId: dto.telegramChatId, // مفتاح chatId كما في الـ schema
          token: dto.telegramToken, // مفتاح token
        },
        whatsapp: {
          phone: dto.whatsappNumber, // مفتاح phone
        },
      },
      promptConfig: {
        dialect: dto.preferredDialect,
        tone: dto.tone,
        template: dto.template,
      },
    };

    // إذا جاء ملف شعار، احفظه وأضف الـ URL
    if (logo) {
      // مثال بسيط: نخزن الملف محلياً في /uploads ونبني مسار URL
      const logoUrl = `/uploads/${logo.filename}`;
      updateData.logoUrl = logoUrl;
    }

    // حدّث بيانات التاجر دفعة واحدة
    await this.merchantService.update(user.merchantId, updateData);

    // كسر حالة firstLogin
    await this.userService.setFirstLoginFalse(user.userId);

    return { message: 'Onboarding completed' };
  }
}
