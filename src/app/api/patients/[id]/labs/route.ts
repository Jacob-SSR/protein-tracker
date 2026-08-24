import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { formatDateOnly, parseDateOnly } from '@/lib/date'
import { num, toDecimal } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  // labType ยัง free string อยู่ — normalize เป็นตัวพิมพ์ใหญ่เพื่อลดปัญหา "eGFR" vs "egfr"
  labType: z.string().trim().min(1).max(50),
  value: z.number(),
  unit: z.string().trim().max(20).optional(),
  measuredOn: z.string(),
  note: z.string().max(500).optional(),
})

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const body = bodySchema.parse(await request.json())
    const labType = body.labType.toUpperCase()

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.patientLab.create({
        data: {
          patientId: id,
          labType,
          value: toDecimal(body.value),
          unit: body.unit ?? null,
          measuredOn: parseDateOnly(body.measuredOn),
          note: body.note ?? null,
          recordedById: session.userId,
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_LAB_CREATE',
        targetType: 'PatientLab',
        targetId: row.id,
        newValue: { patientId: id, ...body, labType },
        ...requestMeta(request),
      })
      return row
    })

    return ok(
      {
        lab: {
          id: created.id,
          labType: created.labType,
          value: num(created.value),
          unit: created.unit,
          measuredOn: formatDateOnly(created.measuredOn),
        },
      },
      201,
    )
  })
}
