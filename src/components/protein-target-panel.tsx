'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { WeightBasis } from '@prisma/client'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { ENERGY_FACTORS_KCAL } from '@/lib/protein/body-metrics'
import { request } from '@/lib/client/api'

type Condition = {
  conditionType: string
  operator: string
  expected: string
  actual: string | null
  matched: boolean
  reason?: string
}

type Preview = {
  referenceWeightKg: number | null
  weightBasis: WeightBasis | null
  weightBasisLabel: string | null
  weightBasisSource: 'RULE' | 'MANUAL'
  suggestedWeightBasis: WeightBasis | null
  ckd: {
    stage: number
    code: string
    label: string
    description: string
    egfr: number | null
    egfrSource: 'LAB' | 'ESTIMATED' | null
  } | null
  blockedReason: string | null
  proteinFactor: number | null
  proteinTargetGrams: number | null
  energyFactorKcal: number | null
  energyTargetKcal: number | null
  water: {
    targetMl: number
    targetLiters: number
    glassesPerDay: number
    glassSizeMl: number
    restricted: boolean
    restrictionReason: string | null
  } | null
  effectiveFrom: string
  selected: { ruleName: string } | null
  current: {
    proteinTargetGrams: number
    energyTargetKcal: number | null
    effectiveFrom: string
  } | null
  evaluations: {
    ruleId: string
    ruleName: string
    matched: boolean
    conditions: Condition[]
  }[]
  facts: {
    weightKg: number
    ibwKg: number | null
    dryWeightKg: number | null
    bmi: number | null
    hasEdema: boolean | null
  }
}

const OPERATOR_LABELS: Record<string, string> = {
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
  EQ: '=',
  NEQ: '≠',
}

const WEIGHT_CHOICES: { value: WeightBasis; label: string }[] = [
  { value: 'ACTUAL', label: 'Actual Weight' },
  { value: 'IBW', label: 'Ideal Body Weight' },
  { value: 'DRY', label: 'Dry Weight' },
]

/**
 * Preview → เลือกฐานน้ำหนัก/พลังงาน → Confirm (คนละ endpoint กัน preview ไม่แตะ DB)
 * ฐานน้ำหนักถูกติ๊กให้อัตโนมัติตามระยะไต: ระยะ 3 ขึ้นไปใช้ IBW, ระยะ 1-2 ใช้น้ำหนักจริง
 */
export function ProteinTargetPanel({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [weightBasis, setWeightBasis] = useState<WeightBasis | null>(null)
  const [energyFactor, setEnergyFactor] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function runPreview(options?: {
    weightBasis?: WeightBasis | null
    energyFactorKcal?: number | null
  }) {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const data = await request<{ preview: Preview }>(
        `/api/patients/${patientId}/protein-target/preview`,
        {
          method: 'POST',
          json: {
            weightBasis: options?.weightBasis ?? weightBasis,
            energyFactorKcal: options?.energyFactorKcal ?? energyFactor,
          },
        },
      )
      setPreview(data.preview)
      // ครั้งแรกยังไม่มีใครเลือก — ติ๊กตามที่ระบบแนะนำจากระยะไตให้เลย
      if (weightBasis === null) {
        setWeightBasis(data.preview.suggestedWeightBasis ?? data.preview.weightBasis)
      }
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  function pickWeightBasis(next: WeightBasis) {
    setWeightBasis(next)
    void runPreview({ weightBasis: next })
  }

  function pickEnergy(next: number) {
    const value = energyFactor === next ? null : next
    setEnergyFactor(value)
    void runPreview({ energyFactorKcal: value })
  }

  async function confirm() {
    if (!preview?.proteinTargetGrams) return
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}/protein-target/confirm`, {
        method: 'POST',
        json: {
          expectedProteinTargetGrams: preview.proteinTargetGrams,
          weightBasis,
          energyFactorKcal: energyFactor,
        },
      })
      setNotice(`ยืนยันแล้ว เป้าหมายใหม่มีผลตั้งแต่วันนี้ (${preview.effectiveFrom})`)
      setPreview(null)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  function weightOf(basis: WeightBasis): number | null {
    if (!preview) return null
    if (basis === 'ACTUAL') return preview.facts.weightKg
    if (basis === 'IBW') return preview.facts.ibwKg
    if (basis === 'DRY') return preview.facts.dryWeightKg
    return null
  }

  return (
    <Card
      title="เป้าหมายโปรตีนและพลังงาน"
      description="Preview ไม่บันทึกลงฐานข้อมูล — กดยืนยันแล้วเป้าหมายใหม่มีผลกับวันนี้ทันที"
      actions={
        <Button variant="secondary" onClick={() => runPreview()} disabled={pending}>
          {pending && !preview ? 'กำลังคำนวณ...' : 'Preview'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}

        {!preview ? (
          <p className="text-sm text-muted">
            กด Preview เพื่อคำนวณจากน้ำหนัก ผลเลือด และโรคร่วมล่าสุด ระบบจะแสดงผลให้ตรวจก่อนยืนยัน
          </p>
        ) : (
          <>
            {preview.ckd ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-sm">
                <Badge tone={preview.ckd.stage >= 3 ? 'warn' : 'ok'}>
                  โรคไต{preview.ckd.label} ({preview.ckd.code})
                </Badge>
                <span className="text-muted">{preview.ckd.description}</span>
                <span className="tabular ml-auto text-muted">
                  eGFR {preview.ckd.egfr ?? '—'} mL/min/1.73m²
                  {preview.ckd.egfrSource === 'ESTIMATED' ? ' (คำนวณจาก Cr)' : ' (ผลแล็บ)'}
                </span>
              </div>
            ) : (
              <Alert tone="muted">
                ยังคำนวณระยะโรคไตไม่ได้ — ต้องมีผล Cr (หรือ eGFR) พร้อมวันเกิดและเพศของผู้ป่วย
              </Alert>
            )}

            <section className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                เลือกประเภทน้ำหนักที่ใช้ในการคำนวณ
                {preview.suggestedWeightBasis ? (
                  <span className="ml-2 font-normal text-muted">
                    ระบบแนะนำ{' '}
                    {WEIGHT_CHOICES.find((item) => item.value === preview.suggestedWeightBasis)
                      ?.label ?? preview.suggestedWeightBasis}{' '}
                    ตามระยะโรคไต
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {WEIGHT_CHOICES.map((choice) => {
                  const value = weightOf(choice.value)
                  const active = weightBasis === choice.value
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      disabled={pending || value === null}
                      onClick={() => pickWeightBasis(choice.value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line bg-surface hover:bg-background'
                      }`}
                    >
                      <span className="block font-medium">
                        {active ? '✓ ' : ''}
                        {choice.label}
                      </span>
                      <span className="tabular block text-xs text-muted">
                        {value === null ? 'ยังไม่มีข้อมูล' : `${value} กก.`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                พลังงานที่ต้องการ / น้ำหนักตัว 1 กก.
                <span className="ml-2 font-normal text-muted">กดซ้ำเพื่อยกเลิก</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {ENERGY_FACTORS_KCAL.map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    disabled={pending}
                    onClick={() => pickEnergy(factor)}
                    className={`tabular rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
                      energyFactor === factor
                        ? 'border-brand bg-brand-soft font-medium text-brand'
                        : 'border-line bg-surface hover:bg-background'
                    }`}
                  >
                    {factor} Kcal
                  </button>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-4">
              <div>
                <p className="text-xs text-muted">เป้าหมายเดิม</p>
                <p className="tabular text-lg">
                  {preview.current ? `${preview.current.proteinTargetGrams} g` : 'ยังไม่กำหนด'}
                </p>
              </div>
              <span className="text-2xl text-muted">→</span>
              <div>
                <p className="text-xs text-muted">โปรตีนใหม่</p>
                <p className="tabular text-2xl font-semibold text-brand">
                  {preview.proteinTargetGrams === null
                    ? 'คำนวณไม่ได้'
                    : `${preview.proteinTargetGrams} g`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">พลังงาน</p>
                <p className="tabular text-2xl font-semibold">
                  {preview.energyTargetKcal === null ? '—' : `${preview.energyTargetKcal} kcal`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">น้ำดื่ม</p>
                <p className="tabular text-2xl font-semibold text-info">
                  {preview.water ? `${preview.water.targetMl.toLocaleString('th-TH')} มล.` : '—'}
                </p>
                {preview.water ? (
                  <p className="text-xs text-muted">
                    {preview.water.targetLiters} ลิตร · {preview.water.glassesPerDay} แก้ว
                    {preview.water.restricted ? ' (จำกัดน้ำ)' : ''}
                  </p>
                ) : null}
              </div>
              <div className="ml-auto text-right text-sm text-muted">
                <p>{preview.selected?.ruleName ?? 'ไม่มีกฎที่ตรงกับข้อมูลผู้ป่วย'}</p>
                <p className="tabular">
                  {preview.proteinFactor ?? '—'} g/kg × {preview.referenceWeightKg ?? '—'} กก.
                </p>
                {preview.weightBasisLabel ? <p>ฐาน: {preview.weightBasisLabel}</p> : null}
                <p>มีผลวันนี้ ({preview.effectiveFrom})</p>
              </div>
            </div>

            {preview.water?.restricted ? (
              <Alert tone="warn">
                จำกัดน้ำเนื่องจาก{preview.water.restrictionReason} — ใช้เพดานที่ตั้งไว้ในหน้าตั้งค่า
                แทนการคูณตามน้ำหนัก
              </Alert>
            ) : null}

            {preview.blockedReason ? <Alert tone="warn">{preview.blockedReason}</Alert> : null}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted">ดูว่ากฎแต่ละข้อ match หรือไม่</summary>
              <ul className="mt-3 flex flex-col gap-3">
                {preview.evaluations.map((evaluation) => (
                  <li key={evaluation.ruleId} className="rounded-lg border border-line p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={evaluation.matched ? 'ok' : 'muted'}>
                        {evaluation.matched ? 'ตรง' : 'ไม่ตรง'}
                      </Badge>
                      <span className="font-medium">{evaluation.ruleName}</span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1 text-muted">
                      {evaluation.conditions.map((condition, index) => (
                        <li key={index} className="tabular">
                          {condition.matched ? '✓' : '✗'} {condition.conditionType}{' '}
                          {OPERATOR_LABELS[condition.operator] ?? condition.operator}{' '}
                          {condition.expected}
                          {' — ค่าจริง '}
                          {condition.actual ?? 'ไม่มีข้อมูล'}
                          {condition.reason ? ` (${condition.reason})` : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex gap-2">
              <Button onClick={confirm} disabled={pending || preview.proteinTargetGrams === null}>
                ยืนยันเป้าหมายใหม่
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>
                ยกเลิก
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
