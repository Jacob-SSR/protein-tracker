import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 อ่าน connection URL จากไฟล์นี้ ไม่ใช่จาก schema.prisma อีกต่อไป
// migrate / introspect ต้องใช้ direct connection (port 5432) ไม่ใช่ pooler (6543)
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
