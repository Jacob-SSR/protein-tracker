'use client'

import { useRef, useState } from 'react'
<<<<<<< HEAD
<<<<<<< HEAD

type FoodUnit = { id: string; unitName: string; proteinAmount: number }
type Food = { id: string; name: string; units: FoodUnit[] }
=======
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from '@/components/ui'
import { request } from '@/lib/client/api'

type FoodUnit = { id: string; unitName: string; proteinAmount: number }
type Food = { id: string; name: string; units: FoodUnit[] }

>>>>>>> claude/manage-patch-file-83l9qf
=======

type FoodUnit = { id: string; unitName: string; proteinAmount: number }
type Food = { id: string; name: string; units: FoodUnit[] }
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
type Summary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
<<<<<<< HEAD
<<<<<<< HEAD
=======
  percent: number | null
  notification: { level: 'INFO' | 'WARN' | 'DANGER'; message: string } | null
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  meals: {
    id: string
    mealType: string
    subtotalGrams: number
<<<<<<< HEAD
<<<<<<< HEAD
    items: { id: string; foodName: string; unitName: string; quantity: number; proteinAmount: number }[]
=======
    items: {
      id: string
      foodName: string
      unitName: string
      quantity: number
      proteinAmount: number
    }[]
>>>>>>> claude/manage-patch-file-83l9qf
=======
    items: { id: string; foodName: string; unitName: string; quantity: number; proteinAmount: number }[]
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  }[]
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'มื้อเช้า' },
  { value: 'LUNCH', label: 'มื้อกลางวัน' },
  { value: 'DINNER', label: 'มื้อเย็น' },
  { value: 'SNACK', label: 'ของว่าง' },
]

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
async function readJson(response: Response) {
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message ?? 'เกิดข้อผิดพลาด')
  return payload.data
}

export function MealLogger({
  initialDate,
  initialSummary,
}: {
  initialDate: string
  initialSummary: Summary
}) {
<<<<<<< HEAD
=======
export function MealLogger({
  initialDate,
  initialSummary,
  /** ตั้งค่าเมื่อเจ้าหน้าที่บันทึกแทนผู้ป่วย — ฝั่งผู้ป่วยเองไม่ต้องส่ง (API บังคับเป็นของตัวเองอยู่แล้ว) */
  patientId,
}: {
  initialDate: string
  initialSummary: Summary
  patientId?: string
}) {
  const scope = patientId ? `&patientId=${patientId}` : ''
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  const [date, setDate] = useState(initialDate)
  const [mealType, setMealType] = useState('BREAKFAST')
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function changeDate(nextDate: string) {
    setDate(nextDate)
    setError(null)
    try {
      const data = await readJson(await fetch(`/api/meals?date=${nextDate}`))
      setSummary(data.summary)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  // debounce การค้นหาแบบ event-driven (ไม่ทำใน useEffect เพื่อเลี่ยง cascading render)
<<<<<<< HEAD
=======
  const [searching, setSearching] = useState(false)
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [editing, setEditing] = useState<{
    id: string
    quantity: string
  } | null>(null)
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

  async function changeDate(nextDate: string) {
    setDate(nextDate)
    const data = await run(() =>
      request<{ summary: Summary }>(`/api/meals?date=${nextDate}${scope}`),
    )
    if (data) setSummary(data.summary)
  }

  // debounce แบบ event-driven ไม่ทำใน useEffect เพื่อเลี่ยง cascading render
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  function changeQuery(nextQuery: string) {
    setQuery(nextQuery)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (nextQuery.trim().length < 1) {
      setFoods([])
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await readJson(await fetch(`/api/foods?q=${encodeURIComponent(nextQuery)}`))
        setFoods(data.foods)
      } catch (cause) {
        setError((cause as Error).message)
<<<<<<< HEAD
=======
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await request<{ foods: Food[] }>(
          `/api/foods?q=${encodeURIComponent(nextQuery)}`,
        )
        setFoods(data.foods)
      } catch (cause) {
        setError((cause as Error).message)
      } finally {
        setSearching(false)
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
      }
    }, 250)
  }

  const units = foods.flatMap((food) =>
    food.units.map((unit) => ({ ...unit, foodName: food.name })),
  )
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f

  async function addItem(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const data = await readJson(
        await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mealDate: date,
            mealType,
            foodUnitId: unitId,
            quantity: Number(quantity),
          }),
        }),
      )
      setSummary(data.summary)
      setQuantity('1')
    } catch (cause) {
      setError((cause as Error).message)
<<<<<<< HEAD
=======
  const selectedUnit = units.find((unit) => unit.id === unitId)
  const preview =
    selectedUnit && Number(quantity) > 0
      ? Math.round(selectedUnit.proteinAmount * Number(quantity) * 100) / 100
      : null

  async function addItem(event: React.FormEvent) {
    event.preventDefault()
    const data = await run(() =>
      request<{ summary: Summary }>('/api/meals', {
        method: 'POST',
        json: {
          mealDate: date,
          mealType,
          foodUnitId: unitId,
          quantity: Number(quantity),
          patientId,
        },
      }),
    )
    if (data) {
      setSummary(data.summary)
      setQuantity('1')
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
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
    }
  }

  async function removeItem(itemId: string) {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
    setError(null)
    try {
      const data = await readJson(await fetch(`/api/meals/items/${itemId}`, { method: 'DELETE' }))
      setSummary(data.summary)
    } catch (cause) {
      setError((cause as Error).message)
    }
<<<<<<< HEAD
=======
    if (!window.confirm('ลบรายการนี้?')) return
    const data = await run(() =>
      request<{ summary: Summary }>(`/api/meals/items/${itemId}`, {
        method: 'DELETE',
      }),
    )
    if (data) setSummary(data.summary)
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
  }

  return (
    <div className="flex flex-col gap-4">
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
      <form onSubmit={addItem} className="flex flex-col gap-3 rounded border p-3">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            วันที่
            <input
              type="date"
              value={date}
              onChange={(event) => void changeDate(event.target.value)}
              className="rounded border p-2"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            มื้อ
            <select
              value={mealType}
              onChange={(event) => setMealType(event.target.value)}
              className="rounded border p-2"
            >
              {MEAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          ค้นหาอาหาร
          <input
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="เช่น อกไก่"
            className="rounded border p-2"
          />
        </label>

        {query.trim() && units.length === 0 ? (
          <p className="text-sm text-gray-500">
            ไม่พบอาหารนี้ — เสนอเข้าระบบได้ที่หน้า &quot;เสนออาหารใหม่&quot; แล้วรอแอดมินอนุมัติ
          </p>
        ) : null}

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            อาหาร / หน่วย
            <select
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              required
              className="rounded border p-2"
            >
              <option value="">เลือกรายการ</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.foodName} — {unit.unitName} ({unit.proteinAmount} g)
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-28 flex-col gap-1 text-sm">
            จำนวน
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="rounded border p-2"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" className="rounded bg-black p-2 text-white">
          เพิ่มรายการ
        </button>
      </form>

      <section className="flex flex-col gap-3">
          <p className="text-sm">
            รวมวันที่ {summary.date}: <strong>{summary.consumedGrams} g</strong>
            {summary.targetGrams !== null ? ` / เป้าหมาย ${summary.targetGrams} g` : ''}
          </p>
          {summary.meals.map((meal) => (
            <div key={meal.id} className="rounded border p-3 text-sm">
              <div className="flex justify-between font-medium">
                <span>{MEAL_TYPES.find((type) => type.value === meal.mealType)?.label}</span>
                <span>{meal.subtotalGrams} g</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>
                      {item.foodName} · {item.quantity} {item.unitName} · {item.proteinAmount} g
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 underline"
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>
<<<<<<< HEAD
=======
      <Card title="เพิ่มรายการอาหาร">
        <form onSubmit={addItem} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="วันที่">
              <Input
                type="date"
                value={date}
                onChange={(event) => void changeDate(event.target.value)}
              />
            </Field>
            <Field label="มื้อ">
              <Select value={mealType} onChange={(event) => setMealType(event.target.value)}>
                {MEAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="ค้นหาอาหาร" hint={searching ? 'กำลังค้นหา...' : undefined}>
            <Input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="เช่น อกไก่"
            />
          </Field>

          {query.trim() && !searching && units.length === 0 ? (
            <Alert tone="warn">
              ไม่พบอาหารนี้ในระบบ — เสนอเข้าระบบได้ที่เมนู &quot;เสนออาหารใหม่&quot;
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Field label="อาหาร / หน่วย">
              <Select
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                required
                disabled={units.length === 0}
              >
                <option value="">{units.length === 0 ? 'ค้นหาอาหารก่อน' : 'เลือกรายการ'}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.foodName} — {unit.unitName} ({unit.proteinAmount} g)
                  </option>
                ))}
              </Select>
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

          {preview !== null ? (
            <p className="text-sm text-muted">
              จะได้โปรตีน <strong className="tabular text-foreground">{preview} g</strong>
            </p>
          ) : null}

          {error ? <Alert>{error}</Alert> : null}

          <Button type="submit" disabled={pending || !unitId} className="self-start">
            เพิ่มรายการ
          </Button>
        </form>
      </Card>

      {/* เตือนโควต้าทันทีหลังบันทึก ไม่ต้องกลับไปดูหน้าสรุป */}
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
          {summary.remainingGrams !== null
            ? summary.remainingGrams >= 0
              ? ` — วันนี้เหลืออีก ${summary.remainingGrams} g`
              : ` — เกินมาแล้ว ${Math.abs(summary.remainingGrams)} g`
            : ''}
        </Alert>
      ) : null}

      <Card
        title={`สรุปวันที่ ${summary.date}`}
        actions={
          <Badge
            tone={
              summary.remainingGrams !== null && summary.remainingGrams < 0 ? 'danger' : 'brand'
            }
          >
            {summary.consumedGrams} g
            {summary.targetGrams !== null ? ` / ${summary.targetGrams} g` : ''}
          </Badge>
        }
      >
        {summary.meals.length === 0 ? (
          <EmptyState>ยังไม่มีรายการของวันนี้</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {summary.meals.map((meal) => (
              <li key={meal.id} className="rounded-lg border border-line p-3">
                <div className="flex justify-between text-sm font-medium">
                  <span>{MEAL_TYPES.find((type) => type.value === meal.mealType)?.label}</span>
                  <span className="tabular">{meal.subtotalGrams} g</span>
                </div>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {meal.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      {editing?.id === item.id ? (
                        <>
                          <span className="text-muted">
                            {item.foodName} · {item.unitName}
                          </span>
                          <span className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={editing.quantity}
                              onChange={(event) =>
                                setEditing({
                                  id: item.id,
                                  quantity: event.target.value,
                                })
                              }
                              className="w-24 tabular"
                            />
                            <Button onClick={saveEdit} disabled={pending}>
                              บันทึก
                            </Button>
                            <Button variant="ghost" onClick={() => setEditing(null)}>
                              ยกเลิก
                            </Button>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted">
                            {item.foodName} · {item.quantity} × {item.unitName}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="tabular">{item.proteinAmount} g</span>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setEditing({
                                  id: item.id,
                                  quantity: String(item.quantity),
                                })
                              }
                              disabled={pending}
                            >
                              แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                              disabled={pending}
                            >
                              ลบ
                            </Button>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
>>>>>>> claude/manage-patch-file-83l9qf
=======
>>>>>>> f482749cc03eccc456bb0a66cdc83413b42ce71f
    </div>
  )
}
