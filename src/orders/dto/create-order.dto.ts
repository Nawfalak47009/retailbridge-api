import {
  IsOptional,
  IsString,
} from "class-validator";

export class CreateOrderDto {
  @IsString()
  agencyId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}