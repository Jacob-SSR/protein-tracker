'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui'
import { request } from '@/lib/client/api'

type Comorbidity = { id: string; code: string; name: string }

/** รายการผลเลือดที่ใช้บ่อย — labType ยังเป็น free string จึงเปิดให้พิมพ์เองได้ด้วย */
const COMMON_LABS = [
  { code: 'EGFR', label: 'eGFR', unit: 'mL/min/1.73m²' },
  { code: 'CREATININE', label: 'Creatinine', unit: 'mg/dL' },
  { code: 'BUN', label: 'BUN', unit: 'mg/dL' },
  { code: 'ALBUMIN', label: 'Albumin', unit: 'g/dL' },
  { code: 'POTASSIUM', label: 'Potassium', unit: 'mEq/L' },
  { code: 'PHOSPHORUS', label: 'Phosphorus', unit: 'mg/dL' },
]

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

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
  const [codes, setCodes] = useState<string[]>(selectedCodes)
  const [labType, setLabType] = useState('EGFR')
  const [state, setState] = useState<{ error?: string; notice?: string }>({})
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>, notice: string) {
    setState({})
    setPending(true)
    try {
      await action()
      setState({ notice })
      router.refresh()
    } catch (cause) {
      setState({ error: (cause as Error).message })
    } finally {
      setPending(false)
    }
  }

  async function addMeasurement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const height = Number(data.get('heightCm'))
    await run(async () => {
      await request(`/api/patients/${patientId}/measurements`, {
        method: 'POST',
        json: {
          measuredOn: String(data.get('measuredOn')),
          weightKg: Number(data.get('weightKg')),
          heightCm: height > 0 ? height : undefined,
        },
      })
      form.reset()
    }, 'บันทึกน้ำหนักแล้ว — อย่าลืมกด Preview เพื่อคำนวณเป้าหมายใหม่')
  }

  async function addLab(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const custom = String(data.get('customLabType') || '').trim()
    await run(async () => {
      await request(`/api/patients/${patientId}/labs`, {
        method: 'POST',
        json: {
          labType: custom || String(data.get('labType')),
          value: Number(data.get('value')),
          unit: String(data.get('unit') || '') || undefined,
          measuredOn: String(data.get('measuredOn')),
        },
      })
      form.reset()
    }, 'บันทึกผลเลือดแล้ว — อย่าลืมกด Preview เพื่อคำนวณเป้าหมายใหม่')
  }

  async function saveComorbidities() {
    await run(async () => {
      await request(`/api/patients/${patientId}/comorbidities`, {
        method: 'PUT',
        json: { comorbidityCodes: codes },
      })
    }, 'บันทึกโรคร่วมแล้ว')
  }

  const selectedLab = COMMON_LABS.find((lab) => lab.code === labType)

  return (
    <div className="flex flex-col gap-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.notice ? <Alert tone="ok">{state.notice}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="บันทึกน้ำหนัก / ส่วนสูง" description="เพิ่มแถวใหม่ทุกครั้ง ไม่ทับค่าเดิม">
          <form onSubmit={addMeasurement} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="วันที่วัด">
                <Input name="measuredOn" type="date" required defaultValue={todayString()} />
              </Field>
              <Field label="น้ำหนัก (kg)">
                <Input
                  name="weightKg"
                  type="number"
                  step="0.1"
                  min="1"
                  required
                  className="tabular"
                />
              </Field>
              <Field label="ส่วนสูง (cm)">
                <Input name="heightCm" type="number" step="0.1" min="1" className="tabular" />
              </Field>
            </div>
            <Button type="submit" disabled={pending} className="self-start">
              บันทึก
            </Button>
          </form>
        </Card>

        <Card title="บันทึกผลเลือด">
          <form onSubmit={addLab} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="รายการ">
                <Select
                  name="labType"
                  value={labType}
                  onChange={(event) => setLabType(event.target.value)}
                >
                  {COMMON_LABS.map((lab) => (
                    <option key={lab.code} value={lab.code}>
                      {lab.label}
                    </option>
                  ))}
                  <option value="__CUSTOM__">อื่นๆ (พิมพ์เอง)</option>
                </Select>
              </Field>
              {labType === '__CUSTOM__' ? (
                <Field label="ชื่อรายการ" hint="ระบบจะเก็บเป็นตัวพิมพ์ใหญ่">
                  <Input name="customLabType" required />
                </Field>
              ) : (
                <Field label="หน่วย">
                  <Input name="unit" defaultValue={selectedLab?.unit ?? ''} key={labType} />
                </Field>
              )}
              <Field label="ค่าที่ตรวจได้">
                <Input name="value" type="number" step="0.0001" required className="tabular" />
              </Field>
              <Field label="วันที่ตรวจ">
                <Input name="measuredOn" type="date" required defaultValue={todayString()} />
              </Field>
            </div>
            <Button type="submit" disabled={pending} className="self-start">
              บันทึก
            </Button>
          </form>
        </Card>
      </div>

      <Card
        title="โรคร่วม"
        description="กฎคำนวณโปรตีนบางข้ออ้างอิงโรคร่วม เช่น ผู้ป่วยฟอกไต"
        actions={
          <Button onClick={saveComorbidities} disabled={pending}>
            บันทึก
          </Button>
        }
      >
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
      </Card>
    </div>
  )
}
