import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { parseDateOnly, formatDateOnly } from '@/lib/date'
import { toDecimal, num, optionalNum } from '@/lib/decimal'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  measuredOn: z.string(),
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300).optional(),
  note: z.string().max(500).optional(),
})

/** เพิ่มแถวใหม่เสมอ ไม่ update ของเดิม — ประวัติน้ำหนักต้องอยู่ครบ */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const body = bodySchema.parse(await request.json())
    const measuredOn = parseDateOnly(body.measuredOn)

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.patientMeasurement.create({
        data: {
          patientId: id,
          measuredOn,
          weightKg: toDecimal(body.weightKg),
          heightCm: body.heightCm ? toDecimal(body.heightCm) : null,
          note: body.note ?? null,
          recordedById: session.userId,
        },
      })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'PATIENT_MEASUREMENT_CREATE',
        targetType: 'PatientMeasurement',
        targetId: row.id,
        newValue: { patientId: id, ...body },
        ...requestMeta(request),
      })
      return row
    })

    return ok(
      {
        measurement: {
          id: created.id,
          measuredOn: formatDateOnly(created.measuredOn),
          weightKg: num(created.weightKg),
          heightCm: optionalNum(created.heightCm),
        },
      },
      201,
    )
  })
}
