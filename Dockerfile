FROM node:24-alpine

ARG DATABASE_URL

WORKDIR /app

RUN corepack enable

# Copy Yarn metadata first to maximize Docker layer caching.
COPY package.json yarn.lock .yarnrc.yml ./

# Copy workspaces.
COPY packages/ ./packages/

# Install dependencies and build the backend (includes database build + Prisma client generation).
RUN yarn install --immutable
RUN yarn workspace @weather-data-app/backend build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DATABASE_URL=$DATABASE_URL

EXPOSE $PORT

CMD ["node", "packages/backend/dist/index.js"]
