'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Gender } from '@prisma/client'
import { Alert, Badge, Button, Card, Field, Input, Modal, Select } from '@/components/ui'
import {
  bmiCategory,
  bmiOf,
  ckdStageFromEgfr,
  estimateEgfr,
  idealBodyWeightKg,
} from '@/lib/protein/body-metrics'
import { request } from '@/lib/client/api'

type Comorbidity = { id: string; code: string; name: string }

/** ผลเลือดที่ใช้บ่อย — labType ยังเป็น free string จึงเปิดให้พิมพ์เองได้ด้วย */
const COMMON_LABS = [
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

type LabRow = { labType: string; customType: string; value: string; unit: string }

const emptyLab = (): LabRow => ({
  labType: 'CREATININE',
  customType: '',
  value: '',
  unit: 'mg/dL',
})

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function labName(row: LabRow) {
  return row.labType === '__CUSTOM__'
    ? row.customType.trim().toUpperCase()
    : (COMMON_LABS.find((lab) => lab.code === row.labType)?.label ?? row.labType)
}

/** ค่าที่จะส่งเข้า DB ต้องเป็น code ไม่ใช่ label ที่โชว์ให้คนอ่าน */
function labCode(row: LabRow) {
  return row.labType === '__CUSTOM__' ? row.customType.trim().toUpperCase() : row.labType
}

export type HealthFormPatient = {
  gender: Gender | null
  ageYears: number | null
  /** ส่วนสูงล่าสุดที่เคยบันทึก ใช้คำนวณ IBW/BMI เมื่อครั้งนี้ไม่ได้กรอกซ้ำ */
  heightCm: number | null
}

/**
 * ฟอร์มข้อมูลสุขภาพทั้งชุด — น้ำหนัก + ภาวะบวม + น้ำที่ดื่ม + ผลเลือด + โรคร่วม ปุ่มบันทึกเดียว
 * ใช้ร่วมกันทั้งฝั่งเจ้าหน้าที่และฝั่งผู้ป่วยที่บันทึกของตัวเอง
 * กดแล้วเปิดกล่องยืนยันให้ตรวจก่อน เพราะข้อมูลชุดนี้มีผลกับเป้าหมายโปรตีนโดยตรง
 */
export function HealthDataForms({
  patientId,
  patient,
  comorbidities,
  selectedCodes,
  title = 'ข้อมูลสุขภาพ',
}: {
  patientId: string
  patient: HealthFormPatient
  comorbidities: Comorbidity[]
  selectedCodes: string[]
  title?: string
}) {
  const router = useRouter()
  const [measuredOn, setMeasuredOn] = useState(todayString())
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [dryWeightKg, setDryWeightKg] = useState('')
  const [edema, setEdema] = useState<'YES' | 'NO' | ''>('')
  const [waterIntakeMl, setWaterIntakeMl] = useState('')
  const [labs, setLabs] = useState<LabRow[]>([emptyLab()])
  const [codes, setCodes] = useState<string[]>(selectedCodes)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filledLabs = labs.filter((lab) => lab.value.trim() !== '' && labCode(lab) !== '')
  const comorbidityChanged = [...codes].sort().join() !== [...selectedCodes].sort().join()
  const hasDailyExtras = dryWeightKg.trim() !== '' || edema !== '' || waterIntakeMl.trim() !== ''
  const hasWeight = weightKg.trim() !== ''
  const hasChanges = hasWeight || filledLabs.length > 0 || comorbidityChanged || hasDailyExtras
  // น้ำหนักแห้ง/บวม/น้ำ อยู่บนแถวเดียวกับน้ำหนัก — API จะปฏิเสธถ้าไม่มีน้ำหนัก
  const needsWeight = hasDailyExtras && !hasWeight

  // ค่าที่คำนวณสดๆ ระหว่างพิมพ์ ใช้สูตรตัวเดียวกับฝั่ง server
  const effectiveHeight = heightCm.trim() ? Number(heightCm) : patient.heightCm
  const ibw = idealBodyWeightKg(effectiveHeight, patient.gender)
  const bmi = hasWeight ? bmiOf(Number(weightKg), effectiveHeight) : null
  const creatinine = filledLabs.find((lab) => labCode(lab) === 'CREATININE')
  const labEgfr = filledLabs.find((lab) => labCode(lab) === 'EGFR')
  const egfr = labEgfr
    ? Number(labEgfr.value)
    : estimateEgfr({
        creatinineMgDl: creatinine ? Number(creatinine.value) : null,
        ageYears: patient.ageYears,
        gender: patient.gender,
      })
  const ckd = ckdStageFromEgfr(egfr)

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
          weightKg: hasWeight ? Number(weightKg) : undefined,
          heightCm: heightCm.trim() ? Number(heightCm) : undefined,
          dryWeightKg: dryWeightKg.trim() ? Number(dryWeightKg) : undefined,
          hasEdema: edema === '' ? undefined : edema === 'YES',
          waterIntakeMl: waterIntakeMl.trim() ? Number(waterIntakeMl) : undefined,
          labs: filledLabs.map((lab) => ({
            labType: labCode(lab),
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
      setDryWeightKg('')
      setEdema('')
      setWaterIntakeMl('')
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
      title={title}
      description="กรอกเท่าที่มี แล้วกดบันทึกครั้งเดียว — ทุกอย่างถูกบันทึกพร้อมกันเป็นการตรวจครั้งเดียว"
      actions={
        <Button
          onClick={() => setConfirming(true)}
          disabled={!hasChanges || needsWeight || pending}
        >
          บันทึกข้อมูล
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error && !confirming ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}
        {needsWeight ? (
          <Alert tone="warn">
            ภาวะบวม / น้ำหนักแห้ง / น้ำที่ดื่ม ถูกเก็บคู่กับการชั่งน้ำหนัก — กรอกน้ำหนักด้วย
          </Alert>
        ) : null}

        <Field label="วันที่ตรวจ" className="max-w-48" hint="ใช้กับทั้งน้ำหนักและผลเลือดในครั้งนี้">
          <Input
            type="date"
            value={measuredOn}
            onChange={(event) => setMeasuredOn(event.target.value)}
          />
        </Field>

        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium">น้ำหนัก / ส่วนสูง</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="น้ำหนัก (กก.)" hint="น้ำหนักที่ชั่งได้จริงวันนี้">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                className="w-full tabular"
              />
            </Field>
            <Field
              label="ส่วนสูง (ซม.)"
              hint={patient.heightCm ? `เดิม ${patient.heightCm} ซม.` : 'จำเป็นสำหรับ IBW / BMI'}
            >
              <Input
                type="number"
                step="0.1"
                min="1"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                className="w-full tabular"
              />
            </Field>
            <Field label="Dry weight (กก.)" hint="น้ำหนักแห้งที่แพทย์กำหนด">
              <Input
                type="number"
                step="0.1"
                min="1"
                value={dryWeightKg}
                onChange={(event) => setDryWeightKg(event.target.value)}
                className="w-full tabular"
              />
            </Field>
            <Field label="ดื่มน้ำวันนี้ (มล.)" hint="รวมทั้งวัน">
              <Input
                type="number"
                step="10"
                min="0"
                value={waterIntakeMl}
                onChange={(event) => setWaterIntakeMl(event.target.value)}
                className="w-full tabular"
                placeholder="เช่น 1200"
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
            {edema ? (
              <button
                type="button"
                onClick={() => setEdema('')}
                className="text-xs text-muted underline"
              >
                ล้างค่า
              </button>
            ) : null}
          </div>

          <MetricsStrip ibw={ibw} bmi={bmi} egfr={egfr} ckdLabel={ckd?.label ?? null} />
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">ผลเลือด</p>
          {labs.map((lab, index) => (
            <div key={index} className="rounded-lg bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_8rem_9rem_auto]">
                <Field label="รายการ">
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
                <Field label="ค่าที่ตรวจได้">
                  <Input
                    type="number"
                    step="0.0001"
                    value={lab.value}
                    onChange={(event) => updateLab(index, { value: event.target.value })}
                    className="w-full tabular"
                  />
                </Field>
                <Field label="หน่วย">
                  <Input
                    value={lab.unit}
                    onChange={(event) => updateLab(index, { unit: event.target.value })}
                    className="w-full"
                  />
                </Field>
                {labs.length > 1 ? (
                  <Button
                    variant="ghost"
                    type="button"
                    className="h-fit self-end px-2 py-2 text-xs hover:text-danger"
                    onClick={() => setLabs((current) => current.filter((_, i) => i !== index))}
                  >
                    ลบ
                  </Button>
                ) : null}
              </div>
              {lab.labType === '__CUSTOM__' ? (
                <Field label="ชื่อรายการ" className="mt-3 max-w-64">
                  <Input
                    value={lab.customType}
                    onChange={(event) => updateLab(index, { customType: event.target.value })}
                    placeholder="เช่น URIC ACID"
                  />
                </Field>
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
            โรคประจำร่วม
            <span className="ml-2 font-normal text-muted">เลือกได้มากกว่าหนึ่งข้อ</span>
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

            {hasWeight ? (
              <SummaryRow
                label="น้ำหนัก / ส่วนสูง"
                value={`${weightKg} กก.${heightCm.trim() ? ` · ${heightCm} ซม.` : ''}`}
              />
            ) : null}
            {dryWeightKg.trim() ? (
              <SummaryRow label="Dry weight" value={`${dryWeightKg} กก.`} />
            ) : null}
            {edema ? (
              <SummaryRow label="ภาวะบวม" value={edema === 'YES' ? 'บวม' : 'ไม่บวม'} />
            ) : null}
            {waterIntakeMl.trim() ? (
              <SummaryRow label="ดื่มน้ำวันนี้" value={`${waterIntakeMl} มล.`} />
            ) : null}

            {filledLabs.map((lab, index) => (
              <SummaryRow key={index} label={labName(lab)} value={`${lab.value} ${lab.unit}`} />
            ))}

            {comorbidityChanged ? (
              <div className="rounded-lg bg-background px-3 py-2">
                <p className="text-muted">โรคประจำร่วม (แทนที่ของเดิมทั้งชุด)</p>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg bg-background px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  )
}

/** แถบค่าที่ระบบคำนวณให้เอง — โชว์สดระหว่างพิมพ์ ยังไม่ได้บันทึกอะไร */
function MetricsStrip({
  ibw,
  bmi,
  egfr,
  ckdLabel,
}: {
  ibw: number | null
  bmi: number | null
  egfr: number | null
  ckdLabel: string | null
}) {
  const items = [
    { label: 'Ideal Body Weight', value: ibw === null ? '—' : `${ibw} กก.` },
    {
      label: 'BMI',
      value: bmi === null ? '—' : `${bmi}`,
      hint: bmiCategory(bmi),
    },
    { label: 'eGFR', value: egfr === null ? '—' : `${egfr}`, hint: 'mL/min/1.73m²' },
    { label: 'ระยะโรคไต', value: ckdLabel ?? '—' },
  ]

  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-line p-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs text-muted">{item.label}</p>
          <p className="tabular font-medium">{item.value}</p>
          {item.hint ? <p className="text-xs text-muted">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}
