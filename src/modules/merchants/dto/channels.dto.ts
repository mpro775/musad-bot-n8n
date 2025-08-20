import { PartialType } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ChannelDetailsDto } from './channel.dto';

// المفاتيح المدعومة:
export enum ChannelKey {
  whatsappApi = 'whatsappApi',
  whatsappQr = 'whatsappQr',
  telegram = 'telegram',
  webchat = 'webchat',
  instagram = 'instagram',
  messenger = 'messenger',
}

// لديك ChannelDetailsDto جاهز — نستفيد منه
export class UpdateChannelDto extends PartialType(ChannelDetailsDto) {}

// اختياري: لو تحتاج ضمان القيمة من المسار عبر ParseEnumPipe:
export class ChannelKeyParam {
  @IsEnum(ChannelKey, { message: 'قناة غير مدعومة' })
  key!: ChannelKey;
}
