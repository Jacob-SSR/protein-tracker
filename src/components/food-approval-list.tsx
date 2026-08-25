'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type PendingFood = {
  id: string
  name: string
  category: string | null
  proposedBy: string
  units: { id: string; unitName: string; proteinAmount: number }[]
}

export function FoodApprovalList({ foods }: { foods: PendingFood[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function act(foodId: string, action: 'approve' | 'reject') {
    setError(null)
    const reason = action === 'reject' ? window.prompt('เหตุผลที่ไม่อนุมัติ') : null
    if (action === 'reject' && !reason) return

    const response = await fetch(`/api/foods/${foodId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
    })
    if (!response.ok) {
      const payload = await response.json()
      setError(payload?.error?.message ?? 'ดำเนินการไม่สำเร็จ')
      return
    }
    router.refresh()
  }

  if (foods.length === 0) return <p className="text-sm text-gray-500">ไม่มีรายการรออนุมัติ</p>

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {foods.map((food) => (
        <div key={food.id} className="flex items-start justify-between rounded border p-3 text-sm">
          <div>
            <p className="font-medium">
              {food.name}
              {food.category ? ` · ${food.category}` : ''}
            </p>
            <p className="text-gray-500">เสนอโดย {food.proposedBy}</p>
            <ul className="mt-1 text-gray-600">
              {food.units.map((unit) => (
                <li key={unit.id}>
                  {unit.unitName}: {unit.proteinAmount} g
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => act(food.id, 'approve')}
              className="rounded bg-black px-3 py-1 text-white"
            >
              อนุมัติ
            </button>
            <button
              type="button"
              onClick={() => act(food.id, 'reject')}
              className="rounded border px-3 py-1"
            >
              ไม่อนุมัติ
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
