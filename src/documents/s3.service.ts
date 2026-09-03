import "dotenv/config";
import { Injectable } from "@nestjs/common";
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class S3Service {
  private s3: S3Client | null = null;

  getClient(): S3Client {
    if (!this.s3) {
      const region = process.env.AWS_REGION || "ap-south-2";
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";

      this.s3 = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
    return this.s3;
  }

  async getSignedImageUrl(key: string): Promise<string> {
    if (!key) return "";
    if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) {
      return key;
    }

    try {
      const bucket = process.env.AWS_BUCKET_NAME;
      if (!bucket || !process.env.AWS_ACCESS_KEY_ID) {
        return key;
      }

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return await getSignedUrl(this.getClient(), command, {
        expiresIn: 3600,
      });
    } catch (err) {
      console.log("Error generating signed S3 URL for key:", key, err);
      return key;
    }
  }
}
