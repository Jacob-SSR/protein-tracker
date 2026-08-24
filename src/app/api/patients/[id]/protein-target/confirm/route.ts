import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'
import { confirmProteinTarget } from '@/lib/protein/calculation-service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  note: z.string().max(500).optional(),
  /** ค่าที่แสดงบนหน้า Preview — ใช้กันกรณีข้อมูลเปลี่ยนระหว่างที่ admin ยังไม่กดยืนยัน */
  expectedProteinTargetGrams: z.number().positive().optional(),
})

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const result = await confirmProteinTarget({
      patientId: id,
      confirmedById: session.userId,
      note: body.note,
      expectedProteinTargetGrams: body.expectedProteinTargetGrams,
      ...requestMeta(request),
    })

    return ok({ proteinTarget: result }, 201)
  })
}
