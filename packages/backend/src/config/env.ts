import "dotenv/config";

const parseOrigins = (input: string | undefined): string[] => {
  if (!input) {
    return ["http://localhost:5173"];
  }

  return input
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const parseNumber = (input: string | undefined, fallback: number): number => {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: parseNumber(process.env.PORT, 3001),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGIN),
  redisUrl: process.env.REDIS_URL?.trim() || undefined,
  magicLinkBaseUrl:
    process.env.MAGIC_LINK_BASE_URL?.trim() ||
    "http://localhost:5173/auth",
  magicLinkTtlMinutes: parseNumber(process.env.MAGIC_LINK_TTL_MINUTES, 15),
  smtpHost: process.env.SMTP_HOST?.trim() || undefined,
  smtpPort: parseNumber(process.env.SMTP_PORT, 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER?.trim() || undefined,
  smtpPass: process.env.SMTP_PASS || undefined,
  smtpFrom: process.env.SMTP_FROM?.trim() || "no-reply@weather-data-app.local",
} as const;
