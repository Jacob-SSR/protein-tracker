import { requirePatientPage } from '@/lib/auth/guards'
import { today } from '@/lib/date'
import { getWeeklySummary } from '@/lib/meals/summary'

export default async function PatientWeeklyPage() {
  const session = await requirePatientPage()

  const summary = await getWeeklySummary(session.patientId, today())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        สรุปรายสัปดาห์ ({summary.from} — {summary.to})
      </h1>
      <p className="text-sm text-gray-500">
        เฉลี่ยวันละ {summary.averageConsumedGrams} g · เกินเป้าหมาย {summary.daysOverTarget} วัน
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">วันที่</th>
            <th className="p-2">เป้าหมาย</th>
            <th className="p-2">ทานแล้ว</th>
            <th className="p-2">ส่วนต่าง</th>
          </tr>
        </thead>
        <tbody>
          {summary.days.map((day) => {
            const diff = day.targetGrams === null ? null : day.consumedGrams - day.targetGrams
            return (
              <tr key={day.date} className="border-b">
                <td className="p-2">{day.date}</td>
                <td className="p-2">{day.targetGrams ?? '-'}</td>
                <td className="p-2">{day.consumedGrams}</td>
                <td className={`p-2 ${diff !== null && diff > 0 ? 'text-red-600' : ''}`}>
                  {diff === null ? '-' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
