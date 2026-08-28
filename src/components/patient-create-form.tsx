'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui'
import { LabFields, emptyLab, toLabPayload, type LabRow } from '@/components/lab-fields'
import {
  bmiCategory,
  bmiOf,
  ckdStageFromEgfr,
  estimateEgfr,
  idealBodyWeightKg,
} from '@/lib/protein/body-metrics'
import { request } from '@/lib/client/api'

type Comorbidity = { id: string; code: string; name: string }

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function ageFrom(birthDate: string): number | null {
  if (!birthDate) return null
  const born = new Date(`${birthDate}T00:00:00Z`)
  if (Number.isNaN(born.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const before =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())
  if (before) age -= 1
  return age >= 0 ? age : null
}

/**
 * เพิ่มผู้ป่วย + บันทึกผลตรวจครั้งแรก ในการกดบันทึกครั้งเดียว
 *
 * ตั้งใจให้จบในหน้าเดียว เจ้าหน้าที่จะได้ไม่ต้องสร้างผู้ป่วยก่อน
 * แล้วเปิดอีกหน้าไปกรอกข้อมูลสุขภาพซ้ำ
 * ช่องข้อมูลสุขภาพไม่บังคับสักช่อง มีเท่าไหร่กรอกเท่านั้น
 */
export function PatientCreateForm({ comorbidities }: { comorbidities: Comorbidity[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [hn, setHn] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [measuredOn, setMeasuredOn] = useState(todayString())
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [dryWeightKg, setDryWeightKg] = useState('')
  const [edema, setEdema] = useState<'YES' | 'NO' | ''>('')
  const [labs, setLabs] = useState<LabRow[]>([emptyLab()])
  const [codes, setCodes] = useState<string[]>([])

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // ค่าที่คำนวณสดระหว่างพิมพ์ ใช้สูตรตัวเดียวกับฝั่ง server
  const genderValue = gender === 'MALE' || gender === 'FEMALE' ? gender : null
  const height = heightCm.trim() ? Number(heightCm) : null
  const weight = weightKg.trim() ? Number(weightKg) : null
  const bmi = bmiOf(weight, height)
  const ibw = idealBodyWeightKg(height, genderValue)
  const filled = toLabPayload(labs)
  const creatinine = filled.find((lab) => lab.labType === 'CREATININE')?.value ?? null
  const labEgfr = filled.find((lab) => lab.labType === 'EGFR')?.value ?? null
  const egfr =
    labEgfr ??
    estimateEgfr({
      creatinineMgDl: creatinine,
      ageYears: ageFrom(birthDate),
      gender: genderValue,
    })
  const ckd = ckdStageFromEgfr(egfr)

  function reset() {
    setHn('')
    setFullName('')
    setBirthDate('')
    setGender('')
    setMeasuredOn(todayString())
    setWeightKg('')
    setHeightCm('')
    setDryWeightKg('')
    setEdema('')
    setLabs([emptyLab()])
    setCodes([])
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)

    try {
      await request('/api/patients', {
        method: 'POST',
        json: {
          hn: hn.trim(),
          fullName: fullName.trim(),
          birthDate,
          gender: gender || undefined,
          measuredOn,
          weightKg: weight ?? undefined,
          heightCm: height ?? undefined,
          dryWeightKg: dryWeightKg.trim() ? Number(dryWeightKg) : undefined,
          hasEdema: edema === '' ? undefined : edema === 'YES',
          labs: filled,
          comorbidityCodes: codes.length > 0 ? codes : undefined,
        },
      })

      const saved = [
        weight ? 'ผลตรวจครั้งแรก' : null,
        filled.length > 0 ? `ผลเลือด ${filled.length} รายการ` : null,
        codes.length > 0 ? `โรคร่วม ${codes.length} รายการ` : null,
      ].filter(Boolean)

      reset()
      setNotice(
        saved.length > 0 ? `เพิ่มผู้ป่วยพร้อม ${saved.join(' · ')} แล้ว` : 'เพิ่มผู้ป่วยแล้ว',
      )
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>+ เพิ่มผู้ป่วย</Button>
        {notice ? <Alert tone="ok">{notice}</Alert> : null}
      </div>
    )
  }

  return (
    <Card
      title="เพิ่มผู้ป่วย"
      description="กรอกข้อมูลผู้ป่วยและผลตรวจที่มีในหน้าเดียว กดบันทึกครั้งเดียวจบ — ช่องผลตรวจไม่บังคับ มีเท่าไหร่กรอกเท่านั้น"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium">ข้อมูลผู้ป่วย</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="HN">
              <Input
                value={hn}
                onChange={(e) => setHn(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="ชื่อ-นามสกุล">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="วันเกิด" hint="จำเป็นสำหรับคำนวณ eGFR">
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <Field label="เพศ" hint="จำเป็นสำหรับ eGFR / น้ำหนักอุดมคติ">
              <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">ไม่ระบุ</option>
                <option value="MALE">ชาย</option>
                <option value="FEMALE">หญิง</option>
                <option value="OTHER">อื่นๆ</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-line pt-4">
          <div>
            <p className="text-sm font-medium">ผลตรวจครั้งแรก</p>
            <p className="text-sm text-muted">
              บันทึกเป็นการตรวจหนึ่งครั้งพร้อมกับการสร้างผู้ป่วย ครั้งถัดไป (ปกติทุก 3 เดือน)
              เพิ่มได้ที่หน้าผู้ป่วยรายนั้น ผลเก่าไม่ถูกทับ
            </p>
          </div>

          <Field label="วันที่ตรวจ" className="max-w-48">
            <Input type="date" value={measuredOn} onChange={(e) => setMeasuredOn(e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="น้ำหนัก (กก.)">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full tabular"
              />
            </Field>
            <Field label="ส่วนสูง (ซม.)">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full tabular"
              />
            </Field>
            <Field label="Dry weight (กก.)" hint="ถ้ามี">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={dryWeightKg}
                onChange={(e) => setDryWeightKg(e.target.value)}
                className="w-full tabular"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">ภาวะบวม</span>
            {(
              [
                { value: 'NO', label: 'ไม่บวม' },
                { value: 'YES', label: 'บวม' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setEdema((current) => (current === option.value ? '' : option.value))
                }
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  edema === option.value
                    ? 'border-brand bg-brand-soft font-medium text-brand'
                    : 'border-line bg-surface text-muted hover:bg-background'
                }`}
              >
                {edema === option.value ? '✓ ' : ''}
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 rounded-lg border border-dashed border-line p-3 sm:grid-cols-4">
            <Computed
              label="BMI"
              value={bmi === null ? '—' : String(bmi)}
              note={bmiCategory(bmi)}
            />
            <Computed label="น้ำหนักอุดมคติ" value={ibw === null ? '—' : `${ibw} กก.`} />
            <Computed
              label="eGFR"
              value={egfr === null ? '—' : String(egfr)}
              note="mL/min/1.73m²"
            />
            <Computed label="ระยะโรคไต" value={ckd?.label ?? '—'} note={ckd?.code} />
          </div>

          <LabFields labs={labs} onChange={setLabs} hint="กรอกเท่าที่มีผล" />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              โรคประจำร่วม
              <span className="ml-2 font-normal text-muted">เลือกได้มากกว่าหนึ่งข้อ</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {comorbidities.map((item) => {
                const checked = codes.includes(item.code)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setCodes((current) =>
                        checked
                          ? current.filter((code) => code !== item.code)
                          : [...current, item.code],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      checked
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line bg-surface text-muted hover:bg-background'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex gap-2 border-t border-line pt-4">
          <Button type="submit" disabled={pending || !hn.trim() || !fullName.trim()}>
            {pending ? 'กำลังบันทึก...' : 'บันทึกผู้ป่วยและผลตรวจ'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Computed({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular font-medium">{value}</p>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  )
}
