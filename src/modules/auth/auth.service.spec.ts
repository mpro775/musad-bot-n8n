import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/schemas/user.schema';
import { Merchant } from '../merchants/schemas/merchant.schema';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { mockModel, mockJwtService, createMockUser } from '../../../test/setup';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let merchantModel: any;
  let jwtService: JwtService;
  let mailService: MailService;
  let connection: any;

  const mockUser = createMockUser();
  const mockMerchant = {
    _id: '507f1f77bcf86cd799439012',
    userId: mockUser._id,
    businessName: 'Test Business',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUserModel = mockModel();
    const mockMerchantModel = mockModel();
    const mockJwtServiceInstance = mockJwtService();
    const mockMailService = {
      sendVerificationEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
    };
    const mockConnection = {
      startSession: jest.fn().mockReturnValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Merchant.name),
          useValue: mockMerchantModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtServiceInstance,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
    merchantModel = module.get(getModelToken(Merchant.name));
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
    connection = module.get(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      businessName: 'Test Business',
    };

    it('should register a new user successfully', async () => {
      // Arrange
      userModel.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      userModel.create.mockResolvedValue([mockUser]);
      merchantModel.create.mockResolvedValue([mockMerchant]);
      jwtService.sign.mockReturnValue('verification-token');

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: registerDto.email,
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userModel.create).toHaveBeenCalled();
      expect(merchantModel.create).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
      expect(result).toEqual({
        message:
          'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.',
        user: expect.objectContaining({
          email: registerDto.email,
          username: registerDto.username,
        }),
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      userModel.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: registerDto.email,
      });
    });

    it('should throw BadRequestException if passwords do not match', async () => {
      // Arrange
      const invalidDto = {
        ...registerDto,
        confirmPassword: 'DifferentPassword',
      };

      // Act & Assert
      await expect(service.register(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'StrongPassword123!',
    };

    it('should login user successfully', async () => {
      // Arrange
      const userWithPassword = { ...mockUser, password: 'hashedPassword' };
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword),
      });
      mockedBcrypt.compare.mockResolvedValue(true);
      jwtService.sign.mockReturnValue('access-token');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({ email: loginDto.email });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        'hashedPassword',
      );
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({
        access_token: 'access-token',
        user: expect.objectContaining({
          email: mockUser.email,
          username: mockUser.username,
        }),
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Arrange
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      // Arrange
      const userWithPassword = { ...mockUser, password: 'hashedPassword' };
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword),
      });
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto: VerifyEmailDto = {
      token: 'verification-token',
    };

    it('should verify email successfully', async () => {
      // Arrange
      const payload = { userId: mockUser._id };
      jwtService.verify.mockReturnValue(payload);
      userModel.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
      });

      // Act
      const result = await service.verifyEmail(verifyEmailDto);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(verifyEmailDto.token);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        payload.userId,
        { isEmailVerified: true },
        { new: true },
      );
      expect(result).toEqual({
        message: 'تم تفعيل البريد الإلكتروني بنجاح',
        user: expect.objectContaining({
          isEmailVerified: true,
        }),
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateUser', () => {
    it('should validate user successfully', async () => {
      // Arrange
      userModel.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateUser(mockUser._id);

      // Assert
      expect(userModel.findById).toHaveBeenCalledWith(mockUser._id);
      expect(result).toEqual(mockUser);
    });

    it('should return null for invalid user ID', async () => {
      // Arrange
      userModel.findById.mockResolvedValue(null);

      // Act
      const result = await service.validateUser('invalid-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
