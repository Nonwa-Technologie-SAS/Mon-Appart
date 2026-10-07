import { Injectable, NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

import { resolveRequestId } from "../http/request-id"

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const header = request.headers["x-request-id"]
    const requestId = resolveRequestId(header, request.id)
    request.id = requestId
    response.setHeader("X-Request-ID", requestId)
    next()
  }
}
