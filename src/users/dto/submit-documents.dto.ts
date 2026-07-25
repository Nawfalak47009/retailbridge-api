import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class SubmitDocumentsDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  aadhaar!: string;

  @IsString()
  @IsNotEmpty()
  gst!: string;

  @IsString()
  @IsNotEmpty()
  pan!: string;

  @IsString()
  @IsNotEmpty()
  license!: string;
}