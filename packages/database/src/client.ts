import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
console.log({ connectionString });

let client: PrismaClient | null = null;

const prismaClient =
  client ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn", "query"]
        : ["error", "warn"],
  });

export const prisma = prismaClient;
