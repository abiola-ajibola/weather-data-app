import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { prisma } from "@weather-data-app/database";

import { env } from "./config/env.js";
import { hashToken } from "./lib/auth.js";
import { closeCache, initCache } from "./lib/cache.js";
import { registerRoutes } from "./routes/index.js";

const unauthenticatedPaths = new Set([
  "/health",
  "/auth/request-link",
  "/auth/verify-link",
]);

const shouldSkipAuth = (path: string): boolean => {
  if (unauthenticatedPaths.has(path)) {
    return true;
  }

  return path.startsWith("/documentation");
};

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  app.register(sensible);
  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"), false);
    },
  });

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
        revokedAt: undefined,
      },
    });

    console.log({ keyHash, apiKey, token });

    if (!apiKey) {
      return reply.unauthorized("Invalid bearer token.");
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
