import { Injectable } from "@nestjs/common";

import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { S3Service } from "./s3.service";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

  async upload(file: any) {
  if (!file) {
    throw new Error(
      "No file uploaded."
    );
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];

  if (
    !allowedTypes.includes(
      file.mimetype,
    )
  ) {
    throw new Error(
      "Only JPG, PNG and PDF files are allowed."
    );
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {
    throw new Error(
      "File size cannot exceed 5 MB."
    );
  }

  const key = `${Date.now()}-${
    file.originalname
  }`;

  await this.s3Service
    .getClient()
    .send(
      new PutObjectCommand({
        Bucket:
          process.env
            .AWS_BUCKET_NAME,

        Key: key,

        Body: file.buffer,

        ContentType:
          file.mimetype,
      }),
    );

  const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
return {
  success: true,
  fileName: file.originalname,
  key,
  url,
};
}
}