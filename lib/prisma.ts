import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();

  // Configure SQLite for maximum performance and concurrency
  client
    .$queryRawUnsafe(`PRAGMA journal_mode = WAL;`)
    .then(() => client.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`))
    .then(() => client.$queryRawUnsafe(`PRAGMA cache_size = -64000;`))
    .then(() => client.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`))
    .catch(() => {
      // Ignore during build or if unsupported
    });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

