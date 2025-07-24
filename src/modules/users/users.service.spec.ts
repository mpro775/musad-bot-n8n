import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  const userId = new Types.ObjectId().toHexString();
  const baseUser = {
    _id: userId,
    email: 'user@example.com',
    name: 'Test User',
    merchantId: null,
    firstLogin: true,
    role: 'ADMIN',
    phone: '+1234567890',
  };

  beforeEach(async () => {
    const mockModel: any = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: userId, ...dto }),
    }));

    mockModel.find = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([baseUser]),
    });

    mockModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(baseUser),
    });

    mockModel.findByIdAndUpdate = jest
      .fn()
      .mockResolvedValue({ ...baseUser, name: 'Updated' });

    mockModel.findByIdAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(baseUser),
    });

    model = mockModel;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: model,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a user', async () => {
    const dto = {
      email: 'user@example.com',
      name: 'Test User',
      merchantId: null,
      firstLogin: true,
      role: 'ADMIN',
      phone: '+1234567890',
    };
    const result = await service.create(dto as any);
    expect(model).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ _id: userId, ...dto });
  });

  it('finds all users', async () => {
    const users = await service.findAll();
    expect(model.find).toHaveBeenCalled();
    expect(users).toEqual([baseUser]);
  });

  it('finds one user', async () => {
    const user = await service.findOne(userId);
    expect(model.findById).toHaveBeenCalledWith(userId);
    expect(user.id).toEqual(userId);
  });

  it('throws if user not found', async () => {
    (model.findById as jest.Mock).mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue(null),
    });
    await expect(service.findOne('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a user', async () => {
    const result = await service.update(userId, { name: 'Updated' } as any);
    expect(model.findByIdAndUpdate).toHaveBeenCalled();
    expect(result.name).toBe('Updated');
  });

  it('throws when updating nonexistent user', async () => {
    (model.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.update('bad', {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes a user', async () => {
    const result = await service.remove(userId);
    expect(model.findByIdAndDelete).toHaveBeenCalledWith(userId);
    expect(result).toEqual({ message: 'User deleted successfully' });
  });

  it('throws when removing nonexistent user', async () => {
    (model.findByIdAndDelete as jest.Mock).mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(service.remove('bad')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets firstLogin to false', async () => {
    await service.setFirstLoginFalse(userId);
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { firstLogin: false },
      { new: true },
    );
  });

  it('throws when setFirstLoginFalse fails', async () => {
    (model.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.setFirstLoginFalse('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
