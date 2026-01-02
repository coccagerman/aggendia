import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: new PrismaPg({
            // Para RUNTIME usamos DATABASE_URL (pooler/session)
            connectionString: process.env.DATABASE_URL!
        })
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
