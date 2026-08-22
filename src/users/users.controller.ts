import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from "@nestjs/common";

import { UsersService } from "./users.service";

import { SubmitDocumentsDto } from "./dto/submit-documents.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Patch("submit")
  submit(
    @Body()
    dto: SubmitDocumentsDto,
  ) {
    return this.usersService.submit(
      dto,
    );
  }

  @Get("status/:id")
  status(
    @Param("id")
    id: string,
  ) {
    return this.usersService.status(
      id,
    );
  }
}