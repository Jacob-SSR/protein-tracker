'use client'

import { useRef, useState } from 'react'

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
    items: { id: string; foodName: string; unitName: string; quantity: number; proteinAmount: number }[]
  }[]
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', label: 'มื้อเช้า' },
  { value: 'LUNCH', label: 'มื้อกลางวัน' },
  { value: 'DINNER', label: 'มื้อเย็น' },
  { value: 'SNACK', label: 'ของว่าง' },
]

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
  const [date, setDate] = useState(initialDate)
  const [mealType, setMealType] = useState('BREAKFAST')
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
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
  function changeQuery(nextQuery: string) {
    setQuery(nextQuery)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (nextQuery.trim().length < 1) {
      setFoods([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await readJson(await fetch(`/api/foods?q=${encodeURIComponent(nextQuery)}`))
        setFoods(data.foods)
      } catch (cause) {
        setError((cause as Error).message)
      }
    }, 250)
  }

  const units = foods.flatMap((food) =>
    food.units.map((unit) => ({ ...unit, foodName: food.name })),
  )

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
    }
  }

  async function removeItem(itemId: string) {
    setError(null)
    try {
      const data = await readJson(await fetch(`/api/meals/items/${itemId}`, { method: 'DELETE' }))
      setSummary(data.summary)
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
