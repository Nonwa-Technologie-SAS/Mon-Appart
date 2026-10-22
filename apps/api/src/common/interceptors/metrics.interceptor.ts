import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common"
import type { Request, Response } from "express"
import { Observable, tap } from "rxjs"

import { MetricsService } from "../../observability/metrics.service"

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metrics.isEnabled() || context.getType() !== "http") {
      return next.handle()
    }

    const started = process.hrtime.bigint()
    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()

    return next.handle().pipe(
      tap({
        next: () => this.observe(request, response, started),
        error: () => this.observe(request, response, started),
      }),
    )
  }

  private observe(request: Request, response: Response, started: bigint): void {
    const route = request.route as { path?: string } | undefined
    const path = route?.path ?? request.path
    const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000
    this.metrics.httpDuration.observe(
      {
        method: request.method,
        route: path,
        status: String(response.statusCode),
      },
      seconds,
    )
  }
}
