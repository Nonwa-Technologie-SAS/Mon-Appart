import { Controller, Get } from "@nestjs/common"

@Controller({ path: "meta", version: "1" })
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
