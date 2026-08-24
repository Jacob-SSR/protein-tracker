'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Badge, Button, Card } from '@/components/ui'
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
  referenceWeightKg: number
  proteinFactor: number | null
  proteinTargetGrams: number | null
  effectiveFrom: string
  selected: { ruleName: string } | null
  current: { proteinTargetGrams: number; effectiveFrom: string } | null
  evaluations: {
    ruleId: string
    ruleName: string
    matched: boolean
    conditions: Condition[]
  }[]
}

const OPERATOR_LABELS: Record<string, string> = {
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
  EQ: '=',
  NEQ: '≠',
}

/** Preview → เทียบเดิม/ใหม่ → Confirm (คนละ endpoint กัน preview ไม่แตะ DB) */
export function ProteinTargetPanel({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function runPreview() {
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      const data = await request<{ preview: Preview }>(
        `/api/patients/${patientId}/protein-target/preview`,
        { method: 'POST' },
      )
      setPreview(data.preview)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function confirm() {
    if (!preview?.proteinTargetGrams) return
    setError(null)
    setPending(true)
    try {
      await request(`/api/patients/${patientId}/protein-target/confirm`, {
        method: 'POST',
        json: { expectedProteinTargetGrams: preview.proteinTargetGrams },
      })
      setNotice(`ยืนยันแล้ว เป้าหมายใหม่มีผลตั้งแต่ ${preview.effectiveFrom}`)
      setPreview(null)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card
      title="เป้าหมายโปรตีน"
      description="Preview ไม่บันทึกลงฐานข้อมูล — เป้าหมายใหม่มีผล 00:00 ของวันถัดไป"
      actions={
        <Button variant="secondary" onClick={runPreview} disabled={pending}>
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
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-4">
              <div>
                <p className="text-xs text-muted">เป้าหมายเดิม</p>
                <p className="tabular text-lg">
                  {preview.current ? `${preview.current.proteinTargetGrams} g` : 'ยังไม่กำหนด'}
                </p>
              </div>
              <span className="text-2xl text-muted">→</span>
              <div>
                <p className="text-xs text-muted">เป้าหมายใหม่</p>
                <p className="tabular text-2xl font-semibold text-brand">
                  {preview.proteinTargetGrams === null
                    ? 'คำนวณไม่ได้'
                    : `${preview.proteinTargetGrams} g`}
                </p>
              </div>
              <div className="ml-auto text-right text-sm text-muted">
                <p>{preview.selected?.ruleName ?? 'ไม่มีกฎที่ตรงกับข้อมูลผู้ป่วย'}</p>
                <p className="tabular">
                  {preview.proteinFactor ?? '—'} g/kg × {preview.referenceWeightKg} kg
                </p>
                <p>มีผล {preview.effectiveFrom}</p>
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted">
                ดูว่ากฎแต่ละข้อ match หรือไม่ ({preview.evaluations.length} ข้อ)
              </summary>
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
