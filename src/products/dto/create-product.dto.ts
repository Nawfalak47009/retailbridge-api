import {
  IsOptional,
  IsString,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  agencyId!: string;

  @IsString()
  name!: string;

  @IsString()
  image!: string;

  @IsString()
  unit!: string;

  @IsString()
  quantityPerUnit!: string;

  @IsString()
  price!: string;

  @IsString()
  stock!: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}