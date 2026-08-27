import Link from 'next/link'
import { Badge } from '@/components/ui'
import { ProgressRing } from '@/components/progress-ring'
import { WaterCard, type WaterSummary } from '@/components/water/water-card'

type Summary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  percent: number | null
  notification: { level: 'INFO' | 'WARN' | 'DANGER'; message: string } | null
  meals: { id: string; mealType: string; subtotalGrams: number; items: { id: string }[] }[]
}

type Weekly = {
  averageConsumedGrams: number
  daysOverTarget: number
  daysEvaluated: number
  verdict: { level: 'OK' | 'WARN' | 'DANGER'; headline: string; detail: string }
}

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'เช้า',
  LUNCH: 'กลางวัน',
  DINNER: 'เย็น',
  SNACK: 'ของว่าง',
}

/**
 * หน้าหลักของผู้ป่วย — ตอบคำถามเดียวคือ "วันนี้เป็นยังไงบ้าง"
 *
 * ตั้งใจให้ต่างจากหน้าบันทึกอาหาร: ที่นี่ดูสถานะกับกดสิ่งที่ทำบ่อย (น้ำ) ได้เลย
 * ส่วนการค้นหา/เลือกหน่วย/แก้จำนวน อยู่ที่หน้าบันทึกอาหารซึ่งเป็นงานละเอียด
 */
export function DailyOverview({
  greetingName,
  todayLabel,
  summary,
  weekly,
  water,
  mealsHref,
  weeklyHref,
  assessmentHref,
}: {
  greetingName: string
  todayLabel: string
  summary: Summary
  weekly: Weekly
  water: WaterSummary
  mealsHref: string
  weeklyHref: string
  assessmentHref: string
}) {
  const over = summary.remainingGrams !== null && summary.remainingGrams < 0
  const itemCount = summary.meals.reduce((total, meal) => total + meal.items.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">สวัสดี {greetingName}</h1>
        <p className="text-sm text-muted">{todayLabel}</p>
      </header>

      {summary.notification ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            summary.notification.level === 'DANGER'
              ? 'bg-danger-soft text-danger'
              : summary.notification.level === 'WARN'
                ? 'bg-warn-soft text-warn'
                : 'bg-info-soft text-info'
          }`}
          role="status"
        >
          {summary.notification.message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <WaterCard initial={water} assessmentHref={assessmentHref} />

        {/* โปรตีน: สรุปอย่างเดียว รายละเอียดไปที่หน้าบันทึกอาหาร */}
        <section className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-medium">
                <span aria-hidden>🍽️</span> โปรตีนวันนี้
              </h2>
              <p className="text-xs text-muted">
                {itemCount === 0 ? 'ยังไม่ได้บันทึกอาหาร' : `บันทึกไปแล้ว ${itemCount} รายการ`}
              </p>
            </div>
            {summary.targetGrams === null ? (
              <Badge tone="muted">ยังไม่มีเป้าหมาย</Badge>
            ) : over ? (
              <Badge tone="danger">เกินเป้าหมาย</Badge>
            ) : null}
          </header>

          <div className="mt-4 flex flex-wrap items-center gap-5">
            <ProgressRing
              percent={summary.percent ?? 0}
              tone={over ? 'danger' : 'brand'}
              ariaLabel={`ทานโปรตีนแล้ว ${summary.consumedGrams} จากเป้าหมาย ${summary.targetGrams ?? '-'} กรัม`}
            />
            <div className="min-w-40 flex-1">
              <p className="flex items-baseline gap-1.5">
                <span className="tabular text-4xl font-semibold text-brand">
                  {summary.consumedGrams}
                </span>
                <span className="text-lg text-muted">/ {summary.targetGrams ?? '—'} ก.</span>
              </p>
              <p className="mt-2 text-sm">
                {summary.remainingGrams === null ? (
                  <span className="text-muted">กรอกข้อมูลสุขภาพเพื่อรับเป้าหมาย</span>
                ) : over ? (
                  <span className="text-danger">
                    เกินมา {Math.abs(summary.remainingGrams)} กรัม
                  </span>
                ) : (
                  <span className="text-muted">รับได้อีก {summary.remainingGrams} กรัม</span>
                )}
              </p>
            </div>
          </div>

          {summary.meals.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {summary.meals.map((meal) => (
                <li
                  key={meal.id}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-muted"
                >
                  {MEAL_LABELS[meal.mealType] ?? meal.mealType}{' '}
                  <span className="tabular font-medium text-foreground">
                    {meal.subtotalGrams} ก.
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href={mealsHref}
            className="mt-auto flex items-center justify-center rounded-xl bg-brand px-4 py-4 pt-4 text-base font-semibold text-white transition hover:opacity-90"
          >
            + เพิ่มอาหาร
          </Link>
        </section>
      </div>

      {/* สรุปสัปดาห์แบบย่อ กดเข้าไปดูเต็มได้ */}
      <Link
        href={weeklyHref}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-sm transition hover:bg-background"
      >
        <Badge
          tone={
            weekly.verdict.level === 'DANGER'
              ? 'danger'
              : weekly.verdict.level === 'WARN'
                ? 'warn'
                : 'ok'
          }
        >
          {weekly.verdict.headline}
        </Badge>
        <span className="text-muted">{weekly.verdict.detail}</span>
        <span className="tabular ml-auto text-muted">
          เฉลี่ย {weekly.averageConsumedGrams} ก./วัน · เกินเป้า {weekly.daysOverTarget}/
          {weekly.daysEvaluated} วัน →
        </span>
      </Link>
    </div>
  )
}
