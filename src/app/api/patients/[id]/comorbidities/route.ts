import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'
import { badRequest } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  comorbidityCodes: z.array(z.string().trim().min(1)).max(50),
})

/** แทนที่ชุดโรคร่วมทั้งชุด (idempotent) — แถวเก่าถูกปิดด้วย isActive=false ไม่ลบทิ้ง */
export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const { comorbidityCodes } = bodySchema.parse(await request.json())
    const codes = [...new Set(comorbidityCodes.map((code) => code.toUpperCase()))]

    const comorbidities = await prisma.comorbidity.findMany({ where: { code: { in: codes } } })
    if (comorbidities.length !== codes.length) {
      const found = new Set(comorbidities.map((row) => row.code))
      throw badRequest(
        'UNKNOWN_COMORBIDITY',
        `ไม่รู้จักรหัสโรคร่วม: ${codes.filter((code) => !found.has(code)).join(', ')}`,
      )
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.patientComorbidity.findMany({
        where: { patientId: id, isActive: true },
        include: { comorbidity: true },
      })

      await tx.patientComorbidity.updateMany({
        where: { patientId: id },
        data: { isActive: false },
      })

      for (const comorbidity of comorbidities) {
        await tx.patientComorbidity.upsert({
          where: {
            patientId_comorbidityId: { patientId: id, comorbidityId: comorbidity.id },
          },
          create: { patientId: id, comorbidityId: comorbidity.id, isActive: true },
          update: { isActive: true },
        })
      }

      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_COMORBIDITY_SET',
        targetType: 'Patient',
        targetId: id,
        oldValue: { codes: before.map((row) => row.comorbidity.code) },
        newValue: { codes },
        ...requestMeta(request),
      })
    })

    return ok({ comorbidityCodes: codes })
  })
}
