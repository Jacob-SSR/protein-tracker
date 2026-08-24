import Link from 'next/link'
import { requirePatientPage } from '@/lib/auth/guards'
import { today } from '@/lib/date'
import { getDailySummary } from '@/lib/meals/summary'

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'มื้อเช้า',
  LUNCH: 'มื้อกลางวัน',
  DINNER: 'มื้อเย็น',
  SNACK: 'ของว่าง',
}

export default async function PatientDashboard() {
  const session = await requirePatientPage()

  const summary = await getDailySummary(session.patientId, today())

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">สรุปวันนี้ ({summary.date})</h1>

      <section className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded border p-3">
          <p className="text-xs text-gray-500">🎯 เป้าหมาย</p>
          <p className="text-lg font-semibold">
            {summary.targetGrams === null ? 'ยังไม่กำหนด' : `${summary.targetGrams} g`}
          </p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs text-gray-500">🍗 ทานแล้ว</p>
          <p className="text-lg font-semibold">{summary.consumedGrams} g</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-xs text-gray-500">📉 เหลือ</p>
          <p className="text-lg font-semibold">
            {summary.remainingGrams === null ? '-' : `${summary.remainingGrams} g`}
          </p>
        </div>
      </section>

      {summary.notification ? (
        <p
          className={
            summary.notification.level === 'DANGER'
              ? 'rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700'
              : 'rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'
          }
        >
          {summary.notification.message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        {summary.meals.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีรายการอาหารของวันนี้</p>
        ) : (
          summary.meals.map((meal) => (
            <div key={meal.id} className="rounded border p-3">
              <div className="flex justify-between text-sm font-medium">
                <span>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</span>
                <span>{meal.subtotalGrams} g</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.foodName} · {item.quantity} {item.unitName}
                    </span>
                    <span>{item.proteinAmount} g</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <Link href="/patient/meals" className="rounded bg-black p-2 text-center text-white">
        บันทึกอาหาร
      </Link>
    </div>
  )
}
