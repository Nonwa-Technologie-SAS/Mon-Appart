import { z } from "zod"

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional())

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["local", "test", "development", "staging", "production"])
    .default("local"),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: optionalString,
  REDIS_URL: optionalString,
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_TTL: z.string().min(1).default("30d"),
  CORS_ORIGINS: z.string().default(""),
  SWAGGER_ENABLED: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).optional(),
  ),
  METRICS_ENABLED: z.enum(["true", "false"]).default("false"),
  OTEL_ENABLED: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
})

export type ApiEnv = z.infer<typeof apiEnvSchema>

export function parseApiEnv(input: Record<string, unknown>): ApiEnv {
  const result = apiEnvSchema.safeParse(input)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.code}`)
      .join("; ")
    throw new Error(`Configuration d'environnement invalide: ${message}`)
  }
  return result.data
}

export function isSwaggerEnabled(env: {
  APP_ENV: string
  SWAGGER_ENABLED?: string
}): boolean {
  if (env.SWAGGER_ENABLED === "true") return true
  if (env.SWAGGER_ENABLED === "false") return false
  return env.APP_ENV === "local" || env.APP_ENV === "development"
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}
