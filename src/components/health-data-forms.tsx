'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, Modal, Select } from '@/components/ui'
import { request } from '@/lib/client/api'

type Comorbidity = { id: string; code: string; name: string }

/** ผลเลือดที่ใช้บ่อย — labType ยังเป็น free string จึงเปิดให้พิมพ์เองได้ด้วย */
const COMMON_LABS = [
  { code: 'EGFR', label: 'eGFR', unit: 'mL/min/1.73m²' },
  { code: 'CREATININE', label: 'Creatinine', unit: 'mg/dL' },
  { code: 'BUN', label: 'BUN', unit: 'mg/dL' },
  { code: 'ALBUMIN', label: 'Albumin', unit: 'g/dL' },
  { code: 'POTASSIUM', label: 'Potassium', unit: 'mEq/L' },
  { code: 'PHOSPHORUS', label: 'Phosphorus', unit: 'mg/dL' },
]

type LabRow = { labType: string; customType: string; value: string; unit: string }

const emptyLab = (): LabRow => ({
  labType: 'EGFR',
  customType: '',
  value: '',
  unit: 'mL/min/1.73m²',
})

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function labName(row: LabRow) {
  return row.labType === '__CUSTOM__'
    ? row.customType.trim().toUpperCase()
    : (COMMON_LABS.find((lab) => lab.code === row.labType)?.label ?? row.labType)
}

/**
 * ฟอร์มข้อมูลสุขภาพทั้งชุด — น้ำหนัก + ผลเลือด + โรคร่วม อยู่ในฟอร์มเดียว ปุ่มบันทึกเดียว
 * กดแล้วเปิดกล่องยืนยันให้ตรวจก่อน เพราะข้อมูลชุดนี้มีผลกับเป้าหมายโปรตีนโดยตรง
 */
export function HealthDataForms({
  patientId,
  comorbidities,
  selectedCodes,
}: {
  patientId: string
  comorbidities: Comorbidity[]
  selectedCodes: string[]
}) {
  const router = useRouter()
  const [measuredOn, setMeasuredOn] = useState(todayString())
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [labs, setLabs] = useState<LabRow[]>([emptyLab()])
  const [codes, setCodes] = useState<string[]>(selectedCodes)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filledLabs = labs.filter((lab) => lab.value.trim() !== '' && labName(lab) !== '')
  const comorbidityChanged = [...codes].sort().join() !== [...selectedCodes].sort().join()
  const hasChanges = weightKg.trim() !== '' || filledLabs.length > 0 || comorbidityChanged

  function updateLab(index: number, patch: Partial<LabRow>) {
    setLabs((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function save() {
    setError(null)
    setPending(true)
    try {
      const result = await request<{
        saved: { measurement: boolean; labs: number; comorbidities: number }
      }>(`/api/patients/${patientId}/health-data`, {
        method: 'POST',
        json: {
          measuredOn,
          weightKg: weightKg.trim() ? Number(weightKg) : undefined,
          heightCm: heightCm.trim() ? Number(heightCm) : undefined,
          labs: filledLabs.map((lab) => ({
            labType: labName(lab),
            value: Number(lab.value),
            unit: lab.unit.trim() || undefined,
          })),
          comorbidityCodes: comorbidityChanged ? codes : null,
        },
      })

      const parts = [
        result.saved.measurement ? 'น้ำหนัก/ส่วนสูง' : null,
        result.saved.labs > 0 ? `ผลเลือด ${result.saved.labs} รายการ` : null,
        comorbidityChanged ? 'โรคร่วม' : null,
      ].filter(Boolean)

      setConfirming(false)
      setWeightKg('')
      setHeightCm('')
      setLabs([emptyLab()])
      setNotice(`บันทึก ${parts.join(' · ')} เรียบร้อย — กด Preview ด้านบนเพื่อคำนวณเป้าหมายใหม่`)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="ข้อมูลสุขภาพ"
      description="กรอกเท่าที่มี แล้วกดบันทึกครั้งเดียว — ทุกอย่างถูกบันทึกพร้อมกันเป็นการตรวจครั้งเดียว"
      actions={
        <Button onClick={() => setConfirming(true)} disabled={!hasChanges || pending}>
          บันทึกข้อมูล
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error && !confirming ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}

        <Field label="วันที่ตรวจ" className="max-w-48" hint="ใช้กับทั้งน้ำหนักและผลเลือดในครั้งนี้">
          <Input
            type="date"
            value={measuredOn}
            onChange={(event) => setMeasuredOn(event.target.value)}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">น้ำหนัก / ส่วนสูง</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="น้ำหนัก (kg)">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                className="tabular"
              />
            </Field>
            <Field label="ส่วนสูง (cm)" hint="จำเป็นถ้ากฎคำนวณใช้น้ำหนักอุดมคติ">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                className="tabular"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">ผลเลือด</p>
          {labs.map((lab, index) => (
            <div
              key={index}
              className="flex flex-wrap items-end gap-3 rounded-lg bg-background p-3"
            >
              <Field label="รายการ" className="min-w-40 flex-1">
                <Select
                  value={lab.labType}
                  onChange={(event) => {
                    const next = event.target.value
                    updateLab(index, {
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
              {lab.labType === '__CUSTOM__' ? (
                <Field label="ชื่อรายการ" className="w-44">
                  <Input
                    value={lab.customType}
                    onChange={(event) => updateLab(index, { customType: event.target.value })}
                  />
                </Field>
              ) : null}
              <Field label="ค่าที่ตรวจได้" className="w-32">
                <Input
                  type="number"
                  step="0.0001"
                  value={lab.value}
                  onChange={(event) => updateLab(index, { value: event.target.value })}
                  className="tabular"
                />
              </Field>
              <Field label="หน่วย" className="w-40">
                <Input
                  value={lab.unit}
                  onChange={(event) => updateLab(index, { unit: event.target.value })}
                />
              </Field>
              {labs.length > 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => setLabs((current) => current.filter((_, i) => i !== index))}
                >
                  ลบ
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => setLabs((current) => [...current, emptyLab()])}
          >
            + เพิ่มผลเลือด
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            โรคร่วม
            <span className="ml-2 font-normal text-muted">
              กฎคำนวณบางข้ออ้างอิงโรคร่วม เช่น ผู้ป่วยฟอกไต
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {comorbidities.map((comorbidity) => {
              const checked = codes.includes(comorbidity.code)
              return (
                <button
                  key={comorbidity.id}
                  type="button"
                  onClick={() =>
                    setCodes((current) =>
                      checked
                        ? current.filter((code) => code !== comorbidity.code)
                        : [...current, comorbidity.code],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    checked
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-surface text-muted hover:bg-background'
                  }`}
                >
                  {checked ? '✓ ' : ''}
                  {comorbidity.name}
                </button>
              )
            })}
            {comorbidities.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีรายการโรคร่วมในระบบ</p>
            ) : null}
          </div>
        </section>
      </div>

      {confirming ? (
        <Modal
          title="ยืนยันการบันทึก"
          description={`ข้อมูลของวันที่ ${measuredOn}`}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                กลับไปแก้
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            {error ? <Alert>{error}</Alert> : null}

            {weightKg.trim() ? (
              <div className="flex justify-between rounded-lg bg-background px-3 py-2">
                <span className="text-muted">น้ำหนัก / ส่วนสูง</span>
                <span className="tabular font-medium">
                  {weightKg} kg{heightCm.trim() ? ` · ${heightCm} cm` : ''}
                </span>
              </div>
            ) : null}

            {filledLabs.map((lab, index) => (
              <div key={index} className="flex justify-between rounded-lg bg-background px-3 py-2">
                <span className="text-muted">{labName(lab)}</span>
                <span className="tabular font-medium">
                  {lab.value} {lab.unit}
                </span>
              </div>
            ))}

            {comorbidityChanged ? (
              <div className="rounded-lg bg-background px-3 py-2">
                <p className="text-muted">โรคร่วม (แทนที่ของเดิมทั้งชุด)</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {codes.length === 0 ? (
                    <span className="text-muted">ไม่มี</span>
                  ) : (
                    codes.map((code) => (
                      <Badge key={code} tone="brand">
                        {comorbidities.find((item) => item.code === code)?.name ?? code}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted">
              ทั้งหมดนี้ถูกบันทึกพร้อมกันเป็นการตรวจครั้งเดียว
              ถ้ามีส่วนใดผิดพลาดจะไม่มีอะไรถูกบันทึกเลย ข้อมูลเดิมไม่ถูกทับ —
              ระบบเพิ่มเป็นแถวใหม่เสมอ
            </p>
          </div>
        </Modal>
      ) : null}
    </Card>
  )
}
