import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let merchantModel: any;
  let jwtService: any;
  let mailService: any;

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
      findByIdAndDelete: jest.fn(),
    } as Partial<Model<any>>;
    merchantModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    } as Partial<Model<any>>;
    jwtService = { sign: jest.fn().mockReturnValue('token') } as JwtService;
    mailService = { sendVerificationEmail: jest.fn() } as MailService;
    service = new AuthService(
      userModel as unknown as Model<any>,
      merchantModel as unknown as Model<any>,
      {} as any,
      jwtService as JwtService,
      mailService as MailService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('register stores userId in merchant', async () => {
    (userModel.exists as jest.Mock).mockResolvedValue(null);
    const userDoc = { _id: new Types.ObjectId(), save: jest.fn() };
    (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashed');
    (userModel.create as jest.Mock).mockResolvedValue(userDoc);
    const merchantDoc = { _id: new Types.ObjectId() };
    (merchantModel.create as jest.Mock).mockResolvedValue(merchantDoc);

    await service.register({ email: 'a@b.com', password: '123', name: 'A' });

    expect(merchantModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: userDoc._id }),
    );
  });

  it('login returns merchantId', async () => {
    const userId = new Types.ObjectId();
    const merchantId = new Types.ObjectId();
    const userDoc = {
      _id: userId,
      password: 'hashed',
      role: 'MERCHANT',
      name: 'A',
      email: 'a@b.com',
      firstLogin: false,
    };
    (userModel.findOne as jest.Mock).mockResolvedValue(userDoc);
    (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    (merchantModel.findOne as jest.Mock).mockResolvedValue({ _id: merchantId });

    await service.login({ email: 'a@b.com', password: '123' });

    expect(merchantModel.findOne).toHaveBeenCalledWith({ userId });
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId }),
    );
  });
});
