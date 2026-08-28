import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { today } from '@/lib/date'
import { requirePatientAccess } from '@/lib/patients/access'
import { previewProteinTarget } from '@/lib/protein/calculator'
import { ENERGY_FACTORS_KCAL } from '@/lib/protein/body-metrics'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  weightBasis: z.enum(['ACTUAL', 'IBW', 'ADJUSTED', 'DRY']).nullish(),
  energyFactorKcal: z
    .number()
    .refine((value) => (ENERGY_FACTORS_KCAL as readonly number[]).includes(value), {
      message: 'พลังงานต่อน้ำหนักตัวต้องเป็น 20/25/30/35/40/45 kcal',
    })
    .nullish(),
})

/**
 * Preview อย่างเดียว — ไม่เขียน ProteinCalculation ลง DB เด็ดขาด
 * แยก endpoint จาก confirm คนละตัวตามสเปก
 * อ่านอย่างเดียว ไม่เขียน DB ผู้ป่วยจึงเรียกดูของตัวเองได้
 * (requirePatientAccess กันการเดา id ของคนอื่น) ส่วนการ "ยืนยัน" เป็นของเจ้าหน้าที่
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession()
    const { id } = await params
    await requirePatientAccess(session, id)

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const preview = await previewProteinTarget(id, today(), {
      weightBasis: body.weightBasis,
      energyFactorKcal: body.energyFactorKcal,
    })
    return ok({ preview })
  })
}
