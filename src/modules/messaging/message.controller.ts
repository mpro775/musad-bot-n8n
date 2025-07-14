import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء جلسة جديدة أو إضافة رسائل لجلسة موجودة' })
  @ApiBody({ type: CreateMessageDto })
  @ApiCreatedResponse({
    description: 'تم إنشاء أو تعديل الجلسة بنجاح',
    schema: {
      example: {
        _id: '6651abc...',
        merchantId: '663...',
        sessionId: '9665xxxxxxx',
        channel: 'whatsapp',
        messages: [
          {
            role: 'customer',
            text: 'أبغى شاحن آيفون',
            timestamp: '2025-06-12T10:00:00Z',
            metadata: {},
          },
        ],
        createdAt: '2025-06-12T10:00:00Z',
        updatedAt: '2025-06-12T10:01:00Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'البيانات غير صحيحة أو ناقصة' })
  createOrAppend(@Body() dto: CreateMessageDto) {
    return this.messageService.createOrAppend(dto);
  }

  @Patch('session/:sessionId/handover')
  @Public()
  async setHandover(
    @Param('sessionId') sessionId: string,
    @Body('handoverToAgent') handoverToAgent: boolean,
  ) {
    await this.messageService.setHandover(sessionId, handoverToAgent);
    return { success: true };
  }

  @Get('session/:sessionId')
  @ApiOperation({
    summary: 'جلب محادثة كاملة حسب sessionId (رقم الهاتف غالبًا)',
  })
  @ApiParam({ name: 'sessionId', description: 'معرف الجلسة' })
  @ApiOkResponse({
    description: 'محادثة واحدة بجميع الرسائل',
  })
  findBySession(@Param('sessionId') sessionId: string) {
    return this.messageService.findBySession(sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جلب الجلسة حسب _id' })
  @ApiParam({ name: 'id', description: 'معرف الوثيقة في Mongo' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'الجلسة غير موجودة' })
  findOne(@Param('id') id: string) {
    return this.messageService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تحديث بيانات الجلسة (مثل tags أو ملاحظات)' })
  @ApiParam({ name: 'id', description: 'معرف الوثيقة في Mongo' })
  @ApiBody({ type: UpdateMessageDto })
  @ApiOkResponse({ description: 'تم التحديث' })
  @ApiNotFoundResponse({ description: 'الجلسة غير موجودة' })
  async update(@Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.messageService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف جلسة كاملة من قاعدة البيانات' })
  @ApiParam({ name: 'id', description: 'معرف الوثيقة في Mongo' })
  @ApiOkResponse({ description: 'تم الحذف بنجاح' })
  @ApiNotFoundResponse({ description: 'الجلسة غير موجودة' })
  async remove(@Param('id') id: string) {
    return this.messageService.remove(id);
  }

  @Get()
  @ApiOperation({ summary: 'جلب كل الجلسات مع خيارات فلترة' })
  @ApiOkResponse({
    description: 'نتائج الجلسات مع عدد الإجمالي',
  })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: ['whatsapp', 'telegram', 'webchat'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  async findAll(
    @Query('merchantId') merchantId?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit = '20',
    @Query('page') page = '1',
  ) {
    return this.messageService.findAll({
      merchantId,
      channel,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10),
    });
  }
}
