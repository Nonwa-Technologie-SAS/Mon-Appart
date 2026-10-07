import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtModule } from "@nestjs/jwt"

import { RolesGuard } from "../common/guards/roles.guard"
import { TokenService } from "./token.service"

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  providers: [TokenService, RolesGuard],
  exports: [TokenService, RolesGuard, JwtModule],
})
export class SecurityModule {}
