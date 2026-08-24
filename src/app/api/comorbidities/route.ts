import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'

export async function GET() {
  return handle(async () => {
    await requireSession(ADMIN_ROLES)
    const comorbidities = await prisma.comorbidity.findMany({
      orderBy: { code: 'asc' },
    })
    return ok({ comorbidities })
  })
}

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, 'ใช้ได้เฉพาะ A-Z 0-9 _'),
  name: z.string().trim().min(1).max(200),
})

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const body = createSchema.parse(await request.json())
    const code = body.code.toUpperCase()

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.comorbidity.create({
        data: { code, name: body.name },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'COMORBIDITY_CREATE',
        targetType: 'Comorbidity',
        targetId: row.id,
        newValue: { code, name: body.name },
        ...requestMeta(request),
      })
      return row
    })

    return ok({ comorbidity: created }, 201)
  })
}
