import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { requestMeta } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'
import { confirmProteinTarget } from '@/lib/protein/calculation-service'
import { ENERGY_FACTORS_KCAL } from '@/lib/protein/body-metrics'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  note: z.string().max(500).optional(),
  /** ค่าที่แสดงบนหน้า Preview — ใช้กันกรณีข้อมูลเปลี่ยนระหว่างที่ยังไม่กดยืนยัน */
  expectedProteinTargetGrams: z.number().positive().optional(),
  weightBasis: z.enum(['ACTUAL', 'IBW', 'ADJUSTED', 'DRY']).nullish(),
  energyFactorKcal: z
    .number()
    .refine((value) => (ENERGY_FACTORS_KCAL as readonly number[]).includes(value), {
      message: 'พลังงานต่อน้ำหนักตัวต้องเป็น 20/25/30/35/40/45 kcal',
    })
    .nullish(),
})

/**
 * ยืนยันเป้าหมาย = ออกผลประเมินทางการ เฉพาะเจ้าหน้าที่โภชนาการ/แอดมิน
 * ทุกครั้งถูกบันทึกลง Audit Log ว่าใครเป็นคนกด
 */
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
      weightBasis: body.weightBasis,
      energyFactorKcal: body.energyFactorKcal,
      ...requestMeta(request),
    })

    return ok({ proteinTarget: result }, 201)
  })
}
