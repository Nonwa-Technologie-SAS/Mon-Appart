# syntax=docker/dockerfile:1.7
# Back-office Next.js — build monorepo pnpm, runtime standalone non-root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile --filter @mon-appart/admin...
COPY apps/admin apps/admin
RUN mkdir -p apps/admin/public
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1
ARG ADMIN_API_URL=http://api:4000
ENV ADMIN_API_URL=$ADMIN_API_URL
RUN pnpm --filter @mon-appart/admin build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 monappart \
  && useradd --system --uid 1001 --gid monappart --create-home monappart
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV ADMIN_API_URL=http://api:4000
COPY --from=build --chown=monappart:monappart /repo/apps/admin/public ./apps/admin/public
COPY --from=build --chown=monappart:monappart /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=monappart:monappart /repo/apps/admin/.next/static ./apps/admin/.next/static
USER monappart
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/admin/server.js"]
