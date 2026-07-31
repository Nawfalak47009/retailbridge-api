import {
  Controller,
  Get,
  Param,
} from "@nestjs/common";

import { AgenciesService } from "./agencies.service";

@Controller("agencies")
export class AgenciesController {
  constructor(
    private readonly agenciesService: AgenciesService,
  ) {}

  @Get()
  findAll() {
    return this.agenciesService.findAll();
  }

  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {
    return this.agenciesService.findOne(id);
  }
}