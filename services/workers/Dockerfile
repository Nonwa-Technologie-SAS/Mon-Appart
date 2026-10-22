# syntax=docker/dockerfile:1.7
# Workers BullMQ — build monorepo pnpm, runtime non-root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/workers/package.json services/workers/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/tsconfig packages/tsconfig
RUN pnpm install --frozen-lockfile --filter @mon-appart/workers...
COPY packages/types packages/types
COPY services/workers services/workers
ENV HUSKY=0
RUN pnpm --filter @mon-appart/types build \
  && pnpm --filter @mon-appart/workers build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
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
WORKDIR /repo/services/workers
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_PORT||4001)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
