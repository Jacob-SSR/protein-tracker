import { requirePatientPage } from '@/lib/auth/guards'
import { formatDateOnly, today } from '@/lib/date'
import { getDailySummary } from '@/lib/meals/summary'
import { Alert, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui'
import { MEAL_LABELS } from '@/lib/meals/labels'

export default async function PatientDashboard() {
  const session = await requirePatientPage()
  const date = today()
  const summary = await getDailySummary(session.patientId, date)

  const percent = summary.percent ?? 0
  const over = summary.targetGrams !== null && summary.consumedGrams > summary.targetGrams

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="สรุปวันนี้"
        description={formatDateOnly(date)}
        actions={<LinkButton href="/patient/meals">บันทึกอาหาร</LinkButton>}
      />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted">🎯 เป้าหมาย</p>
              <p className="tabular text-xl font-semibold">
                {summary.targetGrams === null ? '—' : `${summary.targetGrams} g`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">🍗 ทานแล้ว</p>
              <p className="tabular text-xl font-semibold text-brand">{summary.consumedGrams} g</p>
            </div>
            <div>
              <p className="text-xs text-muted">{over ? '⚠️ เกิน' : '📉 เหลือ'}</p>
              <p className={`tabular text-xl font-semibold ${over ? 'text-danger' : ''}`}>
                {summary.remainingGrams === null ? '—' : `${Math.abs(summary.remainingGrams)} g`}
              </p>
            </div>
          </div>

          {summary.targetGrams === null ? (
            <Alert tone="warn">
              ยังไม่มีเป้าหมายโปรตีน — ติดต่อเจ้าหน้าที่เพื่อกำหนดเป้าหมายให้คุณ
            </Alert>
          ) : (
            <div className="h-3 overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full transition-all ${over ? 'bg-danger' : 'bg-brand'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          )}

          {summary.notification ? (
            <Alert
              tone={
                summary.notification.level === 'DANGER'
                  ? 'danger'
                  : summary.notification.level === 'WARN'
                    ? 'warn'
                    : 'brand'
              }
            >
              {summary.notification.message}
            </Alert>
          ) : null}
        </div>
      </Card>

      <Card title="รายการอาหารวันนี้">
        {summary.meals.length === 0 ? (
          <EmptyState>ยังไม่มีรายการ — กด &quot;บันทึกอาหาร&quot; เพื่อเริ่ม</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {summary.meals.map((meal) => (
              <li key={meal.id} className="rounded-lg border border-line p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</span>
                  <span className="tabular">{meal.subtotalGrams} g</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {meal.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.foodName} · {item.quantity} × {item.unitName}
                      </span>
                      <span className="tabular">{item.proteinAmount} g</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
