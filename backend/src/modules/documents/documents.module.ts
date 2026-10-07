import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MasterDocument, MasterDocumentContent } from './document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MasterDocument, MasterDocumentContent])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
