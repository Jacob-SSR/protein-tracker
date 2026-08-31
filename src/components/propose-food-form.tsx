'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, RequiredLegend } from '@/components/ui'
import {
  FoodUnitFields,
  emptyUnit,
  toUnitPayload,
  unitsHaveErrors,
  type UnitDraft,
} from '@/components/food-unit-fields'
import { request } from '@/lib/client/api'
import { optionalText, requiredText } from '@/lib/validate'

export function ProposeFoodForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [units, setUnits] = useState<UnitDraft[]>([{ ...emptyUnit(), isDefault: true }])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await request('/api/foods', {
        method: 'POST',
        json: {
          name: name.trim(),
          category: category.trim() || undefined,
          units: toUnitPayload(units),
        },
      })
      setName('')
      setCategory('')
      setUnits([{ ...emptyUnit(), isDefault: true }])
      setNotice('ส่งให้แอดมินตรวจสอบแล้ว — จะใช้บันทึกอาหารได้เมื่ออนุมัติ')
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card title="เสนออาหารเข้าระบบ">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <RequiredLegend />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ชื่ออาหาร" required error={requiredText(name, 'ชื่ออาหาร', 200)}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น ปลาทูนึ่ง"
            />
          </Field>
          <Field label="หมวด" hint="ไม่บังคับ" error={optionalText(category, 'หมวด', 100)}>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} />
          </Field>
        </div>

        <FoodUnitFields units={units} onChange={setUnits} />

        <p className="text-xs text-muted">
          ถ้าไม่ทราบค่าโปรตีน ใส่เท่าที่ทราบได้เลย แอดมินจะตรวจสอบและแก้ให้ก่อนอนุมัติ
        </p>

        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}

        <Button
          type="submit"
          disabled={
            pending ||
            requiredText(name, 'ชื่ออาหาร', 200) !== null ||
            optionalText(category, 'หมวด', 100) !== null ||
            unitsHaveErrors(units)
          }
          className="self-start"
        >
          ส่งให้แอดมินตรวจสอบ
        </Button>
      </form>
    </Card>
  )
}
