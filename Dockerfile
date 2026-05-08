# syntax=docker/dockerfile:1.7
FROM node:24-alpine

WORKDIR /app

RUN corepack enable

# Copy Yarn metadata first to maximize Docker layer caching.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/

# Copy workspaces.
COPY packages/ ./packages/

# Install dependencies and build the backend (includes database build + Prisma client generation).
RUN yarn install --immutable
RUN yarn workspace @weather-data-app/backend build

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE $PORT

CMD ["node", "packages/backend/dist/index.js"]
