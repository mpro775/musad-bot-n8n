// src/modules/documents/documents.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('merchants/:merchantId/documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'رفع مستند للتاجر' })
  @ApiParam({ name: 'merchantId', description: 'معرف التاجر' })
  @ApiBody({ type: 'string', format: 'binary', name: 'file' })
  @ApiOkResponse({ description: 'تم رفع الملف' })
  upload(
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File & { key: string },
  ) {
    // file.bucket و file.key يأتيان من MinIO storage
    return this.svc.uploadFile(merchantId, file);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة ملفات التاجر' })
  @ApiParam({ name: 'merchantId', description: 'معرف التاجر' })
  @ApiOkResponse()
  list(@Param('merchantId') merchantId: string) {
    return this.svc.list(merchantId);
  }

  @Get(':docId')
  @ApiOperation({ summary: 'تنزيل ملف' })
  @ApiParam({ name: 'merchantId', description: 'معرف التاجر' })
  @ApiParam({ name: 'docId', description: 'معرف المستند' })
  async download(
    @Param('merchantId') merchantId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    // يعيد رابط موقع MinIO مباشرة
    const url = await this.svc.getPresignedUrl(merchantId, docId);
    return res.redirect(url);
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف مستند' })
  @ApiParam({ name: 'merchantId', description: 'معرف التاجر' })
  @ApiParam({ name: 'docId', description: 'معرف المستند' })
  @ApiNoContentResponse()
  remove(
    @Param('merchantId') merchantId: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.delete(merchantId, docId);
  }
}
