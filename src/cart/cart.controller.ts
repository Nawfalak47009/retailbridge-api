import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CartService } from "./cart.service";
import { AddCartDto } from "./dto/add-cart.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";
import { CheckoutDto } from "./dto/checkout.dto";

@Controller("cart")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SHOP")
export class CartController {
  constructor(
    private readonly cartService: CartService,
  ) {}

  // =====================================
  // ADD PRODUCT TO CART
  // =====================================

  @Post()
  addToCart(
    @CurrentUser() user: JwtUser,
    @Body() dto: AddCartDto,
  ) {
    return this.cartService.addToCart(
      user.id,
      dto,
    );
  }

  // =====================================
  // GET MY CART
  // =====================================

  @Get()
  getCart(
    @CurrentUser() user: JwtUser,
  ) {
    return this.cartService.getCart(
      user.id,
    );
  }

  // =====================================
  // UPDATE ITEM QUANTITY
  // =====================================

  @Patch(":itemId")
  updateQuantity(
    @CurrentUser() user: JwtUser,
    @Param("itemId") itemId: string,
    @Body("quantity") quantity: number,
  ) {
    return this.cartService.updateQuantity(
      user.id,
      itemId,
      quantity,
    );
  }

  // =====================================
  // REMOVE SINGLE ITEM
  // =====================================

  @Delete(":itemId")
  removeItem(
    @CurrentUser() user: JwtUser,
    @Param("itemId") itemId: string,
  ) {
    return this.cartService.removeItem(
      user.id,
      itemId,
    );
  }

  // =====================================
  // CLEAR ENTIRE CART
  // =====================================

  @Delete()
  clearCart(
    @CurrentUser() user: JwtUser,
  ) {
    return this.cartService.clearCart(
      user.id,
    );
  }

  // =====================================
// CHECKOUT
// =====================================

@Post("checkout")
checkout(
  @CurrentUser() user: JwtUser,
  @Body() dto: CheckoutDto,
) {
  return this.cartService.checkout(
    user.id,
    dto,
  );
}

}
