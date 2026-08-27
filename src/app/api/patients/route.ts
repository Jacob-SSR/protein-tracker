import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requestMeta } from '@/lib/audit'
import { createPatient } from '@/lib/patients/service'

const querySchema = z.object({
  q: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: Request) {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const { searchParams } = new URL(request.url)
    const { q, take } = querySchema.parse(Object.fromEntries(searchParams))

    const patients = await prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { hn: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        hn: true,
        fullName: true,
        isActive: true,
        user: { select: { username: true } },
      },
    })

    return ok({ patients })
  })
}

const createSchema = z.object({
  hn: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(200),
  birthDate: z.string().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  note: z.string().trim().max(500).optional(),
  weightKg: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(300).optional(),
  /** ผลเลือดตั้งต้น บันทึกเป็นผลตรวจของวันนี้ไปพร้อมกับการสร้างผู้ป่วย */
  labs: z
    .array(
      z.object({
        labType: z.string().trim().min(1).max(50),
        value: z.number(),
        unit: z.string().trim().max(20).optional(),
      }),
    )
    .max(20)
    .optional(),
})

/** สร้างผู้ป่วยโดยไม่ต้องมีบัญชีเข้าระบบ — เจ้าหน้าที่เป็นคนบันทึกข้อมูลให้ */
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = createSchema.parse(await request.json())

    const patient = await createPatient(
      session,
      { ...body, birthDate: body.birthDate || null },
      requestMeta(request),
    )

    return ok({ patient: { id: patient.id, hn: patient.hn, fullName: patient.fullName } }, 201)
  })
}
