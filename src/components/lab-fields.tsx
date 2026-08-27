'use client'

import { Button, Field, Input, Select } from '@/components/ui'

/**
 * ส่วนกรอกผลเลือด ใช้ร่วมกันระหว่างฟอร์มเพิ่มผู้ป่วยใหม่กับฟอร์มบันทึกข้อมูลสุขภาพ
 * labType ใน DB ยังเป็น free string จึงเปิดให้พิมพ์รายการเองได้ด้วย
 */

export const COMMON_LABS = [
  { code: 'CREATININE', label: 'Cr (Creatinine)', unit: 'mg/dL' },
  { code: 'EGFR', label: 'eGFR', unit: 'mL/min/1.73m²' },
  { code: 'BUN', label: 'BUN', unit: 'mg/dL' },
  { code: 'ALBUMIN', label: 'Alb (Albumin)', unit: 'g/dL' },
  { code: 'HB', label: 'Hb', unit: 'g/dL' },
  { code: 'HCT', label: 'HCT', unit: '%' },
  { code: 'FBS', label: 'FBS', unit: 'mg/dL' },
  { code: 'TG', label: 'TG', unit: 'mg/dL' },
  { code: 'CHOL', label: 'Chol', unit: 'mg/dL' },
  { code: 'POTASSIUM', label: 'Potassium', unit: 'mmol/L' },
  { code: 'PHOSPHORUS', label: 'Phosphorus', unit: 'mg/dL' },
  { code: 'SODIUM', label: 'Sodium', unit: 'mmol/L' },
]

export type LabRow = { labType: string; customType: string; value: string; unit: string }

export const emptyLab = (): LabRow => ({
  labType: 'CREATININE',
  customType: '',
  value: '',
  unit: 'mg/dL',
})

/** ชื่อที่โชว์ให้คนอ่าน */
export function labName(row: LabRow) {
  return row.labType === '__CUSTOM__'
    ? row.customType.trim().toUpperCase()
    : (COMMON_LABS.find((lab) => lab.code === row.labType)?.label ?? row.labType)
}

/** ค่าที่ส่งเข้า DB ต้องเป็น code ไม่ใช่ label */
export function labCode(row: LabRow) {
  return row.labType === '__CUSTOM__' ? row.customType.trim().toUpperCase() : row.labType
}

/** เฉพาะแถวที่กรอกค่าแล้วและรู้ว่าเป็นรายการอะไร */
export function filledLabs(rows: LabRow[]) {
  return rows.filter((lab) => lab.value.trim() !== '' && labCode(lab) !== '')
}

export function toLabPayload(rows: LabRow[]) {
  return filledLabs(rows).map((lab) => ({
    labType: labCode(lab),
    value: Number(lab.value),
    unit: lab.unit.trim() || undefined,
  }))
}

export function LabFields({
  labs,
  onChange,
  title = 'ผลเลือด',
  hint,
}: {
  labs: LabRow[]
  onChange: (labs: LabRow[]) => void
  title?: string
  hint?: string
}) {
  function update(index: number, patch: Partial<LabRow>) {
    onChange(labs.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {title}
        {hint ? <span className="ml-2 font-normal text-muted">{hint}</span> : null}
      </p>

      {labs.map((lab, index) => (
        <div key={index} className="rounded-lg bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_8rem_9rem_auto]">
            <Field label="รายการ">
              <Select
                value={lab.labType}
                onChange={(event) => {
                  const next = event.target.value
                  update(index, {
                    labType: next,
                    unit: COMMON_LABS.find((item) => item.code === next)?.unit ?? '',
                  })
                }}
              >
                {COMMON_LABS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
                <option value="__CUSTOM__">อื่นๆ (พิมพ์เอง)</option>
              </Select>
            </Field>
            <Field label="ค่าที่ตรวจได้">
              <Input
                type="number"
                step="0.0001"
                value={lab.value}
                onChange={(event) => update(index, { value: event.target.value })}
                className="w-full tabular"
              />
            </Field>
            <Field label="หน่วย">
              <Input
                value={lab.unit}
                onChange={(event) => update(index, { unit: event.target.value })}
                className="w-full"
              />
            </Field>
            {labs.length > 1 ? (
              <Button
                variant="ghost"
                type="button"
                className="h-fit self-end px-2 py-2 text-xs hover:text-danger"
                onClick={() => onChange(labs.filter((_, i) => i !== index))}
              >
                ลบ
              </Button>
            ) : null}
          </div>

          {lab.labType === '__CUSTOM__' ? (
            <Field label="ชื่อรายการ" className="mt-3 max-w-64">
              <Input
                value={lab.customType}
                onChange={(event) => update(index, { customType: event.target.value })}
                placeholder="เช่น URIC ACID"
              />
            </Field>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => onChange([...labs, emptyLab()])}
      >
        + เพิ่มผลเลือด
      </Button>
    </section>
  )
}
