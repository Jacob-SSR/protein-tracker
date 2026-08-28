'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Gender } from '@prisma/client'
import { Alert, Badge, Button, Field, Input, Modal } from '@/components/ui'
import {
  LabFields,
  labRowsFrom,
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

export type ExamSchedule = {
  intervalMonths: number
  lastExamOn: string | null
  dueOn: string | null
  daysUntilDue: number | null
  status: 'NO_EXAM' | 'UPCOMING' | 'DUE' | 'OVERDUE'
  canRecord: boolean
}

export type PreviousLab = { labType: string; value: number; unit: string | null }

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
  schedule,
  previousLabs = [],
  title = 'ข้อมูลสุขภาพ',
}: {
  patientId: string
  patient: HealthFormPatient
  comorbidities: Comorbidity[]
  selectedCodes: string[]
  /** รอบการตรวจ — ใช้บอกว่าถึงกำหนดหรือยัง ไม่ได้ห้ามบันทึก */
  schedule?: ExamSchedule
  /** ผลเลือดครั้งก่อน เอามาตั้งเป็นค่าเริ่มต้นให้แก้ทับ */
  previousLabs?: PreviousLab[]
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
  // เติมผลเลือดครั้งก่อนไว้ให้ แก้เฉพาะค่าที่เปลี่ยนก็พอ
  const [labs, setLabs] = useState<LabRow[]>(() => labRowsFrom(previousLabs))
  const [labsTouched, setLabsTouched] = useState(false)
  // ยังไม่ถึงรอบตรวจ ต้องกดยืนยันก่อนถึงจะบันทึกได้ กันบันทึกซ้ำโดยไม่ตั้งใจ
  const [earlyConfirmed, setEarlyConfirmed] = useState(false)
  const [codes, setCodes] = useState<string[]>(selectedCodes)
  // ยังไม่ถึงรอบตรวจ = ปิดไว้ก่อน ไม่ต้องมาเลื่อนผ่านฟอร์มยาวๆ ทุกครั้งที่เปิดหน้า
  // ถึงรอบแล้ว (หรือยังไม่เคยตรวจ) = เปิดรอไว้เลย เพราะนั่นคือสิ่งที่ต้องทำในวันนั้น
  const [open, setOpen] = useState(schedule ? schedule.canRecord : true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filledLabs = pickFilledLabs(labs)
  const blockedBySchedule = schedule ? !schedule.canRecord && !earlyConfirmed : false
  const comorbidityChanged = [...codes].sort().join() !== [...selectedCodes].sort().join()
  const hasDailyExtras = edema !== ''
  const hasWeight = weightKg.trim() !== ''
  // เป็นการตรวจของวันใหม่ ถึงจะยังไม่แก้ตัวเลขก็ถือว่ามีอะไรให้บันทึก
  const isNewVisitDate = patient.lastMeasuredOn !== null && measuredOn !== patient.lastMeasuredOn
  const hasChanges =
    (filledLabs.length > 0 && (labsTouched || previousLabs.length === 0)) ||
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
      setLabsTouched(false)
      setEarlyConfirmed(false)
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

  // สรุปว่ากดบันทึกแล้วจะได้อะไรบ้าง โชว์คู่ปุ่มเพื่อไม่ต้องเลื่อนขึ้นไปตรวจเอง
  const pendingParts = [
    hasWeight && (bodyTouched || isNewVisitDate || patient.lastMeasuredOn === null)
      ? 'น้ำหนัก/ส่วนสูง'
      : null,
    hasDailyExtras ? 'ภาวะบวม' : null,
    filledLabs.length > 0 && (labsTouched || previousLabs.length === 0)
      ? `ผลเลือด ${filledLabs.length} รายการ`
      : null,
    comorbidityChanged ? 'โรคประจำร่วม' : null,
  ].filter(Boolean) as string[]

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {/* หัวการ์ดกดพับได้ — สถานะรอบตรวจอยู่ตรงนี้ ปิดอยู่ก็ยังเห็นว่าใกล้ถึงกำหนดหรือยัง */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-background"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg"
        >
          🩺
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{title}</span>
            <ScheduleChip schedule={schedule} />
            {pendingParts.length > 0 ? (
              <Badge tone="brand">มี {pendingParts.length} อย่างรอบันทึก</Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {scheduleSubtitle(schedule)}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {!open ? null : (
        <div className="flex flex-col gap-5 border-t border-line px-5 py-5">
          {schedule && !schedule.canRecord ? (
            <ExamScheduleBar
              schedule={schedule}
              earlyConfirmed={earlyConfirmed}
              onAllowEarly={() => setEarlyConfirmed(true)}
            />
          ) : null}

          {error && !confirming ? <Alert>{error}</Alert> : null}
          {notice ? <Alert tone="ok">{notice}</Alert> : null}
          {needsWeight ? (
            <Alert tone="warn">
              ภาวะบวม / น้ำหนักแห้ง ถูกเก็บคู่กับการชั่งน้ำหนัก — กรอกน้ำหนักด้วย
            </Alert>
          ) : null}

          <Step number={1} title="วันที่ตรวจและร่างกาย">
            <Field
              label="วันที่ตรวจ"
              className="max-w-48"
              hint="ใช้กับทั้งน้ำหนักและผลเลือดในครั้งนี้"
            >
              <Input
                type="date"
                value={measuredOn}
                onChange={(event) => setMeasuredOn(event.target.value)}
              />
            </Field>

            <section className="flex flex-col gap-3">
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

              <MetricsStrip
                ibw={ibw}
                bmi={bmi}
                egfr={egfr}
                ckdLabel={ckd?.label ?? null}
                ckdStage={ckd?.stage ?? null}
              />
            </section>
          </Step>

          <Step number={2} title="ผลเลือด">
            <LabFields
              labs={labs}
              onChange={(next) => {
                setLabs(next)
                setLabsTouched(true)
              }}
              hint={
                previousLabs.length > 0
                  ? 'เติมค่าจากการตรวจครั้งก่อนไว้แล้ว — แก้เฉพาะค่าที่เปลี่ยน'
                  : undefined
              }
            />
          </Step>

          <Step number={3} title="โรคประจำร่วม" hint="เลือกได้มากกว่าหนึ่งข้อ">
            <section className="flex flex-col gap-2">
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
          </Step>
        </div>
      )}

      {/* แถบบันทึกติดขอบล่าง — เห็นตลอดว่ากดบันทึกแล้วจะได้อะไร ไม่ต้องเลื่อนกลับขึ้นไปดู */}
      {open ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <p className="min-w-0 flex-1 text-sm text-muted">
            {needsWeight
              ? 'ต้องกรอกน้ำหนักด้วย ภาวะบวม/น้ำหนักแห้งถูกเก็บคู่กับการชั่ง'
              : blockedBySchedule
                ? 'ยังไม่ถึงรอบตรวจ — กด "บันทึกก่อนกำหนด" ด้านบนถ้าจำเป็นต้องบันทึกวันนี้'
                : pendingParts.length === 0
                  ? 'ยังไม่มีอะไรเปลี่ยน — แก้ค่าที่ต้องการก่อนแล้วค่อยบันทึก'
                  : `จะบันทึก: ${pendingParts.join(' · ')}`}
          </p>
          <Button
            onClick={() => setConfirming(true)}
            disabled={!hasChanges || needsWeight || blockedBySchedule || pending}
          >
            บันทึกข้อมูล
          </Button>
        </div>
      ) : null}

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
    </section>
  )
}

/** ป้ายสถานะรอบตรวจบนหัวการ์ด — ปิดฟอร์มอยู่ก็ยังรู้ว่าถึงเวลาหรือยัง */
function ScheduleChip({ schedule }: { schedule?: ExamSchedule }) {
  if (!schedule) return null
  if (schedule.status === 'NO_EXAM') return <Badge tone="brand">ยังไม่เคยตรวจ</Badge>

  const days = schedule.daysUntilDue ?? 0
  if (schedule.status === 'OVERDUE')
    return <Badge tone="danger">เลยกำหนด {Math.abs(days)} วัน</Badge>
  if (schedule.canRecord) return <Badge tone="ok">ถึงรอบตรวจแล้ว</Badge>
  return <Badge tone="warn">อีก {days} วัน</Badge>
}

function scheduleSubtitle(schedule?: ExamSchedule) {
  if (!schedule || schedule.status === 'NO_EXAM') {
    return 'กรอกเท่าที่มี แล้วกดบันทึกครั้งเดียว — ผลเก่าไม่ถูกทับ'
  }
  return `ตรวจล่าสุด ${schedule.lastExamOn} · ครบกำหนด ${schedule.dueOn} · รอบละ ${schedule.intervalMonths} เดือน`
}

/** ขั้นตอนหนึ่งของฟอร์ม — เลขกำกับให้เห็นว่าเหลืออะไรอีกโดยไม่ต้องอ่านทั้งฟอร์ม */
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {number}
        </span>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </header>
      {children}
    </section>
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
  ckdStage,
}: {
  ibw: number | null
  bmi: number | null
  egfr: number | null
  ckdLabel: string | null
  ckdStage: number | null
}) {
  // ระยะ 4-5 คือจุดที่แผนโภชนาการเปลี่ยน จึงย้อมสีให้สะดุดตา ไม่ใช่ตัวเลขกลืนไปกับช่องอื่น
  const stageTone =
    ckdStage === null ? null : ckdStage >= 4 ? 'danger' : ckdStage === 3 ? 'warn' : 'ok'

  const items: { label: string; value: string; hint?: string | null; tone?: string | null }[] = [
    { label: 'Ideal Body Weight', value: ibw === null ? '—' : `${ibw} กก.` },
    { label: 'BMI', value: bmi === null ? '—' : `${bmi}`, hint: bmiCategory(bmi) },
    { label: 'eGFR', value: egfr === null ? '—' : `${egfr}`, hint: 'mL/min/1.73m²' },
    { label: 'ระยะโรคไต', value: ckdLabel ?? '—', tone: stageTone },
  ]

  return (
    <div className="grid gap-2 rounded-xl bg-background p-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg px-3 py-2 ${
            item.tone === 'danger'
              ? 'bg-danger-soft text-danger'
              : item.tone === 'warn'
                ? 'bg-warn-soft text-warn'
                : item.tone === 'ok'
                  ? 'bg-ok-soft text-ok'
                  : 'bg-surface'
          }`}
        >
          <p className="text-xs opacity-80">{item.label}</p>
          <p className="tabular text-lg font-semibold">{item.value}</p>
          {item.hint ? <p className="text-xs opacity-70">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}

/**
 * แถบเตือนตอนยังไม่ถึงรอบตรวจ — ต้องกดยืนยันก่อนถึงจะบันทึกได้
 *
 * ตั้งใจไม่ล็อกตาย ผู้ป่วยมาก่อนนัดหรือมีเหตุต้องตรวจนอกรอบเกิดขึ้นได้จริง
 * ระบบแค่กันการกดพลาด ไม่ได้ห้ามเจ้าหน้าที่ทำงาน
 * (สถานะ "ถึงรอบแล้ว" ไปอยู่บนหัวการ์ดแทน จึงไม่ต้องมีแถบซ้ำอีก)
 */
function ExamScheduleBar({
  schedule,
  earlyConfirmed,
  onAllowEarly,
}: {
  schedule: ExamSchedule
  earlyConfirmed: boolean
  onAllowEarly: () => void
}) {
  const days = schedule.daysUntilDue ?? 0

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
      <span>
        ยังไม่ถึงรอบตรวจ — ตรวจล่าสุด {schedule.lastExamOn} · ครบกำหนด {schedule.dueOn} (อีก {days}{' '}
        วัน)
      </span>
      {earlyConfirmed ? (
        <span className="ml-auto font-medium">✓ เปิดให้บันทึกก่อนกำหนดแล้ว</span>
      ) : (
        <Button variant="secondary" className="ml-auto py-1" onClick={onAllowEarly}>
          บันทึกก่อนกำหนด
        </Button>
      )}
    </div>
  )
}
