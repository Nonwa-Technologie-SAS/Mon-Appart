FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile --filter @mon-appart/api...
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @mon-appart/config build \
  && pnpm --filter @mon-appart/types build \
  && pnpm --filter @mon-appart/validation build \
  && pnpm --filter @mon-appart/api build
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
