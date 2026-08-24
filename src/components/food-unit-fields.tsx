'use client'

import { Button, Field, Input } from '@/components/ui'

export type UnitDraft = {
  id?: string
  unitName: string
  gramsPerUnit: string
  proteinAmount: string
  isDefault: boolean
}

export const emptyUnit = (): UnitDraft => ({
  unitName: '',
  gramsPerUnit: '',
  proteinAmount: '',
  isDefault: false,
})

export function toUnitPayload(units: UnitDraft[]) {
  return units.map((unit) => ({
    id: unit.id,
    unitName: unit.unitName.trim(),
    gramsPerUnit: unit.gramsPerUnit ? Number(unit.gramsPerUnit) : undefined,
    proteinAmount: Number(unit.proteinAmount),
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
  function update(index: number, patch: Partial<UnitDraft>) {
    onChange(units.map((unit, unitIndex) => (unitIndex === index ? { ...unit, ...patch } : unit)))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        หน่วยและปริมาณโปรตีน
        <span className="ml-2 font-normal text-muted">
          หนึ่งอาหารมีได้หลายหน่วย เช่น 100 กรัม / 1 ชิ้น / 1 จาน
        </span>
      </p>

      {units.map((unit, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg bg-background p-3">
          <Field label="ชื่อหน่วย" className="min-w-36 flex-1">
            <Input
              value={unit.unitName}
              onChange={(event) => update(index, { unitName: event.target.value })}
              placeholder="เช่น 100 กรัม"
              required
            />
          </Field>
          <Field label="น้ำหนัก (g)" className="w-32" hint="ไม่บังคับ">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={unit.gramsPerUnit}
              onChange={(event) => update(index, { gramsPerUnit: event.target.value })}
              className="tabular"
            />
          </Field>
          <Field label="โปรตีน (g)" className="w-32">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={unit.proteinAmount}
              onChange={(event) => update(index, { proteinAmount: event.target.value })}
              className="tabular"
              required
            />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="radio"
              name="default-unit"
              checked={unit.isDefault}
              onChange={() =>
                onChange(
                  units.map((row, rowIndex) => ({
                    ...row,
                    isDefault: rowIndex === index,
                  })),
                )
              }
            />
            หน่วยหลัก
          </label>
          {units.length > 1 ? (
            <Button
              variant="ghost"
              type="button"
              onClick={() => onChange(units.filter((_, i) => i !== index))}
            >
              ลบ
            </Button>
          ) : null}
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
