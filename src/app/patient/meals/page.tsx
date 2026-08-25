import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly, today } from '@/lib/date'
import { num } from '@/lib/decimal'
import { getDailySummary, getWeeklySummary } from '@/lib/meals/summary'
import { getFrequentFoods } from '@/lib/foods/frequent'
import { getCalculationForDate } from '@/lib/protein/calculator'
import { WEIGHT_BASIS_LABELS } from '@/lib/protein/rules'
import { getMealBackdateDays } from '@/lib/settings'
import { ProteinWorkspace } from '@/components/protein/workspace'

export default async function PatientMealsPage() {
  const session = await requirePatientPage()
  const date = today()

  const [summary, weekly, frequentFoods, calculation, backdateDays] = await Promise.all([
    getDailySummary(session.patientId, date),
    getWeeklySummary(session.patientId, date),
    getFrequentFoods(session.patientId),
    getCalculationForDate(session.patientId, date),
    getMealBackdateDays(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {backdateDays === -1
          ? 'บันทึกย้อนหลังได้ไม่จำกัด'
          : backdateDays === 0
            ? 'บันทึกได้เฉพาะอาหารของวันนี้'
            : `บันทึกย้อนหลังได้ไม่เกิน ${backdateDays} วัน`}
      </p>
      <ProteinWorkspace
        initialDate={formatDateOnly(date)}
        initialSummary={summary}
        weekly={weekly}
        frequentFoods={frequentFoods}
        referenceWeightKg={calculation ? num(calculation.referenceWeightKg) : null}
        weightBasisLabel={calculation ? WEIGHT_BASIS_LABELS[calculation.weightBasis] : null}
        weeklyHref="/patient/weekly"
      />
    </div>
  )
}
