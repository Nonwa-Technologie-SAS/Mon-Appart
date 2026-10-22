import { Controller, Get } from "@nestjs/common"

import { Public } from "./modules/identity"

@Controller({ path: "meta", version: "1" })
@Public()
export class AppController {
  @Get()
  info() {
    return {
      name: "mon-appart-api",
      version: "v1",
      status: "ok",
    }
  }
}
