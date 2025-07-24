import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { LeadsService } from '../leads/leads.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderModel: any;
  let leads: any;

  beforeEach(async () => {
    orderModel = {
      create: jest.fn().mockResolvedValue({ toObject: jest.fn().mockReturnValue({ id: '1' }) }),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(['o']) }) }),
      findById: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue('o') }) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ id: '1', status: 'done' }),
    };
    leads = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: LeadsService, useValue: leads },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an order and records lead', async () => {
    const dto: any = { merchantId: 'm1', sessionId: 's', customer: {} };
    const order = await service.create(dto);
    expect(orderModel.create).toHaveBeenCalledWith(dto);
    expect(leads.create).toHaveBeenCalledWith('m1', {
      sessionId: 's',
      data: {},
      source: 'order',
    });
    expect(order).toEqual({ id: '1' });
  });

  it('finds all orders', async () => {
    const res = await service.findAll();
    expect(orderModel.find).toHaveBeenCalled();
    expect(res).toEqual(['o']);
  });

  it('finds one order', async () => {
    const res = await service.findOne('1');
    expect(orderModel.findById).toHaveBeenCalledWith('1');
    expect(res).toBe('o');
  });

  it('updates status', async () => {
    const res = await service.updateStatus('1', 'done');
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith('1', { status: 'done' }, { new: true });
    expect(res.status).toBe('done');
  });
});
