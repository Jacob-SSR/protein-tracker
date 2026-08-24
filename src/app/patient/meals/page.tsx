import { MealLogger } from '@/components/meal-logger'
import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly, today } from '@/lib/date'
import { getDailySummary } from '@/lib/meals/summary'
import { getMealBackdateDays } from '@/lib/settings'

export default async function PatientMealsPage() {
  const session = await requirePatientPage()

  const date = today()
  const [backdateDays, summary] = await Promise.all([
    getMealBackdateDays(),
    getDailySummary(session.patientId, date),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">บันทึกอาหาร</h1>
        <p className="text-sm text-gray-500">
          {backdateDays === -1
            ? 'บันทึกย้อนหลังได้ไม่จำกัด'
            : backdateDays === 0
              ? 'บันทึกได้เฉพาะวันนี้'
              : `บันทึกย้อนหลังได้ไม่เกิน ${backdateDays} วัน`}
        </p>
      </div>
      <MealLogger initialDate={formatDateOnly(date)} initialSummary={summary} />
    </div>
  )
}
