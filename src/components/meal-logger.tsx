'use client'

import { useRef, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select } from '@/components/ui'
import { request } from '@/lib/client/api'

type FoodUnit = { id: string; unitName: string; proteinAmount: number }
type Food = { id: string; name: string; units: FoodUnit[] }

type Summary = {
  date: string
  targetGrams: number | null
  consumedGrams: number
  remainingGrams: number | null
  meals: {
    id: string
    mealType: string
    subtotalGrams: number
    items: {
      id: string
      foodName: string
      unitName: string
      quantity: number
      proteinAmount: number
    }[]
  }[]
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'มื้อเช้า' },
  { value: 'LUNCH', label: 'มื้อกลางวัน' },
  { value: 'DINNER', label: 'มื้อเย็น' },
  { value: 'SNACK', label: 'ของว่าง' },
]

export function MealLogger({
  initialDate,
  initialSummary,
}: {
  initialDate: string
  initialSummary: Summary
}) {
  const [date, setDate] = useState(initialDate)
  const [mealType, setMealType] = useState('BREAKFAST')
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
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
    const data = await run(() => request<{ summary: Summary }>(`/api/meals?date=${nextDate}`))
    if (data) setSummary(data.summary)
  }

  // debounce แบบ event-driven ไม่ทำใน useEffect เพื่อเลี่ยง cascading render
  function changeQuery(nextQuery: string) {
    setQuery(nextQuery)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (nextQuery.trim().length < 1) {
      setFoods([])
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
      }
    }, 250)
  }

  const units = foods.flatMap((food) =>
    food.units.map((unit) => ({ ...unit, foodName: food.name })),
  )
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
    }
  }

  async function removeItem(itemId: string) {
    if (!window.confirm('ลบรายการนี้?')) return
    const data = await run(() =>
      request<{ summary: Summary }>(`/api/meals/items/${itemId}`, {
        method: 'DELETE',
      }),
    )
    if (data) setSummary(data.summary)
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
