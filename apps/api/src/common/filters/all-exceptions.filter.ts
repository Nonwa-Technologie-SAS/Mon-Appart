import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import type { Request, Response } from "express"

import { safeErrorMessage } from "../http/safe-error"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<Response>()
    const request = http.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Erreur interne du serveur"
    let details: unknown

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === "string") {
        message = body
      } else if (isRecord(body) && body.message !== undefined) {
        details = body.message
        message =
          typeof body.message === "string" ? body.message : "Requête invalide"
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          request_id: request.id,
          error: safeErrorMessage(exception),
        }),
      )
      message = "Erreur interne du serveur"
      details = undefined
    }

    response.status(status).json({
      statusCode: status,
      message,
      details,
      requestId: request.id ?? null,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
