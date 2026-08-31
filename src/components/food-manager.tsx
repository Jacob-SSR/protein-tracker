'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  RequiredLegend,
} from '@/components/ui'
import {
  FoodUnitFields,
  emptyUnit,
  toUnitPayload,
  unitsHaveErrors,
  type UnitDraft,
} from '@/components/food-unit-fields'
import { request } from '@/lib/client/api'
import { optionalText, requiredText } from '@/lib/validate'

type Status = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED'

type Food = {
  id: string
  name: string
  category: string | null
  description: string | null
  status: Status
  rejectReason: string | null
  proposedBy: string | null
  /** จำนวน MealItem ที่อ้างอาหารนี้ — ถ้ามีแปลว่าลบถาวรไม่ได้ */
  usageCount: number
  units: {
    id: string
    unitName: string
    gramsPerUnit: number | null
    proteinAmount: number
    energyKcal: number | null
    isDefault: boolean
  }[]
}

const TABS: { key: Status; label: string }[] = [
  { key: 'PENDING', label: 'รออนุมัติ' },
  { key: 'ACTIVE', label: 'ใช้งานอยู่' },
  { key: 'REJECTED', label: 'ไม่อนุมัติ' },
  { key: 'ARCHIVED', label: 'เก็บเข้าคลัง' },
]

const STATUS_TONE = {
  PENDING: 'warn',
  ACTIVE: 'ok',
  REJECTED: 'danger',
  ARCHIVED: 'muted',
} as const

export function FoodManager({ foods }: { foods: Food[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Status>(
    foods.some((food) => food.status === 'PENDING') ? 'PENDING' : 'ACTIVE',
  )
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Food | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>, message: string) {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await action()
      setNotice(message)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  const visible = foods
    .filter((food) => food.status === tab)
    .filter((food) => food.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}

      {creating ? (
        <FoodForm
          title="เพิ่มอาหารใหม่"
          onCancel={() => setCreating(false)}
          onSubmit={async (payload) => {
            await run(async () => {
              await request('/api/foods', { method: 'POST', json: payload })
              setCreating(false)
            }, 'เพิ่มอาหารแล้ว')
          }}
          pending={pending}
        />
      ) : null}

      {editing ? (
        <FoodForm
          title={`แก้ไข: ${editing.name}`}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (payload) => {
            await run(async () => {
              await request(`/api/foods/${editing.id}`, {
                method: 'PATCH',
                json: payload,
              })
              setEditing(null)
            }, 'บันทึกการแก้ไขแล้ว')
          }}
          pending={pending}
        />
      ) : null}

      <Card
        title="รายการอาหาร"
        actions={creating ? null : <Button onClick={() => setCreating(true)}>+ เพิ่มอาหาร</Button>}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((item) => {
              const count = foods.filter((food) => food.status === item.key).length
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    tab === item.key
                      ? 'bg-brand-soft font-medium text-brand'
                      : 'text-muted hover:bg-background'
                  }`}
                >
                  {item.label} ({count})
                </button>
              )
            })}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่ออาหาร"
              className="ml-auto w-56"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState>ไม่มีรายการในหมวดนี้</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((food) => (
                <li
                  key={food.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3"
                >
                  <div className="min-w-60 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {food.name}
                      <Badge tone={STATUS_TONE[food.status]}>
                        {TABS.find((item) => item.key === food.status)?.label}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted">
                      {food.category ?? 'ไม่ระบุหมวด'}
                      {food.proposedBy ? ` · เสนอโดย ${food.proposedBy}` : ''}
                      {food.usageCount > 0
                        ? ` · ผู้ป่วยบันทึกไปแล้ว ${food.usageCount} รายการ`
                        : ''}
                      {food.rejectReason ? ` · เหตุผล: ${food.rejectReason}` : ''}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {food.units.map((unit) => (
                        <li
                          key={unit.id}
                          className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm"
                        >
                          <span className="font-medium">{unit.unitName}</span>
                          {unit.gramsPerUnit ? (
                            <span className="text-muted tabular">({unit.gramsPerUnit} g)</span>
                          ) : null}
                          <span className="text-muted tabular">โปรตีน {unit.proteinAmount} g</span>
                          {unit.energyKcal !== null ? (
                            <span className="text-muted tabular">· {unit.energyKcal} kcal</span>
                          ) : null}
                          {unit.isDefault ? <Badge tone="brand">หลัก</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setEditing(food)} disabled={pending}>
                      แก้ไข
                    </Button>
                    {food.status === 'PENDING' ? (
                      <>
                        <Button
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                request(`/api/foods/${food.id}/approve`, {
                                  method: 'POST',
                                }).then(() => undefined),
                              'อนุมัติแล้ว',
                            )
                          }
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          variant="danger"
                          disabled={pending}
                          onClick={() => {
                            const reason = window.prompt('เหตุผลที่ไม่อนุมัติ')
                            if (!reason) return
                            run(
                              () =>
                                request(`/api/foods/${food.id}/reject`, {
                                  method: 'POST',
                                  json: { reason },
                                }).then(() => undefined),
                              'บันทึกการไม่อนุมัติแล้ว',
                            )
                          }}
                        >
                          ไม่อนุมัติ
                        </Button>
                      </>
                    ) : null}
                    {food.status === 'ACTIVE' ? (
                      <Button
                        variant="danger"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              request(`/api/foods/${food.id}`, {
                                method: 'PATCH',
                                json: {
                                  name: food.name,
                                  category: food.category ?? undefined,
                                  status: 'ARCHIVED',
                                  units: food.units.map((unit) => ({
                                    id: unit.id,
                                    unitName: unit.unitName,
                                    gramsPerUnit: unit.gramsPerUnit ?? undefined,
                                    proteinAmount: unit.proteinAmount,
                                    energyKcal: unit.energyKcal ?? undefined,
                                    isDefault: unit.isDefault,
                                  })),
                                },
                              }).then(() => undefined),
                            'เก็บเข้าคลังแล้ว — ผู้ป่วยจะไม่เห็นรายการนี้อีก',
                          )
                        }
                      >
                        เก็บเข้าคลัง
                      </Button>
                    ) : null}
                    {food.status === 'ARCHIVED' || food.status === 'REJECTED' ? (
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              request(`/api/foods/${food.id}/approve`, {
                                method: 'POST',
                              }).then(() => undefined),
                            'นำกลับมาใช้งานแล้ว',
                          )
                        }
                      >
                        นำกลับมาใช้
                      </Button>
                    ) : null}
                    <Button variant="danger" onClick={() => setDeleting(food)} disabled={pending}>
                      ลบ
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {deleting ? (
        <DeleteFoodModal
          food={deleting}
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(async () => {
              await request(`/api/foods/${deleting.id}`, { method: 'DELETE' })
              setDeleting(null)
            }, `ลบ "${deleting.name}" แล้ว`)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * ลบถาวรได้เฉพาะอาหารที่ยังไม่มีใครบันทึกใช้
 * ถ้าเคยถูกใช้แล้ว ชี้ทางไป "เก็บเข้าคลัง" ตั้งแต่ในกล่องนี้เลย ไม่ต้องให้กดแล้วเจอ error
 */
function DeleteFoodModal({
  food,
  pending,
  onClose,
  onConfirm,
}: {
  food: Food
  pending: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const blocked = food.usageCount > 0

  return (
    <Modal
      tone="danger"
      title={`ลบ "${food.name}"`}
      description={blocked ? 'รายการนี้ลบถาวรไม่ได้' : 'การกระทำนี้ย้อนกลับไม่ได้'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {blocked ? 'ปิด' : 'ยกเลิก'}
          </Button>
          {blocked ? null : (
            <Button variant="danger" onClick={() => void onConfirm()} disabled={pending}>
              {pending ? 'กำลังลบ...' : 'ลบถาวร'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {blocked ? (
          <>
            <p>
              มีผู้ป่วยบันทึกอาหารนี้ไปแล้ว <strong>{food.usageCount}</strong> รายการ
              ถ้าลบทิ้งประวัติการกินย้อนหลังจะเสียไป
            </p>
            <p className="text-muted">
              ใช้ปุ่ม &quot;เก็บเข้าคลัง&quot; แทน — ผู้ป่วยจะไม่เห็นรายการนี้ตอนบันทึกอาหารใหม่
              แต่ประวัติเดิมยังอยู่ครบ
            </p>
          </>
        ) : (
          <>
            <p>
              ยังไม่มีใครบันทึกอาหารนี้ ลบได้ทันที — หน่วยทั้งหมด {food.units.length} หน่วย
              จะถูกลบไปด้วย
            </p>
            <ul className="flex flex-col gap-1 rounded-lg bg-background p-3 tabular">
              {food.units.map((unit) => (
                <li key={unit.id}>
                  {unit.unitName} · โปรตีน {unit.proteinAmount} g
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}

function FoodForm({
  title,
  initial,
  onSubmit,
  onCancel,
  pending,
}: {
  title: string
  initial?: Food
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [units, setUnits] = useState<UnitDraft[]>(
    initial
      ? initial.units.map((unit) => ({
          id: unit.id,
          unitName: unit.unitName,
          gramsPerUnit: unit.gramsPerUnit === null ? '' : String(unit.gramsPerUnit),
          proteinAmount: String(unit.proteinAmount),
          energyKcal: unit.energyKcal === null ? '' : String(unit.energyKcal),
          isDefault: unit.isDefault,
        }))
      : [{ ...emptyUnit(), isDefault: true }],
  )

  const formHasErrors =
    requiredText(name, 'ชื่ออาหาร', 200) !== null ||
    optionalText(category, 'หมวด', 100) !== null ||
    unitsHaveErrors(units)

  return (
    <Card title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit({
            name: name.trim(),
            category: category.trim() || undefined,
            units: toUnitPayload(units),
          })
        }}
      >
        <RequiredLegend />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ชื่ออาหาร" required error={requiredText(name, 'ชื่ออาหาร', 200)}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field
            label="หมวด"
            hint="เช่น เนื้อสัตว์ / ผัก / ของว่าง"
            error={optionalText(category, 'หมวด', 100)}
          >
            <Input value={category} onChange={(event) => setCategory(event.target.value)} />
          </Field>
        </div>

        <FoodUnitFields units={units} onChange={setUnits} />

        <div className="flex gap-2">
          <Button type="submit" disabled={pending || formHasErrors}>
            บันทึก
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Card>
  )
}
