FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/workers/package.json services/workers/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/tsconfig packages/tsconfig
RUN pnpm install --frozen-lockfile --filter @mon-appart/workers...
COPY packages/types packages/types
COPY services/workers services/workers
RUN pnpm --filter @mon-appart/types build && pnpm --filter @mon-appart/workers build
WORKDIR /repo/services/workers
EXPOSE 4001
CMD ["node", "dist/main.js"]
