'use client'

import { useId } from 'react'
import { Badge, Button, Field, Input } from '@/components/ui'

export type UnitDraft = {
  id?: string
  unitName: string
  gramsPerUnit: string
  proteinAmount: string
  energyKcal: string
  isDefault: boolean
}

export const emptyUnit = (): UnitDraft => ({
  unitName: '',
  gramsPerUnit: '',
  proteinAmount: '',
  energyKcal: '',
  isDefault: false,
})

export function toUnitPayload(units: UnitDraft[]) {
  return units.map((unit) => ({
    id: unit.id,
    unitName: unit.unitName.trim(),
    gramsPerUnit: unit.gramsPerUnit ? Number(unit.gramsPerUnit) : undefined,
    proteinAmount: Number(unit.proteinAmount),
    energyKcal: unit.energyKcal.trim() ? Number(unit.energyKcal) : undefined,
    isDefault: unit.isDefault,
  }))
}

/** ตัวแก้หน่วยอาหาร ใช้ร่วมกันทั้งฝั่ง admin และฟอร์มเสนออาหารของผู้ป่วย */
export function FoodUnitFields({
  units,
  onChange,
}: {
  units: UnitDraft[]
  onChange: (units: UnitDraft[]) => void
}) {
  // ฟอร์มเพิ่ม/แก้ไขอาจอยู่บนหน้าเดียวกัน — ต้องแยกกลุ่ม radio ไม่ให้ทับกัน
  const groupName = useId()

  function update(index: number, patch: Partial<UnitDraft>) {
    onChange(units.map((unit, unitIndex) => (unitIndex === index ? { ...unit, ...patch } : unit)))
  }

  function setDefault(index: number) {
    onChange(units.map((unit, unitIndex) => ({ ...unit, isDefault: unitIndex === index })))
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">หน่วยและปริมาณโปรตีน</p>
        <p className="text-sm text-muted">
          หนึ่งอาหารมีได้หลายหน่วย เช่น 100 กรัม / 1 ชิ้น / 1 จาน —
          หน่วยหลักคือหน่วยที่ระบบเลือกให้อัตโนมัติตอนบันทึกอาหาร ช่องพลังงานไม่บังคับ แต่ถ้าใส่ไว้
          ระบบจะรวมพลังงานที่ผู้ป่วยทานในแต่ละวันให้อัตโนมัติ
        </p>
      </div>

      {units.map((unit, index) => (
        <div key={unit.id ?? index} className="rounded-lg border border-line bg-background p-3">
          <div className="flex items-center justify-between gap-2 pb-2">
            <p className="text-sm font-medium">
              หน่วยที่ {index + 1}
              {unit.isDefault ? (
                <span className="ml-2">
                  <Badge tone="brand">หน่วยหลัก</Badge>
                </span>
              ) : null}
            </p>
            {units.length > 1 ? (
              <Button
                variant="ghost"
                type="button"
                className="px-2 py-1 text-xs hover:text-danger"
                onClick={() => {
                  const next = units.filter((_, i) => i !== index)
                  // ลบหน่วยหลักทิ้ง ต้องเลื่อนให้หน่วยแรกเป็นหน่วยหลักแทน ไม่งั้นไม่มีหน่วยหลักเลย
                  if (!next.some((row) => row.isDefault)) next[0] = { ...next[0], isDefault: true }
                  onChange(next)
                }}
              >
                ลบหน่วยนี้
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(9rem,1fr)_7rem_7rem_8rem]">
            <Field label="ชื่อหน่วย" hint="ตามที่ผู้ป่วยจะเห็นตอนเลือก">
              <Input
                value={unit.unitName}
                onChange={(event) => update(index, { unitName: event.target.value })}
                placeholder="เช่น 100 กรัม"
                required
              />
            </Field>
            <Field label="น้ำหนัก (g)" hint="ไม่บังคับ">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unit.gramsPerUnit}
                onChange={(event) => update(index, { gramsPerUnit: event.target.value })}
                className="w-full tabular"
                placeholder="—"
              />
            </Field>
            <Field label="โปรตีน (g)" hint="ต่อ 1 หน่วยนี้">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unit.proteinAmount}
                onChange={(event) => update(index, { proteinAmount: event.target.value })}
                className="w-full tabular"
                required
              />
            </Field>
            <Field label="พลังงาน (kcal)" hint="ต่อ 1 หน่วยนี้ · ไม่บังคับ">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unit.energyKcal}
                onChange={(event) => update(index, { energyKcal: event.target.value })}
                className="w-full tabular"
                placeholder="—"
              />
            </Field>
          </div>

          <label className="mt-3 flex w-fit items-center gap-2 border-t border-line pt-3 text-sm">
            <input
              type="radio"
              name={groupName}
              checked={unit.isDefault}
              onChange={() => setDefault(index)}
            />
            ตั้งเป็นหน่วยหลัก
          </label>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => onChange([...units, emptyUnit()])}
      >
        + เพิ่มหน่วย
      </Button>
    </div>
  )
}
