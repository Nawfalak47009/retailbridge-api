import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterShopDto {
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}