import { handle, ok, requireSession } from '@/lib/api'
import { formatDateOnly, parseDateOnly, today } from '@/lib/date'
import { num } from '@/lib/decimal'
import { requirePatientAccess } from '@/lib/patients/access'
import { getCalculationForDate } from '@/lib/protein/calculator'

type Params = { params: Promise<{ id: string }> }

/** เป้าหมายที่มีผลของวันที่ระบุ (default = วันนี้) */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession()
    const { id } = await params
    await requirePatientAccess(session, id)

    const dateParam = new URL(request.url).searchParams.get('date')
    const date = dateParam ? parseDateOnly(dateParam) : today()
    const calculation = await getCalculationForDate(id, date)

    return ok({
      date: formatDateOnly(date),
      proteinTarget: calculation
        ? {
            id: calculation.id,
            proteinTargetGrams: num(calculation.proteinTargetGrams),
            proteinFactor: num(calculation.proteinFactor),
            referenceWeightKg: num(calculation.referenceWeightKg),
            ruleName: calculation.ruleNameSnapshot,
            effectiveFrom: formatDateOnly(calculation.effectiveFrom),
            effectiveTo: calculation.effectiveTo ? formatDateOnly(calculation.effectiveTo) : null,
          }
        : null,
    })
  })
}
