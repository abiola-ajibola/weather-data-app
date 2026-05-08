import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { prisma } from "@weather-data-app/database";

import { hashToken } from "./lib/auth.js";
import { closeCache, initCache } from "./lib/cache.js";
import { registerRoutes } from "./routes/index.js";
import { env } from "./config/env.js";

const unauthenticatedPaths = new Set([
  "/health",
  "/auth/request-link",
  "/auth/verify-link",
]);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const shouldSkipAuth = (path: string): boolean => {
  if (unauthenticatedPaths.has(path)) {
    return true;
  }

  return path.startsWith("/documentation");
};

const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  app.register(sensible);
  app.register(cors);

  app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: 1_000,
  });

  app.addHook("onReady", async () => {
    await initCache(env.redisUrl, app.log);
  });

  app.addHook("onClose", async () => {
    await closeCache();
    await prisma.$disconnect();
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    if (shouldSkipAuth(request.routeOptions.url ?? request.url)) {
      return;
    }

    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return reply.unauthorized("Bearer token is required.");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return reply.unauthorized("Bearer token is required.");
    }

    const keyHash = hashToken(token);

    const apiKey = await prisma.apiKey.findUnique({
      where: {
        keyHash,
        OR: [{ revokedAt: undefined }, { revokedAt: { isSet: false } }],
      },
    });

    if (!apiKey) {
      return reply.unauthorized("Invalid bearer token.");
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - THIRTY_DAYS_MS);
    const lastActivity = apiKey.lastUsedAt ?? apiKey.createdAt;

    if (lastActivity.getTime() < staleBefore.getTime()) {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          revokedAt: now,
        },
      });

      return reply.unauthorized("Bearer token has expired due to inactivity.");
    }

    request.apiKey = apiKey;
    request.authEmail = apiKey.email;

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
      },
    });
  });

  app.register(registerRoutes);

  return app;
};

const app = buildApp();
let isClosing = false;

const closeServer = async (signal: NodeJS.Signals): Promise<void> => {
  if (isClosing) {
    return;
  }

  isClosing = true;
  app.log.info({ signal }, "Received shutdown signal");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  void closeServer("SIGINT");
});

process.on("SIGTERM", () => {
  void closeServer("SIGTERM");
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.port, host: env.host});
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }
};

await start();
