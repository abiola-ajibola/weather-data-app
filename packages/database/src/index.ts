import { PrismaClient } from "../generated/client/index.js";

let __prisma;

const prismaSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

export const prisma = __prisma ?? prismaSingleton();

export type {
  ApiKey,
  MagicLinkToken,
  Prisma,
  WeatherObservation,
  WeatherStation,
} from "../generated/client/index.js";
