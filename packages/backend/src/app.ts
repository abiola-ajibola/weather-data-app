import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyEnv from "@fastify/env";

import { registerRoutes } from "./routes/index.js";
import { env } from "./config/env.js";

const schema = {
  type: "object",
  required: ["ALLOWED_ORIGIN"],
  properties: {
    ALLOWED_ORIGIN: {
      type: "string",
      default: 3000,
    },
  },
};

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });
  console.log({ origin: env });
  app.register(fastifyEnv, { schema });
  app.register(cors, { origin: env.allowedOrigins });
  app.register(registerRoutes);

  return app;
};
