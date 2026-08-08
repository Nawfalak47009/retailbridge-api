import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  agencyId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}