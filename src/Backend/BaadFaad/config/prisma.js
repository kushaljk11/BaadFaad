import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prismaClient = globalThis.__baadfaadPrisma;

export function getPrisma() {
  if (prismaClient) return prismaClient;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prismaClient = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== 'production') globalThis.__baadfaadPrisma = prismaClient;
  return prismaClient;
}

export default async function connectDB() {
  const prisma = getPrisma();
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log('PostgreSQL connected through Prisma');
}
