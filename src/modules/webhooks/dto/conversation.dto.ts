import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageItem {
  @IsString()
  @IsNotEmpty()
  role: 'customer' | 'bot';

  @IsString()
  @IsNotEmpty()
  text: string;

  // timestamp يُملأ تلقائيًا إن لم يرسل من n8n
  timestamp?: Date;

  metadata?: Record<string, any>;
}

export class ConversationDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageItem)
  messages: MessageItem[];
}
