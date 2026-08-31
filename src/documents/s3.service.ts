import { Injectable } from "@nestjs/common";
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class S3Service {
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  getClient() {
    return this.s3;
  }

  async getSignedImageUrl(
    key: string,
  ) {
    if (!key) return "";
    if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) {
      return key;
    }

    try {
      const bucket = process.env.AWS_BUCKET_NAME;
      if (!bucket || !process.env.AWS_ACCESS_KEY_ID) {
        return key;
      }

      const command =
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });

      return await getSignedUrl(
        this.s3,
        command,
        {
          expiresIn: 3600,
        },
      );
    } catch (err) {
      console.log("Error generating signed S3 URL for key:", key, err);
      return key;
    }
  }
}