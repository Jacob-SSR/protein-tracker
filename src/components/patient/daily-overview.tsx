import Link from 'next/link'
import { Badge } from '@/components/ui'
import { ProgressRing } from '@/components/progress-ring'
import { WaterCard, type WaterSummary } from '@/components/water/water-card'
import { toSpoonDisplay } from '@/lib/protein/spoons'

type Energy = {
  targetKcal: number | null
  consumedKcal: number
  remainingKcal: number | null
  percent: number | null
  itemsWithoutEnergy: number
}

type Summary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  percent: number | null
  notification: { level: 'INFO' | 'WARN' | 'DANGER'; message: string } | null
  energy: Energy
  meals: { id: string; mealType: string; subtotalGrams: number; items: { id: string }[] }[]
}

export type BodySnapshot = {
  bmi: number | null
  bmiLabel: string | null
  weightKg: number | null
  heightCm: number | null
  energyTargetKcal: number | null
  /** วันที่ตรวจล่าสุด — บอกให้รู้ว่าตัวเลขพวกนี้เก่าแค่ไหน */
  measuredOn: string | null
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
  body,
  mealsHref,
  weeklyHref,
  assessmentHref,
}: {
  greetingName: string
  todayLabel: string
  summary: Summary
  weekly: Weekly
  water: WaterSummary
  body: BodySnapshot
  mealsHref: string
  weeklyHref: string
  assessmentHref: string
}) {
  const over = summary.remainingGrams !== null && summary.remainingGrams < 0
  const itemCount = summary.meals.reduce((total, meal) => total + meal.items.length, 0)
  // โปรตีนโชว์เป็นช้อนที่ตวงได้จริง (ปัดเป็นจำนวนเต็ม/เศษ ¼) ส่วนกรัมยังเป็นหน่วยที่ระบบคำนวณ
  const consumed = toSpoonDisplay(summary.consumedGrams)
  const target = toSpoonDisplay(summary.targetGrams)
  const remaining = toSpoonDisplay(
    summary.remainingGrams === null ? null : Math.abs(summary.remainingGrams),
  )

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

      <BodyStrip body={body} energy={summary.energy} assessmentHref={assessmentHref} />

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
              ariaLabel={`ทานโปรตีนแล้ว ${consumed.text} จากเป้าหมาย ${target.text} ช้อน`}
            />
            <div className="min-w-40 flex-1">
              <p className="flex items-baseline gap-1.5">
                <span aria-hidden>🥄</span>
                <span className="text-4xl font-semibold text-brand">{consumed.text}</span>
                <span className="text-lg text-muted">/ {target.text} ช้อน</span>
              </p>
              <p className="tabular mt-0.5 text-xs text-muted">
                {summary.consumedGrams} / {summary.targetGrams ?? '—'} กรัม
                {consumed.rounded || target.rounded ? ' · ปัดเป็นปริมาณที่ตวงได้ง่าย' : ''}
              </p>
              <p className="mt-2 text-sm">
                {summary.remainingGrams === null ? (
                  <span className="text-muted">รอเจ้าหน้าที่ประเมินเพื่อรับเป้าหมาย</span>
                ) : over ? (
                  <span className="text-danger">ทานเกินมาแล้วประมาณ {remaining.text} ช้อน</span>
                ) : (
                  <span className="text-muted">ทานได้อีกประมาณ {remaining.text} ช้อน</span>
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
                  <span className="font-medium text-foreground">
                    {toSpoonDisplay(meal.subtotalGrams).text} ช้อน
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

/**
 * แถบสรุปร่างกาย — BMI / น้ำหนัก / ส่วนสูง / พลังงานที่ต้องการ
 * ตัวเลขมาจากผลตรวจล่าสุดที่เจ้าหน้าที่บันทึกไว้ ผู้ป่วยแก้เองไม่ได้
 */
function BodyStrip({
  body,
  energy,
  assessmentHref,
}: {
  body: BodySnapshot
  energy: Energy
  assessmentHref: string
}) {
  const empty = body.bmi === null && body.weightKg === null && body.energyTargetKcal === null

  if (empty) {
    return (
      <Link
        href={assessmentHref}
        className="rounded-2xl border border-dashed border-line bg-surface p-4 text-sm text-muted transition hover:bg-background"
      >
        ยังไม่มีผลตรวจ — เจ้าหน้าที่โภชนาการจะบันทึกให้เมื่อคุณเข้ารับการตรวจ · ดูรายละเอียด →
      </Link>
    )
  }

  return (
    <Link
      href={assessmentHref}
      className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:bg-background sm:grid-cols-2 lg:grid-cols-4"
    >
      <Stat label="BMI" value={body.bmi} note={body.bmiLabel} />
      <Stat label="น้ำหนัก" value={body.weightKg} unit="กก." />
      <Stat label="ส่วนสูง" value={body.heightCm} unit="ซม." />
      <EnergyStat energy={energy} measuredOn={body.measuredOn} />
    </Link>
  )
}

/**
 * พลังงานวันนี้ — เดินขึ้นตามอาหารที่บันทึก ไม่ใช่ตัวเลขเป้าหมายนิ่งๆ
 *
 * รวมเฉพาะรายการที่มีข้อมูล kcal อาหารที่เจ้าหน้าที่ยังไม่ได้ใส่พลังงานจะไม่ถูกเดาค่าให้
 * และบอกไว้ตรงๆ ว่ายังไม่นับกี่รายการ ผู้ป่วยจะได้ไม่เข้าใจว่าตัวเองทานน้อยกว่าที่ทานจริง
 */
function EnergyStat({ energy, measuredOn }: { energy: Energy; measuredOn: string | null }) {
  const percent = energy.percent === null ? null : Math.min(energy.percent, 100)
  const over = energy.remainingKcal !== null && energy.remainingKcal < 0

  return (
    <div>
      <p className="text-xs text-muted">พลังงานวันนี้</p>
      <p className="tabular text-xl font-semibold">
        <span className={over ? 'text-danger' : undefined}>
          {energy.consumedKcal.toLocaleString('th-TH')}
        </span>
        <span className="text-xs font-normal text-muted">
          {' / '}
          {energy.targetKcal === null ? '—' : energy.targetKcal.toLocaleString('th-TH')} kcal
        </span>
      </p>

      {percent === null ? (
        <p className="text-xs text-muted">
          {energy.targetKcal === null ? 'รอเจ้าหน้าที่กำหนดพลังงาน' : ''}
        </p>
      ) : (
        <>
          <span
            className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-background"
            aria-hidden
          >
            <span
              className={`block h-full rounded-full ${over ? 'bg-danger' : 'bg-brand'}`}
              style={{ width: `${percent}%` }}
            />
          </span>
          <p className="tabular text-xs text-muted">
            {over
              ? `เกินมา ${Math.abs(energy.remainingKcal ?? 0).toLocaleString('th-TH')} kcal`
              : `เหลืออีก ${(energy.remainingKcal ?? 0).toLocaleString('th-TH')} kcal`}
          </p>
        </>
      )}

      {energy.itemsWithoutEnergy > 0 ? (
        <p className="text-xs text-warn">
          ยังไม่นับ {energy.itemsWithoutEnergy} รายการ (อาหารยังไม่มีข้อมูลพลังงาน)
        </p>
      ) : measuredOn ? (
        <p className="text-xs text-muted">ตรวจ {measuredOn}</p>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number | null
  unit?: string
  note?: string | null
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular text-xl font-semibold">
        {value === null ? '—' : value.toLocaleString('th-TH')}
        {value !== null && unit ? (
          <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
        ) : null}
      </p>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  )
}
