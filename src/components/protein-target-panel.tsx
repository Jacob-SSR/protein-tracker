'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
    conditions: { conditionType: string; operator: string; expected: string; actual: string | null; matched: boolean }[]
  }[]
}

async function readJson(response: Response) {
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message ?? 'เกิดข้อผิดพลาด')
  return payload.data
}

/** Preview -> แสดง target เดิม/ใหม่ -> Confirm (คนละ endpoint กัน preview ไม่เขียน DB) */
export function ProteinTargetPanel({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function runPreview() {
    setError(null)
    setPending(true)
    try {
      const data = await readJson(
        await fetch(`/api/patients/${patientId}/protein-target/preview`, { method: 'POST' }),
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
      await readJson(
        await fetch(`/api/patients/${patientId}/protein-target/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedProteinTargetGrams: preview.proteinTargetGrams }),
        }),
      )
      setPreview(null)
      router.refresh()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded border p-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">คำนวณเป้าหมายโปรตีน</h2>
        <button
          type="button"
          onClick={runPreview}
          disabled={pending}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Preview
        </button>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      {preview ? (
        <>
          <p>
            เดิม:{' '}
            {preview.current ? `${preview.current.proteinTargetGrams} g` : 'ยังไม่กำหนด'} → ใหม่:{' '}
            <strong>
              {preview.proteinTargetGrams === null ? 'คำนวณไม่ได้' : `${preview.proteinTargetGrams} g`}
            </strong>
          </p>
          <p className="text-gray-600">
            กฎที่ใช้: {preview.selected?.ruleName ?? 'ไม่มีกฎที่ตรง'} · {preview.proteinFactor ?? '-'}{' '}
            g/kg × {preview.referenceWeightKg} kg
          </p>
          <p className="text-gray-600">มีผลตั้งแต่ {preview.effectiveFrom} (00:00 ของวันถัดไป)</p>

          <details className="text-gray-600">
            <summary className="cursor-pointer">ดูรายละเอียดการ match กฎทุกข้อ</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {preview.evaluations.map((evaluation) => (
                <li key={evaluation.ruleId}>
                  <span className={evaluation.matched ? 'text-green-700' : ''}>
                    {evaluation.matched ? '✓' : '✗'} {evaluation.ruleName}
                  </span>
                  <ul className="ml-4">
                    {evaluation.conditions.map((condition, index) => (
                      <li key={index}>
                        {condition.conditionType} {condition.operator} {condition.expected} — ค่าจริง{' '}
                        {condition.actual ?? 'ไม่มีข้อมูล'} {condition.matched ? '✓' : '✗'}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>

          <button
            type="button"
            onClick={confirm}
            disabled={pending || preview.proteinTargetGrams === null}
            className="rounded bg-black p-2 text-white disabled:opacity-50"
          >
            ยืนยันเป้าหมายใหม่
          </button>
        </>
      ) : (
        <p className="text-gray-500">กด Preview เพื่อดูผลการคำนวณก่อนบันทึก (Preview ไม่บันทึกลง DB)</p>
      )}
    </section>
  )
}
