import {
  IsEmail,
  IsNotEmpty,
  IsString,
} from "class-validator";

export class RegisterShopDto {
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
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
  @IsNotEmpty()
  password!: string;
}