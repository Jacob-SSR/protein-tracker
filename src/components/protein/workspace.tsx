'use client'

import { useRef, useState } from 'react'
import { Alert, Badge, Button, Field, Input, Modal, Select } from '@/components/ui'
import { IconMeal, IconSearch } from '@/components/icons'
import { ProgressGauge } from '@/components/protein/gauge'
import { WeeklyChart } from '@/components/protein/weekly-chart'
import { toSpoonDisplay, type SpoonDisplay } from '@/lib/protein/spoons'
import { request } from '@/lib/client/api'

type Summary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  percent: number | null
  notification: { level: 'INFO' | 'WARN' | 'DANGER'; message: string } | null
  energy: {
    targetKcal: number | null
    consumedKcal: number
    itemsWithoutEnergy: number
  }
  meals: {
    id: string
    mealType: string
    subtotalGrams: number
    subtotalKcal: number
    items: {
      id: string
      foodName: string
      unitName: string
      quantity: number
      proteinAmount: number
    }[]
  }[]
}

type Weekly = {
  from: string
  to: string
  days: { date: string; targetGrams: number | null; consumedGrams: number }[]
  averageConsumedGrams: number
  daysOverTarget: number
  daysEvaluated: number
  verdict: { level: 'OK' | 'WARN' | 'DANGER'; headline: string; detail: string }
}

type FrequentFood = { unitId: string; foodName: string; unitName: string; proteinAmount: number }
type FoodHit = {
  id: string
  name: string
  units: { id: string; unitName: string; proteinAmount: number }[]
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'มื้อเช้า', icon: '🌤️' },
  { value: 'LUNCH', label: 'มื้อกลางวัน', icon: '☀️' },
  { value: 'DINNER', label: 'มื้อเย็น', icon: '🌙' },
  { value: 'SNACK', label: 'ของว่าง', icon: '🍎' },
]

const mealLabel = (type: string) => MEAL_TYPES.find((item) => item.value === type)?.label ?? type
const mealIcon = (type: string) => MEAL_TYPES.find((item) => item.value === type)?.icon ?? '🍽️'

export function ProteinWorkspace({
  initialDate,
  initialSummary,
  weekly,
  frequentFoods,
  referenceWeightKg,
  weightBasisLabel,
  /** ตั้งค่าเมื่อเจ้าหน้าที่บันทึกแทนผู้ป่วย */
  patientId,
  weeklyHref,
}: {
  initialDate: string
  initialSummary: Summary
  weekly: Weekly
  frequentFoods: FrequentFood[]
  referenceWeightKg: number | null
  weightBasisLabel: string | null
  patientId?: string
  weeklyHref: string
}) {
  const scope = patientId ? `&patientId=${patientId}` : ''
  const [date, setDate] = useState(initialDate)
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [mealType, setMealType] = useState('BREAKFAST')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [searching, setSearching] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [unitId, setUnitId] = useState('')
  const [editing, setEditing] = useState<{ id: string; quantity: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function run<T>(action: () => Promise<T>) {
    setError(null)
    setPending(true)
    try {
      return await action()
    } catch (cause) {
      setError((cause as Error).message)
      return null
    } finally {
      setPending(false)
    }
  }

  async function changeDate(next: string) {
    setDate(next)
    const data = await run(() => request<{ summary: Summary }>(`/api/meals?date=${next}${scope}`))
    if (data) setSummary(data.summary)
  }

  // debounce แบบ event-driven ไม่ทำใน useEffect เพื่อเลี่ยง cascading render
  function changeQuery(next: string) {
    setQuery(next)
    setUnitId('')
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (next.trim().length < 1) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await request<{ foods: FoodHit[] }>(`/api/foods?q=${encodeURIComponent(next)}`)
        setHits(data.foods)
      } catch (cause) {
        setError((cause as Error).message)
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  async function addItem(foodUnitId: string, qty: number) {
    const data = await run(() =>
      request<{ summary: Summary }>('/api/meals', {
        method: 'POST',
        json: { mealDate: date, mealType, foodUnitId, quantity: qty, patientId },
      }),
    )
    if (data) {
      setSummary(data.summary)
      setQuantity('1')
      setQuery('')
      setHits([])
      setUnitId('')
      setAdding(false)
    }
  }

  async function saveEdit() {
    if (!editing) return
    const data = await run(() =>
      request<{ summary: Summary }>(`/api/meals/items/${editing.id}`, {
        method: 'PATCH',
        json: { quantity: Number(editing.quantity) },
      }),
    )
    if (data) {
      setSummary(data.summary)
      setEditing(null)
    }
  }

  async function removeItem(itemId: string) {
    const data = await run(() =>
      request<{ summary: Summary }>(`/api/meals/items/${itemId}`, { method: 'DELETE' }),
    )
    if (data) setSummary(data.summary)
  }

  const units = hits.flatMap((food) => food.units.map((unit) => ({ ...unit, foodName: food.name })))
  const over = summary.remainingGrams !== null && summary.remainingGrams < 0

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        {/* การ์ดสถิติ 3 ใบ */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            tone="brand"
            label="เป้าหมายโปรตีนต่อวัน"
            value={toSpoonDisplay(summary.targetGrams)}
            unit="ช้อน/วัน"
            note={
              summary.targetGrams === null
                ? 'ยังไม่ได้กำหนดเป้าหมาย'
                : `${summary.targetGrams} กรัม · คำนวณจาก${weightBasisLabel ?? 'น้ำหนัก'} ${referenceWeightKg ?? '—'} กก.`
            }
          />
          <StatCard
            tone="info"
            label="โปรตีนที่รับประทานไป"
            value={toSpoonDisplay(summary.consumedGrams)}
            unit="ช้อน"
            note={
              summary.percent !== null
                ? `${summary.consumedGrams} กรัม · ${Math.round(summary.percent)}% ของเป้าหมาย`
                : `${summary.consumedGrams} กรัม`
            }
          />
          <StatCard
            tone={over ? 'danger' : 'accent'}
            label={over ? 'โปรตีนที่เกิน' : 'โปรตีนที่เหลือ'}
            value={toSpoonDisplay(
              summary.remainingGrams === null ? null : Math.abs(summary.remainingGrams),
            )}
            unit="ช้อน"
            note={
              summary.remainingGrams === null
                ? '—'
                : `${Math.abs(summary.remainingGrams)} กรัม · ${over ? 'เกินเป้าหมายแล้ว' : 'รับได้อีก'}`
            }
          />
        </div>

        {/* บันทึกอาหารของวัน */}
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 className="font-medium">บันทึกอาหารวันนี้</h2>
              <Input
                type="date"
                value={date}
                onChange={(event) => void changeDate(event.target.value)}
                className="h-8 py-1 text-xs"
              />
            </div>
            <Button onClick={() => setAdding((current) => !current)}>
              {adding ? 'ปิด' : '+ เพิ่มมื้ออาหาร'}
            </Button>
          </header>

          {adding ? (
            <div className="flex flex-col gap-3 border-b border-line bg-brand-tint p-4">
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_6rem]">
                <Field label="มื้อ">
                  <Select value={mealType} onChange={(event) => setMealType(event.target.value)}>
                    {MEAL_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="ค้นหาอาหาร" hint={searching ? 'กำลังค้นหา...' : undefined}>
                  <Input
                    value={query}
                    onChange={(event) => changeQuery(event.target.value)}
                    placeholder="เช่น ไข่ อกไก่ นม"
                  />
                </Field>
                <Field label="จำนวน">
                  <Input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="tabular"
                  />
                </Field>
              </div>

              {query.trim() && !searching && units.length === 0 ? (
                <Alert tone="warn">ไม่พบอาหารนี้ — เสนอเข้าระบบได้ที่เมนูรายการอาหาร</Alert>
              ) : null}

              {units.length > 0 ? (
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {units.map((unit) => (
                    <li key={unit.id}>
                      <button
                        type="button"
                        onClick={() => setUnitId(unit.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                          unitId === unit.id
                            ? 'border-brand bg-brand-soft'
                            : 'border-line bg-surface hover:bg-background'
                        }`}
                      >
                        <span>
                          {unit.foodName} · {unit.unitName}
                        </span>
                        <span className="tabular text-muted">{unit.proteinAmount} g</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {error ? <Alert>{error}</Alert> : null}

              <Button
                className="self-start"
                disabled={pending || !unitId || !(Number(quantity) > 0)}
                onClick={() => addItem(unitId, Number(quantity))}
              >
                เพิ่มลงมื้อ{mealLabel(mealType)}
                {unitId
                  ? ` · ${Math.round((units.find((u) => u.id === unitId)?.proteinAmount ?? 0) * Number(quantity) * 100) / 100} g`
                  : ''}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 p-4">
            {summary.meals.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                ยังไม่มีรายการของวันนี้
              </p>
            ) : (
              summary.meals.map((meal) => (
                <div key={meal.id} className="overflow-hidden rounded-xl border border-line">
                  <div className="flex items-center justify-between bg-background px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span aria-hidden>{mealIcon(meal.mealType)}</span>
                      {mealLabel(meal.mealType)}
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {meal.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                      >
                        <span className="min-w-32 flex-1 font-medium">{item.foodName}</span>
                        <span className="w-32 text-muted">
                          {item.quantity} × {item.unitName}
                        </span>
                        <span className="w-20 text-right tabular font-medium">
                          {toSpoonDisplay(item.proteinAmount).text} ช้อน
                        </span>
                        <span className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            className="px-2 py-1"
                            onClick={() =>
                              setEditing({ id: item.id, quantity: String(item.quantity) })
                            }
                          >
                            แก้ไข
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1"
                            onClick={() => removeItem(item.id)}
                            disabled={pending}
                          >
                            ลบ
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between bg-brand-tint px-3 py-2 text-sm">
                    <span className="text-muted">รวม{mealLabel(meal.mealType)}</span>
                    <span className="tabular font-medium text-brand">
                      {meal.subtotalGrams} g
                      {meal.subtotalKcal > 0 ? (
                        <span className="ml-2 font-normal text-muted">
                          {meal.subtotalKcal.toLocaleString('th-TH')} kcal
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              ))
            )}

            <div className="rounded-xl bg-brand-soft px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">รวมทั้งวัน</span>
                <span className="tabular text-lg font-semibold text-brand">
                  {summary.consumedGrams} g
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted">พลังงาน</span>
                <span className="tabular text-muted">
                  {summary.energy.consumedKcal.toLocaleString('th-TH')}
                  {summary.energy.targetKcal !== null
                    ? ` / ${summary.energy.targetKcal.toLocaleString('th-TH')}`
                    : ''}{' '}
                  kcal
                </span>
              </div>
              {summary.energy.itemsWithoutEnergy > 0 ? (
                <p className="mt-1 text-xs text-warn">
                  ยังไม่นับพลังงานของ {summary.energy.itemsWithoutEnergy} รายการ —
                  อาหารเหล่านั้นยังไม่ได้ใส่ค่า kcal ไว้ในระบบ
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* คอลัมน์ขวา */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 font-medium">ความคืบหน้าของวันนี้</h2>
          <ProgressGauge consumed={summary.consumedGrams} target={summary.targetGrams} />
          {summary.notification ? (
            <div className="mt-3">
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
                {summary.remainingGrams !== null
                  ? summary.remainingGrams >= 0
                    ? ` — เหลืออีก ${summary.remainingGrams} g`
                    : ` — เกินมาแล้ว ${Math.abs(summary.remainingGrams)} g`
                  : ''}
              </Alert>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 font-medium">เพิ่มอาหารเร็ว</h2>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch />
            </span>
            <Input
              value={query}
              onChange={(event) => {
                setAdding(true)
                changeQuery(event.target.value)
              }}
              placeholder="ค้นหาอาหาร (เช่น ไข่, อกไก่, นม)"
              className="w-full pl-9"
            />
          </div>

          <p className="mt-3 mb-2 text-xs text-muted">อาหารที่พบบ่อย</p>
          <div className="flex flex-wrap gap-2">
            {frequentFoods.length === 0 ? (
              <p className="text-xs text-muted">
                ยังไม่มีข้อมูล — บันทึกสักสองสามครั้งแล้วจะขึ้นเอง
              </p>
            ) : (
              frequentFoods.map((food) => (
                <button
                  key={food.unitId}
                  type="button"
                  disabled={pending}
                  onClick={() => addItem(food.unitId, 1)}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs transition hover:border-brand hover:bg-brand-soft disabled:opacity-50"
                >
                  <span className="block font-medium">{food.foodName}</span>
                  <span className="block tabular text-muted">
                    {food.proteinAmount} g/{food.unitName}
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            กดปุ่มลัดเพื่อเพิ่ม 1 หน่วยลงมื้อ{mealLabel(mealType)}
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-medium">สรุปแบบรายสัปดาห์</h2>
          <p className="mb-3 text-xs text-muted">
            {weekly.from} — {weekly.to}
          </p>

          <WeeklyChart days={weekly.days} targetGrams={summary.targetGrams} />

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-ok-soft px-2 py-2">
              <p className="text-[11px] text-ok">อยู่ในเป้าหมาย</p>
              <p className="tabular font-semibold">
                {Math.max(weekly.daysEvaluated - weekly.daysOverTarget, 0)} วัน
              </p>
            </div>
            <div className="rounded-lg bg-danger-soft px-2 py-2">
              <p className="text-[11px] text-danger">เกินเป้าหมาย</p>
              <p className="tabular font-semibold">{weekly.daysOverTarget} วัน</p>
            </div>
            <div className="rounded-lg bg-background px-2 py-2">
              <p className="text-[11px] text-muted">เฉลี่ยต่อวัน</p>
              <p className="tabular font-semibold">{weekly.averageConsumedGrams} g</p>
            </div>
          </div>

          <div className="mt-3">
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
          </div>

          <a
            href={weeklyHref}
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <IconMeal className="h-4 w-4" />
            ดูรายงานสรุปทั้งหมด
          </a>
        </section>
      </aside>

      {editing ? (
        <Modal
          title="แก้ไขจำนวน"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button onClick={saveEdit} disabled={pending}>
                บันทึก
              </Button>
            </>
          }
        >
          <Field label="จำนวน">
            <Input
              type="number"
              min="0.25"
              step="0.25"
              value={editing.quantity}
              onChange={(event) => setEditing({ id: editing.id, quantity: event.target.value })}
              className="tabular"
            />
          </Field>
          {error ? (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}

function StatCard({
  tone,
  label,
  value,
  unit,
  note,
}: {
  tone: 'brand' | 'info' | 'accent' | 'danger'
  label: string
  value: SpoonDisplay
  unit: string
  note: string
}) {
  const styles = {
    brand: 'bg-brand-tint text-brand',
    info: 'bg-info-soft text-info',
    accent: 'bg-accent-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  }[tone]

  return (
    <div className={`rounded-xl border border-line p-4 ${styles}`}>
      <p className="text-xs opacity-90">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        {value.value === null ? (
          <span className="text-lg font-medium text-muted">ยังไม่มีข้อมูล</span>
        ) : (
          <>
            <span className="text-3xl font-semibold">{value.text}</span>
            <span className="text-xs">{unit}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        {note}
        {value.rounded ? ' · ปัดเป็นปริมาณที่ตวงได้ง่าย' : ''}
      </p>
    </div>
  )
}
