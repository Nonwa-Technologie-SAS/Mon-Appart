# syntax=docker/dockerfile:1.7
# API NestJS — build monorepo pnpm, runtime non-root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/analytics/package.json packages/analytics/package.json
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile --filter @mon-appart/api...
COPY packages packages
COPY apps/api apps/api
ENV HUSKY=0
# prisma.config.ts exige DATABASE_URL même pour `generate` (aucun accès réseau).
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm --filter @mon-appart/config build \
  && pnpm --filter @mon-appart/types build \
  && pnpm --filter @mon-appart/validation build \
  && pnpm --filter @mon-appart/analytics build \
  && pnpm --filter @mon-appart/api build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 monappart \
  && useradd --system --uid 1001 --gid monappart --create-home monappart \
  && corepack enable
WORKDIR /repo
ENV NODE_ENV=production
ENV APP_ENV=production
ENV HUSKY=0
COPY --from=build --chown=monappart:monappart /repo /repo
USER monappart
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=10 \
  CMD node -e "const port=process.env.APP_PORT||4000;const paths=['/health/live','/api/health/live'];(async()=>{for(const p of paths){try{const r=await fetch('http://127.0.0.1:'+port+p);if(r.ok)process.exit(0)}catch{}}process.exit(1)})()"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
