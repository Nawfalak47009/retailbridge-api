import {
  IsOptional,
  IsString,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  image!: string;

  @IsString()
  unit!: string;

  @IsString()
  quantityPerUnit!: string;

  @IsString()
  price!: string;

  @IsOptional()
  @IsString()
  loosePrice?: string;

  @IsOptional()
  @IsString()
  gstPercent?: string;

  @IsString()
  stock!: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}