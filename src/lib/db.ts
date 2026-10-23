import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // full query log only in development; keep production (Vercel) logs clean
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["query"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db