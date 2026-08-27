import { requirePatientPage } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { today } from '@/lib/date'
import { getDailySummary, getWeeklySummary } from '@/lib/meals/summary'
import { getWaterSummary } from '@/lib/water/service'
import { DailyOverview } from '@/components/patient/daily-overview'

/**
 * หน้าหลักของผู้ป่วย = ภาพรวมวันนี้ + สิ่งที่กดบ่อย (น้ำ)
 * การบันทึกอาหารแบบละเอียดอยู่ที่ /patient/meals คนละหน้ากันโดยตั้งใจ
 */
export default async function PatientDashboard() {
  const session = await requirePatientPage()
  const date = today()

  const [summary, weekly, water, patient] = await Promise.all([
    getDailySummary(session.patientId, date),
    getWeeklySummary(session.patientId, date),
    getWaterSummary(session.patientId, date),
    prisma.patient.findUniqueOrThrow({
      where: { id: session.patientId },
      select: { fullName: true },
    }),
  ])

  return (
    <DailyOverview
      greetingName={patient.fullName}
      todayLabel={new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
      summary={summary}
      weekly={weekly}
      water={water}
      mealsHref="/patient/meals"
      weeklyHref="/patient/weekly"
      assessmentHref="/patient/health"
    />
  )
}
