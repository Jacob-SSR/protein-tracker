'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui'
import { LabFields, emptyLab, toLabPayload, type LabRow } from '@/components/lab-fields'
import { request } from '@/lib/client/api'

/** เพิ่มผู้ป่วยโดยไม่ต้องสร้างบัญชีเข้าระบบ — เจ้าหน้าที่บันทึกข้อมูลให้ทั้งหมด */
export function PatientCreateForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [labs, setLabs] = useState<LabRow[]>([emptyLab()])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)

    const form = event.currentTarget
    const data = new FormData(form)
    const weight = Number(data.get('weightKg'))
    const height = Number(data.get('heightCm'))
    const labPayload = toLabPayload(labs)

    try {
      await request('/api/patients', {
        method: 'POST',
        json: {
          hn: String(data.get('hn')).trim(),
          fullName: String(data.get('fullName')).trim(),
          birthDate: String(data.get('birthDate') || ''),
          gender: String(data.get('gender')) || undefined,
          weightKg: weight > 0 ? weight : undefined,
          heightCm: height > 0 ? height : undefined,
          labs: labPayload,
        },
      })
      form.reset()
      setLabs([emptyLab()])
      setNotice(
        labPayload.length > 0
          ? `เพิ่มผู้ป่วยพร้อมผลเลือด ${labPayload.length} รายการแล้ว`
          : 'เพิ่มผู้ป่วยแล้ว',
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
      description="ใส่วันเกิด เพศ และผล Cr ให้ครบ ระบบจะคำนวณระยะโรคไตและน้ำหนักอุดมคติได้ทันที"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="HN">
            <Input name="hn" required autoComplete="off" />
          </Field>
          <Field label="ชื่อ-นามสกุล">
            <Input name="fullName" required />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="วันเกิด" hint="จำเป็นสำหรับคำนวณ eGFR">
            <Input name="birthDate" type="date" />
          </Field>
          <Field label="เพศ" hint="จำเป็นสำหรับ eGFR / IBW">
            <Select name="gender" defaultValue="">
              <option value="">ไม่ระบุ</option>
              <option value="MALE">ชาย</option>
              <option value="FEMALE">หญิง</option>
              <option value="OTHER">อื่นๆ</option>
            </Select>
          </Field>
          <Field label="น้ำหนัก (กก.)">
            <Input name="weightKg" type="number" step="0.1" min="1" className="w-full tabular" />
          </Field>
          <Field label="ส่วนสูง (ซม.)">
            <Input name="heightCm" type="number" step="0.1" min="1" className="w-full tabular" />
          </Field>
        </div>

        <LabFields
          labs={labs}
          onChange={setLabs}
          hint="ไม่บังคับ — กรอกไว้เลยก็ได้ ระบบบันทึกเป็นผลตรวจของวันนี้"
        />

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            บันทึก
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Card>
  )
}
