import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDocument, MasterDocumentContent } from '../documents/document.entity';
import { TranslateModule } from '../translate/translate.module';
import { UploadDocumentsController } from './upload-documents.controller';
import { UploadDocumentsService } from './upload-documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([MasterDocument, MasterDocumentContent]), TranslateModule],
  controllers: [UploadDocumentsController],
  providers: [UploadDocumentsService],
})
export class UploadDocumentsModule {}
