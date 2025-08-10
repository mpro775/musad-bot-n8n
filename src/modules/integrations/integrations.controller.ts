import {
  Controller,
  Get,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Integration, IntegrationDocument } from './schemas/integration.schema';
import {
  Merchant,
  MerchantDocument,
} from '../merchants/schemas/merchant.schema';

type StatusResp = {
  salla: { active: boolean; connected: boolean; lastSync: string | null };
  zid: { active: boolean; connected: boolean; lastSync: string | null };
};

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    @InjectModel(Integration.name)
    private integModel: Model<IntegrationDocument>,
    @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
  ) {}

  @Get('status')
  async status(@Req() req): Promise<StatusResp> {
    const user = req.user;
    const merchant = await this.merchantModel
      .findOne({ userId: user.userId })
      .lean();
    if (!merchant) throw new NotFoundException('Merchant not found');

    const [sallaInteg, zidInteg] = await Promise.all([
      this.integModel
        .findOne({ merchantId: merchant._id, provider: 'salla' })
        .lean(),
      this.integModel
        .findOne({ merchantId: merchant._id, provider: 'zid' })
        .lean(),
    ]);

    const now = new Date();

    const sallaConnected =
      !!sallaInteg?.accessToken &&
      (!sallaInteg?.expiresAt || sallaInteg.expiresAt > now);

    const zidConnected =
      !!zidInteg?.accessToken &&
      (!zidInteg?.expiresAt || zidInteg.expiresAt > now);

    return {
      salla: {
        active: !!merchant.productSourceConfig?.salla?.active,
        connected: sallaConnected,
        lastSync:
          (
            merchant.productSourceConfig?.salla?.lastSync as any
          )?.toISOString?.() ||
          sallaInteg?.lastSync?.toISOString?.() ||
          null,
      },
      zid: {
        active: !!merchant.productSourceConfig?.zid?.active,
        connected: zidConnected,
        lastSync:
          (
            merchant.productSourceConfig?.zid?.lastSync as any
          )?.toISOString?.() ||
          zidInteg?.lastSync?.toISOString?.() ||
          null,
      },
    };
  }
}
