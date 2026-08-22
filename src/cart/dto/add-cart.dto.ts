import {
  IsInt,
  IsUUID,
  Min,
} from "class-validator";

export class AddCartDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}