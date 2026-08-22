import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class SubmitShopDocumentsDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  aadhaar!: string;

  @IsString()
  @IsNotEmpty()
  shopPhoto!: string;
}