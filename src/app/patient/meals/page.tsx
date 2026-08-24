import { MealLogger } from '@/components/meal-logger'
import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly, today } from '@/lib/date'
import { getDailySummary } from '@/lib/meals/summary'
import { getMealBackdateDays } from '@/lib/settings'
import { PageHeader } from '@/components/ui'

export default async function PatientMealsPage() {
  const session = await requirePatientPage()

  const date = today()
  const [backdateDays, summary] = await Promise.all([
    getMealBackdateDays(),
    getDailySummary(session.patientId, date),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="บันทึกอาหาร"
        description={
          backdateDays === -1
            ? 'บันทึกย้อนหลังได้ไม่จำกัด'
            : backdateDays === 0
              ? 'บันทึกได้เฉพาะอาหารของวันนี้'
              : `บันทึกย้อนหลังได้ไม่เกิน ${backdateDays} วัน`
        }
      />
      <MealLogger initialDate={formatDateOnly(date)} initialSummary={summary} />
    </div>
  )
}
