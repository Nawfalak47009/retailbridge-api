import { Module } from "@nestjs/common";

import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { S3Service } from "./s3.service";

@Module({
  controllers: [
    DocumentsController,
  ],

  providers: [
    DocumentsService,
    S3Service,
  ],
})
export class DocumentsModule {}