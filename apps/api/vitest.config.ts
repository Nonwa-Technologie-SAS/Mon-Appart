import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.spec.ts",
      "test/**/*.e2e-spec.ts",
      "test/contracts/**/*.contract-spec.ts",
    ],
    setupFiles: ["./test/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/**/*.module.ts",
        "src/**/*.spec.ts",
        "src/**/cli/**",
        "src/generated/**",
      ],
    },
    env: {
      NODE_ENV: "test",
      APP_ENV: "test",
      LOG_LEVEL: "silent",
      JWT_SECRET: "dev-only-change-me-please-32chars-min",
      JWT_REFRESH_SECRET: "dev-only-refresh-change-me-32chars",
      DATABASE_URL: "",
      REDIS_URL: "",
      METRICS_ENABLED: "false",
      OTEL_ENABLED: "false",
      SWAGGER_ENABLED: "false",
      CORS_ORIGINS: "",
    },
  },
})
