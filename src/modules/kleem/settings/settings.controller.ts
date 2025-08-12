import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateBotRuntimeSettingsDto } from './dto/update-settings.dto';

@Controller('admin/kleem/settings/chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Put()
  update(@Body() dto: UpdateBotRuntimeSettingsDto) {
    return this.svc.update(dto);
  }
}
