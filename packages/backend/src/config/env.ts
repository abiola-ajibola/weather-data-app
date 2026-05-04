import "dotenv/config"
export const env = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3001),
  allowedOrigins: process.env.ALLOWED_ORIGIN,
  redisUrl: process.env.REDIS_URL?.trim() || undefined,
} as const;
