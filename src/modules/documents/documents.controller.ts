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
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';

@ApiTags('Documents')
@Controller('merchants/:merchantId/documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document for a merchant' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ description: 'Upload success' })
  upload(
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File & { key: string },
  ) {
    // file.bucket و file.key يأتيان من MinIO storage
    return this.svc.uploadFile(merchantId, file);
  }

  @Get()
  @ApiOperation({ summary: 'List all documents for a merchant' })
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiOkResponse({ description: 'List of documents' })
  list(@Param('merchantId') merchantId: string) {
    return this.svc.list(merchantId);
  }

  @Get(':docId')
  @ApiOperation({ summary: 'Download a specific document' })
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiOkResponse({ description: 'Redirect to file download' })
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
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiParam({ name: 'docId', description: 'Document ID' })
  @ApiNoContentResponse({ description: 'Deleted successfully' })
  remove(
    @Param('merchantId') merchantId: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.delete(merchantId, docId);
  }
}
