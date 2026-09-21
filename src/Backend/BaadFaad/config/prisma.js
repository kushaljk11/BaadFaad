import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import pg from 'pg';

let prismaClient = globalThis.__baadfaadPrisma;

export function getPrisma() {
  if (globalThis.__baadfaadPrisma) return globalThis.__baadfaadPrisma;
  if (prismaClient) return prismaClient;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
  });
  const adapter = new PrismaPg(pool);
  prismaClient = new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 15000,
      timeout: 30000,
    },
  });
  if (process.env.NODE_ENV !== 'production') globalThis.__baadfaadPrisma = prismaClient;
  return prismaClient;
}

export default async function connectDB() {
  const prisma = getPrisma();
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log('PostgreSQL connected through Prisma');
}
