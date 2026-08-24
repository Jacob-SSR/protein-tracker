import { handle, ok, requireSession } from '@/lib/api'
import { tomorrow } from '@/lib/date'
import { ADMIN_ROLES } from '@/lib/permissions'
import { requirePatientAccess } from '@/lib/patients/access'
import { previewProteinTarget } from '@/lib/protein/calculator'

type Params = { params: Promise<{ id: string }> }

/**
 * Preview อย่างเดียว — ไม่เขียน ProteinCalculation ลง DB เด็ดขาด
 * แยก endpoint จาก confirm คนละตัวตามสเปก
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    await requirePatientAccess(session, id)

    const preview = await previewProteinTarget(id, tomorrow())
    return ok({ preview })
  })
}
