# syntax=docker/dockerfile:1.7
# Site public Next.js — build monorepo pnpm, runtime standalone non-root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/analytics/package.json packages/analytics/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile --filter @mon-appart/web...
COPY packages/types packages/types
COPY packages/analytics packages/analytics
COPY apps/web apps/web
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1
# Figés au build (rewrites Next + SEO). Contabo : API interne Docker.
ARG NEST_API_URL=http://api:4000
ARG NEXT_PUBLIC_NEST_API_URL=same-origin
ARG NEXT_PUBLIC_SITE_URL=https://www.monappart.ci
ENV NEST_API_URL=$NEST_API_URL
ENV NEXT_PUBLIC_NEST_API_URL=$NEXT_PUBLIC_NEST_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @mon-appart/types build \
  && pnpm --filter @mon-appart/analytics build \
  && pnpm --filter @mon-appart/web build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 monappart \
  && useradd --system --uid 1001 --gid monappart --create-home monappart
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Override possible via Compose ; défaut Contabo = service api sur le réseau Docker.
ENV NEST_API_URL=http://api:4000
ENV NEXT_PUBLIC_NEST_API_URL=same-origin
COPY --from=build --chown=monappart:monappart /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=monappart:monappart /repo/apps/web/.next/standalone ./
COPY --from=build --chown=monappart:monappart /repo/apps/web/.next/static ./apps/web/.next/static
USER monappart
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
