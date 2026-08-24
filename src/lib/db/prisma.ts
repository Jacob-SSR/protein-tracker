import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 ต่อ DB ผ่าน driver adapter — ตอนย้ายไป MySQL เปลี่ยนแค่ไฟล์นี้
// (@prisma/adapter-mariadb) + provider ใน schema.prisma ส่วน service layer ไม่ต้องแก้
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

// Vercel serverless: reuse client ข้าม hot reload / lambda invocation เดิม
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
