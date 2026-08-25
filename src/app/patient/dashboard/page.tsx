import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly, today } from '@/lib/date'
import { num } from '@/lib/decimal'
import { getDailySummary, getWeeklySummary } from '@/lib/meals/summary'
import { getFrequentFoods } from '@/lib/foods/frequent'
import { getCalculationForDate } from '@/lib/protein/calculator'
import { WEIGHT_BASIS_LABELS } from '@/lib/protein/rules'
import { ProteinWorkspace } from '@/components/protein/workspace'

export default async function PatientDashboard() {
  const session = await requirePatientPage()
  const date = today()

  const [summary, weekly, frequentFoods, calculation] = await Promise.all([
    getDailySummary(session.patientId, date),
    getWeeklySummary(session.patientId, date),
    getFrequentFoods(session.patientId),
    getCalculationForDate(session.patientId, date),
  ])

  return (
    <ProteinWorkspace
      initialDate={formatDateOnly(date)}
      initialSummary={summary}
      weekly={weekly}
      frequentFoods={frequentFoods}
      referenceWeightKg={calculation ? num(calculation.referenceWeightKg) : null}
      weightBasisLabel={calculation ? WEIGHT_BASIS_LABELS[calculation.weightBasis] : null}
      weeklyHref="/patient/weekly"
    />
  )
}
