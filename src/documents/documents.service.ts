import "dotenv/config";
import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Service } from "./s3.service";

@Injectable()
export class DocumentsService {
  constructor(private readonly s3Service: S3Service) {}

  async upload(file: any) {
    if (!file) {
      throw new BadRequestException("No file received for upload.");
    }

    const mime = (file.mimetype || "image/jpeg").toLowerCase();
    const isImage = mime.startsWith("image/") || mime === "application/pdf";

    if (!isImage) {
      throw new BadRequestException("Only image and PDF files are allowed.");
    }

    if (file.size && file.size > 15 * 1024 * 1024) {
      throw new BadRequestException("File size cannot exceed 15 MB.");
    }

    // Sanitize filename
    const originalName = file.originalname || "image.jpg";
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${Date.now()}-${cleanName}`;
    const bucketName = process.env.AWS_BUCKET_NAME || "retailbridge-documents";
    const region = process.env.AWS_REGION || "ap-south-2";

    try {
      const client = this.s3Service.getClient();

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: mime,
        })
      );

      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
      console.log("✅ AWS S3 Upload Success:", url);

      return {
        success: true,
        fileName: originalName,
        key,
        url,
      };
    } catch (err: any) {
      console.error("❌ AWS S3 PutObject Error:", err);
      throw new InternalServerErrorException(
        `Failed to upload image to AWS S3: ${err?.message || "Unknown error"}`
      );
    }
  }
}
