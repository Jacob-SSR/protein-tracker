'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Gender } from '@prisma/client'
import { Alert, Badge, Button, Card, Field, Input, Modal } from '@/components/ui'
import {
  LabFields,
  emptyLab,
  filledLabs as pickFilledLabs,
  labCode,
  labName,
  toLabPayload,
  type LabRow,
} from '@/components/lab-fields'
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

function numberToInput(value: number | null) {
  return value === null ? '' : String(value)
}

export type HealthFormPatient = {
  gender: Gender | null
  ageYears: number | null
  /** ค่าล่าสุดที่เคยบันทึก — ใช้เติมฟอร์มให้ล่วงหน้า เจ้าหน้าที่ไม่ต้องพิมพ์ซ้ำ */
  heightCm: number | null
  weightKg: number | null
  dryWeightKg: number | null
  /** วันที่ของการชั่งครั้งล่าสุด (YYYY-MM-DD) */
  lastMeasuredOn: string | null
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
  // เติมค่าล่าสุดไว้ให้เลย แก้ทับได้ตามปกติ
  const [weightKg, setWeightKg] = useState(numberToInput(patient.weightKg))
  const [heightCm, setHeightCm] = useState(numberToInput(patient.heightCm))
  const [dryWeightKg, setDryWeightKg] = useState(numberToInput(patient.dryWeightKg))
  // นับเฉพาะช่องที่เจ้าหน้าที่แตะเอง ค่าที่เติมให้ล่วงหน้าไม่นับเป็นการแก้
  const [bodyTouched, setBodyTouched] = useState(false)
  const [edema, setEdema] = useState<'YES' | 'NO' | ''>('')
  const [labs, setLabs] = useState<LabRow[]>([emptyLab()])
  const [codes, setCodes] = useState<string[]>(selectedCodes)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filledLabs = pickFilledLabs(labs)
  const comorbidityChanged = [...codes].sort().join() !== [...selectedCodes].sort().join()
  const hasDailyExtras = edema !== ''
  const hasWeight = weightKg.trim() !== ''
  // เป็นการตรวจของวันใหม่ ถึงจะยังไม่แก้ตัวเลขก็ถือว่ามีอะไรให้บันทึก
  const isNewVisitDate = patient.lastMeasuredOn !== null && measuredOn !== patient.lastMeasuredOn
  const hasChanges =
    filledLabs.length > 0 ||
    comorbidityChanged ||
    hasDailyExtras ||
    (hasWeight && (bodyTouched || isNewVisitDate || patient.lastMeasuredOn === null))
  // น้ำหนักแห้ง/บวม/น้ำ อยู่บนแถวเดียวกับน้ำหนัก — API จะปฏิเสธถ้าไม่มีน้ำหนัก
  const needsWeight = (hasDailyExtras || dryWeightKg.trim() !== '') && !hasWeight

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
  const lastMeasuredLabel = patient.lastMeasuredOn ? ` เมื่อ ${patient.lastMeasuredOn}` : ''

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
          labs: toLabPayload(labs),
          comorbidityCodes: comorbidityChanged ? codes : null,
        },
      })

      const parts = [
        result.saved.measurement ? 'น้ำหนัก/ส่วนสูง' : null,
        result.saved.labs > 0 ? `ผลเลือด ${result.saved.labs} รายการ` : null,
        comorbidityChanged ? 'โรคร่วม' : null,
      ].filter(Boolean)

      setConfirming(false)
      // router.refresh() จะส่ง prop ชุดใหม่มาแทน แต่ state ไม่ได้ re-init ตาม
      // จึงเซ็ตกลับเป็นค่าที่เพิ่งบันทึกไปเอง
      setBodyTouched(false)
      setEdema('')
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
            ภาวะบวม / น้ำหนักแห้ง ถูกเก็บคู่กับการชั่งน้ำหนัก — กรอกน้ำหนักด้วย
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
            <Field
              label="น้ำหนัก (กก.)"
              hint={
                patient.weightKg === null
                  ? 'น้ำหนักที่ชั่งได้จริงวันนี้'
                  : `ค่าล่าสุด ${patient.weightKg} กก.${lastMeasuredLabel} — แก้ทับได้`
              }
            >
              <Input
                type="number"
                step="0.1"
                min="1"
                value={weightKg}
                onChange={(event) => {
                  setWeightKg(event.target.value)
                  setBodyTouched(true)
                }}
                className="w-full tabular"
              />
            </Field>
            <Field
              label="ส่วนสูง (ซม.)"
              hint={
                patient.heightCm === null
                  ? 'จำเป็นสำหรับ IBW / BMI'
                  : `ค่าล่าสุด ${patient.heightCm} ซม. — แก้ทับได้`
              }
            >
              <Input
                type="number"
                step="0.1"
                min="1"
                value={heightCm}
                onChange={(event) => {
                  setHeightCm(event.target.value)
                  setBodyTouched(true)
                }}
                className="w-full tabular"
              />
            </Field>
            <Field
              label="Dry weight (กก.)"
              hint={
                patient.dryWeightKg === null
                  ? 'น้ำหนักแห้งที่แพทย์กำหนด'
                  : `ค่าล่าสุด ${patient.dryWeightKg} กก. — แก้ทับได้`
              }
            >
              <Input
                type="number"
                step="0.1"
                min="1"
                value={dryWeightKg}
                onChange={(event) => {
                  setDryWeightKg(event.target.value)
                  setBodyTouched(true)
                }}
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

        <LabFields labs={labs} onChange={setLabs} />

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
