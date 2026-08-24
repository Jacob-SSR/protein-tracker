import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { createUser } from '@/lib/users/service'

const querySchema = z.object({
  q: z.string().trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: Request) {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { searchParams } = new URL(request.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))

    const users = await prisma.user.findMany({
      where: {
        role: query.role,
        OR: query.q
          ? [
              { username: { contains: query.q, mode: 'insensitive' } },
              { fullName: { contains: query.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      take: query.take,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        patient: { select: { id: true, hn: true } },
      },
    })

    return ok({ users })
  })
}

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 . _ -'),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(200),
  email: z.email().optional().or(z.literal('')),
  // บัญชีผู้ป่วยไม่ได้สร้างจากที่นี่ — สร้างผู้ป่วยที่ /api/patients
  // แล้วค่อยเปิดสิทธิ์เข้าระบบทีหลังที่ /api/patients/[id]/account
  role: z.enum(['SUPER_ADMIN', 'ADMIN']),
})

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = createSchema.parse(await request.json())

    const user = await createUser(
      session,
      {
        username: body.username,
        password: body.password,
        fullName: body.fullName,
        email: body.email || null,
        role: body.role,
      },
      requestMeta(request),
    )

    return ok({ user: { id: user.id, username: user.username, role: user.role } }, 201)
  })
}
