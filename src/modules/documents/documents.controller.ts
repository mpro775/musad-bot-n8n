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
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';

@Controller('merchants/:merchantId/documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file')) // يجب أن يكون نفس الاسم
  upload(
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File & { key: string },
  ) {
    console.log('[Upload Endpoint] File:', file);
    return this.svc.uploadFile(merchantId, file);
  }

  @Get()
  list(@Param('merchantId') merchantId: string) {
    return this.svc.list(merchantId);
  }

  @Get(':docId')
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
  remove(
    @Param('merchantId') merchantId: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.delete(merchantId, docId);
  }
}
