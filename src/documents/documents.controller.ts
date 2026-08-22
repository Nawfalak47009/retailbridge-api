import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";

import {
  FileInterceptor,
} from "@nestjs/platform-express";

import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
  ) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file"),
  )
  async upload(
    @UploadedFile()
    file: any,
  ) {
    if (!file) {
      return {
        success: false,
        message:
          "No file received.",
      };
    }

    console.log(
      "========== FILE RECEIVED =========="
    );

    console.log(file);

    console.log(
      "==================================="
    );

    return this.documentsService.upload(
      file,
    );
  }
}